-- =============================================================================
-- MIGRATION: Partial unique index on sent_emails for pipeline digest dedup
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS sent_emails_pipeline_digest_daily
  ON public.sent_emails (user_id, date_trunc('day', sent_at))
  WHERE template_name = 'pipeline-deadline-digest';
