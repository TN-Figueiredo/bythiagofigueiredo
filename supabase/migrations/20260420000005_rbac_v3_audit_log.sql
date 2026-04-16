-- supabase/migrations/20260420000005_rbac_v3_audit_log.sql
BEGIN;

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  org_id uuid REFERENCES organizations(id),
  site_id uuid REFERENCES sites(id),
  before_data jsonb,
  after_data jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_org_created ON audit_log (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_site_created ON audit_log (site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor ON audit_log (actor_user_id, created_at DESC);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_read ON audit_log;
CREATE POLICY audit_log_read ON audit_log FOR SELECT TO authenticated USING (
  public.is_super_admin() OR (org_id IS NOT NULL AND public.is_org_admin(org_id))
);
-- No write policy — only service-role + triggers can insert

CREATE OR REPLACE FUNCTION public.tg_audit_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action text := lower(TG_OP);
  v_before jsonb := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  v_after jsonb := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  v_org_id uuid;
  v_site_id uuid;
  v_resource_id uuid;
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

  INSERT INTO audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, before_data, after_data)
  VALUES (auth.uid(), v_action, TG_TABLE_NAME, v_resource_id, v_org_id, v_site_id, v_before, v_after);
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS audit_organization_members ON organization_members;
CREATE TRIGGER audit_organization_members
  AFTER INSERT OR UPDATE OR DELETE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_mutation();

DROP TRIGGER IF EXISTS audit_site_memberships ON site_memberships;
CREATE TRIGGER audit_site_memberships
  AFTER INSERT OR UPDATE OR DELETE ON site_memberships
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_mutation();

DROP TRIGGER IF EXISTS audit_invitations ON invitations;
CREATE TRIGGER audit_invitations
  AFTER INSERT OR UPDATE OR DELETE ON invitations
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_mutation();

COMMIT;
