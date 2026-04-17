CREATE TABLE IF NOT EXISTS consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_id text,
  category text NOT NULL CHECK (category IN ('cookie_functional','cookie_analytics','cookie_marketing','newsletter','privacy_policy','terms_of_service')),
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  consent_text_id text NOT NULL REFERENCES consent_texts(id),
  granted boolean NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  ip inet,
  user_agent text,
  CHECK ((user_id IS NOT NULL AND anonymous_id IS NULL) OR (user_id IS NULL AND anonymous_id IS NOT NULL)),
  CHECK (anonymous_id IS NULL OR anonymous_id ~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS consents_auth_current
  ON consents(user_id, category, site_id) WHERE user_id IS NOT NULL AND withdrawn_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS consents_anon_current
  ON consents(anonymous_id, category, site_id) WHERE anonymous_id IS NOT NULL AND withdrawn_at IS NULL;

CREATE INDEX IF NOT EXISTS consents_user_lookup ON consents(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS consents_anon_lookup ON consents(anonymous_id) WHERE anonymous_id IS NOT NULL;

ALTER TABLE consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consents_self_read ON consents;
CREATE POLICY consents_self_read ON consents FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS consents_self_insert ON consents;
CREATE POLICY consents_self_insert ON consents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS consents_self_update ON consents;
CREATE POLICY consents_self_update ON consents FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Audit trigger reuses Sprint 4.75 tg_audit_mutation
DROP TRIGGER IF EXISTS audit_consents ON consents;
CREATE TRIGGER audit_consents
  AFTER INSERT OR UPDATE OR DELETE ON consents
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_mutation();
