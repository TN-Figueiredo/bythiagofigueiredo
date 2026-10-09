-- =============================================================================
-- MIGRATION: Coleta dos canais próprios — lote L2
-- Spec: docs/superpowers/specs/2026-10-07-coleta-canais-proprios-design.md (seções 2, 5 e 6)
-- Aditiva. Roda duas vezes sem erro. Depende de 20261008000002 (L1b).
--
-- O que faz:
--   1. yt_own_video_daily: o diário real por vídeo (Analytics API). Toda métrica é nula quando não veio.
--   2. yt_own_video_reach_daily: impressões e CTR de miniatura por vídeo e dia (Reporting API).
--   3. yt_own_reach_apply: grava o alcance sem deixar um relatório mais velho passar por cima do mais novo.
--   4. youtube_channel_removal_impact: as duas tabelas novas contam como série coletada.
-- youtube_video_id = id de 11 caracteres do YouTube (NÃO o uuid de youtube_videos.id).
-- day_pt = o dia como veio da fonte; as duas fontes não documentam o mesmo dia (spec, seção 1).
-- =============================================================================

-- ── 1. Diário por vídeo ─────────────────────────────────────────────────────
create table if not exists public.yt_own_video_daily (
  youtube_video_id text not null,
  day_pt date not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  views bigint,
  engaged_views bigint,
  watch_time_minutes numeric,
  avg_view_duration_seconds numeric,
  avg_view_percentage numeric,
  likes bigint,
  comments bigint,
  shares bigint,
  subscribers_gained bigint,
  subscribers_lost bigint,
  card_impressions bigint,
  card_click_rate numeric,
  source text not null default 'analytics_api' check (source in ('analytics_api', 'reporting_api')),
  collected_at timestamptz not null default now(),
  metric_version text not null
    check (metric_version in ('views_ate_2025-03-30', 'views_2025-03-31_a_2026-08-26', 'views_desde_2026-08-27')),
  primary key (youtube_video_id, day_pt)
);
create index if not exists idx_yt_own_video_daily_channel_day
  on public.yt_own_video_daily (channel_id, day_pt);

-- ── 2. Alcance por vídeo e dia ──────────────────────────────────────────────
-- thumbnail_ctr fica na unidade em que veio do relatório (0–1, conferido no CSV real em 09/10/2026).
create table if not exists public.yt_own_video_reach_daily (
  youtube_video_id text not null,
  day_pt date not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  thumbnail_impressions bigint,
  thumbnail_ctr numeric,
  source_report_id text not null,
  report_create_time timestamptz not null,
  source text not null default 'reporting_api' check (source in ('analytics_api', 'reporting_api')),
  collected_at timestamptz not null default now(),
  metric_version text not null
    check (metric_version in ('views_ate_2025-03-30', 'views_2025-03-31_a_2026-08-26', 'views_desde_2026-08-27')),
  primary key (youtube_video_id, day_pt)
);
create index if not exists idx_yt_own_video_reach_daily_channel_day
  on public.yt_own_video_reach_daily (channel_id, day_pt);

-- ── 3. RLS: leitura por quem edita o site; escrita só por service role ──────
alter table public.yt_own_video_daily enable row level security;
drop policy if exists "yt_own_video_daily_select" on public.yt_own_video_daily;
create policy "yt_own_video_daily_select" on public.yt_own_video_daily
  for select using (public.can_edit_site(site_id));

alter table public.yt_own_video_reach_daily enable row level security;
drop policy if exists "yt_own_video_reach_daily_select" on public.yt_own_video_reach_daily;
create policy "yt_own_video_reach_daily_select" on public.yt_own_video_reach_daily
  for select using (public.can_edit_site(site_id));

