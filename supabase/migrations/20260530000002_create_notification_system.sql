-- Migration: create_notification_system
-- Purpose: All 6 notification tables + indexes + RLS + triggers + notification_types seed
-- Spec: Section 1.1, 1.2

-- ========================================================================
-- 1. notification_types reference table (must exist before FK from notifications)
-- ========================================================================
CREATE TABLE notification_types (
  type          text PRIMARY KEY,
  domain        text NOT NULL,
  priority      int  NOT NULL CHECK (priority BETWEEN 1 AND 5),
  min_role      text NOT NULL DEFAULT 'editor',
  title_template text NOT NULL,
  description   text,
  dedup_key     text,
  group_key     text,
  cooldown_secs int,
  phase         int NOT NULL DEFAULT 1 CHECK (phase IN (1, 2))
);

-- ========================================================================
-- 2. notifications (fan-out pattern)
-- ========================================================================
CREATE TABLE notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type          text NOT NULL,
  domain        text NOT NULL CHECK (domain IN ('pipeline','youtube','newsletter','social','links','blog','media','system')),
  priority      int  NOT NULL CHECK (priority BETWEEN 1 AND 5),
  title         text NOT NULL,
  message       text,
  payload       jsonb,
  dedup_key     text,
  group_key     text,
  read_at       timestamptz,
  dismissed_at  timestamptz,
  expired_at    timestamptz,
  snoozed_until timestamptz,
  suggested_action text,
  action_href   text,
  created_at    timestamptz NOT NULL DEFAULT now()
) WITH (fillfactor = 70);

-- NO NULL broadcasts: user_id is required
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_not_null CHECK (user_id IS NOT NULL);

-- ========================================================================
-- 3. notification_deliveries (retry queue)
-- ========================================================================
CREATE TABLE notification_deliveries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel         text NOT NULL CHECK (channel IN ('email','push','telegram')),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','dead')),
  attempts        int  NOT NULL DEFAULT 0,
  next_retry_at   timestamptz,
  last_error      text,
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ========================================================================
-- 4. notification_preferences
-- ========================================================================
CREATE TABLE notification_preferences (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id               uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  category              text,
  channel_in_app        boolean NOT NULL DEFAULT true,
  channel_email         boolean NOT NULL DEFAULT false,
  channel_push          boolean NOT NULL DEFAULT false,
  channel_telegram      boolean NOT NULL DEFAULT false,
  frequency_mode        text NOT NULL DEFAULT 'regular' CHECK (frequency_mode IN ('calm','regular','power')),
  quiet_hours_enabled   boolean NOT NULL DEFAULT false,
  quiet_hours_start     text NOT NULL DEFAULT '22:00',
  quiet_hours_end       text NOT NULL DEFAULT '08:00',
  quiet_hours_timezone  text NOT NULL DEFAULT 'America/Sao_Paulo',
  email_consent_at      timestamptz,
  push_consent_at       timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, site_id, category)
);

-- ========================================================================
-- 5. push_subscriptions
-- ========================================================================
CREATE TABLE push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id       uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  endpoint      text NOT NULL,
  p256dh        text NOT NULL,
  auth          text NOT NULL,
  device_label  text,
  failure_count int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

-- ========================================================================
-- 6. telegram_connection_tokens
-- ========================================================================
CREATE TABLE telegram_connection_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id    uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========================================================================
-- Indexes
-- ========================================================================

-- Partial dedup index (only where dedup_key is set)
CREATE UNIQUE INDEX idx_notifications_dedup
  ON notifications (site_id, user_id, dedup_key)
  WHERE dedup_key IS NOT NULL;

-- Bell count, popover list
CREATE INDEX idx_notif_user_unread
  ON notifications (user_id, site_id)
  WHERE read_at IS NULL AND dismissed_at IS NULL;

-- Inbox pagination
CREATE INDEX idx_notif_user_created
  ON notifications (user_id, site_id, created_at DESC);

-- Domain filter chips
CREATE INDEX idx_notif_user_domain
  ON notifications (user_id, site_id, domain);

