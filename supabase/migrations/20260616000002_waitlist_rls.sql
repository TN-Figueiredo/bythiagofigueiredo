-- =============================================================================
-- MIGRATION: waitlist_rls — fail-closed, reuse helpers (never inline).
-- Signups have NO anon-INSERT policy: they funnel through the DEFINER RPC only.
-- =============================================================================
alter table public.waitlists enable row level security;
alter table public.waitlist_signups enable row level security;
alter table public.waitlist_translations enable row level security;

drop policy if exists waitlists_public_read on public.waitlists;
create policy waitlists_public_read on public.waitlists for select to anon, authenticated
  using (status in ('open','closed','launched') and public.site_visible(site_id));

-- RLS is row-level, not column-level: the public-read policy above would otherwise
-- expose send-pipeline config (sender_email/reply_to/sender_name) to anon on every
-- visible waitlist. The public landing only needs id/site_id/slug/name/status/
-- description/intro_mdx/launched_at/timestamps.
--
-- A bare `revoke select (cols)` is a NO-OP while a table-wide SELECT grant exists
-- (Supabase's `alter default privileges ... grant all on tables to anon` covers
-- every column at CREATE TABLE time). To actually restrict columns we must drop the
-- table-level SELECT grant first, then re-grant SELECT only on the public columns.
-- This is column-level GRANT, additive to RLS: the policy still picks rows; anon can
-- now read only the listed columns. Staff are the `authenticated` role (staff-read
-- policy) and are unaffected.
revoke select on public.waitlists from anon;
grant select (id, site_id, slug, name, status, description, intro_mdx, launched_at,
              created_at, updated_at)
  on public.waitlists to anon;

drop policy if exists waitlists_staff_read on public.waitlists;
create policy waitlists_staff_read on public.waitlists for select to authenticated
  using (public.can_view_site(site_id));

drop policy if exists waitlists_insert on public.waitlists;
create policy waitlists_insert on public.waitlists for insert to authenticated
  with check (public.can_edit_site(site_id));
drop policy if exists waitlists_update on public.waitlists;
create policy waitlists_update on public.waitlists for update to authenticated
  using (public.can_edit_site(site_id)) with check (public.can_edit_site(site_id));
drop policy if exists waitlists_delete on public.waitlists;
create policy waitlists_delete on public.waitlists for delete to authenticated
  using (public.can_admin_site_users(site_id));

drop policy if exists waitlist_tx_public_read on public.waitlist_translations;
create policy waitlist_tx_public_read on public.waitlist_translations for select to anon, authenticated
  using (exists (select 1 from public.waitlists w
    where w.id = waitlist_id and w.status in ('open','closed','launched') and public.site_visible(w.site_id)));

drop policy if exists waitlist_tx_staff_read on public.waitlist_translations;
create policy waitlist_tx_staff_read on public.waitlist_translations for select to authenticated
  using (exists (select 1 from public.waitlists w where w.id = waitlist_id and public.can_view_site(w.site_id)));

drop policy if exists waitlist_tx_edit on public.waitlist_translations;
create policy waitlist_tx_edit on public.waitlist_translations for all to authenticated
  using (exists (select 1 from public.waitlists w where w.id = waitlist_id and public.can_edit_site(w.site_id)))
  with check (exists (select 1 from public.waitlists w where w.id = waitlist_id and public.can_edit_site(w.site_id)));

drop policy if exists waitlist_signups_staff_read on public.waitlist_signups;
create policy waitlist_signups_staff_read on public.waitlist_signups for select to authenticated
  using (public.can_view_site(site_id));
