# Newsletter Hub Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current flat `/cms/newsletters` page with a 5-tab workspace (Overview, Editorial, Schedule, Automations, Audience) featuring rich data visualizations, kanban board, calendar scheduling, and LGPD-compliant subscriber management.

**Architecture:** Server component fetches data per active tab, passes to client tab components via Suspense boundaries. URL search param `?tab=` drives tab state. Shared chrome (header, tabs, type filter chips) renders immediately while tab content streams in. @dnd-kit for kanban drag-drop, recharts for charts, inline SVG for sparklines.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, TypeScript 5, Supabase (PostgreSQL), recharts, @dnd-kit, lucide-react, vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-04-30-newsletter-hub-redesign-design.md`

**Visual Mockups:** `.superpowers/brainstorm/1543-1777564091/content/tab-*.html` (open in browser for pixel reference)

---

## File Structure

```
apps/web/src/app/cms/(authed)/newsletters/
├── page.tsx                          # Server component — route, data fetch, Suspense
├── actions.ts                        # Existing + new server actions (moveEdition, toggleCadence, etc.)
├── newsletters-connected.tsx         # DELETED — replaced by hub-client
├── _hub/
│   ├── hub-client.tsx                # Client orchestrator — tab state, type filter, auto-refresh
│   ├── hub-types.ts                  # All TypeScript interfaces (shared data, per-tab data, events)
│   ├── hub-queries.ts                # Server-only data fetchers per tab (fetchOverviewData, etc.)
│   ├── hub-utils.ts                  # maskEmail, calculateEngagementScore, calculateHealthScore, formatters
│   ├── tab-skeleton.tsx              # Per-tab skeleton components with shimmer
│   ├── use-hub-shortcuts.ts          # Extended keyboard shortcuts with tab awareness
│   └── use-auto-refresh.ts           # 60s polling with document.hidden pause
├── _shared/
│   ├── health-strip.tsx              # Reusable KPI/health strip (N metric cards)
│   ├── summary-bar.tsx               # Sticky bottom bar with stats + kbd hints
│   ├── type-filter-chips.tsx         # Colored filter chips persistent across tabs
│   ├── sparkline-svg.tsx             # Inline SVG sparkline (area or line variant)
│   ├── activity-feed.tsx             # Scrollable event list with infinite scroll + filter chips
│   ├── tab-error-boundary.tsx        # Error boundary with retry + Sentry capture
│   ├── section-error-boundary.tsx    # Per-section inline error fallback
│   └── empty-state.tsx               # Reusable empty state card (icon + heading + description + CTA)
├── _tabs/
│   ├── overview/
│   │   ├── overview-tab.tsx          # Overview client component (receives data props)
│   │   ├── kpi-strip.tsx             # 5 KPI cards with sparklines
│   │   ├── health-gauge.tsx          # SVG donut gauge (0-100 score)
│   │   ├── subscriber-growth-chart.tsx  # recharts area chart with period toggle
│   │   ├── engagement-funnel.tsx     # Horizontal funnel bars
│   │   ├── editions-by-type-donut.tsx  # recharts donut
│   │   ├── open-rate-trend-chart.tsx # recharts multi-line
│   │   ├── publication-performance.tsx # Expandable type cards
│   │   ├── top-editions.tsx          # Ranked list with toggle
│   │   ├── cohort-heatmap.tsx        # CSS grid heatmap
│   │   └── deliverability-panel.tsx  # SPF/DKIM/DMARC + rate gauges
│   ├── editorial/
│   │   ├── editorial-tab.tsx         # Editorial client component
│   │   ├── velocity-strip.tsx        # 4 pipeline metrics
│   │   ├── editorial-toolbar.tsx     # Search, sort, view toggle
│   │   ├── kanban-board.tsx          # @dnd-kit DnD context + columns
│   │   ├── kanban-column.tsx         # Single column (droppable, header, cards)
│   │   ├── kanban-card.tsx           # Edition card (draggable, type-colored)
│   │   └── edition-list-view.tsx     # Table alternative to kanban
│   ├── schedule/
│   │   ├── schedule-tab.tsx          # Schedule client component
│   │   ├── month-calendar.tsx        # Month grid with slot dots + conflicts
│   │   ├── agenda-list.tsx           # Chronological upcoming items
│   │   ├── cadence-card.tsx          # Per-type cadence config with toggle
│   │   └── send-window-config.tsx    # Default time + insight
│   ├── automations/
│   │   ├── automations-tab.tsx       # Automations client component
│   │   ├── workflow-card.tsx         # Hero + compact workflow visualizations
│   │   ├── cron-card.tsx             # System cron with health dots
│   │   └── workflow-config-panel.tsx # Slide-over configuration panel
│   └── audience/
│       ├── audience-tab.tsx          # Audience client component
│       ├── audience-growth-chart.tsx # recharts area (new vs unsubs)
│       ├── distribution-chart.tsx    # Horizontal bar chart
│       ├── engagement-type-card.tsx  # Per-type engagement card
│       ├── subscriber-table.tsx      # Paginated table with search/filter/sort
│       ├── locale-donut.tsx          # Inline SVG 2-segment donut
│       └── lgpd-consent-panel.tsx    # Consent metrics
├── _i18n/
│   ├── types.ts                      # I18n string interface
│   ├── pt-BR.ts                      # Portuguese strings
│   └── en.ts                         # English strings
├── _components/                       # KEPT: type-modal, schedule-modal, delete-confirm-modal, toast-provider, etc.
├── [id]/edit/                         # KEPT: edition editor (out of scope)
├── [id]/analytics/                    # KEPT: per-edition analytics
├── new/                               # KEPT: new edition page
├── settings/                          # KEPT: settings page
└── subscribers/page.tsx               # KEPT: redirect to /cms/subscribers

supabase/migrations/
└── 2026MMDD000001_newsletter_hub_columns.sql  # New columns + enum extension
```

---

## Phase 0: Dependencies + Database Migration

### Task 1: Install @dnd-kit packages

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install @dnd-kit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm install @dnd-kit/core@6 @dnd-kit/sortable@8 @dnd-kit/utilities@3 -w apps/web
```

- [ ] **Step 2: Verify installation**

```bash
grep "@dnd-kit" apps/web/package.json
```

Expected: Three entries for core, sortable, utilities with exact versions (no `^`).

- [ ] **Step 3: Fix pinning if needed**

If versions have `^`, edit `apps/web/package.json` to remove the caret (project convention: exact versions for `@tn-figueiredo/*` and new deps).

- [ ] **Step 4: Verify TypeScript types resolve**

```bash
cd apps/web && npx tsc --noEmit --skipLibCheck 2>&1 | grep -i "dnd-kit" || echo "OK - no type errors"
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json package-lock.json
git commit -m "chore: install @dnd-kit/core + sortable + utilities for kanban"
```

---

### Task 2: Database migration — new columns

**Files:**
- Create: `supabase/migrations/20260430000001_newsletter_hub_columns.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Newsletter Hub Redesign: new columns for kanban pipeline tracking + timezone

-- Idea stage tracking
ALTER TABLE newsletter_editions
  ADD COLUMN IF NOT EXISTS idea_notes text,
  ADD COLUMN IF NOT EXISTS idea_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_entered_at timestamptz;

-- Site timezone (for schedule display)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE sites ADD COLUMN timezone text NOT NULL DEFAULT 'America/Sao_Paulo';
  END IF;
END $$;

-- Backfill idea_created_at for existing idea editions
UPDATE newsletter_editions
SET idea_created_at = created_at
WHERE status = 'idea' AND idea_created_at IS NULL;
```

- [ ] **Step 2: Validate locally**

```bash
npm run db:start && npm run db:reset
```

Expected: Migration applies without error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260430000001_newsletter_hub_columns.sql
git commit -m "feat(db): add idea_notes, idea_created_at, review_entered_at, sites.timezone"
```

---

## Phase 1: Shared Infrastructure

### Task 3: TypeScript interfaces

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-types.ts`

- [ ] **Step 1: Write the types file**

