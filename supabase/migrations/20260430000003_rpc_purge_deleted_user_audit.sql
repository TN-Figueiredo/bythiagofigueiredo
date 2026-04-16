-- Sprint 5a: purge_deleted_user_audit — scrubs PII in audit_log before/after_data
-- for a user that has been hard-deleted. Keeps row structure + keys so audit
-- trail remains (who-did-what timeline) but strips PII fields.
--
-- Matches rows where the user appears as actor OR as the target of the
-- mutation (user_id embedded in payload). Parenthesized OR is critical to
-- avoid operator-precedence bugs.

CREATE OR REPLACE FUNCTION public.purge_deleted_user_audit(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE audit_log
  SET
    before_data = CASE
      WHEN before_data IS NULL THEN NULL
      ELSE before_data
        - 'email'
        - 'name'
        - 'ip'
        - 'user_agent'
        - 'message'
    END,
    after_data = CASE
      WHEN after_data IS NULL THEN NULL
      ELSE after_data
        - 'email'
        - 'name'
        - 'ip'
        - 'user_agent'
        - 'message'
    END
  WHERE (
    actor_user_id = p_user_id
    OR (before_data->>'user_id') = p_user_id::text
    OR (after_data->>'user_id') = p_user_id::text
  );
END $$;
