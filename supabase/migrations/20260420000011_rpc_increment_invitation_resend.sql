-- Sprint 4.75 RPC: increment_invitation_resend — adds permission check on
-- top of Sprint 3's cooldown behavior. Drop + recreate so callers can
-- differentiate cooldown (P0001 HINT='cooldown') from insufficient_access
-- (P0001 with no HINT). Branches on role_scope.

DROP FUNCTION IF EXISTS public.increment_invitation_resend(uuid);

CREATE OR REPLACE FUNCTION public.increment_invitation_resend(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv invitations%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM invitations WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  IF v_inv.role_scope = 'org' THEN
    IF NOT public.is_org_admin(v_inv.org_id) THEN
      RAISE EXCEPTION 'insufficient_access' USING ERRCODE = 'P0001';
    END IF;
  ELSIF v_inv.role_scope = 'site' THEN
    IF NOT public.can_admin_site_users(v_inv.site_id) THEN
      RAISE EXCEPTION 'insufficient_access' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF v_inv.last_sent_at > now() - interval '30 seconds' THEN
    RAISE EXCEPTION 'resend_cooldown' USING ERRCODE = 'P0001', HINT = 'cooldown';
  END IF;
  UPDATE invitations SET resend_count = resend_count + 1, last_sent_at = now() WHERE id = p_id;
END $$;

GRANT EXECUTE ON FUNCTION public.increment_invitation_resend(uuid) TO authenticated;
