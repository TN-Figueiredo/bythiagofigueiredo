# Design Spec: Sistema de Notificacoes + Redesign Overview

> CMS bythiagofigueiredo — Next.js 15 · React 19 · Tailwind 4 · TypeScript 5 · Supabase PostgreSQL 17
> Aprovado: 2026-05-30
> Score medio: 103.4/110 (8 telas, 140 fixes, 94 agentes)

---

## 1. Foundation — Database, Delivery Engine, LGPD, Service Worker

### 1.1 Database Schema (5 tables)

#### `notifications` (fan-out pattern)

```sql
CREATE TABLE notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = site-wide broadcast PROHIBITED (see constraint)
  type          text NOT NULL,                    -- FK to notification_types.type
  domain        text NOT NULL CHECK (domain IN ('pipeline','youtube','newsletter','social','links','blog','media','system')),
  priority      int  NOT NULL CHECK (priority BETWEEN 1 AND 5),
  title         text NOT NULL,
  message       text,
  payload       jsonb,                            -- polymorphic, domain-specific data
  dedup_key     text,                             -- dedup (e.g. type:videoId:weekIso)
  group_key     text,                             -- visual threading
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

-- Partial dedup index (only where dedup_key is set)
CREATE UNIQUE INDEX idx_notifications_dedup
  ON notifications (site_id, user_id, dedup_key)
  WHERE dedup_key IS NOT NULL;
```

**7 indexes:**

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_notif_user_unread` | `(user_id, site_id) WHERE read_at IS NULL AND dismissed_at IS NULL` | Bell count, popover list |
| `idx_notif_user_created` | `(user_id, site_id, created_at DESC)` | Inbox pagination |
| `idx_notif_user_domain` | `(user_id, site_id, domain)` | Domain filter chips |
| `idx_notif_group_key` | `(group_key) WHERE group_key IS NOT NULL` | Threading |
| `idx_notif_snoozed` | `(snoozed_until) WHERE snoozed_until IS NOT NULL` | Cron unsnooze |
| `idx_notif_expired` | `(expired_at) WHERE expired_at IS NOT NULL` | Cron cleanup |
| `idx_notif_dedup` | See above (partial unique) | Dedup on insert |

#### `notification_deliveries` (retry queue)

```sql
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

-- FOR UPDATE SKIP LOCKED pattern for concurrent workers
CREATE INDEX idx_deliveries_pending ON notification_deliveries (next_retry_at)
  WHERE status = 'pending';
```

#### `notification_preferences`

```sql
CREATE TABLE notification_preferences (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id               uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  category              text,                          -- domain or NULL for global defaults
  channel_in_app        boolean NOT NULL DEFAULT true,
  channel_email         boolean NOT NULL DEFAULT false,
  channel_push          boolean NOT NULL DEFAULT false,
  channel_telegram      boolean NOT NULL DEFAULT false,
  frequency_mode        text NOT NULL DEFAULT 'regular' CHECK (frequency_mode IN ('calm','regular','power')),
  quiet_hours_enabled   boolean NOT NULL DEFAULT false,
  quiet_hours_start     text NOT NULL DEFAULT '22:00', -- HH:MM
  quiet_hours_end       text NOT NULL DEFAULT '08:00', -- HH:MM
  quiet_hours_timezone  text NOT NULL DEFAULT 'America/Sao_Paulo',
  email_consent_at      timestamptz,                   -- LGPD consent timestamp
  push_consent_at       timestamptz,                   -- LGPD consent timestamp
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, site_id, category)
);
```

#### `push_subscriptions`

```sql
CREATE TABLE push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id       uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  endpoint      text NOT NULL,
  p256dh        text NOT NULL,
  auth          text NOT NULL,                     -- encrypted via PUSH_ENCRYPTION_KEY
  device_label  text,                              -- e.g. "Chrome macOS"
  failure_count int  NOT NULL DEFAULT 0,           -- increment on push fail, remove at 3
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
```

#### `telegram_connection_tokens`

```sql
CREATE TABLE telegram_connection_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id    uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,                 -- HMAC-SHA256(userId + timestamp, secret)
  expires_at timestamptz NOT NULL,                 -- 15min TTL
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 1.2 RLS

All 5 tables: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`

| Table | SELECT | INSERT | UPDATE |
|-------|--------|--------|--------|
| `notifications` | `user_id = auth.uid()` | Service role only | `user_id = auth.uid()` (read/dismiss only) |
| `notification_deliveries` | Service role only | Service role only | Service role only |
| `notification_preferences` | `user_id = auth.uid()` | `user_id = auth.uid()` | `user_id = auth.uid()` |
| `push_subscriptions` | `user_id = auth.uid()` | `user_id = auth.uid()` | `user_id = auth.uid()` |
| `telegram_connection_tokens` | `user_id = auth.uid()` | Service role only | Service role only |

**Immutability trigger on notifications UPDATE:**

```sql
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

CREATE TRIGGER trg_notifications_immutable
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION prevent_notification_mutation();
```

### 1.3 Delivery Engine

```
createNotification(input)
  │
  ├─ 1. Zod validation (NotificationCreateSchema)
  ├─ 2. RBAC check (can_edit_site for non-system, service role for system)
  ├─ 3. Atomic CTE rate limit (max 100 notifications/user/hour)
  │     WITH recent AS (SELECT count(*) FROM notifications WHERE user_id = $1 AND created_at > now() - interval '1 hour')
  │     INSERT INTO notifications ... WHERE (SELECT count FROM recent) < 100
  ├─ 4. INSERT notification row (triggers Realtime for in-app)
  └─ 5. INSERT delivery rows per enabled channel (email/push/telegram)

Orphan detection (PRIMARY dispatch mechanism):
  │
  ├─ Cron every 60s: SELECT deliveries WHERE status = 'pending' AND next_retry_at <= now()
  │   FOR UPDATE SKIP LOCKED LIMIT 50
  ├─ For each: call channel adapter
  └─ On success: UPDATE status = 'sent', sent_at = now()
      On failure: attempts++, next_retry_at = now() + exponential_backoff(attempts)
      On max attempts (5): status = 'dead' (dead letter)
