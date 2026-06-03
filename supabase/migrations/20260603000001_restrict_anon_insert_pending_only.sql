-- =============================================================================
-- MIGRATION: Restrict anon INSERT on newsletter_subscriptions to pending_confirmation only
-- The previous policy allowed inserting rows with ANY status (including 'confirmed'),
-- which bypasses the double opt-in flow. This adds a status check to the WITH CHECK.
-- =============================================================================

DROP POLICY IF EXISTS "newsletter anon insert" ON "public"."newsletter_subscriptions";

CREATE POLICY "newsletter anon insert"
  ON "public"."newsletter_subscriptions"
  FOR INSERT
  TO "authenticated", "anon"
  WITH CHECK (
    status = 'pending_confirmation'
    AND EXISTS (
      SELECT 1
        FROM public.sites s
       WHERE s.id = newsletter_subscriptions.site_id
         AND public.site_visible(s.id)
    )
  );
