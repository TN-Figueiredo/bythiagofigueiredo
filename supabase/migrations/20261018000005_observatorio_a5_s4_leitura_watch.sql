-- A5 · S4 (T&C-coleta): leitura anônima da página watch.
-- Spec: docs/superpowers/specs/2026-10-18-a5-s4-tc-coleta-design.md §8.1. Plano: docs/superpowers/plans/2026-10-18-a5-s4-tc-coleta-plan.md (Apêndice A).
--   1. yt_watch_titulos_ok(jsonb): forma de titulos_divergentes (CHECK).
--   2. yt_watch_alvos, yt_watch_thumbs, yt_watch_readings.
--   3. RLS (can_view_private_site se existir; senão can_edit_site). Sem policy de escrita.
--   4. yt_watch_conciliar, yt_watch_gravar_disparo, yt_watch_poda, yt_watch_prova (service_role só).
-- Convive com o código em main: nada em main lê ou escreve estas tabelas. Idempotente.
set lock_timeout = '5s';

-- ── 1. Forma de titulos_divergentes ──
create or replace function public.yt_watch_titulos_ok(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select j is null or (
    jsonb_typeof(j) = 'array' and jsonb_array_length(j) <= 10
    and not exists (
      select 1 from jsonb_array_elements(j) e
      where jsonb_typeof(e) <> 'object'
         or coalesce(jsonb_typeof(e->'renderer'), '') <> 'string'
         or btrim(e->>'renderer') = ''
         or not (e ? 'texto')
         or coalesce(jsonb_typeof(e->'texto'), '') not in ('string', 'null')
         or (jsonb_typeof(e->'texto') = 'string' and btrim(e->>'texto') = '')
    )
  )
$$;

-- ── 2. Tabelas ──
create table if not exists public.yt_watch_alvos (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  tipo text not null check (tipo in ('concorrente','proprio')),
  motivo_ate text not null check (motivo_ate in ('janela_concorrente','janela_propria','proprio_antigo','teste_nosso','extensao','extensao_curta')),
  coleta_ate timestamptz not null,
  extensoes_curtas smallint not null default 0 check (extensoes_curtas between 0 and 2),
  rodadas_por_dia smallint not null default 4 check (rodadas_por_dia in (1, 4)),
  hora_base_min smallint not null check (hora_base_min between 0 and 1439),
  proxima_rodada_em timestamptz not null,
  ultima_rodada_em timestamptz,
  rodadas integer not null default 0,
  indisponivel_seguidas smallint not null default 0,
  saiu_em timestamptz,
  saiu_por text check (saiu_por in ('janela','indisponivel','removido')),
  reter_ate timestamptz,
  created_at timestamptz not null default now(),
  ativo_desde timestamptz not null default now(),  -- r1 Phil M6: refeito na reativação
  unique (site_id, youtube_video_id),
  check ((saiu_em is null) = (saiu_por is null))
);
create index if not exists yt_watch_alvos_devidos on public.yt_watch_alvos (proxima_rodada_em) where saiu_em is null;

create table if not exists public.yt_watch_thumbs (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  host text not null check (host ~ '^i[0-9]*\.ytimg\.com$'),
  variante text not null check (variante ~ '^[a-z0-9]{1,100}$'),
  http smallint check (http between 100 and 599),
  etag text check (etag is null or (etag <> '' and length(etag) <= 200)),
  sha16 text check (sha16 is null or sha16 ~ '^[0-9a-f]{16}$'),
  dhash text check (dhash is null or dhash ~ '^[0-9a-f]{16}$'),
  largura smallint check (largura between 1 and 4096),
  altura smallint check (altura between 1 and 4096),
  primeira_vista timestamptz not null,
  ultima_vista timestamptz not null,
  vistas integer not null default 1,
  check ((largura is null) = (altura is null)),
  check (dhash is null or (http = 200 and largura is not null)),
  check (ultima_vista >= primeira_vista),
  unique nulls not distinct (site_id, youtube_video_id, host, variante, http, etag, sha16, dhash, largura, altura)
);

create table if not exists public.yt_watch_readings (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  lida_em timestamptz not null,
  rodada_id uuid not null,
  origem_rede text not null check (origem_rede in ('vercel','forja','mac-casa')),
  versao_leitor smallint not null,
  http smallint check (http between 100 and 599),
  erro text check (erro is null or erro ~ '^[a-z0-9_]{1,40}$'),
  idioma text check (idioma is null or idioma ~ '^[a-z]{2,3}(-([A-Z]{2}|[0-9]{3}))?$'),
  titulo_oficial text check (titulo_oficial is null or (length(btrim(titulo_oficial)) > 0 and length(titulo_oficial) <= 500)),
  titulo_oficial_fonte text check (titulo_oficial_fonte in ('videoDetails','og_title')),
  titulo_exibido text check (titulo_exibido is null or (length(btrim(titulo_exibido)) > 0 and length(titulo_exibido) <= 500)),
  renderers_presentes smallint not null default 0 check (renderers_presentes between 0 and 7),
  titulos_divergentes jsonb check (public.yt_watch_titulos_ok(titulos_divergentes)),
  rendicoes_sqp smallint check (rendicoes_sqp between 0 and 200),
  jogador_bloqueado boolean not null default false,
  miniatura_id bigint references public.yt_watch_thumbs(id) on delete set null,
  check ((titulo_oficial is null) = (titulo_oficial_fonte is null)),
  check (not (titulo_exibido is not null and titulos_divergentes is not null)),
  check ((titulo_exibido is null) or renderers_presentes > 0),
  check (not jogador_bloqueado or erro is null),
  check (erro is null or (titulo_exibido is null and titulos_divergentes is null and titulo_oficial is null and renderers_presentes = 0)),
  check (erro is not null or (titulo_exibido is null and titulos_divergentes is null) or idioma is not null)
);
create index if not exists yt_watch_readings_video_tempo on public.yt_watch_readings (youtube_video_id, lida_em);
create index if not exists yt_watch_readings_miniatura on public.yt_watch_readings (miniatura_id) where miniatura_id is not null;

-- ── 3. RLS: leitura sensível por can_view_private_site (ou can_edit_site); escrita só por service role ──
alter table public.yt_watch_alvos enable row level security;
alter table public.yt_watch_thumbs enable row level security;
alter table public.yt_watch_readings enable row level security;
do $$
declare
  v_fn text := case when to_regprocedure('public.can_view_private_site(uuid)') is not null
                    then 'public.can_view_private_site(site_id)' else 'public.can_edit_site(site_id)' end;
  t text;
begin
  foreach t in array array['yt_watch_alvos', 'yt_watch_thumbs', 'yt_watch_readings'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (%s)', t || '_select', t, v_fn);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from authenticated', t);
  end loop;
end $$;

-- ── 4a. Conciliação: candidatos (já deduplicados pelo código) → alvos; tabela de reativação do spec §7; saída por 'removido' ──
create or replace function public.yt_watch_conciliar(p_agora timestamptz, p_candidatos jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_ins integer := 0; v_upd integer := 0; v_rem integer := 0; v_ativos integer;
begin
  with c as (
    select distinct on (x.site_id, x.youtube_video_id) x.site_id, x.youtube_video_id, x.tipo, x.motivo_ate,
           max(x.coleta_ate) over (partition by x.site_id, x.youtube_video_id) as coleta_ate,  -- r1 Phil M5
           x.hora_base_min, x.rodadas_por_dia
      from jsonb_to_recordset(coalesce(p_candidatos, '[]'::jsonb)) as x(
        site_id uuid, youtube_video_id text, tipo text, motivo_ate text, coleta_ate timestamptz, hora_base_min smallint, rodadas_por_dia smallint)
     order by x.site_id, x.youtube_video_id, (x.motivo_ate = 'teste_nosso') desc, x.coleta_ate desc
  ), up as (
    insert into public.yt_watch_alvos as a
      (site_id, youtube_video_id, tipo, motivo_ate, coleta_ate, hora_base_min, rodadas_por_dia, proxima_rodada_em)
    select c.site_id, c.youtube_video_id, c.tipo, c.motivo_ate, c.coleta_ate, c.hora_base_min, c.rodadas_por_dia, p_agora from c
    on conflict (site_id, youtube_video_id) do update set
      coleta_ate = greatest(a.coleta_ate, excluded.coleta_ate),
      motivo_ate = case when excluded.coleta_ate > a.coleta_ate then excluded.motivo_ate else a.motivo_ate end,
      rodadas_por_dia = excluded.rodadas_por_dia,  -- r1 Phil I8: sem catraca (o código deduplica pelo máximo)
      proxima_rodada_em = case when a.saiu_em is null then a.proxima_rodada_em else p_agora end,
      ativo_desde = case when a.saiu_em is null and excluded.rodadas_por_dia <= a.rodadas_por_dia then a.ativo_desde else p_agora end,  -- r1 Phil M6; r2 Phil N1: reinicia também quando o ritmo sobe
      saiu_em = null,
      saiu_por = null
    where a.saiu_em is null
       or excluded.motivo_ate = 'teste_nosso'
       or (a.saiu_por = 'removido' and excluded.motivo_ate = 'janela_concorrente')
    returning (xmax = 0) as inserido
  )
  select count(*) filter (where inserido), count(*) filter (where not inserido) into v_ins, v_upd from up;

  update public.yt_watch_alvos a set saiu_em = p_agora, saiu_por = 'removido'
   where a.tipo = 'concorrente' and a.saiu_em is null
     and not exists (
       select 1 from public.competitor_videos cv
         join public.competitor_channels ch on ch.id = cv.competitor_channel_id
        where cv.video_id = a.youtube_video_id and ch.site_id = a.site_id);
  get diagnostics v_rem = row_count;

  select count(*) into v_ativos from public.yt_watch_alvos where saiu_em is null;
  return jsonb_build_object('inseridos', v_ins, 'atualizados', v_upd, 'removidos', v_rem, 'alvos_ativos', v_ativos);
end $$;
revoke all on function public.yt_watch_conciliar(timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.yt_watch_conciliar(timestamptz, jsonb) to service_role;

-- ── 4b. Gravação de um disparo (uma transação): miniaturas distintas, leituras, alvos ──
create or replace function public.yt_watch_gravar_disparo(p jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_mapa jsonb := '{}'::jsonb; r record; v_id bigint;
  v_t integer := 0; v_l integer := 0; v_a integer := 0;
begin
  for r in select * from jsonb_to_recordset(coalesce(p->'thumbs', '[]'::jsonb)) as x(
      k integer, site_id uuid, youtube_video_id text, host text, variante text, http smallint, etag text, sha16 text,
      dhash text, largura smallint, altura smallint, vista_em timestamptz)
  loop
    insert into public.yt_watch_thumbs as t
      (site_id, youtube_video_id, host, variante, http, etag, sha16, dhash, largura, altura, primeira_vista, ultima_vista)
    values (r.site_id, r.youtube_video_id, r.host, r.variante, r.http, r.etag, r.sha16, r.dhash, r.largura, r.altura, r.vista_em, r.vista_em)
    on conflict (site_id, youtube_video_id, host, variante, http, etag, sha16, dhash, largura, altura) do update
      set ultima_vista = greatest(t.ultima_vista, excluded.ultima_vista), vistas = t.vistas + 1
    returning id into v_id;
    v_mapa := v_mapa || jsonb_build_object(r.k::text, v_id);
    v_t := v_t + 1;
  end loop;

  insert into public.yt_watch_readings
    (site_id, youtube_video_id, lida_em, rodada_id, origem_rede, versao_leitor, http, erro, idioma, titulo_oficial,
     titulo_oficial_fonte, titulo_exibido, renderers_presentes, titulos_divergentes, rendicoes_sqp, jogador_bloqueado, miniatura_id)
  select x.site_id, x.youtube_video_id, x.lida_em, x.rodada_id, x.origem_rede, x.versao_leitor, x.http, x.erro, x.idioma, x.titulo_oficial,
         x.titulo_oficial_fonte, x.titulo_exibido, coalesce(x.renderers_presentes, 0), x.titulos_divergentes, x.rendicoes_sqp,
         coalesce(x.jogador_bloqueado, false),
         case when x.thumb_k is null then null else (v_mapa->>(x.thumb_k::text))::bigint end
    from jsonb_to_recordset(coalesce(p->'leituras', '[]'::jsonb)) as x(
      site_id uuid, youtube_video_id text, lida_em timestamptz, rodada_id uuid, origem_rede text, versao_leitor smallint, http smallint,
      erro text, idioma text, titulo_oficial text, titulo_oficial_fonte text, titulo_exibido text, renderers_presentes smallint,
      titulos_divergentes jsonb, rendicoes_sqp smallint, jogador_bloqueado boolean, thumb_k integer);
  get diagnostics v_l = row_count;

  update public.yt_watch_alvos a set
      proxima_rodada_em = coalesce(x.proxima_rodada_em, a.proxima_rodada_em),
      ultima_rodada_em = coalesce(x.ultima_rodada_em, a.ultima_rodada_em),
      rodadas = a.rodadas + coalesce(x.rodadas_mais, 0),
      indisponivel_seguidas = coalesce(x.indisponivel_seguidas, a.indisponivel_seguidas),
      saiu_em = coalesce(x.saiu_em, a.saiu_em),
      saiu_por = coalesce(x.saiu_por, a.saiu_por),
      motivo_ate = case when x.coleta_ate > a.coleta_ate then x.motivo_ate else a.motivo_ate end,
      coleta_ate = greatest(a.coleta_ate, x.coleta_ate),
      extensoes_curtas = greatest(a.extensoes_curtas, coalesce(x.extensoes_curtas, 0)),
      reter_ate = greatest(a.reter_ate, x.reter_ate)
    from jsonb_to_recordset(coalesce(p->'alvos', '[]'::jsonb)) as x(
      id bigint, proxima_rodada_em timestamptz, ultima_rodada_em timestamptz, rodadas_mais integer, indisponivel_seguidas smallint,
      saiu_em timestamptz, saiu_por text, coleta_ate timestamptz, motivo_ate text, extensoes_curtas smallint, reter_ate timestamptz)
   where a.id = x.id and a.saiu_em is null;
  get diagnostics v_a = row_count;

  return jsonb_build_object('thumbs', v_t, 'leituras', v_l, 'alvos', v_a);
end $$;
revoke all on function public.yt_watch_gravar_disparo(jsonb) from public, anon, authenticated;
grant execute on function public.yt_watch_gravar_disparo(jsonb) to service_role;

-- ── 4c. Poda: leituras primeiro, depois miniaturas órfãs, depois o alvo vazio (spec §10.1) ──
create or replace function public.yt_watch_poda(p_agora timestamptz, p_lote integer) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_l integer := 0; v_t integer := 0; v_a integer := 0;
begin
  if p_lote is null or p_lote < 1 or p_lote > 50000 then raise exception 'p_lote fora de 1..50000' using errcode = '22023'; end if;
  delete from public.yt_watch_readings r
   where r.id in (
     select r2.id from public.yt_watch_readings r2
       join public.yt_watch_alvos a on a.site_id = r2.site_id and a.youtube_video_id = r2.youtube_video_id
      where a.saiu_em < p_agora - interval '30 days' and (a.reter_ate is null or a.reter_ate < p_agora)
      limit p_lote);
  get diagnostics v_l = row_count;
  if v_l < p_lote then
    delete from public.yt_watch_thumbs t
     using public.yt_watch_alvos a
     where a.site_id = t.site_id and a.youtube_video_id = t.youtube_video_id
       and a.saiu_em < p_agora - interval '30 days' and (a.reter_ate is null or a.reter_ate < p_agora)
       and not exists (select 1 from public.yt_watch_readings r where r.miniatura_id = t.id);
    get diagnostics v_t = row_count;
    delete from public.yt_watch_alvos a
     where a.saiu_em < p_agora - interval '30 days' and (a.reter_ate is null or a.reter_ate < p_agora)
       and not exists (select 1 from public.yt_watch_readings r where r.site_id = a.site_id and r.youtube_video_id = a.youtube_video_id)
       and not exists (select 1 from public.yt_watch_thumbs t where t.site_id = a.site_id and t.youtube_video_id = a.youtube_video_id);
    get diagnostics v_a = row_count;
  end if;
  return jsonb_build_object('leituras', v_l, 'miniaturas', v_t, 'alvos', v_a, 'sobrou', v_l = p_lote);
end $$;
revoke all on function public.yt_watch_poda(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.yt_watch_poda(timestamptz, integer) to service_role;

-- ── 4d. Prova diária (spec §10.2). Motivos de coleta: null = sem cor (coleta desligada ou era atual com < 24 h) ──
create or replace function public.yt_watch_prova(p_agora timestamptz, p_coleta_ligada boolean, p_candidatos_esperados integer)
returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_desde timestamptz; v_primeira timestamptz;
  v_ativos integer; v_atrasados integer; v_menos integer;
  v_l integer; v_ind integer; v_err integer; v_semt integer; v_soc integer; v_jog integer; v_fora integer; v_idi integer; v_rod integer; v_longas integer;
  v_por_erro jsonb; v_madura boolean; v_den numeric;
  m_bloq boolean; m_layout boolean; m_rod boolean; m_alvos boolean; m_cap boolean; m_oficial boolean;
  v_demanda integer; v_razao numeric; v_conc30 integer;
  -- r2 Phil m2: capacidade = disparos/dia x K; trocar K ANTES do db:new se o P-V medir K < 16
  v_disparos constant integer := 72; v_k constant integer := 16; v_capacidade constant integer := v_disparos * v_k;
begin
  -- início da era contínua atual da leitura_watch: a última execução sem outra nas 6 h anteriores
  select max(started_at) into v_desde from (
    select started_at, lag(started_at) over (order by started_at) as ant
      from public.competitor_agenda_runs where task = 'leitura_watch' and started_at <= p_agora
  ) e where ant is null or started_at - ant > interval '6 hours';

  select count(*) filter (where saiu_em is null),
         count(*) filter (where saiu_em is null and proxima_rodada_em < p_agora - interval '2 hours')
    into v_ativos, v_atrasados from public.yt_watch_alvos;

  select count(*) into v_menos from public.yt_watch_alvos a
   where a.saiu_em is null and a.ativo_desde < p_agora - interval '24 hours'
     and (select count(distinct r.rodada_id) from public.yt_watch_readings r
           where r.site_id = a.site_id and r.youtube_video_id = a.youtube_video_id
             and r.lida_em > p_agora - case when a.rodadas_por_dia = 1 then interval '26 hours' else interval '24 hours' end
             and r.lida_em <= p_agora)
         < case when a.rodadas_por_dia = 1 then 1 else 3 end;

  select count(*), count(*) filter (where erro = 'indisponivel'),
         count(*) filter (where erro is not null and erro <> 'indisponivel'),
         count(*) filter (where erro is null and renderers_presentes = 0 and titulos_divergentes is null),
         count(*) filter (where erro is null and titulo_oficial is null and not jogador_bloqueado and (titulo_exibido is not null or titulos_divergentes is not null)),  -- r3: oficial ausente sem bloqueio (r3b Phil: leitura de teste conta)
         count(*) filter (where jogador_bloqueado), count(*) filter (where erro = 'fora_do_formato'),
         count(*) filter (where erro is null and idioma is not null and idioma <> 'pt-BR'),
         count(distinct rodada_id)
    into v_l, v_ind, v_err, v_semt, v_soc, v_jog, v_fora, v_idi, v_rod
    from public.yt_watch_readings where lida_em > p_agora - interval '24 hours' and lida_em <= p_agora;

  select count(*) into v_longas from (
    select rodada_id from public.yt_watch_readings where lida_em > p_agora - interval '24 hours' and lida_em <= p_agora
     group by rodada_id having max(lida_em) - min(lida_em) > interval '10 minutes') g;

  select coalesce(jsonb_object_agg(erro, n), '{}'::jsonb) into v_por_erro from (
    select erro, count(*) n from public.yt_watch_readings
     where lida_em > p_agora - interval '24 hours' and lida_em <= p_agora and erro is not null group by erro) g;

  select min(lida_em) into v_primeira from public.yt_watch_readings;

  -- r1 Phil I10: a capacidade (72 disparos x K=16 = 1.152 rodadas/dia) contra a demanda medida
  select coalesce(sum(rodadas_por_dia), 0) into v_demanda from public.yt_watch_alvos where saiu_em is null;
  v_razao := round(v_capacidade::numeric / nullif(v_demanda, 0), 2);
  -- r1 Phil M8: conferência de que a lista de candidatos não esvaziou em silêncio (sem motivo)
  select count(*) into v_conc30 from public.competitor_videos where published_at > p_agora - interval '30 days';

  v_madura := coalesce(p_coleta_ligada, false) and v_desde is not null and v_desde < p_agora - interval '24 hours';
  if v_madura then
    m_bloq := (v_l - v_ind) >= 30 and v_err::numeric / (v_l - v_ind) > 0.5;
    v_den := v_l - v_err - v_ind;
    m_layout := v_den > 0 and v_semt::numeric / v_den > 0.2;
    m_oficial := v_den > 0 and v_soc::numeric / v_den > 0.2;  -- r3: v_den = leituras sem erro
    m_rod := v_menos > 0 or v_atrasados > 0;
  end if;
  if coalesce(p_coleta_ligada, false) and v_demanda is not null then m_cap := v_demanda * 1.5 > v_capacidade; end if;  -- r2: mesma conta da razão sem arredondar (769 -> true com razão 1,50 na tela)
  if coalesce(p_coleta_ligada, false) and p_candidatos_esperados is not null and v_desde is not null then
    if p_candidatos_esperados > 0 and v_ativos = 0 then m_alvos := true;
    elsif v_madura then m_alvos := p_candidatos_esperados > 0 and v_ativos < 0.5 * p_candidatos_esperados;
    end if;
  end if;

  return jsonb_build_object(
    'candidatos_esperados', p_candidatos_esperados, 'alvos_ativos', v_ativos, 'alvos_atrasados', v_atrasados,
    'menos_de_3_rodadas_24h', v_menos, 'leituras_24h', v_l, 'indisponiveis_24h', v_ind, 'com_erro_24h', v_err,
    'sem_titulo_24h', v_semt, 'sem_oficial_sem_bloqueio_24h', v_soc, 'jogador_bloqueado_24h', v_jog, 'fora_do_formato_24h', v_fora, 'idioma_diferente_24h', v_idi,
    'rodadas_24h', v_rod, 'rodadas_longas_24h', v_longas, 'por_erro', v_por_erro,
    'primeira_leitura', v_primeira, 'coleta_desde', v_desde,
    'demanda_rodadas_dia', v_demanda, 'capacidade_razao', v_razao, 'capacidade_rodadas_dia', v_capacidade, 'concorrentes_30d', v_conc30,
    'motivos', jsonb_build_object('leitura_bloqueada', m_bloq, 'layout_mudou', m_layout, 'rodadas_faltando', m_rod, 'sem_alvos', m_alvos, 'capacidade_curta', m_cap, 'oficial_sumiu', m_oficial));
end $$;
revoke all on function public.yt_watch_prova(timestamptz, boolean, integer) from public, anon, authenticated;
grant execute on function public.yt_watch_prova(timestamptz, boolean, integer) to service_role;
