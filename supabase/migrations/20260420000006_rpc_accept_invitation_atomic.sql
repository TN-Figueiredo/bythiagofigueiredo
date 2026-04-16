-- Sprint 4.75 RPC: accept_invitation_atomic — branches on role_scope
-- Note: existing invitations table stores the sha256 hex token in column `token`
-- (with CHECK '^[a-f0-9]{64}$'). Param is named p_token_hash to signal to
-- callers that they must pre-hash the plaintext token. New signature
-- (p_token_hash, p_user_id) coexists with legacy (p_token) from 20260416000008.

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

GRANT EXECUTE ON FUNCTION public.accept_invitation_atomic(text, uuid) TO authenticated, anon;
