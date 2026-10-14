-- =============================================================================
-- MIGRATION MG7: Observatório A5, etapa E11 — canal próprio em tabelas
-- Spec: docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md (7.3)
-- Plano: docs/superpowers/plans/2026-10-12-a5-e11-canal-proprio-em-tabelas-plan.md
-- Aditiva. Roda duas vezes sem erro. Depende da MG14 (yt_own_video_coverage) e da MG13 (já aplicada).
-- Convive com o código de main: só cria tabelas e funções novas e reafirma o corpo POR CATÁLOGO de
-- youtube_channel_removal_impact (o mesmo texto da MG14, byte a byte), sem mudar assinatura nem chaves do retorno.
--
-- O que faz:
--   1. yt_own_video_dim_daily: views por origem, aparelho, país e inscrito (Analytics API). Esparsa.
--   2. yt_own_video_traffic_detail_daily: o detalhe da origem (termo, site, vídeo, canal), do lote channel_traffic_source_a3.
--   3. yt_own_video_reach_dim_daily: impressões por origem e aparelho, do lote channel_reach_combined_a1.
--   4. RLS nas três (bloco PL do spec: can_view_private_site se a MG11 já existir; senão can_edit_site).
--   5. Funções de gravação (só service_role): yt_own_dim_coverage_extend, yt_own_dim_apply, yt_own_dim_cover_idle,
--      yt_own_traffic_detail_apply, yt_own_reach_dim_apply, yt_own_dim_prova.
--   6. youtube_channel_removal_impact: o corpo por catálogo da MG14, repetido sem mudar uma letra (decisão R1 do
--      controlador): serie_coletada soma toda tabela presa ao canal por FK "on delete restrict". As três tabelas
--      daqui entram sozinhas, por terem essa chave.
-- youtube_video_id = id de 11 caracteres do YouTube. day_pt = o dia como veio da fonte.
-- Os códigos das dimensões são gravados COMO VIERAM: nomes na Analytics API ('YT_SEARCH', 'MOBILE|ANDROID'),
-- números no lote ('5', '104', '4'). A tradução mora no código (reporting/codigos.ts).
-- =============================================================================
set lock_timeout = '5s';

do $$ begin
  if to_regclass('public.yt_own_video_coverage') is null then
    raise exception 'MG7 depende da MG14: public.yt_own_video_coverage não existe. Aplique a MG14 antes.';
  end if;
end $$;

-- ── 1. Dimensões por vídeo e dia (Analytics API) ────────────────────────────
create table if not exists public.yt_own_video_dim_daily (
  youtube_video_id text not null,
  day_pt date not null,
  dim_kind text not null check (dim_kind in ('traffic_source', 'device_os', 'country', 'subscribed_status')),
  dim_value text not null check (dim_value ~ '^[A-Za-z0-9_|]{1,80}$'),
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  views bigint,
  engaged_views bigint,
  watch_time_minutes numeric,
  source text not null default 'analytics_api' check (source in ('analytics_api')),
  collected_at timestamptz not null default now(),
  metric_version text not null,
  primary key (youtube_video_id, day_pt, dim_kind, dim_value),
  constraint yt_own_video_dim_daily_esparsa
    check (coalesce(views, 0) <> 0 or coalesce(engaged_views, 0) <> 0 or coalesce(watch_time_minutes, 0) <> 0)
);
create index if not exists idx_yt_own_video_dim_daily_channel
  on public.yt_own_video_dim_daily (channel_id, dim_kind, day_pt);

