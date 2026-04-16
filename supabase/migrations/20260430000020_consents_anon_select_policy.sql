-- get_anonymous_consents is SECURITY INVOKER + granted to anon, but
-- consents RLS only has consents_self_read for authenticated. Result:
-- anon calls always return empty. Add a tight anon-read policy.

DROP POLICY IF EXISTS consents_anon_by_id_read ON consents;
CREATE POLICY consents_anon_by_id_read ON consents FOR SELECT TO anon
  USING (anonymous_id IS NOT NULL AND user_id IS NULL);
