-- Sprint 4.75 RPC: user_accessible_sites — powers the site switcher.
CREATE OR REPLACE FUNCTION public.user_accessible_sites() RETURNS TABLE (
  site_id uuid, site_name text, site_slug text, primary_domain text,
  org_id uuid, org_name text, user_role text, is_master_ring boolean
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.name, s.slug, s.primary_domain, s.org_id, o.name,
    CASE
      WHEN public.is_super_admin() THEN 'super_admin'
      WHEN public.is_org_admin(s.org_id) THEN 'org_admin'
      ELSE (SELECT role FROM site_memberships WHERE site_id = s.id AND user_id = auth.uid())
    END AS user_role,
    (o.parent_org_id IS NULL) AS is_master_ring
  FROM sites s JOIN organizations o ON o.id = s.org_id
  WHERE public.can_view_site(s.id)
  ORDER BY (CASE WHEN o.parent_org_id IS NULL THEN 0 ELSE 1 END), o.name, s.name;
$$;

GRANT EXECUTE ON FUNCTION public.user_accessible_sites() TO authenticated;
