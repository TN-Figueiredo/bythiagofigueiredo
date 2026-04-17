-- Sprint 5a fix: phase3_prenullify_fks referenced by domain-adapter.ts but
-- was never declared. Without this, phase-3 hard delete throws and requests
-- are silently marked completed_soft forever.

CREATE OR REPLACE FUNCTION public.lgpd_phase3_prenullify_fks(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.authors SET user_id = NULL WHERE user_id = p_user_id;
  UPDATE public.blog_posts SET owner_user_id = NULL WHERE owner_user_id = p_user_id;
  UPDATE public.campaigns SET owner_user_id = NULL WHERE owner_user_id = p_user_id;
  UPDATE public.audit_log SET actor_user_id = NULL WHERE actor_user_id = p_user_id;
  UPDATE public.invitations SET invited_by = NULL WHERE invited_by = p_user_id AND accepted_at IS NULL;
  UPDATE public.invitations SET accepted_by_user_id = NULL WHERE accepted_by_user_id = p_user_id;
END $$;

DO $grants$ BEGIN
  EXECUTE $stmt$REVOKE EXECUTE ON FUNCTION public.lgpd_phase3_prenullify_fks(uuid) FROM public$stmt$;
  EXECUTE $stmt$GRANT EXECUTE ON FUNCTION public.lgpd_phase3_prenullify_fks(uuid) TO service_role$stmt$;
END $grants$;
