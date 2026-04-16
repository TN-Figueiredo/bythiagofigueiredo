-- Sprint 4.75 RPC: get_site_branding — fetch per-site login branding.
-- Returns shape: { name, logo_url, primary_color, primary_domain, default_locale }
CREATE OR REPLACE FUNCTION public.get_site_branding(p_site_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'name', s.name,
    'logo_url', s.logo_url,
    'primary_color', s.primary_color,
    'primary_domain', s.primary_domain,
    'default_locale', s.default_locale
  ) FROM sites s WHERE s.id = p_site_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_site_branding(uuid) TO authenticated, anon;
