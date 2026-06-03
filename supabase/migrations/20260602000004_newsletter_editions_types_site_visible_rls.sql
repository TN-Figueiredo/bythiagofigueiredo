-- =============================================================================
-- MIGRATION: Add site_visible() guard to newsletter public-read RLS policies
-- Prevents cross-site data leakage via direct API queries.
-- =============================================================================

-- newsletter_editions: public read
DROP POLICY IF EXISTS "newsletter_editions_public_read" ON public.newsletter_editions;
CREATE POLICY "newsletter_editions_public_read"
  ON public.newsletter_editions
  FOR SELECT
  USING (status = 'sent' AND public.site_visible(site_id));

-- newsletter_types: public read active types
DROP POLICY IF EXISTS "public_read_active_types" ON public.newsletter_types;
CREATE POLICY "public_read_active_types"
  ON public.newsletter_types
  FOR SELECT
  USING (active = true AND public.site_visible(site_id));
