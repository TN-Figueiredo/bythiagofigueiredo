-- =============================================================================
-- MIGRATION: Coleta dos canais próprios — lote L1b
-- Spec: docs/superpowers/specs/2026-10-07-coleta-canais-proprios-design.md (seções 0, 2 e 6)
-- Aditiva. Roda duas vezes sem erro. Depende de 20261007000006 (L1a) e 20261003000007.
--
-- O que faz:
--   1. youtube_channels ganha collection_status e authorization_verified_at;
--   2. linhas órfãs (canal removido durante o L1a): tentativas perdem o vínculo; série órfã ABORTA a migration;
--   3. channel_id das quatro tabelas da coleta vira chave estrangeira ON DELETE RESTRICT;
--   4. yt_own_collection_runs: uma linha por execução do cron (tempos, falhas, resumo);
--   5. as duas funções de remover canal são recriadas: canal com série coletada não é removido pela tela.
-- =============================================================================

-- ── 1. Estado de autorização do canal ───────────────────────────────────────
alter table public.youtube_channels add column if not exists authorization_verified_at timestamptz;
alter table public.youtube_channels add column if not exists collection_status text not null default 'ok';
alter table public.youtube_channels drop constraint if exists youtube_channels_collection_status_check;
alter table public.youtube_channels add constraint youtube_channels_collection_status_check
  check (collection_status in ('ok', 'reautorizar'));

-- ── 2. Órfãos ───────────────────────────────────────────────────────────────
-- Tentativa é registro de execução, não série: perde o vínculo e fica.
update public.yt_own_collection_attempts a
   set channel_id = null
 where a.channel_id is not null
   and not exists (select 1 from public.youtube_channels c where c.id = a.channel_id);

-- Série órfã (o que estava no ar, relatórios, jobs) não volta se for apagada: quem decide é o dono.
do $$
declare
  v_jobs bigint;
  v_rel bigint;
  v_meta bigint;
begin
  select count(*) into v_jobs from public.yt_reporting_jobs j
   where not exists (select 1 from public.youtube_channels c where c.id = j.channel_id);
  select count(*) into v_rel from public.yt_reporting_reports r
   where not exists (select 1 from public.youtube_channels c where c.id = r.channel_id);
  select count(*) into v_meta from public.yt_own_video_meta_daily m
   where not exists (select 1 from public.youtube_channels c where c.id = m.channel_id);
  if v_jobs + v_rel + v_meta > 0 then
    raise exception 'coleta L1b: há série de canal que não existe mais (jobs %, relatórios %, metadados %). Nada foi apagado. Exporte e apague a série órfã pelo runbook (docs/ops/youtube-coleta-canais-proprios-runbook.md, "Apagar a série de um canal") e rode a migration de novo.',
      v_jobs, v_rel, v_meta;
  end if;
end $$;

-- ── 3. Chaves estrangeiras ──────────────────────────────────────────────────
alter table public.yt_reporting_jobs drop constraint if exists yt_reporting_jobs_channel_id_fkey;
alter table public.yt_reporting_jobs add constraint yt_reporting_jobs_channel_id_fkey
  foreign key (channel_id) references public.youtube_channels(id) on delete restrict;

alter table public.yt_reporting_reports drop constraint if exists yt_reporting_reports_channel_id_fkey;
alter table public.yt_reporting_reports add constraint yt_reporting_reports_channel_id_fkey
  foreign key (channel_id) references public.youtube_channels(id) on delete restrict;

alter table public.yt_own_video_meta_daily drop constraint if exists yt_own_video_meta_daily_channel_id_fkey;
alter table public.yt_own_video_meta_daily add constraint yt_own_video_meta_daily_channel_id_fkey
  foreign key (channel_id) references public.youtube_channels(id) on delete restrict;

alter table public.yt_own_collection_attempts drop constraint if exists yt_own_collection_attempts_channel_id_fkey;
alter table public.yt_own_collection_attempts add constraint yt_own_collection_attempts_channel_id_fkey
  foreign key (channel_id) references public.youtube_channels(id) on delete restrict;

-- ── 4. Uma linha por execução do cron ───────────────────────────────────────
-- O resumo do cron (tempos por passo, acao_do_dono, perdidos, vazios) só existia na resposta HTTP,
-- que ninguém guarda. Sem site_id: a execução é do cron inteiro. Só service role lê e grava.
create table if not exists public.yt_own_collection_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  ms_total integer not null,
  ms_existente integer not null,
  ms_passos jsonb not null default '{}'::jsonb,
  falhas text[] not null default '{}',
  acao_do_dono text[] not null default '{}',
  resumo jsonb not null default '{}'::jsonb
);
create index if not exists idx_yt_own_collection_runs_ran_at on public.yt_own_collection_runs (ran_at desc);
alter table public.yt_own_collection_runs enable row level security;
revoke all on table public.yt_own_collection_runs from anon, authenticated;

