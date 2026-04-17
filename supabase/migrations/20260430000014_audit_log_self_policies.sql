DROP POLICY IF EXISTS audit_log_self_lifecycle_target ON audit_log;
CREATE POLICY audit_log_self_lifecycle_target ON audit_log FOR SELECT TO authenticated
USING (resource_type = 'auth_user' AND resource_id = auth.uid());

DROP POLICY IF EXISTS audit_log_self_as_actor ON audit_log;
CREATE POLICY audit_log_self_as_actor ON audit_log FOR SELECT TO authenticated
USING (actor_user_id = auth.uid());
