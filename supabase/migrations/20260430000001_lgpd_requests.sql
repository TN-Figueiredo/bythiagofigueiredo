-- Sprint 5a: lgpd_requests table tracks deletion/export/consent_revocation lifecycle.

CREATE TABLE IF NOT EXISTS lgpd_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('data_export','account_deletion','consent_revocation')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','completed_soft','cancelled','failed')),
  phase int CHECK (phase BETWEEN 1 AND 3),
  confirmation_token_hash text UNIQUE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  scheduled_purge_at timestamptz,
  phase_1_completed_at timestamptz,
  phase_3_completed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  blob_path text,
  blob_uploaded_at timestamptz,
  blob_deleted_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS lgpd_requests_one_pending
  ON lgpd_requests(user_id, type)
  WHERE status IN ('pending','processing');

CREATE INDEX IF NOT EXISTS lgpd_requests_scheduled_purge
  ON lgpd_requests(scheduled_purge_at)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS lgpd_requests_blob_cleanup
  ON lgpd_requests(blob_uploaded_at)
  WHERE blob_deleted_at IS NULL AND blob_path IS NOT NULL;

ALTER TABLE lgpd_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lgpd_requests_self_read ON lgpd_requests;
CREATE POLICY lgpd_requests_self_read ON lgpd_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS lgpd_requests_self_insert ON lgpd_requests;
CREATE POLICY lgpd_requests_self_insert ON lgpd_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
