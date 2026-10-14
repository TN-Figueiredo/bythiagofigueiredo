-- =============================================================================
-- MIGRATION: Observatório A5, E6 (dieta do diário do canal próprio), parte DESTRUTIVA: P3 (MG15 do spec)
-- Spec: docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md, seção 7.1
-- Plano: docs/superpowers/plans/2026-10-13-a5-e6-p3-apagar-linhas-vazias-do-diario-plan.md
--
-- APAGA LINHA. Vai sozinha, com o dono, depois de o leitor tolerante estar em main (o SQL não vê código:
-- isso é do portão do plano). Fora de 11:30 a 13:00 UTC. O vacuum full é um comando à parte.
--
-- O que faz:
--   0. Recusa sem a MG14, ou se o diário não tiver as 20 colunas esperadas.
--   1. yt_own_video_daily_zeros_bkp: a cópia das linhas apagadas. Sem policy, sem privilégio, sem chave estrangeira.
--   2. Três funções auxiliares (critério, contas, apagamento), sem execute para ninguém.
--   3. UMA instrução: para cada site com linha no diário, apaga as linhas vazias e cobertas, copiando-as
--      para o backup na mesma instrução, e confere as contas de antes e de depois. Qualquer prova que falhe
--      desfaz tudo. O resultado fica no comentário da tabela de backup.
--   4. Apaga as três funções.
-- Roda duas vezes sem erro quando nenhuma linha vazia ficou: na segunda não há linha vazia e nada é exigido nem
-- apagado. Se alguma ficou (regras 2 ou 4), a segunda exige de novo as guardas e pode recusar. (emenda 1: D-M-3, S-M-7)
-- Com linha vazia, exige a marca do dia no comentário do diário (o dono a põe no passo do CSV). (emenda 1: S-I-2)
-- Banco sem linha no diário (novo, CI): não faz nada e não recusa.
-- =============================================================================
set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- ── 0. Recusas de entrada ───────────────────────────────────────────────────
do $$
declare v_cols text;
begin
  if to_regclass('public.yt_own_video_coverage') is null
     or to_regprocedure('public.yt_own_daily_apply(text,jsonb,jsonb,date[],text[])') is null then
    raise exception 'MG15 depende da MG14: public.yt_own_video_coverage ou public.yt_own_daily_apply não existe';
  end if;
  select string_agg(a.attname, ',' order by a.attnum) into v_cols
    from pg_catalog.pg_attribute a
   where a.attrelid = 'public.yt_own_video_daily'::regclass and a.attnum > 0 and not a.attisdropped;
  if v_cols is distinct from 'youtube_video_id,day_pt,site_id,video_id,channel_id,views,engaged_views,watch_time_minutes,avg_view_duration_seconds,avg_view_percentage,likes,comments,shares,subscribers_gained,subscribers_lost,card_impressions,card_click_rate,source,collected_at,metric_version' then
    raise exception 'MG15: o diário mudou de forma (colunas: %). Rever o critério e a cópia antes de apagar', v_cols;
  end if;
end $$;

-- >>> MG15 backup (início)
-- ── 1. A cópia dentro do banco ──────────────────────────────────────────────
-- Mesmas colunas do diário, na mesma ordem. Sem chave estrangeira: não entra em serie_coletada.
create table if not exists public.yt_own_video_daily_zeros_bkp (like public.yt_own_video_daily);
create unique index if not exists yt_own_video_daily_zeros_bkp_chave
  on public.yt_own_video_daily_zeros_bkp (youtube_video_id, day_pt);
alter table public.yt_own_video_daily_zeros_bkp enable row level security;
-- Nenhuma policy: ninguém lê pelo aplicativo. Só o dono do banco, até a MG16 soltar a tabela.
revoke all on table public.yt_own_video_daily_zeros_bkp from public, anon, authenticated, service_role;
-- <<< MG15 backup (fim)

-- >>> MG15 funções (início)
-- ── 2a. O critério "vazia", escrito uma vez ─────────────────────────────────
-- O mesmo de yt_own_daily_apply (MG14): views = 0 MEDIDO (nulo não é zero) e as outras oito contagens zero ou nulas.
create or replace function public.yt_own_daily_linha_vazia(d public.yt_own_video_daily)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select d.views is not null and d.views = 0
     and coalesce(d.engaged_views, 0) = 0 and coalesce(d.watch_time_minutes, 0) = 0
     and coalesce(d.likes, 0) = 0 and coalesce(d.comments, 0) = 0 and coalesce(d.shares, 0) = 0
     and coalesce(d.subscribers_gained, 0) = 0 and coalesce(d.subscribers_lost, 0) = 0
     and coalesce(d.card_impressions, 0) = 0
