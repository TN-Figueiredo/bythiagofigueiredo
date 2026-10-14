-- =============================================================================
-- MIGRATION: Observatório A5, E6 (dieta do diário do canal próprio), parte ADITIVA (MG14 do spec)
-- Spec: docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md, seção 7.1
-- Aditiva. Roda duas vezes sem erro. NÃO apaga nenhuma linha de dado. Depende de 20261009000001 (L2).
--
-- O que faz:
--   1. yt_own_video_coverage: "o dia D foi coletado para o vídeo V", por intervalo e por conjunto de métricas.
--   2. Carga da cobertura a partir das linhas que já existem (só para vídeo e conjunto ainda SEM cobertura).
--   3. yt_own_daily_apply: a gravação atômica do diário (linhas com atividade, dia revisado para zero, cobertura).
--   4. yt_own_collection_attempts.kind: a lista sai do banco (o catálogo passa a ser do código).
--   5. youtube_channel_removal_impact: serie_coletada passa a somar TODA tabela com FK "restrict" para o canal.
-- Convive com o código que está em main: ele não lê a tabela nova, não chama a função nova e só grava
-- os seis valores antigos de kind, todos aceitos pela expressão nova.
-- =============================================================================
set lock_timeout = '5s';

-- ── 1. Cobertura ────────────────────────────────────────────────────────────
create table if not exists public.yt_own_video_coverage (
  youtube_video_id text not null,
  metric_set text not null check (metric_set in (
    'base', 'estendidas',                                              -- diário (E6)
    'trafego', 'dispositivo', 'pais', 'inscrito', 'detalhe', 'alcance_dim',  -- E11
    'meta_texto', 'meta_thumb')),                                      -- dieta de yt_own_video_meta_daily (E18, parte 2)
  covered_from date not null,          -- dia do YouTube, inclusive
  covered_to date not null,            -- idem; o último dia que a fonte DEVOLVEU, não "hoje"
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  source text not null default 'analytics_api' check (source in ('analytics_api', 'reporting_api')),
  collected_at timestamptz not null default now(),
  primary key (youtube_video_id, metric_set, covered_from),
  check (covered_to >= covered_from)
);
create index if not exists idx_yt_own_video_coverage_channel
  on public.yt_own_video_coverage (channel_id, metric_set, covered_to);

alter table public.yt_own_video_coverage enable row level security;
-- Leitura pelo direito "ver desempenho privado" se a MG11 já existir; senão, por quem edita (a MG11 troca depois).
do $$
declare v_fn text := case when to_regprocedure('public.can_view_private_site(uuid)') is not null
                          then 'public.can_view_private_site(site_id)' else 'public.can_edit_site(site_id)' end;
begin
  execute 'drop policy if exists "yt_own_video_coverage_select" on public.yt_own_video_coverage';
  execute format('create policy "yt_own_video_coverage_select" on public.yt_own_video_coverage for select using (%s)', v_fn);
end $$;
-- Nenhuma policy de escrita: insert, update e delete só por service role.

-- ── 2. Carga da cobertura (ilhas de dias seguidos, por vídeo e conjunto) ─────
-- Só entra vídeo e conjunto que ainda não têm NENHUM intervalo: rodar de novo depois de a coleta nova
-- começar (ou depois de as linhas vazias saírem) não cria intervalo picado por cima do que já existe.
with linhas as (
  select youtube_video_id, day_pt, site_id, video_id, channel_id, 'base'::text as metric_set
    from public.yt_own_video_daily where views is not null
  union all
  select youtube_video_id, day_pt, site_id, video_id, channel_id, 'estendidas'::text
    from public.yt_own_video_daily where engaged_views is not null
), ilhas as (
  select l.*, l.day_pt - (row_number() over (partition by l.youtube_video_id, l.metric_set order by l.day_pt))::integer as g
    from linhas l
)
insert into public.yt_own_video_coverage
  (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id, source, collected_at)
select i.youtube_video_id, i.metric_set, min(i.day_pt), max(i.day_pt),
       (array_agg(i.site_id order by i.day_pt desc))[1],
       (array_agg(i.video_id order by i.day_pt desc))[1],
       (array_agg(i.channel_id order by i.day_pt desc))[1],
       'analytics_api', now()
  from ilhas i
 where not exists (select 1 from public.yt_own_video_coverage c
                    where c.youtube_video_id = i.youtube_video_id and c.metric_set = i.metric_set)
 group by i.youtube_video_id, i.metric_set, i.g
on conflict do nothing;

