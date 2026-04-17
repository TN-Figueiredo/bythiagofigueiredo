-- Fix can_admin_site_for_user and is_org_staff_for_user to work with RBAC v3.
-- The previous implementation checked organization_members for roles
-- ('owner','admin','editor') which were removed in 20260420000060 (only
-- 'org_admin' is valid now). Also wires in site_memberships editors so that
-- the area-authorization tests match the actual RBAC v3 access model.

CREATE OR REPLACE FUNCTION public.is_org_staff_for_user(p_org_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE org_id = p_org_id AND user_id = p_user_id AND role = 'org_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_admin_site_for_user(p_site_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org_id uuid;
  v_parent_org_id uuid;
BEGIN
  SELECT s.org_id, o.parent_org_id INTO v_org_id, v_parent_org_id
  FROM public.sites s
  JOIN public.organizations o ON o.id = s.org_id
  WHERE s.id = p_site_id;

  IF v_org_id IS NULL THEN RETURN FALSE; END IF;

  -- Check org_admin (RBAC v3) of the site's direct org or its parent (cascade-up).
  IF EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = p_user_id
      AND role = 'org_admin'
      AND org_id IN (v_org_id, v_parent_org_id)
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check site_memberships: editors have site-level edit access.
  IF EXISTS (
    SELECT 1 FROM site_memberships
    WHERE site_id = p_site_id AND user_id = p_user_id AND role = 'editor'
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END $$;
