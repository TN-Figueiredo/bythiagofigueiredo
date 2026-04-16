-- Sprint 4.75: GRANTs for all new RPCs.
-- Extracted into a separate migration because Supabase CLI 2.90 fails when
-- a file mixes `CREATE FUNCTION ... $$ ... $$` with trailing GRANT
-- (multi-statement file with one dollar-quoted block trips the prepared-
-- statement splitter). GRANTs alone, split on `;`, apply cleanly.

GRANT EXECUTE ON FUNCTION public.accept_invitation_atomic(text, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_accessible_sites() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_content(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_site_branding(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_invitation_resend(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_audit_context(text, text) TO authenticated, anon;