-- Threading
CREATE INDEX idx_notif_group_key
  ON notifications (group_key)
  WHERE group_key IS NOT NULL;

-- Cron unsnooze
CREATE INDEX idx_notif_snoozed
  ON notifications (snoozed_until)
  WHERE snoozed_until IS NOT NULL;

-- Cron cleanup
CREATE INDEX idx_notif_expired
  ON notifications (expired_at)
  WHERE expired_at IS NOT NULL;

-- Delivery worker: FOR UPDATE SKIP LOCKED
CREATE INDEX idx_deliveries_pending
  ON notification_deliveries (next_retry_at)
  WHERE status = 'pending';

-- ========================================================================
-- RLS
-- ========================================================================

ALTER TABLE notification_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_connection_tokens ENABLE ROW LEVEL SECURITY;

-- notification_types: readable by all authenticated (reference data)
DROP POLICY IF EXISTS notification_types_select ON notification_types;
CREATE POLICY notification_types_select ON notification_types
  FOR SELECT TO authenticated USING (true);

-- notifications: user can read own
DROP POLICY IF EXISTS notifications_select_own ON notifications;
CREATE POLICY notifications_select_own ON notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- notifications: service role only for INSERT (createNotification is server-side)
-- No INSERT policy for authenticated = service role only

-- notifications: user can update own (read/dismiss only — immutability trigger guards content)
DROP POLICY IF EXISTS notifications_update_own ON notifications;
CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- notification_deliveries: service role only (no policies for authenticated)
-- All operations on deliveries happen via service role

-- notification_preferences: user CRUD own
DROP POLICY IF EXISTS notif_prefs_select_own ON notification_preferences;
CREATE POLICY notif_prefs_select_own ON notification_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS notif_prefs_insert_own ON notification_preferences;
CREATE POLICY notif_prefs_insert_own ON notification_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notif_prefs_update_own ON notification_preferences;
CREATE POLICY notif_prefs_update_own ON notification_preferences
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- push_subscriptions: user CRUD own
DROP POLICY IF EXISTS push_subs_select_own ON push_subscriptions;
CREATE POLICY push_subs_select_own ON push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_subs_insert_own ON push_subscriptions;
CREATE POLICY push_subs_insert_own ON push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subs_update_own ON push_subscriptions;
CREATE POLICY push_subs_update_own ON push_subscriptions
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_subs_delete_own ON push_subscriptions;
CREATE POLICY push_subs_delete_own ON push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- telegram_connection_tokens: user can read own, service role for insert/update
DROP POLICY IF EXISTS telegram_tokens_select_own ON telegram_connection_tokens;
CREATE POLICY telegram_tokens_select_own ON telegram_connection_tokens
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ========================================================================
-- Immutability trigger on notifications UPDATE
-- ========================================================================

CREATE OR REPLACE FUNCTION prevent_notification_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.type IS DISTINCT FROM NEW.type
     OR OLD.domain IS DISTINCT FROM NEW.domain
     OR OLD.title IS DISTINCT FROM NEW.title
     OR OLD.message IS DISTINCT FROM NEW.message
  THEN
    RAISE EXCEPTION 'notification content is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notifications_immutable ON notifications;
CREATE TRIGGER trg_notifications_immutable
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION prevent_notification_mutation();

-- ========================================================================
-- notification_types seed — 57 events, 8 domains
-- Spec: Section 2.2
-- ========================================================================