-- ── 2. Detalhe da origem (lote channel_traffic_source_a3) ───────────────────
-- detail = '' quando o YouTube não informou o detalhe (abaixo do limiar): é "sem detalhe", nunca um termo vazio.
create table if not exists public.yt_own_video_traffic_detail_daily (
  youtube_video_id text not null,
  day_pt date not null,
  source_type text not null check (source_type ~ '^[A-Za-z0-9_]{1,40}$'),
  detail text not null check (char_length(detail) <= 300),
  detail_hash text not null check (detail_hash ~ '^[0-9a-f]{64}$'),
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  views bigint,
  watch_time_minutes numeric,
  source text not null default 'reporting_api' check (source in ('reporting_api')),
  source_report_id text not null,
  report_create_time timestamptz not null,
  collected_at timestamptz not null default now(),
  metric_version text not null,
  primary key (youtube_video_id, day_pt, source_type, detail_hash),
  constraint yt_own_video_traffic_detail_daily_esparsa
    check (coalesce(views, 0) <> 0 or coalesce(watch_time_minutes, 0) <> 0)
);
-- (canal, dia) na frente: é por ele que o dia inteiro é substituído (OP-8).
create index if not exists idx_yt_own_traffic_detail_channel_day
  on public.yt_own_video_traffic_detail_daily (channel_id, day_pt, source_type);

-- ── 3. Impressões por origem e aparelho (lote channel_reach_combined_a1) ────
-- thumbnail_clicks_est = soma de (impressões × taxa) das linhas do CSV da chave; nulo se alguma veio sem taxa.
create table if not exists public.yt_own_video_reach_dim_daily (
  youtube_video_id text not null,
  day_pt date not null,
  traffic_source_type text not null check (traffic_source_type ~ '^[A-Za-z0-9_]{1,40}$'),
  device_type text not null check (device_type ~ '^[A-Za-z0-9_]{1,40}$'),
  operating_system text not null check (operating_system ~ '^[A-Za-z0-9_]{1,40}$'),
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  thumbnail_impressions bigint,
  thumbnail_clicks_est numeric,
  source_report_id text not null,
  report_create_time timestamptz not null,
  collected_at timestamptz not null default now(),
  metric_version text not null,
  primary key (youtube_video_id, day_pt, traffic_source_type, device_type, operating_system),
  constraint yt_own_video_reach_dim_daily_esparsa check (coalesce(thumbnail_impressions, 0) <> 0),
  constraint yt_own_video_reach_dim_daily_cliques
    check (thumbnail_clicks_est is null or (thumbnail_clicks_est >= 0 and thumbnail_clicks_est <= thumbnail_impressions))
);
create index if not exists idx_yt_own_reach_dim_channel_day
  on public.yt_own_video_reach_dim_daily (channel_id, day_pt);

-- ── 4. RLS: leitura por quem tem o direito de ver o dado privado; escrita só por service role ──
alter table public.yt_own_video_dim_daily enable row level security;
alter table public.yt_own_video_traffic_detail_daily enable row level security;
alter table public.yt_own_video_reach_dim_daily enable row level security;
do $$
declare
  v_fn text := case when to_regprocedure('public.can_view_private_site(uuid)') is not null
                    then 'public.can_view_private_site(site_id)' else 'public.can_edit_site(site_id)' end;
  t text;
