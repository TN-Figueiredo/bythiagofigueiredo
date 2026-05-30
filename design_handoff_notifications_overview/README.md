# Handoff: Sistema de Notificações + Redesign de Overview (Dashboard · Up Next · Schedule · Analytics)

> CMS **bythiagofigueiredo** — Next.js 15 · React 19 · Tailwind 4 · TypeScript 5 · Supabase (PostgreSQL 17) · Fastify 5

---

## 1. Overview

Este pacote cobre dois trabalhos entrelaçados:

1. **Sistema de notificações de propósito geral** (inexistente hoje): sino global no topbar + entrada fixa na navbar, popover, página de Inbox completa, página de Preferências e toasts. Substitui a tabela `yt_notifications` (YouTube-only) por uma infra cross-domain (pipeline, youtube, newsletter, social, links, system).
2. **Redesign visual e comportamental do Overview**: Dashboard (vira *command center*), Up Next, Schedule e Analytics — com um sistema de cores consistente, estados de loading/vazio desenhados, dark + light.

A decisão de IA adotada: **Dashboard e Analytics permanecem separados** (presente/ação vs. retrospectivo). Notificações ganham **dois pontos de entrada**: o **sino global no topbar** (presente em todas as telas) **e** um item **"Notificações" na seção Overview da sidebar** com badge de não-lidas. Preferências vivem em `/cms/settings/notifications`.

---

## 2. Sobre os arquivos de design (LEIA PRIMEIRO)

Os arquivos em `design_files/` são **referências de design feitas em HTML/React+Babel** — protótipos que mostram aparência e comportamento pretendidos. **Não são código de produção para copiar e colar.**

A tarefa é **recriar estes designs no codebase real** usando os padrões já existentes: componentes do `@tn-figueiredo/cms-ui` (CmsShell, CmsTopbar, ToastProvider/useToast), `lucide-react`, tokens semânticos do Tailwind 4 (`text-cms-text`, `bg-cms-surface`, etc.), Supabase Realtime e React Server Components.

O protótipo usa um único `App` React client-side com roteamento por estado, ícones lucide reescritos como SVG inline e dados mockados. No codebase real, troque por: RSC para fetch inicial, Server Actions para mutations, Realtime para push, e os componentes de UI do design system.

**Fidelidade: ALTA (hi-fi).** Cores, tipografia, espaçamento e interações são finais. Recriar fielmente, adaptando aos tokens reais do `cms-ui` quando o nome bater (o protótipo usa um superset; mapeamento na seção 8).

---

## 3. Mapa de telas

> **File tree** (all paths under `apps/web/src/`):
> ```
> lib/notifications/
>   types.ts                    # INotification, INotificationPreferences, INotificationRow, store shape
>   domain-colors.ts            # DOMAIN_COLORS, DOMAIN_ICON_MAP constants
>   use-notification-channel.ts # useNotificationChannel() — singleton Realtime hook
>   use-media-query.ts          # useMediaQuery() — shared responsive hook
>   actions.ts                  # Server Actions (markRead, dismiss, bulkDismiss, searchNotifications etc.)
> app/cms/(authed)/
>   _shared/
>     notification-bell.tsx     # <NotificationBell> (replaces/deprecates notification-center.tsx)
>     notification-popover.tsx  # <NotifPopover> (lazy loaded)
>     bottom-drawer.tsx         # <BottomDrawer> reusable mobile component
>     cms-switch.tsx            # <CmsSwitch> reusable accessible toggle
>   notifications/
>     page.tsx                  # Inbox RSC page
>     _components/
>       inbox-client.tsx        # Client inbox with filters, bulk, list
>   settings/notifications/
>     page.tsx                  # Preferences RSC page (expand existing)
>     _components/
>       preferences-client.tsx  # Channels, frequency, per-category, quiet hours
>       telegram-connect.tsx    # Existing — update deep link to use HMAC token
>       lgpd-consent-dialog.tsx # LGPD consent modal for email/push opt-in
> ```
>
> **Disposition of existing files:**
> - `_shared/notification-center.tsx` — **deprecated**, replaced by `notification-bell.tsx`
> - `youtube/analytics/_components/yt-notifications-bell.tsx` — remains for YouTube-specific context; patterns (focus trap, optimistic) ported to the new shared bell
> - `youtube/analytics/actions.ts` — notification actions remain for YT; new `lib/notifications/actions.ts` handles cross-domain
>
> **TypeScript interfaces** (defined in `lib/notifications/types.ts`):
> ```typescript
> // Maps 1:1 to the notifications DB table
> interface INotification {
>   id: string
>   site_id: string
>   user_id: string | null
>   type: string
>   domain: NotificationDomain
>   priority: 1 | 2 | 3 | 4 | 5
>   title: string
>   message: string | null
>   payload: Record<string, unknown> | null
>   dedup_key: string | null
>   group_key: string | null
>   read_at: string | null
>   dismissed_at: string | null
>   expired_at: string | null
>   snoozed_until: string | null
>   suggested_action: string | null
>   action_href: string | null
>   created_at: string
> }
>
> type NotificationDomain = 'pipeline' | 'youtube' | 'newsletter' | 'social' | 'links' | 'blog' | 'media' | 'system'
>
> interface INotificationRowProps {
>   notification: INotification
>   variant: 'popover' | 'inbox'
>   selected?: boolean
>   onSelect?: (id: string) => void
>   onAction: (n: INotification) => void
>   onToggleRead: (id: string) => void
>   onDismiss: (id: string) => void
> }
>
> // useReducer-based store (NOT Zustand — see rationale)
> interface NotificationState {
>   items: INotification[]
>   unreadCount: number
>   hasCritical: boolean
>   lastReceived: string | null  // ISO timestamp for gap recovery
>   isRecovering: boolean
>   connectionStatus: 'connected' | 'reconnecting' | 'disconnected'
> }
>
> type NotificationAction =
>   | { type: 'SET_INITIAL'; items: INotification[]; lastReceived: string | null }
>   | { type: 'ADD'; item: INotification }
>   | { type: 'MARK_READ'; id: string }
>   | { type: 'MARK_UNREAD'; id: string }
>   | { type: 'MARK_ALL_READ' }
>   | { type: 'DISMISS'; id: string }
>   | { type: 'BULK_DISMISS'; ids: string[] }
>   | { type: 'RECOVERY_START' }
>   | { type: 'RECOVERY_COMPLETE'; items: INotification[] }
>   | { type: 'CONNECTION_STATUS'; status: NotificationState['connectionStatus'] }
>   | { type: 'REVERT_READ'; id: string }
>   | { type: 'REVERT_DISMISS'; id: string; item: INotification }
>
> interface INotificationPreferences {
>   id: string
>   user_id: string
>   site_id: string
>   category: NotificationDomain | null  // null = global defaults
>   channel_in_app: boolean
>   channel_email: boolean
>   channel_push: boolean
>   channel_telegram: boolean
>   frequency_preset: 'calm' | 'regular' | 'power'
>   quiet_hours_enabled: boolean
>   quiet_hours_start: string  // HH:MM
>   quiet_hours_end: string    // HH:MM
>   quiet_hours_timezone: string
>   updated_at: string
> }
> ```
>
> **Domain constants** (defined in `lib/notifications/domain-colors.ts`):
> ```typescript
> import type { NotificationDomain } from './types'
> import { Layers, Youtube, Mail, Send, Link2, FileText, Image, Shield } from 'lucide-react'
>
> export const DOMAIN_ICON_MAP: Record<NotificationDomain, LucideIcon> = {
>   pipeline: Layers, youtube: Youtube, newsletter: Mail, social: Send,
>   links: Link2, blog: FileText, media: Image, system: Shield,
> }
>
> // CSS custom property names — auto-switch via data-theme
> export const DOMAIN_COLORS: Record<NotificationDomain, { color: string; subtle: string; label: string }> = {
>   pipeline:   { color: 'var(--color-cms-domain-pipeline)',   subtle: 'var(--color-cms-domain-pipeline-subtle)',   label: 'Pipeline' },
>   youtube:    { color: 'var(--color-cms-domain-youtube)',    subtle: 'var(--color-cms-domain-youtube-subtle)',    label: 'YouTube' },
>   newsletter: { color: 'var(--color-cms-domain-newsletter)', subtle: 'var(--color-cms-domain-newsletter-subtle)', label: 'NL' },
>   social:     { color: 'var(--color-cms-domain-social)',     subtle: 'var(--color-cms-domain-social-subtle)',     label: 'Social' },
>   links:      { color: 'var(--color-cms-domain-links)',      subtle: 'var(--color-cms-domain-links-subtle)',      label: 'Links' },
>   blog:       { color: 'var(--color-cms-domain-blog)',       subtle: 'var(--color-cms-domain-blog-subtle)',       label: 'Blog' },
>   media:      { color: 'var(--color-cms-domain-media)',      subtle: 'var(--color-cms-domain-media-subtle)',      label: 'Media' },
>   system:     { color: 'var(--color-cms-domain-system)',     subtle: 'var(--color-cms-domain-system-subtle)',     label: 'Sistema' },
> }
> ```