```

**4 Channel Adapters (IChannelAdapter interface):**

```typescript
interface IChannelAdapter {
  channel: 'email' | 'push' | 'telegram'
  send(notification: INotification, user: IUserProfile): Promise<{ success: boolean; error?: string }>
  healthCheck(): Promise<boolean>
}
```

| Adapter | Implementation |
|---------|---------------|
| `EmailAdapter` | Resend API (`@tn-figueiredo/email`) |
| `PushAdapter` | Web Push API (VAPID keys) |
| `TelegramAdapter` | Telegram Bot API (`sendMessage`) |
| `InAppAdapter` | No-op (Realtime INSERT is the delivery) |

**Circuit breaker (query-based):**

```sql
-- If >50% of last 20 deliveries for a channel failed, pause that channel
SELECT count(*) FILTER (WHERE status = 'failed') * 100.0 / count(*) AS fail_pct
FROM (
  SELECT status FROM notification_deliveries
  WHERE channel = $1 AND created_at > now() - interval '1 hour'
  ORDER BY created_at DESC LIMIT 20
) recent;
-- If fail_pct > 50: skip channel, log to Sentry, alert via system notification
```

### 1.4 LGPD Compliance

| Base legal | Channel | Behavior |
|-----------|---------|----------|
| Execucao de contrato | In-app (system domain) | Always on, toggle locked |
| Legitimo interesse | In-app (other domains) | On by default, opt-out |
| Consentimento | Email, Push, Telegram | Off by default, opt-in with consent dialog |

**Phase 1 DELETE (user account deletion):**
- `DELETE FROM notifications WHERE user_id = $1` (CASCADE handles deliveries)
- `DELETE FROM notification_preferences WHERE user_id = $1`
- `DELETE FROM push_subscriptions WHERE user_id = $1`
- `DELETE FROM telegram_connection_tokens WHERE user_id = $1`
- Add notification adapter as 7th slot in `lib/lgpd/container.ts`

**Consent categories:** `notification_email`, `notification_push` (stored in `notification_preferences.email_consent_at` / `push_consent_at`)

**Privacy policy v1.2:** Add notification data processing section

### 1.5 Environment Variables

| Variable | Purpose |
|----------|---------|
| `VAPID_PUBLIC_KEY` | Web Push VAPID public key |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key |
| `PUSH_ENCRYPTION_KEY` | AES key for encrypting push subscription auth tokens |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API token (existing) |
| `TELEGRAM_HMAC_SECRET` | HMAC secret for connection token signing |

### 1.6 Service Worker

- File: `public/cms/sw.js`
- Scope: `/cms/`
- Registration: in CMS layout, gated behind push preference enabled
- Handles: `push` event (show notification), `notificationclick` event (navigate to `action_href`)

### 1.7 Migrations (4 sequential)

| # | Migration | Purpose |
|---|-----------|---------|
| 1 | `add_cron_locks_notifications` | `cron_locks` row for notification delivery cron |
| 2 | `add_lgpd_consent_categories` | `notification_email`, `notification_push` categories |
| 3 | `create_notification_system` | All 5 tables + indexes + RLS + triggers + notification_types seed |
| 4 | `drop_yt_notifications` | Drop legacy `yt_notifications` table + migrate existing data |

### 1.8 File Structure

```
lib/notifications/
  types.ts              # INotification, INotificationPreferences, NotificationDomain, store shape
  schemas.ts            # Zod schemas (NotificationCreateSchema, PreferencesUpdateSchema)
  create.ts             # createNotification() — Zod + RBAC + atomic CTE
  dispatch.ts           # orphan detection cron, delivery loop
  adapters/
    interface.ts        # IChannelAdapter
    email.ts            # EmailAdapter (Resend)
    push.ts             # PushAdapter (VAPID)
    telegram.ts         # TelegramAdapter (Bot API)
  cron/
    deliver.ts          # delivery worker (FOR UPDATE SKIP LOCKED)
    unsnooze.ts         # unsnooze expired notifications
    cleanup.ts          # expire old notifications (90 days)
