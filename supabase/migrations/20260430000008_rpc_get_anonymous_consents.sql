-- Sprint 5a: get_anonymous_consents — lookup endpoint for pre-auth clients.
-- SECURITY INVOKER so RLS applies (anon role policy on consents allows read
-- of rows matching a given anonymous_id — policy installed in 013).
--
-- App layer enforces rate limits (per-IP, per-anon-id) — DB trusts the input.

CREATE OR REPLACE FUNCTION public.get_anonymous_consents(p_anonymous_id text)
RETURNS SETOF consents
LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT * FROM consents
  WHERE anonymous_id = p_anonymous_id
    AND user_id IS NULL;
$$;