### 3.1 Shell (global)
- **Sidebar** (250px, fixa, colapsa para 64px <=1080px): marca (logo "TF" gradiente coral-->vermelho), secoes `Overview / Content / Library / Social / People`, footer com `Settings` + switcher de org + usuario.
  - **Overview**: Dashboard, Up Next, Schedule, Analytics, **Notificacoes** (icone `Bell` from `lucide-react`, badge rose com contagem de nao-lidas, `9+` se >9). Novo item em `cms-sections.ts` apos Analytics.
  - Badges existentes preservados (Newsletters 1/2, Research 1) via padrao `SidebarBadges` (portal). Notification badge usa mesmo `SidebarBadges` Pill pattern: `bg-cms-accent/15 text-cms-accent` (translucent, alinhado com badges existentes).
- **Topbar** (64px): titulo da pagina. Lado direito: seletor de periodo (7/30/90 dias), botao Tweaks, toggle de tema, **sino** com badge.
  - Badge do sino: coral (`text-cms-accent` / `bg-cms-accent`) para nao-lidas normais; **`text-cms-red`** (maps to `var(--theme-danger, #ef4444)`) se houver alguma prioridade 5 nao-lida. Texto `9+` se >9.
  - **Light theme badge:** dark text (`#1a0d07` / `--on-accent`) on accent background. Danger badge darkened to `#be123c` or uses dark text. Must meet 4.5:1 at rendered size.
  - **Color-blind safety:** Danger badge adds secondary indicator beyond color: `motion-safe:animate-pulse` continuous subtle pulse, or `!` glyph inside badge. Coral vs danger must have non-color differentiation (WCAG 1.4.1).
  - **Touch target:** bell button minimum `min-w-11 min-h-11` (44px). Apply via Tailwind.
  - `aria-label="Notificacoes, {count} nao lidas"`
  - **Animations:** badge pulse (2x) + bell shake (600ms) on Realtime INSERT. **MUST** be wrapped in `motion-safe:` prefix. In `prefers-reduced-motion: reduce`, disable bellRing/badgePulse entirely or reduce to single subtle opacity flash.
  - Click --> opens `<NotifPopover>` (lazy via `next/dynamic`, `ssr: false`). On mobile (`useMediaQuery('(max-width: 639px)')`), opens `<BottomDrawer>` instead.

**CmsShell integration — topbar actions slot:**
- CmsTopbar already accepts `actions?: React.ReactNode` prop. Pass `<NotificationBell>` wrapped in Suspense as `actions` in each page's CmsTopbar, OR extend CmsShell to accept `topbarActions` prop rendered persistently across pages. Option B (topbarActions on CmsShell) is the clean solution -- add to `CmsShellProps` in `@tn-figueiredo/cms-ui`.
- Alternatively, use the existing `SidebarBadges` portal pattern: `<NotificationBellPortal>` mounts via `createPortal` into a well-known DOM target injected by CmsShell.

**Data flow (NO Zustand — useReducer + Context):**
- **Rationale:** Zustand is not in package.json. The codebase exclusively uses React 19 built-in state management. `YtNotificationsBell` already implements optimistic updates without external stores. Adding Zustand for one feature contradicts the reuse-first principle. A `useReducer` + Context achieves the same cross-component sharing.
- RSC layout --> `fetchUnreadCount(siteId, userId)` --> `<NotificationBell initialCount={count} lastReceived={mostRecentTimestamp} />`
- `useReducer(notificationReducer, initialState)` hydrated with RSC data. Shared via `NotificationContext`.
- The RSC initial fetch **seeds the store on first mount only**. After mount, the store is the single source of truth.
- `useNotificationChannel(userId)` -- singleton Supabase channel (see 3.5 for full contract)
  - on INSERT --> `dispatch({ type: 'ADD', item })` + dedup by `id`
  - on SUBSCRIBED status --> immediate gap recovery using `lastReceived` from initial props
  - on reconnect --> gap recovery (`fetch created_at > lastReceived`)
  - on `visibilitychange` --> `triggerGapRecovery()`