-- ── 3. Gravação atômica do diário ───────────────────────────────────────────
-- p_ids:  {"site_id": uuid, "channel_id": uuid, "video_id": uuid ou null}
-- p_rows: uma linha por dia DEVOLVIDO pela fonte: {"day_pt": "AAAA-MM-DD", "metric_version": "...", <métricas que vieram>}.
--         Chave ausente = a métrica não veio: o valor gravado fica como está. Chave presente e nula = grava nulo.
-- p_days_returned: os mesmos dias de p_rows (conferência: se divergirem, a função recusa em vez de adivinhar).
-- p_sets: os conjuntos que esta resposta cobre ('base', 'estendidas').
-- Na mesma transação: (1) atualiza a linha que já existe e insere a que tem atividade; (2) apaga a linha de um dia
-- devolvido que ficou sem atividade (o YouTube revisa os últimos dias); (3) estende, funde ou parte a cobertura.
-- Atividade = alguma das nove contagens diferente de zero (negativo conta).
-- Um dia só fica coberto num conjunto se a métrica que DEFINE o conjunto veio como número naquele dia (base = views;
-- estendidas = engaged_views): sem ela a chamada inteira é recusada, e "não veio" nunca vira "zero medido".
create or replace function public.yt_own_daily_apply(
  p_video text,
  p_ids jsonb,
  p_rows jsonb,
  p_days_returned date[],
  p_sets text[]
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_site uuid := (p_ids->>'site_id')::uuid;
  v_channel uuid := (p_ids->>'channel_id')::uuid;
  v_video uuid := nullif(p_ids->>'video_id', '')::uuid;
  v_days date[];
  v_rows jsonb := coalesce(p_rows, '[]'::jsonb);
  v_n integer;
  v_upd integer := 0;
  v_ins integer := 0;
  v_del integer := 0;
  v_int integer := 0;
  v_set text;
  v_mr datemultirange;
begin
  if p_video is null or p_video = '' then
    raise exception 'yt_own_daily_apply: p_video vazio' using errcode = '22023';
  end if;
  if v_site is null or v_channel is null then
    raise exception 'yt_own_daily_apply: p_ids sem site_id ou channel_id' using errcode = '22023';
  end if;
  if p_sets is null or cardinality(p_sets) = 0 or not (p_sets <@ array['base', 'estendidas']::text[]) then
    raise exception 'yt_own_daily_apply: p_sets tem de ser um subconjunto não vazio de {base, estendidas}' using errcode = '22023';
  end if;
  if jsonb_typeof(v_rows) <> 'array' then
    raise exception 'yt_own_daily_apply: p_rows não é lista' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct d order by d), '{}'::date[]) into v_days
    from unnest(coalesce(p_days_returned, '{}'::date[])) as d where d is not null;
  select count(*) into v_n from jsonb_array_elements(v_rows) as e;
  if cardinality(v_days) = 0 and v_n = 0 then
    return jsonb_build_object('dias', 0, 'atualizadas', 0, 'inseridas', 0, 'apagadas', 0, 'intervalos', 0);
  end if;
  -- p_rows e p_days_returned têm de ser o mesmo conjunto de dias, sem dia repetido.
  if v_n <> cardinality(v_days)
     or exists (select 1 from jsonb_array_elements(v_rows) as e
                 where e->>'day_pt' is null or (e->>'day_pt')::date <> all (v_days))
     or (select count(distinct e->>'day_pt') from jsonb_array_elements(v_rows) as e) <> v_n then
    raise exception 'yt_own_daily_apply: p_rows e p_days_returned não são o mesmo conjunto de dias' using errcode = '22023';
  end if;

  -- Toda linha traz a versão da métrica (o dia de zero também: ele pode virar linha numa revisão).
  if exists (select 1 from jsonb_array_elements(v_rows) as e where coalesce(e->>'metric_version', '') = '') then
    raise exception 'yt_own_daily_apply: linha sem metric_version' using errcode = '22023';
  end if;
  -- Um dia só conta como coberto num conjunto se a métrica que define o conjunto VEIO como número naquele dia
  -- (a mesma regra da carga: base = views não nulo; estendidas = engaged_views não nulo).
  if 'base' = any (p_sets) and exists (select 1 from jsonb_array_elements(v_rows) as e
                                        where jsonb_typeof(e->'views') is distinct from 'number') then
    raise exception 'yt_own_daily_apply: dia sem views numa resposta do conjunto base' using errcode = '22023';
  end if;
  if 'estendidas' = any (p_sets) and exists (select 1 from jsonb_array_elements(v_rows) as e
                                        where jsonb_typeof(e->'engaged_views') is distinct from 'number') then
    raise exception 'yt_own_daily_apply: dia sem engaged_views numa resposta do conjunto estendidas' using errcode = '22023';
  end if;

  -- Uma gravação por vídeo de cada vez (duas execuções do cron ao mesmo tempo não intercalam intervalos).
  perform pg_advisory_xact_lock(hashtextextended('yt_own_daily_apply:' || p_video, 0));

  -- (1a) a linha que já existe recebe só o que veio
  update public.yt_own_video_daily as t set
    views                     = case when e ? 'views'                     then (e->>'views')::bigint                      else t.views end,
    engaged_views             = case when e ? 'engaged_views'             then (e->>'engaged_views')::bigint              else t.engaged_views end,
    watch_time_minutes        = case when e ? 'watch_time_minutes'        then (e->>'watch_time_minutes')::numeric        else t.watch_time_minutes end,
    avg_view_duration_seconds = case when e ? 'avg_view_duration_seconds' then (e->>'avg_view_duration_seconds')::numeric else t.avg_view_duration_seconds end,
    avg_view_percentage       = case when e ? 'avg_view_percentage'       then (e->>'avg_view_percentage')::numeric       else t.avg_view_percentage end,
    likes                     = case when e ? 'likes'                     then (e->>'likes')::bigint                      else t.likes end,
    comments                  = case when e ? 'comments'                  then (e->>'comments')::bigint                   else t.comments end,
    shares                    = case when e ? 'shares'                    then (e->>'shares')::bigint                     else t.shares end,
    subscribers_gained        = case when e ? 'subscribers_gained'        then (e->>'subscribers_gained')::bigint         else t.subscribers_gained end,
    subscribers_lost          = case when e ? 'subscribers_lost'          then (e->>'subscribers_lost')::bigint           else t.subscribers_lost end,
    card_impressions          = case when e ? 'card_impressions'          then (e->>'card_impressions')::bigint           else t.card_impressions end,
    card_click_rate           = case when e ? 'card_click_rate'           then (e->>'card_click_rate')::numeric           else t.card_click_rate end,
    video_id = coalesce(v_video, t.video_id),
    source = 'analytics_api',
    collected_at = now(),
    metric_version = e->>'metric_version'
  from jsonb_array_elements(v_rows) as e
  where t.youtube_video_id = p_video and t.day_pt = (e->>'day_pt')::date;
  get diagnostics v_upd = row_count;

  -- (1b) dia novo: só entra se tem atividade
  insert into public.yt_own_video_daily
    (youtube_video_id, day_pt, site_id, video_id, channel_id,
     views, engaged_views, watch_time_minutes, avg_view_duration_seconds, avg_view_percentage,
     likes, comments, shares, subscribers_gained, subscribers_lost, card_impressions, card_click_rate,
     source, collected_at, metric_version)
  select p_video, (e->>'day_pt')::date, v_site, v_video, v_channel,
         (e->>'views')::bigint, (e->>'engaged_views')::bigint, (e->>'watch_time_minutes')::numeric,
         (e->>'avg_view_duration_seconds')::numeric, (e->>'avg_view_percentage')::numeric,
         (e->>'likes')::bigint, (e->>'comments')::bigint, (e->>'shares')::bigint,
         (e->>'subscribers_gained')::bigint, (e->>'subscribers_lost')::bigint,
         (e->>'card_impressions')::bigint, (e->>'card_click_rate')::numeric,
         'analytics_api', now(), e->>'metric_version'
    from jsonb_array_elements(v_rows) as e
   where (coalesce((e->>'views')::numeric, 0) <> 0 or coalesce((e->>'engaged_views')::numeric, 0) <> 0
          or coalesce((e->>'watch_time_minutes')::numeric, 0) <> 0 or coalesce((e->>'likes')::numeric, 0) <> 0
          or coalesce((e->>'comments')::numeric, 0) <> 0 or coalesce((e->>'shares')::numeric, 0) <> 0
          or coalesce((e->>'subscribers_gained')::numeric, 0) <> 0 or coalesce((e->>'subscribers_lost')::numeric, 0) <> 0
          or coalesce((e->>'card_impressions')::numeric, 0) <> 0)
     and not exists (select 1 from public.yt_own_video_daily d
                      where d.youtube_video_id = p_video and d.day_pt = (e->>'day_pt')::date);
  get diagnostics v_ins = row_count;

  -- (2) dia devolvido que ficou sem atividade: a linha sai (o dia continua coberto, logo abaixo).
  -- views NULO não é zero: linha cuja base nunca foi medida não é apagada (só sai com views = 0 medido).
  delete from public.yt_own_video_daily as t
   where t.youtube_video_id = p_video and t.day_pt = any (v_days)
     and t.views = 0 and coalesce(t.engaged_views, 0) = 0 and coalesce(t.watch_time_minutes, 0) = 0
     and coalesce(t.likes, 0) = 0 and coalesce(t.comments, 0) = 0 and coalesce(t.shares, 0) = 0
     and coalesce(t.subscribers_gained, 0) = 0 and coalesce(t.subscribers_lost, 0) = 0
     and coalesce(t.card_impressions, 0) = 0;
  get diagnostics v_del = row_count;

  -- (3) cobertura: a união do que já havia com os dias devolvidos; vizinhos se fundem, buraco parte o intervalo
  foreach v_set in array p_sets loop
    select range_agg(x.r) into v_mr from (
      select daterange(c.covered_from, c.covered_to, '[]') as r
        from public.yt_own_video_coverage c
       where c.youtube_video_id = p_video and c.metric_set = v_set
      union all
      select daterange(d, d, '[]') from unnest(v_days) as d
    ) x;
    delete from public.yt_own_video_coverage c
     where c.youtube_video_id = p_video and c.metric_set = v_set
       and not exists (select 1 from unnest(v_mr) as r where lower(r) = c.covered_from);
    insert into public.yt_own_video_coverage as c
      (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id, source, collected_at)
    select p_video, v_set, lower(r), (upper(r) - 1), v_site, v_video, v_channel, 'analytics_api', now()
      from unnest(v_mr) as r
    on conflict (youtube_video_id, metric_set, covered_from) do update
      set covered_to = excluded.covered_to,
          site_id = excluded.site_id,
          channel_id = excluded.channel_id,
          video_id = coalesce(excluded.video_id, c.video_id),
          source = excluded.source,
          collected_at = excluded.collected_at;
    get diagnostics v_n = row_count;
    v_int := v_int + v_n;
  end loop;

  return jsonb_build_object('dias', cardinality(v_days), 'atualizadas', v_upd, 'inseridas', v_ins,
                            'apagadas', v_del, 'intervalos', v_int);
