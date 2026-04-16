-- At phase-3 hard delete (auth.admin.deleteUser), the lgpd_requests row
-- currently cascades away, destroying retention evidence. Change to
-- SET NULL so the row survives for the 5-year retention window.

ALTER TABLE lgpd_requests DROP CONSTRAINT IF EXISTS lgpd_requests_user_id_fkey;
ALTER TABLE lgpd_requests ADD CONSTRAINT lgpd_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE lgpd_requests ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS policy so super_admin still sees null-user rows (self-read
-- naturally skips them since null != auth.uid()).
DROP POLICY IF EXISTS lgpd_requests_self_read ON lgpd_requests;
CREATE POLICY lgpd_requests_self_read ON lgpd_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());
