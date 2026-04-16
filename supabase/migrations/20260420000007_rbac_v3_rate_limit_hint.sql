-- supabase/migrations/20260420000007_rbac_v3_rate_limit_hint.sql
-- Update invitations rate limit trigger to use distinct HINT so app can differentiate
-- from unique-violation (23505).

BEGIN;

CREATE OR REPLACE FUNCTION public.invitations_rate_limit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM invitations
  WHERE org_id = NEW.org_id AND created_at > now() - interval '1 hour';
  IF v_count >= 20 THEN
    RAISE EXCEPTION 'invitation rate limit exceeded (20/hour/org)'
      USING ERRCODE = 'P0001', HINT = 'rate_limit';
  END IF;
  RETURN NEW;
END $$;

-- Trigger already exists from Sprint 3 — only the function body changed.

COMMIT;
