-- Sprint 4.75: GRANTs for all new v3 RPCs.
--
-- Wrapped in a single DO block because Supabase CLI 2.90's statement parser
-- conflates sequential `GRANT` statements into a single prepared statement
-- and fails with "cannot insert multiple commands into a prepared statement"
-- (SQLSTATE 42601) — even with BEGIN/COMMIT wrapping.
--
-- DO blocks are ALWAYS parsed as one top-level statement by the CLI. The
-- inner `EXECUTE $stmt$ ... $stmt$;` runs each GRANT dynamically.
--
-- Same workaround used by `20260416000019_consolidated_grants.sql`.

DO $grants$ BEGIN
  EXECUTE $stmt$GRANT EXECUTE ON FUNCTION public.accept_invitation_atomic(text, uuid) TO authenticated, anon$stmt$;
  EXECUTE $stmt$GRANT EXECUTE ON FUNCTION public.user_accessible_sites() TO authenticated$stmt$;
  EXECUTE $stmt$GRANT EXECUTE ON FUNCTION public.reassign_content(uuid, uuid, uuid) TO authenticated$stmt$;
  EXECUTE $stmt$GRANT EXECUTE ON FUNCTION public.get_site_branding(uuid) TO authenticated, anon$stmt$;
  EXECUTE $stmt$GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated$stmt$;
  EXECUTE $stmt$GRANT EXECUTE ON FUNCTION public.increment_invitation_resend(uuid) TO authenticated$stmt$;
  EXECUTE $stmt$GRANT EXECUTE ON FUNCTION public.set_audit_context(text, text) TO authenticated, anon$stmt$;
END $grants$;
