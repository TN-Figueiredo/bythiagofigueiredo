-- 20260420000009_audit_log_ip_ua_capture.sql
-- Sprint 4.75: capture IP + user_agent in audit_log (LGPD accountability).
-- Trigger reads GUC `app.client_ip` + `app.user_agent` (set by middleware/server
-- actions per request) and falls back to `inet_client_addr()` for IP.
-- Without this, audit rows record mutations but not the network context — a gap
-- flagged by the security audit of 2026-04-16.

BEGIN;

-- Helper RPC: middleware / server actions call this at the start of every
-- authenticated request to inject IP + UA into the DB session context.
CREATE OR REPLACE FUNCTION public.set_audit_context(p_ip text, p_user_agent text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    set_config('app.client_ip', COALESCE(p_ip, ''), true),
    set_config('app.user_agent', COALESCE(p_user_agent, ''), true);
  SELECT;
$$;

GRANT EXECUTE ON FUNCTION public.set_audit_context(text, text) TO authenticated, anon;

-- Replace audit trigger to capture IP/UA from GUC (with fallback to
-- inet_client_addr() for requests that forgot to set the context).
CREATE OR REPLACE FUNCTION public.tg_audit_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action text := lower(TG_OP);
  v_before jsonb := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  v_after jsonb := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  v_org_id uuid;
  v_site_id uuid;
  v_resource_id uuid;
  v_ip inet;
  v_ua text;
  v_ip_raw text;
BEGIN
  v_resource_id := COALESCE((NEW).id, (OLD).id);

  IF TG_TABLE_NAME = 'organization_members' THEN
    v_org_id := COALESCE(NEW.org_id, OLD.org_id);
  ELSIF TG_TABLE_NAME = 'site_memberships' THEN
    v_site_id := COALESCE(NEW.site_id, OLD.site_id);
    SELECT org_id INTO v_org_id FROM sites WHERE id = v_site_id;
  ELSIF TG_TABLE_NAME = 'invitations' THEN
    v_org_id := COALESCE(NEW.org_id, OLD.org_id);
    v_site_id := COALESCE(NEW.site_id, OLD.site_id);
  END IF;

  -- IP: prefer app-injected value; fall back to PG client addr. Tolerate
  -- malformed strings (e.g. 'unknown') by catching the cast.
  v_ip_raw := nullif(current_setting('app.client_ip', true), '');
  IF v_ip_raw IS NOT NULL THEN
    BEGIN
      v_ip := v_ip_raw::inet;
    EXCEPTION WHEN invalid_text_representation THEN
      v_ip := NULL;
    END;
  END IF;
  IF v_ip IS NULL THEN
    v_ip := inet_client_addr();
  END IF;

  v_ua := nullif(current_setting('app.user_agent', true), '');

  INSERT INTO audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, before_data, after_data, ip, user_agent)
  VALUES (auth.uid(), v_action, TG_TABLE_NAME, v_resource_id, v_org_id, v_site_id, v_before, v_after, v_ip, v_ua);
  RETURN COALESCE(NEW, OLD);
END $$;

COMMIT;
