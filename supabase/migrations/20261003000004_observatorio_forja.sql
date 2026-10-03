-- =============================================================================
-- MIGRATION: observatorio_forja
-- Observatório de Competidores v2 — fila única da forja com tipo e alvo,
-- leituras congeladas (competitor_readings) e batimento da máquina (forja_heartbeat).
--
-- youtube_intelligence_tasks ganha task_type/target_*/refused_*/released_at/sent;
-- channel_id passa a ser nullable (só 'diagnostico' exige canal); status ganha 'refused'.
-- Linhas existentes do Health Coach viram task_type = 'diagnostico' (default) e nada
-- muda para elas: o índice único por canal continua valendo, agora só para esse tipo.
-- Idempotente: drop constraint/index/policy if exists antes de criar.
-- =============================================================================

alter table youtube_intelligence_tasks
  add column if not exists task_type text not null default 'diagnostico',
  add column if not exists target_niche text,
  add column if not exists target_video_id uuid references competitor_videos(id) on delete cascade,
  add column if not exists target_fmt text,
  add column if not exists refused_at timestamptz,
  add column if not exists refused_reason text,
  add column if not exists released_at timestamptz,
  add column if not exists sent jsonb;
alter table youtube_intelligence_tasks alter column channel_id drop not null;

alter table youtube_intelligence_tasks drop constraint if exists youtube_intelligence_tasks_task_type_check;
alter table youtube_intelligence_tasks add constraint youtube_intelligence_tasks_task_type_check
  check (task_type in ('diagnostico', 'padroes-titulo', 'padroes-titulo-shorts', 'temas', 'resumo-trocas', 'leitura-video'));
alter table youtube_intelligence_tasks drop constraint if exists youtube_intelligence_tasks_target_check;
alter table youtube_intelligence_tasks add constraint youtube_intelligence_tasks_target_check
  check ((task_type = 'diagnostico' and channel_id is not null and target_niche is null and target_video_id is null)
      or (task_type <> 'diagnostico' and target_niche is not null and target_niche in ('viagem', 'ia')
          and ((task_type = 'leitura-video') = (target_video_id is not null))));
alter table youtube_intelligence_tasks drop constraint if exists youtube_intelligence_tasks_status_check;
alter table youtube_intelligence_tasks add constraint youtube_intelligence_tasks_status_check
  check (status in ('pending', 'running', 'completed', 'failed', 'stale', 'refused'));

drop index if exists idx_yt_intel_task_active;
create unique index if not exists idx_yt_intel_task_active
  on youtube_intelligence_tasks (site_id, channel_id)
  where status in ('pending', 'running') and task_type = 'diagnostico';
create unique index if not exists idx_yt_intel_obs_active
  on youtube_intelligence_tasks (site_id, task_type, target_niche)
  where status in ('pending', 'running') and task_type <> 'diagnostico';
create index if not exists idx_yt_intel_obs_quota
  on youtube_intelligence_tasks (site_id, task_type, target_niche, completed_at desc)
  where status = 'completed' and task_type <> 'diagnostico';

create table if not exists competitor_readings (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  task_id uuid unique references youtube_intelligence_tasks(id) on delete set null,
  task_type text not null,
  niche text check (niche in ('viagem', 'ia')),
  video_id uuid references competitor_videos(id) on delete cascade,
  fmt text check (fmt in ('long', 'short')),
  model text not null,
  generated_at timestamptz not null,
  sent jsonb not null,
  analysis jsonb not null default '{}'::jsonb,
  text jsonb not null,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_competitor_readings_latest on competitor_readings (site_id, task_type, niche, generated_at desc);
alter table competitor_readings enable row level security;
drop policy if exists "competitor_readings_select" on competitor_readings;
create policy "competitor_readings_select" on competitor_readings for select using (public.can_view_site(competitor_readings.site_id));

create table if not exists forja_heartbeat (
  site_id uuid primary key references sites(id) on delete cascade,
  last_poll_at timestamptz not null,
  capabilities text[] not null default '{}',
  key_id uuid,
  updated_at timestamptz not null default now()
);
alter table forja_heartbeat enable row level security;
drop policy if exists "forja_heartbeat_select" on forja_heartbeat;
create policy "forja_heartbeat_select" on forja_heartbeat for select using (public.can_view_site(forja_heartbeat.site_id));

drop trigger if exists set_forja_heartbeat_updated_at on forja_heartbeat;
create trigger set_forja_heartbeat_updated_at
  before update on forja_heartbeat
  for each row execute function public.tg_set_updated_at();
