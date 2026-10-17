-- =============================================================================
-- MIGRATION MG17a: Observatório A5, E18 parte 2 (dieta de yt_own_video_meta_daily), parte ADITIVA
-- Spec: docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md, seção 7.5.10
-- Plano: docs/superpowers/plans/2026-10-13-a5-e6-p4-e-e18-parte-2-dieta-final-plan.md
-- Aditiva. Roda duas vezes sem erro. NÃO apaga nenhuma linha de yt_own_video_meta_daily.
-- Inerte para o código de main: ninguém chama as funções novas nem lê os conjuntos meta_texto e meta_thumb.
--
-- O que faz:
--   0. Recusa sem a MG14.
--   1. yt_own_video_coverage.source passa a aceitar 'data_api' (videos.list) e 'imagem' (download da thumbnail).
--   2. yt_own_meta_cover_set: funde dias na cobertura de um vídeo e um conjunto.
--   3. yt_own_meta_prova: só lê. Linha com captura fora da cobertura; dia coberto sem linha e sem explicação.
--   4. yt_own_meta_cover: o que o passo de metadados chama depois de gravar o dia. Aqui só COBRE.
--      (A MG17 troca o corpo por um que também enxuga; a assinatura e a resposta são as mesmas.)
--   5. Carga: cobre as linhas que já existem.
-- =============================================================================
set local lock_timeout = '5s';

-- 0. Recusas de entrada
do $$
begin
  if to_regclass('public.yt_own_video_meta_daily') is null then
    raise exception 'MG17a depende da coleta L1a: public.yt_own_video_meta_daily não existe';
  end if;
  if to_regclass('public.yt_own_video_coverage') is null then
    raise exception 'MG17a depende da MG14: public.yt_own_video_coverage não existe';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint k
     where k.conrelid = 'public.yt_own_video_coverage'::regclass and k.contype = 'c'
       and pg_catalog.pg_get_constraintdef(k.oid) like '%meta_texto%'
       and pg_catalog.pg_get_constraintdef(k.oid) like '%meta_thumb%') then
    raise exception 'MG17a depende da MG14: o check de metric_set não aceita meta_texto e meta_thumb';
  end if;
end $$;

-- 1. De onde veio a cobertura: a captura de metadados não é analytics_api nem reporting_api.
-- Troca a restrição que cita os valores antigos por uma com os quatro. Rodar de novo não faz nada.
do $$
declare r record;
begin
  for r in
    select k.conname, pg_catalog.pg_get_constraintdef(k.oid) as def
      from pg_catalog.pg_constraint k
     where k.conrelid = 'public.yt_own_video_coverage'::regclass and k.contype = 'c'
       and pg_catalog.pg_get_constraintdef(k.oid) like '%analytics_api%'
  loop
    if r.def like '%data_api%' and r.def like '%imagem%' then
      continue;
    end if;
    execute format('alter table public.yt_own_video_coverage drop constraint %I', r.conname);
  end loop;
  if not exists (
    select 1 from pg_catalog.pg_constraint k
     where k.conrelid = 'public.yt_own_video_coverage'::regclass and k.contype = 'c'
       and pg_catalog.pg_get_constraintdef(k.oid) like '%data_api%') then
    alter table public.yt_own_video_coverage
      add constraint yt_own_video_coverage_source_check
      check (source in ('analytics_api', 'reporting_api', 'data_api', 'imagem'));
  end if;
end $$;

-- 2. Funde uma lista de dias na cobertura de UM vídeo e UM conjunto (a técnica de yt_own_daily_apply, MG14).
-- Intervalo que não mudou não é regravado (collected_at continua sendo o da última extensão).
create or replace function public.yt_own_meta_cover_set(
  p_video text, p_set text, p_days date[], p_site_id uuid, p_channel_id uuid, p_video_uuid uuid, p_at timestamptz
) returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  v_mr datemultirange;
  v_n integer := 0;
  v_source text;
