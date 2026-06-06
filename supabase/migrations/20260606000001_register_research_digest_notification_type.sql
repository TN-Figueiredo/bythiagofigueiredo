-- Migration: register_research_digest_notification_type
-- Purpose: Register the notification type emitted by the weekly
--          /api/cron/research-digest job (proactive Research Strategist push).
--
-- The notifications.type column has no FK to notification_types, so this is
-- not strictly required for inserts to succeed — but registering it keeps the
-- type catalog complete, enables the cooldown/dedup machinery in
-- createNotification(), and gives the UI a title_template + min_role.
--
-- Idempotent: ON CONFLICT DO UPDATE so re-running is safe.

INSERT INTO notification_types
  (type, domain, priority, min_role, title_template, description, dedup_key, group_key, cooldown_secs, phase)
VALUES
  (
    'pipeline.research_digest',
    'pipeline',
    2,
    'editor',
    'Resumo da estratégia de research',
    'Weekly proactive Research Strategist digest — single highest-priority recommendation for the owner (revisit vencido > foco órfão > tema maduro > research stale).',
    -- dedup handled explicitly by the cron via an ISO-week dedup_key; the
    -- cooldown below is a belt-and-suspenders floor (6 days) so even an
    -- accidental extra weekly run cannot double-notify.
    NULL,
    NULL,
    518400,
    2
  )
ON CONFLICT (type) DO UPDATE SET
  domain         = EXCLUDED.domain,
  priority       = EXCLUDED.priority,
  min_role       = EXCLUDED.min_role,
  title_template = EXCLUDED.title_template,
  description    = EXCLUDED.description,
  cooldown_secs  = EXCLUDED.cooldown_secs,
  phase          = EXCLUDED.phase;