```

---

## 2. Event Registry — 57 Events, Suppression, Priority Matrix

### 2.1 `notification_types` Reference Table

```sql
CREATE TABLE notification_types (
  type          text PRIMARY KEY,
  domain        text NOT NULL,
  priority      int  NOT NULL CHECK (priority BETWEEN 1 AND 5),
  min_role      text NOT NULL DEFAULT 'editor',
  title_template text NOT NULL,
  description   text,
  dedup_key     text,         -- template: e.g. '{type}:{videoId}:{weekIso}'
  group_key     text,         -- template: e.g. '{domain}:{entityId}'
  cooldown_secs int,          -- minimum seconds between same dedup_key
  phase         int NOT NULL DEFAULT 1 CHECK (phase IN (1, 2))
);
-- Populated via INSERT, not DDL
```

### 2.2 Event Registry (57 events, 8 domains)

#### Pipeline (15 events)

| Type | Prio | Title Template | Phase |
|------|------|---------------|-------|
| `pipeline.stage_advance` | 3 | "{title}" avancou para {stage} | 1 |
| `pipeline.stage_blocked` | 4 | Bloqueado no gate {gate} | 1 |
| `pipeline.vvs_below_threshold` | 4 | VVS abaixo do minimo: {score}% | 1 |
| `pipeline.item_created` | 2 | Novo item: "{title}" | 1 |
| `pipeline.item_archived` | 2 | "{title}" arquivado | 1 |
| `pipeline.deadline_approaching` | 3 | "{title}" vence em {hours}h | 1 |
| `pipeline.deadline_overdue` | 4 | "{title}" atrasado | 1 |
| `pipeline.item_graduated` | 3 | "{title}" graduado para {destination} | 1 |
| `pipeline.bulk_advance` | 2 | {count} itens avancaram de etapa | 2 |
| `pipeline.stale_item` | 2 | "{title}" parado ha {days} dias | 2 |
| `pipeline.playlist_milestone` | 2 | Playlist "{name}" atingiu {count} itens | 2 |
| `pipeline.research_linked` | 1 | Pesquisa vinculada a "{title}" | 2 |
| `pipeline.depth_changed` | 1 | Profundidade de "{title}" alterada para {depth} | 2 |
| `pipeline.script_beat_complete` | 2 | Roteiro de "{title}": todos os beats completos | 2 |
| `pipeline.cowork_suggestion` | 2 | Cowork sugere: {suggestion} | 2 |

#### YouTube (9 events)

| Type | Prio | Title Template | Phase |
|------|------|---------------|-------|
| `youtube.grade_drop` | 5 | Grade caiu: {from} -> {to} | 1 |
| `youtube.ab_winner` | 4 | Vencedor declarado: {variant} | 1 |
| `youtube.ab_started` | 3 | Teste A/B iniciado: "{title}" | 1 |
| `youtube.ctr_anomaly` | 4 | CTR anomalia: {direction}{delta}% | 1 |
| `youtube.milestone_views` | 2 | "{title}" atingiu {count} views | 1 |
| `youtube.milestone_subs` | 3 | Canal atingiu {count} inscritos | 1 |
| `youtube.retention_drop` | 3 | Retencao caiu {delta}% em "{title}" | 2 |
| `youtube.upload_processed` | 2 | Upload processado: "{title}" | 2 |
| `youtube.comment_spike` | 2 | Pico de comentarios em "{title}" | 2 |

#### Newsletter (5 events)

| Type | Prio | Title Template | Phase |
|------|------|---------------|-------|
| `newsletter.edition_sent` | 3 | Edicao #{number} enviada a {count} inscritos | 1 |
| `newsletter.hard_bounces` | 4 | {count} hard bounces detectados | 1 |
| `newsletter.subscriber_milestone` | 2 | {count} inscritos atingidos | 1 |
| `newsletter.open_rate_drop` | 3 | Taxa de abertura caiu {delta}% | 2 |
| `newsletter.new_subscribers_weekly` | 1 | {count} novos inscritos esta semana | 2 |

#### Social (6 events)

| Type | Prio | Title Template | Phase |
|------|------|---------------|-------|
| `social.publish_failed` | 5 | Falha ao publicar no {platform} | 1 |
| `social.token_expiring` | 4 | Token do {platform} expira em {days} dias | 1 |
| `social.post_published` | 2 | Publicado no {platform}: "{title}" | 1 |
| `social.story_ready` | 3 | Story pronto para revisao | 1 |
| `social.engagement_spike` | 2 | Pico de engajamento no {platform} | 2 |
| `social.follower_milestone` | 2 | {platform}: {count} seguidores | 2 |

#### Links (4 events)

| Type | Prio | Title Template | Phase |
|------|------|---------------|-------|
| `links.goal_reached` | 3 | Meta de link atingida: {count} cliques | 1 |
| `links.click_spike` | 2 | Pico de cliques em {code} | 1 |
| `links.link_expired` | 3 | Link {code} expirou | 2 |
| `links.weekly_digest` | 1 | Links: {count} cliques esta semana | 2 |

#### Blog (4 events)

| Type | Prio | Title Template | Phase |
|------|------|---------------|-------|
| `blog.post_published` | 3 | Post publicado: "{title}" | 1 |
| `blog.read_depth_milestone` | 2 | "{title}" atingiu {pct}% de leitura profunda | 2 |
| `blog.engagement_weekly` | 1 | Blog: {views} views esta semana | 2 |
| `blog.comment_received` | 2 | Novo comentario em "{title}" | 2 |

#### Media (1 event)

| Type | Prio | Title Template | Phase |
|------|------|---------------|-------|
| `media.orphan_cleanup` | 2 | {count} midias orfas removidas | 2 |

#### System (13 events)

| Type | Prio | Title Template | Phase |
|------|------|---------------|-------|
| `system.overdue_action` | 5 | {count} acao(oes) atrasada(s) hoje | 1 |
| `system.token_expired` | 5 | Token {service} expirado | 1 |
| `system.cron_failure` | 5 | Cron {job} falhou | 1 |
| `system.security_alert` | 5 | Alerta de seguranca: {detail} | 1 |
| `system.backup_complete` | 2 | Backup concluido | 1 |
| `system.rate_limit_hit` | 4 | Rate limit atingido: {service} | 1 |
| `system.deploy_success` | 2 | Deploy concluido com sucesso | 1 |
| `system.deploy_failed` | 5 | Deploy falhou: {error} | 1 |
| `system.digest_daily` | 1 | Resumo diario: {summary} | 1 |
| `system.storage_warning` | 3 | Armazenamento em {pct}% | 2 |
| `system.api_deprecation` | 3 | API {name} sera descontinuada em {date} | 2 |
| `system.weekly_report` | 1 | Relatorio semanal disponivel | 2 |
| `system.maintenance` | 3 | Manutencao agendada: {detail} | 2 |

### 2.3 Suppression Rules

| Rule | Logic |
|------|-------|
| **Self-action suppression** | Never notify user about their own action (actor_id == user_id) |
| **Composite suppression** | `pipeline.stage_advance` suppresses `pipeline.deadline_approaching` for same item within 1h |
| **Cooldown** | Per `dedup_key`: e.g. `youtube.grade_drop` max once per 24h per video |
| **Group aggregation** | 3+ notifications with same `group_key` within 1h collapse into thread |

### 2.4 Priority Matrix

| Prio | Label | Use | Volume target |
|------|-------|-----|---------------|
| 5 | Critico | System security, service failures, blocked workflows | 0-1/day |
| 4 | Alta | Blocked workflow, expiring tokens, A/B results | 1-2/day |
| 3 | Media | State changes, confirmations, milestones | 2-3/day |
| 2 | Baixa | Info, minor updates | Batched or digest |
| 1 | Digest | Weekly summaries, stats | 1/day max |

**Volume target:** <8 real-time notifications/day for solo creator.

### 2.5 Phase Rollout

| Phase | Events | Criteria |
|-------|--------|----------|
| Phase 1 | 32 events | Core workflows, high-value signals |
| Phase 2 | 25 events | Nice-to-have, engagement metrics, secondary signals |

---

## 3. UI -- Notification System (Shell + Popover + Inbox + Preferences)

Four components compose the notification experience: the persistent bell in the shell topbar, a popover/drawer for quick triage, a full inbox page, and a preferences page for channel/frequency control.

---

### 3.1 Shell Integration (Bell + Sidebar)

#### Bell Button

| Property | Value |
|----------|-------|
| Size | 36px desktop / min-w-11 min-h-11 (44px touch target) mobile |
| Shape | `rounded-[10px]` (`--radius-xl`) |
| Background | `bg-cms-surface` |
| Border | `border-cms-border` |
| ARIA | `aria-expanded`, `aria-haspopup="dialog"`, `aria-label="Notificacoes, {count} nao lidas"` |

#### Badge

| Property | Value |
|----------|-------|
| Position | `top:6px right:6px` |
| Height | 16px |
| Border radius | 10px |
| Border cutout | 2px solid `var(--cms-bg)` (punch-through effect) |
| Normal | `bg-cms-accent`, text `--on-accent` (#1A140C dark / #fff light) |
| Critical (prio 4+) | `bg-cms-red`, "!" prefix glyph (WCAG 1.4.1 non-color indicator) |
| Overflow | `9+` when count > 9 |

#### Animations (motion-safe only)

| Animation | Duration | Behavior |
|-----------|----------|----------|
| `bellRing` | 0.6s | Shake on new Realtime INSERT |
| `badgePulse` | 0.55s x2 | Pulse on badge count change |
| Trigger | `bumpKey` counter increment | Re-run via key prop |
| Reduced motion | Disabled entirely or single subtle opacity flash |

#### States (16 total)

`zero` | `unread` | `critical` | `hover` | `focus` | `active` | `ringing` | `skeleton` | `pending` | `light` | `mobile` | `popover-open` | `drawer-open` | `reconnecting` | `error` | `loading`

#### Live Regions

- `aria-live="polite"` for normal count updates: "Nova notificacao: {title}"
- `aria-live="assertive"` for critical (prio 4+): "Nova notificacao critica: {title}"

#### Sidebar Entry

- New item in Overview section of `cms-sections.ts`, after Analytics
- Icon: `Bell` from `lucide-react`
- Badge: `SidebarBadges` portal pattern, `bg-cms-accent/15 text-cms-accent` (translucent pill, aligned with existing sidebar badges)
- Count: unread count, `9+` if > 9

---

### 3.2 Popover (408px / Mobile Drawer)

#### Container

| Property | Desktop | Mobile (<640px) |
|----------|---------|-----------------|
| Component | `<NotifPopover>` | `<BottomDrawer>` |
| Width | 408px anchored below bell | Full width |
| Height | `max-height: min(640px, 80vh)` | 60vh peek / 90vh full (two snap points) |
| Background | `var(--elev)` | `var(--elev)` |
| Border | `var(--border-strong)` | Top radius only |
| Shadow | `shadow-pop` (`--pb-shadow-popover`) | None |
| Loading | `next/dynamic` `ssr: false`, Skeleton fallback | Same, lazy |
| ARIA | `role="dialog"` | `role="dialog"` `aria-modal="true"`, `inert` on main content |

#### Entrance Animation

```css
@keyframes popoverEnter {
  from { transform: translateY(-4px) scale(0.98); opacity: 0; }
  to   { transform: translateY(0) scale(1); opacity: 1; }
}
/* 220ms, motion-safe only */
```

#### Header

| Element | Spec |
|---------|------|
| Title | "Notificacoes" |
| Pill count | Unread count in accent pill |
| "Marcar todas" | Link/button, min-height 44px touch target |
| Gear icon | Links to `/cms/settings/notifications`, min-w-11 min-h-11 |

#### Filter Chips

- Container: `role="radiogroup"` `aria-label="Filtrar notificacoes"`, horizontal scroll
- 8 filters: Todas | Nao lidas | Pipeline | YouTube | NL | Social | Links | Sistema
- Each chip: `role="radio"` `aria-checked={active}`
- Navigation: roving tabindex, Left/Right arrow keys (WAI-ARIA radio group pattern)
- State persists across popover open/close cycles

#### Notification Row

| Element | Spec |
|---------|------|
| Left border | 3px, domain color via `--color-cms-domain-{domain}` |
| Icon | 32px circle, domain icon in soft-fill, domain subtle color bg |
| Unread dot | 7px accent dot |
| Title | 13px/600 |
| Priority badge | "Critico"/"Alta" in `text-cms-red` |
| Time | Mono 11px, relative (`ha`, `3d`) |
| Domain label | Text in domain color |
| Actions | Reveal on hover; always visible on touch (`@media (hover: none)`) |

#### Read vs Unread Visual Treatment

| State | Treatment |
|-------|-----------|
| Unread | Accent 6% tint background |
| Read | Title opacity .72, message opacity .72, icon opacity .65. Left border + action buttons at full opacity |

#### Threading

- Trigger: 3+ notifications with same `group_key`
- Display: Collapsible card with summary line
- Summary: Domain-aware computation from `payload` jsonb (NOT regex on title). Fallback: "N atualizacoes de {domain}"
- Button: `aria-expanded={open}`, `aria-controls="thread-body-{id}"`, `aria-label="{count} atualizacoes de {domain}, {unread} nao lidas"`

#### Dismiss Interaction

Two-phase `rowLeave` animation (260ms total, `motion-safe:` only):
1. **0-60%**: Visual fade + translateX(36px)
2. **60-100%**: Height collapse to 0

Then: undo toast via `useToast()` (5s window) --> commit server action on expiry.
Reduced motion fallback: simple opacity fade 150ms.

#### Close Behavior

- Escape key closes popover
- Click outside closes popover
- Focus returns to bell button on close
- Focus trap active while open (ported from `yt-notifications-bell.tsx` lines 111-132)

#### Mobile BottomDrawer (<640px)

| Property | Value |
|----------|-------|
| Snap points | 60vh (peek), 90vh (full) |
| Drag handle | Touch events (`onTouchStart/Move/End`), velocity-based snap |
| Overlay | `bg-black/40`, click-to-close |
| Scroll lock | `overflow: hidden` on `<body>` |
| ARIA | `aria-modal="true"`, `inert` on background, drag handle `aria-label="Arrastar para expandir"` |

#### Empty States

Contextual per active filter. Uses `EmptyState` component from `@tn-figueiredo/cms-ui`.

#### Footer

- When `total > showing`: "Ver todas as {total} notificacoes -->" linking to `/cms/notifications`
- Otherwise: "Ver todas as notificacoes -->"

---

### 3.3 Inbox (`/cms/notifications`)

#### Layout

| Property | Value |
|----------|-------|
| Max width | 900px |
| Page type | RSC with Suspense, client island for interactivity |
| Skeleton | 6 rows using `SkeletonBlock` from `@tn-figueiredo/cms-ui` |

#### Header

| Element | Spec |
|---------|------|
| Title | "Caixa de notificacoes" |
| Subtitle | "{X} nao lidas . {Y} no total" |
| Primary action | "Marcar todas lidas" button (PRIMARY variant) |
| Secondary | Gear icon linking to `/cms/settings/notifications` |

#### Filter Chips + Search

- Domain dots with per-domain unread counts
- Container: `role="radiogroup"` `aria-label="Filtrar notificacoes"`, arrow-key navigation
- Search: `role="search"`, `aria-label="Buscar notificacoes"`, clear button
- Client-side filter for loaded items + debounced server-side `ILIKE` fallback via `searchNotifications` server action

#### Bulk Action Bar

| Property | Value |
|----------|-------|
| Position | `sticky top:0`, z-index above list |
| Visual | Accent stripe left border |
| Count | `aria-live="polite"`: "{N} selecionada(s)" |
| Actions | Marcar lidas / Dispensar / Cancelar |
| Container | `role="toolbar"` `aria-label="Acoes em lote"` |
| Bulk dismiss | Aggregate undo toast "{N} notificacoes dispensadas [Desfazer]", **7s window**. Stagger slide-out by 40ms. Delay server action until undo expires. |

#### Time Buckets

4 calendar-day groups (user timezone via `Intl.DateTimeFormat`):

| Bucket | Rule |
|--------|------|
| Hoje | `created_at` is today |
| Ontem | `created_at` is yesterday |
| Esta semana | `created_at` within current ISO week |
| Mais antigos | Everything else |

Each bucket: `role="group"` with `aria-labelledby` pointing to heading `id`. Separator: `border-top`.

#### Notification Row (Inbox Variant)

| Element | Spec |
|---------|------|
| Visual lines | 2 lines: title + (message + domain + actions merged) |
| Checkbox | 20px, `margin-top:6px`, `role="checkbox"` `aria-checked` `aria-label="Selecionar notificacao: {title}"` |
| Touch target | 44px minimum via padding on mobile |
| Thread checkbox | Standalone (no button-inside-button nesting) |
| Thread expand | Separate chevron button, `aria-expanded` |

#### Pagination

- Cursor-based: `LIMIT 50`, cursor = last `created_at`
- "Carregar mais" button at bottom (NOT infinite scroll)

#### Snooze

| Element | Spec |
|---------|------|
| Trigger | Clock icon action button |
| Presets | 15min, 1h, 3h, Tomorrow 9am, Monday 9am |
| Resolution | Uses stored timezone from `notification_preferences.quiet_hours_timezone` |
| Display | Shows resolved local time for each preset |

#### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `j` | Next notification |
| `k` | Previous notification |
| `x` | Toggle select |
| `e` | Dismiss |
| `r` | Toggle read/unread |

#### Empty State

"Voce esta em dia" with illustration via `EmptyState` from `@tn-figueiredo/cms-ui`.

---

### 3.4 Preferences (`/cms/settings/notifications`)

#### Layout

| Property | Value |
|----------|-------|
| Max width | 860px (sm+), full-width mobile |
| Page type | RSC page |
| Sections | 4 card sections with section labels |
| Save | Auto-save with toast confirmation |

#### Section 1: Delivery Channels

Grid: `grid-cols-1 sm:grid-cols-2`. Card buttons with `<CmsSwitch>`.

| Channel | Default | Behavior |
|---------|---------|----------|
| In-app | ON, locked | `aria-disabled="true"`, "Obrigatorio" label. LGPD contract base. |
| Email | OFF | Toggle triggers LGPD consent dialog before activation |
| Push | OFF | Toggle triggers LGPD consent dialog + `Notification.requestPermission()` |
| Telegram | Disconnected | "Conectar" button --> HMAC-signed deep link (NOT raw UUID). 15min TTL. |

Active cards: accent-soft background.

#### Section 2: Frequency

Grid: `grid-cols-1 sm:grid-cols-3`. Container: `role="radiogroup"` `aria-label="Frequencia de notificacoes"`. Arrow-key navigation with roving tabindex.

| Preset | Label | Description |
|--------|-------|-------------|
| `calm` | Calmo | "Essencial -- So alertas criticos: falhas de publicacao, tokens expirados. Resto num resumo diario." |
| `regular` | Regular (default) | "Equilibrado -- A/B tests, metas atingidas, avisos de pipeline em tempo real. Metricas menores no resumo." |
| `power` | Power | "Tudo -- Tudo em tempo real, incluindo cada clique e digest completo." |

Each card: `role="radio"` `aria-checked={preset === k}`.

#### Section 3: Per Category

Accordion per domain (8 domains) using `<CmsAccordion>`. Each expands to show 4 channel toggles via `<CmsSwitch>`.

| Domain | Icon | Channels |
|--------|------|----------|
| Pipeline | Layers | in-app / email / push / telegram |
| YouTube | Youtube | in-app / email / push / telegram |
| Newsletter | Mail | in-app / email / push / telegram |
| Social | Send | in-app / email / push / telegram |
| Links | Link2 | in-app / email / push / telegram |
| Blog | FileText | in-app / email / push / telegram |
| Media | Image | in-app / email / push / telegram |
| Sistema | Shield | in-app (locked) / email / push / telegram |

**Global OFF override:** When a global channel is OFF, per-category toggles for that channel: `aria-disabled="true"` `tabindex="-1"`, `opacity: 0.4`, tooltip "Canal {name} desativado globalmente". Inline alert at top of expanded section.

Sistema/in-app: always locked (`aria-disabled="true"`, `tabindex="-1"`).

#### Section 4: Quiet Hours

| Element | Spec |
|---------|------|
| Toggle | `<CmsSwitch>` `aria-label="Horario de silencio ativo"`, label "Pausar nao-criticas" |
| Time pickers | Two dropdown selects (start/end), 30-minute increments |
| Timezone | Searchable dropdown, auto-detection via `Intl.DateTimeFormat().resolvedOptions().timeZone` |
| Storage | `notification_preferences.quiet_hours_timezone` |
| Priority 5 bypass | System domain prio 5 always delivered regardless of quiet hours |

#### LGPD Consent Dialog

| Property | Value |
|----------|-------|
| Trigger | Email or push channel activation |
| Max width | 480px |
| ARIA | `role="alertdialog"`, `aria-modal="true"`, focus trap, `inert` on background |
| Content | Data processing purpose (LGPD Art. 7), data collected, retention period, right to revoke |
| Buttons | "Cancelar" (secondary) / "Concordo e ativar" (primary) |
| Push chain | After consent acceptance: `Notification.requestPermission()` |
| Record | Consent timestamp stored in `notification_preferences.email_consent_at` / `push_consent_at` |

#### LGPD Footer

Note at bottom of preferences page explaining data processing bases per channel.

---

### Architecture Decisions (from 104/110 design review)

| Decision | Rationale |
|----------|-----------|
| `useReducer` + `NotificationContext` | NOT Zustand. Zero new dependencies. Codebase uses React 19 built-in state exclusively. |
| NO `useOptimistic` | Conflicts with Realtime store. `useOptimistic` reverts on transition using server props as baseline; Realtime events mutate independently, causing divergence. Optimistic updates go through reducer dispatch. |
| NO `router.refresh()` | Store is single source of truth. No `revalidateTag` either. RSC seeds initial state on first mount only. |
| Server Actions: user's Supabase client | NOT `getSupabaseServiceClient()`. RLS enforces `auth.uid() = user_id`. Prevents cross-user mutation. |
| Realtime: singleton channel | `notifications-{userId}`. Gap recovery with `isRecovering` flag + `visibilitychange` listener. Dedup by notification ID. Max recovery window: 24h. |
| Lazy popover | `next/dynamic` `ssr: false`. Skeleton fallback from `@tn-figueiredo/cms-ui`. |
| `safeRedirect()` for `action_href` | Defense-in-depth from `@tn-figueiredo/auth-nextjs/safe-redirect`, even though data sources are server-controlled. |

### New Reusable Components

| Component | File | Reuse potential |
|-----------|------|-----------------|
| `<CmsSwitch>` | `_shared/cms-switch.tsx` | Any toggle in CMS (FAQ, settings, feature flags) |
| `<CmsAccordion>` | `_shared/cms-accordion.tsx` | FAQ, beat sections, script-beat, per-category prefs |
| `<BottomDrawer>` | `_shared/bottom-drawer.tsx` | Any mobile-first modal (filters, menus, pickers) |
| `<LgpdConsentDialog>` | `settings/notifications/_components/lgpd-consent-dialog.tsx` | Any future LGPD consent flow (analytics, marketing) |

---

## 4. Overview Redesign — Dashboard, Up Next, Schedule, Analytics

### 4.1 Dashboard (`/cms`) — Command Center

#### Header

- Adaptive greeting: "Bom dia/tarde/noite, Thiago" based on `Intl.DateTimeFormat` hour
- Contextual subtitle based on content state (overdue items, buffer health, streak)

#### Quick Actions (grid 4)

| Action | Icon | Domain color | Shortcut |
|--------|------|-------------|----------|
| Novo Post | FileText | Blog | Cmd+K -> "post" |
| Novo Video | Video | YouTube | Cmd+K -> "video" |
| Nova Edicao | Mail | Newsletter | Cmd+K -> "edicao" |
| Item Pipeline | Layers | Pipeline | Cmd+K -> "pipeline" |

**Decision:** Cmd+K command palette instead of single-letter shortcuts (avoids conflicts with input fields).

#### Main Grid (`1.55fr / 1fr`)

**Left column:**

| Card | Content |
|------|---------|
| Precisa de atencao | Priority-sorted list with domain border color + priority badge -> route |
| Foco de hoje | Pulled from Up Next focus slots (max 3 items) |

**Right column:**

| Card | Content |
|------|---------|
| Notificacoes recentes | Top unread notifications (max 5) -> popover |
| Saude do buffer | Pills coloridos (existing pattern) + breakdown + recommendation |

**Decision:** Buffer health uses existing colored pills pattern instead of ring chart (clearer, already implemented).

#### Performance Summary

- Grid 4 mini-KPIs with sparkline via `<SparklineSvg>`
- Consolidated `<KpiCard>` component in `_shared/kpi-card.tsx`
- Link "Ver Analytics" at bottom

#### States

| State | Display |
|-------|---------|
| Loading | 6 `SkeletonBlock` cards |
| Empty | "Tudo pronto para comecar" + CTA quick actions |
| Error | Error boundary with retry |

#### Query Consolidation

**Before:** 27 queries without cache. **After:** ~14 queries with `unstable_cache` per function.

---

### 4.2 Up Next (`/cms/up-next`)

#### Header

- Day progress badge + buffer health indicator
- Momentum streak indicator (consecutive days with completed items)

#### Production Queue

| Section | Content |
|---------|---------|
| Atrasado | Red left border, overdue items with "Avancar etapa" / "Fixar no foco" / "Editar" actions |
| Hoje | Today's items, same action buttons |

#### Foco de Hoje (Interactive)

- Max 3 fixable slots with grip drag handle
- Empty slots: dashed border "Fixar um item"
- Unpin: X button on pinned items
- Skip navigation links for keyboard users

#### Proximos 7 Dias

- Week strip with day markers + item count per day
- Type icons per scheduled item

#### Sugestoes por Playlist

- Playlist cards with completion progress
- "Sugerir proximo" action (suggest only, never auto-assign)

#### Atividade Recente (Timeline)

- Vertical timeline with domain-colored dots
- Semantic `<time>` elements with `datetime` attribute
- Max 10 recent activities

#### Celebration Banner

- Triggered on completing all daily focus items
- Confetti animation (motion-safe only)

---

### 4.3 Schedule (`/cms/schedule`)

#### Header

- Month navigation (prev/next) with current month label
- View toggle: Month | Week (via `searchParams`, activates existing `WeekView` component)
- Legend: Blog (emerald) / Newsletter (violet) / Video (rose)

#### KPI Strip (4 metrics)

| KPI | Source |
|-----|--------|
| Publicado | Count of published items this month |
| Agendado | Count of scheduled items |
| Saude da cadencia | Cadence health indicator |
| Atrasados | Count of overdue items |

#### Calendar Grid

**Desktop (md+):**

| Property | Value |
|----------|-------|
| Grid | 7 columns, 1px gap |
| Day cells | min-height 80px |
| Events | Color-coded pills: published (solid bg) / scheduled (dashed border, opacity .7) |
| Today | Accent-colored day number |
| Other month | opacity .4 |

**Accessibility (CRITICAL -- was zero ARIA before review):**

| Pattern | Implementation |
|---------|---------------|
| Grid role | `role="grid"` on calendar container |
| Row role | `role="row"` on each week |
| Cell role | `role="gridcell"` on each day cell |
| Navigation | Roving tabindex + Arrow/Home/End/PageUp/PageDown keys |
| Non-color indicators | SVG icons per type (pen/envelope/play) + "Atrasado" badge text |

**Mobile (<md):** Grid hidden. Replaced by vertical agenda/list view (days with content only).

#### Backlog (Collapsible)

- Collapsible section at bottom
- Per-item: date picker inline button (NOT drag-and-drop)
- `aria-expanded` on toggle

#### Query Consolidation

**Before:** 12 queries without cache. **After:** 6 queries with `unstable_cache` 120s, config cached 600s.

#### File: `lib/schedule/schedule-queries.ts` (NEW)

- Types + 6 consolidated queries
- `unstable_cache` with 120s revalidation

---

### 4.4 Analytics (`/cms/analytics`)

#### Tab Bar

Tabs: **Overview . YouTube . Conteudo . Links . Audiencia . Fas**

**Decision:** Revenue tab removed (placeholder without data = noise). Re-add when AdSense integration is live.

#### Overview Tab

| Component | Content |
|-----------|---------|
| 6 KPIs | With sparkline via shared `<SparklineSvg>` |
| Content Funnel | Existing engagement funnel (Views -> Read50+ -> ClickedLink -> NLOpened -> Subscribed). `role="img"` with dynamic `aria-label` + sr-only data table fallback |
| Clicks over time | Line chart: current vs previous period + average |
| Traffic sources | Horizontal bars |
| Alert | "Maior vazamento do funil" insight |

**Decision:** Content Funnel keeps existing engagement funnel, NOT the pipeline funnel from original spec.

#### YouTube Tab

| Component | Content |
|-----------|---------|
| Health ring | Channel health score |
| KPIs | Views / Subs / CTR / Retention |
| Video table | With VVS grade (A/B/C/D) |
| A/B Lab | In-progress test + last winner |

#### Conteudo Tab

| Component | Content |
|-----------|---------|
| KPIs | Blog metrics |
| Read depth | Horizontal bars distribution |
| Engagement over time | Line chart |
| Top posts | Table with search |

#### Links Tab

| Component | Content |
|-----------|---------|
| KPIs | Click metrics |
| Link table | With UTM attribution + conversions |
| Origin domains | Referrer breakdown |

#### Audiencia Tab

| Component | Content |
|-----------|---------|
| Countries | Geo distribution |
| Devices | Device breakdown |
| Volume por estagio | Renamed from "Cross-system funnel" with footnote (not a real user journey) |

#### Fas Tab

- Top fans table sorted by total interactions

#### Query Performance

**Before:** `fetchClicksChart` fetched 10k rows. **After:** PostgreSQL RPCs with `GROUP BY`, returns max 90 rows.

**Decision:** Recharts eliminated. 2 remaining files migrated to custom SVG. `-200KB` bundle size.

---

### 4.5 Shared Components (extracted from Overview redesign)

| Component | Path | Replaces |
|-----------|------|----------|
| `<KpiCard>` | `_shared/kpi-card.tsx` | 5 duplicated KPI card variants |
| `<SparklineSvg>` | `_shared/sparkline-svg.tsx` | `blog/_shared/sparkline-svg.tsx` + `newsletters/_shared/sparkline-svg.tsx` |
| `chart-utils.ts` | `_shared/charts/chart-utils.ts` | Moved from `ab-lab/` (was stuck there) |

---

## 5. Implementation — State, Realtime, Tokens, Security, File Manifest

### 5.1 State Management (useReducer + Context, NOT Zustand)

```typescript
interface NotificationState {
  items: INotification[]
  unreadCount: number
  hasCritical: boolean
  lastReceived: string | null  // ISO timestamp for gap recovery
  isRecovering: boolean
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected'
}