begin
  foreach t in array array['yt_own_video_dim_daily', 'yt_own_video_traffic_detail_daily', 'yt_own_video_reach_dim_daily'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (%s)', t || '_select', t, v_fn);
    -- Sem policy de escrita, a RLS já barra; os privilégios saem também (defesa em profundidade).
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from authenticated', t);
  end loop;
end $$;

-- ── 5a. Estender a cobertura de um conjunto, fundindo vizinhos ──────────────
-- Nunca encolhe. Intervalos que encostam ([a, b] e [b+1, c]) viram um.
create or replace function public.yt_own_dim_coverage_extend(
  p_video text, p_set text, p_from date, p_to date,
  p_site uuid, p_video_id uuid, p_channel uuid, p_source text
) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_from date := p_from;
  v_to date := p_to;
  v_min date;
  v_max date;
begin
  if p_from is null or p_to is null or p_to < p_from then
    return;
  end if;
  select min(c.covered_from), max(c.covered_to) into v_min, v_max
  from public.yt_own_video_coverage c
  where c.youtube_video_id = p_video and c.metric_set = p_set
    and c.covered_from <= p_to + 1 and c.covered_to >= p_from - 1;
  if v_min is not null then
    v_from := least(v_from, v_min);
    v_to := greatest(v_to, v_max);
    delete from public.yt_own_video_coverage c
    where c.youtube_video_id = p_video and c.metric_set = p_set
      and c.covered_from <= p_to + 1 and c.covered_to >= p_from - 1;
  end if;
  insert into public.yt_own_video_coverage
    (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id, source, collected_at)
  values (p_video, p_set, v_from, v_to, p_site, p_video_id, p_channel, p_source, now());
end $$;

-- ── 5b. Gravar uma janela de UMA dimensão de UM vídeo (Analytics API) ───────
-- p_rows: [{day_pt, dim_value, views?, engaged_views?, watch_time_minutes?, metric_version}]
-- Regras: (1) a cobertura nunca passa do último dia coberto do conjunto 'base' do vídeo; linha de dia além disso é
-- descartada e contada; (2) dia que veio com linha é substituído inteiro; (3) dia que veio SEM linha só é limpo se o
-- diário diz zero view nesse dia; se o diário tem view, as linhas antigas ficam (o YouTube omitiu, ou a resposta veio
-- vazia) e o dia é contado em dias_mantidos, SALVO se a soma das linhas antigas já passa das views do diário (o diário
-- foi revisado para baixo e a linha antiga contradiz a referência): aí o dia é limpo, em vez de ficar "em revisão"
-- para sempre; (4) só entra linha com alguma métrica diferente de zero.
-- Quem chama cobre a janela INTEIRA de uma vez (dias sem view incluídos), também na família consultada dia a dia:
-- p_to é o último dia respondido sem falha. Assim a cobertura do conjunto é contígua por construção.
create or replace function public.yt_own_dim_apply(
  p_video text, p_kind text, p_from date, p_to date, p_rows jsonb,
  p_site uuid, p_video_id uuid, p_channel uuid
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_set text := case p_kind when 'traffic_source' then 'trafego' when 'device_os' then 'dispositivo'
                            when 'country' then 'pais' when 'subscribed_status' then 'inscrito' end;
  v_base date;
  v_to date;
  v_fora integer;
  v_apagadas integer;
  v_gravadas integer;
  v_mantidos integer;
  v_revisao integer;
begin
  if v_set is null then
    raise exception 'yt_own_dim_apply: dim_kind desconhecido (%)', left(coalesce(p_kind, 'nulo'), 40);
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'yt_own_dim_apply: janela inválida';
  end if;
  if jsonb_typeof(coalesce(p_rows, 'null'::jsonb)) <> 'array' then
    raise exception 'yt_own_dim_apply: p_rows tem de ser uma lista';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_rows) as r(day_pt date) where r.day_pt is null or r.day_pt < p_from or r.day_pt > p_to) then
    raise exception 'yt_own_dim_apply: linha fora da janela pedida';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('yt_own_dim:' || p_channel::text, 0));

  select max(c.covered_to) into v_base
  from public.yt_own_video_coverage c
  where c.youtube_video_id = p_video and c.metric_set = 'base';
  if v_base is null or v_base < p_from then
    return jsonb_build_object('status', 'base_sem_cobertura', 'base_ate', v_base, 'coberto_ate', null,
                              'gravadas', 0, 'apagadas', 0, 'fora_do_teto', jsonb_array_length(p_rows),
                              'dias_mantidos', 0, 'dias_em_revisao', 0);
  end if;
  v_to := least(p_to, v_base);

  select count(*) into v_fora from jsonb_to_recordset(p_rows) as r(day_pt date) where r.day_pt > v_to;

  delete from public.yt_own_video_dim_daily d
  where d.youtube_video_id = p_video and d.dim_kind = p_kind and d.day_pt between p_from and v_to
    and (d.day_pt in (select r.day_pt from jsonb_to_recordset(p_rows) as r(day_pt date))
         or not exists (select 1 from public.yt_own_video_daily b
                        where b.youtube_video_id = p_video and b.day_pt = d.day_pt and b.views > 0)
         or (select sum(coalesce(o.views, 0)) from public.yt_own_video_dim_daily o
             where o.youtube_video_id = p_video and o.dim_kind = p_kind and o.day_pt = d.day_pt)
            > (select b.views from public.yt_own_video_daily b
               where b.youtube_video_id = p_video and b.day_pt = d.day_pt));
  get diagnostics v_apagadas = row_count;

  select count(distinct d.day_pt) into v_mantidos
  from public.yt_own_video_dim_daily d
  where d.youtube_video_id = p_video and d.dim_kind = p_kind and d.day_pt between p_from and v_to;

  insert into public.yt_own_video_dim_daily
    (youtube_video_id, day_pt, dim_kind, dim_value, site_id, video_id, channel_id,
     views, engaged_views, watch_time_minutes, source, collected_at, metric_version)
  select p_video, r.day_pt, p_kind, r.dim_value, p_site, p_video_id, p_channel,
         r.views, r.engaged_views, r.watch_time_minutes, 'analytics_api', now(), r.metric_version
  from jsonb_to_recordset(p_rows) as r(
    day_pt date, dim_value text, views bigint, engaged_views bigint, watch_time_minutes numeric, metric_version text)
  where r.day_pt <= v_to
    and (coalesce(r.views, 0) <> 0 or coalesce(r.engaged_views, 0) <> 0 or coalesce(r.watch_time_minutes, 0) <> 0);
  get diagnostics v_gravadas = row_count;

  perform public.yt_own_dim_coverage_extend(p_video, v_set, p_from, v_to, p_site, p_video_id, p_channel, 'analytics_api');

  -- "em revisão": a soma da dimensão passou das views do diário (o diário foi revisado e a dimensão ainda não).
  select count(*) into v_revisao
  from (select d.day_pt, sum(coalesce(d.views, 0)) s
        from public.yt_own_video_dim_daily d
        where d.youtube_video_id = p_video and d.dim_kind = p_kind and d.day_pt between p_from and v_to
        group by d.day_pt) x
  left join public.yt_own_video_daily b on b.youtube_video_id = p_video and b.day_pt = x.day_pt
  where x.s > coalesce(b.views, 0);

  return jsonb_build_object('status', 'gravado', 'base_ate', v_base, 'coberto_ate', v_to,
                            'gravadas', v_gravadas, 'apagadas', v_apagadas, 'fora_do_teto', v_fora,
                            'dias_mantidos', v_mantidos, 'dias_em_revisao', v_revisao);
