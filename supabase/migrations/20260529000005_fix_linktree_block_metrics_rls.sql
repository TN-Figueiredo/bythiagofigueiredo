-- =============================================================================
-- MIGRATION: Fix linktree_block_metrics RLS — too permissive (using(true))
-- =============================================================================

-- Fix: linktree_block_metrics RLS was too permissive (using(true))
-- Replace with proper site-scoped policies

drop policy if exists "Service role full access on linktree_block_metrics" on public.linktree_block_metrics;

-- Read: only staff who can view the site
create policy "linktree_block_metrics_staff_read"
  on public.linktree_block_metrics
  for select
  to authenticated
  using (public.can_view_site(site_id));

-- Write: only service role (via server actions) or staff who can edit
create policy "linktree_block_metrics_service_write"
  on public.linktree_block_metrics
  for insert
  to authenticated
  with check (public.can_edit_site(site_id));

create policy "linktree_block_metrics_service_update"
  on public.linktree_block_metrics
  for update
  to authenticated
  using (public.can_edit_site(site_id))
  with check (public.can_edit_site(site_id));
