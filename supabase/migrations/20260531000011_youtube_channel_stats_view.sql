CREATE OR REPLACE VIEW public.youtube_channel_stats AS
SELECT
  channel_id,
  site_id,
  SUM(view_count) AS total_views,
  SUM(like_count) AS total_likes,
  COUNT(*) FILTER (WHERE is_featured = true) AS featured_count,
  COUNT(*) FILTER (WHERE is_hidden = true) AS hidden_count,
  MAX(published_at) AS latest_video_at,
  COUNT(*) AS total_video_count
FROM public.youtube_videos
GROUP BY channel_id, site_id;