end $$;

-- ── 5c. Vídeos sem view na janela: a cobertura avança sem chamar a API ──────
-- Para cada vídeo do canal com cobertura 'base' e cada um dos quatro conjuntos: janela = [maior(p_inicio, menor(p_janela,
-- último dia coberto do conjunto)), menor(p_to, último dia da base)]. Se o diário não tem view nessa janela, limpa as
-- linhas da dimensão (zero view não tem origem) e estende a cobertura. Vídeo com view fica para o passo (API).
create or replace function public.yt_own_dim_cover_idle(p_channel uuid, p_inicio date, p_janela date, p_to date)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v record;
  k record;
  v_last date;
  v_from date;
  v_to date;
  v_cobertos integer := 0;
  v_ativos integer := 0;
  v_videos integer := 0;
  v_ativo boolean;
begin
  if p_inicio is null or p_janela is null or p_to is null then
    raise exception 'yt_own_dim_cover_idle: datas obrigatórias';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('yt_own_dim:' || p_channel::text, 0));
  for v in
    select c.youtube_video_id, max(c.covered_to) as base_to,
           (array_agg(c.site_id order by c.covered_to desc))[1] as site_id,
           (array_agg(c.video_id order by c.covered_to desc))[1] as video_id
    from public.yt_own_video_coverage c
    where c.channel_id = p_channel and c.metric_set = 'base'
    group by c.youtube_video_id
  loop
    v_videos := v_videos + 1;
    v_ativo := false;
    for k in select * from (values ('traffic_source', 'trafego'), ('device_os', 'dispositivo'),
                                   ('country', 'pais'), ('subscribed_status', 'inscrito')) as t(kind, metric_set)
    loop
      select max(c.covered_to) into v_last
      from public.yt_own_video_coverage c
      where c.youtube_video_id = v.youtube_video_id and c.metric_set = k.metric_set;
      v_from := greatest(p_inicio, least(p_janela, coalesce(v_last, p_inicio)));
      v_to := least(p_to, v.base_to);
      continue when v_to < v_from;
      if exists (select 1 from public.yt_own_video_daily b
                 where b.youtube_video_id = v.youtube_video_id and b.day_pt between v_from and v_to and b.views > 0) then
        v_ativo := true;
        continue;
      end if;
      delete from public.yt_own_video_dim_daily d
      where d.youtube_video_id = v.youtube_video_id and d.dim_kind = k.kind and d.day_pt between v_from and v_to;
      perform public.yt_own_dim_coverage_extend(v.youtube_video_id, k.metric_set, v_from, v_to,
                                                v.site_id, v.video_id, p_channel, 'analytics_api');
      v_cobertos := v_cobertos + 1;
    end loop;
    if v_ativo then v_ativos := v_ativos + 1; end if;
  end loop;
  return jsonb_build_object('videos_com_base', v_videos, 'conjuntos_cobertos', v_cobertos, 'videos_com_view', v_ativos);
