-- =============================================================================
-- MIGRATION: Coleta dos canais próprios — lote L1a
-- Spec: docs/superpowers/specs/2026-10-07-coleta-canais-proprios-design.md (seção 2)
-- Só cria. Roda duas vezes sem erro. O código antigo não percebe estas tabelas.
--
-- channel_id é uuid SEM chave estrangeira neste lote: uma FK sem ON DELETE é NO ACTION e
-- faria public.youtube_channel_remove (20261003000007) falhar. A FK com ON DELETE RESTRICT
-- entra em L1b, junto com a RPC que sabe lidar com ela.
-- =============================================================================

-- ── 1. Jobs da Reporting API ────────────────────────────────────────────────
create table if not exists public.yt_reporting_jobs (
  site_id uuid not null references public.sites(id) on delete cascade,
  channel_id uuid not null,
  report_type_id text not null,
  job_id text,
  job_create_time timestamptz,
  status text not null
    check (status in ('ativo', 'desativado', 'sem_acesso', 'api_nao_ativada', 'tipo_indisponivel', 'erro')),
  error text,
  created_at timestamptz not null default now(),
  last_listed_at timestamptz,
  last_create_time timestamptz,
  primary key (channel_id, report_type_id)
);

-- ── 2. Relatórios listados ──────────────────────────────────────────────────
-- Sem FK para yt_reporting_jobs: o job_id muda quando o job é recriado.
create table if not exists public.yt_reporting_reports (
  report_id text primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  job_id text not null,
  channel_id uuid not null,
  report_type_id text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  create_time timestamptz not null,
  job_expire_time timestamptz,
  download_url text not null,
  is_backfill boolean not null default false,
  status text not null default 'listado'
    check (status in ('listado', 'baixado', 'vazio', 'erro', 'expirado_sem_baixar')),
  error text,
  row_count bigint,
  bytes bigint,
  sha256 text,
  unmatched_video_ids jsonb,
  downloaded_at timestamptz,
  normalized_at timestamptz
);
create index if not exists idx_yt_reporting_reports_status
  on public.yt_reporting_reports (status, report_type_id, create_time);
create index if not exists idx_yt_reporting_reports_job
  on public.yt_reporting_reports (job_id, create_time);

