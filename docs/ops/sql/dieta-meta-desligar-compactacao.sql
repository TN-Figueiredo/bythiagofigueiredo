-- (você roda) DESLIGAR a compactação diária dos metadados (dieta de yt_own_video_meta_daily, MG17).
-- Quando usar: SEMPRE antes da volta B (dieta-meta-volta-b-recriar-da-cobertura.sql) e sempre que o alarme de `sem_explicacao`
-- ou de linhas faltando aparecer e você precisar parar o enxugamento enquanto investiga. Sem isto, o cron do dia seguinte reapaga.
-- O que faz: troca o corpo de public.yt_own_meta_cover pelo da MG17a (só COBRE, nunca apaga). Diferença única: a resposta
-- traz compactacao = 'desligada' (a MG17a diz outra palavra). O código pede a compactação e recebe 'desligada': isso é NOTA VERMELHA
-- no cron todo dia (é o que impede esquecer o roteiro ligado). Para religar: dieta-meta-religar-compactacao.sql.
-- Nada para trocar. Três instruções (create, revoke, grant) e a conferência final (`enxuga` tem de vir false). Roda duas vezes sem erro.
-- >>> MG17a yt_own_meta_cover (início)
-- 4. O que o passo de metadados chama, uma vez por canal, DEPOIS de gravar as linhas do dia.
-- Cobre toda linha do canal até p_day que ainda não está na cobertura (a de hoje e as que ficaram para trás):
--   meta_texto = a linha tem privacy_status (a videos.list respondeu naquele dia);
--   meta_thumb = a linha tem thumbnail_dhash (a imagem foi baixada e comparada).
-- p_compactar é aceito e ignorado aqui: esta versão nunca apaga (compactacao = 'desligada').
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
    'compactacao', 'desligada', 'compactadas', 0);
end $$;
-- <<< MG17a yt_own_meta_cover (fim)
;
revoke all on function public.yt_own_meta_cover(uuid, uuid, date, boolean) from public, anon, authenticated;
grant execute on function public.yt_own_meta_cover(uuid, uuid, date, boolean) to service_role;
-- Conferência: enxuga = false (o corpo não chama mais o enxugamento).
select p.prosrc like '%yt_own_meta_linhas_do_meio%' as enxuga from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'yt_own_meta_cover';