-- Pipeline (15 events)
INSERT INTO notification_types (type, domain, priority, min_role, title_template, description, dedup_key, group_key, cooldown_secs, phase) VALUES
  ('pipeline.stage_advance',       'pipeline', 3, 'editor', '"{title}" avancou para {stage}',                    'Pipeline stage transition',              '{type}:{itemId}',           '{domain}:{itemId}', NULL,  1),
  ('pipeline.stage_blocked',       'pipeline', 4, 'editor', 'Bloqueado no gate {gate}',                          'Pipeline gate block',                    '{type}:{itemId}',           '{domain}:{itemId}', NULL,  1),
  ('pipeline.vvs_below_threshold', 'pipeline', 4, 'editor', 'VVS abaixo do minimo: {score}%',                    'Video Viability Score too low',          '{type}:{itemId}',           '{domain}:{itemId}', 86400, 1),
  ('pipeline.item_created',        'pipeline', 2, 'editor', 'Novo item: "{title}"',                              'New pipeline item created',              NULL,                        NULL,                NULL,  1),
  ('pipeline.item_archived',       'pipeline', 2, 'editor', '"{title}" arquivado',                               'Pipeline item archived',                 NULL,                        NULL,                NULL,  1),
  ('pipeline.deadline_approaching','pipeline', 3, 'editor', '"{title}" vence em {hours}h',                       'Deadline approaching',                   '{type}:{itemId}:{deadline}', '{domain}:{itemId}', 3600,  1),
  ('pipeline.deadline_overdue',    'pipeline', 4, 'editor', '"{title}" atrasado',                                'Deadline overdue',                       '{type}:{itemId}',           '{domain}:{itemId}', 86400, 1),
  ('pipeline.item_graduated',      'pipeline', 3, 'editor', '"{title}" graduado para {destination}',             'Pipeline item graduated',                NULL,                        NULL,                NULL,  1),
  ('pipeline.bulk_advance',        'pipeline', 2, 'editor', '{count} itens avancaram de etapa',                  'Bulk stage advance',                     NULL,                        NULL,                NULL,  2),
  ('pipeline.stale_item',          'pipeline', 2, 'editor', '"{title}" parado ha {days} dias',                   'Stale item alert',                       '{type}:{itemId}',           '{domain}:{itemId}', 86400, 2),
  ('pipeline.playlist_milestone',  'pipeline', 2, 'editor', 'Playlist "{name}" atingiu {count} itens',           'Playlist milestone',                     '{type}:{playlistId}',       NULL,                86400, 2),
  ('pipeline.research_linked',     'pipeline', 1, 'editor', 'Pesquisa vinculada a "{title}"',                    'Research linked to item',                NULL,                        NULL,                NULL,  2),
  ('pipeline.depth_changed',       'pipeline', 1, 'editor', 'Profundidade de "{title}" alterada para {depth}',   'Item depth changed',                     NULL,                        '{domain}:{itemId}', NULL,  2),
  ('pipeline.script_beat_complete','pipeline', 2, 'editor', 'Roteiro de "{title}": todos os beats completos',    'Script beats complete',                  '{type}:{itemId}',           '{domain}:{itemId}', NULL,  2),
  ('pipeline.cowork_suggestion',   'pipeline', 2, 'editor', 'Cowork sugere: {suggestion}',                       'Cowork AI suggestion',                   NULL,                        NULL,                NULL,  2);

-- YouTube (9 events)
INSERT INTO notification_types (type, domain, priority, min_role, title_template, description, dedup_key, group_key, cooldown_secs, phase) VALUES
  ('youtube.grade_drop',        'youtube', 5, 'editor', 'Grade caiu: {from} -> {to}',                  'YouTube grade dropped',            '{type}:{videoId}',     '{domain}:{videoId}', 86400, 1),
  ('youtube.ab_winner',         'youtube', 4, 'editor', 'Vencedor declarado: {variant}',               'A/B test winner declared',         '{type}:{testId}',      '{domain}:{testId}',  NULL,  1),
  ('youtube.ab_started',        'youtube', 3, 'editor', 'Teste A/B iniciado: "{title}"',               'A/B test started',                 '{type}:{testId}',      '{domain}:{testId}',  NULL,  1),
  ('youtube.ctr_anomaly',       'youtube', 4, 'editor', 'CTR anomalia: {direction}{delta}%',           'CTR anomaly detected',             '{type}:{videoId}',     '{domain}:{videoId}', 86400, 1),
  ('youtube.milestone_views',   'youtube', 2, 'editor', '"{title}" atingiu {count} views',             'Video view milestone',             '{type}:{videoId}:{milestone}', NULL,          NULL,  1),
  ('youtube.milestone_subs',    'youtube', 3, 'editor', 'Canal atingiu {count} inscritos',             'Channel subscriber milestone',     '{type}:{milestone}',   NULL,                 NULL,  1),
  ('youtube.retention_drop',    'youtube', 3, 'editor', 'Retencao caiu {delta}% em "{title}"',         'Audience retention drop',          '{type}:{videoId}',     '{domain}:{videoId}', 86400, 2),
  ('youtube.upload_processed',  'youtube', 2, 'editor', 'Upload processado: "{title}"',                'YouTube upload processed',         '{type}:{videoId}',     NULL,                 NULL,  2),
  ('youtube.comment_spike',     'youtube', 2, 'editor', 'Pico de comentarios em "{title}"',            'Comment spike detected',           '{type}:{videoId}',     '{domain}:{videoId}', 86400, 2);

