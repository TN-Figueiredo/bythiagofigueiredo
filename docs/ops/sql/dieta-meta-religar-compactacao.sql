-- (você roda) RELIGAR a compactação diária dos metadados, depois de desligar pelo roteiro.
-- Condição: a causa do desligamento foi achada E a CP13 está limpa (`descobertas` 0 e `sem_explicacao` 0 em todo canal).
-- O que faz: instala de novo o corpo de public.yt_own_meta_cover da MG17 (cobre e enxuga). Depende de
-- public.yt_own_meta_linhas_do_meio (permanente, criada pela MG17): num banco em que a MG17 não rodou até o fim (função ausente ou sem a marca 'MG17 aplicada em'), o roteiro é recusado.
-- O primeiro cron depois enxuga o acumulado dos dias desligados de uma vez (a regra 3 e a derivação protegem o dia gravado).
-- Nada para trocar. Recusa sozinho (erro 'religar recusado') se a MG17 não tiver rodado até o fim: a marca é o comentário da função do critério. Depois: create, revoke, grant e a conferência final (`enxuga` tem de vir true). Roda duas vezes sem erro.
do $$
begin
  if coalesce(pg_catalog.obj_description(to_regprocedure('public.yt_own_meta_linhas_do_meio(uuid,uuid,date)'), 'pg_proc'), '') not like 'MG17 aplicada em %' then
    raise exception 'religar recusado: a MG17 não foi aplicada neste banco';
  end if;
end $$;
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
;
revoke all on function public.yt_own_meta_cover(uuid, uuid, date, boolean) from public, anon, authenticated;
grant execute on function public.yt_own_meta_cover(uuid, uuid, date, boolean) to service_role;
-- Conferência: enxuga = true.
select p.prosrc like '%yt_own_meta_linhas_do_meio%' as enxuga from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'yt_own_meta_cover';