end $$;

-- ── 5d. Gravar o detalhe da origem de UM relatório (substitui o dia inteiro do canal) ──
-- O dia é o que o RELATÓRIO cobre (start_time), não os dias das linhas: relatório refeito vazio apaga o dia (OP-13).
-- Relatório mais velho que outro JÁ NORMALIZADO do mesmo canal, tipo e dia não grava nada ('superado'). Um mais novo
-- que ainda não foi normalizado não supera ninguém: se ele falhar, o dado do mais velho tem de estar gravado.
-- p_rows: [{youtube_video_id, video_id?, day_pt, source_type, detail, detail_hash, views?, watch_time_minutes?, metric_version}]
create or replace function public.yt_own_traffic_detail_apply(p_report_id text, p_rows jsonb, p_unmatched jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  r public.yt_reporting_reports%rowtype;
  v_day date;
  v_apagadas integer := 0;
  v_gravadas integer := 0;
  v_cobertos integer := 0;
  x record;
begin
  if jsonb_typeof(coalesce(p_rows, 'null'::jsonb)) <> 'array' then
    raise exception 'yt_own_traffic_detail_apply: p_rows tem de ser uma lista';
  end if;
  select * into r from public.yt_reporting_reports t where t.report_id = p_report_id for update;
  if not found then
    raise exception 'yt_own_traffic_detail_apply: relatório não encontrado';
  end if;
  if r.report_type_id <> 'channel_traffic_source_a3' or r.status not in ('baixado', 'vazio') then
    raise exception 'yt_own_traffic_detail_apply: relatório de tipo ou estado inesperado (%, %)', r.report_type_id, r.status;
  end if;
  if r.end_time - r.start_time > interval '25 hours' then
    raise exception 'yt_own_traffic_detail_apply: o relatório cobre mais de um dia';
  end if;
  v_day := (r.start_time at time zone 'UTC')::date;
  if exists (select 1 from jsonb_to_recordset(p_rows) as j(day_pt date) where j.day_pt is distinct from v_day) then
    raise exception 'yt_own_traffic_detail_apply: linha de dia diferente do dia do relatório';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('yt_own_dim:' || r.channel_id::text, 0));

  if exists (select 1 from public.yt_reporting_reports n
             where n.channel_id = r.channel_id and n.report_type_id = r.report_type_id and n.start_time = r.start_time
               and n.status in ('baixado', 'vazio') and n.normalized_at is not null
               and (n.create_time, n.report_id) > (r.create_time, r.report_id))
     or exists (select 1 from public.yt_own_video_traffic_detail_daily d
                where d.channel_id = r.channel_id and d.day_pt = v_day and d.report_create_time > r.create_time) then
    update public.yt_reporting_reports t set normalized_at = now() where t.report_id = p_report_id;
    return jsonb_build_object('status', 'superado', 'dia', v_day, 'gravadas', 0, 'apagadas', 0, 'videos_cobertos', 0);
  end if;

  delete from public.yt_own_video_traffic_detail_daily d where d.channel_id = r.channel_id and d.day_pt = v_day;
  get diagnostics v_apagadas = row_count;

  insert into public.yt_own_video_traffic_detail_daily
    (youtube_video_id, day_pt, source_type, detail, detail_hash, site_id, video_id, channel_id,
     views, watch_time_minutes, source, source_report_id, report_create_time, collected_at, metric_version)
  select j.youtube_video_id, v_day, j.source_type, j.detail, j.detail_hash, r.site_id, j.video_id, r.channel_id,
         j.views, j.watch_time_minutes, 'reporting_api', r.report_id, r.create_time, now(), j.metric_version
  from jsonb_to_recordset(p_rows) as j(
    youtube_video_id text, video_id uuid, source_type text, detail text, detail_hash text,
    views bigint, watch_time_minutes numeric, metric_version text);
  get diagnostics v_gravadas = row_count;

  for x in
    select v.youtube_video_id, v.id as video_id from public.youtube_videos v where v.channel_id = r.channel_id
    union
    select j.youtube_video_id, null::uuid from jsonb_to_recordset(p_rows) as j(youtube_video_id text)
    where not exists (select 1 from public.youtube_videos v2 where v2.channel_id = r.channel_id and v2.youtube_video_id = j.youtube_video_id)
  loop
    perform public.yt_own_dim_coverage_extend(x.youtube_video_id, 'detalhe', v_day, v_day, r.site_id, x.video_id, r.channel_id, 'reporting_api');
    v_cobertos := v_cobertos + 1;
  end loop;

  update public.yt_reporting_reports t
     set normalized_at = now(), unmatched_video_ids = p_unmatched
   where t.report_id = p_report_id;
  return jsonb_build_object('status', 'gravado', 'dia', v_day, 'gravadas', v_gravadas, 'apagadas', v_apagadas, 'videos_cobertos', v_cobertos);
