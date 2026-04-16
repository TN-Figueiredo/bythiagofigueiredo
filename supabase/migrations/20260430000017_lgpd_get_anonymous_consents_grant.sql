-- Sprint 5a: GRANT for get_anonymous_consents, which runs at 013a because
-- its RETURNS SETOF consents requires the consents table (created in 013)
-- to exist at function-declaration time.
-- Wrapped in DO block for CLI 2.90 single-statement parsing safety.

DO $grants$ BEGIN
  EXECUTE $stmt$GRANT EXECUTE ON FUNCTION public.get_anonymous_consents(text) TO anon$stmt$;
END $grants$;
