-- (você roda) Antes, SEMPRE: dieta-meta-desligar-compactacao.sql (senão o cron do dia seguinte reapaga).
-- Volta B da dieta de metadados: recria uma linha para cada dia coberto e sem linha que está entre duas linhas
-- IDÊNTICAS do mesmo vídeo. A linha recriada é a cópia da vizinha de antes (a que foi apagada era igual a ela em
-- todas as colunas, menos o dia e o instante da captura). O instante NÃO é o original: fica 12:00 UTC do dia
-- seguinte, a hora nominal do cron. Para as linhas originais, só o CSV (volta C).
-- (você roda) Trocar <UUID_DO_SITE> pelo uuid do site. Uma instrução. Roda duas vezes sem erro. Responde `linhas_recriadas` (0 na segunda vez, ou se o uuid do site estiver errado).
with l as (
  select m.*,
         (to_jsonb(m) - 'day_pt' - 'captured_at') as t,
         lead(m.day_pt) over w as dia_seg,
         lead(to_jsonb(m) - 'day_pt' - 'captured_at') over w as t_seg
    from public.yt_own_video_meta_daily m
   where m.site_id = '<UUID_DO_SITE>'::uuid
  window w as (partition by m.youtube_video_id order by m.day_pt)
),
ins as (
insert into public.yt_own_video_meta_daily
  (youtube_video_id, day_pt, site_id, video_id, channel_id, title, thumbnail_sha256, thumbnail_dhash,
   thumbnail_blob_url, title_at_capture, thumbnail_sha256_at_capture, description_sha256, description_text,
   tags_sha256, tags, duration_seconds, is_short, privacy_status, ab_test_id, ab_variant_id,
   seconds_on_air_analytics, seconds_other_analytics, seconds_on_air_reporting, seconds_other_reporting, captured_at)
select l.youtube_video_id, g.dia::date, l.site_id, l.video_id, l.channel_id, l.title, l.thumbnail_sha256, l.thumbnail_dhash,
       l.thumbnail_blob_url, l.title_at_capture, l.thumbnail_sha256_at_capture, l.description_sha256, l.description_text,
       l.tags_sha256, l.tags, l.duration_seconds, l.is_short, l.privacy_status, l.ab_test_id, l.ab_variant_id,
       l.seconds_on_air_analytics, l.seconds_other_analytics, l.seconds_on_air_reporting, l.seconds_other_reporting,
       ((g.dia::date + 1)::timestamp + interval '12 hours') at time zone 'utc'
  from l
 cross join lateral generate_series((l.day_pt + 1)::timestamp, (l.dia_seg - 1)::timestamp, interval '1 day') as g(dia)
 where l.dia_seg is not null and l.t_seg = l.t and l.dia_seg - l.day_pt > 1
   and exists (select 1 from public.yt_own_video_coverage c
                where c.site_id = l.site_id and c.youtube_video_id = l.youtube_video_id
                  and c.metric_set = 'meta_texto' and g.dia::date between c.covered_from and c.covered_to)
   and (l.thumbnail_dhash is null
        or exists (select 1 from public.yt_own_video_coverage c
                    where c.site_id = l.site_id and c.youtube_video_id = l.youtube_video_id
                      and c.metric_set = 'meta_thumb' and g.dia::date between c.covered_from and c.covered_to))
on conflict (youtube_video_id, day_pt) do nothing
returning 1
)
select count(*) as linhas_recriadas from ins;