- **No `router.refresh()` or `revalidateTag` after mutations.** The store-based approach is superior since Realtime provides live updates. Pattern: optimistic store update --> call server action --> Realtime confirms. On error, revert optimistic update.

**`useNotificationChannel` full contract:**
```typescript
function useNotificationChannel(userId: string, dispatch: React.Dispatch<NotificationAction>): void {
  // Channel name: `notifications-${userId}`
  // postgres_changes config: { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }
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

**Error states (all defined):**
1. **Realtime disconnect:** yellow dot on bell + `Reconectando...` indicator. Auto-retry with exponential backoff. Gap recovery on reconnect. `dispatch({ type: 'CONNECTION_STATUS', status: 'reconnecting' })`.
2. **Server Action failure:** error toast via `useToast()` from `@tn-figueiredo/cms-ui` with retry button. Revert optimistic update: `dispatch({ type: 'REVERT_READ', id })` or `dispatch({ type: 'REVERT_DISMISS', id, item })`.
3. **RSC fetch failure:** error boundary with retry.
4. **Channel subscription error:** log to Sentry, fall back to 30s polling.

**Live region for real-time arrivals:**
- `<span className="sr-only" aria-live="assertive">` for priority 4+ arrivals: "Nova notificacao critica: {title}"
- `<span className="sr-only" aria-live="polite">` for normal arrivals: "Nova notificacao: {title}"
- Extends the existing `yt-notifications-bell.tsx` pattern at line 136.

### 3.2 Popover de notificacoes (sino)
- Width: 408px, anchored below bell. **Mobile <640px --> bottom drawer** (see 3.2.1).
- Lazy-loaded via `next/dynamic` with Skeleton fallback (`Skeleton`/`SkeletonBlock` from `@tn-figueiredo/cms-ui`).
- **Focus trap** ported from `yt-notifications-bell.tsx` (Tab wrapping logic at lines 111-132).
- `role="dialog"`, **`aria-modal="true"`** on mobile drawer. **`inert`** attribute on main content when open. Body scroll locking when drawer/popover open.

**Structure:**
- Header: "Notificacoes ({count})" + "Marcar todas" link (min-height 44px touch target) + gear icon --> Preferences (min-w-11 min-h-11 touch target)
- Filter chips: horizontal scroll -- Todas | Nao lidas | Pipeline | YouTube | NL | Social | Links | Sistema
  - Container: `role="radiogroup"` `aria-label="Filtrar notificacoes"`
  - Each chip: `role="radio"` `aria-checked={filter === k}`
  - **Arrow-key navigation** with roving tabindex per WAI-ARIA radio group pattern (Left/Right moves focus)
- List container: `role="list"` `aria-label="Lista de notificacoes"`. Max 8 items, each with:
  - Left border: domain color (CSS custom property `--color-cms-domain-{domain}` -- auto-switches via data-theme)
  - Icon: domain icon in soft-fill circle
  - Blue dot: unread indicator
  - Title + priority badge (Critico/Alta) + relative time
  - Message text + domain label (text uses domain color variable -- WCAG compliant in both themes)
  - Action buttons: [primary action] [mark read] [dismiss]. Dismiss button: **wrap in 44px touch area** with padding, not just 14px icon. Use `@media (hover: none)` to make actions always visible on touch devices.
  - Priority badges use `text-cms-red` (not `text-cms-danger` which does not exist in the design system).
- **Footer with count:** "Ver todas as {total} notificacoes -->" when total > showing, else "Ver todas as notificacoes -->" link to `/cms/notifications`.
- Threading: 3+ with same `group_key` --> collapsible card. Thread summary uses **domain-aware computation** from notification `payload` jsonb column, not regex on title. Fallback: "N atualizacoes de {domain}".
  - Thread expand button: `aria-expanded={open}`, `aria-controls="thread-body-{id}"`, `aria-label="{count} atualizacoes de {domain}, {unread} nao lidas"`
- Close: Escape + click outside. Focus returns to bell on close.

**Interactions:**
- Primary action: marks read + navigates to `action_href` via **`safeRedirect()`** (from `@tn-figueiredo/auth-nextjs/safe-redirect`). Defense-in-depth even though current data sources are server-controlled.
- Mark read/unread: toggles `read_at`. Read line at **opacity 0.72** (NOT 0.62 -- at 0.62, muted text drops below WCAG AA). Keep left border, domain icon, and action buttons at full opacity.
- Dismiss: slide-out animation (translateX 36px + fade, 260ms, **`motion-safe:`** prefix) --> undo toast 5s via `useToast()` from `@tn-figueiredo/cms-ui` --> commit. In `prefers-reduced-motion: reduce`, use simple opacity fade (150ms).
- Thread expand/collapse: accordion pattern with `aria-expanded`

**3.2.1 Mobile Bottom Drawer (<640px):**
- Create `useMediaQuery(query: string): boolean` hook.
- Create reusable `<BottomDrawer>` component:
  - Two snap points: 60vh (peek) and 90vh (full)
  - **Drag handle** with touch event listeners: `onTouchStart/Move/End` tracking vertical swipe distance
  - Velocity-based snap: fast swipe up --> 90vh, fast swipe down --> close, slow drag --> nearest snap
  - `aria-modal="true"`, `inert` on background content, body scroll lock (`overflow: hidden` on `<body>`)
  - `aria-label` on drag handle: "Arrastar para expandir"
  - **No gesture library needed** -- lightweight custom hook with touch events, similar to existing MobileTocSheet pattern but with actual event handling
  - Overlay backdrop: `bg-black/40` with click-to-close

### 3.3 Inbox (`/cms/notifications`)
- RSC page with initial fetch + Suspense. Skeleton: 6 rows using `Skeleton`/`SkeletonBlock` from `@tn-figueiredo/cms-ui`.
- Header: "Caixa de notificacoes" + "{X} nao lidas . {Y} no total" + "Marcar todas lidas" + "Preferencias -->"
- Filter chips with domain dot + count per domain. Container: `role="radiogroup"` `aria-label="Filtrar notificacoes"`. Each chip: `role="radio"` `aria-checked`. Arrow-key navigation.
- **Search:** client-side filter for loaded notifications + debounced server-side `ILIKE` fallback via `searchNotifications` server action. Create `searchNotifications(query, cursor)` using PostgreSQL `ILIKE` on `title` and `message` with cursor pagination.
- **Bulk bar** (on selection): `role="toolbar"` `aria-label="Acoes em lote"`. Count with `aria-live="polite"`: "{N} selecionada(s)" + Marcar lidas / Dispensar / Cancelar.
  - **Bulk dismiss:** single aggregate undo toast: "{N} notificacoes dispensadas [Desfazer]" with **7-second window**. Delay `bulkDismiss` server action until undo expires. Store dismissed IDs in transient client state for instant restoration. Stagger slide-out animations by 40ms.
- List grouped by **4 time buckets using calendar-day boundaries** (user timezone via `Intl.DateTimeFormat`): Hoje | Ontem | Esta Semana | Mais Antigos.
  - Each bucket: `role="group"` with `aria-labelledby` pointing to bucket heading `id`.
  - Notification list inside each bucket: `role="list"` `aria-label="Notificacoes de {bucket}"`.
- Each row checkbox: `role="checkbox"` `aria-checked` `aria-label="Selecionar notificacao: {title}"`. Touch target: **44px minimum** via padding on mobile, desktop-density at sm+.
- Threading same as popover (`group_key` >= 3 items)
- Loading state: skeleton of 6 rows using `SkeletonBlock` from cms-ui
- Empty state: "Voce esta em dia" with illustration (EmptyState component from cms-ui)
- Pagination: cursor-based load-more (LIMIT 50, cursor = last `created_at`)
- Snooze: action menu with presets (15min, 1h, 3h, Tomorrow 9am, Monday 9am). **Resolve using stored timezone** from notification_preferences and show resolved local time.
- **Mobile row actions:** Use `@media (hover: none)` to make dismiss/snooze buttons always visible. Implement swipe-to-dismiss: left swipe reveals red dismiss area, completing swipe triggers dismiss with undo toast. Use existing `rowLeave` keyframe. Add `navigator.vibrate(10)` on threshold (noop on desktop).

**Server Actions** (in `lib/notifications/actions.ts`):
- All actions use **user's own Supabase client** (NOT `getSupabaseServiceClient()`) so RLS (`auth.uid() = user_id`) applies. This prevents cross-user mutation.
- `markRead(id)` / `markUnread(id)` -- UPDATE `read_at`
- `dismiss(id)` -- client-side pending 5s --> commit UPDATE `dismissed_at`
- `markAllRead(siteId)` -- bulk UPDATE WHERE `read_at IS NULL` AND `user_id = auth.uid()`. Rate limit: 5 calls/minute/user via simple timestamp check.
- `bulkDismiss(ids)` -- bulk UPDATE `dismissed_at`
- `snooze(id, until)` -- UPDATE `snoozed_until`
- `searchNotifications(query, cursor)` -- server-side ILIKE with cursor pagination
- **No `revalidateTag` / `router.refresh()`** -- store is single source of truth.

### 3.4 Preferencias (`/cms/settings/notifications`)
- RSC page, **max-width 860px on sm+, full-width on mobile**. Responsive grids collapse on mobile.

**0. Reusable components needed first:**
- `<CmsSwitch>`: `<button role="switch" aria-checked={on} aria-label="{name}">` with `tabindex="0"`. Responds to Space/Enter keypress. Locked variant: `aria-disabled="true"` `tabindex="-1"`. Touch target: 44px minimum on mobile. Co-locate in `_shared/cms-switch.tsx` for reuse across preferences.
- `<CmsAccordion>`: `<button aria-expanded={open} aria-controls={bodyId}>` with body `<div id={bodyId}>`. Reusable for per-category section.
- Both can be retroactively adopted by FAQ, beat, script-beat accordion instances.

**1. Delivery Channels (grid-cols-1 sm:grid-cols-2):**
- In-app: always on (LGPD contract). `<CmsSwitch>` with `aria-disabled="true"`, "Obrigatorio" label.
- Email: toggle + **LGPD consent dialog** before activation.
- Push: toggle + **LGPD consent dialog** + browser `Notification.requestPermission()`.
- Telegram: "Conectar" button --> generates **HMAC-signed token** server-side (`HMAC-SHA256(userId + timestamp, secret)`) --> deep link to bot using token (NOT raw UUID). Webhook handler verifies HMAC and checks expiry before updating profile.
- Active cards: accent-soft background.

**LGPD consent dialog** (for email/push opt-in):
- Modal dialog, max-width 480px.
- Content: explains data processing purpose per LGPD Art. 7, data collected, retention period, right to revoke.
- Buttons: "Cancelar" (secondary) and "Concordo e ativar" (primary).
- For push: chain `Notification.requestPermission()` after consent acceptance.
- Record consent timestamp in `notification_preferences`.
- `role="alertdialog"`, `aria-modal="true"`, focus trap, inert background.

**2. Frequency (grid-cols-1 sm:grid-cols-3 radio cards):**
- **Calmo**: "Essencial -- So alertas criticos: falhas de publicacao, tokens expirados. Resto num resumo diario."
- **Regular** (default): "Equilibrado -- A/B tests, metas atingidas, avisos de pipeline em tempo real. Metricas menores no resumo."
- **Power**: "Tudo -- Tudo em tempo real, incluindo cada clique e digest completo."
- Container: `role="radiogroup"` `aria-label="Frequencia de notificacoes"`
- Each card: `role="radio"` `aria-checked={preset === k}`
- Arrow-key navigation (Up/Down/Left/Right) with roving tabindex per WAI-ARIA radio group pattern.

**3. Per Category (accordion per domain):**
- **8 domains**: Pipeline, YouTube, Newsletter, Social, Links, Blog, Media, Sistema.
- Blog and Media domain tokens added to globals.css: `--cms-domain-blog` (indigo: `#818cf8` dark / `#4338ca` light) and `--cms-domain-media` (pink: `#f472b6` dark / `#be185d` light).
- Each expands to show per-channel toggles (in-app/email/push/telegram) using `<CmsSwitch>`.
- **Global OFF overrides:** When a global channel is OFF, per-category toggles for that channel render as `aria-disabled="true"` `tabindex="-1"` at `opacity: 0.4` with tooltip: "Canal {name} desativado globalmente". Inline alert at top of expanded section.
- Sistema/in-app locked (`aria-disabled="true"`, `tabindex="-1"`).
- Each accordion button: `aria-expanded={open}` `aria-controls="cat-body-{domain}"`.

