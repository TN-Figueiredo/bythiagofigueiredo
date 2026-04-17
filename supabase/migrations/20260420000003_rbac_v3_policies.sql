-- supabase/migrations/20260420000003_rbac_v3_policies.sql
BEGIN;

-- DROP legacy is_staff()-based policies.
-- Names vary (some use spaces, some underscores across earlier migrations).
DROP POLICY IF EXISTS blog_posts_staff_read_all ON blog_posts;
DROP POLICY IF EXISTS blog_posts_staff_write ON blog_posts;
DROP POLICY IF EXISTS "blog_posts staff read" ON blog_posts;
DROP POLICY IF EXISTS "blog_posts staff write" ON blog_posts;
DROP POLICY IF EXISTS campaigns_staff_read_all ON campaigns;
DROP POLICY IF EXISTS campaigns_staff_write ON campaigns;
DROP POLICY IF EXISTS "campaigns staff read" ON campaigns;
DROP POLICY IF EXISTS "campaigns staff write" ON campaigns;
DROP POLICY IF EXISTS contact_submissions_staff_read ON contact_submissions;
DROP POLICY IF EXISTS "contact_submissions staff read" ON contact_submissions;
DROP POLICY IF EXISTS "contact_submissions staff update" ON contact_submissions;
DROP POLICY IF EXISTS newsletter_subscriptions_staff_read ON newsletter_subscriptions;
DROP POLICY IF EXISTS "newsletter staff read" ON newsletter_subscriptions;

-- blog_posts
DROP POLICY IF EXISTS blog_posts_select ON blog_posts;
CREATE POLICY blog_posts_select ON blog_posts FOR SELECT TO authenticated USING (
  public.can_edit_site(site_id)
  OR (
    owner_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM site_memberships WHERE site_id = blog_posts.site_id AND user_id = auth.uid() AND role = 'reporter')
  )
  OR (status = 'published' AND public.site_visible(site_id))
);

DROP POLICY IF EXISTS blog_posts_insert ON blog_posts;
CREATE POLICY blog_posts_insert ON blog_posts FOR INSERT TO authenticated WITH CHECK (
  public.can_edit_site(site_id)
  OR (
    owner_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM site_memberships WHERE site_id = blog_posts.site_id AND user_id = auth.uid() AND role = 'reporter')
    AND status IN ('draft','pending_review')
  )
);

DROP POLICY IF EXISTS blog_posts_update ON blog_posts;
CREATE POLICY blog_posts_update ON blog_posts FOR UPDATE TO authenticated
USING (
  public.can_edit_site(site_id)
  OR (owner_user_id = auth.uid() AND status IN ('draft','pending_review'))
)
WITH CHECK (
  public.can_edit_site(site_id)
  OR (owner_user_id = auth.uid() AND status IN ('draft','pending_review'))
);

DROP POLICY IF EXISTS blog_posts_delete ON blog_posts;
CREATE POLICY blog_posts_delete ON blog_posts FOR DELETE TO authenticated USING (
  public.is_super_admin()
  OR public.is_org_admin((SELECT org_id FROM sites WHERE id = blog_posts.site_id))
  OR (public.can_edit_site(site_id) AND status != 'published')
  OR (owner_user_id = auth.uid() AND status IN ('draft','pending_review'))
);

-- campaigns (analogous — editor+ only create; no reporter)
DROP POLICY IF EXISTS campaigns_select ON campaigns;
CREATE POLICY campaigns_select ON campaigns FOR SELECT TO authenticated USING (
  public.can_edit_site(site_id)
  OR (status = 'published' AND public.site_visible(site_id))
);

DROP POLICY IF EXISTS campaigns_insert ON campaigns;
CREATE POLICY campaigns_insert ON campaigns FOR INSERT TO authenticated WITH CHECK (
  public.can_edit_site(site_id)
);

DROP POLICY IF EXISTS campaigns_update ON campaigns;
CREATE POLICY campaigns_update ON campaigns FOR UPDATE TO authenticated
USING (public.can_edit_site(site_id))
WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS campaigns_delete ON campaigns;
CREATE POLICY campaigns_delete ON campaigns FOR DELETE TO authenticated USING (
  public.is_super_admin()
  OR public.is_org_admin((SELECT org_id FROM sites WHERE id = campaigns.site_id))
  OR (public.can_edit_site(site_id) AND status != 'published')
);

-- contact_submissions (editor+ read; org_admin write)
DROP POLICY IF EXISTS contact_submissions_read ON contact_submissions;
CREATE POLICY contact_submissions_read ON contact_submissions FOR SELECT TO authenticated USING (
  public.can_edit_site(site_id)
);
DROP POLICY IF EXISTS contact_submissions_update ON contact_submissions;
CREATE POLICY contact_submissions_update ON contact_submissions FOR UPDATE TO authenticated
USING (public.can_admin_site_users(site_id)) WITH CHECK (public.can_admin_site_users(site_id));

-- newsletter_subscriptions (org_admin only)
DROP POLICY IF EXISTS newsletter_subscriptions_read ON newsletter_subscriptions;
CREATE POLICY newsletter_subscriptions_read ON newsletter_subscriptions FOR SELECT TO authenticated USING (
  public.is_super_admin()
  OR public.is_org_admin((SELECT org_id FROM sites WHERE id = newsletter_subscriptions.site_id))
);

-- site_memberships RLS
DROP POLICY IF EXISTS site_memberships_read ON site_memberships;
CREATE POLICY site_memberships_read ON site_memberships FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR public.can_admin_site_users(site_id)
);
DROP POLICY IF EXISTS site_memberships_write ON site_memberships;
CREATE POLICY site_memberships_write ON site_memberships FOR ALL TO authenticated
USING (public.can_admin_site_users(site_id))
WITH CHECK (public.can_admin_site_users(site_id));

COMMIT;