begin
  if p_video is null or p_video = '' or p_site_id is null or p_channel_id is null then
    raise exception 'argumento_nulo';
  end if;
  if p_set is null or p_set not in ('meta_texto', 'meta_thumb') then
    raise exception 'conjunto_invalido';
  end if;
  if p_days is null or cardinality(p_days) = 0 then
    return 0;
  end if;
  v_source := case p_set when 'meta_texto' then 'data_api' else 'imagem' end;
  select range_agg(x.r) into v_mr from (
    select daterange(c.covered_from, c.covered_to, '[]') as r
      from public.yt_own_video_coverage c
     where c.youtube_video_id = p_video and c.metric_set = p_set
    union all
    select daterange(d, d, '[]') from unnest(p_days) as d where d is not null
  ) x;
  if v_mr is null then
    return 0;
  end if;
  delete from public.yt_own_video_coverage c
   where c.youtube_video_id = p_video and c.metric_set = p_set
     and not exists (select 1 from unnest(v_mr) as r where lower(r) = c.covered_from);
  insert into public.yt_own_video_coverage as c
    (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id, source, collected_at)
  select p_video, p_set, lower(r), (upper(r) - 1), p_site_id, p_video_uuid, p_channel_id, v_source, coalesce(p_at, now())
    from unnest(v_mr) as r
  on conflict (youtube_video_id, metric_set, covered_from) do update
    set covered_to = excluded.covered_to,
        site_id = excluded.site_id,
        channel_id = excluded.channel_id,
        video_id = coalesce(excluded.video_id, c.video_id),
        source = excluded.source,
        collected_at = excluded.collected_at
    where c.covered_to is distinct from excluded.covered_to;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- 3. A prova (só lê). Por canal, até p_day.
--   linhas:          quantas linhas foram avaliadas (0 = nada foi avaliado, não "tudo certo").
--   descobertas:     linha com privacidade fora de meta_texto, mais linha com dHash fora de meta_thumb.
--   sem_explicacao:  dia coberto (em qualquer dos dois conjuntos), sem linha, que NÃO está entre duas linhas
--                    idênticas do mesmo vídeo. Só a dieta cria dia coberto sem linha, e só entre idênticas.
create or replace function public.yt_own_meta_prova(p_site_id uuid, p_channel_id uuid, p_day date)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with linhas as (
    select m.youtube_video_id, m.day_pt, m.privacy_status, m.thumbnail_dhash,
           (to_jsonb(m) - 'day_pt' - 'captured_at') as t,
           lead(m.day_pt) over w as dia_seg,
           lead(to_jsonb(m) - 'day_pt' - 'captured_at') over w as t_seg
      from public.yt_own_video_meta_daily m
     where m.site_id = p_site_id and m.channel_id = p_channel_id and m.day_pt <= p_day
    window w as (partition by m.youtube_video_id order by m.day_pt)
  ), explicado as (
    -- o que as linhas explicam: o próprio dia e, quando a linha seguinte é idêntica, o vão até ela
    select l.youtube_video_id,
           range_agg(case when l.dia_seg is not null and l.t_seg = l.t
                          then daterange(l.day_pt, l.dia_seg, '[]')
                          else daterange(l.day_pt, l.day_pt, '[]') end) as mr
      from linhas l
     group by l.youtube_video_id
  ), coberto as (
    select c.youtube_video_id, c.metric_set,
           range_agg(daterange(c.covered_from, least(c.covered_to, p_day), '[]')) as mr
      from public.yt_own_video_coverage c
     where c.site_id = p_site_id and c.channel_id = p_channel_id
       and c.metric_set in ('meta_texto', 'meta_thumb') and c.covered_from <= p_day
     group by c.youtube_video_id, c.metric_set
  )
  select jsonb_build_object(
    'linhas', (select count(*) from linhas),
    'descobertas',
      (select count(*) from linhas l
        where l.privacy_status is not null
          and not exists (select 1 from public.yt_own_video_coverage c
                           where c.site_id = p_site_id and c.youtube_video_id = l.youtube_video_id
                             and c.metric_set = 'meta_texto' and l.day_pt between c.covered_from and c.covered_to))
      + (select count(*) from linhas l
          where l.thumbnail_dhash is not null
            and not exists (select 1 from public.yt_own_video_coverage c
                             where c.site_id = p_site_id and c.youtube_video_id = l.youtube_video_id
                               and c.metric_set = 'meta_thumb' and l.day_pt between c.covered_from and c.covered_to)),
    'sem_explicacao',
      (select coalesce(sum((select coalesce(sum(upper(r) - lower(r)), 0)
                              from unnest(c.mr - coalesce(e.mr, '{}'::datemultirange)) as r)), 0)
         from coberto c left join explicado e on e.youtube_video_id = c.youtube_video_id))
