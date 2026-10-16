-- Volta A da dieta do diário (P3): devolve ao diário as linhas que a MG15 apagou. Vale até a MG16 soltar o backup.
-- Uma instrução. Roda duas vezes sem erro. Não passa por cima de dia que ganhou linha depois.
-- video_id de vídeo que não existe mais volta nulo (a chave do diário é "on delete set null").
insert into public.yt_own_video_daily
  (youtube_video_id, day_pt, site_id, video_id, channel_id,
   views, engaged_views, watch_time_minutes, avg_view_duration_seconds, avg_view_percentage,
   likes, comments, shares, subscribers_gained, subscribers_lost,
   card_impressions, card_click_rate, source, collected_at, metric_version)
select b.youtube_video_id, b.day_pt, b.site_id,
       case when exists (select 1 from public.youtube_videos v where v.id = b.video_id) then b.video_id end,
       b.channel_id,
       b.views, b.engaged_views, b.watch_time_minutes, b.avg_view_duration_seconds, b.avg_view_percentage,
       b.likes, b.comments, b.shares, b.subscribers_gained, b.subscribers_lost,
       b.card_impressions, b.card_click_rate, b.source, b.collected_at, b.metric_version
  from public.yt_own_video_daily_zeros_bkp b
on conflict (youtube_video_id, day_pt) do nothing;