end $$;

-- ── 5e. Gravar o alcance por dimensão de UM relatório (mesma regra da 5d) ───
-- p_rows: [{youtube_video_id, video_id?, day_pt, traffic_source_type, device_type, operating_system,
--           thumbnail_impressions, thumbnail_clicks_est?, metric_version}]
create or replace function public.yt_own_reach_dim_apply(p_report_id text, p_rows jsonb, p_unmatched jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  r public.yt_reporting_reports%rowtype;
  v_day date;
  v_apagadas integer := 0;
  v_gravadas integer := 0;
  v_cobertos integer := 0;
  x record;
begin
  if jsonb_typeof(coalesce(p_rows, 'null'::jsonb)) <> 'array' then
    raise exception 'yt_own_reach_dim_apply: p_rows tem de ser uma lista';
  end if;
  select * into r from public.yt_reporting_reports t where t.report_id = p_report_id for update;
  if not found then
    raise exception 'yt_own_reach_dim_apply: relatório não encontrado';
  end if;
  if r.report_type_id <> 'channel_reach_combined_a1' or r.status not in ('baixado', 'vazio') then
    raise exception 'yt_own_reach_dim_apply: relatório de tipo ou estado inesperado (%, %)', r.report_type_id, r.status;
  end if;
  if r.end_time - r.start_time > interval '25 hours' then
    raise exception 'yt_own_reach_dim_apply: o relatório cobre mais de um dia';
  end if;
  v_day := (r.start_time at time zone 'UTC')::date;
  if exists (select 1 from jsonb_to_recordset(p_rows) as j(day_pt date) where j.day_pt is distinct from v_day) then
    raise exception 'yt_own_reach_dim_apply: linha de dia diferente do dia do relatório';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('yt_own_dim:' || r.channel_id::text, 0));

  if exists (select 1 from public.yt_reporting_reports n
             where n.channel_id = r.channel_id and n.report_type_id = r.report_type_id and n.start_time = r.start_time
               and n.status in ('baixado', 'vazio') and n.normalized_at is not null
               and (n.create_time, n.report_id) > (r.create_time, r.report_id))
     or exists (select 1 from public.yt_own_video_reach_dim_daily d
                where d.channel_id = r.channel_id and d.day_pt = v_day and d.report_create_time > r.create_time) then
    update public.yt_reporting_reports t set normalized_at = now() where t.report_id = p_report_id;
    return jsonb_build_object('status', 'superado', 'dia', v_day, 'gravadas', 0, 'apagadas', 0, 'videos_cobertos', 0);
  end if;

  delete from public.yt_own_video_reach_dim_daily d where d.channel_id = r.channel_id and d.day_pt = v_day;
  get diagnostics v_apagadas = row_count;

  insert into public.yt_own_video_reach_dim_daily
    (youtube_video_id, day_pt, traffic_source_type, device_type, operating_system, site_id, video_id, channel_id,
     thumbnail_impressions, thumbnail_clicks_est, source_report_id, report_create_time, collected_at, metric_version)
  select j.youtube_video_id, v_day, j.traffic_source_type, j.device_type, j.operating_system, r.site_id, j.video_id, r.channel_id,
         j.thumbnail_impressions, j.thumbnail_clicks_est, r.report_id, r.create_time, now(), j.metric_version
  from jsonb_to_recordset(p_rows) as j(
    youtube_video_id text, video_id uuid, traffic_source_type text, device_type text, operating_system text,
    thumbnail_impressions bigint, thumbnail_clicks_est numeric, metric_version text);
  get diagnostics v_gravadas = row_count;

  for x in
    select v.youtube_video_id, v.id as video_id from public.youtube_videos v where v.channel_id = r.channel_id
    union
    select j.youtube_video_id, null::uuid from jsonb_to_recordset(p_rows) as j(youtube_video_id text)
    where not exists (select 1 from public.youtube_videos v2 where v2.channel_id = r.channel_id and v2.youtube_video_id = j.youtube_video_id)
  loop
    perform public.yt_own_dim_coverage_extend(x.youtube_video_id, 'alcance_dim', v_day, v_day, r.site_id, x.video_id, r.channel_id, 'reporting_api');
    v_cobertos := v_cobertos + 1;
  end loop;

  update public.yt_reporting_reports t
     set normalized_at = now(), unmatched_video_ids = p_unmatched
   where t.report_id = p_report_id;
  return jsonb_build_object('status', 'gravado', 'dia', v_day, 'gravadas', v_gravadas, 'apagadas', v_apagadas, 'videos_cobertos', v_cobertos);