-- ── 5. Remover canal: série coletada bloqueia ───────────────────────────────
-- As duas funções são recriadas por inteiro. Única mudança em relação a 20261003000007:
-- a chave serie_coletada no impacto e o status 'serie_coletada' na remoção (depois de not_found e
-- slug_mismatch, antes de blocked). Apagar a série continua sendo passo manual do dono.
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
                    + (select count(*) from public.yt_own_collection_attempts a where a.channel_id = p_channel_id),
    'blockers', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'status', t.status, 'started_at', t.started_at,
                                          'paused_at', t.paused_at, 'video_title', v.title)
                       order by t.started_at nulls last, t.id)
      from public.ab_tests t join public.youtube_videos v on v.id = t.youtube_video_id
      where v.channel_id = p_channel_id and t.status in ('active', 'paused', 'queued')), '[]'::jsonb)
  );
end $$;

create or replace function public.youtube_channel_remove(p_site_id uuid, p_channel_id uuid, p_confirm_slug text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_slug text;
  v_yt text;
  v_videos uuid[];
  v_tests uuid[];
  v_impact jsonb;
begin
  select c.slug, c.channel_id into v_slug, v_yt from public.youtube_channels c
  where c.id = p_channel_id and c.site_id = p_site_id for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if p_confirm_slug is distinct from v_slug then
    return jsonb_build_object('status', 'slug_mismatch');
  end if;

  select coalesce(array_agg(s.id), '{}') into v_videos
  from (select v.id from public.youtube_videos v where v.channel_id = p_channel_id for update) s;
  select coalesce(array_agg(s.id), '{}') into v_tests
  from (select t.id from public.ab_tests t where t.youtube_video_id = any(v_videos) for update) s;

  v_impact := public.youtube_channel_removal_impact(p_site_id, p_channel_id);
  -- Série coletada: a chave estrangeira recusaria o delete do canal de qualquer jeito. Recusa aqui, antes de
  -- apagar qualquer coisa, com um estado que a tela sabe explicar.
  if (v_impact ->> 'serie_coletada')::bigint > 0 then
    return v_impact || jsonb_build_object('status', 'serie_coletada');
  end if;
  if jsonb_array_length(v_impact -> 'blockers') > 0 then
    return v_impact || jsonb_build_object('status', 'blocked');
  end if;

  update public.social_connections sc
  set revoked_at = now(), access_token_enc = '', refresh_token_enc = null, page_token_enc = null, token_expires_at = null
  where sc.site_id = p_site_id and sc.provider = 'youtube' and sc.account_id = v_yt and sc.revoked_at is null;

  delete from public.yt_notifications nt
  where nt.youtube_video_id = any(v_videos) or nt.ab_test_id = any(v_tests)
     or nt.optimization_cycle_id in (select oc.id from public.optimization_cycles oc where oc.youtube_video_id = any(v_videos));

  update public.optimization_cycles oc set ab_test_id = null
  where oc.ab_test_id = any(v_tests) and not (oc.youtube_video_id = any(v_videos));
  delete from public.optimization_cycles oc where oc.youtube_video_id = any(v_videos);
  delete from public.ab_tests t where t.id = any(v_tests);
  delete from public.youtube_videos v where v.channel_id = p_channel_id;
  delete from public.youtube_sync_log l where l.channel_id = p_channel_id;
  delete from public.youtube_channels c where c.id = p_channel_id and c.site_id = p_site_id;

  return v_impact || jsonb_build_object('status', 'removed');
end $$;

revoke all on function public.youtube_channel_removal_impact(uuid, uuid) from public, anon, authenticated;
revoke all on function public.youtube_channel_remove(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.youtube_channel_removal_impact(uuid, uuid) to service_role;
grant execute on function public.youtube_channel_remove(uuid, uuid, text) to service_role;

comment on function public.youtube_channel_removal_impact(uuid, uuid) is 'Conta o que a remoção de um canal próprio apagaria, a série coletada que a impede e os testes A/B (active/paused/queued) que a bloqueiam. Só leitura; só service role.';
comment on function public.youtube_channel_remove(uuid, uuid, text) is 'Remove um canal próprio e tudo o que depende dele em uma transação. Série coletada ou teste A/B active/paused/queued recusam antes de apagar. Só service role.';