type NotificationAction =
  | { type: 'SET_INITIAL'; items: INotification[]; lastReceived: string | null }
  | { type: 'ADD'; item: INotification }
  | { type: 'MARK_READ'; id: string }
  | { type: 'MARK_UNREAD'; id: string }
  | { type: 'MARK_ALL_READ' }
  | { type: 'DISMISS'; id: string }
  | { type: 'BULK_DISMISS'; ids: string[] }
  | { type: 'RECOVERY_START' }
  | { type: 'RECOVERY_COMPLETE'; items: INotification[] }
  | { type: 'CONNECTION_STATUS'; status: NotificationState['connectionStatus'] }
  | { type: 'REVERT_READ'; id: string }
  | { type: 'REVERT_DISMISS'; id: string; item: INotification }
```

**Data flow:**
1. RSC layout -> `fetchUnreadCount(siteId, userId)` -> `<NotificationBell initialCount={count} lastReceived={timestamp} />`
2. `useReducer(notificationReducer, initialState)` hydrated with RSC data
3. Shared via `NotificationContext`
4. RSC initial fetch seeds store on first mount only -- store is single source of truth after mount

### 5.2 Realtime (`useNotificationChannel`)

```typescript
function useNotificationChannel(userId: string, dispatch: React.Dispatch<NotificationAction>): void {
  // Channel: `notifications-${userId}` (singleton, deterministic)
  // postgres_changes: { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }
  //
  // On SUBSCRIBED: run gap recovery with lastReceived anchor
  // Gap recovery: fetch where created_at > lastReceived, dedup by id
  // isRecovering flag: queue Realtime events during recovery, process after
  // Max recovery window: 24 hours
  // visibilitychange handler: trigger gap recovery
  // Cleanup: supabase.removeChannel(channel)
  // Reference: lib/social/realtime.ts as implementation template
  // Dedup: capture lastReceived at START of recovery, do not update from Realtime during fetch
}
```

**Error recovery:**

| Scenario | Behavior |
|----------|----------|
| Realtime disconnect | Yellow dot on bell + "Reconectando..." + auto-retry with exponential backoff + gap recovery on reconnect |
| Server Action failure | Error toast via `useToast()` with retry button + revert optimistic update |
| RSC fetch failure | Error boundary with retry |
| Channel subscription error | Log to Sentry, fall back to 30s polling |

### 5.3 Server Actions (`lib/notifications/actions.ts`)

All actions use **user's own Supabase client** (NOT `getSupabaseServiceClient()`) so RLS applies.

| Action | Operation | Notes |
|--------|-----------|-------|
| `markRead(id)` | UPDATE `read_at = now()` | |
| `markUnread(id)` | UPDATE `read_at = NULL` | |
| `dismiss(id)` | UPDATE `dismissed_at = now()` | Client delays 5s for undo |
| `markAllRead(siteId)` | Bulk UPDATE WHERE `read_at IS NULL` | Rate limit: 5/min/user |
| `bulkDismiss(ids)` | Bulk UPDATE `dismissed_at = now()` | Client delays 7s for undo |
| `snooze(id, until)` | UPDATE `snoozed_until` | |
| `searchNotifications(query, cursor)` | ILIKE on `title` + `message` | Cursor pagination |

**No `revalidateTag` / `router.refresh()` -- store is single source of truth.**

### 5.4 Design Tokens

#### Dark Theme (default)

```
--bg:#0b0c10  --elev:#101117  --surface:#15161d  --surface-2:#1a1c24
--surface-hover:#1f212b  --border:#24262f  --border-soft:#1c1e26  --border-strong:#333645
--text:#ececf1  --text-muted:#9a9ca8  --text-dim:#686a76  --text-faint:#4a4c57
--accent:#fb7a52  --accent-hover:#ff8e6a  --accent-press:#e9663d  --on-accent:#1a0d07
--accent-soft: rgba(251,122,82,.14)  --accent-soft-2: rgba(251,122,82,.22)
```

#### Light Theme

```
--bg:#f4f3f0  --elev:#fff  --surface:#fff  --surface-2:#faf9f6
--border:#e6e4de  --text:#1b1c20  --text-muted:#5e6068  --text-dim:#8b8d96
--accent:#ef6a3d  --accent-press:#d9572c  --on-accent:#fff
```

#### Domain Colors (WCAG AA 4.5:1 in both themes)

| Domain | Dark | Light | Token |
|--------|------|-------|-------|
| Pipeline | `#22b8d6` | `#0e7a8f` | `--color-cms-domain-pipeline` |
| YouTube | `#ef4444` | `#b91c1c` | `--color-cms-domain-youtube` |
| Newsletter | `#a855f7` | `#7e22ce` | `--color-cms-domain-newsletter` |
| Social | `#f59e0b` | `#b45309` | `--color-cms-domain-social` |
| Links | `#22c55e` | `#15803d` | `--color-cms-domain-links` |
| System | `#f43f5e` | `#be123c` | `--color-cms-domain-system` |
| Blog | `#818cf8` | `#4338ca` | `--color-cms-domain-blog` |
| Media | `#f472b6` | `#be185d` | `--color-cms-domain-media` |

