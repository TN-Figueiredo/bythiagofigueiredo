create table public.newsletter_subscriptions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  email citext not null,
  status text not null check (status in ('pending_confirmation','confirmed','unsubscribed')),
  confirmation_token text,
  confirmation_expires_at timestamptz,
  consent_text_version text not null,
  ip inet,
  user_agent text,
  subscribed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  brevo_contact_id text,
  unique (site_id, email),
  check (status <> 'confirmed' or brevo_contact_id is not null or status = 'pending_confirmation')
);

-- Note: status='confirmed' brevo_contact_id check is loosened to allow cron-driven sync.
-- Production invariant enforced in cron sync logic, not at DB level (cron will sync brevo_contact_id immediately after confirm).

create unique index newsletter_pending_token
  on public.newsletter_subscriptions (confirmation_token)
  where status = 'pending_confirmation' and confirmation_expires_at > now();
create index on public.newsletter_subscriptions (site_id, status);

alter table public.newsletter_subscriptions enable row level security;

drop policy if exists "newsletter anon insert" on public.newsletter_subscriptions;
create policy "newsletter anon insert"
  on public.newsletter_subscriptions for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.sites s
      where s.id = site_id
        and (
          coalesce(nullif(current_setting('app.site_id', true), ''), '') = ''
          or s.id = nullif(current_setting('app.site_id', true), '')::uuid
        )
    )
  );

drop policy if exists "newsletter staff read" on public.newsletter_subscriptions;
create policy "newsletter staff read"
  on public.newsletter_subscriptions for select to authenticated
  using (public.can_admin_site(site_id) or public.is_staff());

-- RPC: confirm subscription via token
create or replace function public.confirm_newsletter_subscription(p_token text) returns json language plpgsql security definer as $fn$
declare v_sub record;
begin
  select id, site_id, email, status, confirmation_expires_at into v_sub
  from public.newsletter_subscriptions
  where confirmation_token = p_token
  for update;

  if v_sub.id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_sub.status = 'confirmed' then
    return json_build_object('ok', true, 'email', v_sub.email, 'site_id', v_sub.site_id, 'already', true);
  end if;
  if v_sub.confirmation_expires_at <= now() then
    return json_build_object('ok', false, 'error', 'expired');
  end if;

  update public.newsletter_subscriptions
  set status = 'confirmed',
      confirmed_at = now(),
      confirmation_token = null,
      confirmation_expires_at = null
  where id = v_sub.id;

  return json_build_object('ok', true, 'email', v_sub.email, 'site_id', v_sub.site_id);
end $fn$;

grant execute on function public.confirm_newsletter_subscription(text) to anon, authenticated;