**4. Quiet Hours:**
- Toggle "Pausar nao-criticas" via `<CmsSwitch>` with `aria-label="Horario de silencio ativo"`.
- **Two time pickers** (start/end) as dropdown selects with 30-minute increments.
- **Timezone dropdown** with auto-detection via `Intl.DateTimeFormat().resolvedOptions().timeZone` as default. Searchable, current value highlighted, shows local time.
- Store timezone in `notification_preferences.quiet_hours_timezone`.
- Snooze presets resolve using stored timezone.
- Priority 5 bypasses quiet hours entirely (system domain only).

**ARIA summary:** all switches with `role="switch"` + `aria-checked`, all accordions with `aria-expanded` + `aria-controls`, all radios with `role="radio"` + arrow-key nav, quiet hours with `aria-label`.

### 3.5 Design System Tokens & Accessibility

**Domain colors (WCAG AA 4.5:1 compliant in both themes):**
CSS custom properties auto-switch via `[data-theme]`. Defined in `globals.css`:
| Domain | Dark | Light | Token |
|---|---|---|---|
| Pipeline | `#22b8d6` | `#0e7a8f` | `--color-cms-domain-pipeline` |
| YouTube | `#ef4444` | `#b91c1c` | `--color-cms-domain-youtube` |
| Newsletter | `#a855f7` | `#7e22ce` | `--color-cms-domain-newsletter` |
| Social | `#f59e0b` | `#b45309` | `--color-cms-domain-social` |
| Links | `#22c55e` | `#15803d` | `--color-cms-domain-links` |
| System | `#f43f5e` | `#be123c` | `--color-cms-domain-system` |
| Blog | `#818cf8` | `#4338ca` | `--color-cms-domain-blog` |
| Media | `#f472b6` | `#be185d` | `--color-cms-domain-media` |

