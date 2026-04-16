-- supabase/migrations/20260420000002_rbac_v3_helpers.sql
BEGIN;

CREATE OR REPLACE FUNCTION public.is_super_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members om
    JOIN organizations o ON o.id = om.org_id
    WHERE om.user_id = auth.uid()
      AND om.role = 'org_admin'
      AND o.parent_org_id IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT public.is_super_admin()
  OR EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid() AND org_id = p_org_id AND role = 'org_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_site(p_site_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT public.is_super_admin()
  OR EXISTS (SELECT 1 FROM sites s WHERE s.id = p_site_id AND public.is_org_admin(s.org_id))
  OR EXISTS (SELECT 1 FROM site_memberships WHERE site_id = p_site_id AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.can_edit_site(p_site_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT public.is_super_admin()
  OR EXISTS (SELECT 1 FROM sites s WHERE s.id = p_site_id AND public.is_org_admin(s.org_id))
  OR EXISTS (SELECT 1 FROM site_memberships WHERE site_id = p_site_id AND user_id = auth.uid() AND role = 'editor');
$$;

CREATE OR REPLACE FUNCTION public.can_publish_site(p_site_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT public.can_edit_site(p_site_id);
$$;

CREATE OR REPLACE FUNCTION public.can_admin_site_users(p_site_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT public.is_super_admin()
  OR EXISTS (SELECT 1 FROM sites s WHERE s.id = p_site_id AND public.is_org_admin(s.org_id));
$$;

CREATE OR REPLACE FUNCTION public.is_member_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT public.is_super_admin()
  OR EXISTS (SELECT 1 FROM organization_members WHERE user_id = auth.uid() AND role = 'org_admin')
  OR EXISTS (SELECT 1 FROM site_memberships WHERE user_id = auth.uid() AND role IN ('editor','reporter'));
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_site(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_site(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_publish_site(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_admin_site_users(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member_staff() TO authenticated;

COMMIT;
