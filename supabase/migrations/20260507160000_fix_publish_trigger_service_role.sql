-- Fix: enforce_publish_permission trigger blocked service_role calls,
-- causing movePost('published') to silently fail from server actions.
-- Add service_role bypass consistent with is_member_staff() pattern (line 4349).

CREATE OR REPLACE FUNCTION public.enforce_publish_permission()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('published','scheduled')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Service-role calls already validated permissions in the server action
    IF auth.role() IN ('service_role','supabase_admin') THEN
      RETURN NEW;
    END IF;
    IF NOT public.can_publish_site(NEW.site_id) THEN
      RAISE EXCEPTION 'insufficient_access: cannot publish on site %', NEW.site_id
        USING ERRCODE = 'P0001', HINT = 'requires_editor_role';
    END IF;
  END IF;
  RETURN NEW;
END $$;
