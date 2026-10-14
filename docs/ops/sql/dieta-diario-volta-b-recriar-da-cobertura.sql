-- Volta B da dieta do diário: recria uma linha de zero para cada dia coberto (conjunto base) que não tem linha.
-- Serve quando o backup já foi solto (MG16), ou quando for preciso voltar a um leitor que não lê a cobertura.
-- Equivalente para todo leitor (views 0, dia medido); NÃO é a linha original (collected_at é o de agora;
-- as contagens da base voltam em zero; as estendidas só onde o dia está na cobertura estendidas).
-- Trocar <UUID_DO_SITE> pelo uuid do site. Uma instrução. Roda duas vezes sem erro.
insert into public.yt_own_video_daily
  (youtube_video_id, day_pt, site_id, video_id, channel_id,
   views, engaged_views, watch_time_minutes, likes, comments, shares, subscribers_gained, subscribers_lost,
   card_impressions, source, collected_at, metric_version)
select c.youtube_video_id, g.dia, c.site_id,
       case when exists (select 1 from public.youtube_videos v where v.id = c.video_id) then c.video_id end,
       c.channel_id,
       0, e.zero, 0, 0, 0, 0, 0, 0,
       e.zero, 'analytics_api', now(),
       case when g.dia < date '2025-03-31' then 'views_ate_2025-03-30'
            when g.dia < date '2026-08-27' then 'views_2025-03-31_a_2026-08-26'
            else 'views_desde_2026-08-27' end
  from public.yt_own_video_coverage c
 cross join lateral (select s::date as dia
                       from generate_series(c.covered_from::timestamp, c.covered_to::timestamp, interval '1 day') s) g
 cross join lateral (select case when exists (select 1 from public.yt_own_video_coverage x
                                               where x.site_id = c.site_id and x.youtube_video_id = c.youtube_video_id
                                                 and x.metric_set = 'estendidas'
                                                 and g.dia between x.covered_from and x.covered_to)
                                 then 0::bigint end as zero) e
 where c.site_id = '<UUID_DO_SITE>'::uuid and c.metric_set = 'base'
on conflict (youtube_video_id, day_pt) do nothing;