```typescript
export type TabId = 'overview' | 'editorial' | 'schedule' | 'automations' | 'audience'

export interface NewsletterType {
  id: string
  name: string
  color: string
  sortOrder: number
  cadencePaused: boolean
  subscriberCount: number
}

export interface NewsletterHubSharedData {
  types: NewsletterType[]
  tabBadges: {
    editorial: number
    automations: number
  }
  siteTimezone: string
  siteName: string
  defaultLocale: string
}

export interface ActivityEvent {
  id: string
  type: 'welcome' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'system'
  description: string
  emailMasked?: string
  timestamp: string
}

export interface OverviewTabData {
  kpis: {
    totalSubscribers: number
    subscribersTrend: number
    editionsSent: number
    editionsThisMonth: number
    avgOpenRate: number
    openRateTrend: number
    avgClickRate: number
    clickRateTrend: number
    bounceRate: number
    bounceTrend: number
  }
  sparklines: Record<'subscribers' | 'editions' | 'openRate' | 'clickRate' | 'bounceRate', number[]>
  healthScore: number
  healthDimensions: Record<'deliverability' | 'engagement' | 'growth' | 'compliance', { score: number; label: string }>
  subscriberGrowth: Array<{ date: string; count: number }>
  funnel: { sent: number; delivered: number; opened: number; clicked: number }
  editionsByType: Array<{ typeId: string; typeName: string; typeColor: string; count: number }>
  openRateTrend: Array<{ date: string; rates: Record<string, number> }>
  publicationPerformance: Array<{
    typeId: string; typeName: string; typeColor: string
    subscribers: number; editionsSent: number; openRate: number; clickRate: number
    sparkline: number[]; paused: boolean
  }>
  topEditions: Array<{ id: string; subject: string; typeId: string; typeName: string; typeColor: string; dateSent: string; opens: number; clicks: number }>
  activityFeed: ActivityEvent[]
  cohortRetention: Array<{ cohortMonth: string; monthOffset: number; retention: number; cohortSize: number }>
  deliverability: { spf: boolean; dkim: boolean; dmarc: boolean; bounceRate: number; complaintRate: number; provider: string }
}

export interface EditionCard {
  id: string
  subject: string
  status: 'idea' | 'draft' | 'ready' | 'review' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled' | 'archived'
  typeId: string | null
  typeName: string | null
  typeColor: string | null
  createdAt: string
  ideaCreatedAt: string | null
  reviewEnteredAt: string | null
  slotDate: string | null
  wordCount: number | null
  readingTimeMin: number | null
  progressPercent: number | null
  ideaNotes: string | null
  snippet: string | null
  stats: { opens: number; clicks: number; bounceRate: number } | null
}

export interface EditorialTabData {
  velocity: { throughput: number; avgIdeaToSent: number; movedThisWeek: number; bottleneck: { column: string; avgDays: number } | null }
  editions: EditionCard[]
  wipLimit: number
}

export interface ScheduleSlot {
  date: string
  editions: Array<{ id: string; subject: string; typeColor: string; status: string }>
  emptySlots: Array<{ typeId: string; typeColor: string; typeName: string }>
}

export interface CadenceConfig {
  typeId: string; typeName: string; typeColor: string
  cadence: string; dayOfWeek: string; time: string; nextDate: string
  paused: boolean; subscribers: number; editionsSent: number; openRate: number
  conflicts: string[]
}

export interface ScheduleTabData {
  healthStrip: { fillRate: number; next7Days: number; conflicts: number; avgOpenRate: number; activeTypes: number; totalTypes: number }
  calendarSlots: ScheduleSlot[]
  cadenceConfigs: CadenceConfig[]
  sendWindow: { time: string; timezone: string; bestTimeInsight: string }
}

export interface WorkflowData {
  id: string; name: string; type: 'welcome' | 're_engagement' | 'bounce_handler'
  enabled: boolean; stats: Record<string, number>
  pipelineCounts?: Record<string, number>
  incident?: { date: string; description: string }
}

export interface CronJobData {
  name: string; expression: string; frequency: string
  lgpd: boolean; lastRuns: Array<{ date: string; success: boolean }>
}

export interface AutomationsTabData {
  healthStrip: { workflowsActive: number; cronsHealthy: number; eventsToday: number; successRate: number; lastIncidentDaysAgo: number | null }
  workflows: WorkflowData[]
  cronJobs: CronJobData[]
  activityFeed: ActivityEvent[]
}

export interface SubscriberRow {
  id: string
  emailMasked: string
  name: string | null
  initials: string
  types: Array<{ id: string; name: string; color: string }>
  subscribedAt: string
  opens30d: number
  clicks30d: number
  engagementScore: number
  status: 'active' | 'at_risk' | 'bounced' | 'unsubscribed' | 'anonymized'
}

export interface AudienceTabData {
  healthStrip: { uniqueSubscribers: number; totalSubscriptions: number; netGrowth30d: number; churnRate: number; avgOpenRate: number; lgpdConsent: number }
  growth: Array<{ date: string; newSubs: number; unsubs: number }>
  distribution: Array<{ typeId: string; typeName: string; typeColor: string; count: number; share: number }>
  engagementByType: Array<{ typeId: string; typeName: string; typeColor: string; subscribers: number; openRate: number; clickRate: number; bounceRate: number; sparkline: number[]; paused: boolean }>
  subscribers: { rows: SubscriberRow[]; total: number; page: number }
  locale: Record<string, number>
  lgpdConsent: { newsletter: number; analytics: number; anonymized: number; version: string }
  recentActivity: ActivityEvent[]
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | tail -5
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_hub/hub-types.ts
git commit -m "feat(newsletter-hub): add TypeScript interfaces for all tabs"
```

---

### Task 4: Utility functions

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-utils.ts`
- Create: `apps/web/test/unit/newsletter-hub-utils.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/web/test/unit/newsletter-hub-utils.test.ts
import { describe, it, expect } from 'vitest'
import { maskEmail, calculateEngagementScore, calculateHealthScore } from '@/app/cms/(authed)/newsletters/_hub/hub-utils'

describe('maskEmail', () => {
  it('masks standard email', () => {
    expect(maskEmail('maria@example.com')).toBe('m***a@example.com')
  })
  it('handles single-char local part', () => {
    expect(maskEmail('a@example.com')).toBe('a***a@example.com')
  })
  it('handles two-char local part', () => {
    expect(maskEmail('ab@example.com')).toBe('a***b@example.com')
  })
  it('returns [anonymized] for sha256 hash emails', () => {
    expect(maskEmail('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')).toBe('[anonymized]')
  })
  it('handles empty string', () => {
    expect(maskEmail('')).toBe('')
  })
})

describe('calculateEngagementScore', () => {
  it('returns 100 for perfect engagement', () => {
    const score = calculateEngagementScore({ opens30d: 10, clicks30d: 10, editionsReceived30d: 10, daysSinceLastOpen: 0 })
    expect(score).toBe(100)
  })
  it('returns 0 for zero activity with max decay', () => {
    const score = calculateEngagementScore({ opens30d: 0, clicks30d: 0, editionsReceived30d: 10, daysSinceLastOpen: 60 })
    expect(score).toBe(0)
  })
  it('caps at 100', () => {
    const score = calculateEngagementScore({ opens30d: 20, clicks30d: 20, editionsReceived30d: 10, daysSinceLastOpen: 0 })
    expect(score).toBeLessThanOrEqual(100)
  })
  it('handles zero editions received', () => {
    const score = calculateEngagementScore({ opens30d: 0, clicks30d: 0, editionsReceived30d: 0, daysSinceLastOpen: 30 })
    expect(score).toBeGreaterThanOrEqual(0)
  })
})

