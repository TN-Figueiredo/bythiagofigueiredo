-- =============================================================================
-- MIGRATION MG17: Observatório A5, E18 parte 2 (dieta de yt_own_video_meta_daily), parte DESTRUTIVA
-- Spec: docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md, seção 7.5.10; item 202
-- Plano: docs/superpowers/plans/2026-10-13-a5-e6-p4-e-e18-parte-2-dieta-final-plan.md
--
-- APAGA LINHA, e liga o enxugamento diário. Vai sozinha, com o dono, depois de 14 execuções limpas.
-- Fora de 11:30 a 13:00 UTC. O vacuum full, se houver, é um comando à parte.
--
-- O que faz:
--   0. Recusa sem a MG17a, sem a MG12, ou se a tabela não tiver as colunas esperadas.
--   1. yt_own_meta_linhas_do_meio: o critério, escrito uma vez. Fica no banco (o passo de metadados o usa).
--   2. Duas funções auxiliares (contas; guardas e apagamento), sem execute para ninguém.
--   3. UMA instrução: para cada site, apaga as linhas do meio e confere as contas de antes e de depois; e SÓ SE
--      todos fecharem troca o corpo de yt_own_meta_cover pelo que também enxuga. Qualquer prova que falhe desfaz
--      tudo, inclusive a troca: a compactação nunca fica ligada sem o apagamento ter fechado.
--   4. Apaga as duas auxiliares.
-- (emenda 1: D-I-1) Tabela sem linhas (banco novo, CI): não apaga, não exige nada, e instala o corpo novo.
-- Site com linhas e enxugamento ainda desligado: TODAS as guardas, mesmo sem linha do meio (é esta migration que
-- liga o apagamento diário). Site sem linha do meio e enxugamento já ligado (segunda aplicação): nada a fazer.
-- A marca do dia vai no comentário da tabela (o dono a põe no passo do CSV).
-- =============================================================================
set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- 0. Recusas de entrada
do $$
declare v_cols text;
begin
  if to_regprocedure('public.yt_own_meta_cover(uuid,uuid,date,boolean)') is null
     or to_regprocedure('public.yt_own_meta_prova(uuid,uuid,date)') is null
     or to_regprocedure('public.yt_own_meta_cover_set(text,text,date[],uuid,uuid,uuid,timestamptz)') is null then
    raise exception 'MG17 depende da MG17a: as funções de cobertura de metadados não existem';
  end if;
  if to_regclass('public.yt_own_versions_state') is null or to_regclass('public.yt_own_video_versions') is null then
    raise exception 'MG17 depende da MG12: public.yt_own_versions_state ou public.yt_own_video_versions não existe';
  end if;
  select string_agg(a.attname::text, ',' order by a.attname) into v_cols
    from pg_catalog.pg_attribute a
   where a.attrelid = 'public.yt_own_video_meta_daily'::regclass and a.attnum > 0 and not a.attisdropped;
  if v_cols is distinct from 'ab_test_id,ab_variant_id,captured_at,channel_id,day_pt,description_sha256,description_text,duration_seconds,is_short,privacy_status,seconds_on_air_analytics,seconds_on_air_reporting,seconds_other_analytics,seconds_other_reporting,site_id,tags,tags_sha256,thumbnail_blob_url,thumbnail_dhash,thumbnail_sha256,thumbnail_sha256_at_capture,title,title_at_capture,video_id,youtube_video_id' then
    raise exception 'MG17: yt_own_video_meta_daily mudou de forma (colunas: %). Rever o critério e as voltas antes de apagar', v_cols;
  end if;
end $$;

