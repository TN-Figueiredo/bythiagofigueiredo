-- =============================================================================
-- MIGRATION: newsletter_sends_security_invoker
-- Fix: change SECURITY DEFINER to SECURITY INVOKER so RLS on newsletter_sends
-- enforces the existing staff_read policy. Prevents cross-tenant data access.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.newsletter_sends_funnel(p_edition_ids uuid[])
RETURNS TABLE (
  total_sends bigint,
  delivered_count bigint,
  opened_count bigint,
  clicked_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COUNT(*) AS total_sends,
    COUNT(*) FILTER (WHERE status = 'delivered' OR opened_at IS NOT NULL OR clicked_at IS NOT NULL) AS delivered_count,
    COUNT(*) FILTER (WHERE opened_at IS NOT NULL) AS opened_count,
    COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) AS clicked_count
  FROM newsletter_sends
  WHERE edition_id = ANY(p_edition_ids);
$$;

CREATE OR REPLACE FUNCTION public.newsletter_sends_recent_activity(
  p_edition_ids uuid[],
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  edition_id uuid,
  subscriber_email text,
  opened_at timestamptz,
  clicked_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT edition_id, subscriber_email, opened_at, clicked_at
  FROM newsletter_sends
  WHERE edition_id = ANY(p_edition_ids)
    AND (opened_at IS NOT NULL OR clicked_at IS NOT NULL)
  ORDER BY GREATEST(opened_at, clicked_at) DESC NULLS LAST
  LIMIT p_limit;
$$;