Semantic: ok `#22c55e` . warn `#f59e0b` . danger `#f43f5e` (mapped to `text-cms-red`) . info `#22b8d6`.

**`text-cms-danger` does NOT exist.** Use `text-cms-red`.

#### Typography

- Family: **Inter** (NOT Geist despite prototype). Configured in `globals.css` + `next/font/google`.
- Weights: 400/500/600/700
- Key scales: page title 18-22px/600; KPI value 30px/600 letter-spacing -1px; card-title 14px/600; body 13px; meta 11-12px; section-label 11px/600 uppercase letter-spacing 1px.

#### Spacing

- Border radius: `--radius-xl: 10px` (`rounded-xl`). Do NOT hardcode 12px/14px from prototype.
- Card shadow: `--pb-shadow-card`; popover: `--pb-shadow-popover`
- Sidebar 250px (collapses 64px <=1080px); topbar 64px
- Content padding 28/34px (comfortable), 16/24 (compact); max-width 1440px (1580px >=1720px)

### 5.5 Security

#### Telegram Deep Link (CRITICAL)

Current `telegram-connect.tsx` line 19 exposes raw user UUID. Fix:

```
Server: HMAC-SHA256(userId + timestamp, TELEGRAM_HMAC_SECRET) -> token (15min TTL)
Deep link: https://t.me/${botUsername}?start=${token}
Webhook: verify HMAC, check expiry, then update profile
```

