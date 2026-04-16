-- supabase/migrations/20260420000004_rbac_v3_publish_trigger.sql
BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_publish_permission() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('published','scheduled')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NOT public.can_publish_site(NEW.site_id) THEN
      RAISE EXCEPTION 'insufficient_access: cannot publish on site %', NEW.site_id
        USING ERRCODE = 'P0001', HINT = 'requires_editor_role';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_publish_blog ON blog_posts;
CREATE TRIGGER trg_enforce_publish_blog
  BEFORE INSERT OR UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_publish_permission();

DROP TRIGGER IF EXISTS trg_enforce_publish_campaign ON campaigns;
CREATE TRIGGER trg_enforce_publish_campaign
  BEFORE INSERT OR UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION public.enforce_publish_permission();

COMMIT;