-- >>> MG17 yt_own_meta_linhas_do_meio (início)
-- 1. O critério. Devolve as linhas do canal que são IDÊNTICAS às duas vizinhas do mesmo vídeo (todas as colunas,
-- menos o dia e o instante da captura), que têm captura, e cuja vizinha de depois é de dia anterior a p_day
-- (a linha do dia ainda pode ser completada por uma segunda execução; as anteriores não mudam mais).
--   coberta:  o dia está em meta_texto e, se a linha tem dHash, em meta_thumb (mesmo site, mesmo vídeo).
--   derivada: o passo de versões já derivou o dia (derived_through do canal).
-- Só sai linha com as duas verdadeiras.
-- (emenda 1: D-I-2) Linha de dia de teste A/B (ab_test_id não nulo) nunca é devolvida.
-- (emenda 1: D-m-3) Linha que é fronteira de versão (first_day_pt de versão fora do pré-registro, ou last_day_pt de
-- versão não corrente) nunca é devolvida.
create or replace function public.yt_own_meta_linhas_do_meio(p_site_id uuid, p_channel_id uuid, p_day date)
returns table (youtube_video_id text, day_pt date, tem_dhash boolean, coberta boolean, derivada boolean)
language sql stable security invoker set search_path = ''
as $$
  with l as (
    select m.youtube_video_id, m.day_pt, m.channel_id, m.privacy_status, m.thumbnail_dhash, m.ab_test_id,
           (to_jsonb(m) - 'day_pt' - 'captured_at') as t,
           lag(to_jsonb(m) - 'day_pt' - 'captured_at') over w as t_ant,
           lead(to_jsonb(m) - 'day_pt' - 'captured_at') over w as t_seg,
           lead(m.day_pt) over w as dia_seg
      from public.yt_own_video_meta_daily m
     where m.site_id = p_site_id
    window w as (partition by m.youtube_video_id order by m.day_pt)
  )
  select l.youtube_video_id, l.day_pt, (l.thumbnail_dhash is not null),
         (exists (select 1 from public.yt_own_video_coverage c
                   where c.site_id = p_site_id and c.youtube_video_id = l.youtube_video_id
                     and c.metric_set = 'meta_texto' and l.day_pt between c.covered_from and c.covered_to)
          and (l.thumbnail_dhash is null
               or exists (select 1 from public.yt_own_video_coverage c
                           where c.site_id = p_site_id and c.youtube_video_id = l.youtube_video_id
                             and c.metric_set = 'meta_thumb' and l.day_pt between c.covered_from and c.covered_to))),
         exists (select 1 from public.yt_own_versions_state s
                  where s.channel_id = p_channel_id and s.site_id = p_site_id and l.day_pt <= s.derived_through)
    from l
   where l.channel_id = p_channel_id
     and l.privacy_status is not null
     and l.t_ant is not null and l.t_seg is not null
     and l.t = l.t_ant and l.t_seg = l.t
     and l.dia_seg < p_day
     and l.ab_test_id is null
     and not exists (select 1 from public.yt_own_video_versions v
                      where v.site_id = p_site_id and v.youtube_video_id = l.youtube_video_id and not v.pre_registro
                        and (v.first_day_pt = l.day_pt or (not v.is_current and v.last_day_pt = l.day_pt)))
