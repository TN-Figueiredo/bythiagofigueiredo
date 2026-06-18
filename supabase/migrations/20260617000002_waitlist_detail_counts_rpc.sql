-- =============================================================================
-- MIGRATION: waitlist_detail_counts — single-trip source/status tallies (WL-06).
-- Replaces the 5 separate head-count queries in loadWaitlistDetail with one
-- FILTER-aggregate over a single (waitlist_id, site_id, anonymized_at IS NULL) scan.
-- =============================================================================
create or replace function public.waitlist_detail_counts(p_site_id uuid, p_waitlist_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'landing',    count(*) filter (where source_surface = 'landing'),
    'embed',      count(*) filter (where source_surface = 'embed'),
    'tiptap',     count(*) filter (where source_surface = 'tiptap'),
    'pending',    count(*) filter (where status = 'pending'),
    'suppressed', count(*) filter (where status = 'suppressed')
  )
  from public.waitlist_signups
  where site_id = p_site_id
    and waitlist_id = p_waitlist_id
    and anonymized_at is null;
$$;

revoke all on function public.waitlist_detail_counts(uuid, uuid) from public, anon, authenticated;
grant execute on function public.waitlist_detail_counts(uuid, uuid) to service_role;
