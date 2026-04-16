-- Sprint 5a: GRANTs for all LGPD RPCs.
-- Wrapped in DO block so Supabase CLI 2.90 parses file as single statement.

DO $grants$ BEGIN
  EXECUTE $stmt$GRANT EXECUTE ON FUNCTION public.check_deletion_safety(uuid) TO authenticated$stmt$;
  EXECUTE $stmt$GRANT EXECUTE ON FUNCTION public.purge_deleted_user_audit(uuid) TO service_role$stmt$;
  EXECUTE $stmt$GRANT EXECUTE ON FUNCTION public.reassign_authors(uuid, uuid) TO authenticated$stmt$;
  EXECUTE $stmt$GRANT EXECUTE ON FUNCTION public.cancel_account_deletion_in_grace(text) TO anon, authenticated$stmt$;
  EXECUTE $stmt$REVOKE EXECUTE ON FUNCTION public.lgpd_phase1_cleanup(uuid, jsonb) FROM public$stmt$;
  EXECUTE $stmt$GRANT EXECUTE ON FUNCTION public.lgpd_phase1_cleanup(uuid, jsonb) TO service_role$stmt$;
  EXECUTE $stmt$GRANT EXECUTE ON FUNCTION public.merge_anonymous_consents(text) TO authenticated$stmt$;
  EXECUTE $stmt$GRANT EXECUTE ON FUNCTION public.get_anonymous_consents(text) TO anon$stmt$;
END $grants$;