end $$;

revoke all on function public.yt_own_daily_apply(text, jsonb, jsonb, date[], text[]) from public, anon, authenticated;
grant execute on function public.yt_own_daily_apply(text, jsonb, jsonb, date[], text[]) to service_role;

-- ── 4. kind das tentativas: a lista sai do banco ────────────────────────────
-- O catálogo passa a ser COLLECTION_KINDS no código (com teste). Nome da constraint conferido em produção em 12/10/2026.
alter table public.yt_own_collection_attempts drop constraint if exists yt_own_collection_attempts_kind_check;
alter table public.yt_own_collection_attempts
  add constraint yt_own_collection_attempts_kind_check check (kind ~ '^[a-z0-9_]{1,40}$');

-- ── 5. Remover canal: toda tabela presa ao canal conta como série ───────────
-- Recriada por inteiro. Única mudança em relação a 20261009000001: serie_coletada deixa de ser uma lista escrita
-- (seis tabelas) e passa a somar toda tabela de public com chave estrangeira "on delete restrict" para
-- youtube_channels. Em 12/10/2026 são exatamente as mesmas seis; cada tabela nova da A5 que nascer presa ao canal
-- (cobertura, retenção, dimensões, versões, yt_own_public_*) entra sozinha, em qualquer ordem de migration.
-- public.youtube_channel_remove não muda (ela lê serie_coletada daqui).
-- CORPO ÚNICO DA A5 (decisão R1 do controlador): toda migration que precisar que esta função conheça tabela nova
-- traz o bloco entre as marcas abaixo SEM MUDAR UM BYTE (create or replace), nunca uma lista de tabelas.
-- >>> corpo único: youtube_channel_removal_impact (início)
create or replace function public.youtube_channel_removal_impact(p_site_id uuid, p_channel_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_name text;
  v_slug text;
  v_yt text;
  v_serie bigint := 0;
  v_n bigint;
  v_t record;
begin
  select c.name, c.slug, c.channel_id into v_name, v_slug, v_yt
  from public.youtube_channels c where c.id = p_channel_id and c.site_id = p_site_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- linhas da coleta que apontam para o canal (o bruto vai junto com o relatório, por cascata)
  for v_t in
    select k.conrelid::regclass::text as tabela, a.attname::text as coluna
      from pg_catalog.pg_constraint k
      join pg_catalog.pg_class r on r.oid = k.conrelid
      join pg_catalog.pg_namespace n on n.oid = r.relnamespace
      join pg_catalog.pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
     where k.contype = 'f' and k.confrelid = 'public.youtube_channels'::regclass
       and k.confdeltype = 'r' and n.nspname = 'public' and cardinality(k.conkey) = 1
     order by 1
  loop
    execute format('select count(*) from %s t where t.%I = $1', v_t.tabela, v_t.coluna) into v_n using p_channel_id;
    v_serie := v_serie + v_n;
  end loop;

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
    'serie_coletada', v_serie,
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
-- <<< corpo único: youtube_channel_removal_impact (fim)
