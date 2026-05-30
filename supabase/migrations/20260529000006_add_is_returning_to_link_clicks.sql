-- Add is_returning boolean to link_clicks for New vs Returning visitor analytics
-- Phase 5.5: tracks whether a click comes from a returning visitor

alter table public.link_clicks
  add column if not exists is_returning boolean not null default false;

-- Index for efficient filtering
create index if not exists idx_link_clicks_is_returning
  on public.link_clicks (link_id, is_returning)
  where is_returning = true;

comment on column public.link_clicks.is_returning is 'True if the visitor has clicked any link on this site before (based on visitor_id)';
