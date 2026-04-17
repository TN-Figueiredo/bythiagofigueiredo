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
  -- Sprint 5a: skip during LGPD phase 1 cascade ops
  IF COALESCE(current_setting('app.skip_cascade_audit', true), '') = '1' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

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

  v_ip_raw := nullif(current_setting('app.client_ip', true), '');
  IF v_ip_raw IS NOT NULL THEN
    BEGIN v_ip := v_ip_raw::inet;
    EXCEPTION WHEN invalid_text_representation THEN v_ip := NULL;
    END;
  END IF;
  IF v_ip IS NULL THEN v_ip := inet_client_addr(); END IF;
  v_ua := nullif(current_setting('app.user_agent', true), '');

  INSERT INTO audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, before_data, after_data, ip, user_agent)
  VALUES (auth.uid(), v_action, TG_TABLE_NAME, v_resource_id, v_org_id, v_site_id, v_before, v_after, v_ip, v_ua);
  RETURN COALESCE(NEW, OLD);
END $$;