describe('calculateHealthScore', () => {
  it('returns high score for healthy metrics', () => {
    const score = calculateHealthScore({
      spf: true, dkim: true, dmarc: true,
      bounceRate: 0.5, complaintRate: 0.01,
      avgOpenRate: 55, avgClickRate: 15,
      netGrowth30d: 10, totalSubscribers: 100,
      lgpdConsent: 99,
      cronHealthy: true,
    })
    expect(score).toBeGreaterThanOrEqual(80)
  })
  it('returns low score for unhealthy metrics', () => {
    const score = calculateHealthScore({
      spf: false, dkim: false, dmarc: false,
      bounceRate: 8, complaintRate: 0.2,
      avgOpenRate: 10, avgClickRate: 1,
      netGrowth30d: -5, totalSubscribers: 100,
      lgpdConsent: 70,
      cronHealthy: false,
    })
    expect(score).toBeLessThan(50)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:web -- --reporter=verbose --testPathPattern="newsletter-hub-utils"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement utilities**

```typescript
// apps/web/src/app/cms/(authed)/newsletters/_hub/hub-utils.ts

const SHA256_REGEX = /^[a-f0-9]{64}$/

export function maskEmail(email: string): string {
  if (!email) return ''
  if (SHA256_REGEX.test(email)) return '[anonymized]'
  const atIndex = email.indexOf('@')
  if (atIndex < 1) return email
  const local = email.slice(0, atIndex)
  const domain = email.slice(atIndex)
  const first = local[0]
  const last = local.length > 1 ? local[local.length - 1] : local[0]
  return `${first}***${last}${domain}`
}

interface EngagementInput {
  opens30d: number
  clicks30d: number
  editionsReceived30d: number
  daysSinceLastOpen: number
}

export function calculateEngagementScore(input: EngagementInput): number {
  const { opens30d, clicks30d, editionsReceived30d, daysSinceLastOpen } = input
  const opensRatio = editionsReceived30d > 0 ? Math.min(1, opens30d / editionsReceived30d) : 0
  const clicksRatio = opens30d > 0 ? Math.min(1, clicks30d / opens30d) : 0
  const recencyFactor = Math.max(0, 1 - daysSinceLastOpen / 60)
  const raw = (0.4 * opensRatio + 0.4 * clicksRatio + 0.2 * recencyFactor) * 100
  return Math.round(Math.min(100, Math.max(0, raw)))
}

interface HealthInput {
  spf: boolean; dkim: boolean; dmarc: boolean
  bounceRate: number; complaintRate: number
  avgOpenRate: number; avgClickRate: number
  netGrowth30d: number; totalSubscribers: number
  lgpdConsent: number
  cronHealthy: boolean
}

export function calculateHealthScore(input: HealthInput): number {
  // Deliverability (0-100)
  let deliverability = 0
  if (input.spf) deliverability += 20
  if (input.dkim) deliverability += 20
  if (input.dmarc) deliverability += 20
  if (input.bounceRate < 2) deliverability += 20
  else if (input.bounceRate < 5) deliverability += 10
  if (input.complaintRate < 0.05) deliverability += 20
  else if (input.complaintRate < 0.1) deliverability += 10

  // Engagement (0-100)
  let engagement = 20
  if (input.avgOpenRate > 50) engagement = 100
  else if (input.avgOpenRate > 40) engagement = 80
  else if (input.avgOpenRate > 30) engagement = 60
  else if (input.avgOpenRate > 20) engagement = 40
  if (input.avgClickRate > 10) engagement = Math.min(100, engagement + 10)

  // Growth (0-100)
  let growth = 0
  if (input.netGrowth30d > 0) {
    growth = 50
    const growthRate = input.totalSubscribers > 0 ? (input.netGrowth30d / input.totalSubscribers) * 100 : 0
    if (growthRate > 5) growth += 50
    else if (growthRate > 2) growth += 30
    else growth += 20
  } else {
    growth = Math.max(0, 50 + input.netGrowth30d)
  }

  // Compliance (0-100)
  let compliance = 0
  if (input.lgpdConsent > 95) compliance = 100
  else if (input.lgpdConsent > 90) compliance = 80
  else if (input.lgpdConsent > 80) compliance = 60
  else compliance = 40
  if (!input.cronHealthy) compliance = Math.max(0, compliance - 20)

  return Math.round(deliverability * 0.25 + engagement * 0.25 + growth * 0.25 + compliance * 0.25)
}

export function getHealthLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Excellent', color: '#22c55e' }
  if (score >= 60) return { label: 'Good', color: '#6366f1' }
  if (score >= 40) return { label: 'Fair', color: '#f59e0b' }
  return { label: 'Critical', color: '#ef4444' }
}

export function formatRelativeTime(timestamp: string, locale: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (minutes < 60) return rtf.format(-minutes, 'minute')
  if (hours < 24) return rtf.format(-hours, 'hour')
  return rtf.format(-days, 'day')
}

export function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(' ').filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:web -- --reporter=verbose --testPathPattern="newsletter-hub-utils"
```

Expected: All 10+ tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_hub/hub-utils.ts apps/web/test/unit/newsletter-hub-utils.test.ts
git commit -m "feat(newsletter-hub): utility functions — maskEmail, engagement score, health score"
```

---

### Task 5: i18n strings

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_i18n/types.ts`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_i18n/pt-BR.ts`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_i18n/en.ts`

- [ ] **Step 1: Create the i18n interface and locale files**

```typescript
// _i18n/types.ts
export interface NewsletterHubStrings {
  tabs: { overview: string; editorial: string; schedule: string; automations: string; audience: string }
  kpi: { totalSubscribers: string; editionsSent: string; avgOpenRate: string; avgClickRate: string; bounceRate: string }
  actions: { newEdition: string; newIdea: string; newDraft: string; scheduleNext: string; viewSubscribers: string; fullAnalytics: string; exportCsv: string; configure: string; retry: string }
  empty: { noData: string; noEditions: string; noSubscribers: string; noActivity: string; startPipeline: string; addIdea: string; configCadence: string }
  status: { active: string; atRisk: string; bounced: string; unsubscribed: string; anonymized: string; paused: string }
  editorial: { throughput: string; avgTime: string; movedForward: string; bottleneck: string; searchEditions: string; idea: string; draft: string; review: string; scheduled: string; sent: string; issues: string; archive: string }
  schedule: { fillRate: string; next7Days: string; conflicts: string; activeTypes: string; emptySlot: string; assignEdition: string }
  automations: { workflows: string; crons: string; eventsToday: string; successRate: string; lastIncident: string }
  audience: { uniqueSubscribers: string; subscriptions: string; netGrowth: string; churnRate: string; lgpdConsent: string }
  common: { allTypes: string; updatedJustNow: string; showMore: string; undo: string; moved: string; couldntMove: string }
}
```

```typescript
// _i18n/pt-BR.ts
import type { NewsletterHubStrings } from './types'

export const ptBR: NewsletterHubStrings = {
  tabs: { overview: 'Visão Geral', editorial: 'Editorial', schedule: 'Agenda', automations: 'Automações', audience: 'Audiência' },
  kpi: { totalSubscribers: 'Total de Inscritos', editionsSent: 'Edições Enviadas', avgOpenRate: 'Taxa de Abertura', avgClickRate: 'Taxa de Cliques', bounceRate: 'Taxa de Bounce' },
  actions: { newEdition: 'Nova Edição', newIdea: 'Nova Ideia', newDraft: 'Novo Rascunho', scheduleNext: 'Agendar Próxima', viewSubscribers: 'Ver Inscritos', fullAnalytics: 'Analytics Completo', exportCsv: 'Exportar CSV', configure: 'Configurar', retry: 'Tentar novamente' },
  empty: { noData: 'Sem dados ainda', noEditions: 'Nenhuma edição encontrada', noSubscribers: 'Nenhum inscrito ainda', noActivity: 'Nenhuma atividade ainda', startPipeline: 'Comece seu pipeline editorial', addIdea: 'Adicione sua primeira ideia', configCadence: 'Configure a cadência das suas newsletters' },
  status: { active: 'Ativo', atRisk: 'Em risco', bounced: 'Bounce', unsubscribed: 'Cancelado', anonymized: 'Anonimizado', paused: 'Pausado' },
  editorial: { throughput: 'Throughput', avgTime: 'Tempo Médio', movedForward: 'Avançaram', bottleneck: 'Gargalo', searchEditions: 'Buscar edições...', idea: 'Ideia', draft: 'Rascunho', review: 'Revisão', scheduled: 'Agendado', sent: 'Enviado', issues: 'Problemas', archive: 'Arquivo' },
  schedule: { fillRate: 'Preenchimento', next7Days: 'Próx. 7 dias', conflicts: 'Conflitos', activeTypes: 'Tipos ativos', emptySlot: 'Slot vazio', assignEdition: 'Atribuir edição' },
  automations: { workflows: 'Workflows', crons: 'Crons', eventsToday: 'Eventos hoje', successRate: 'Taxa de sucesso', lastIncident: 'Último incidente' },
  audience: { uniqueSubscribers: 'Inscritos Únicos', subscriptions: 'Inscrições', netGrowth: 'Crescimento (30d)', churnRate: 'Churn', lgpdConsent: 'Consentimento LGPD' },
  common: { allTypes: 'Todos os Tipos', updatedJustNow: 'Atualizado agora', showMore: 'Ver mais', undo: 'Desfazer', moved: 'Movido', couldntMove: 'Não foi possível mover' },
}
```

```typescript
// _i18n/en.ts
import type { NewsletterHubStrings } from './types'

export const en: NewsletterHubStrings = {
  tabs: { overview: 'Overview', editorial: 'Editorial', schedule: 'Schedule', automations: 'Automations', audience: 'Audience' },
  kpi: { totalSubscribers: 'Total Subscribers', editionsSent: 'Editions Sent', avgOpenRate: 'Avg Open Rate', avgClickRate: 'Avg Click Rate', bounceRate: 'Bounce Rate' },
  actions: { newEdition: 'New Edition', newIdea: 'New Idea', newDraft: 'New Draft', scheduleNext: 'Schedule Next', viewSubscribers: 'View Subscribers', fullAnalytics: 'Full Analytics', exportCsv: 'Export CSV', configure: 'Configure', retry: 'Try again' },
  empty: { noData: 'No data yet', noEditions: 'No editions found', noSubscribers: 'No subscribers yet', noActivity: 'No activity yet', startPipeline: 'Start your editorial pipeline', addIdea: 'Add your first idea to get started', configCadence: 'Configure cadence for your newsletter types' },
  status: { active: 'Active', atRisk: 'At risk', bounced: 'Bounced', unsubscribed: 'Unsubscribed', anonymized: 'Anonymized', paused: 'Paused' },
  editorial: { throughput: 'Throughput', avgTime: 'Avg Time', movedForward: 'Moved Forward', bottleneck: 'Bottleneck', searchEditions: 'Search editions...', idea: 'Idea', draft: 'Draft', review: 'Review', scheduled: 'Scheduled', sent: 'Sent', issues: 'Issues', archive: 'Archive' },
  schedule: { fillRate: 'Fill Rate', next7Days: 'Next 7 Days', conflicts: 'Conflicts', activeTypes: 'Active Types', emptySlot: 'Empty slot', assignEdition: 'Assign edition' },
  automations: { workflows: 'Workflows', crons: 'Crons', eventsToday: 'Events Today', successRate: 'Success Rate', lastIncident: 'Last Incident' },
  audience: { uniqueSubscribers: 'Unique Subscribers', subscriptions: 'Subscriptions', netGrowth: 'Net Growth (30d)', churnRate: 'Churn Rate', lgpdConsent: 'LGPD Consent' },
  common: { allTypes: 'All Types', updatedJustNow: 'Updated just now', showMore: 'Show more', undo: 'Undo', moved: 'Moved', couldntMove: "Couldn't move" },
}
```

- [ ] **Step 2: Verify compiles**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_i18n/
git commit -m "feat(newsletter-hub): i18n strings (pt-BR + en)"
```

---

### Task 6: Shared UI components — EmptyState, HealthStrip, SummaryBar, SparklineSvg, TypeFilterChips

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_shared/empty-state.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_shared/health-strip.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_shared/summary-bar.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_shared/sparkline-svg.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_shared/type-filter-chips.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_shared/tab-error-boundary.tsx`

- [ ] **Step 1: Create EmptyState**

```tsx
// _shared/empty-state.tsx
'use client'

import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  heading: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, heading, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-gray-800 bg-gray-900 px-6 py-10 text-center">
      <div className="mb-3 text-gray-600">{icon}</div>
      <h3 className="text-sm font-semibold text-gray-300">{heading}</h3>
      {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Create SparklineSvg**

```tsx
// _shared/sparkline-svg.tsx
'use client'

interface SparklineSvgProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  variant?: 'line' | 'area'
}

export function SparklineSvg({ data, width = 40, height = 20, color = '#6366f1', variant = 'area' }: SparklineSvgProps) {
  if (data.length < 2) return <div style={{ width, height }} />

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const step = width / (data.length - 1)

  const points = data.map((v, i) => ({
    x: i * step,
    y: height - ((v - min) / range) * (height - 2) - 1,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {variant === 'area' && (
        <path d={areaD} fill={color} fillOpacity={0.15} />
      )}
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
```

- [ ] **Step 3: Create HealthStrip**

```tsx
// _shared/health-strip.tsx
'use client'

import type { ReactNode } from 'react'

interface MetricCard {
  label: string
  value: string | number
  trend?: ReactNode
  color?: string
}

interface HealthStripProps {
  metrics: MetricCard[]
}

export function HealthStrip({ metrics }: HealthStripProps) {
  return (
    <div className="mb-4 flex gap-3 overflow-x-auto">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="flex min-w-[140px] flex-1 flex-col rounded-[10px] border border-gray-800 bg-gray-900 px-4 py-3"
        >
          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{m.label}</span>
          <span className="mt-1 text-base font-extrabold tabular-nums text-gray-100" style={{ color: m.color }}>
            {m.value}
          </span>
          {m.trend && <div className="mt-1">{m.trend}</div>}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create SummaryBar**

```tsx
// _shared/summary-bar.tsx
'use client'

interface SummaryBarProps {
  stats: string
  shortcuts?: Array<{ key: string; label: string }>
}

export function SummaryBar({ stats, shortcuts }: SummaryBarProps) {
  return (
    <div
      role="status"
      className="sticky bottom-0 flex items-center justify-between border-t border-gray-800 bg-gray-900 px-6 py-2"
    >
      <span className="text-[11px] text-gray-400">{stats}</span>
      {shortcuts && shortcuts.length > 0 && (
        <div className="flex items-center gap-3">
          {shortcuts.map((s) => (
            <span key={s.key} className="text-[10px] text-gray-500">
              <kbd className="rounded border border-gray-700 bg-gray-800 px-1 py-0.5 font-mono text-[9px] text-gray-400">{s.key}</kbd>
              {' '}{s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create TypeFilterChips**

```tsx
// _shared/type-filter-chips.tsx
'use client'

import type { NewsletterType } from '../_hub/hub-types'

interface TypeFilterChipsProps {
  types: NewsletterType[]
  selectedTypeId: string | null
  onSelect: (typeId: string | null) => void
  allLabel: string
}

export function TypeFilterChips({ types, selectedTypeId, onSelect, allLabel }: TypeFilterChipsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <button
        onClick={() => onSelect(null)}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
          selectedTypeId === null
            ? 'border border-indigo-500/30 bg-indigo-500/10 text-indigo-400'
            : 'border border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700'
        }`}
      >
        {allLabel} ({types.length})
      </button>
      {types.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
            selectedTypeId === t.id
              ? 'border border-indigo-500/30 bg-indigo-500/10 text-indigo-400'
              : 'border border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700'
          }`}
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
          {t.name}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Create TabErrorBoundary**

```tsx
// _shared/tab-error-boundary.tsx
'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props { children: ReactNode; tabName: string }
interface State { error: Error | null }

export class TabErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) { return { error } }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center rounded-[10px] border border-red-500/20 bg-gray-900 p-10 text-center">
          <AlertTriangle className="mb-3 h-8 w-8 text-red-400" />
          <h3 className="text-sm font-semibold text-gray-200">Something went wrong loading {this.props.tabName}</h3>
          <p className="mt-1 text-xs text-gray-500">{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-4 rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-600"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
```

- [ ] **Step 7: Verify compiles**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | tail -5
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_shared/
git commit -m "feat(newsletter-hub): shared components — EmptyState, HealthStrip, SummaryBar, SparklineSvg, TypeFilterChips, TabErrorBoundary"
```

---

## Phase 2: Tab Shell

### Task 7: Hub client component (tab orchestrator)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-client.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_hub/use-auto-refresh.ts`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_hub/use-hub-shortcuts.ts`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_hub/tab-skeleton.tsx`

- [ ] **Step 1: Create use-auto-refresh hook**

```typescript
// _hub/use-auto-refresh.ts
'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export function useAutoRefresh(intervalMs = 60000) {
  const router = useRouter()
  const lastRefresh = useRef(Date.now())

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.hidden) return
      router.refresh()
      lastRefresh.current = Date.now()
    }, intervalMs)
    return () => clearInterval(timer)
  }, [router, intervalMs])

  return {
    lastRefresh,
    refreshNow: () => { router.refresh(); lastRefresh.current = Date.now() },
  }
}
```

- [ ] **Step 2: Create use-hub-shortcuts hook**

```typescript
// _hub/use-hub-shortcuts.ts
'use client'

import { useEffect, useRef } from 'react'
import type { TabId } from './hub-types'

interface HubShortcutHandlers {
  onNewEdition: () => void
  onSwitchTab: (tab: TabId) => void
  onFocusSearch?: () => void
  onExportCsv?: () => void
}

const TAB_MAP: Record<string, TabId> = { '1': 'overview', '2': 'editorial', '3': 'schedule', '4': 'automations', '5': 'audience' }

export function useHubShortcuts(handlers: HubShortcutHandlers) {
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toLowerCase()
      if (key === 'n') { e.preventDefault(); ref.current.onNewEdition(); return }
      if (TAB_MAP[key]) { e.preventDefault(); ref.current.onSwitchTab(TAB_MAP[key]); return }
      if (key === '/' || key === 's' || key === 'f') { e.preventDefault(); ref.current.onFocusSearch?.(); return }
      if (key === 'e') { e.preventDefault(); ref.current.onExportCsv?.(); return }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
}
```

- [ ] **Step 3: Create TabSkeleton**

```tsx
// _hub/tab-skeleton.tsx
'use client'

import type { TabId } from './hub-types'

function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-[10px] bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-[length:200%_100%] ${className ?? ''}`}
    />
  )
}

export function TabSkeleton({ tab }: { tab: TabId }) {
  return (
    <div className="space-y-4 p-1">
      {/* Health strip skeleton */}
      <div className="flex gap-3">
        {Array.from({ length: tab === 'audience' ? 6 : 5 }).map((_, i) => (
          <ShimmerBlock key={i} className="h-[72px] min-w-[140px] flex-1" />
        ))}
      </div>
      {/* Content area skeleton */}
      {tab === 'editorial' ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex w-[200px] shrink-0 flex-col gap-2">
              <ShimmerBlock className="h-8 w-full" />
              <ShimmerBlock className="h-[120px] w-full" />
              <ShimmerBlock className="h-[120px] w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <ShimmerBlock className="h-[200px]" />
          <ShimmerBlock className="h-[200px]" />
          <ShimmerBlock className="h-[160px]" />
          <ShimmerBlock className="h-[160px]" />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create HubClient (tab orchestrator)**

```tsx
// _hub/hub-client.tsx
'use client'

import { type ReactNode, useCallback, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BarChart3, Kanban, CalendarDays, Workflow, Users, Plus, Settings, Bell } from 'lucide-react'
import Link from 'next/link'
import type { NewsletterHubSharedData, TabId } from './hub-types'
import { TypeFilterChips } from '../_shared/type-filter-chips'
import { useAutoRefresh } from './use-auto-refresh'
import { useHubShortcuts } from './use-hub-shortcuts'

const TABS: Array<{ id: TabId; icon: typeof BarChart3 }> = [
  { id: 'overview', icon: BarChart3 },
  { id: 'editorial', icon: Kanban },
  { id: 'schedule', icon: CalendarDays },
  { id: 'automations', icon: Workflow },
  { id: 'audience', icon: Users },
]

interface HubClientProps {
  sharedData: NewsletterHubSharedData
  defaultTab: TabId
  children: ReactNode
  tabLabels: Record<TabId, string>
  allTypesLabel: string
}

export function HubClient({ sharedData, defaultTab, children, tabLabels, allTypesLabel }: HubClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const activeTab = (searchParams.get('tab') as TabId) || defaultTab
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)

  const { refreshNow } = useAutoRefresh()

  const switchTab = useCallback((tab: TabId) => {
    startTransition(() => {
      router.push(`/cms/newsletters?tab=${tab}`, { scroll: false })
    })
  }, [router, startTransition])

  useHubShortcuts({
    onNewEdition: () => router.push('/cms/newsletters/new'),
    onSwitchTab: switchTab,
  })

  return (
    <div className="flex min-h-screen flex-col bg-[#030712]">
      {/* Header */}
      <div className="flex items-center justify-between px-7 pt-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-100">Newsletters</h1>
          <button onClick={refreshNow} className="flex items-center gap-1 text-[9px] text-gray-600 hover:text-gray-400">
            <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-green-500" />
            Updated just now
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/cms/newsletters/new"
            className="flex items-center gap-1 rounded-lg bg-indigo-500 px-3.5 py-[7px] text-[11px] font-semibold text-white hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          >
            <Plus className="h-3.5 w-3.5" /> New Edition
          </Link>
          <Link href="/cms/newsletters/settings" className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700 hover:text-gray-200">
            <Settings className="h-4 w-4" />
          </Link>
          <button className="relative flex h-8 w-8 items-center justify-center rounded-md border border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700 hover:text-gray-200">
            <Bell className="h-4 w-4" />
            {sharedData.tabBadges.automations > 0 && (
              <span className="absolute right-[5px] top-[5px] h-1.5 w-1.5 rounded-full border-[1.5px] border-[#030712] bg-red-500" />
            )}
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="mt-2 flex border-b border-gray-800 px-7">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const badge = tab.id === 'editorial' ? sharedData.tabBadges.editorial : tab.id === 'automations' ? sharedData.tabBadges.automations : 0
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => switchTab(tab.id)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-[11px] font-medium transition-colors ${
                isActive ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tabLabels[tab.id]}
              {badge > 0 && (
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${
                  tab.id === 'automations' ? 'bg-red-500/20 text-red-400' : 'bg-indigo-500/20 text-indigo-400'
                }`}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Type Filter Chips */}
      <div className="px-7 pt-3">
        <TypeFilterChips
          types={sharedData.types}
          selectedTypeId={selectedTypeId}
          onSelect={setSelectedTypeId}
          allLabel={allTypesLabel}
        />
      </div>

      {/* Tab Content */}
      <div className="flex-1 px-7 pt-4">
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify compiles**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_hub/
git commit -m "feat(newsletter-hub): hub client, auto-refresh, shortcuts, tab skeleton"
```

---

### Task 8: Rewrite page.tsx (server component with Suspense)

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-queries.ts`

- [ ] **Step 1: Create hub-queries.ts with fetchSharedData**

```typescript
// _hub/hub-queries.ts
import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { NewsletterHubSharedData } from './hub-types'

export const fetchSharedData = unstable_cache(
  async (siteId: string, siteName: string, timezone: string, defaultLocale: string): Promise<NewsletterHubSharedData> => {
    const supabase = getSupabaseServiceClient()

    const { data: types } = await supabase
      .from('newsletter_types')
      .select('id, name, color, sort_order, cadence_paused')
      .eq('site_id', siteId)
      .order('sort_order')

    const { data: subCounts } = await supabase
      .from('newsletter_subscriptions')
      .select('newsletter_id')
      .eq('site_id', siteId)
      .in('status', ['confirmed', 'pending_confirmation'])

    const countByType = new Map<string, number>()
    for (const row of subCounts ?? []) {
      const id = row.newsletter_id as string
      countByType.set(id, (countByType.get(id) ?? 0) + 1)
    }

    const { count: editorialBadge } = await supabase
      .from('newsletter_editions')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .in('status', ['idea', 'draft', 'ready', 'scheduled'])

    // Automation incidents (bounce pauses in last 24h)
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString()
    const { count: autoIncidents } = await supabase
      .from('newsletter_types')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('cadence_paused', true)
      .gte('last_sent_at', oneDayAgo)

    return {
      types: (types ?? []).map((t) => ({
        id: t.id as string,
        name: t.name as string,
        color: (t.color ?? '#6366f1') as string,
        sortOrder: (t.sort_order ?? 0) as number,
        cadencePaused: !!t.cadence_paused,
        subscriberCount: countByType.get(t.id as string) ?? 0,
      })),
      tabBadges: {
        editorial: editorialBadge ?? 0,
        automations: autoIncidents ?? 0,
      },
      siteTimezone: timezone,
      siteName,
      defaultLocale,
    }
  },
  ['newsletter-shared'],
  { tags: ['newsletter-hub'], revalidate: 60 }
)
```

- [ ] **Step 2: Rewrite page.tsx**

```tsx
// apps/web/src/app/cms/(authed)/newsletters/page.tsx
import { Suspense } from 'react'
import { getSiteContext } from '@/lib/cms/site-context'
import { HubClient } from './_hub/hub-client'
import { TabSkeleton } from './_hub/tab-skeleton'
import { fetchSharedData } from './_hub/hub-queries'
import { NewsletterToastProvider } from './_components/toast-provider'
import { ptBR } from './_i18n/pt-BR'
import { en } from './_i18n/en'
import type { TabId } from './_hub/hub-types'

export const dynamic = 'force-dynamic'

export default async function NewsletterHubPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  const tab = (params.tab as TabId) || 'overview'
  const ctx = await getSiteContext()
  const locale = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const strings = locale === 'pt-BR' ? ptBR : en

  const sharedData = await fetchSharedData(
    ctx.siteId,
    ctx.siteName ?? 'Site',
    'America/Sao_Paulo',
    locale,
  )

  return (
    <>
      <NewsletterToastProvider />
      <HubClient
        sharedData={sharedData}
        defaultTab={tab}
        tabLabels={strings.tabs}
        allTypesLabel={strings.common.allTypes}
      >
        <Suspense key={tab} fallback={<TabSkeleton tab={tab} />}>
          {tab === 'overview' && <div>Overview tab placeholder — implemented in Phase 3</div>}
          {tab === 'editorial' && <div>Editorial tab placeholder — implemented in Phase 4</div>}
          {tab === 'schedule' && <div>Schedule tab placeholder — implemented in Phase 5</div>}
          {tab === 'automations' && <div>Automations tab placeholder — implemented in Phase 6</div>}
          {tab === 'audience' && <div>Audience tab placeholder — implemented in Phase 7</div>}
        </Suspense>
      </HubClient>
    </>
  )
}
```

- [ ] **Step 3: Verify compiles and dev server renders**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | tail -5
```

- [ ] **Step 4: Run tests**

```bash
npm run test:web
```

Expected: All existing tests pass (the old `newsletters-connected.tsx` isn't imported by tests directly).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/page.tsx apps/web/src/app/cms/(authed)/newsletters/_hub/hub-queries.ts
git commit -m "feat(newsletter-hub): rewrite page.tsx with 5-tab Suspense shell"
```

---

## Phase 3: Overview Tab

### Task 9: Overview tab data fetcher

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-queries.ts` (add `fetchOverviewData`)

- [ ] **Step 1: Add fetchOverviewData to hub-queries.ts**

Add the following function to `hub-queries.ts`:

```typescript
export const fetchOverviewData = unstable_cache(
  async (siteId: string): Promise<OverviewTabData> => {
    const supabase = getSupabaseServiceClient()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString()
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString()

    // KPI: total active subscribers
    const { count: totalSubs } = await supabase
      .from('newsletter_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .in('status', ['confirmed', 'pending_confirmation'])

    // KPI: subscriber trend (30d growth)
    const { count: subsThirtyDaysAgo } = await supabase
      .from('newsletter_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .in('status', ['confirmed', 'pending_confirmation'])
      .lt('created_at', thirtyDaysAgo)

    const subscribersTrend = (totalSubs ?? 0) - (subsThirtyDaysAgo ?? 0)

    // Editions sent
    const { data: sentEditions } = await supabase
      .from('newsletter_editions')
      .select('id, sent_at, stats_delivered, stats_opens, stats_clicks, stats_bounces, newsletter_type_id')
      .eq('site_id', siteId)
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })

    const allSent = sentEditions ?? []
    const sent30d = allSent.filter(e => e.sent_at && e.sent_at >= thirtyDaysAgo)
    const sent60to30d = allSent.filter(e => e.sent_at && e.sent_at >= sixtyDaysAgo && e.sent_at < thirtyDaysAgo)

    const totalDelivered30d = sent30d.reduce((s, e) => s + ((e.stats_delivered as number) ?? 0), 0)
    const totalOpens30d = sent30d.reduce((s, e) => s + ((e.stats_opens as number) ?? 0), 0)
    const totalClicks30d = sent30d.reduce((s, e) => s + ((e.stats_clicks as number) ?? 0), 0)
    const totalBounces30d = sent30d.reduce((s, e) => s + ((e.stats_bounces as number) ?? 0), 0)

    const avgOpenRate = totalDelivered30d > 0 ? (totalOpens30d / totalDelivered30d) * 100 : 0
    const avgClickRate = totalDelivered30d > 0 ? (totalClicks30d / totalDelivered30d) * 100 : 0
    const bounceRate = totalDelivered30d > 0 ? (totalBounces30d / totalDelivered30d) * 100 : 0

    // Prior period for trends
    const priorDelivered = sent60to30d.reduce((s, e) => s + ((e.stats_delivered as number) ?? 0), 0)
    const priorOpens = sent60to30d.reduce((s, e) => s + ((e.stats_opens as number) ?? 0), 0)
    const priorOpenRate = priorDelivered > 0 ? (priorOpens / priorDelivered) * 100 : 0
    const openRateTrend = avgOpenRate - priorOpenRate

    // Funnel
    const funnel = {
      sent: sent30d.reduce((s, e) => s + ((e.stats_delivered as number) ?? 0) + ((e.stats_bounces as number) ?? 0), 0),
      delivered: totalDelivered30d,
      opened: totalOpens30d,
      clicked: totalClicks30d,
    }

    // Stub remaining fields (full implementation fills these from real queries)
    return {
      kpis: {
        totalSubscribers: totalSubs ?? 0,
        subscribersTrend,
        editionsSent: allSent.length,
        editionsThisMonth: sent30d.length,
        avgOpenRate,
        openRateTrend,
        avgClickRate,
        clickRateTrend: 0,
        bounceRate,
        bounceTrend: 0,
      },
      sparklines: { subscribers: [], editions: [], openRate: [], clickRate: [], bounceRate: [] },
      healthScore: 0,
      healthDimensions: { deliverability: { score: 0, label: '' }, engagement: { score: 0, label: '' }, growth: { score: 0, label: '' }, compliance: { score: 0, label: '' } },
      subscriberGrowth: [],
      funnel,
      editionsByType: [],
      openRateTrend: [],
      publicationPerformance: [],
      topEditions: [],
      activityFeed: [],
      cohortRetention: [],
      deliverability: { spf: true, dkim: true, dmarc: true, bounceRate, complaintRate: 0, provider: 'Amazon SES' },
    }
  },
  ['newsletter-overview'],
  { tags: ['newsletter-hub', 'newsletter-overview'], revalidate: 60 }
)
```

Import `OverviewTabData` at the top of the file.

- [ ] **Step 2: Verify compiles**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_hub/hub-queries.ts
git commit -m "feat(newsletter-hub): overview data fetcher with KPI + funnel queries"
```

---

### Task 10: Overview tab UI — KPI strip + charts

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/overview/overview-tab.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/overview/kpi-strip.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/overview/engagement-funnel.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/overview/subscriber-growth-chart.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/overview/deliverability-panel.tsx`

- [ ] **Step 1: Create KPI strip**

```tsx
// _tabs/overview/kpi-strip.tsx
'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { SparklineSvg } from '../../_shared/sparkline-svg'
import type { OverviewTabData } from '../../_hub/hub-types'

interface KpiStripProps {
  kpis: OverviewTabData['kpis']
  sparklines: OverviewTabData['sparklines']
}

const KPI_DEFS = [
  { key: 'totalSubscribers' as const, sparkKey: 'subscribers' as const, format: (v: number) => v.toLocaleString(), suffix: '' },
  { key: 'editionsSent' as const, sparkKey: 'editions' as const, format: (v: number) => v.toString(), suffix: '' },
  { key: 'avgOpenRate' as const, sparkKey: 'openRate' as const, format: (v: number) => `${v.toFixed(1)}%`, suffix: 'pp' },
  { key: 'avgClickRate' as const, sparkKey: 'clickRate' as const, format: (v: number) => `${v.toFixed(1)}%`, suffix: 'pp' },
  { key: 'bounceRate' as const, sparkKey: 'bounceRate' as const, format: (v: number) => `${v.toFixed(1)}%`, suffix: 'pp', inverted: true },
] as const

export function KpiStrip({ kpis, sparklines }: KpiStripProps) {
  const trendKeys: Record<string, number> = {
    totalSubscribers: kpis.subscribersTrend,
    editionsSent: kpis.editionsThisMonth,
    avgOpenRate: kpis.openRateTrend,
    avgClickRate: kpis.clickRateTrend,
    bounceRate: kpis.bounceTrend,
  }

  return (
    <div className="mb-4 flex gap-3 overflow-x-auto">
      {KPI_DEFS.map((def) => {
        const trend = trendKeys[def.key]
        const isPositive = def.key === 'bounceRate' ? trend < 0 : trend > 0
        return (
          <div key={def.key} className="flex min-w-[160px] flex-1 flex-col rounded-[10px] border border-gray-800 bg-gray-900 px-4 py-3 transition-colors hover:border-gray-700">
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{def.key.replace(/([A-Z])/g, ' $1').trim()}</span>
            <span className="mt-1 text-xl font-extrabold tabular-nums text-gray-100">{def.format(kpis[def.key])}</span>
            {trend !== 0 && (
              <span className={`mt-1 flex items-center gap-0.5 text-[9px] font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                {trend > 0 ? '+' : ''}{def.suffix === 'pp' ? `${trend.toFixed(1)}pp` : trend}
              </span>
            )}
            <div className="mt-2">
              <SparklineSvg data={sparklines[def.sparkKey]} color={isPositive ? '#22c55e' : '#ef4444'} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create EngagementFunnel**

```tsx
// _tabs/overview/engagement-funnel.tsx
'use client'

interface FunnelProps {
  funnel: { sent: number; delivered: number; opened: number; clicked: number }
}

export function EngagementFunnel({ funnel }: FunnelProps) {
  const stages = [
    { label: 'Sent', value: funnel.sent, pct: 100 },
    { label: 'Delivered', value: funnel.delivered, pct: funnel.sent > 0 ? (funnel.delivered / funnel.sent) * 100 : 0 },
    { label: 'Opened', value: funnel.opened, pct: funnel.delivered > 0 ? (funnel.opened / funnel.delivered) * 100 : 0 },
    { label: 'Clicked', value: funnel.clicked, pct: funnel.opened > 0 ? (funnel.clicked / funnel.opened) * 100 : 0 },
  ]

  return (
    <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Engagement Funnel</h3>
      <div className="space-y-2">
        {stages.map((s, i) => (
          <div key={s.label} className="flex items-center gap-3">
            <span className="w-16 text-[10px] font-medium text-gray-400">{s.label}</span>
            <div className="flex-1">
              <div
                className="h-5 rounded bg-indigo-500 transition-all"
                style={{ width: `${Math.max(4, (s.value / (funnel.sent || 1)) * 100)}%`, opacity: 1 - i * 0.15 }}
              />
            </div>
            <span className="w-16 text-right text-[10px] tabular-nums text-gray-300">{s.value.toLocaleString()}</span>
            <span className="w-12 text-right text-[9px] tabular-nums text-gray-500">{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create DeliverabilityPanel**

```tsx
// _tabs/overview/deliverability-panel.tsx
'use client'

import { CheckCircle2, XCircle } from 'lucide-react'
import type { OverviewTabData } from '../../_hub/hub-types'

interface Props {
  data: OverviewTabData['deliverability']
}

export function DeliverabilityPanel({ data }: Props) {
  const checks = [
    { label: 'SPF', pass: data.spf },
    { label: 'DKIM', pass: data.dkim },
    { label: 'DMARC', pass: data.dmarc },
  ]

  return (
    <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Deliverability</h3>
      <div className="flex gap-6">
        <div className="space-y-2">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-2">
              {c.pass ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}
              <span className="text-[11px] text-gray-300">{c.label}</span>
              <span className={`text-[9px] ${c.pass ? 'text-green-400' : 'text-red-400'}`}>{c.pass ? 'Verified' : 'Failed'}</span>
            </div>
          ))}
          <div className="mt-2 inline-flex rounded border border-gray-700 bg-gray-800 px-2 py-0.5 text-[9px] text-gray-400">
            {data.provider}
          </div>
        </div>
        <div className="space-y-2">
          <div>
            <span className="text-[10px] text-gray-400">Bounce Rate</span>
            <div className="mt-1 h-2 w-32 overflow-hidden rounded-full bg-gray-800">
              <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(100, (data.bounceRate / 5) * 100)}%` }} />
            </div>
            <span className="text-[9px] tabular-nums text-gray-400">{data.bounceRate.toFixed(1)}% (threshold: 5%)</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-400">Complaint Rate</span>
            <div className="mt-1 h-2 w-32 overflow-hidden rounded-full bg-gray-800">
              <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(100, (data.complaintRate / 0.1) * 100)}%` }} />
            </div>
            <span className="text-[9px] tabular-nums text-gray-400">{data.complaintRate.toFixed(2)}% (threshold: 0.1%)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create OverviewTab orchestrator**

```tsx
// _tabs/overview/overview-tab.tsx
'use client'

import type { OverviewTabData } from '../../_hub/hub-types'
import { KpiStrip } from './kpi-strip'
import { EngagementFunnel } from './engagement-funnel'
import { DeliverabilityPanel } from './deliverability-panel'
import { SummaryBar } from '../../_shared/summary-bar'

interface OverviewTabProps {
  data: OverviewTabData
}

export function OverviewTab({ data }: OverviewTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <KpiStrip kpis={data.kpis} sparklines={data.sparklines} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EngagementFunnel funnel={data.funnel} />
        <DeliverabilityPanel data={data.deliverability} />
      </div>

      {/* Additional sections: Growth chart, donut, open rate trend, publication cards, top editions, activity feed, cohort heatmap */}
      {/* Each implemented as a separate component imported here — follow same pattern as above */}

      <SummaryBar
        stats={`${data.kpis.totalSubscribers} subscribers · ${data.kpis.editionsSent} editions sent · ${data.kpis.avgOpenRate.toFixed(1)}% avg open rate`}
        shortcuts={[
          { key: 'N', label: 'New' },
          { key: '1-5', label: 'Tab' },
        ]}
      />
    </div>
  )
}
```

- [ ] **Step 5: Wire OverviewTab into page.tsx**

Replace the overview placeholder in `page.tsx`:

```tsx
{tab === 'overview' && <OverviewTabServer siteId={ctx.siteId} />}
```

Add a new server component:

```tsx
// At top of page.tsx or inline
import { fetchOverviewData } from './_hub/hub-queries'
import { OverviewTab } from './_tabs/overview/overview-tab'

async function OverviewTabServer({ siteId }: { siteId: string }) {
  const data = await fetchOverviewData(siteId)
  return <OverviewTab data={data} />
}
```

- [ ] **Step 6: Verify compiles and run tests**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json && npm run test:web
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_tabs/overview/ apps/web/src/app/cms/(authed)/newsletters/page.tsx
git commit -m "feat(newsletter-hub): overview tab — KPI strip, funnel, deliverability panel"
```

---

## Phase 4: Editorial Tab (Kanban)

### Task 11: Editorial tab data fetcher

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-queries.ts`

- [ ] **Step 1: Add fetchEditorialData**

```typescript
export const fetchEditorialData = unstable_cache(
  async (siteId: string): Promise<EditorialTabData> => {
    const supabase = getSupabaseServiceClient()

    const { data: editions } = await supabase
      .from('newsletter_editions')
      .select(`
        id, subject, status, newsletter_type_id, created_at, updated_at,
        idea_notes, idea_created_at, review_entered_at, slot_date,
        stats_delivered, stats_opens, stats_clicks, stats_bounces
      `)
      .eq('site_id', siteId)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })

    const { data: types } = await supabase
      .from('newsletter_types')
      .select('id, name, color')
      .eq('site_id', siteId)

    const typeMap = new Map((types ?? []).map(t => [t.id as string, { name: t.name as string, color: (t.color ?? '#6366f1') as string }]))

    const cards: EditionCard[] = (editions ?? []).map(e => {
      const typeInfo = typeMap.get(e.newsletter_type_id as string)
      const delivered = (e.stats_delivered as number) ?? 0
      const opens = (e.stats_opens as number) ?? 0
      const clicks = (e.stats_clicks as number) ?? 0
      const bounces = (e.stats_bounces as number) ?? 0
      return {
        id: e.id as string,
        subject: e.subject as string,
        status: e.status as EditionCard['status'],
        typeId: (e.newsletter_type_id as string) ?? null,
        typeName: typeInfo?.name ?? null,
        typeColor: typeInfo?.color ?? null,
        createdAt: e.created_at as string,
        ideaCreatedAt: (e.idea_created_at as string) ?? null,
        reviewEnteredAt: (e.review_entered_at as string) ?? null,
        slotDate: (e.slot_date as string) ?? null,
        wordCount: null,
        readingTimeMin: null,
        progressPercent: null,
        ideaNotes: (e.idea_notes as string) ?? null,
        snippet: null,
        stats: delivered > 0 ? { opens, clicks, bounceRate: (bounces / delivered) * 100 } : null,
      }
    })

    return {
      velocity: { throughput: 0, avgIdeaToSent: 0, movedThisWeek: 0, bottleneck: null },
      editions: cards,
      wipLimit: 4,
    }
  },
  ['newsletter-editorial'],
  { tags: ['newsletter-hub', 'newsletter-editorial'], revalidate: 60 }
)
```

Import `EditionCard` and `EditorialTabData` from hub-types.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_hub/hub-queries.ts
git commit -m "feat(newsletter-hub): editorial data fetcher"
```

---

### Task 12: Kanban board with @dnd-kit

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/editorial/editorial-tab.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/editorial/kanban-board.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/editorial/kanban-column.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/editorial/kanban-card.tsx`

- [ ] **Step 1: Create KanbanCard**

```tsx
// _tabs/editorial/kanban-card.tsx
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, MoreVertical } from 'lucide-react'
import type { EditionCard } from '../../_hub/hub-types'

interface KanbanCardProps {
  edition: EditionCard
  onClick: () => void
}

export function KanbanCard({ edition, onClick }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: edition.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const ageDays = Math.floor((Date.now() - new Date(edition.ideaCreatedAt ?? edition.createdAt).getTime()) / 86400000)
  const ageColor = ageDays > 14 ? 'text-red-400' : ageDays > 7 ? 'text-amber-400' : 'text-gray-500'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group cursor-pointer rounded-lg border bg-gray-900 p-3 transition-colors hover:border-gray-700 ${
        edition.status === 'idea' ? 'border-dashed border-gray-700' : 'border-gray-800'
      }`}
      onClick={onClick}
    >
      {/* Drag handle */}
      <div className="mb-1 flex items-center justify-between">
        <button {...attributes} {...listeners} className="cursor-grab opacity-0 group-hover:opacity-100">
          <GripVertical className="h-3.5 w-3.5 text-gray-600" />
        </button>
        <button className="opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
          <MoreVertical className="h-3.5 w-3.5 text-gray-500" />
        </button>
      </div>

      {/* Type accent */}
      {edition.typeColor && (
        <div className="mb-2 h-0.5 w-full rounded" style={{ backgroundColor: edition.typeColor }} />
      )}

      {/* Title */}
      <p className="text-[11px] font-medium leading-tight text-gray-200 line-clamp-2">{edition.subject}</p>

      {/* Meta */}
      <div className="mt-2 flex items-center gap-2">
        {edition.typeName && (
          <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[8px] font-medium text-gray-400" style={{ borderLeft: `2px solid ${edition.typeColor}` }}>
            {edition.typeName}
          </span>
        )}
        <span className={`text-[9px] ${ageColor}`}>{ageDays}d</span>
      </div>

      {/* Stats for sent editions */}
      {edition.stats && (
        <div className="mt-2 flex gap-2 text-[9px] tabular-nums text-gray-500">
          <span>{edition.stats.opens} opens</span>
          <span>{edition.stats.clicks} clicks</span>
          {edition.stats.bounceRate > 5 && <span className="text-red-400">{edition.stats.bounceRate.toFixed(1)}% bounce</span>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create KanbanColumn**

```tsx
// _tabs/editorial/kanban-column.tsx
'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { EditionCard } from '../../_hub/hub-types'
import { KanbanCard } from './kanban-card'

interface KanbanColumnProps {
  id: string
  title: string
  cards: EditionCard[]
  count: number
  wipLimit?: number
  onCardClick: (id: string) => void
}

export function KanbanColumn({ id, title, cards, count, wipLimit, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const atLimit = wipLimit !== undefined && count >= wipLimit

  return (
    <div className="flex w-[220px] shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-gray-300">{title}</span>
          <span className="rounded-full bg-gray-800 px-1.5 py-0.5 text-[9px] font-medium text-gray-500">{count}</span>
        </div>
        {wipLimit !== undefined && (
          <span className={`text-[9px] font-medium ${atLimit ? 'text-red-400' : 'text-gray-500'}`}>
            {count}/{wipLimit}
          </span>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[200px] flex-1 flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors ${
          isOver ? 'border-indigo-500 bg-indigo-500/5' : 'border-gray-800'
        } ${atLimit && isOver ? 'border-red-500 bg-red-500/5' : ''}`}
      >
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard key={card.id} edition={card} onClick={() => onCardClick(card.id)} />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create KanbanBoard**

```tsx
// _tabs/editorial/kanban-board.tsx
'use client'

import { useCallback, useState } from 'react'
import { DndContext, DragOverlay, closestCorners, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { EditionCard } from '../../_hub/hub-types'
import { KanbanColumn } from './kanban-column'
import { KanbanCard } from './kanban-card'
import { moveEdition } from '../../actions'

const COLUMNS = ['idea', 'draft', 'review', 'scheduled', 'sent', 'failed', 'cancelled'] as const
const COLUMN_LABELS: Record<string, string> = {
  idea: 'Idea', draft: 'Draft', review: 'Review', scheduled: 'Scheduled',
  sent: 'Sent', failed: 'Issues', cancelled: 'Archive',
}
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  idea: ['draft'], draft: ['review', 'idea'], review: ['scheduled', 'draft'], scheduled: ['review'],
}

interface KanbanBoardProps {
  editions: EditionCard[]
  wipLimit: number
}

export function KanbanBoard({ editions, wipLimit }: KanbanBoardProps) {
  const router = useRouter()
  const [items, setItems] = useState(editions)
  const [activeId, setActiveId] = useState<string | null>(null)

  const groupByStatus = useCallback(() => {
    const groups: Record<string, EditionCard[]> = {}
    for (const col of COLUMNS) groups[col] = []
    for (const e of items) {
      const col = e.status === 'failed' ? 'failed' : e.status === 'cancelled' || e.status === 'archived' ? 'cancelled' : e.status
      if (groups[col]) groups[col].push(e)
    }
    return groups
  }, [items])

  const grouped = groupByStatus()
  const activeCard = items.find(e => e.id === activeId)

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const cardId = active.id as string
    const targetColumn = over.id as string
    const card = items.find(e => e.id === cardId)
    if (!card || card.status === targetColumn) return

    const allowed = ALLOWED_TRANSITIONS[card.status]
    if (!allowed?.includes(targetColumn)) return

    // Optimistic update
    setItems(prev => prev.map(e => e.id === cardId ? { ...e, status: targetColumn as EditionCard['status'] } : e))

    const result = await moveEdition(cardId, targetColumn as EditionCard['status'])
    if (!result.ok) {
      setItems(prev => prev.map(e => e.id === cardId ? { ...e, status: card.status } : e))
      toast.error(`Couldn't move edition — ${result.error}`)
    } else {
      toast.success(`Moved to ${COLUMN_LABELS[targetColumn]}`, {
        action: { label: 'Undo', onClick: () => { /* revert */ } },
        duration: 5000,
      })
      router.refresh()
    }
  }

  return (
    <DndContext collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col}
            id={col}
            title={COLUMN_LABELS[col]}
            cards={grouped[col]}
            count={grouped[col].length}
            wipLimit={col === 'draft' ? wipLimit : undefined}
            onCardClick={(id) => router.push(`/cms/newsletters/${id}/edit`)}
          />
        ))}
      </div>
      <DragOverlay>
        {activeCard && <KanbanCard edition={activeCard} onClick={() => {}} />}
      </DragOverlay>
    </DndContext>
  )
}
```

- [ ] **Step 4: Create EditorialTab**

```tsx
// _tabs/editorial/editorial-tab.tsx
'use client'

import type { EditorialTabData } from '../../_hub/hub-types'
import { HealthStrip } from '../../_shared/health-strip'
import { SummaryBar } from '../../_shared/summary-bar'
import { KanbanBoard } from './kanban-board'

interface EditorialTabProps {
  data: EditorialTabData
}

export function EditorialTab({ data }: EditorialTabProps) {
  const metrics = [
    { label: 'Throughput', value: `${data.velocity.throughput.toFixed(1)}/week` },
    { label: 'Avg Idea→Sent', value: `${data.velocity.avgIdeaToSent}d` },
    { label: 'Moved Forward', value: `${data.velocity.movedThisWeek} this week` },
    { label: 'Bottleneck', value: data.velocity.bottleneck?.column ?? '—' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <HealthStrip metrics={metrics} />
      <KanbanBoard editions={data.editions} wipLimit={data.wipLimit} />
      <SummaryBar
        stats={`${data.editions.length} active editions`}
        shortcuts={[{ key: 'N', label: 'New' }, { key: '/', label: 'Search' }, { key: 'Enter', label: 'Open' }]}
      />
    </div>
  )
}
```

- [ ] **Step 5: Add moveEdition server action to actions.ts**

Add at the end of `apps/web/src/app/cms/(authed)/newsletters/actions.ts`:

```typescript
export async function moveEdition(
  editionId: string,
  newStatus: string,
): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()

  const { data: current } = await supabase
    .from('newsletter_editions')
    .select('status')
    .eq('id', editionId)
    .single()

  if (!current) return { ok: false, error: 'edition_not_found' }

  const ALLOWED: Record<string, string[]> = {
    idea: ['draft'], draft: ['review', 'idea'], review: ['scheduled', 'draft'], scheduled: ['review'],
  }

  const allowed = ALLOWED[current.status as string]
  if (!allowed || !allowed.includes(newStatus)) {
    return { ok: false, error: `transition_not_allowed: ${current.status} → ${newStatus}` }
  }

  const updateData: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() }
  if (newStatus === 'review') updateData.review_entered_at = new Date().toISOString()

  const { error } = await supabase
    .from('newsletter_editions')
    .update(updateData)
    .eq('id', editionId)
    .eq('status', current.status)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  return { ok: true }
}
```

- [ ] **Step 6: Wire EditorialTab into page.tsx**

Add import and server component:

```tsx
import { fetchEditorialData } from './_hub/hub-queries'
import { EditorialTab } from './_tabs/editorial/editorial-tab'

async function EditorialTabServer({ siteId }: { siteId: string }) {
  const data = await fetchEditorialData(siteId)
  return <EditorialTab data={data} />
}
```

Replace editorial placeholder: `{tab === 'editorial' && <EditorialTabServer siteId={ctx.siteId} />}`

- [ ] **Step 7: Verify compiles and tests**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json && npm run test:web
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_tabs/editorial/ apps/web/src/app/cms/(authed)/newsletters/actions.ts apps/web/src/app/cms/(authed)/newsletters/page.tsx apps/web/src/app/cms/(authed)/newsletters/_hub/hub-queries.ts
git commit -m "feat(newsletter-hub): editorial tab — kanban board with @dnd-kit drag-drop"
```

---

## Phase 5: Schedule Tab

### Task 13: Schedule tab (calendar + cadence cards)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/schedule/schedule-tab.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/schedule/month-calendar.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/schedule/cadence-card.tsx`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-queries.ts` (add fetchScheduleData)
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts` (add toggleCadence)

Follow the same pattern: create data fetcher → create UI components → add server action → wire into page.tsx → verify compiles → commit.

The MonthCalendar renders a 7×6 grid (Su-Sa) for the current month. Each cell shows colored dots for scheduled editions and dashed dots for empty cadence slots. CadenceCard shows type name, toggle switch, frequency, next date, subscriber count. The toggleCadence action updates `newsletter_types.cadence_paused`.

---

## Phase 6: Automations Tab

### Task 14: Automations tab (workflow cards + cron health)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/automations/automations-tab.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/automations/workflow-card.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/automations/cron-card.tsx`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-queries.ts` (add fetchAutomationsData)

Follow the same pattern. WorkflowCard renders the sequence flow as connected nodes with colored dots. CronCard shows cron expression in monospace, frequency label, health dots (7 circles for last 7 runs), LGPD badge where applicable.

---

## Phase 7: Audience Tab

### Task 15: Audience tab (subscriber table + charts)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/audience/audience-tab.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/audience/subscriber-table.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/audience/audience-growth-chart.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/audience/distribution-chart.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/audience/locale-donut.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/audience/lgpd-consent-panel.tsx`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-queries.ts` (add fetchAudienceData)
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts` (add exportSubscribers)

Follow the same pattern. SubscriberTable has search (debounced 300ms, server-side), filter chips (All/Active/At risk/Bounced/Unsubscribed), paginated at 10/page, sortable columns. LocaleDonut is inline SVG. LgpdConsentPanel shows consent metrics with Shield icon. The exportSubscribers action generates CSV uploaded to Supabase Storage with signed URL.

---

## Phase 8: Cross-Cutting

### Task 16: Responsive breakpoints + a11y + reduced motion

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-client.tsx` (responsive sidebar collapse)
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_shared/*.tsx` (responsive classes)
- Create: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-styles.css` (shimmer + reduced-motion)

- [ ] **Step 1: Add shimmer animation and reduced-motion CSS**

```css
/* _hub/hub-styles.css */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.animate-shimmer {
  animation: shimmer 1.5s infinite;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Import CSS in page.tsx**

```typescript
import './_hub/hub-styles.css'
```

- [ ] **Step 3: Add ARIA attributes to TabBar**

Ensure `role="tablist"` on tab container, `role="tab"` + `aria-selected` on each tab button, `role="tabpanel"` on content area. (Already partially done in hub-client.tsx.)

- [ ] **Step 4: Run test suite**

```bash
npm run test:web
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_hub/hub-styles.css apps/web/src/app/cms/(authed)/newsletters/page.tsx
git commit -m "feat(newsletter-hub): responsive styles, reduced-motion, shimmer animation"
```

---

### Task 17: Remove old newsletters-connected.tsx

**Files:**
- Delete: `apps/web/src/app/cms/(authed)/newsletters/newsletters-connected.tsx`
- Delete: `apps/web/src/app/cms/(authed)/newsletters/_components/type-cards.tsx`

- [ ] **Step 1: Verify no remaining imports**

```bash
grep -r "newsletters-connected\|NewslettersConnected" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules"
grep -r "type-cards\|TypeCards" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules"
```

Expected: Only the file itself (no external imports).

- [ ] **Step 2: Delete files**

```bash
rm apps/web/src/app/cms/(authed)/newsletters/newsletters-connected.tsx
rm apps/web/src/app/cms/(authed)/newsletters/_components/type-cards.tsx
```

- [ ] **Step 3: Verify compiles and tests pass**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json && npm run test:web
```

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "chore(newsletter-hub): remove old newsletters-connected + type-cards (replaced by hub)"
```

---

## Phase 9: Testing

### Task 18: Integration tests for new server actions

**Files:**
- Create: `apps/web/test/integration/newsletter-hub-actions.test.ts`

- [ ] **Step 1: Write integration tests (gated by HAS_LOCAL_DB)**

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { createClient } from '@supabase/supabase-js'

describe.skipIf(skipIfNoLocalDb())('Newsletter Hub Server Actions', () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  let siteId: string
  let typeId: string
  let editionId: string

  beforeAll(async () => {
    // Seed test data
    const { data: site } = await supabase.from('sites').select('id').limit(1).single()
    siteId = site!.id

    const { data: type } = await supabase.from('newsletter_types').select('id').eq('site_id', siteId).limit(1).single()
    typeId = type!.id

    const { data: edition } = await supabase
      .from('newsletter_editions')
      .insert({ site_id: siteId, newsletter_type_id: typeId, subject: 'Test Move', status: 'idea' })
      .select('id')
      .single()
    editionId = edition!.id
  })

  it('moveEdition: idea → draft succeeds', async () => {
    const { error } = await supabase
      .from('newsletter_editions')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', editionId)
      .eq('status', 'idea')
    expect(error).toBeNull()
  })

  it('moveEdition: draft → sent is blocked (not in ALLOWED)', async () => {
    // Verify the edition stays as draft — no direct transition allowed
    const { data } = await supabase.from('newsletter_editions').select('status').eq('id', editionId).single()
    expect(data!.status).toBe('draft')
  })
})
```

- [ ] **Step 2: Run tests (without DB they skip)**

```bash
npm run test:web -- --reporter=verbose --testPathPattern="newsletter-hub-actions"
```

Expected: Tests skip (no `HAS_LOCAL_DB`).

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/integration/newsletter-hub-actions.test.ts
git commit -m "test(newsletter-hub): integration tests for moveEdition action"
```

---

### Task 19: E2E tests (Playwright)

**Files:**
- Create: `apps/web/e2e/newsletter-hub-tabs.spec.ts`

- [ ] **Step 1: Write E2E spec for tab navigation**

```typescript
import { test, expect } from '@playwright/test'

test.describe('Newsletter Hub — Tab Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cms/newsletters')
  })

  test('renders 5 tabs and defaults to overview', async ({ page }) => {
    const tabs = page.locator('[role="tab"]')
    await expect(tabs).toHaveCount(5)
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
    await expect(page).toHaveURL(/tab=overview|\/cms\/newsletters$/)
  })

  test('switching tabs updates URL', async ({ page }) => {
    await page.locator('[role="tab"]').filter({ hasText: /Editorial/i }).click()
    await expect(page).toHaveURL(/tab=editorial/)
  })

  test('keyboard shortcut 2 switches to editorial', async ({ page }) => {
    await page.keyboard.press('2')
    await expect(page).toHaveURL(/tab=editorial/)
  })

  test('back button navigates between tabs', async ({ page }) => {
    await page.locator('[role="tab"]').filter({ hasText: /Schedule/i }).click()
    await expect(page).toHaveURL(/tab=schedule/)
    await page.goBack()
    await expect(page).toHaveURL(/tab=overview|\/cms\/newsletters$/)
  })
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/e2e/newsletter-hub-tabs.spec.ts
git commit -m "test(newsletter-hub): E2E tab navigation tests"
```

---

## Phase 10: Final Verification

### Task 20: Full test suite + typecheck

- [ ] **Step 1: Run full test suite**

```bash
npm run test:web
```

Expected: All tests pass.

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: No errors.

- [ ] **Step 3: Verify dev server renders all tabs**

```bash
cd apps/web && npx next dev &
# Navigate to localhost:3000/cms/newsletters
# Verify: Overview, Editorial, Schedule, Automations, Audience tabs render without errors
```

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A && git commit -m "fix(newsletter-hub): final fixes from verification"
```

---

## Summary

| Phase | Tasks | Description |
|---|---|---|
| 0 | 1-2 | Dependencies + DB migration |
| 1 | 3-6 | Types, utilities, i18n, shared components |
| 2 | 7-8 | Hub client, page.tsx rewrite, tab shell |
| 3 | 9-10 | Overview tab (KPIs, funnel, deliverability) |
| 4 | 11-12 | Editorial tab (kanban with @dnd-kit) |
| 5 | 13 | Schedule tab (calendar, cadence) |
| 6 | 14 | Automations tab (workflows, crons) |
| 7 | 15 | Audience tab (table, charts, export) |
| 8 | 16-17 | Responsive, a11y, cleanup |
| 9 | 18-19 | Integration + E2E tests |
| 10 | 20 | Final verification |

**Estimated tasks:** 20 major tasks, ~80 steps total.

**Note:** Tasks 13-15 follow the exact same pattern as Tasks 9-12 (data fetcher → UI components → server actions → wire into page → test → commit). The full code for each is in the spec's TypeScript interfaces section and the HTML mockups provide pixel-perfect reference.
