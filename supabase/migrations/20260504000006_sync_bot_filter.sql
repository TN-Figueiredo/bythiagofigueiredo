-- Sync bot filter in aggregate_content_events with client-side bot-patterns.ts
-- Adds: Amazonbot, facebookexternalhit, Twitterbot (missing from original migration)
CREATE OR REPLACE FUNCTION public.aggregate_content_events(p_date date DEFAULT current_date - 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aggregated int;
  v_updated int;
BEGIN
  INSERT INTO content_metrics (
    site_id, resource_type, resource_id, date,
    views, unique_views, reads_complete,
    avg_read_depth, avg_time_sec,
    referrer_direct, referrer_google, referrer_newsletter, referrer_social, referrer_other
  )
  SELECT
    site_id, resource_type, resource_id, p_date,
    count(*) FILTER (WHERE event_type = 'view'),
    count(DISTINCT anonymous_id) FILTER (WHERE event_type = 'view'),
    count(*) FILTER (WHERE event_type = 'read_complete'),
    coalesce(avg(read_depth) FILTER (WHERE event_type = 'read_progress' AND read_depth IS NOT NULL), 0)::smallint,
    coalesce(avg(time_on_page) FILTER (WHERE event_type = 'read_progress' AND time_on_page IS NOT NULL), 0)::smallint,
    count(*) FILTER (WHERE referrer_src = 'direct' AND event_type = 'view'),
    count(*) FILTER (WHERE referrer_src = 'google' AND event_type = 'view'),
    count(*) FILTER (WHERE referrer_src = 'newsletter' AND event_type = 'view'),
    count(*) FILTER (WHERE referrer_src = 'social' AND event_type = 'view'),
    count(*) FILTER (WHERE referrer_src = 'other' AND event_type = 'view')
  FROM content_events
  WHERE created_at >= p_date::timestamptz
    AND created_at < (p_date + interval '1 day')::timestamptz
    AND (user_agent IS NULL OR user_agent NOT SIMILAR TO '%(Googlebot|bingbot|Baiduspider|YandexBot|DuckDuckBot|Bytespider|GPTBot|ClaudeBot|anthropic-ai|CCBot|PerplexityBot|Amazonbot|facebookexternalhit|Twitterbot)%')
  GROUP BY site_id, resource_type, resource_id
  ON CONFLICT (resource_type, resource_id, date) DO UPDATE SET
    views = EXCLUDED.views,
    unique_views = EXCLUDED.unique_views,
    reads_complete = EXCLUDED.reads_complete,
    avg_read_depth = EXCLUDED.avg_read_depth,
    avg_time_sec = EXCLUDED.avg_time_sec,
    referrer_direct = EXCLUDED.referrer_direct,
    referrer_google = EXCLUDED.referrer_google,
    referrer_newsletter = EXCLUDED.referrer_newsletter,
    referrer_social = EXCLUDED.referrer_social,
    referrer_other = EXCLUDED.referrer_other;

  GET DIAGNOSTICS v_aggregated = ROW_COUNT;

  UPDATE blog_posts bp SET
    view_count = coalesce(agg.total_views, 0),
    read_complete_count = coalesce(agg.total_reads, 0)
  FROM (
    SELECT resource_id,
           sum(views) AS total_views,
           sum(reads_complete) AS total_reads
    FROM content_metrics
    WHERE resource_type = 'blog'
    GROUP BY resource_id
  ) agg
  WHERE bp.id = agg.resource_id
    AND (bp.view_count IS DISTINCT FROM coalesce(agg.total_views, 0)
      OR bp.read_complete_count IS DISTINCT FROM coalesce(agg.total_reads, 0));

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'date', p_date,
    'metrics_upserted', v_aggregated,
    'posts_updated', v_updated
  );
END;
$$;
