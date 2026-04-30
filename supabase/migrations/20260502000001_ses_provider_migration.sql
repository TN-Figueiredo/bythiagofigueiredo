-- SES provider migration: make email infrastructure provider-agnostic
-- Renames Resend-specific columns/indexes so SES (or any future provider) can reuse them.
-- All operations are metadata-only (no table rewrite, no lock, instant).

-- 1. Add 'ses' to email_provider enum (used by sent_emails table)
ALTER TYPE public.email_provider ADD VALUE IF NOT EXISTS 'ses';

-- 2. Rename resend-specific column in newsletter_sends
ALTER TABLE public.newsletter_sends
  RENAME COLUMN resend_message_id TO provider_message_id;

-- 3. Rename the partial unique index on provider_message_id
ALTER INDEX IF EXISTS newsletter_sends_resend_msg
  RENAME TO newsletter_sends_provider_msg;

-- 4. Rename webhook_events dedup column (svix_id → idempotency_key)
--    svix_id was Resend-specific (Svix signatures); SNS uses MessageId
ALTER TABLE public.webhook_events
  RENAME COLUMN svix_id TO idempotency_key;

-- 5. Rename the auto-generated unique constraint index
--    Postgres auto-creates "webhook_events_svix_id_key" for inline UNIQUE
ALTER INDEX IF EXISTS webhook_events_svix_id_key
  RENAME TO webhook_events_idempotency_key;