All downstream usage (badge text, domain labels, priority badges, left-border) inherits automatically via CSS custom properties.

**Border radius:** Use existing `--radius-xl` (10px / `rounded-xl`) for card surfaces, consistent with the established theme. Do NOT hardcode 12px or 14px -- that would require a global design system change.

**Font:** Keep Inter per existing design system. Verify that 11px meta text and 9px badge text render well. Adjust sizes by 1px if needed after visual inspection.

**Toast system:** Use `useToast()` from `@tn-figueiredo/cms-ui` as mandated. The `action: { label, onClick }` interface is sufficient for undo. Accept existing auto-dismiss timing. Do NOT create a fourth toast system. Position on mobile: above virtual keyboard via `visualViewport` API, or move to top-center.

**Notification sound:** No notification sound in v1. Visual feedback sufficient for CMS admin panel. Audio can be added as a user preference in future iteration.

**Keyboard shortcut:** No global keyboard shortcut for notifications in v1 -- bell click and sidebar nav only. Can add `Ctrl+Shift+N` in future iteration.

### 3.6 Security

**Telegram deep link (CRITICAL):**
Current `telegram-connect.tsx` line 19 exposes raw user UUID in deep link. Fix:
- Generate server-side: `HMAC-SHA256(userId + timestamp, TELEGRAM_HMAC_SECRET)` --> short-lived token (15 min TTL)
- Deep link: `https://t.me/${botUsername}?start=${token}`
- Webhook handler: verify HMAC, check expiry, then update profile

**Server Actions (CRITICAL):**
- All notification mutations MUST use user's own Supabase client (NOT `getSupabaseServiceClient()`) so RLS applies (`auth.uid() = user_id`).
- The existing YT pattern of using service client MUST NOT carry forward to user-scoped notifications.
- The `can_edit_site` check is not sufficient -- it allows any editor to modify another user's notifications.

**`action_href` navigation:**
- Wrap `n.action_href` with `safeRedirect()` (from `@tn-figueiredo/auth-nextjs/safe-redirect`) before passing to `router.push()`.
- Apply same guard in the existing `NotificationCenter` (line 82 uses raw `n.href`).
- Defense-in-depth even though current data sources are server-controlled.

**`create_yt_notification` RPC:**
- SECURITY DEFINER function with no caller validation. Either:
  - Add `IF NOT can_edit_site(p_site_id) THEN RAISE EXCEPTION 'forbidden'` inside function body, OR
  - `REVOKE EXECUTE ON FUNCTION create_yt_notification FROM authenticated` and allow only `service_role`.

### 3.7 Dashboard (command center) -- `/cms`
Saudacao no topbar. Conteudo:
- **Acoes rapidas** (grid 4): Novo Post / Novo Video / Nova Edicao / Item Pipeline -- icone domain-tinted, atalho de teclado (P/V/N/I).
- Grid principal `1.55fr / 1fr`:
  - **Esquerda**: card "Precisa de atencao" (lista de itens com borda de dominio + prioridade --> rota) e "Foco de hoje" (puxado do Up Next).
  - **Direita**: "Notificacoes recentes" (top nao-lidas) + "Saude do buffer" (ring + breakdown + recomendacao).
- **Resumo de performance** (grid 4 mini-metricas + sparkline) --> link "Ver Analytics".
- Estados loading/vazio ("Tudo pronto para comecar" + CTA).

### 3.8 Analytics -- `/cms/analytics`
Tabs: **Overview . YouTube . Conteudo . Links . Audiencia . Fas . Receita**.
- **Overview**: 6 KPIs com sparkline + Funil de conteudo (% de vazamento por etapa) + Cliques ao longo do tempo (linha atual vs. anterior + media) + Fontes de trafego (hbars) + alerta "Maior vazamento do funil".
- **YouTube** (coracao): ring de saude + KPIs (views/subs/CTR/retencao) + tabela de videos com **grade VVS** (A/B/C/D) + A/B Lab em andamento + ultimo vencedor.
- **Conteudo**: KPIs + distribuicao de profundidade de leitura (hbars) + engajamento ao longo do tempo + Top posts (tabela com busca).
- **Links**: KPIs + tabela de links + atribuicao UTM (com conversoes) + dominios de origem.
- **Audiencia**: paises + dispositivos + funil cross-system (YouTube-->Blog-->Newsletter).
- **Fas**: tabela de top fas por interacoes.
- **Receita**: total + breakdown por fonte (AdSense/Memberships/Afiliados/Sponsorships).