end $$;

-- ── 5f. Os números de prova da etapa (uma ida ao banco por execução do cron, por site) ─
-- p_site = o site (obrigatório: o banco de integração é dividido entre etapas, e a prova nunca soma sites).
-- p_hoje = "hoje" no Pacífico, vindo do código (nunca current_date: o banco está em UTC).
-- p_desde = a data de partida da coleta de dimensões (DIMENSOES_DESDE).
-- Parâmetro nulo é erro, nunca "0 faltando".
--   faltando_cobertura: (vídeo, conjunto) de canal com coleta ligada, com base que chega à data de partida, cuja
--     cobertura não chega a menor(p_hoje - 4, base). NP-E11. Vídeo com a base parada ANTES da data de partida não
--     conta aqui (nada há para cobrir; base parada é alarme da dieta): vai em videos_base_antes_do_inicio.
--   videos_com_base: vídeos com alguma cobertura 'base'. 0 com vídeos cadastrados = a dieta (E6 P2) não está no ar.
--   videos_sem_base: vídeos de canal ligado, publicados há mais de 4 dias (dia do Pacífico), sem NENHUMA cobertura
--     'base'. O vídeo recém-publicado não conta: o diário leva de 2 a 3 dias para devolver o primeiro dia.
--   base_ate: o MENOR, entre os canais ligados que têm base, do dia mais recente coberto pela base (um canal parado
--     não se esconde atrás de outro em dia). Nulo = nenhuma base.
--   dias_dois_relatorios_*: (canal, dia) com mais de um source_report_id nos últimos 60 dias (item 249; tem de ser 0).
--   pendentes_normalizar: relatórios dos dois tipos baixados há mais de 2 dias sem normalizar (relatório em 'erro'
--     não conta aqui: é do critério de relatório em erro, que já existe).
create or replace function public.yt_own_dim_prova(p_site uuid, p_hoje date, p_desde date)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_site is null or p_hoje is null or p_desde is null then
    raise exception 'yt_own_dim_prova: p_site, p_hoje e p_desde são obrigatórios' using errcode = '22023';
  end if;
  return (
    with canais as (select c.id from public.youtube_channels c where c.sync_enabled and c.site_id = p_site),
    base as (
      select k.youtube_video_id, max(k.covered_to) as base_to
      from public.yt_own_video_coverage k
      where k.metric_set = 'base' and k.channel_id in (select id from canais)
      group by k.youtube_video_id),
    falta as (
      select b.youtube_video_id, s.metric_set
      from base b cross join (values ('trafego'), ('dispositivo'), ('pais'), ('inscrito')) as s(metric_set)
      where b.base_to >= p_desde
        and not exists (
          select 1 from public.yt_own_video_coverage k
          where k.youtube_video_id = b.youtube_video_id and k.metric_set = s.metric_set
            and k.covered_to >= least(p_hoje - 4, b.base_to)))
    select jsonb_build_object(
      'faltando_cobertura', (select count(*) from falta),
      'videos_com_base', (select count(*) from base),
      'videos_base_antes_do_inicio', (select count(*) from base b where b.base_to < p_desde),
      'videos_sem_base', (select count(*) from public.youtube_videos v
                          where v.channel_id in (select id from canais)
                            and (v.published_at at time zone 'America/Los_Angeles')::date <= p_hoje - 4
                            and not exists (select 1 from base b where b.youtube_video_id = v.youtube_video_id)),
      'base_ate', (select min(x.m) from (
          select max(k.covered_to) as m from public.yt_own_video_coverage k
          where k.metric_set = 'base' and k.channel_id in (select id from canais) group by k.channel_id) x),
      'dias_dois_relatorios_detalhe', (select count(*) from (
          select d.channel_id, d.day_pt from public.yt_own_video_traffic_detail_daily d
          where d.site_id = p_site and d.day_pt >= p_hoje - 60 group by 1, 2 having count(distinct d.source_report_id) > 1) x),
      'dias_dois_relatorios_alcance', (select count(*) from (
          select d.channel_id, d.day_pt from public.yt_own_video_reach_dim_daily d
          where d.site_id = p_site and d.day_pt >= p_hoje - 60 group by 1, 2 having count(distinct d.source_report_id) > 1) x),
      'pendentes_normalizar', (select count(*) from public.yt_reporting_reports r
                               where r.site_id = p_site
                                 and r.report_type_id in ('channel_traffic_source_a3', 'channel_reach_combined_a1')
                                 and r.status in ('baixado', 'vazio') and r.normalized_at is null
                                 and r.downloaded_at < now() - interval '2 days'
                                 and r.channel_id in (select id from canais))
    ));