$$;

-- ── 2b. As contas de um site (só lê) ────────────────────────────────────────
create or replace function public.yt_own_daily_diet_p3_contas(p_site uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    't', count(*),
    'a', count(*) filter (where x.ativa),
    'vazias', count(*) filter (where x.vazia),
    'dentro_da_base', count(*) filter (where x.na_base),
    'somas', jsonb_build_object(
      'views', coalesce(sum(x.views), 0), 'engaged_views', coalesce(sum(x.engaged_views), 0),
      'watch_time_minutes', coalesce(sum(x.watch_time_minutes), 0), 'likes', coalesce(sum(x.likes), 0),
      'comments', coalesce(sum(x.comments), 0), 'shares', coalesce(sum(x.shares), 0),
      'subscribers_gained', coalesce(sum(x.subscribers_gained), 0),
      'subscribers_lost', coalesce(sum(x.subscribers_lost), 0),
      'card_impressions', coalesce(sum(x.card_impressions), 0)),
    'c_base', (select coalesce(sum(c.covered_to - c.covered_from + 1), 0)
                 from public.yt_own_video_coverage c
                where c.site_id = p_site and c.metric_set = 'base'))
  from (
    select d.views, d.engaged_views, d.watch_time_minutes, d.likes, d.comments, d.shares,
           d.subscribers_gained, d.subscribers_lost, d.card_impressions,
           public.yt_own_daily_linha_vazia(d) as vazia,
           (coalesce(d.views, 0) <> 0 or coalesce(d.engaged_views, 0) <> 0 or coalesce(d.watch_time_minutes, 0) <> 0
            or coalesce(d.likes, 0) <> 0 or coalesce(d.comments, 0) <> 0 or coalesce(d.shares, 0) <> 0
            or coalesce(d.subscribers_gained, 0) <> 0 or coalesce(d.subscribers_lost, 0) <> 0
            or coalesce(d.card_impressions, 0) <> 0) as ativa,
           exists (select 1 from public.yt_own_video_coverage c
                    where c.site_id = p_site and c.youtube_video_id = d.youtube_video_id and c.metric_set = 'base'
                      and d.day_pt between c.covered_from and c.covered_to) as na_base
      from public.yt_own_video_daily d
     where d.site_id = p_site
  ) x
$$;

-- ── 2c. Guardas, trava, apagamento com cópia, contas de novo ────────────────
-- p_agora existe para o teste escolher a hora e o dia; a migration passa now().
create or replace function public.yt_own_daily_diet_p3(p_site uuid, p_agora timestamptz)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_hora time;
  v_hoje date;
  v_dias integer; v_limpas integer; v_ultima timestamptz; v_primeiro date; v_ultimo date;
  v_videos bigint; v_em_dia bigint;
  v_antes jsonb; v_depois jsonb;
  v_vazias bigint; v_com_media bigint; v_fora_base bigint; v_fora_est bigint; v_apagadas bigint; v_guardadas bigint;
