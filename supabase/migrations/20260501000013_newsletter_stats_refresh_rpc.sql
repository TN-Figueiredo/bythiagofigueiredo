-- 20260421000004_newsletter_stats_refresh_rpc.sql
-- RPC to batch-refresh stale newsletter edition stats from newsletter_sends

CREATE OR REPLACE FUNCTION public.refresh_newsletter_stats()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE newsletter_editions e
  SET
    stats_delivered = COALESCE(s.delivered, 0),
    stats_opens = COALESCE(s.opens, 0),
    stats_clicks = COALESCE(s.clicks, 0),
    stats_bounces = COALESCE(s.bounces, 0),
    stats_complaints = COALESCE(s.complaints, 0),
    stats_stale = false
  FROM (
    SELECT edition_id,
      COUNT(*) FILTER (WHERE status IN ('delivered','opened','clicked')) as delivered,
      COUNT(*) FILTER (WHERE status IN ('opened','clicked')) as opens,
      COUNT(*) FILTER (WHERE status = 'clicked') as clicks,
      COUNT(*) FILTER (WHERE status = 'bounced') as bounces,
      COUNT(*) FILTER (WHERE status = 'complained') as complaints
    FROM newsletter_sends
    WHERE edition_id IN (SELECT id FROM newsletter_editions WHERE stats_stale = true)
    GROUP BY edition_id
  ) s
  WHERE e.id = s.edition_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