-- Newsletter (5 events)
INSERT INTO notification_types (type, domain, priority, min_role, title_template, description, dedup_key, group_key, cooldown_secs, phase) VALUES
  ('newsletter.edition_sent',           'newsletter', 3, 'editor',    'Edicao #{number} enviada a {count} inscritos',  'Newsletter edition sent',         '{type}:{editionId}',   NULL, NULL,  1),
  ('newsletter.hard_bounces',           'newsletter', 4, 'org_admin', '{count} hard bounces detectados',               'Hard bounces detected',           '{type}:{date}',        NULL, 86400, 1),
  ('newsletter.subscriber_milestone',   'newsletter', 2, 'editor',    '{count} inscritos atingidos',                   'Subscriber milestone',            '{type}:{milestone}',   NULL, NULL,  1),
  ('newsletter.open_rate_drop',         'newsletter', 3, 'editor',    'Taxa de abertura caiu {delta}%',                'Open rate drop',                  '{type}:{editionId}',   NULL, 86400, 2),
  ('newsletter.new_subscribers_weekly', 'newsletter', 1, 'editor',    '{count} novos inscritos esta semana',           'Weekly new subscribers summary',  '{type}:{weekIso}',     NULL, NULL,  2);

-- Social (6 events)
INSERT INTO notification_types (type, domain, priority, min_role, title_template, description, dedup_key, group_key, cooldown_secs, phase) VALUES
  ('social.publish_failed',    'social', 5, 'editor', 'Falha ao publicar no {platform}',       'Social publish failed',          '{type}:{postId}',      NULL, NULL,  1),
  ('social.token_expiring',    'social', 4, 'editor', 'Token do {platform} expira em {days} dias', 'Social token expiring',     '{type}:{platform}',    NULL, 86400, 1),
  ('social.post_published',    'social', 2, 'editor', 'Publicado no {platform}: "{title}"',    'Social post published',          '{type}:{postId}',      NULL, NULL,  1),
  ('social.story_ready',       'social', 3, 'editor', 'Story pronto para revisao',             'Story ready for review',         '{type}:{storyId}',     NULL, NULL,  1),
  ('social.engagement_spike',  'social', 2, 'editor', 'Pico de engajamento no {platform}',     'Engagement spike',              '{type}:{platform}',    NULL, 86400, 2),
  ('social.follower_milestone','social', 2, 'editor', '{platform}: {count} seguidores',        'Follower milestone',             '{type}:{platform}:{milestone}', NULL, NULL, 2);

-- Links (4 events)
INSERT INTO notification_types (type, domain, priority, min_role, title_template, description, dedup_key, group_key, cooldown_secs, phase) VALUES
  ('links.goal_reached',   'links', 3, 'editor', 'Meta de link atingida: {count} cliques', 'Link click goal reached',    '{type}:{linkId}',      NULL, NULL,  1),
  ('links.click_spike',    'links', 2, 'editor', 'Pico de cliques em {code}',              'Click spike detected',       '{type}:{linkId}',      NULL, 86400, 1),
  ('links.link_expired',   'links', 3, 'editor', 'Link {code} expirou',                    'Link expired',               '{type}:{linkId}',      NULL, NULL,  2),
  ('links.weekly_digest',  'links', 1, 'editor', 'Links: {count} cliques esta semana',     'Weekly links digest',        '{type}:{weekIso}',     NULL, NULL,  2);