#### Server Actions (CRITICAL)

- All notification mutations MUST use user's own Supabase client (NOT `getSupabaseServiceClient()`)
- RLS enforces `auth.uid() = user_id` -- prevents cross-user mutation
- `can_edit_site` is NOT sufficient (allows any editor to modify another user's notifications)

#### `action_href` Navigation

- Wrap with `safeRedirect()` from `@tn-figueiredo/auth-nextjs/safe-redirect` before `router.push()`
- Also fix existing `NotificationCenter` (line 82 uses raw `n.href`)

#### `create_yt_notification` RPC

- SECURITY DEFINER with no caller validation. Fix: add `IF NOT can_edit_site(p_site_id) THEN RAISE EXCEPTION 'forbidden'` OR revoke from `authenticated` role.

### 5.6 Codebase Mapping

| Prototype | Codebase |
|-----------|----------|
| `Icon` (SVG inline) | `lucide-react` |
| `--surface`, `--text` etc. | `bg-cms-surface`, `text-cms-text`, `text-cms-text-muted`, `border-cms-border` |
| Domain colors | `text-cms-domain-pipeline`, `bg-cms-domain-pipeline-subtle` (new tokens in `globals.css`) |
| `ToastHost` / `pushToast` | `ToastProvider` + `useToast()` from `@tn-figueiredo/cms-ui` |
| Shell | `CmsShell` + `CmsTopbar` (mount bell via `actions` prop) |
| `--radius: 14px` | Use `rounded-xl` (10px) per `--radius-xl` |
| Geist font | **Inter** (production uses Inter) |
| Zustand store | `useReducer` + `NotificationContext` |
| `useOptimistic` | Do NOT use alongside Realtime store |
| `router.refresh()` | Do NOT use. Store is source of truth. |
| `Skeleton` | `Skeleton`, `SkeletonBlock` from `@tn-figueiredo/cms-ui/client` |

### 5.7 File Manifest

#### NEW files

| Path | Purpose |
|------|---------|
| `lib/notifications/types.ts` | INotification, NotificationDomain, store shape |
| `lib/notifications/schemas.ts` | Zod schemas |
| `lib/notifications/create.ts` | createNotification() |
| `lib/notifications/dispatch.ts` | Orphan detection delivery loop |
| `lib/notifications/domain-colors.ts` | DOMAIN_COLORS, DOMAIN_ICON_MAP |
| `lib/notifications/use-notification-channel.ts` | Singleton Realtime hook |
| `lib/notifications/use-media-query.ts` | Shared responsive hook |
| `lib/notifications/actions.ts` | Server Actions |
| `lib/notifications/adapters/interface.ts` | IChannelAdapter |
| `lib/notifications/adapters/email.ts` | EmailAdapter |
| `lib/notifications/adapters/push.ts` | PushAdapter |
| `lib/notifications/adapters/telegram.ts` | TelegramAdapter |
| `lib/notifications/cron/deliver.ts` | Delivery worker |
| `lib/notifications/cron/unsnooze.ts` | Unsnooze cron |
| `lib/notifications/cron/cleanup.ts` | 90-day expiry cron |
| `lib/schedule/schedule-queries.ts` | Schedule types + 6 consolidated queries |
| `_shared/notification-bell.tsx` | NotificationBell (replaces notification-center.tsx) |
| `_shared/notification-popover.tsx` | NotifPopover (lazy loaded) |
| `_shared/bottom-drawer.tsx` | Reusable mobile BottomDrawer |
| `_shared/cms-switch.tsx` | Reusable CmsSwitch (`role="switch"`) |
| `_shared/cms-accordion.tsx` | Reusable CmsAccordion (`aria-expanded`) |
| `_shared/kpi-card.tsx` | Consolidated KPI card |
| `_shared/sparkline-svg.tsx` | Shared sparkline SVG component |
| `_shared/charts/chart-utils.ts` | Chart utilities (moved from ab-lab) |
| `notifications/page.tsx` | Inbox RSC page |
| `notifications/_components/inbox-client.tsx` | Client inbox with filters, bulk, list |
| `settings/notifications/_components/preferences-client.tsx` | Full preferences client |
| `settings/notifications/_components/lgpd-consent-dialog.tsx` | LGPD consent modal |
| `public/cms/sw.js` | Notification service worker |

#### MODIFY files

| Path | Change |
|------|--------|
| `cms-sections.ts` | Add Notifications entry to Overview section |
| `settings/notifications/page.tsx` | Expand beyond Telegram (full preferences) |
| `settings/notifications/_components/telegram-connect.tsx` | HMAC token instead of raw UUID |
| `globals.css` | Add domain color tokens (blog, media) |
| `calendar-grid.tsx` | Add `role="grid"` + roving tabindex + arrow navigation |
| `calendar-cell.tsx` | Add `role="gridcell"` + non-color indicators |
| `schedule-item.tsx` | Icon per type + "Atrasado" badge |
| `schedule-calendar.tsx` | Wire calendar a11y |
| `metrics-strip.tsx` | Use shared KpiCard |
| `schedule-backlog.tsx` | Date picker per item |
| `dashboard/page.tsx` | Command center layout |
| `dashboard-header.tsx` | Adaptive greeting |
| `dashboard-kpi-grid.tsx` | Use shared KpiCard |
| `dashboard-queries.ts` | Consolidate to ~14 queries with `unstable_cache` |
| `analytics/page.tsx` | Remove Revenue tab |
| `analytics-header.tsx` | Updated header |
| `content-funnel.tsx` | `role="img"` + aria-label + sr-only table |
| `fan-leaderboard.tsx` | Updated display |
| `analytics-queries.ts` | RPCs with GROUP BY |
| `views-trend-chart.tsx` | Custom SVG (no recharts) |
| `engagement-chart.tsx` | Custom SVG |
| `gem-design.ts` | Maintain for pipeline |
| `package.json` | Remove recharts (-200KB) |
| `lib/lgpd/container.ts` | Add notification adapter (7th slot) |

#### DELETE files

| Path | Reason |
|------|--------|
| `_shared/notification-center.tsx` | Replaced by notification-bell.tsx |
| `blog/_shared/sparkline-svg.tsx` | Replaced by shared sparkline |
| `newsletters/_shared/sparkline-svg.tsx` | Replaced by shared sparkline |

#### KEEP files

| Path | Notes |
|------|-------|
| `week-view.tsx` | Wire to Month/Week toggle in schedule |
| `youtube/analytics/_components/yt-notifications-bell.tsx` | Remains for YouTube-specific context; patterns ported |
| `youtube/analytics/actions.ts` | YT-specific notification actions remain |

### 5.8 Score Board

| # | Screen | Score | Fixes |
|---|--------|-------|-------|
| 1 | Bell Icon | 98/100 | 24 |
| 2 | Popover | 104/110 | 26 |
| 3 | Inbox | 104/110 | 40 |
| 4 | Preferences | 103/110 | 10 |
| 5 | Dashboard | 107/110 | 10 |
| 6 | Up Next | 101/110 | 10 |
| 7 | Schedule | 105/110 | 10 |
| 8 | Analytics | 105/110 | 10 |
| **Media** | | **103.4/110** | **140** |

### 5.9 Key Innovations per Screen

| Screen | Innovations |
|--------|------------|
| Preferences | Smart Conflict Detection (quiet hours + Telegram warning) . Preview Digest modal . Per-Category Schedule Override |
| Dashboard | Contextual Command Palette (Cmd+K) . Adaptive Greeting Intelligence . Momentum Streak Indicator |
| Up Next | Skip navigation links . Main landmark . Semantic `<time>` elements |
| Schedule | Cadence Heatmap underlay . Drag-to-Reschedule pills . Streak Ribbon across weeks |
| Analytics | Anomaly Pulse detection . Content Attribution Waterfall (Sankey) . Contextual Benchmarks (percentile gauges) |