-- ── 4. Gravar o alcance (o PostgREST não faz upsert condicional) ────────────
-- Uma linha só é sobrescrita por um relatório de create_time MAIOR, ou pelo MESMO relatório
-- (re-normalização). Devolve quantas linhas foram inseridas ou sobrescritas.
create or replace function public.yt_own_reach_apply(p_rows jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare v_n integer;
begin
  insert into public.yt_own_video_reach_daily as t
    (youtube_video_id, day_pt, site_id, video_id, channel_id, thumbnail_impressions, thumbnail_ctr,
     source_report_id, report_create_time, source, collected_at, metric_version)
  select r.youtube_video_id, r.day_pt, r.site_id, r.video_id, r.channel_id, r.thumbnail_impressions, r.thumbnail_ctr,
         r.source_report_id, r.report_create_time, 'reporting_api', now(), r.metric_version
  from jsonb_to_recordset(p_rows) as r(
    youtube_video_id text, day_pt date, site_id uuid, video_id uuid, channel_id uuid,
    thumbnail_impressions bigint, thumbnail_ctr numeric,
    source_report_id text, report_create_time timestamptz, metric_version text)
  on conflict (youtube_video_id, day_pt) do update
    set thumbnail_impressions = excluded.thumbnail_impressions,
        thumbnail_ctr = excluded.thumbnail_ctr,
        source_report_id = excluded.source_report_id,
        report_create_time = excluded.report_create_time,
        video_id = coalesce(excluded.video_id, t.video_id),
        collected_at = now(),
        metric_version = excluded.metric_version
    where excluded.report_create_time > t.report_create_time
       or excluded.source_report_id = t.source_report_id;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.yt_own_reach_apply(jsonb) from public, anon, authenticated;
grant execute on function public.yt_own_reach_apply(jsonb) to service_role;

-- ── 5. Remover canal: as duas tabelas novas contam como série ───────────────
-- Recriada por inteiro. Única mudança em relação a 20261008000002: duas parcelas a mais em serie_coletada.
-- public.youtube_channel_remove não muda (ela lê serie_coletada daqui).
create or replace function public.youtube_channel_removal_impact(p_site_id uuid, p_channel_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_name text;
  v_slug text;
  v_yt text;
begin
  select c.name, c.slug, c.channel_id into v_name, v_slug, v_yt
  from public.youtube_channels c where c.id = p_channel_id and c.site_id = p_site_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'name', v_name,
    'slug', v_slug,
    'videos', (select count(*) from public.youtube_videos v where v.channel_id = p_channel_id),
    'comments', (select count(*) from public.youtube_curated_comments cc
                 join public.youtube_videos v on v.id = cc.video_id where v.channel_id = p_channel_id),
    'sync_logs', (select count(*) from public.youtube_sync_log l where l.channel_id = p_channel_id),
    'ab_tests', (select count(*) from public.ab_tests t
                 join public.youtube_videos v on v.id = t.youtube_video_id
                 where v.channel_id = p_channel_id and t.status not in ('active', 'paused', 'queued', 'draft')),
    'ab_drafts', (select count(*) from public.ab_tests t
                  join public.youtube_videos v on v.id = t.youtube_video_id
                  where v.channel_id = p_channel_id and t.status = 'draft'),
    'analyses', (select count(*) from public.youtube_intelligence i
                 where i.channel_id = p_channel_id
                    or i.video_id in (select v.id from public.youtube_videos v where v.channel_id = p_channel_id)),
    'tasks', (select count(*) from public.youtube_intelligence_tasks k where k.channel_id = p_channel_id),
    'notes', (select count(*) from public.youtube_notes n where n.channel_id = p_channel_id),
    'notifications', (select count(*) from public.yt_notifications nt
                      where nt.youtube_video_id in (select v.id from public.youtube_videos v where v.channel_id = p_channel_id)
                         or nt.ab_test_id in (select t.id from public.ab_tests t join public.youtube_videos v on v.id = t.youtube_video_id
                                              where v.channel_id = p_channel_id)
                         or nt.optimization_cycle_id in (select oc.id from public.optimization_cycles oc
                                                         join public.youtube_videos v on v.id = oc.youtube_video_id
                                                         where v.channel_id = p_channel_id)),
    'connections', (select count(*) from public.social_connections sc
                    where sc.site_id = p_site_id and sc.provider = 'youtube' and sc.account_id = v_yt and sc.revoked_at is null),
    'pipeline_links', (select count(*) from public.content_pipeline p
                       where p.youtube_channel_id = p_channel_id
                          or p.youtube_video_id in (select v.id from public.youtube_videos v where v.channel_id = p_channel_id)),
    -- linhas da coleta que apontam para o canal (o bruto vai junto com o relatório, por cascata)
    'serie_coletada', (select count(*) from public.yt_own_video_meta_daily m where m.channel_id = p_channel_id)
                    + (select count(*) from public.yt_reporting_reports r where r.channel_id = p_channel_id)
                    + (select count(*) from public.yt_reporting_jobs j where j.channel_id = p_channel_id)
                    + (select count(*) from public.yt_own_collection_attempts a where a.channel_id = p_channel_id)
                    + (select count(*) from public.yt_own_video_daily d where d.channel_id = p_channel_id)
                    + (select count(*) from public.yt_own_video_reach_daily h where h.channel_id = p_channel_id),
    'blockers', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'status', t.status, 'started_at', t.started_at,
                                          'paused_at', t.paused_at, 'video_title', v.title)
                       order by t.started_at nulls last, t.id)
      from public.ab_tests t join public.youtube_videos v on v.id = t.youtube_video_id
      where v.channel_id = p_channel_id and t.status in ('active', 'paused', 'queued')), '[]'::jsonb)
  );
end $$;

revoke all on function public.youtube_channel_removal_impact(uuid, uuid) from public, anon, authenticated;
grant execute on function public.youtube_channel_removal_impact(uuid, uuid) to service_role;