### 3.9 Schedule -- `/cms/schedule`
Nav de mes + legenda (Blog/Newsletter/Video) + 4 KPIs (Publicado/Agendado/Saude da cadencia/Atrasados) + calendario mensal com eventos color-coded (agendados = tracejado/opaco) + slots livres + Backlog colapsavel.

### 3.10 Up Next -- `/cms/up-next`
Header de progresso do dia + badge de buffer + Fila de producao (Atrasado/Hoje, cards com Avancar etapa/Fixar no foco/Editar) + banner de celebracao + **Foco de hoje interativo** (ate 3 slots fixaveis, com grip e desafixar) + Proximos 7 dias + Sugestoes por playlist + **Atividade recente** (timeline).

---

## 4. Interacoes & comportamento

- **Navegacao**: itens core trocam de rota. Notification action_href wrapped in `safeRedirect()` before `router.push()`.
- **Notificacao -- acao**: marca como lida + navega para `safeRedirect(action_href)`.
- **Marcar lida / nao lida**: alterna `read_at`; linha lida fica em **`opacity: .72`** (NOT .62 -- at .62 muted text fails WCAG AA). Text elements dimmed selectively; border/icon/actions at full opacity.
- **Dispensar**: animacao **slide-out** (`translateX(36px)` + fade, 260ms) wrapped in `@media (prefers-reduced-motion: no-preference)`. In reduced motion: simple opacity fade 150ms. **Undo toast 5s** via `useToast()` from cms-ui, then commit. **Bulk dismiss**: aggregate undo toast "N notificacoes dispensadas [Desfazer]" with 7s window.
- **Threading**: agrupa por `group_key` quando >=3. Summary uses domain-aware computation from `payload` jsonb. Thread head: `aria-expanded` + `aria-controls`.
- **Toasts**: `useToast()` from `@tn-figueiredo/cms-ui` exclusively. Auto-dismiss ~4.2s. Support `action: { label, onClick }` for undo. On mobile: position above virtual keyboard via `visualViewport` API. Do NOT create a fourth toast system.
- **Realtime**: on INSERT --> optimistic store update via `dispatch` + toast + **pulse no badge** (2x) + **bell shake** (600ms). All gated behind `motion-safe:`. New notification announced via `aria-live="assertive"` (prio 4+) or `aria-live="polite"` (normal).
- **Teclado/A11y**:
  - Focus visible: outline accent 2px offset 3px (already in globals.css).
  - Notification rows: `tabIndex=0` `role="listitem"` inside `role="list"` container. Enter=acao, Delete/Backspace=dispensar.
  - Filter chips: `role="radiogroup"` + `role="radio"` + `aria-checked`. Arrow-key navigation with roving tabindex.
  - Checkboxes: `role="checkbox"` + `aria-checked` + `aria-label="Selecionar notificacao: {title}"`.
  - Switches: `<button role="switch" aria-checked={on}>`. Space/Enter toggles. Locked: `aria-disabled="true"` `tabindex="-1"`.
  - Accordions: `aria-expanded` + `aria-controls`.
  - Frequency cards: `role="radiogroup"` + `role="radio"` + arrow-key nav.
  - Popover: `role="dialog"` + `aria-modal="true"` + focus trap + `inert` on background. Escape closes.
  - Mobile drawer: same `aria-modal` + `inert` + body scroll lock.
- **Animacoes**: all wrapped in `@media (prefers-reduced-motion: no-preference)` or `motion-safe:` prefix. rowLeave, bellRing, badgePulse, fade-in. In reduced motion: animations disabled or reduced to single-frame.
- **Tema**: dark (default) + light, via `data-theme` no `<html>`. Domain colors auto-switch to darker WCAG-compliant variants in light theme via CSS custom properties.
- **Densidade**: confortavel / compacto, via `data-density`.

---

## 5. Estado & dados

Estado de UI no prototipo (no real, dividir entre RSC/store):
- `route`, `theme`, `density`, `accent`, `period` -- preferencias/UI (theme/density podem ir pra perfil do usuario).
- `notifs[]` -- **vem do Supabase**: fetch inicial (RSC) + subscription Realtime (INSERT) + Server Actions para read/dismiss/markAll.
- `unread` derivado (`read_at == null`), `crit` derivado (priority 5 nao-lida).
- `popover`, `tweaks`, `bump` (animacao) -- efemeros.
- Up Next: `focus[]` (itens fixados, persistir por usuario).

### State management (useReducer + Context, NOT Zustand)
- **Rationale:** Zustand is not in `package.json` and the codebase exclusively uses React 19 built-in state (`useState`, `useOptimistic`, `useTransition`). Adding Zustand for one feature contradicts the reuse-first architecture. A `useReducer` + `NotificationContext` achieves identical cross-component sharing.
- **Do NOT use `useOptimistic` alongside the Realtime store.** `useOptimistic` maintains temporary state that reverts on transition completion using server-provided props as baseline. If Realtime events mutate the store independently, the two sources diverge. Instead: apply optimistic updates directly in the reducer (mark read = update item immediately, call server action, revert on error). Realtime events update the same store. The RSC initial fetch only seeds the store on first mount.
- **No `router.refresh()` or `revalidateTag` after mutations.** The store is the single source of truth.

### Realtime
- `postgres_changes` filtered by `user_id=eq.{currentUser}` on table `notifications`.
- Channel name: `notifications-{userId}` (deterministic, singleton).
- RSC seeds initial state; `useEffect` client subscribes to INSERT; `useReducer` manages state.
- **Hydration gap recovery:** Set `lastReceived` to the timestamp of the most recent notification from RSC initial fetch (pass as prop). On subscription SUBSCRIBED status callback, immediately run gap recovery using that anchor timestamp. This covers the window between SSR and Realtime activation.
- **Dedup:** use notification ID in reducer's ADD action. Capture `lastReceived` at START of recovery, do not update from Realtime during fetch. Use `isRecovering` flag to queue Realtime events and process after recovery completes.
- **Singleton:** Create one `useNotificationChannel()` hook managing one channel. All consumers (bell, popover, inbox) read from shared context. No independent subscriptions.
- Mark-as-read: optimistic reducer update --> Server Action --> Realtime confirms. On error, revert.