$$;
revoke all on function public.yt_own_meta_linhas_do_meio(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.yt_own_meta_linhas_do_meio(uuid, uuid, date) to service_role;
-- <<< MG17 yt_own_meta_linhas_do_meio (fim)

-- >>> MG17 auxiliares (início)
-- 2a. As contas de um site (só lê). Para cada canal, "o dia gravado" é a última linha dele.
create or replace function public.yt_own_meta_diet_contas(p_site uuid)
returns jsonb
language sql stable set search_path = ''
as $$
  with linhas as (
    select m.youtube_video_id, m.day_pt, m.channel_id, m.privacy_status, m.thumbnail_dhash, m.description_text,
           m.ab_test_id, m.captured_at, (to_jsonb(m) - 'day_pt' - 'captured_at') as t
      from public.yt_own_video_meta_daily m
     where m.site_id = p_site
  ), marcadas as (
    select l.*, case when l.t is distinct from lag(l.t) over (partition by l.youtube_video_id order by l.day_pt)
                     then 1 else 0 end as nova
      from linhas l
  ), numeradas as (
    select x.*, sum(x.nova) over (partition by x.youtube_video_id order by x.day_pt) as seq from marcadas x
  ), sequencias as (
    select s.youtube_video_id, s.seq, min(s.day_pt) as de, max(s.day_pt) as ate, md5(min(s.t::text)) as conteudo,
           (array_agg(s.captured_at order by s.day_pt))[1] as cap_de,
           (array_agg(s.captured_at order by s.day_pt desc))[1] as cap_ate
      from numeradas s
     group by s.youtube_video_id, s.seq
  ), situacao as (
    select distinct on (l.youtube_video_id) l.youtube_video_id, l.day_pt, l.privacy_status
      from linhas l
     where l.privacy_status is not null
     order by l.youtube_video_id, l.day_pt desc
  ), canais as (
    select l.channel_id, max(l.day_pt) as ate from linhas l group by l.channel_id
  ), meio as (
    select x.tem_dhash, x.coberta, x.derivada
      from canais c
     cross join lateral public.yt_own_meta_linhas_do_meio(p_site, c.channel_id, c.ate) x
  ), provas as (
    select public.yt_own_meta_prova(p_site, c.channel_id, c.ate) as p from canais c
  )
  select jsonb_build_object(
    't', (select count(*) from linhas),
    'videos', (select count(distinct l.youtube_video_id) from linhas l),
    'canais', (select count(*) from canais),
    'ate', (select max(c.ate) from canais c),
    'com_texto', (select count(*) from linhas l where l.privacy_status is not null),
    'com_thumb', (select count(*) from linhas l where l.thumbnail_dhash is not null),
    'sem_privacidade', (select count(*) from linhas l where l.privacy_status is null),
    'com_descricao', (select count(*) from linhas l where l.description_text is not null),
    'com_teste', (select count(*) from linhas l where l.ab_test_id is not null),
    'c_texto', (select coalesce(sum(c.covered_to - c.covered_from + 1), 0) from public.yt_own_video_coverage c
                 where c.site_id = p_site and c.metric_set = 'meta_texto'),
    'c_thumb', (select coalesce(sum(c.covered_to - c.covered_from + 1), 0) from public.yt_own_video_coverage c
                 where c.site_id = p_site and c.metric_set = 'meta_thumb'),
    'sequencias', (select count(*) from sequencias),
    'retrato_sequencias', (select md5(coalesce(string_agg(
        q.youtube_video_id || '|' || to_char(q.de, 'YYYY-MM-DD') || '|' || to_char(q.ate, 'YYYY-MM-DD') || '|' || q.conteudo
        || '|' || to_char(q.cap_de at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US')
        || '|' || to_char(q.cap_ate at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
        ',' order by q.youtube_video_id, q.de), '')) from sequencias q),
    'retrato_situacao', (select md5(coalesce(string_agg(
        s.youtube_video_id || '|' || to_char(s.day_pt, 'YYYY-MM-DD') || '|' || s.privacy_status,
        ',' order by s.youtube_video_id), '')) from situacao s),
    'do_meio', (select count(*) from meio),
    'candidatas', (select count(*) from meio x where x.coberta and x.derivada),
    'candidatas_com_dhash', (select count(*) from meio x where x.coberta and x.derivada and x.tem_dhash),
    'do_meio_sem_cobertura', (select count(*) from meio x where not x.coberta),
    'do_meio_sem_derivacao', (select count(*) from meio x where not x.derivada),
    'descobertas', (select coalesce(sum((y.p->>'descobertas')::bigint), 0) from provas y),
    'sem_explicacao', (select coalesce(sum((y.p->>'sem_explicacao')::bigint), 0) from provas y),
    'versoes_sem_linha', (select count(*) from public.yt_own_video_versions v
                           where v.site_id = p_site and not v.pre_registro
                             and (not exists (select 1 from public.yt_own_video_meta_daily m
                                               where m.site_id = p_site and m.youtube_video_id = v.youtube_video_id and m.day_pt = v.first_day_pt)
                                  or (not v.is_current
                                      and not exists (select 1 from public.yt_own_video_meta_daily m
                                                       where m.site_id = p_site and m.youtube_video_id = v.youtube_video_id and m.day_pt = v.last_day_pt)))))
$$;

-- 2b. Guardas, trava, apagamento, contas de novo.
-- p_agora existe para o teste escolher a hora e o dia; a migration passa now().
create or replace function public.yt_own_meta_diet(p_site uuid, p_agora timestamptz)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_hora time;
  v_hoje date;
  v_hoje_pt date;
  v_ultimo date;
  v_dias integer; v_limpas integer; v_ultima timestamptz; v_primeiro_dia date; v_ultimo_dia date;
  v_antes jsonb; v_depois jsonb;
  v_apagadas bigint := 0;
  v_n bigint;
  v_ligada boolean;
  v_sujos text;
  c record;
begin
  if p_site is null or p_agora is null then
    raise exception 'yt_own_meta_diet: p_site e p_agora são obrigatórios' using errcode = '22023';
  end if;
  v_hora := (p_agora at time zone 'utc')::time;
  v_hoje := (p_agora at time zone 'utc')::date;
  v_hoje_pt := (p_agora at time zone 'America/Los_Angeles')::date;

  -- (0) Cobre o que faltar, sem apagar: toda linha com captura entra na cobertura antes de qualquer conta.
  for c in
    select m.channel_id, max(m.day_pt) as ate
      from public.yt_own_video_meta_daily m where m.site_id = p_site
     group by m.channel_id order by 1
  loop
    begin
      perform public.yt_own_meta_cover(p_site, c.channel_id, c.ate, false);
    exception when raise_exception then
      raise exception 'MG17 recusada: a cobertura do canal % não pôde ser gravada (%). Nada foi apagado', c.channel_id, sqlerrm;
    end;
  end loop;

  v_antes := public.yt_own_meta_diet_contas(p_site);

  -- (1) (emenda 1: D-I-1, S-m-1) Só dois casos saem sem guarda: site sem NENHUMA linha (banco novo, CI), e site sem
  -- linha do meio em que o enxugamento JÁ está ligado (segunda aplicação: não há o que apagar nem o que ligar).
  -- Site com linhas e enxugamento ainda desligado passa por TODAS as guardas, mesmo sem linha do meio: é esta
  -- migration que liga o apagamento diário, e ela não o liga sem a marca, os 14 dias limpos e as provas.
  select exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'yt_own_meta_cover'
                    and p.prosrc like '%yt_own_meta_linhas_do_meio%') into v_ligada;
  if (v_antes->>'t')::bigint = 0 then
    return jsonb_build_object('site', p_site, 'estado', 'nada_a_apagar', 'motivo', 'sem_linhas', 'guardas', false,
                              'apagadas', 0, 'linhas', 0);
  end if;
  if (v_antes->>'do_meio')::bigint = 0 and v_ligada then
    return jsonb_build_object('site', p_site, 'estado', 'nada_a_apagar', 'motivo', 'ja_ligada', 'guardas', false,
                              'apagadas', 0, 'linhas', v_antes->'t');
  end if;

  -- (2) A janela do cron das 12:00 UTC.
  if v_hora >= time '11:30' and v_hora < time '13:00' then
    raise exception 'MG17 recusada: entre 11:30 e 13:00 UTC o cron do canal próprio grava em yt_own_video_meta_daily (agora % UTC). Rodar fora dessa janela', v_hora;
  end if;

  -- (2b) O ritual do CSV foi feito HOJE: o dono grava a marca no comentário da tabela.
  if coalesce(pg_catalog.obj_description('public.yt_own_video_meta_daily'::regclass, 'pg_class'), '')
       not like '%E18P2 armada em ' || to_char(v_hoje, 'YYYY-MM-DD') || '%' then
    raise exception 'MG17 recusada: o ritual do CSV não foi feito hoje (o comentário de public.yt_own_video_meta_daily não traz "E18P2 armada em %"). Tirar o CSV e gravar a marca antes de aplicar',
      to_char(v_hoje, 'YYYY-MM-DD');
  end if;

  -- (3) A coleta de metadados está em dia.
  v_ultimo := (v_antes->>'ate')::date;
  if v_ultimo is null or v_ultimo < v_hoje_pt - 2 then
    raise exception 'MG17 recusada: a última linha de metadados do site é de % (a coleta parou?)', v_ultimo;
  end if;

  -- (4) (emenda 1: D-I-3, S-I-2, D-m-8) 14 dias limpos seguidos, com a última execução há menos de 24 horas.
  -- base = o passo de metadados COLETOU (gravou linha, nada pendente, tentativa ok, nenhuma falta de autorização,
  -- de conexão, de tempo ou de schema, nenhum canal com dia sem linha), a cobertura GRAVOU em todos os canais
  -- (nenhuma linha fora dela, nenhum dia sem explicação), o passo de versões rodou sem atraso, e nenhuma nota de
  -- metadados, de cobertura nem de versões ficou em falhas. Campo ausente ou em outro formato = falso (nunca erro
  -- de conversão).
  -- confirmou = o passo de versões confirmou ao menos uma versão. sem_dia_novo = ele não tinha dia a derivar
  -- (reexecução do cron no mesmo dia).
  -- O DIA é limpo quando alguma execução dele tem base e confirmou, e nenhuma execução dele é suja. A reexecução
  -- sem dia novo (base, sem confirmar) não limpa o dia sozinha e não o suja.
  with execucoes as (
    select (r.ran_at at time zone 'utc')::date as dia, r.ran_at,
           -- >>> MG17 limpa (início)
           (coalesce(case when jsonb_typeof(j.m->'gravados') = 'number' then (j.m->>'gravados')::numeric >= 1 end, false)
            and coalesce(j.m->'pendentes' = '0'::jsonb, false)
            and coalesce(case when jsonb_typeof(j.m->'tentativas'->'ok') = 'number'
                              then (j.m->'tentativas'->>'ok')::numeric >= 1 end, false)
            and not coalesce(j.m->'tentativas' ?| array['sem_autorizacao', 'sem_conexao', 'nao_alcancado_orcamento', 'schema_ausente'], true)
            and coalesce(jsonb_typeof(j.m->'dias_sem_meta') = 'object', false)
            and coalesce(j.m->'dias_sem_meta' <> '{}'::jsonb, false)
            and not exists (select 1 from jsonb_each(case when jsonb_typeof(j.m->'dias_sem_meta') = 'object'
                                                          then j.m->'dias_sem_meta' else '{}'::jsonb end) as e
                             where e.value <> '0'::jsonb)
            and coalesce(case when jsonb_typeof(j.k->'canais') = 'number' then (j.k->>'canais')::numeric >= 1 end, false)
            and coalesce(j.k->'ok' = j.k->'canais', false)
            and coalesce(j.k->'falhas' = '0'::jsonb, false)
            and coalesce(j.k->'sem_tempo' = 'false'::jsonb, false)
            and coalesce(j.k->'descobertas' = '0'::jsonb, false)
            and coalesce(j.k->'sem_explicacao' = '0'::jsonb, false)
            and coalesce(jsonb_typeof(j.v) = 'object', false)
            and not coalesce(j.v->'desligado' = 'true'::jsonb, false)
            and coalesce(j.v->'sem_tempo' = 'false'::jsonb, false)
            and coalesce(jsonb_typeof(j.v->'atraso_dias') = 'object', false)
            and coalesce(j.v->'atraso_dias' <> '{}'::jsonb, false)
            and not exists (select 1 from jsonb_each(case when jsonb_typeof(j.v->'atraso_dias') = 'object'
                                                          then j.v->'atraso_dias' else '{}'::jsonb end) as e
                             where e.value <> '0'::jsonb)
            and coalesce(j.v->'recuperando', '{}'::jsonb) = '{}'::jsonb
            and coalesce(j.v->'atraso_desconhecido', '[]'::jsonb) = '[]'::jsonb
            and coalesce(j.v->'dia_sem_resposta', '[]'::jsonb) = '[]'::jsonb
            and not exists (select 1 from unnest(r.falhas) as f
                             where f like 'metadados:%' or f like 'versões:%' or f like 'versoes:%'
                                or f like '%yt_own_versions%' or f like '%yt_own_video_versions%'
                                or f like '%yt_own_meta_cover%' or f like '%yt_own_video_meta_daily%'
                                or f like '%yt_own_video_coverage%' or f like '%prova das versões%'
                                or f like '%YT_OWN_META_DIETA_OFF%')) as base,
           coalesce(case when jsonb_typeof(j.v->'confirmadas') = 'number'
                         then (j.v->>'confirmadas')::numeric >= 1 end, false) as confirmou,
           coalesce(j.v->'dias_derivados' = '0'::jsonb, false) as sem_dia_novo
           -- <<< MG17 limpa (fim)
      from public.yt_own_collection_runs r
     cross join lateral (select r.resumo->'metadados' as m, r.resumo->'metadados'->'cobertura' as k,
                                r.resumo->'versoes' as v) j
     where r.ran_at > p_agora - interval '20 days' and r.ran_at <= p_agora
       and not (r.resumo ? 'passos')  -- dono 31/10: a entrada parcial (?passos=, 00:07 UTC) nunca roda metadados nem versões: não limpa nem suja
  ), por_dia as (
    select e.dia, max(e.ran_at) as ran_at,
           (bool_or(e.base and e.confirmou) and bool_and(e.base and (e.confirmou or e.sem_dia_novo))) as limpa
      from execucoes e
     group by e.dia
  ), ultimas as (
    select * from por_dia order by dia desc limit 14
  )
  select count(*), count(*) filter (where u.limpa), max(u.ran_at), min(u.dia), max(u.dia),
         string_agg(to_char(u.dia, 'YYYY-MM-DD'), ', ' order by u.dia) filter (where not u.limpa)
    into v_dias, v_limpas, v_ultima, v_primeiro_dia, v_ultimo_dia, v_sujos
    from ultimas u;
  if v_dias < 14 or v_limpas < 14 or v_ultimo_dia - v_primeiro_dia <> 13 or v_ultima < p_agora - interval '24 hours' then
    raise exception 'MG17 recusada: preciso de 14 dias limpos seguidos, com a última execução há menos de 24 horas (achei % dia(s), % limpo(s), de % a %, a última execução em %; dias não limpos: %)',
      v_dias, v_limpas, v_primeiro_dia, v_ultimo_dia, v_ultima, coalesce(v_sujos, 'nenhum');
  end if;

  -- (5) A trava: quem lê não espera; quem grava (o cron) espera.
  lock table public.yt_own_video_meta_daily in share row exclusive mode;
  v_antes := public.yt_own_meta_diet_contas(p_site);

  -- (6) Estado conhecido antes de apagar: cobertura inteira e explicada, versões com a sua linha, e toda linha
  -- do meio coberta e derivada. Qualquer coisa fora disso é recusa, nunca apagamento parcial.
  if (v_antes->>'descobertas')::bigint <> 0 or (v_antes->>'sem_explicacao')::bigint <> 0
     or (v_antes->>'versoes_sem_linha')::bigint <> 0
     or (v_antes->>'do_meio_sem_cobertura')::bigint <> 0 or (v_antes->>'do_meio_sem_derivacao')::bigint <> 0
     or (v_antes->>'candidatas')::bigint <> (v_antes->>'do_meio')::bigint then
    raise exception 'MG17 recusada: estado desconhecido antes de apagar (linhas com captura fora da cobertura: %; dias cobertos sem explicação: %; versões sem a sua linha: %; linhas do meio sem cobertura: %; linhas do meio que o passo de versões ainda não derivou: %). Nada foi apagado',
      v_antes->>'descobertas', v_antes->>'sem_explicacao', v_antes->>'versoes_sem_linha',
      v_antes->>'do_meio_sem_cobertura', v_antes->>'do_meio_sem_derivacao';
  end if;

  -- (6b) (emenda 1: D-I-1) Sem linha do meio e com todas as guardas passadas: nada a apagar, e o enxugamento
  -- diário pode ser ligado pelo bloco que chamou.
  if (v_antes->>'do_meio')::bigint = 0 then
    return jsonb_build_object('site', p_site, 'estado', 'nada_a_apagar', 'motivo', 'sem_linha_do_meio', 'guardas', true,
                              'apagadas', 0, 'linhas', v_antes->'t', 'ultima_execucao', v_ultima);
  end if;

  -- (7) Apaga, canal a canal, pelo critério.
  for c in
    select m.channel_id, max(m.day_pt) as ate
      from public.yt_own_video_meta_daily m where m.site_id = p_site
     group by m.channel_id order by 1
  loop
    delete from public.yt_own_video_meta_daily m
     using public.yt_own_meta_linhas_do_meio(p_site, c.channel_id, c.ate) x
     where x.coberta and x.derivada
       and m.youtube_video_id = x.youtube_video_id and m.day_pt = x.day_pt
       and m.site_id = p_site and m.channel_id = c.channel_id;
    get diagnostics v_n = row_count;
    v_apagadas := v_apagadas + v_n;
  end loop;

  -- (8) As contas de depois (M1 a M8 do plano).
  v_depois := public.yt_own_meta_diet_contas(p_site);
  if v_apagadas <> (v_antes->>'candidatas')::bigint
     or (v_depois->>'t')::bigint <> (v_antes->>'t')::bigint - v_apagadas
     or (v_depois->>'do_meio')::bigint <> 0
     or (v_depois->'videos') <> (v_antes->'videos')
     or (v_depois->'sequencias') <> (v_antes->'sequencias')
     or (v_depois->>'retrato_sequencias') <> (v_antes->>'retrato_sequencias')
     or (v_depois->>'retrato_situacao') <> (v_antes->>'retrato_situacao')
     or (v_depois->>'com_texto')::bigint <> (v_antes->>'com_texto')::bigint - v_apagadas
     or (v_depois->>'com_thumb')::bigint <> (v_antes->>'com_thumb')::bigint - (v_antes->>'candidatas_com_dhash')::bigint
     or (v_depois->'sem_privacidade') <> (v_antes->'sem_privacidade')
     or (v_depois->'c_texto') <> (v_antes->'c_texto')
     or (v_depois->'c_thumb') <> (v_antes->'c_thumb')
     or (v_depois->>'descobertas')::bigint <> 0
     or (v_depois->>'sem_explicacao')::bigint <> 0
     or (v_depois->>'versoes_sem_linha')::bigint <> 0 then
    raise exception 'MG17 desfeita: as contas não fecham (apagadas %; antes %; depois %). Nada foi apagado',
      v_apagadas, v_antes, v_depois;
  end if;

  return jsonb_build_object('site', p_site, 'estado', 'apagado', 'agora', p_agora, 'ultima_execucao', v_ultima,
                            'apagadas', v_apagadas, 'antes', v_antes, 'depois', v_depois);
end $$;

revoke all on function public.yt_own_meta_diet_contas(uuid) from public, anon, authenticated, service_role;
revoke all on function public.yt_own_meta_diet(uuid, timestamptz) from public, anon, authenticated, service_role;
-- <<< MG17 auxiliares (fim)

-- 3. UMA instrução: apaga, confere e, só então, liga o enxugamento diário.
do $mg17$
declare
  v_site uuid;
  v_r jsonb;
  v_tudo jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_sites integer := 0;
begin
  for v_site in select distinct m.site_id from public.yt_own_video_meta_daily m order by 1 loop
    v_sites := v_sites + 1;
    v_r := public.yt_own_meta_diet(v_site, now());
    v_tudo := v_tudo || jsonb_build_array(v_r);
    v_total := v_total + (v_r->>'apagadas')::bigint;
    raise notice 'MG17: %', v_r;
  end loop;
  if v_sites = 0 then
    raise notice 'MG17: yt_own_video_meta_daily sem linhas, nada a apagar';
  end if;

  -- Chegou aqui: nenhum site recusou. (emenda 1: D-I-1) Todo site com linha passou por todas as guardas, ou já
  -- estava com o enxugamento ligado. A partir de agora o passo de metadados também enxuga.
  -- Mesma assinatura e mesma resposta da MG17a; muda só o trecho entre a cobertura e a prova.
  execute $ddl$
-- >>> MG17 yt_own_meta_cover (início)
create or replace function public.yt_own_meta_cover(
  p_site_id uuid, p_channel_id uuid, p_day date, p_compactar boolean
) returns jsonb
language plpgsql security invoker set search_path = ''
as $fn$
declare
  r record;
  v_texto integer := 0;
  v_thumb integer := 0;
  v_del integer := 0;
  v_estado text;
  v_prova jsonb;
begin
  if p_site_id is null or p_channel_id is null or p_day is null then
    raise exception 'argumento_nulo';
  end if;
  if not exists (select 1 from public.youtube_channels c where c.id = p_channel_id and c.site_id = p_site_id) then
    raise exception 'canal_fora_do_site';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('yt_own_meta_cover:' || p_channel_id::text, 0));

  for r in
    select x.youtube_video_id,
           (array_agg(x.video_id order by x.day_pt desc))[1] as video_uuid,
           max(x.captured_at) as visto,
           array_agg(x.day_pt order by x.day_pt) filter (where x.falta_texto) as dias_texto,
           array_agg(x.day_pt order by x.day_pt) filter (where x.falta_thumb) as dias_thumb
      from (
        select m.youtube_video_id, m.video_id, m.day_pt, m.captured_at,
               (m.privacy_status is not null and not exists (
                  select 1 from public.yt_own_video_coverage c
                   where c.site_id = p_site_id and c.youtube_video_id = m.youtube_video_id
                     and c.metric_set = 'meta_texto' and m.day_pt between c.covered_from and c.covered_to)) as falta_texto,
               (m.thumbnail_dhash is not null and not exists (
                  select 1 from public.yt_own_video_coverage c
                   where c.site_id = p_site_id and c.youtube_video_id = m.youtube_video_id
                     and c.metric_set = 'meta_thumb' and m.day_pt between c.covered_from and c.covered_to)) as falta_thumb
          from public.yt_own_video_meta_daily m
         where m.site_id = p_site_id and m.channel_id = p_channel_id and m.day_pt <= p_day
      ) x
     where x.falta_texto or x.falta_thumb
     group by x.youtube_video_id
  loop
    if r.dias_texto is not null then
      perform public.yt_own_meta_cover_set(r.youtube_video_id, 'meta_texto', r.dias_texto,
                                           p_site_id, p_channel_id, r.video_uuid, r.visto);
      v_texto := v_texto + cardinality(r.dias_texto);
    end if;
    if r.dias_thumb is not null then
      perform public.yt_own_meta_cover_set(r.youtube_video_id, 'meta_thumb', r.dias_thumb,
                                           p_site_id, p_channel_id, r.video_uuid, r.visto);
      v_thumb := v_thumb + cardinality(r.dias_thumb);
    end if;
  end loop;

  -- O enxugamento: só depois de cobrir. Sem estado de versões do canal, nada sai.
  if not coalesce(p_compactar, false) then
    v_estado := 'desligada';
  elsif not exists (select 1 from public.yt_own_versions_state s
                     where s.channel_id = p_channel_id and s.site_id = p_site_id) then
    v_estado := 'sem_estado';
  else
    delete from public.yt_own_video_meta_daily m
     using public.yt_own_meta_linhas_do_meio(p_site_id, p_channel_id, p_day) x
     where x.coberta and x.derivada
       and m.youtube_video_id = x.youtube_video_id and m.day_pt = x.day_pt
       and m.site_id = p_site_id and m.channel_id = p_channel_id;
    get diagnostics v_del = row_count;
    v_estado := 'feita';
  end if;

  v_prova := public.yt_own_meta_prova(p_site_id, p_channel_id, p_day);
  return jsonb_build_object(
    'resultado', 'ok', 'dia', p_day, 'texto', v_texto, 'thumb', v_thumb,
    'linhas', v_prova->'linhas', 'descobertas', v_prova->'descobertas', 'sem_explicacao', v_prova->'sem_explicacao',
    'compactacao', v_estado, 'compactadas', v_del);
end $fn$
-- <<< MG17 yt_own_meta_cover (fim)
  $ddl$;
  execute 'revoke all on function public.yt_own_meta_cover(uuid, uuid, date, boolean) from public, anon, authenticated';
  execute 'grant execute on function public.yt_own_meta_cover(uuid, uuid, date, boolean) to service_role';
  -- marca de que a MG17 rodou até o fim: o roteiro de religar recusa sem ela (revisão N9, Phil I-2)
  execute format('comment on function public.yt_own_meta_linhas_do_meio(uuid, uuid, date) is %L',
    'MG17 aplicada em ' || to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));

  if v_total > 0 then
    execute format('comment on table public.yt_own_video_meta_daily is %L',
      'MG17 ' || to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || ' ' || v_tudo::text);
  end if;
end $mg17$;

-- 4. Nada que apaga em massa fica no banco.
drop function if exists public.yt_own_meta_diet(uuid, timestamptz);
drop function if exists public.yt_own_meta_diet_contas(uuid);

analyze public.yt_own_video_meta_daily;
-- O vacuum full NÃO vai aqui (não roda dentro de transação): é o passo d7 do ritual, do dono, e só se compensar.
