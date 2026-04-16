-- Snapshot FK-affected rows BEFORE migration 011 changes delete semantics.
-- Retention: drop after 30d confidence window (manual via admin console).

CREATE TABLE IF NOT EXISTS lgpd_migration_backup_v1 (
  table_name text NOT NULL,
  row_snapshot jsonb NOT NULL,
  backed_up_at timestamptz DEFAULT now()
);

INSERT INTO lgpd_migration_backup_v1 (table_name, row_snapshot)
SELECT 'blog_posts', to_jsonb(bp) FROM blog_posts bp WHERE owner_user_id IS NOT NULL
UNION ALL
SELECT 'campaigns', to_jsonb(c) FROM campaigns c WHERE owner_user_id IS NOT NULL
UNION ALL
SELECT 'audit_log_sample', to_jsonb(a) FROM audit_log a
  WHERE actor_user_id IS NOT NULL
  ORDER BY created_at DESC LIMIT 10000;