---

## 6. Arquitetura de banco & entrega (do brief — implementar no real)

### Schema (substitui `yt_notifications`)
```sql
create table notifications (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id),
  user_id uuid references profiles(id),            -- null = site-wide
  type text not null,
  domain text not null,                            -- pipeline|youtube|newsletter|social|links|blog|media|system
  priority int not null check (priority between 1 and 5),
  title text not null,
  message text,
  payload jsonb,                                   -- polimórfico
  dedup_key text,                                  -- agrupa/dedup (ex: type:videoId:weekIso)
  group_key text,                                  -- threading visual
  read_at timestamptz,
  dismissed_at timestamptz,
  expired_at timestamptz,
  snoozed_until timestamptz,
  suggested_action text,
  action_href text,
  created_at timestamptz default now(),
  unique (site_id, user_id, dedup_key)
);

create table notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  site_id uuid references sites(id),
  category text,                                   -- domain or null for global
  channel_in_app boolean default true,
  channel_email boolean default false,
  channel_push boolean default false,
  channel_telegram boolean default false,
  frequency_preset text default 'regular' check (frequency_preset in ('calm','regular','power')),
  quiet_hours_enabled boolean default false,
  quiet_hours_start text default '22:00',          -- HH:MM
  quiet_hours_end text default '08:00',            -- HH:MM
  quiet_hours_timezone text default 'America/Sao_Paulo',
  email_consent_at timestamptz,                    -- LGPD consent timestamp
  push_consent_at timestamptz,                     -- LGPD consent timestamp
  updated_at timestamptz default now()
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  endpoint text, p256dh text, auth text,
  created_at timestamptz default now()
);
```

### RLS
- `SELECT`: `can_view_site(site_id)` **e** (`user_id = auth.uid()` ou `user_id is null`).
- `INSERT`: `can_edit_site(site_id)` (criação via service role no backend).
- `UPDATE` (mark read/dismiss): `auth.uid() = user_id`.

### Padrão de criação
`createNotification()` no backend: checa `notification_preferences` do usuário → `supabaseServiceClient.from('notifications').insert(...)`. O INSERT dispara o Realtime. Webhook de DB no INSERT → Edge Function para e-mail (AWS SES, fallback Resend) / push.

### Entrega por prioridade
| Prio | Canais | Timing |
|---|---|---|
| 5 Crítico | in-app + email + push + telegram | imediato |
| 4 Alta | in-app + email | imediato |
| 3 Média | in-app + email opcional | quase-real-time |
| 2 Baixa | in-app | batch 5min |
| 1 Info | in-app digest | batch diário |

### RBAC
Filtrar por papel: **reporter NÃO recebe** notificações cujo `suggested_action` exige edit/publish.

### LGPD
- Alertas de segurança: base legal "execução de contrato" → sempre on, não-desativáveis (toggle travado em Sistema/in-app).
- Operacionais: legítimo interesse → on por padrão, opt-out.
- E-mail/push/marketing: consentimento → off por padrão, opt-in explícito.
- Deleção: Fase 1 anonimiza (null em `user_id`, redige snippets); export `collectUserData()` inclui histórico; header RFC 8058 `List-Unsubscribe` em e-mails. Adicionar adapter de notificações no `lgpd/container.ts` (7º slot).

### Eventos a emitir (60+ no brief)
Pipeline (17), YouTube A/B (9), Command Center (10), Newsletter (5), Áudio/B-roll (6), Research (5), Playlists (5), Social/Links (6). Cada um com prioridade sugerida. Começar pelos 5 de maior valor: stage advance, publish, graduate, VVS block, archive.

---

## 7. Design tokens (valores exatos)

### Tema escuro (default)
```
--bg:#0b0c10  --elev:#101117  --surface:#15161d  --surface-2:#1a1c24
--surface-hover:#1f212b  --border:#24262f  --border-soft:#1c1e26  --border-strong:#333645
--text:#ececf1  --text-muted:#9a9ca8  --text-dim:#686a76  --text-faint:#4a4c57
--accent:#fb7a52  --accent-hover:#ff8e6a  --accent-press:#e9663d  --on-accent:#1a0d07
--accent-soft: rgba(251,122,82,.14)  --accent-soft-2: rgba(251,122,82,.22)
```

### Tema claro
```
--bg:#f4f3f0  --elev:#fff  --surface:#fff  --surface-2:#faf9f6
--border:#e6e4de  --text:#1b1c20  --text-muted:#5e6068  --text-dim:#8b8d96
--accent:#ef6a3d  --accent-press:#d9572c  --on-accent:#fff
```

### Cores de dominio (uso semantico, nunca decorativo)
**Dark theme:**
```
pipeline  #22b8d6 (cyan)     youtube    #ef4444 (red)
newsletter#a855f7 (purple)   social     #f59e0b (amber)
links     #22c55e (green)    system     #f43f5e (rose)
blog      #818cf8 (indigo)   media      #f472b6 (pink)
```
**Light theme (WCAG AA 4.5:1 on light bg):**
```
pipeline  #0e7a8f            youtube    #b91c1c
newsletter#7e22ce            social     #b45309
links     #15803d            system     #be123c
blog      #4338ca            media      #be185d
```
Each has soft fill variant (~12-14% alpha). All switch automatically via CSS custom properties `--color-cms-domain-{name}`.
Semanticos: ok `#22c55e` . warn `#f59e0b` . danger `#f43f5e` (mapped to `text-cms-red` / `--theme-danger`) . info `#22b8d6`.
**Note:** `text-cms-danger` does NOT exist. Use `text-cms-red` for danger states.

### Tipografia
- Familia: **Inter** (configured in `globals.css` and `next/font/google` -- NOT Geist despite prototype imports). Verify 11px meta text and 9px badge text render well with Inter metrics. Adjust by 1px if needed.
- Pesos: 400/500/600/700.
- Escalas-chave: titulo de pagina 18-22px/600; valor de KPI 30px/600 letter-spacing -1px; card-title 14px/600; corpo 13px; meta/dim 11-12px; section-label 11px/600 uppercase letter-spacing 1px.