begin
  if p_site is null or p_agora is null then
    raise exception 'yt_own_daily_diet_p3: p_site e p_agora são obrigatórios' using errcode = '22023';
  end if;
  v_hora := (p_agora at time zone 'utc')::time;
  v_hoje := (p_agora at time zone 'utc')::date;

  -- (1) Sem linha vazia neste site não há o que apagar, e nenhuma guarda é exigida (banco novo, segunda aplicação).
  if not exists (select 1 from public.yt_own_video_daily d
                  where d.site_id = p_site and public.yt_own_daily_linha_vazia(d)) then
    return jsonb_build_object('site', p_site, 'estado', 'nada_a_apagar', 'apagadas', 0,
                              'linhas', (select count(*) from public.yt_own_video_daily d where d.site_id = p_site));
  end if;

  -- (2) A janela do cron das 12:00 UTC.
  if v_hora >= time '11:30' and v_hora < time '13:00' then
    raise exception 'MG15 recusada: entre 11:30 e 13:00 UTC o cron do canal próprio grava no diário (agora % UTC). Rodar fora dessa janela', v_hora;
  end if;

  -- (2b) (emenda 1: S-I-2) O ritual do CSV foi feito HOJE: o dono grava a marca no comentário do diário no passo 3.
  -- Sem isto, um arquivo que ficou pendente (recusa de outro dia) seria aplicado pelo db push de outro lote.
  if coalesce(pg_catalog.obj_description('public.yt_own_video_daily'::regclass, 'pg_class'), '')
       not like '%P3 armada em ' || to_char(v_hoje, 'YYYY-MM-DD') || '%' then
    raise exception 'MG15 recusada: o ritual do CSV não foi feito hoje (o comentário de public.yt_own_video_daily não traz "P3 armada em %"). Tirar o CSV e gravar a marca antes de aplicar',
      to_char(v_hoje, 'YYYY-MM-DD');
  end if;

  -- (3) Três execuções limpas do diário, em três dias seguidos, a última há menos de 36 horas.
  -- (emenda 1: D-I-1, S-I-1) Limpa = o coletor novo rodou (resumo.diario.apagadas é número) E COLETOU: nada ficou
  -- pendente, a função gravou cobertura (intervalos >= 1), houve tentativa ok, nenhuma tentativa de falha, nenhum
  -- vídeo atrasado antigo, estendidas não recusadas; e nenhuma nota do diário, da cobertura nem de leitura de
  -- youtube_videos ficou em falhas. apagadas sozinho não prova nada: nasce em 0 em toda saída do passo.
  -- Campo ausente ou em outro formato = não limpa (nunca erro de conversão). Vale a última execução de cada dia (UTC).
  with por_dia as (
    select distinct on ((r.ran_at at time zone 'utc')::date)
           (r.ran_at at time zone 'utc')::date as dia, r.ran_at,
           (coalesce(jsonb_typeof(j.d->'apagadas') = 'number', false)
            and coalesce(j.d->'pendentes' = '0'::jsonb, false)
            and coalesce(j.d->'atrasados_antigos' = '0'::jsonb, false)
            and coalesce(j.d->'estendidas_recusadas' = '0'::jsonb, false)
            and coalesce(case when jsonb_typeof(j.d->'intervalos') = 'number'
                              then (j.d->>'intervalos')::numeric >= 1 end, false)
            and coalesce(case when jsonb_typeof(j.d->'tentativas'->'ok') = 'number'
                              then (j.d->'tentativas'->>'ok')::numeric >= 1 end, false)
            and coalesce(jsonb_typeof(j.d->'tentativas') = 'object', false)
            and not exists (select 1 from jsonb_object_keys(case when jsonb_typeof(j.d->'tentativas') = 'object'
                                                                 then j.d->'tentativas' else '{}'::jsonb end) k
                             where k not in ('ok', 'sem_dado_na_janela', 'video_novo'))
            and not exists (select 1 from unnest(r.falhas) as f
                             where f like 'diário:%' or f like 'diario:%'
                                or f like '%yt_own_video_coverage%' or f like '%yt_own_daily_apply%'
                                or f like '%cobertura%' or f like '%youtube_videos%')) as limpa
      from public.yt_own_collection_runs r
     cross join lateral (select r.resumo->'diario' as d) j
     where r.ran_at <= p_agora and r.ran_at > p_agora - interval '10 days'
     order by (r.ran_at at time zone 'utc')::date desc, r.ran_at desc
  ), ultimas as (
    select p.dia, p.ran_at, p.limpa from por_dia p order by p.dia desc limit 3
  )
  select count(*), count(*) filter (where u.limpa), max(u.ran_at), min(u.dia), max(u.dia)
    into v_dias, v_limpas, v_ultima, v_primeiro, v_ultimo
    from ultimas u;
  if v_dias < 3 or v_limpas < 3 or (v_ultimo - v_primeiro) <> 2 or v_ultima <= p_agora - interval '36 hours' then
    raise exception 'MG15 recusada: preciso de 3 execuções limpas do diário em 3 dias seguidos, a última há menos de 36 horas (achei % dia(s), % limpa(s), de % a %, a última em %)',
      v_dias, v_limpas, v_primeiro, v_ultimo, v_ultima;
  end if;

  -- (4) A coleta nova está viva para ESTE site: algum vídeo dele com cobertura base até hoje − 5 (UTC),
  -- gravada nas últimas 36 horas. (emenda 1: S-I-1) A carga da MG14 grava collected_at uma vez só; quem renova
  -- é yt_own_daily_apply. Cobertura em dia com collected_at antigo = a função nova nunca gravou para este site.
  -- (emenda 1: D-M-9) hoje − 5 em UTC é de propósito um dia mais folgado que a CP4 do portão (current_date − 4).
  select count(*),
         count(*) filter (where exists (select 1 from public.yt_own_video_coverage c
                                         where c.site_id = p_site and c.youtube_video_id = v.youtube_video_id
                                           and c.metric_set = 'base' and c.covered_to >= v_hoje - 5
                                           and c.collected_at > p_agora - interval '36 hours'))
    into v_videos, v_em_dia
    from public.youtube_videos v
   where v.site_id = p_site;
  if v_em_dia = 0 then
    raise exception 'MG15 recusada: nenhum vídeo do site % com cobertura em dia e gravada nas últimas 36 horas (% vídeo(s) cadastrado(s)). A coleta nova está rodando?', p_site, v_videos;
  end if;

  -- (5) Ninguém grava no diário enquanto as contas são feitas. Quem lê não espera.
  lock table public.yt_own_video_daily in share row exclusive mode;

  v_antes := public.yt_own_daily_diet_p3_contas(p_site);

  -- (6) Apaga e copia NA MESMA INSTRUÇÃO: só entra no backup o que saiu, e só sai o que entra no backup.
  -- A linha sai se: é vazia; não tem média nem taxa; o dia está na cobertura base do vídeo, neste site;
  -- e as estendidas ou nunca foram medidas ou o dia está na cobertura estendidas.
  with vazias as materialized (
    select d.youtube_video_id, d.day_pt,
           -- >>> MG15 regra 2 (início)  (emenda 1: D-I-2: texto padrão; a variante Z está logo abaixo do bloco)
           (d.avg_view_duration_seconds is not null or d.avg_view_percentage is not null
            or d.card_click_rate is not null) as com_media,
           -- <<< MG15 regra 2 (fim)
           exists (select 1 from public.yt_own_video_coverage c
                    where c.site_id = p_site and c.youtube_video_id = d.youtube_video_id and c.metric_set = 'base'
                      and d.day_pt between c.covered_from and c.covered_to) as na_base,
           ((d.engaged_views is null and d.card_impressions is null)
            or exists (select 1 from public.yt_own_video_coverage c
                        where c.site_id = p_site and c.youtube_video_id = d.youtube_video_id
                          and c.metric_set = 'estendidas'
                          and d.day_pt between c.covered_from and c.covered_to)) as est_ok
      from public.yt_own_video_daily d
     where d.site_id = p_site and public.yt_own_daily_linha_vazia(d)
  ), sai as (
    delete from public.yt_own_video_daily d
     using vazias v
     where d.youtube_video_id = v.youtube_video_id and d.day_pt = v.day_pt
       and d.site_id = p_site
       and v.na_base and not v.com_media and v.est_ok
    returning d.youtube_video_id, d.day_pt, d.site_id, d.video_id, d.channel_id,
              d.views, d.engaged_views, d.watch_time_minutes, d.avg_view_duration_seconds, d.avg_view_percentage,
              d.likes, d.comments, d.shares, d.subscribers_gained, d.subscribers_lost,
              d.card_impressions, d.card_click_rate, d.source, d.collected_at, d.metric_version
  ), guardado as (
    insert into public.yt_own_video_daily_zeros_bkp as b
      (youtube_video_id, day_pt, site_id, video_id, channel_id,
       views, engaged_views, watch_time_minutes, avg_view_duration_seconds, avg_view_percentage,
       likes, comments, shares, subscribers_gained, subscribers_lost,
       card_impressions, card_click_rate, source, collected_at, metric_version)
    select s.youtube_video_id, s.day_pt, s.site_id, s.video_id, s.channel_id,
           s.views, s.engaged_views, s.watch_time_minutes, s.avg_view_duration_seconds, s.avg_view_percentage,
           s.likes, s.comments, s.shares, s.subscribers_gained, s.subscribers_lost,
           s.card_impressions, s.card_click_rate, s.source, s.collected_at, s.metric_version
      from sai s
    on conflict (youtube_video_id, day_pt) do update set
      site_id = excluded.site_id, video_id = excluded.video_id, channel_id = excluded.channel_id,
      views = excluded.views, engaged_views = excluded.engaged_views,
      watch_time_minutes = excluded.watch_time_minutes,
      avg_view_duration_seconds = excluded.avg_view_duration_seconds,
      avg_view_percentage = excluded.avg_view_percentage,
      likes = excluded.likes, comments = excluded.comments, shares = excluded.shares,
      subscribers_gained = excluded.subscribers_gained, subscribers_lost = excluded.subscribers_lost,
      card_impressions = excluded.card_impressions, card_click_rate = excluded.card_click_rate,
      source = excluded.source, collected_at = excluded.collected_at, metric_version = excluded.metric_version
    returning 1
  )
  select (select count(*) from vazias),
         (select count(*) from vazias z where z.com_media),
         (select count(*) from vazias z where not z.na_base),
         (select count(*) from vazias z where z.na_base and not z.com_media and not z.est_ok),
         (select count(*) from sai),
         (select count(*) from guardado)
    into v_vazias, v_com_media, v_fora_base, v_fora_est, v_apagadas, v_guardadas;

  -- (7) Linha vazia fora da cobertura base é estado desconhecido da P2: desfaz tudo.
  if v_fora_base > 0 then
    raise exception 'MG15 desfeita: % linha(s) vazia(s) fora da cobertura base no site %. Nada foi apagado', v_fora_base, p_site;
  end if;

  -- (8) As contas de depois têm de fechar com as de antes.
  v_depois := public.yt_own_daily_diet_p3_contas(p_site);
  if v_guardadas <> v_apagadas
     or v_vazias <> (v_antes->>'vazias')::bigint
     or (v_depois->>'t')::bigint <> (v_antes->>'t')::bigint - v_apagadas
     or (v_depois->>'a')::bigint <> (v_antes->>'a')::bigint
     or (v_depois->>'vazias')::bigint <> (v_antes->>'vazias')::bigint - v_apagadas
     or (v_depois->>'dentro_da_base')::bigint <> (v_antes->>'dentro_da_base')::bigint - v_apagadas
     or (v_depois->>'c_base')::bigint <> (v_antes->>'c_base')::bigint
     or (v_depois->'somas') <> (v_antes->'somas') then
    raise exception 'MG15 desfeita: as contas não fecham (apagadas %, guardadas %, vazias %; antes %; depois %). Nada foi apagado',
      v_apagadas, v_guardadas, v_vazias, v_antes, v_depois;
  end if;

  return jsonb_build_object(
    'site', p_site, 'estado', case when v_apagadas > 0 then 'apagado' else 'nada_apagado' end,
    'agora', p_agora, 'ultima_execucao', v_ultima, 'videos', v_videos, 'videos_em_dia', v_em_dia,
    'vazias', v_vazias, 'apagadas', v_apagadas,
    'ficaram_com_media', v_com_media, 'ficaram_fora_das_estendidas', v_fora_est,
    'antes', v_antes, 'depois', v_depois);
