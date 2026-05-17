-- Analytics RPC functions for the analytics overhaul
-- These support Content, Links, and Audience tabs

-- get_top_posts_analytics: aggregate content_events by resource_id
CREATE OR REPLACE FUNCTION public.get_top_posts_analytics(
  p_site_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  views bigint,
  unique_views bigint,
  avg_depth numeric,
  avg_time numeric,
  reads_complete bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    bp.id,
    COALESCE(bt.title, 'Untitled') AS title,
    bp.status::text,
    COUNT(ce.id) FILTER (WHERE ce.event_type = 'view') AS views,
    COUNT(DISTINCT ce.anonymous_id) FILTER (WHERE ce.event_type = 'view') AS unique_views,
    COALESCE(AVG(ce.read_depth) FILTER (WHERE ce.read_depth IS NOT NULL), 0) AS avg_depth,
    COALESCE(AVG(ce.time_on_page) FILTER (WHERE ce.time_on_page IS NOT NULL), 0) AS avg_time,
    COUNT(ce.id) FILTER (WHERE ce.event_type = 'read_complete') AS reads_complete
  FROM blog_posts bp
  LEFT JOIN blog_translations bt ON bt.post_id = bp.id AND bt.locale = bp.locale
  LEFT JOIN content_events ce ON ce.resource_id = bp.id
    AND ce.site_id = p_site_id
    AND ce.created_at >= p_start
    AND ce.created_at <= p_end
  WHERE bp.site_id = p_site_id
    AND bp.status = 'published'
  GROUP BY bp.id, bt.title
  ORDER BY views DESC
  LIMIT p_limit;
$$;

-- get_top_links_analytics
CREATE OR REPLACE FUNCTION public.get_top_links_analytics(
  p_site_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  code text,
  source text,
  clicks bigint,
  unique_clicks bigint,
  conversions bigint,
  top_country text,
  top_device text
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    tl.id,
    tl.code,
    COALESCE(tl.source_type::text, 'manual') AS source,
    COUNT(lc.id) AS clicks,
    COUNT(DISTINCT lc.visitor_id) AS unique_clicks,
    0::bigint AS conversions,
    MODE() WITHIN GROUP (ORDER BY lc.country) AS top_country,
    MODE() WITHIN GROUP (ORDER BY lc.device_type) AS top_device
  FROM tracked_links tl
  LEFT JOIN link_clicks lc ON lc.link_id = tl.id
    AND lc.clicked_at >= p_start
    AND lc.clicked_at <= p_end
  WHERE tl.site_id = p_site_id
    AND tl.active = true
    AND tl.deleted_at IS NULL
  GROUP BY tl.id
  HAVING COUNT(lc.id) > 0
  ORDER BY clicks DESC
  LIMIT p_limit;
$$;

-- get_top_referrers
CREATE OR REPLACE FUNCTION public.get_top_referrers(
  p_site_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_limit int DEFAULT 5
)
RETURNS TABLE (domain text, clicks bigint)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    COALESCE(lc.referrer_domain, 'direct') AS domain,
    COUNT(*) AS clicks
  FROM link_clicks lc
  JOIN tracked_links tl ON tl.id = lc.link_id
  WHERE tl.site_id = p_site_id
    AND lc.clicked_at >= p_start
    AND lc.clicked_at <= p_end
  GROUP BY domain
  ORDER BY clicks DESC
  LIMIT p_limit;
$$;

-- get_utm_campaigns
CREATE OR REPLACE FUNCTION public.get_utm_campaigns(
  p_site_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE (campaign text, medium text, clicks bigint, conversions bigint, rate numeric)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    COALESCE(lc.utm_campaign, 'none') AS campaign,
    COALESCE(lc.utm_medium, 'direct') AS medium,
    COUNT(*) AS clicks,
    0::bigint AS conversions,
    0::numeric AS rate
  FROM link_clicks lc
  JOIN tracked_links tl ON tl.id = lc.link_id
  WHERE tl.site_id = p_site_id
    AND lc.clicked_at >= p_start
    AND lc.clicked_at <= p_end
    AND lc.utm_campaign IS NOT NULL
  GROUP BY campaign, medium
  ORDER BY clicks DESC;
$$;

-- get_audience_countries (from link_clicks — content_events lacks country)
CREATE OR REPLACE FUNCTION public.get_audience_countries(
  p_site_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE (country text, percentage numeric)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH totals AS (
    SELECT COUNT(*) AS total
    FROM link_clicks
    WHERE site_id = p_site_id AND clicked_at >= p_start AND clicked_at <= p_end AND country IS NOT NULL
  )
  SELECT
    COALESCE(lc.country, 'Unknown') AS country,
    ROUND(COUNT(*)::numeric / GREATEST(t.total, 1) * 100, 1) AS percentage
  FROM link_clicks lc, totals t
  WHERE lc.site_id = p_site_id AND lc.clicked_at >= p_start AND lc.clicked_at <= p_end AND lc.country IS NOT NULL
  GROUP BY lc.country, t.total
  ORDER BY percentage DESC
  LIMIT 10;
$$;

-- get_audience_devices (from link_clicks — content_events lacks device_type)
CREATE OR REPLACE FUNCTION public.get_audience_devices(
  p_site_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE (device_type text, percentage numeric)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH totals AS (
    SELECT COUNT(*) AS total
    FROM link_clicks
    WHERE site_id = p_site_id AND clicked_at >= p_start AND clicked_at <= p_end AND device_type IS NOT NULL
  )
  SELECT
    lc.device_type,
    ROUND(COUNT(*)::numeric / GREATEST(t.total, 1) * 100, 1) AS percentage
  FROM link_clicks lc, totals t
  WHERE lc.site_id = p_site_id AND lc.clicked_at >= p_start AND lc.clicked_at <= p_end AND lc.device_type IS NOT NULL
  GROUP BY lc.device_type, t.total
  ORDER BY percentage DESC;
$$;

-- get_audience_sources
CREATE OR REPLACE FUNCTION public.get_audience_sources(
  p_site_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE (referrer_src text, percentage numeric)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH totals AS (
    SELECT COUNT(*) AS total
    FROM content_events
    WHERE site_id = p_site_id AND created_at >= p_start AND created_at <= p_end
  )
  SELECT
    COALESCE(ce.referrer_src, 'direct') AS referrer_src,
    ROUND(COUNT(*)::numeric / GREATEST(t.total, 1) * 100, 1) AS percentage
  FROM content_events ce, totals t
  WHERE ce.site_id = p_site_id AND ce.created_at >= p_start AND ce.created_at <= p_end
  GROUP BY ce.referrer_src, t.total
  ORDER BY percentage DESC;
$$;