### Espacamento / chrome
- Raio: Use existing `--radius-xl: 10px` (`rounded-xl`) for card surfaces. Do NOT use 14px from prototype -- `globals.css` defines `--radius-xl: 10px` and all CMS components use it.
- Sombra card: existing `--pb-shadow-card` from globals.css; popover uses `--pb-shadow-popover`.
- Sidebar 250px (colapsa 64px <=1080px); topbar 64px.
- Content padding 28/34px (confortavel), 16/24 (compacto); max-width 1440px (1580px >=1720px).

> **Nota de implementacao importante:** a animacao de entrada de view usa **apenas `transform` (slide), sem `opacity`** -- porque ferramentas de captura por clone de DOM (html-to-image) reiniciam a animacao em `opacity:0` e renderizam a tela em branco. Mantenha esse cuidado se usar screenshots automaticos.

---

## 8. Mapeamento para o design system existente
| Prototipo | Codebase real |
|---|---|
| `Icon` (SVG inline) | `lucide-react` (same icons, proper tree-shaking) |
| `--surface`, `--text`, etc. | tokens Tailwind: `bg-cms-surface`, `text-cms-text`, `text-cms-text-muted`, `text-cms-text-dim`, `border-cms-border`, `text-cms-accent` |
| domain colors (`--c-pipeline` etc.) | `text-cms-domain-pipeline`, `bg-cms-domain-pipeline-subtle` etc. (new tokens in `globals.css @theme inline`) |
| `text-cms-danger` | **Does not exist.** Use `text-cms-red` (maps to `--theme-danger`) |
| `ToastHost` / `pushToast` | `ToastProvider` + `useToast()` from `@tn-figueiredo/cms-ui` -- do NOT use sonner or custom audio-toast |
| Shell (Sidebar+Topbar) | `CmsShell` + `CmsTopbar` (mount bell via `actions` prop). `notification-center.tsx` is **deprecated**. |
| badges da sidebar | `SidebarBadges` (portal existing). Bell badge aligns with SidebarBadges Pill pattern: translucent bg. |
| `--radius: 14px` | Use `rounded-xl` (10px) per existing `--radius-xl`. Do not hardcode. |
| Geist font | **Inter** (production uses Inter, not Geist). See `globals.css` line 44. |
| Zustand store | `useReducer` + `NotificationContext`. No new dependency. |
| `useOptimistic` | Do NOT use alongside Realtime store. Optimistic updates go through reducer. |
| `router.refresh()` / `revalidateTag` | Do NOT use for notifications. Store is source of truth. |
| `Skeleton` / loading | `Skeleton`, `SkeletonBlock` from `@tn-figueiredo/cms-ui/client` |
| Switch toggle | New `<CmsSwitch>` component (reusable, `role="switch"`) |
| Accordion | New `<CmsAccordion>` component (reusable, `aria-expanded`) |

Arquivos-chave do codebase:
- `_shared/notification-center.tsx` -- **DEPRECATED**, replaced by `_shared/notification-bell.tsx`
- `_shared/notification-bell.tsx` -- new NotificationBell (mount via CmsTopbar `actions` prop or CmsShell `topbarActions`)
- `_shared/notification-popover.tsx` -- new NotifPopover (lazy loaded)
- `_shared/bottom-drawer.tsx` -- new reusable BottomDrawer (mobile <640px)
- `_shared/cms-switch.tsx` -- new reusable CmsSwitch (`role="switch"`, keyboard-operable)
- `settings/notifications/page.tsx` -- expand beyond Telegram (full preferences)
- `settings/notifications/_components/lgpd-consent-dialog.tsx` -- new LGPD consent modal
- `lib/notifications/types.ts` -- INotification, store shape, domain types
- `lib/notifications/domain-colors.ts` -- DOMAIN_COLORS, DOMAIN_ICON_MAP
- `lib/notifications/use-notification-channel.ts` -- singleton Realtime hook
- `lib/notifications/use-media-query.ts` -- shared responsive hook
- `lib/notifications/actions.ts` -- Server Actions (user's own Supabase client, NOT service client)
- `lib/youtube/notification-service.ts` -- generalize for `createNotification`
- `lib/social/realtime.ts` -- reference template for Realtime subscription pattern

---

## 9. Assets
- **Fontes**: Prototype uses Geist + Geist Mono. Production uses **Inter** (configured in `globals.css` line 44 and `layout.tsx` via `next/font/google`). Do NOT import Geist.
- **Ícones**: lucide (no protótipo reescritos como SVG inline; no real usar `lucide-react`). Conjunto usado: dashboard, list-checks, calendar, trending-up, file-text, video, graduation-cap, mail, megaphone, list-music, search, book-open, image, headphones, youtube, send, link, external-link, users, user, message-square, settings, bell, plus, check, check-check, x, chevrons, alert-triangle, info, check-circle, clock, zap, flame, sparkles, eye, mouse-pointer-click, arrows, inbox, moon, sun, sliders, filter, trophy, target, gauge, globe, smartphone, dollar-sign, more, pin, archive, refresh, play, flask, edit, grip, rss, layers, party-popper.
- Sem imagens raster; tudo é UI/SVG/tipografia. Avatares e logo "TF" são gradiente CSS.

---

## 10. Arquivos neste bundle (`design_files/`)
- `index.html` — monta tudo (React 18 + Babel; no real, migrar para os componentes do app).
- `styles.css` — tokens, base, shell, primitivas.
- `views.css` — estilos de notificações, formulários, dashboard, analytics, schedule, timeline.
- `components.jsx` — Icon set, Card, Badge, Skel, EmptyState, Sparkline, Ring, DOMAINS, helpers.
- `states.jsx` — skeletons de loading + estados vazios por tela.
- `notifications.jsx` — NotifRow, threading, popover, Inbox, Preferences, toasts.
- `data.js` — dados mockados representativos (trocar por dados reais).
- `views-dashboard.jsx` — Dashboard + Up Next.
- `views-analytics.jsx` — Analytics (7 tabs) + Schedule.
- `shell.jsx` — Sidebar, Topbar, roteamento, Tweaks, App.

Para rodar o protótipo localmente: sirva a pasta `design_files/` com qualquer http server e abra `index.html`.