end $$;

revoke all on function public.yt_own_dim_coverage_extend(text, text, date, date, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.yt_own_dim_coverage_extend(text, text, date, date, uuid, uuid, uuid, text) to service_role;
revoke all on function public.yt_own_dim_apply(text, text, date, date, jsonb, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.yt_own_dim_apply(text, text, date, date, jsonb, uuid, uuid, uuid) to service_role;
revoke all on function public.yt_own_dim_cover_idle(uuid, date, date, date) from public, anon, authenticated;
grant execute on function public.yt_own_dim_cover_idle(uuid, date, date, date) to service_role;
revoke all on function public.yt_own_traffic_detail_apply(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.yt_own_traffic_detail_apply(text, jsonb, jsonb) to service_role;
revoke all on function public.yt_own_reach_dim_apply(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.yt_own_reach_dim_apply(text, jsonb, jsonb) to service_role;
revoke all on function public.yt_own_dim_prova(uuid, date, date) from public, anon, authenticated;
grant execute on function public.yt_own_dim_prova(uuid, date, date) to service_role;

-- ── 6. Remover canal: toda tabela presa ao canal conta como série ───────────
-- CORPO ÚNICO DA A5 (decisão R1 do controlador). O bloco entre as marcas abaixo é o da MG14 (o plano das ordens 8 e 10
-- é o dono do texto), SEM MUDAR UM BYTE: 76 linhas com as duas marcas. Não há lista de tabelas: serie_coletada soma toda
-- tabela de public com chave estrangeira "on delete restrict" para youtube_channels. As três tabelas desta migration têm
-- essa chave e entram sozinhas. Reaplicar o bloco depois da MG14 não muda nada; se a função tiver sido recriada com
-- outro corpo no meio do caminho, este a devolve ao certo.
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