$$;

-- >>> MG17a yt_own_meta_cover (início)
-- 4. O que o passo de metadados chama, uma vez por canal, DEPOIS de gravar as linhas do dia.
-- Cobre toda linha do canal até p_day que ainda não está na cobertura (a de hoje e as que ficaram para trás):
--   meta_texto = a linha tem privacy_status (a videos.list respondeu naquele dia);
--   meta_thumb = a linha tem thumbnail_dhash (a imagem foi baixada e comparada).
-- p_compactar é aceito e ignorado aqui: esta versão nunca apaga (compactacao = 'indisponivel').
create or replace function public.yt_own_meta_cover(
  p_site_id uuid, p_channel_id uuid, p_day date, p_compactar boolean
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  r record;
  v_texto integer := 0;
  v_thumb integer := 0;
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

  v_prova := public.yt_own_meta_prova(p_site_id, p_channel_id, p_day);
  return jsonb_build_object(
    'resultado', 'ok', 'dia', p_day, 'texto', v_texto, 'thumb', v_thumb,
    'linhas', v_prova->'linhas', 'descobertas', v_prova->'descobertas', 'sem_explicacao', v_prova->'sem_explicacao',
    'compactacao', 'indisponivel', 'compactadas', 0);
end $$;
-- <<< MG17a yt_own_meta_cover (fim)

revoke all on function public.yt_own_meta_cover_set(text, text, date[], uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.yt_own_meta_prova(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.yt_own_meta_cover(uuid, uuid, date, boolean) from public, anon, authenticated;
grant execute on function public.yt_own_meta_cover_set(text, text, date[], uuid, uuid, uuid, timestamptz) to service_role;
grant execute on function public.yt_own_meta_prova(uuid, uuid, date) to service_role;
grant execute on function public.yt_own_meta_cover(uuid, uuid, date, boolean) to service_role;

-- 5. Carga: a mesma função, uma vez por canal que tem linha. Canal cujo site não bate é pulado COM aviso
-- (a conferência VA2 acusa as linhas dele como descobertas).
do $$
declare
  c record;
  v jsonb;
  v_canais integer := 0;
begin
  for c in
    select m.site_id, m.channel_id, max(m.day_pt) as ate
      from public.yt_own_video_meta_daily m
     group by m.site_id, m.channel_id
     order by 1, 2
  loop
    v_canais := v_canais + 1;
    begin
      v := public.yt_own_meta_cover(c.site_id, c.channel_id, c.ate, false);
      raise notice 'MG17a: canal % coberto: %', c.channel_id, v;
    exception when raise_exception then
      if sqlerrm = 'canal_fora_do_site' then
        raise warning 'MG17a: canal % tem linhas com site_id % que não é o site do canal; nada foi coberto para ele', c.channel_id, c.site_id;
      else
        raise;
      end if;
    end;
  end loop;
  if v_canais = 0 then
    raise notice 'MG17a: yt_own_video_meta_daily sem linhas, nada a cobrir';
  end if;
end $$;