end $$;

revoke all on function public.yt_own_daily_linha_vazia(public.yt_own_video_daily) from public, anon, authenticated, service_role;
revoke all on function public.yt_own_daily_diet_p3_contas(uuid) from public, anon, authenticated, service_role;
revoke all on function public.yt_own_daily_diet_p3(uuid, timestamptz) from public, anon, authenticated, service_role;
-- <<< MG15 funções (fim)

-- ── 3. O apagamento: UMA instrução, tudo ou nada ────────────────────────────
do $$
declare
  v_site uuid;
  v_r jsonb;
  v_tudo jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_sites integer := 0;
begin
  for v_site in select distinct d.site_id from public.yt_own_video_daily d order by 1 loop
    v_sites := v_sites + 1;
    v_r := public.yt_own_daily_diet_p3(v_site, now());
    v_tudo := v_tudo || jsonb_build_array(v_r);
    v_total := v_total + (v_r->>'apagadas')::bigint;
    raise notice 'MG15: %', v_r;
  end loop;
  if v_sites = 0 then
    raise notice 'MG15: diário sem linhas, nada a fazer';
  end if;
  if v_total > 0 then
    execute format('comment on table public.yt_own_video_daily_zeros_bkp is %L',
      'MG15 ' || to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || ' ' || v_tudo::text);
  end if;
end $$;

-- ── 4. Nada que apaga fica no banco ─────────────────────────────────────────
drop function if exists public.yt_own_daily_diet_p3(uuid, timestamptz);
drop function if exists public.yt_own_daily_diet_p3_contas(uuid);
drop function if exists public.yt_own_daily_linha_vazia(public.yt_own_video_daily);

analyze public.yt_own_video_daily;
-- O vacuum full NÃO vai aqui (não roda dentro de transação): é o passo 7 do ritual, do dono.