-- Blog (4 events)
INSERT INTO notification_types (type, domain, priority, min_role, title_template, description, dedup_key, group_key, cooldown_secs, phase) VALUES
  ('blog.post_published',         'blog', 3, 'editor', 'Post publicado: "{title}"',                            'Blog post published',           '{type}:{postId}',  NULL, NULL,  1),
  ('blog.read_depth_milestone',   'blog', 2, 'editor', '"{title}" atingiu {pct}% de leitura profunda',         'Read depth milestone',          '{type}:{postId}:{pct}', NULL, NULL, 2),
  ('blog.engagement_weekly',      'blog', 1, 'editor', 'Blog: {views} views esta semana',                      'Weekly blog engagement digest', '{type}:{weekIso}', NULL, NULL,  2),
  ('blog.comment_received',       'blog', 2, 'editor', 'Novo comentario em "{title}"',                         'New blog comment',              NULL,               '{domain}:{postId}', NULL, 2);

-- Media (1 event)
INSERT INTO notification_types (type, domain, priority, min_role, title_template, description, dedup_key, group_key, cooldown_secs, phase) VALUES
  ('media.orphan_cleanup', 'media', 2, 'org_admin', '{count} midias orfas removidas', 'Orphan media cleanup', '{type}:{date}', NULL, 86400, 2);

-- System (13 events)
INSERT INTO notification_types (type, domain, priority, min_role, title_template, description, dedup_key, group_key, cooldown_secs, phase) VALUES
  ('system.overdue_action',   'system', 5, 'editor',    '{count} acao(oes) atrasada(s) hoje',              'Overdue actions today',           '{type}:{date}',         NULL, 86400, 1),
  ('system.token_expired',    'system', 5, 'org_admin',  'Token {service} expirado',                       'Token expired',                   '{type}:{service}',      NULL, NULL,  1),
  ('system.cron_failure',     'system', 5, 'org_admin',  'Cron {job} falhou',                               'Cron job failure',                '{type}:{job}',          NULL, 3600,  1),
  ('system.security_alert',   'system', 5, 'super_admin','Alerta de seguranca: {detail}',                   'Security alert',                  NULL,                    NULL, NULL,  1),
  ('system.backup_complete',  'system', 2, 'org_admin',  'Backup concluido',                                'Backup complete',                 '{type}:{date}',         NULL, 86400, 1),
  ('system.rate_limit_hit',   'system', 4, 'org_admin',  'Rate limit atingido: {service}',                  'Rate limit hit',                  '{type}:{service}',      NULL, 3600,  1),
  ('system.deploy_success',   'system', 2, 'editor',    'Deploy concluido com sucesso',                     'Successful deploy',               '{type}:{deployId}',     NULL, NULL,  1),
  ('system.deploy_failed',    'system', 5, 'editor',    'Deploy falhou: {error}',                           'Failed deploy',                   '{type}:{deployId}',     NULL, NULL,  1),
  ('system.digest_daily',     'system', 1, 'editor',    'Resumo diario: {summary}',                         'Daily digest',                    '{type}:{date}',         NULL, NULL,  1),
  ('system.storage_warning',  'system', 3, 'org_admin',  'Armazenamento em {pct}%',                         'Storage warning',                 '{type}',                NULL, 86400, 2),
  ('system.api_deprecation',  'system', 3, 'org_admin',  'API {name} sera descontinuada em {date}',          'API deprecation warning',        '{type}:{name}',         NULL, NULL,  2),
  ('system.weekly_report',    'system', 1, 'editor',    'Relatorio semanal disponivel',                      'Weekly report available',         '{type}:{weekIso}',      NULL, NULL,  2),
  ('system.maintenance',      'system', 3, 'org_admin',  'Manutencao agendada: {detail}',                   'Scheduled maintenance',           '{type}:{date}',         NULL, NULL,  2);

-- ========================================================================
-- Realtime publication — notifications table only (INSERT events)
-- ========================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