-- ── 3. Bruto (CSV comprimido). Fora de qualquer select * ─────────────────────
create table if not exists public.yt_reporting_report_blobs (
  report_id text primary key references public.yt_reporting_reports(report_id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  csv_gz bytea not null
);

-- ── 4. O que estava no ar em cada dia, por vídeo ────────────────────────────
-- youtube_video_id = id de 11 caracteres do YouTube (NÃO o uuid de youtube_videos.id).
-- ab_test_id / ab_variant_id sem FK: testes são apagados e a linha do dia tem de sobreviver.
create table if not exists public.yt_own_video_meta_daily (
  youtube_video_id text not null,
  day_pt date not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null,
  title text,
  thumbnail_sha256 text,
  thumbnail_dhash text,
  thumbnail_blob_url text,
  title_at_capture text,
  thumbnail_sha256_at_capture text,
  description_sha256 text,
  description_text text,
  tags_sha256 text,
  tags text[],
  duration_seconds integer,
  is_short boolean,
  privacy_status text
    check (privacy_status is null or privacy_status in ('public', 'unlisted', 'private')),
  ab_test_id uuid,
  ab_variant_id uuid,
  seconds_on_air_analytics integer,
  seconds_other_analytics integer,
  seconds_on_air_reporting integer,
  seconds_other_reporting integer,
  captured_at timestamptz not null,
  primary key (youtube_video_id, day_pt)
);
create index if not exists idx_yt_own_video_meta_daily_channel_day
  on public.yt_own_video_meta_daily (channel_id, day_pt);

-- ── 5. Tentativas de coleta ─────────────────────────────────────────────────
-- attempt_day = data UTC da execução. Nunca se junta a day_pt.
create table if not exists public.yt_own_collection_attempts (
  scope_type text not null check (scope_type in ('video', 'canal', 'job')),
  scope_id text not null,
  kind text not null
    check (kind in ('sondagem', 'meta', 'thumbnail', 'relatorio', 'diario', 'retencao_vida')),
  attempt_day date not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  channel_id uuid,
  outcome text not null
    check (outcome in ('ok', 'sem_dado_na_janela', 'video_novo', 'sem_conexao', 'sem_autorizacao',
                       'erro_http', 'nao_alcancado_orcamento', 'schema_ausente')),
  http_status integer,
  error text,
  attempts integer not null default 1,
  last_attempt_at timestamptz not null default now(),
  primary key (scope_type, scope_id, kind, attempt_day)
);
create index if not exists idx_yt_own_collection_attempts_kind
  on public.yt_own_collection_attempts (kind, outcome, attempt_day);
create index if not exists idx_yt_own_collection_attempts_channel
  on public.yt_own_collection_attempts (channel_id, attempt_day);

-- ── 6. RLS: leitura por quem edita o site; escrita só por service role ──────
alter table public.yt_reporting_jobs enable row level security;
drop policy if exists "yt_reporting_jobs_select" on public.yt_reporting_jobs;
create policy "yt_reporting_jobs_select" on public.yt_reporting_jobs
  for select using (public.can_edit_site(site_id));

alter table public.yt_reporting_reports enable row level security;
drop policy if exists "yt_reporting_reports_select" on public.yt_reporting_reports;
create policy "yt_reporting_reports_select" on public.yt_reporting_reports
  for select using (public.can_edit_site(site_id));

alter table public.yt_own_video_meta_daily enable row level security;
drop policy if exists "yt_own_video_meta_daily_select" on public.yt_own_video_meta_daily;
create policy "yt_own_video_meta_daily_select" on public.yt_own_video_meta_daily
  for select using (public.can_edit_site(site_id));

alter table public.yt_own_collection_attempts enable row level security;
drop policy if exists "yt_own_collection_attempts_select" on public.yt_own_collection_attempts;
create policy "yt_own_collection_attempts_select" on public.yt_own_collection_attempts
  for select using (public.can_edit_site(site_id));

-- O bruto não tem policy de leitura: só service role.
alter table public.yt_reporting_report_blobs enable row level security;
revoke all on table public.yt_reporting_report_blobs from anon, authenticated;

-- ── 7. Registro de tentativa (o PostgREST não soma num upsert) ──────────────
create or replace function public.yt_own_attempt_record(
  p_site_id uuid,
  p_scope_type text,
  p_scope_id text,
  p_kind text,
  p_outcome text,
  p_http_status integer default null,
  p_error text default null,
  p_channel_id uuid default null
) returns integer
language sql
set search_path = ''
as $$
  insert into public.yt_own_collection_attempts as t
    (scope_type, scope_id, kind, attempt_day, site_id, channel_id, outcome, http_status, error, attempts, last_attempt_at)
  values
    (p_scope_type, p_scope_id, p_kind, (now() at time zone 'utc')::date, p_site_id, p_channel_id,
     p_outcome, p_http_status, left(p_error, 500), 1, now())
  on conflict (scope_type, scope_id, kind, attempt_day) do update
    set outcome = excluded.outcome,
        http_status = excluded.http_status,
        error = excluded.error,
        channel_id = excluded.channel_id,
        site_id = excluded.site_id,
        attempts = t.attempts + 1,
        last_attempt_at = now()
  returning t.attempts;
$$;

revoke all on function public.yt_own_attempt_record(uuid, text, text, text, text, integer, text, uuid)
  from public, anon, authenticated;
grant execute on function public.yt_own_attempt_record(uuid, text, text, text, text, integer, text, uuid)
  to service_role;

-- ── 8. Limpeza do bruto ─────────────────────────────────────────────────────
-- Apaga: (a) bruto de relatório normalizado há mais de 90 dias; (b) bruto de tipo sem
-- normalizador (lista vinda do código) baixado há mais de 180 dias. O alcance básico
-- nunca é apagado antes de normalizado, mesmo que a lista venha errada.
create or replace function public.yt_reporting_blobs_purge(p_sem_normalizador text[])
returns integer
language plpgsql
set search_path = ''
as $$
declare v_n integer;
begin
  delete from public.yt_reporting_report_blobs b
   using public.yt_reporting_reports r
   where b.report_id = r.report_id
     and (
       r.normalized_at < now() - interval '90 days'
       or (
         r.report_type_id = any(p_sem_normalizador)
         and r.report_type_id <> 'channel_reach_basic_a1'
         and r.downloaded_at < now() - interval '180 days'
       )
     );
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.yt_reporting_blobs_purge(text[]) from public, anon, authenticated;
grant execute on function public.yt_reporting_blobs_purge(text[]) to service_role;
