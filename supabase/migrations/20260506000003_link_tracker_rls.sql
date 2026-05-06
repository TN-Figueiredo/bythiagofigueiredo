-- ─── tracked_links ───

-- Public can read active, non-expired, non-deleted links for a visible site.
-- The short-link redirect endpoint uses the anon role.
DROP POLICY IF EXISTS "tracked_links_public_read" ON tracked_links;
CREATE POLICY "tracked_links_public_read" ON tracked_links
  FOR SELECT
  USING (
    public.site_visible(site_id)
    AND active = true
    AND deleted_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
    AND (click_limit IS NULL OR total_clicks < click_limit)
  );

-- Staff can read all links for their site (including inactive/expired/soft-deleted).
DROP POLICY IF EXISTS "tracked_links_staff_read_all" ON tracked_links;
CREATE POLICY "tracked_links_staff_read_all" ON tracked_links
  FOR SELECT
  TO authenticated
  USING (public.can_view_site(site_id));

-- Staff can insert/update/delete links for their site.
DROP POLICY IF EXISTS "tracked_links_staff_write" ON tracked_links;
CREATE POLICY "tracked_links_staff_write" ON tracked_links
  FOR ALL
  TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- ─── link_clicks ───

-- Anonymous (redirect worker running as service role uses INSERT directly; public
-- role gets insert so the redirect Next.js route can fire without auth).
DROP POLICY IF EXISTS "link_clicks_service_insert" ON link_clicks;
CREATE POLICY "link_clicks_service_insert" ON link_clicks
  FOR INSERT
  TO anon
  WITH CHECK (public.site_visible(site_id));

-- Staff can read all clicks for their site.
DROP POLICY IF EXISTS "link_clicks_staff_read" ON link_clicks;
CREATE POLICY "link_clicks_staff_read" ON link_clicks
  FOR SELECT
  TO authenticated
  USING (public.can_view_site(site_id));

-- ─── link_daily_metrics ───

-- Staff can read aggregated metrics for their site.
DROP POLICY IF EXISTS "link_daily_metrics_staff_read" ON link_daily_metrics;
CREATE POLICY "link_daily_metrics_staff_read" ON link_daily_metrics
  FOR SELECT
  TO authenticated
  USING (public.can_view_site(site_id));

-- Service role (cron aggregation) needs to upsert metrics — handled via service
-- client outside RLS; no public/authenticated write policy needed.

-- ─── link_annotations ───

-- Staff can read annotations for their site.
DROP POLICY IF EXISTS "link_annotations_staff_read" ON link_annotations;
CREATE POLICY "link_annotations_staff_read" ON link_annotations
  FOR SELECT
  TO authenticated
  USING (public.can_view_site(site_id));

-- Staff can write annotations for their site.
DROP POLICY IF EXISTS "link_annotations_staff_write" ON link_annotations;
CREATE POLICY "link_annotations_staff_write" ON link_annotations
  FOR ALL
  TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- ─── link_goals ───

-- Staff can read goals for their site.
DROP POLICY IF EXISTS "link_goals_staff_read" ON link_goals;
CREATE POLICY "link_goals_staff_read" ON link_goals
  FOR SELECT
  TO authenticated
  USING (public.can_view_site(site_id));

-- Staff can write goals for their site.
DROP POLICY IF EXISTS "link_goals_staff_write" ON link_goals;
CREATE POLICY "link_goals_staff_write" ON link_goals
  FOR ALL
  TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- ─── link_alerts ───

-- Staff can read alerts for their site.
DROP POLICY IF EXISTS "link_alerts_staff_read" ON link_alerts;
CREATE POLICY "link_alerts_staff_read" ON link_alerts
  FOR SELECT
  TO authenticated
  USING (public.can_view_site(site_id));

-- Staff can write alerts for their site.
DROP POLICY IF EXISTS "link_alerts_staff_write" ON link_alerts;
CREATE POLICY "link_alerts_staff_write" ON link_alerts
  FOR ALL
  TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));
