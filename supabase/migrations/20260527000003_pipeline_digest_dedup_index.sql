-- =============================================================================
-- MIGRATION: Partial unique index on sent_emails for pipeline digest dedup
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS sent_emails_pipeline_digest_daily
  ON public.sent_emails (site_id, to_email, ((sent_at AT TIME ZONE 'America/Sao_Paulo')::date))
  WHERE template_name = 'pipeline-deadline-digest';
