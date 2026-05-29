-- Links Redesign Phase 1: link_summary_v2 view + linktree_block_metrics table
-- Spec: docs/superpowers/specs/2026-05-29-links-linktree-redesign-design.md Section 4.3

-- 1. View link_summary_v2 — aggregated data for the Links hub
create or replace view public.link_summary_v2 as
select
  tl.id,
  tl.site_id,
  tl.code,
  tl.slug,
  tl.title,
  tl.destination_url,
  tl.source_type,
  tl.status,
  tl.active,
  tl.total_clicks,
  tl.unique_visitors,
  tl.health_status,
  tl.health_checked_at,
  tl.redirect_type,
  tl.pass_click_ids,
  tl.qr_code_url,
  tl.created_at,
  tl.expires_at,
  -- Last 30 days clicks
  coalesce(m30.clicks, 0) as last30_clicks,
  coalesce(m30.unique_visitors, 0) as last30_unique,
  -- QR scans (approximate via referrer_category)
  coalesce(qr.scans, 0) as qr_scans,
  -- Spark: last 14 days as jsonb array
  coalesce(spark.days, '[]'::jsonb) as spark_14d
from tracked_links tl
left join lateral (
  select
    sum(ldm.clicks) as clicks,
    sum(ldm.unique_visitors) as unique_visitors
  from link_daily_metrics ldm
  where ldm.link_id = tl.id
    and ldm.date >= (current_date - interval '30 days')
) m30 on true
left join lateral (
  select count(*) as scans
  from link_clicks lc
  where lc.link_id = tl.id
    and lc.referrer_category = 'qr'
) qr on true
left join lateral (
  select jsonb_agg(daily_clicks order by d) as days
  from (
    select d, coalesce(ldm2.clicks, 0) as daily_clicks
    from generate_series(
      current_date - interval '13 days',
      current_date,
      interval '1 day'
    ) as d
    left join link_daily_metrics ldm2
      on ldm2.link_id = tl.id and ldm2.date = d::date
  ) sub
) spark on true
where tl.deleted_at is null;

-- 2. Table linktree_block_metrics — daily metrics per linktree block
create table if not exists public.linktree_block_metrics (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  block_id text not null,
  date date not null,
  clicks integer not null default 0,
  unique_visitors integer not null default 0,
  created_at timestamptz not null default now(),
  constraint uq_linktree_block_metrics unique (site_id, block_id, date)
);

-- Index for efficient queries by site + date range
create index if not exists idx_linktree_block_metrics_site_date
  on public.linktree_block_metrics (site_id, date);

-- RLS
alter table public.linktree_block_metrics enable row level security;

drop policy if exists "Service role full access on linktree_block_metrics" on public.linktree_block_metrics;
create policy "Service role full access on linktree_block_metrics"
  on public.linktree_block_metrics
  for all
  using (true)
  with check (true);

comment on view public.link_summary_v2 is 'Aggregated link data for the Links CMS hub (last30, QR scans, spark 14d)';
comment on table public.linktree_block_metrics is 'Daily click metrics per linktree block for performance tracking';
