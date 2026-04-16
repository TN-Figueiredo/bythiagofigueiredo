-- supabase/migrations/20260420000006_rbac_v3_rpcs.sql
BEGIN;

-- 1. accept_invitation_atomic — branches on role_scope
-- Note: existing invitations table stores the sha256 hex token in column `token`
-- (with CHECK '^[a-f0-9]{64}$'). Keeping that column name; param is named
-- p_token_hash to signal to callers that they must pre-hash the plaintext token.
-- New signature (p_token_hash, p_user_id) coexists with the legacy
-- (p_token) variant from 20260416000008 so this migration is additive.
CREATE OR REPLACE FUNCTION public.accept_invitation_atomic(p_token_hash text, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv invitations%ROWTYPE;
  v_redirect_url text;
BEGIN
  SELECT * INTO v_inv FROM invitations
  WHERE token = p_token_hash
    AND accepted_at IS NULL AND revoked_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation_invalid' USING ERRCODE = 'P0002';
  END IF;

  IF v_inv.role_scope = 'org' THEN
    INSERT INTO organization_members (org_id, user_id, role)
    VALUES (v_inv.org_id, p_user_id, v_inv.role)
    ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;
    v_redirect_url := 'https://bythiagofigueiredo.com/cms/login';
  ELSIF v_inv.role_scope = 'site' THEN
    INSERT INTO site_memberships (site_id, user_id, role, created_by)
    VALUES (v_inv.site_id, p_user_id, v_inv.role, v_inv.invited_by)
    ON CONFLICT (site_id, user_id) DO UPDATE SET role = EXCLUDED.role;
    SELECT 'https://' || s.primary_domain || '/cms/login'
    INTO v_redirect_url FROM sites s WHERE s.id = v_inv.site_id;
  END IF;

  UPDATE invitations SET accepted_at = now() WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'redirect_url', v_redirect_url,
    'role_scope', v_inv.role_scope,
    'role', v_inv.role,
    'org_id', v_inv.org_id,
    'site_id', v_inv.site_id
  );
END $$;

-- 2. user_accessible_sites
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

-- 3. reassign_content
CREATE OR REPLACE FUNCTION public.reassign_content(
  p_from_user uuid, p_to_user uuid, p_site_id uuid
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer := 0; v_tmp integer;
BEGIN
  IF NOT public.can_admin_site_users(p_site_id) THEN
    RAISE EXCEPTION 'insufficient_access' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_super_admin()
    OR public.is_org_admin((SELECT org_id FROM sites WHERE id = p_site_id))
    OR EXISTS (SELECT 1 FROM site_memberships WHERE user_id = p_to_user AND site_id = p_site_id AND role = 'editor')) THEN
    RAISE EXCEPTION 'target_user_not_eligible' USING ERRCODE = 'P0003';
  END IF;
  UPDATE blog_posts SET owner_user_id = p_to_user
    WHERE site_id = p_site_id AND owner_user_id = p_from_user;
  GET DIAGNOSTICS v_tmp = ROW_COUNT;
  v_count := v_count + v_tmp;
  UPDATE campaigns SET owner_user_id = p_to_user
    WHERE site_id = p_site_id AND owner_user_id = p_from_user;
  GET DIAGNOSTICS v_tmp = ROW_COUNT;
  v_count := v_count + v_tmp;
  RETURN v_count;
END $$;

-- 4. get_site_branding
CREATE OR REPLACE FUNCTION public.get_site_branding(p_site_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'name', s.name,
    'primary_domain', s.primary_domain,
    'default_locale', s.default_locale
  ) FROM sites s WHERE s.id = p_site_id;
$$;

-- 5. increment_invitation_resend — add permission check on top of Sprint 3's
-- cooldown behavior. The function pre-existed (20260416000013 return type
-- boolean); we drop + recreate with an org_admin guard so the caller can
-- differentiate cooldown (returns false) from insufficient_access (P0001).
DROP FUNCTION IF EXISTS public.increment_invitation_resend(uuid);
CREATE OR REPLACE FUNCTION public.increment_invitation_resend(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org_id uuid;
  v_updated int;
BEGIN
  SELECT org_id INTO v_org_id FROM invitations WHERE id = p_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  IF NOT public.is_org_admin(v_org_id) THEN
    RAISE EXCEPTION 'insufficient_access' USING ERRCODE = 'P0001';
  END IF;
  UPDATE invitations
     SET resend_count = resend_count + 1,
         resent_at = now(),
         last_sent_at = now()
   WHERE id = p_id
     AND (last_sent_at IS NULL OR last_sent_at < now() - interval '30 seconds');
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END $$;

GRANT EXECUTE ON FUNCTION public.accept_invitation_atomic(text, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_accessible_sites() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_content(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_site_branding(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.increment_invitation_resend(uuid) TO authenticated;

COMMIT;
