-- Track which send pipeline was used so the webhook handler can branch correctly.
ALTER TABLE newsletter_sends
  ADD COLUMN IF NOT EXISTS link_rewrite_enabled boolean NOT NULL DEFAULT false;

-- Index so the webhook handler can find rows quickly by provider_message_id
-- (already exists from Sprint 5e / SES migration) — no new index needed.
