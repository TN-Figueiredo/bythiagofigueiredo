create table cron_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  ran_at timestamptz not null default now(),
  status text not null check (status in ('ok','error')),
  duration_ms int,
  items_processed int,
  error text
);
create index on cron_runs (job, ran_at desc);

-- RLS enabled here (rather than in 000014) so ordering-by-filename works.
-- No policies → only service_role bypasses RLS to write/read.
alter table cron_runs enable row level security;
