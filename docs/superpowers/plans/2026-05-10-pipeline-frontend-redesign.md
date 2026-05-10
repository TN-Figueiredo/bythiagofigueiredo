# Pipeline Frontend Redesign (Gem System) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the basic pipeline Kanban frontend with a gold-level "Gem System" dashboard featuring rich cards, KPI stats, recommendations, playlists with progress, inline search, and a redesigned item detail view.

**Architecture:** Design system foundation (`gem-design.ts`) provides CSS vars + 8 utility functions consumed by all components. Components are progressively rewritten: card → VVS ring → overview → filter bar → search → board → detail → list → collections → edit page → nav cleanup. No global state — server components with optimistic client mutations.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind 4, TypeScript 5, Supabase (PostgreSQL), sonner (toasts), existing `@tn-figueiredo/cms-ui` shell

---

## File Structure

### New Files (8)
| File | Responsibility |
|------|---------------|
| `apps/web/src/lib/pipeline/gem-design.ts` | Design system: CSS vars object + 8 utility functions |
| `apps/web/src/app/cms/(authed)/pipeline/_components/gem-card.tsx` | Gem System v4 card component (~150 LOC) |
| `apps/web/src/app/cms/(authed)/pipeline/_components/gem-vvs-ring.tsx` | Reusable SVG validation score ring (~30 LOC) |
| `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx` | Overview dashboard with KPIs, recommendations, playlists (~250 LOC) |
| `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-filter-bar.tsx` | Chip filters for board view (~60 LOC) |
| `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-search-dropdown.tsx` | Debounced search with grouped results dropdown (~80 LOC) |
| `apps/web/src/app/cms/(authed)/pipeline/items/[id]/edit/page.tsx` | Body content edit page (server component, ~40 LOC) |
| `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-body-editor.tsx` | Full-width editor with auto-save (~100 LOC) |

### Modified Files (11)
| File | Changes |
|------|---------|
| `_components/pipeline-board.tsx` | Use GemCard + FilterBar, gem column styling |
| `_components/pipeline-item-detail.tsx` | Split layout with 4 sidebar cards, inline editing, VVS ring |
| `_components/pipeline-list-table.tsx` | Gem-styled rows with format icon, VVS mini ring, checklist bar |
| `_components/collection-manager.tsx` | Progress bars, thesis preview, gem styling |
| `_components/collection-detail.tsx` | Use GemCard for members |
| `_components/reference-editor.tsx` | Minor gem theme vars |
| `page.tsx` (overview) | 4 parallel queries, render PipelineOverview |
| `[format]/page.tsx` | Enriched data fetch (hook, body, deps, updated_at) |
| `items/[id]/page.tsx` | Fetch deps + compute validation + pass to detail |
| `list/page.tsx` | Enrich with hook, checklist, memberships |
| `_shared/cms-sections.ts` | Remove Search nav item |

### Removed Files (4)
| File | Replaced By |
|------|-------------|
| `_components/pipeline-card.tsx` | `gem-card.tsx` |
| `_components/pipeline-overview-cards.tsx` | `pipeline-overview.tsx` |
| `_components/search-results.tsx` | `pipeline-search-dropdown.tsx` |
| `search/page.tsx` | Search integrated into overview |

---

## Task 1: Gem Design System Foundation

**Files:**
- Create: `apps/web/src/lib/pipeline/gem-design.ts`
- Test: `apps/web/test/lib/pipeline/gem-design.test.ts`

- [ ] **Step 1: Write failing tests for all 8 utility functions**

```typescript
// apps/web/test/lib/pipeline/gem-design.test.ts
import { describe, it, expect } from 'vitest'
import {
  getPriorityConfig,
  getStaleness,
  getVvsTier,
  getFormatIcon,
  getLangConfig,
  getCardState,
  isBlocked,
  getChecklistProgress,
  GEM_CSS_VARS,
} from '@/lib/pipeline/gem-design'

describe('gem-design', () => {
  describe('GEM_CSS_VARS', () => {
    it('exports surface vars', () => {
      expect(GEM_CSS_VARS['--gem-surface']).toBe('#161d2d')
      expect(GEM_CSS_VARS['--gem-well']).toBe('#0c1222')
    })
  })

  describe('getPriorityConfig', () => {
    it('returns red config for P5', () => {
      const c = getPriorityConfig(5)
      expect(c.accent).toBe('#ef4444')
      expect(c.label).toBe('P5')
      expect(c.className).toContain('priority-5')
    })

    it('returns amber config for P4', () => {
      const c = getPriorityConfig(4)
      expect(c.accent).toBe('#f59e0b')
      expect(c.label).toBe('P4')
    })

    it('returns indigo config for P3', () => {
      const c = getPriorityConfig(3)
      expect(c.accent).toBe('#6366f1')
    })

    it('returns sky config for P2', () => {
      const c = getPriorityConfig(2)
      expect(c.accent).toBe('#0ea5e9')
    })

    it('returns slate config for P1 and P0', () => {
      expect(getPriorityConfig(1).accent).toBe('#64748b')
      expect(getPriorityConfig(0).accent).toBe('#64748b')
    })
  })

  describe('getStaleness', () => {
    it('returns ok tier for items updated within 7 days', () => {
      const recent = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      const result = getStaleness(recent)
      expect(result.tier).toBe('ok')
      expect(result.days).toBe(3)
    })

    it('returns warn tier for 7-21 days', () => {
      const old = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      const result = getStaleness(old)
      expect(result.tier).toBe('warn')
      expect(result.days).toBe(14)
    })

    it('returns old tier for >21 days', () => {
      const veryOld = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const result = getStaleness(veryOld)
      expect(result.tier).toBe('old')
      expect(result.days).toBe(30)
    })
  })

  describe('getVvsTier', () => {
    it('returns low tier for 0-30', () => {
      const r = getVvsTier(20)
      expect(r.tier).toBe('low')
      expect(r.color).toBe('#ef4444')
      expect(r.strokeDashoffset).toBeGreaterThan(0)
    })

    it('returns mid tier for 31-60', () => {
      expect(getVvsTier(45).tier).toBe('mid')
      expect(getVvsTier(45).color).toBe('#f59e0b')
    })

    it('returns high tier for 61-90', () => {
      expect(getVvsTier(75).tier).toBe('high')
      expect(getVvsTier(75).color).toBe('#10b981')
    })

    it('returns max tier for 91-100', () => {
      expect(getVvsTier(95).tier).toBe('max')
      expect(getVvsTier(95).color).toBe('#6366f1')
    })

    it('computes correct strokeDashoffset for ring', () => {
      const circumference = 2 * Math.PI * 10
      const result = getVvsTier(50)
      const expected = circumference - (50 / 100) * circumference
      expect(result.strokeDashoffset).toBeCloseTo(expected, 1)
    })
  })

  describe('getFormatIcon', () => {
    it('returns film emoji for video', () => {
      const r = getFormatIcon('video')
      expect(r.icon).toBe('🎬')
      expect(r.label).toBe('Video')
    })

    it('returns pen emoji for blog_post', () => {
      expect(getFormatIcon('blog_post').icon).toBe('✍️')
    })

    it('returns mail emoji for newsletter', () => {
      expect(getFormatIcon('newsletter').icon).toBe('📧')
    })

    it('returns cap emoji for course', () => {
      expect(getFormatIcon('course').icon).toBe('🎓')
    })

    it('returns megaphone emoji for campaign', () => {
      expect(getFormatIcon('campaign').icon).toBe('📣')
    })
  })

  describe('getLangConfig', () => {
    it('returns PT config for pt-br', () => {
      const r = getLangConfig('pt-br')
      expect(r.label).toBe('PT')
      expect(r.className).toContain('green')
    })

    it('returns EN config for en', () => {
      const r = getLangConfig('en')
      expect(r.label).toBe('EN')
      expect(r.className).toContain('blue')
    })

    it('returns PT+EN config for both', () => {
      const r = getLangConfig('both')
      expect(r.label).toBe('PT+EN')
      expect(r.className).toContain('indigo')
    })
  })

  describe('getCardState', () => {
    const base = {
      hook: null,
      body_content: null,
      youtube_video_id: null,
      blog_post_id: null,
      newsletter_edition_id: null,
      campaign_id: null,
      is_archived: false,
    }

    it('returns raw when no hook and no body', () => {
      expect(getCardState(base)).toBe('raw')
    })

    it('returns enriched when hook exists', () => {
      expect(getCardState({ ...base, hook: 'a hook' })).toBe('enriched')
    })

    it('returns enriched when body_content exists', () => {
      expect(getCardState({ ...base, body_content: 'content' })).toBe('enriched')
    })

    it('returns graduated when youtube_video_id set', () => {
      expect(getCardState({ ...base, hook: 'x', youtube_video_id: 'abc' })).toBe('graduated')
    })

    it('returns graduated when blog_post_id set', () => {
      expect(getCardState({ ...base, hook: 'x', blog_post_id: 'abc' })).toBe('graduated')
    })

    it('returns archived when is_archived true', () => {
      expect(getCardState({ ...base, is_archived: true })).toBe('archived')
    })
  })

  describe('isBlocked', () => {
    it('returns not blocked when no deps', () => {
      const r = isBlocked([])
      expect(r.blocked).toBe(false)
      expect(r.blockers).toEqual([])
    })

    it('returns blocked with blocker codes for hard deps', () => {
      const deps = [
        { dependency_type: 'hard', depends_on_pipeline: { code: 'vid-setup' } },
        { dependency_type: 'soft', depends_on_pipeline: { code: 'vid-intro' } },
      ]
      const r = isBlocked(deps)
      expect(r.blocked).toBe(true)
      expect(r.blockers).toEqual(['vid-setup'])
    })
  })

  describe('getChecklistProgress', () => {
    it('returns zero for empty checklist', () => {
      const r = getChecklistProgress([])
      expect(r.done).toBe(0)
      expect(r.total).toBe(0)
      expect(r.segments).toEqual([])
    })

    it('computes correct segments', () => {
      const checklist = [
        { label: 'A', done: true },
        { label: 'B', done: false },
        { label: 'C', done: true },
      ]
      const r = getChecklistProgress(checklist)
      expect(r.done).toBe(2)
      expect(r.total).toBe(3)
      expect(r.segments).toEqual([true, false, true])
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/lib/pipeline/gem-design.test.ts`
Expected: FAIL — module `@/lib/pipeline/gem-design` does not exist

- [ ] **Step 3: Implement gem-design.ts**

```typescript
// apps/web/src/lib/pipeline/gem-design.ts
import type { Format, Language } from './schemas'

export const GEM_CSS_VARS: Record<string, string> = {
  '--gem-surface': '#161d2d',
  '--gem-surface-hi': '#1a2236',
  '--gem-border': '#222d40',
  '--gem-well': '#0c1222',
  '--gem-text': '#edf2f7',
  '--gem-muted': '#7a8ba3',
  '--gem-dim': '#4a5568',
  '--gem-faint': '#2a3650',
  '--gem-done': '#10b981',
  '--gem-warn': '#f59e0b',
  '--gem-danger': '#ef4444',
  '--gem-accent': '#6366f1',
}

interface PriorityConfig {
  accent: string
  accentDim: string
  accentBorder: string
  label: string
  className: string
}

const PRIORITY_MAP: Record<number, PriorityConfig> = {
  5: { accent: '#ef4444', accentDim: 'rgba(239,68,68,0.1)', accentBorder: 'rgba(239,68,68,0.3)', label: 'P5', className: 'priority-5' },
  4: { accent: '#f59e0b', accentDim: 'rgba(245,158,11,0.1)', accentBorder: 'rgba(245,158,11,0.3)', label: 'P4', className: 'priority-4' },
  3: { accent: '#6366f1', accentDim: 'rgba(99,102,241,0.1)', accentBorder: 'rgba(99,102,241,0.3)', label: 'P3', className: 'priority-3' },
  2: { accent: '#0ea5e9', accentDim: 'rgba(14,165,233,0.1)', accentBorder: 'rgba(14,165,233,0.3)', label: 'P2', className: 'priority-2' },
  1: { accent: '#64748b', accentDim: 'rgba(100,116,139,0.1)', accentBorder: 'rgba(100,116,139,0.3)', label: 'P1', className: 'priority-1' },
  0: { accent: '#64748b', accentDim: 'rgba(100,116,139,0.05)', accentBorder: 'rgba(100,116,139,0.2)', label: 'P0', className: 'priority-0' },
}

export function getPriorityConfig(priority: number): PriorityConfig {
  return PRIORITY_MAP[priority] ?? PRIORITY_MAP[0]!
}

interface StalenessResult {
  days: number
  tier: 'ok' | 'warn' | 'old'
  className: string
}

export function getStaleness(updatedAt: string): StalenessResult {
  const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24))
  if (days > 21) return { days, tier: 'old', className: 'staleness-old' }
  if (days >= 7) return { days, tier: 'warn', className: 'staleness-warn' }
  return { days, tier: 'ok', className: 'staleness-ok' }
}

interface VvsTierResult {
  tier: 'low' | 'mid' | 'high' | 'max'
  color: string
  strokeDashoffset: number
}

const VVS_CIRCUMFERENCE = 2 * Math.PI * 10

export function getVvsTier(score: number): VvsTierResult {
  const offset = VVS_CIRCUMFERENCE - (score / 100) * VVS_CIRCUMFERENCE
  if (score >= 91) return { tier: 'max', color: '#6366f1', strokeDashoffset: offset }
  if (score >= 61) return { tier: 'high', color: '#10b981', strokeDashoffset: offset }
  if (score >= 31) return { tier: 'mid', color: '#f59e0b', strokeDashoffset: offset }
  return { tier: 'low', color: '#ef4444', strokeDashoffset: offset }
}

interface FormatIconResult {
  icon: string
  bgClass: string
  label: string
}

const FORMAT_ICONS: Record<Format, FormatIconResult> = {
  video: { icon: '🎬', bgClass: 'bg-red-500/10', label: 'Video' },
  blog_post: { icon: '✍️', bgClass: 'bg-amber-500/10', label: 'Blog' },
  newsletter: { icon: '📧', bgClass: 'bg-indigo-500/10', label: 'Newsletter' },
  course: { icon: '🎓', bgClass: 'bg-emerald-500/10', label: 'Course' },
  campaign: { icon: '📣', bgClass: 'bg-pink-500/10', label: 'Campaign' },
}

export function getFormatIcon(format: string): FormatIconResult {
  return FORMAT_ICONS[format as Format] ?? { icon: '📄', bgClass: 'bg-slate-500/10', label: format }
}

interface LangConfig {
  label: string
  className: string
}

const LANG_MAP: Record<Language, LangConfig> = {
  'pt-br': { label: 'PT', className: 'bg-green-900/50 text-green-300' },
  'en': { label: 'EN', className: 'bg-blue-900/50 text-blue-300' },
  'both': { label: 'PT+EN', className: 'bg-indigo-900/50 text-indigo-300' },
}

export function getLangConfig(language: string): LangConfig {
  return LANG_MAP[language as Language] ?? { label: language, className: 'bg-slate-700 text-slate-300' }
}

interface CardStateInput {
  hook: string | null
  body_content: string | null
  youtube_video_id: string | null
  blog_post_id: string | null
  newsletter_edition_id: string | null
  campaign_id: string | null
  is_archived: boolean
}

export type CardState = 'raw' | 'enriched' | 'graduated' | 'archived'

export function getCardState(item: CardStateInput): CardState {
  if (item.is_archived) return 'archived'
  if (item.youtube_video_id || item.blog_post_id || item.newsletter_edition_id || item.campaign_id) return 'graduated'
  if (item.hook || item.body_content) return 'enriched'
  return 'raw'
}

interface Dependency {
  dependency_type: string
  depends_on_pipeline: { code: string }
}

interface BlockedResult {
  blocked: boolean
  blockers: string[]
}

export function isBlocked(deps: Dependency[]): BlockedResult {
  const blockers = deps
    .filter((d) => d.dependency_type === 'hard')
    .map((d) => d.depends_on_pipeline.code)
  return { blocked: blockers.length > 0, blockers }
}

interface ChecklistItem {
  label: string
  done: boolean
}

interface ChecklistProgress {
  done: number
  total: number
  segments: boolean[]
}

export function getChecklistProgress(checklist: ChecklistItem[]): ChecklistProgress {
  const segments = checklist.map((c) => c.done)
  const done = segments.filter(Boolean).length
  return { done, total: checklist.length, segments }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/lib/pipeline/gem-design.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/gem-design.ts apps/web/test/lib/pipeline/gem-design.test.ts
git commit -m "feat(pipeline): add gem design system foundation with 8 utility functions"
```

---

## Task 2: VVS Ring Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/gem-vvs-ring.tsx`
- Test: `apps/web/test/app/cms/pipeline/gem-vvs-ring.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// apps/web/test/app/cms/pipeline/gem-vvs-ring.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GemVvsRing } from '@/app/cms/(authed)/pipeline/_components/gem-vvs-ring'

describe('GemVvsRing', () => {
  it('renders SVG with score label', () => {
    render(<GemVvsRing score={75} size={26} />)
    expect(screen.getByText('75')).toBeDefined()
  })

  it('renders large variant', () => {
    const { container } = render(<GemVvsRing score={92} size={48} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('48')
  })

  it('applies correct color for low score', () => {
    const { container } = render(<GemVvsRing score={20} size={26} />)
    const circle = container.querySelectorAll('circle')[1]
    expect(circle?.getAttribute('stroke')).toBe('#ef4444')
  })

  it('applies correct color for max score', () => {
    const { container } = render(<GemVvsRing score={95} size={26} />)
    const circle = container.querySelectorAll('circle')[1]
    expect(circle?.getAttribute('stroke')).toBe('#6366f1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/gem-vvs-ring.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement GemVvsRing**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/gem-vvs-ring.tsx
import { getVvsTier } from '@/lib/pipeline/gem-design'

interface GemVvsRingProps {
  score: number
  size?: number
}

export function GemVvsRing({ score, size = 26 }: GemVvsRingProps) {
  const { color, strokeDashoffset } = getVvsTier(score)
  const circumference = 2 * Math.PI * 10
  const strokeWidth = size > 30 ? 3 : 2.5
  const fontSize = size > 30 ? 7 : 6

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 24 24" className="-rotate-90">
        <circle cx="12" cy="12" r="10" fill="none" stroke="var(--gem-border, #222d40)" strokeWidth={strokeWidth} />
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <span
        className="absolute font-bold"
        style={{ fontSize: `${fontSize}px`, color }}
      >
        {score}
      </span>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/gem-vvs-ring.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/gem-vvs-ring.tsx apps/web/test/app/cms/pipeline/gem-vvs-ring.test.tsx
git commit -m "feat(pipeline): add GemVvsRing SVG validation score component"
```

---

## Task 3: Gem Card Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/gem-card.tsx`
- Test: `apps/web/test/app/cms/pipeline/gem-card.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/web/test/app/cms/pipeline/gem-card.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GemCard, type GemCardItem } from '@/app/cms/(authed)/pipeline/_components/gem-card'

const baseItem: GemCardItem = {
  id: '1',
  code: 'vid-test',
  title_pt: 'Test Title',
  title_en: null,
  format: 'video',
  stage: 'roteiro',
  language: 'pt-br',
  priority: 3,
  hook: null,
  body_content: null,
  tags: [],
  production_checklist: [
    { label: 'A', done: true },
    { label: 'B', done: false },
  ],
  updated_at: new Date().toISOString(),
  youtube_video_id: null,
  blog_post_id: null,
  newsletter_edition_id: null,
  campaign_id: null,
  is_archived: false,
  validation_score: 45,
  dependencies: [],
  collection_code: null,
}

describe('GemCard', () => {
  it('renders code and title', () => {
    render(<GemCard item={baseItem} />)
    expect(screen.getByText('vid-test')).toBeDefined()
    expect(screen.getByText('Test Title')).toBeDefined()
  })

  it('shows format icon', () => {
    render(<GemCard item={baseItem} />)
    expect(screen.getByText('🎬')).toBeDefined()
  })

  it('shows priority badge', () => {
    render(<GemCard item={baseItem} />)
    expect(screen.getByText('P3')).toBeDefined()
  })

  it('shows raw state hint when no hook', () => {
    render(<GemCard item={baseItem} />)
    expect(screen.getByText('sem hook definido')).toBeDefined()
  })

  it('shows hook text when enriched', () => {
    render(<GemCard item={{ ...baseItem, hook: 'A great hook' }} />)
    expect(screen.getByText('A great hook')).toBeDefined()
  })

  it('shows graduated badge when youtube_video_id set', () => {
    render(<GemCard item={{ ...baseItem, hook: 'x', youtube_video_id: 'abc' }} />)
    expect(screen.getByText('graduated')).toBeDefined()
  })

  it('applies archived styling', () => {
    const { container } = render(<GemCard item={{ ...baseItem, is_archived: true }} />)
    const card = container.firstElementChild
    expect(card?.className).toContain('opacity-45')
  })

  it('shows blocked tag when hard dep exists', () => {
    const deps = [{ dependency_type: 'hard', depends_on_pipeline: { code: 'vid-setup' } }]
    render(<GemCard item={{ ...baseItem, dependencies: deps }} />)
    expect(screen.getByText(/blocked by vid-setup/)).toBeDefined()
  })

  it('shows checklist segments', () => {
    const { container } = render(<GemCard item={baseItem} />)
    const segments = container.querySelectorAll('[data-segment]')
    expect(segments.length).toBe(2)
  })

  it('limits tags to 3 with overflow', () => {
    const item = { ...baseItem, tags: ['t1', 't2', 't3', 't4', 't5'], collection_code: null }
    render(<GemCard item={item} />)
    expect(screen.getByText('+3')).toBeDefined()
  })

  it('links to item detail page', () => {
    const { container } = render(<GemCard item={baseItem} />)
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe('/cms/pipeline/items/1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/gem-card.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement GemCard**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/gem-card.tsx
'use client'

import Link from 'next/link'
import {
  getPriorityConfig,
  getStaleness,
  getFormatIcon,
  getLangConfig,
  getCardState,
  isBlocked,
  getChecklistProgress,
} from '@/lib/pipeline/gem-design'
import { GemVvsRing } from './gem-vvs-ring'

export interface GemCardItem {
  id: string
  code: string
  title_pt: string | null
  title_en: string | null
  format: string
  stage: string
  language: string
  priority: number
  hook: string | null
  body_content: string | null
  tags: string[]
  production_checklist: Array<{ label: string; done: boolean }>
  updated_at: string
  youtube_video_id: string | null
  blog_post_id: string | null
  newsletter_edition_id: string | null
  campaign_id: string | null
  is_archived: boolean
  validation_score: number
  dependencies: Array<{ dependency_type: string; depends_on_pipeline: { code: string } }>
  collection_code: string | null
}

export function GemCard({ item }: { item: GemCardItem }) {
  const priority = getPriorityConfig(item.priority)
  const staleness = getStaleness(item.updated_at)
  const formatIcon = getFormatIcon(item.format)
  const lang = getLangConfig(item.language)
  const state = getCardState(item)
  const blocked = isBlocked(item.dependencies)
  const checklist = getChecklistProgress(item.production_checklist)
  const title = item.title_pt || item.title_en || 'Untitled'

  const isEnriched = state === 'enriched' || state === 'graduated'
  const isArchived = state === 'archived'
  const isGraduated = state === 'graduated'

  const tags: Array<{ label: string; className: string }> = []
  if (item.collection_code) {
    tags.push({ label: item.collection_code, className: 'bg-amber-900/50 text-amber-300' })
  }
  for (const t of item.tags) {
    if (tags.length >= 3) break
    tags.push({ label: t, className: 'bg-cyan-900/50 text-cyan-300' })
  }
  const overflowCount = (item.collection_code ? 1 : 0) + item.tags.length - tags.length

  return (
    <Link
      href={`/cms/pipeline/items/${item.id}`}
      className={`block rounded-lg border p-3 transition-[border-color,transform] duration-[120ms] hover:-translate-y-px ${
        isArchived ? 'opacity-45 saturate-[0.3] hover:opacity-65' : ''
      }`}
      style={{
        borderColor: 'var(--gem-border)',
        background: isEnriched
          ? `linear-gradient(to bottom, ${priority.accentDim}, var(--gem-surface))`
          : 'var(--gem-surface)',
      }}
    >
      {/* Priority bar */}
      <div
        className="h-0.5 -mx-3 -mt-3 mb-2 rounded-t-lg"
        style={{
          background: `linear-gradient(to right, ${priority.accent}, transparent 75%)`,
          opacity: item.priority <= 1 ? 0.25 : 1,
        }}
      />

      {/* Header row */}
      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
        <span className={`text-[18px] leading-none w-5 h-5 flex items-center justify-center rounded ${formatIcon.bgClass}`}>
          {formatIcon.icon}
        </span>
        <span className="text-[10px] font-mono" style={{ color: priority.accent }}>{item.code}</span>
        <span className={`text-[10px] px-1 py-0.5 rounded ${lang.className}`}>{lang.label}</span>
        <span
          className="text-[10px] px-1 py-0.5 rounded font-medium"
          style={{ backgroundColor: priority.accentDim, color: priority.accent }}
        >
          {priority.label}
        </span>
        {isGraduated && (
          <span className="text-[10px] px-1 py-0.5 rounded bg-emerald-900/50 text-emerald-300 font-medium">
            graduated
          </span>
        )}
        <span className={`text-[10px] flex items-center gap-0.5 ml-auto ${staleness.className}`}>
          <span
            className="w-1.5 h-1.5 rounded-full inline-block"
            style={{
              backgroundColor: staleness.tier === 'ok' ? '#10b981' : staleness.tier === 'warn' ? '#f59e0b' : '#ef4444',
            }}
          />
          {staleness.days}d
        </span>
      </div>

      {/* Title */}
      <p className="text-xs font-semibold tracking-[-0.01em] line-clamp-2" style={{ color: 'var(--gem-text)' }}>
        {title}
      </p>

      {/* Hook */}
      <div className="mt-1.5">
        {item.hook ? (
          <p
            className="text-[10px] line-clamp-2 pl-2 border-l-2"
            style={{ color: 'var(--gem-muted)', borderColor: priority.accent }}
          >
            {item.hook}
          </p>
        ) : (
          <p
            className="text-[10px] italic pl-2 border-l-2 border-dashed"
            style={{ color: 'var(--gem-dim)', borderColor: 'var(--gem-dim)' }}
          >
            sem hook definido
          </p>
        )}
      </div>

      {/* Tags */}
      {(tags.length > 0 || blocked.blocked) && (
        <div className="flex gap-1 mt-1.5 overflow-hidden">
          {blocked.blocked && (
            <span className="text-[10px] px-1 py-0.5 rounded bg-red-900/50 text-red-300 shrink-0">
              blocked by {blocked.blockers[0]}
            </span>
          )}
          {tags.map((t) => (
            <span key={t.label} className={`text-[10px] px-1 py-0.5 rounded shrink-0 ${t.className}`}>
              {t.label}
            </span>
          ))}
          {overflowCount > 0 && (
            <span className="text-[10px] px-1 py-0.5 rounded bg-slate-700/50 text-slate-400 shrink-0">
              +{overflowCount}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid var(--gem-border)' }}>
        {/* Segmented checklist bar */}
        <div className="flex gap-0.5 flex-1 mr-2">
          {checklist.segments.map((done, i) => (
            <div
              key={i}
              data-segment
              className="h-1 flex-1 rounded-sm"
              style={{
                backgroundColor: done ? 'var(--gem-done)' : 'var(--gem-well)',
                boxShadow: done ? '0 0 4px rgba(16,185,129,0.3)' : 'none',
                border: done ? 'none' : '1px solid var(--gem-border)',
              }}
            />
          ))}
        </div>
        {/* VVS Ring */}
        <GemVvsRing score={item.validation_score} size={26} />
      </div>

      {/* Graduated emerald bar */}
      {isGraduated && (
        <div
          className="h-0.5 -mx-3 -mb-3 mt-2 rounded-b-lg"
          style={{ background: 'linear-gradient(to right, #10b981, #059669 50%, transparent)' }}
        />
      )}
    </Link>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/gem-card.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/gem-card.tsx apps/web/test/app/cms/pipeline/gem-card.test.tsx
git commit -m "feat(pipeline): add GemCard v4 component with 5 visual states"
```

---

## Task 4: Pipeline Search Dropdown

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-search-dropdown.tsx`
- Test: `apps/web/test/app/cms/pipeline/pipeline-search-dropdown.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// apps/web/test/app/cms/pipeline/pipeline-search-dropdown.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PipelineSearchDropdown } from '@/app/cms/(authed)/pipeline/_components/pipeline-search-dropdown'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('PipelineSearchDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders search input', () => {
    render(<PipelineSearchDropdown />)
    expect(screen.getByPlaceholderText('Buscar pipeline...')).toBeDefined()
  })

  it('does not fetch with less than 2 chars', async () => {
    render(<PipelineSearchDropdown />)
    const input = screen.getByPlaceholderText('Buscar pipeline...')
    fireEvent.change(input, { target: { value: 'a' } })
    await new Promise((r) => setTimeout(r, 400))
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches results after debounce with 2+ chars', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { pipeline: [{ id: '1', code: 'vid-x', title_pt: 'Test', format: 'video', stage: 'idea' }], blog_posts: [], newsletters: [], collections: [] } }),
    })
    render(<PipelineSearchDropdown />)
    const input = screen.getByPlaceholderText('Buscar pipeline...')
    fireEvent.change(input, { target: { value: 'vid' } })
    await waitFor(() => expect(mockFetch).toHaveBeenCalled(), { timeout: 500 })
    await waitFor(() => expect(screen.getByText('vid-x')).toBeDefined())
  })

  it('shows no results message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { pipeline: [], blog_posts: [], newsletters: [], collections: [] } }),
    })
    render(<PipelineSearchDropdown />)
    const input = screen.getByPlaceholderText('Buscar pipeline...')
    fireEvent.change(input, { target: { value: 'zzz' } })
    await waitFor(() => expect(screen.getByText(/Nenhum resultado/)).toBeDefined(), { timeout: 500 })
  })

  it('closes on Escape key', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { pipeline: [{ id: '1', code: 'vid-x', title_pt: 'Test', format: 'video', stage: 'idea' }], blog_posts: [], newsletters: [], collections: [] } }),
    })
    render(<PipelineSearchDropdown />)
    const input = screen.getByPlaceholderText('Buscar pipeline...')
    fireEvent.change(input, { target: { value: 'vid' } })
    await waitFor(() => expect(screen.getByText('vid-x')).toBeDefined(), { timeout: 500 })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByText('vid-x')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/pipeline-search-dropdown.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PipelineSearchDropdown**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-search-dropdown.tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { getFormatIcon } from '@/lib/pipeline/gem-design'

interface SearchResult {
  pipeline: Array<{ id: string; code: string; title_pt: string | null; title_en: string | null; format: string; stage: string }>
  blog_posts: Array<{ id: string; title: string; slug: string; status: string }>
  newsletters: Array<{ id: string; subject: string; status: string }>
  collections: Array<{ id: string; code: string; name: string; type: string }>
}

export function PipelineSearchDropdown() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults(null); setOpen(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/pipeline/search?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      setResults(json.data ?? null)
      setOpen(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(query), 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, search])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); setResults(null) }
  }

  const hasResults = results && (results.pipeline.length > 0 || results.blog_posts.length > 0 || results.newsletters.length > 0 || results.collections.length > 0)

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (results) setOpen(true) }}
        placeholder="Buscar pipeline..."
        className="w-full px-3 py-2 rounded-lg text-sm"
        style={{ backgroundColor: 'var(--gem-well)', border: '1px solid var(--gem-border)', color: 'var(--gem-text)' }}
      />
      {loading && <span className="absolute right-3 top-2.5 text-xs" style={{ color: 'var(--gem-dim)' }}>...</span>}

      {open && results && (
        <div
          className="absolute top-full mt-1 left-0 right-0 rounded-lg border overflow-hidden z-50 max-h-80 overflow-y-auto"
          style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}
        >
          {!hasResults && (
            <p className="px-3 py-4 text-xs" style={{ color: 'var(--gem-dim)' }}>
              Nenhum resultado para &apos;{query}&apos;
            </p>
          )}

          {results.pipeline.length > 0 && (
            <div className="p-2">
              <p className="text-[10px] uppercase tracking-wider px-1 mb-1" style={{ color: 'var(--gem-dim)' }}>Pipeline</p>
              {results.pipeline.map((item) => {
                const icon = getFormatIcon(item.format)
                return (
                  <Link
                    key={item.id}
                    href={`/cms/pipeline/items/${item.id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5"
                  >
                    <span className="text-xs">{icon.icon}</span>
                    <span className="text-[10px] font-mono" style={{ color: 'var(--gem-muted)' }}>{item.code}</span>
                    <span className="text-xs truncate" style={{ color: 'var(--gem-text)' }}>{item.title_pt || item.title_en}</span>
                    <span className="text-[10px] ml-auto px-1 rounded" style={{ backgroundColor: 'var(--gem-well)', color: 'var(--gem-dim)' }}>{item.stage}</span>
                  </Link>
                )
              })}
            </div>
          )}

          {results.blog_posts.length > 0 && (
            <div className="p-2 border-t" style={{ borderColor: 'var(--gem-border)' }}>
              <p className="text-[10px] uppercase tracking-wider px-1 mb-1" style={{ color: 'var(--gem-dim)' }}>Blog Posts</p>
              {results.blog_posts.map((post) => (
                <Link key={post.id} href={`/cms/blog/${post.id}`} onClick={() => setOpen(false)} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5">
                  <span className="text-xs">✍️</span>
                  <span className="text-xs truncate" style={{ color: 'var(--gem-text)' }}>{post.title}</span>
                  <span className="text-[10px] ml-auto" style={{ color: 'var(--gem-dim)' }}>{post.status}</span>
                </Link>
              ))}
            </div>
          )}

          {results.collections.length > 0 && (
            <div className="p-2 border-t" style={{ borderColor: 'var(--gem-border)' }}>
              <p className="text-[10px] uppercase tracking-wider px-1 mb-1" style={{ color: 'var(--gem-dim)' }}>Collections</p>
              {results.collections.map((c) => (
                <Link key={c.id} href={`/cms/pipeline/collections/${c.id}`} onClick={() => setOpen(false)} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5">
                  <span className="text-xs">📁</span>
                  <span className="text-xs truncate" style={{ color: 'var(--gem-text)' }}>{c.name}</span>
                  <span className="text-[10px] ml-auto" style={{ color: 'var(--gem-dim)' }}>{c.type}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/pipeline-search-dropdown.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-search-dropdown.tsx apps/web/test/app/cms/pipeline/pipeline-search-dropdown.test.tsx
git commit -m "feat(pipeline): add debounced search dropdown with grouped results"
```

---

## Task 5: Filter Bar Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-filter-bar.tsx`
- Test: `apps/web/test/app/cms/pipeline/pipeline-filter-bar.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// apps/web/test/app/cms/pipeline/pipeline-filter-bar.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PipelineFilterBar } from '@/app/cms/(authed)/pipeline/_components/pipeline-filter-bar'

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/cms/pipeline/video',
}))

describe('PipelineFilterBar', () => {
  it('renders filter chips for collection, language, priority', () => {
    render(<PipelineFilterBar collections={[{ code: 'playlist-a', name: 'Playlist A' }]} />)
    expect(screen.getByText('Collection')).toBeDefined()
    expect(screen.getByText('Language')).toBeDefined()
    expect(screen.getByText('Priority')).toBeDefined()
  })

  it('updates URL params when chip selected', () => {
    render(<PipelineFilterBar collections={[{ code: 'playlist-a', name: 'Playlist A' }]} />)
    fireEvent.click(screen.getByText('Priority'))
    fireEvent.click(screen.getByText('P5'))
    expect(mockReplace).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/pipeline-filter-bar.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PipelineFilterBar**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-filter-bar.tsx
'use client'

import { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface FilterBarProps {
  collections: Array<{ code: string; name: string }>
}

type FilterKey = 'collection' | 'lang' | 'priority'

const PRIORITY_OPTIONS = [
  { value: '5', label: 'P5' },
  { value: '4', label: 'P4' },
  { value: '3', label: 'P3' },
  { value: '2', label: 'P2' },
]

const LANG_OPTIONS = [
  { value: 'pt-br', label: 'PT' },
  { value: 'en', label: 'EN' },
  { value: 'both', label: 'PT+EN' },
]

export function PipelineFilterBar({ collections }: FilterBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null)

  const activeCollection = searchParams.get('collection')
  const activeLang = searchParams.get('lang')
  const activePriority = searchParams.get('priority')

  function setFilter(key: FilterKey, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.replace(`${pathname}?${params.toString()}`)
    setOpenFilter(null)
  }

  function renderChip(key: FilterKey, label: string, active: string | null) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpenFilter(openFilter === key ? null : key)}
          className="text-xs px-2 py-1 rounded-full border transition-colors"
          style={{
            borderColor: active ? 'var(--gem-accent)' : 'var(--gem-border)',
            backgroundColor: active ? 'rgba(99,102,241,0.1)' : 'transparent',
            color: active ? 'var(--gem-text)' : 'var(--gem-muted)',
          }}
        >
          {label}{active && `: ${active}`}
        </button>

        {openFilter === key && (
          <div
            className="absolute top-full mt-1 left-0 rounded-lg border p-1 z-50 min-w-28"
            style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}
          >
            {active && (
              <button onClick={() => setFilter(key, null)} className="w-full text-left px-2 py-1 text-xs rounded hover:bg-white/5" style={{ color: 'var(--gem-dim)' }}>
                Clear
              </button>
            )}
            {key === 'collection' && collections.map((c) => (
              <button key={c.code} onClick={() => setFilter('collection', c.code)} className="w-full text-left px-2 py-1 text-xs rounded hover:bg-white/5" style={{ color: 'var(--gem-text)' }}>
                {c.name}
              </button>
            ))}
            {key === 'lang' && LANG_OPTIONS.map((o) => (
              <button key={o.value} onClick={() => setFilter('lang', o.value)} className="w-full text-left px-2 py-1 text-xs rounded hover:bg-white/5" style={{ color: 'var(--gem-text)' }}>
                {o.label}
              </button>
            ))}
            {key === 'priority' && PRIORITY_OPTIONS.map((o) => (
              <button key={o.value} onClick={() => setFilter('priority', o.value)} className="w-full text-left px-2 py-1 text-xs rounded hover:bg-white/5" style={{ color: 'var(--gem-text)' }}>
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex gap-2 mb-3">
      {renderChip('collection', 'Collection', activeCollection)}
      {renderChip('lang', 'Language', activeLang)}
      {renderChip('priority', 'Priority', activePriority)}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/pipeline-filter-bar.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-filter-bar.tsx apps/web/test/app/cms/pipeline/pipeline-filter-bar.test.tsx
git commit -m "feat(pipeline): add chip filter bar with URL search params"
```

---

## Task 6: Pipeline Overview Dashboard

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/page.tsx`
- Remove: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview-cards.tsx`
- Test: `apps/web/test/app/cms/pipeline/pipeline-overview.test.tsx`

- [ ] **Step 1: Write failing test for PipelineOverview**

```typescript
// apps/web/test/app/cms/pipeline/pipeline-overview.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PipelineOverview } from '@/app/cms/(authed)/pipeline/_components/pipeline-overview'

const props = {
  stats: { total: 123, inProgress: 45, highPriority: 12, scriptsReady: 8, published: 30 },
  recommendations: {
    nextToRecord: [
      { id: '1', code: 'vid-x', title_pt: 'Test', format: 'video', priority: 4, updated_at: new Date().toISOString() },
    ],
    topPriority: [
      { id: '2', code: 'vid-y', title_pt: 'High Pri', format: 'video', priority: 5, stage: 'idea', updated_at: new Date().toISOString() },
    ],
  },
  playlists: [
    { id: 'p1', code: 'playlist-a', name: 'Playlist A', description: 'Thesis here', progress: 60, total: 10, nextItem: { code: 'vid-1', title: 'Next' } },
  ],
  activity: [
    { id: 'h1', code: 'vid-z', format: 'video', event_type: 'stage_change', to_value: 'roteiro', changed_at: new Date().toISOString() },
  ],
}

describe('PipelineOverview', () => {
  it('renders KPI cards', () => {
    render(<PipelineOverview {...props} />)
    expect(screen.getByText('123')).toBeDefined()
    expect(screen.getByText('Total Pipeline')).toBeDefined()
    expect(screen.getByText('12')).toBeDefined()
  })

  it('renders recommendations', () => {
    render(<PipelineOverview {...props} />)
    expect(screen.getByText('Grave a seguir')).toBeDefined()
    expect(screen.getByText('vid-x')).toBeDefined()
    expect(screen.getByText('Top prioridade')).toBeDefined()
    expect(screen.getByText('vid-y')).toBeDefined()
  })

  it('renders playlists with progress', () => {
    render(<PipelineOverview {...props} />)
    expect(screen.getByText('Playlist A')).toBeDefined()
    expect(screen.getByText('6/10')).toBeDefined()
  })

  it('renders activity feed', () => {
    render(<PipelineOverview {...props} />)
    expect(screen.getByText(/vid-z/)).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/pipeline-overview.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PipelineOverview**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx
'use client'

import Link from 'next/link'
import { getFormatIcon, getPriorityConfig } from '@/lib/pipeline/gem-design'
import { getFormatColor } from '@/lib/pipeline/colors'
import { PipelineSearchDropdown } from './pipeline-search-dropdown'

interface Stats {
  total: number
  inProgress: number
  highPriority: number
  scriptsReady: number
  published: number
}

interface RecommendationItem {
  id: string
  code: string
  title_pt: string | null
  format: string
  priority: number
  updated_at: string
  stage?: string
}

interface PlaylistData {
  id: string
  code: string
  name: string
  description: string | null
  progress: number
  total: number
  nextItem: { code: string; title: string } | null
}

interface ActivityEntry {
  id: string
  code: string
  format: string
  event_type: string
  to_value: string | null
  changed_at: string
}

interface PipelineOverviewProps {
  stats: Stats
  recommendations: { nextToRecord: RecommendationItem[]; topPriority: RecommendationItem[] }
  playlists: PlaylistData[]
  activity: ActivityEntry[]
}

function relativeTime(date: string): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function eventLabel(type: string, to: string | null): string {
  switch (type) {
    case 'stage_change': return `moveu para ${to}`
    case 'created': return 'criado'
    case 'archived': return 'arquivado'
    case 'restored': return 'restaurado'
    case 'graduated': return 'graduado'
    default: return type
  }
}

export function PipelineOverview({ stats, recommendations, playlists, activity }: PipelineOverviewProps) {
  const kpis = [
    { label: 'Total Pipeline', value: stats.total, color: 'var(--gem-accent)' },
    { label: 'In Progress', value: stats.inProgress, color: '#0ea5e9' },
    { label: 'High Priority', value: stats.highPriority, color: '#ef4444' },
    { label: 'Scripts Ready', value: stats.scriptsReady, color: '#10b981' },
    { label: 'Published', value: stats.published, color: '#8b5cf6' },
  ]

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="max-w-sm ml-auto">
        <PipelineSearchDropdown />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-lg border p-4"
            style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}
          >
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--gem-dim)' }}>{kpi.label}</p>
            <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <h3 className="text-xs font-medium mb-3" style={{ color: 'var(--gem-text)' }}>Grave a seguir</h3>
          <div className="space-y-2">
            {recommendations.nextToRecord.map((item) => {
              const icon = getFormatIcon(item.format)
              const pri = getPriorityConfig(item.priority)
              return (
                <Link key={item.id} href={`/cms/pipeline/items/${item.id}`} className="flex items-center gap-2 py-1 hover:bg-white/5 rounded px-1">
                  <span className="text-xs">{icon.icon}</span>
                  <span className="text-[10px] font-mono" style={{ color: pri.accent }}>{item.code}</span>
                  <span className="text-xs truncate" style={{ color: 'var(--gem-text)' }}>{item.title_pt}</span>
                </Link>
              )
            })}
            {recommendations.nextToRecord.length === 0 && (
              <p className="text-xs" style={{ color: 'var(--gem-dim)' }}>Nenhum pronto para gravar</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <h3 className="text-xs font-medium mb-3" style={{ color: 'var(--gem-text)' }}>Top prioridade</h3>
          <div className="space-y-2">
            {recommendations.topPriority.map((item) => {
              const icon = getFormatIcon(item.format)
              const pri = getPriorityConfig(item.priority)
              return (
                <Link key={item.id} href={`/cms/pipeline/items/${item.id}`} className="flex items-center gap-2 py-1 hover:bg-white/5 rounded px-1">
                  <span className="text-xs">{icon.icon}</span>
                  <span className="text-[10px] font-mono" style={{ color: pri.accent }}>{item.code}</span>
                  <span className="text-xs truncate" style={{ color: 'var(--gem-text)' }}>{item.title_pt}</span>
                  <span className="text-[10px] ml-auto" style={{ color: 'var(--gem-dim)' }}>{item.stage}</span>
                </Link>
              )
            })}
            {recommendations.topPriority.length === 0 && (
              <p className="text-xs" style={{ color: 'var(--gem-dim)' }}>Nenhum com prioridade alta</p>
            )}
          </div>
        </div>
      </div>

      {/* Playlists */}
      {playlists.length > 0 && (
        <div>
          <h3 className="text-xs font-medium mb-3" style={{ color: 'var(--gem-text)' }}>Playlists</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {playlists.map((pl) => {
              const progressPct = pl.total > 0 ? Math.round((pl.progress / pl.total) * 100) : 0
              return (
                <Link
                  key={pl.id}
                  href={`/cms/pipeline/collections/${pl.id}`}
                  className="rounded-lg border p-4 hover:brightness-110 transition-all"
                  style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono" style={{ color: 'var(--gem-muted)' }}>{pl.code}</span>
                    <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>{pl.progress}/{pl.total}</span>
                  </div>
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--gem-text)' }}>{pl.name}</p>
                  {pl.description && (
                    <p className="text-[10px] line-clamp-2 mb-2" style={{ color: 'var(--gem-muted)' }}>{pl.description}</p>
                  )}
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--gem-well)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${progressPct}%`, backgroundColor: 'var(--gem-done)', boxShadow: '0 0 6px rgba(16,185,129,0.4)' }}
                    />
                  </div>
                  {pl.nextItem && (
                    <p className="text-[10px] mt-2" style={{ color: 'var(--gem-dim)' }}>
                      Próximo: <span style={{ color: 'var(--gem-muted)' }}>{pl.nextItem.code}</span> — {pl.nextItem.title}
                    </p>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Activity feed */}
      {activity.length > 0 && (
        <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <h3 className="text-xs font-medium mb-3" style={{ color: 'var(--gem-text)' }}>Atividade recente</h3>
          <div className="space-y-1.5">
            {activity.map((entry) => {
              const colors = getFormatColor(entry.format)
              return (
                <div key={entry.id} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors.accent }} />
                  <span style={{ color: 'var(--gem-text)' }}>{entry.code}</span>
                  <span style={{ color: 'var(--gem-muted)' }}>{eventLabel(entry.event_type, entry.to_value)}</span>
                  <span className="ml-auto" style={{ color: 'var(--gem-dim)' }}>{relativeTime(entry.changed_at)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {stats.total === 0 && (
        <div className="rounded-lg border p-8 text-center" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <p className="text-sm mb-3" style={{ color: 'var(--gem-muted)' }}>Pipeline vazio. Crie seu primeiro item.</p>
          <Link href="/cms/pipeline/video" className="text-xs px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--gem-accent)', color: 'white' }}>
            + Novo item
          </Link>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Rewrite the overview page.tsx server component**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/page.tsx
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { PipelineOverview } from './_components/pipeline-overview'
import { WORKFLOWS } from '@/lib/pipeline/workflows'
import type { Format } from '@/lib/pipeline/schemas'

export const dynamic = 'force-dynamic'

export default async function PipelineOverviewPage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const [statsRes, nextToRecordRes, topPriorityRes, playlistsRes, activityRes] = await Promise.all([
    supabase.from('content_pipeline').select('id, format, stage, priority, is_archived', { count: 'exact' }).eq('site_id', siteId).eq('is_archived', false),
    supabase.from('content_pipeline').select('id, code, title_pt, format, priority, updated_at').eq('site_id', siteId).eq('is_archived', false).not('body_content', 'is', null).in('stage', ['roteiro', 'draft', 'outline']).order('priority', { ascending: false }).order('updated_at', { ascending: true }).limit(3),
    supabase.from('content_pipeline').select('id, code, title_pt, format, priority, stage, updated_at').eq('site_id', siteId).eq('is_archived', false).gte('priority', 4).not('stage', 'in', '(scheduled,published,sent)').order('priority', { ascending: false }).limit(5),
    supabase.from('content_collections').select(`id, code, name, description, type, content_pipeline_memberships(role, content_pipeline(id, code, title_pt, stage))`).eq('site_id', siteId).eq('type', 'playlist').order('position'),
    supabase.from('content_pipeline_history').select('id, event_type, to_value, changed_at, pipeline_id, content_pipeline(code, format)').eq('content_pipeline.site_id', siteId).order('changed_at', { ascending: false }).limit(5),
  ])

  const allItems = statsRes.data ?? []
  const finalStages = new Set(['published', 'scheduled', 'sent'])
  const stats = {
    total: allItems.length,
    inProgress: allItems.filter((i) => !finalStages.has(i.stage)).length,
    highPriority: allItems.filter((i) => i.priority >= 4).length,
    scriptsReady: allItems.filter((i) => ['roteiro', 'draft', 'outline'].includes(i.stage)).length,
    published: allItems.filter((i) => finalStages.has(i.stage)).length,
  }

  const recommendations = {
    nextToRecord: (nextToRecordRes.data ?? []).map((i) => ({
      id: i.id, code: i.code, title_pt: i.title_pt, format: i.format, priority: i.priority, updated_at: i.updated_at,
    })),
    topPriority: (topPriorityRes.data ?? []).map((i) => ({
      id: i.id, code: i.code, title_pt: i.title_pt, format: i.format, priority: i.priority, stage: i.stage, updated_at: i.updated_at,
    })),
  }

  const playlists = (playlistsRes.data ?? []).map((pl) => {
    const members = (pl.content_pipeline_memberships ?? []) as Array<{ role: string | null; content_pipeline: { id: string; code: string; title_pt: string | null; stage: string } | null }>
    const validMembers = members.filter((m) => m.content_pipeline)
    const pastIdea = validMembers.filter((m) => m.content_pipeline!.stage !== 'idea').length
    const firstNonIdea = validMembers.find((m) => m.content_pipeline!.stage !== 'idea')
    return {
      id: pl.id,
      code: pl.code,
      name: pl.name ?? pl.code,
      description: pl.description ?? null,
      progress: pastIdea,
      total: validMembers.length,
      nextItem: firstNonIdea?.content_pipeline ? { code: firstNonIdea.content_pipeline.code, title: firstNonIdea.content_pipeline.title_pt ?? 'Untitled' } : null,
    }
  })

  const activity = (activityRes.data ?? [])
    .filter((h: any) => h.content_pipeline)
    .map((h: any) => ({
      id: h.id,
      code: h.content_pipeline.code,
      format: h.content_pipeline.format,
      event_type: h.event_type,
      to_value: h.to_value,
      changed_at: h.changed_at,
    }))

  return (
    <>
      <CmsTopbar title="Pipeline Overview" />
      <div className="p-6 gem-pipeline-theme" style={Object.entries({
        '--gem-surface': '#161d2d', '--gem-surface-hi': '#1a2236', '--gem-border': '#222d40',
        '--gem-well': '#0c1222', '--gem-text': '#edf2f7', '--gem-muted': '#7a8ba3',
        '--gem-dim': '#4a5568', '--gem-faint': '#2a3650', '--gem-done': '#10b981',
        '--gem-warn': '#f59e0b', '--gem-danger': '#ef4444', '--gem-accent': '#6366f1',
      }).reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {} as React.CSSProperties)}>
        <PipelineOverview stats={stats} recommendations={recommendations} playlists={playlists} activity={activity} />
      </div>
    </>
  )
}
```

- [ ] **Step 5: Delete pipeline-overview-cards.tsx**

```bash
rm apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview-cards.tsx
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/pipeline-overview.test.tsx`
Expected: ALL PASS

- [ ] **Step 7: Run full pipeline test suite**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/`
Expected: ALL PASS (no regressions from removing pipeline-overview-cards)

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx apps/web/src/app/cms/(authed)/pipeline/page.tsx apps/web/test/app/cms/pipeline/pipeline-overview.test.tsx
git rm apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview-cards.tsx
git commit -m "feat(pipeline): add overview dashboard with KPIs, recommendations, playlists, activity feed"
```

---

## Task 7: Board Rewrite with Gem Cards + Filters

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-board.tsx`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/[format]/page.tsx`
- Remove: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-card.tsx`

- [ ] **Step 1: Rewrite pipeline-board.tsx to use GemCard + FilterBar**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-board.tsx
'use client'

import { WORKFLOWS } from '@/lib/pipeline/workflows'
import { GemCard, type GemCardItem } from './gem-card'
import { PipelineFilterBar } from './pipeline-filter-bar'
import type { Format } from '@/lib/pipeline/schemas'
import { useSearchParams } from 'next/navigation'

interface PipelineBoardProps {
  format: Format
  items: GemCardItem[]
  collections: Array<{ code: string; name: string }>
}

export function PipelineBoard({ format, items, collections }: PipelineBoardProps) {
  const stages = WORKFLOWS[format]
  const searchParams = useSearchParams()

  const collectionFilter = searchParams.get('collection')
  const langFilter = searchParams.get('lang')
  const priorityFilter = searchParams.get('priority')

  const filtered = items.filter((item) => {
    if (collectionFilter && item.collection_code !== collectionFilter) return false
    if (langFilter && item.language !== langFilter) return false
    if (priorityFilter && item.priority !== Number(priorityFilter)) return false
    return true
  })

  const itemsByStage = stages.reduce<Record<string, GemCardItem[]>>((acc, stage) => {
    acc[stage.stage] = filtered.filter((i) => i.stage === stage.stage)
    return acc
  }, {})

  return (
    <div>
      <PipelineFilterBar collections={collections} />
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[calc(100vh-14rem)]">
        {stages.map((stage) => (
          <div key={stage.stage} className="flex-shrink-0 w-72">
            <div className="sticky top-0 pb-2 z-10" style={{ backgroundColor: 'var(--gem-well)' }}>
              <div className="flex items-center justify-between px-2 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--gem-surface)', borderLeft: '3px solid var(--gem-accent)' }}>
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--gem-muted)' }}>{stage.label_pt}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--gem-border)', color: 'var(--gem-dim)' }}>
                  {itemsByStage[stage.stage]?.length ?? 0}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              {itemsByStage[stage.stage]?.map((item) => (
                <GemCard key={item.id} item={item} />
              ))}
              {(itemsByStage[stage.stage]?.length ?? 0) === 0 && (
                <p className="text-[10px] text-center py-8" style={{ color: 'var(--gem-faint)' }}>Nenhum em {stage.label_pt}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update [format]/page.tsx to fetch enriched data for GemCard**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/[format]/page.tsx
import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { FORMATS, type Format } from '@/lib/pipeline/schemas'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { PipelineBoard } from '../_components/pipeline-board'
import { GEM_CSS_VARS } from '@/lib/pipeline/gem-design'
import { computeValidationScore } from '@/lib/pipeline/validation'

export const dynamic = 'force-dynamic'

export default async function FormatBoardPage({ params }: { params: Promise<{ format: string }> }) {
  const { format } = await params
  if (!FORMATS.includes(format as Format)) notFound()

  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const [itemsRes, collectionsRes] = await Promise.all([
    supabase
      .from('content_pipeline')
      .select(`
        id, code, title_pt, title_en, stage, priority, language, tags,
        production_checklist, version, format, hook, body_content, updated_at,
        youtube_video_id, blog_post_id, newsletter_edition_id, campaign_id,
        is_archived, format_metadata,
        content_pipeline_memberships(role, content_collections(code, name)),
        pipeline_dependencies:content_pipeline_dependencies!pipeline_id(dependency_type, depends_on_pipeline:depends_on_id(code))
      `)
      .eq('site_id', siteId)
      .eq('format', format)
      .eq('is_archived', false)
      .order('priority', { ascending: false })
      .order('updated_at', { ascending: false }),
    supabase
      .from('content_collections')
      .select('code, name')
      .eq('site_id', siteId)
      .eq('type', 'playlist'),
  ])

  const boardItems = (itemsRes.data ?? []).map((item: any) => {
    const memberships = item.content_pipeline_memberships ?? []
    let collectionCode: string | null = null
    for (const m of memberships) {
      const col = Array.isArray(m.content_collections) ? m.content_collections[0] : m.content_collections
      if (col?.code) { collectionCode = col.code; break }
    }

    const score = computeValidationScore({
      title_pt: item.title_pt,
      title_en: item.title_en,
      hook: item.hook,
      synopsis: null,
      body_content: item.body_content,
      tags: item.tags ?? [],
      production_checklist: item.production_checklist ?? [],
      format_metadata: item.format_metadata ?? {},
      memberships_count: memberships.length,
      format: item.format as Format,
    })

    return {
      id: item.id,
      code: item.code,
      title_pt: item.title_pt,
      title_en: item.title_en,
      format: item.format,
      stage: item.stage,
      language: item.language,
      priority: item.priority,
      hook: item.hook,
      body_content: item.body_content,
      tags: item.tags ?? [],
      production_checklist: item.production_checklist ?? [],
      updated_at: item.updated_at,
      youtube_video_id: item.youtube_video_id,
      blog_post_id: item.blog_post_id,
      newsletter_edition_id: item.newsletter_edition_id,
      campaign_id: item.campaign_id,
      is_archived: item.is_archived,
      validation_score: score.overall,
      dependencies: item.pipeline_dependencies ?? [],
      collection_code: collectionCode,
    }
  })

  const collections = (collectionsRes.data ?? []).map((c: any) => ({ code: c.code, name: c.name ?? c.code }))

  const labels: Record<string, string> = {
    video: 'Video', blog_post: 'Blog', newsletter: 'Newsletter', course: 'Course', campaign: 'Campaign',
  }

  return (
    <>
      <CmsTopbar title={`Pipeline: ${labels[format]}`} />
      <div className="p-4 gem-pipeline-theme" style={GEM_CSS_VARS as React.CSSProperties}>
        <PipelineBoard format={format as Format} items={boardItems} collections={collections} />
      </div>
    </>
  )
}
```

- [ ] **Step 3: Delete pipeline-card.tsx**

```bash
rm apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-card.tsx
```

- [ ] **Step 4: Run existing board tests**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/pipeline-board.test.ts`
Expected: PASS (or update test to match new props — if test imports PipelineCard, it needs updating)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-board.tsx apps/web/src/app/cms/(authed)/pipeline/\[format\]/page.tsx
git rm apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-card.tsx
git commit -m "feat(pipeline): rewrite board with GemCards, filter bar, enriched data"
```

---

## Task 8: Item Detail Rewrite

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/items/[id]/page.tsx`

- [ ] **Step 1: Rewrite pipeline-item-detail.tsx with split layout**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { updatePipelineItem, advancePipelineItem, retreatPipelineItem, archivePipelineItem, restorePipelineItem, toggleChecklist } from '../actions'
import { WORKFLOWS } from '@/lib/pipeline/workflows'
import { getPriorityConfig, getStaleness, getFormatIcon, getLangConfig, getChecklistProgress, getVvsTier } from '@/lib/pipeline/gem-design'
import { GemVvsRing } from './gem-vvs-ring'
import type { Format } from '@/lib/pipeline/schemas'

interface ChecklistItem { label: string; done: boolean; toggled_at: string | null }
interface HistoryEntry { id: string; event_type: string; from_value: string | null; to_value: string | null; changed_at: string }
interface Collection { id: string; code: string; name: string; type: string }
interface Dependency { dependency_type: string; depends_on_pipeline: { code: string } }

interface ItemData {
  id: string
  code: string
  title_pt: string | null
  title_en: string | null
  format: string
  stage: string
  language: string
  priority: number
  hook: string | null
  synopsis: string | null
  body_content: string | null
  tags: string[]
  production_checklist: ChecklistItem[]
  format_metadata: Record<string, unknown>
  version: number
  is_archived: boolean
  updated_at: string
  validation_score: number
}

interface Props {
  item: ItemData
  collections: Collection[]
  history: HistoryEntry[]
  dependencies: Dependency[]
}

export function PipelineItemDetail({ item: initialItem, collections, history, dependencies }: Props) {
  const router = useRouter()
  const [item, setItem] = useState(initialItem)
  const [titlePt, setTitlePt] = useState(item.title_pt || '')
  const [hook, setHook] = useState(item.hook || '')
  const [synopsis, setSynopsis] = useState(item.synopsis || '')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const stages = WORKFLOWS[item.format as Format] || []
  const currentStage = stages.find((s) => s.stage === item.stage)
  const currentPosition = currentStage?.position ?? 0
  const priority = getPriorityConfig(item.priority)
  const staleness = getStaleness(item.updated_at)
  const formatIcon = getFormatIcon(item.format)
  const lang = getLangConfig(item.language)
  const checklist = getChecklistProgress(item.production_checklist)

  const debouncedSave = useCallback((field: string, value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const result = await updatePipelineItem(item.id, item.version, { [field]: value || null })
      if (result.ok && result.data) setItem(result.data)
      else if (!result.ok) {
        if (result.error.includes('Version conflict')) {
          toast.error('Item atualizado por outro processo. Recarregando...')
          router.refresh()
        } else {
          toast.error('Erro ao salvar. Tente novamente.')
        }
      }
    }, 500)
  }, [item.id, item.version, router])

  async function handleAdvance() {
    const result = await advancePipelineItem(item.id, item.version)
    if (result.ok) { toast.success('Stage avançado'); router.refresh() }
    else toast.error(result.error)
  }

  async function handleRetreat() {
    const result = await retreatPipelineItem(item.id, item.version)
    if (result.ok) { toast.success('Stage recuado'); router.refresh() }
    else toast.error(result.error)
  }

  async function handleArchive() {
    if (!confirm('Arquivar este item?')) return
    const result = await archivePipelineItem(item.id)
    if (result.ok) { toast.success('Arquivado'); router.push(`/cms/pipeline/${item.format}`) }
    else toast.error(result.error)
  }

  async function handleRestore() {
    const result = await restorePipelineItem(item.id)
    if (result.ok) { toast.success('Restaurado'); router.refresh() }
    else toast.error(result.error)
  }

  async function handleToggleChecklist(index: number, done: boolean) {
    const result = await toggleChecklist(item.id, index, done)
    if (result.ok && result.data) setItem(result.data)
  }

  return (
    <div className="flex gap-6 p-6">
      {/* Content area */}
      <div className="flex-1 space-y-4 min-w-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--gem-dim)' }}>
          <Link href="/cms/pipeline" className="hover:underline">Pipeline</Link>
          <span>/</span>
          <Link href={`/cms/pipeline/${item.format}`} className="hover:underline">{formatIcon.label}</Link>
          <span>/</span>
          <span style={{ color: 'var(--gem-muted)' }}>{item.code}</span>
        </div>

        {/* Title editable */}
        <input
          type="text"
          value={titlePt}
          onChange={(e) => { setTitlePt(e.target.value); debouncedSave('title_pt', e.target.value) }}
          placeholder="Título (PT)"
          className="w-full px-3 py-2 rounded-lg text-lg font-semibold bg-transparent border border-transparent hover:border-[var(--gem-border)] focus:border-[var(--gem-accent)] focus:outline-none transition-colors"
          style={{ color: 'var(--gem-text)' }}
        />

        {/* Hook editable */}
        <input
          type="text"
          value={hook}
          onChange={(e) => { setHook(e.target.value); debouncedSave('hook', e.target.value) }}
          placeholder="Hook"
          className="w-full px-3 py-1.5 rounded-lg text-sm bg-transparent border border-transparent hover:border-[var(--gem-border)] focus:border-[var(--gem-accent)] focus:outline-none transition-colors"
          style={{ color: 'var(--gem-muted)', borderLeft: `2px solid ${priority.accent}` }}
        />

        {/* Synopsis editable */}
        <textarea
          value={synopsis}
          onChange={(e) => { setSynopsis(e.target.value); debouncedSave('synopsis', e.target.value) }}
          placeholder="Synopsis"
          rows={3}
          className="w-full px-3 py-2 rounded-lg text-sm bg-transparent border border-transparent hover:border-[var(--gem-border)] focus:border-[var(--gem-accent)] focus:outline-none transition-colors resize-y"
          style={{ color: 'var(--gem-muted)' }}
        />

        {/* Body content (read-only preview) */}
        {item.body_content && (
          <div className="rounded-lg border p-4 max-h-64 overflow-y-auto" style={{ backgroundColor: 'var(--gem-well)', borderColor: 'var(--gem-border)' }}>
            <pre className="text-xs whitespace-pre-wrap font-mono" style={{ color: 'var(--gem-muted)' }}>
              {item.body_content.slice(0, 2000)}
              {item.body_content.length > 2000 && '...'}
            </pre>
          </div>
        )}
        <Link
          href={`/cms/pipeline/items/${item.id}/edit`}
          className="inline-flex text-xs px-3 py-1.5 rounded-lg border"
          style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-muted)' }}
        >
          Editar roteiro
        </Link>
      </div>

      {/* Sidebar */}
      <div className="w-72 shrink-0 space-y-3">
        {/* Stage card */}
        <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: priority.accentDim, color: priority.accent }}>
              {currentStage?.label_pt || item.stage}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>há {staleness.days}d</span>
          </div>
          {/* Stage timeline */}
          <div className="flex gap-1 mb-3">
            {stages.map((s) => (
              <div
                key={s.stage}
                className="h-1.5 flex-1 rounded-sm"
                style={{
                  backgroundColor: s.position < currentPosition ? 'var(--gem-done)' : s.position === currentPosition ? priority.accent : 'transparent',
                  border: s.position > currentPosition ? '1px dashed var(--gem-border)' : 'none',
                }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleRetreat} className="flex-1 text-xs py-1.5 rounded border" style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-muted)' }}>Retreat</button>
            <button onClick={handleAdvance} className="flex-1 text-xs py-1.5 rounded" style={{ backgroundColor: 'var(--gem-done)', color: 'white' }}>Advance</button>
          </div>
          {item.is_archived ? (
            <button onClick={handleRestore} className="w-full mt-2 text-xs py-1.5 rounded border" style={{ borderColor: 'var(--gem-done)', color: 'var(--gem-done)' }}>Restore</button>
          ) : (
            <button onClick={handleArchive} className="w-full mt-2 text-xs py-1.5 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>Archive</button>
          )}
        </div>

        {/* Checklist card */}
        <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--gem-text)' }}>Checklist</h3>
          <div className="space-y-1.5">
            {item.production_checklist.map((c, i) => (
              <label key={i} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={c.done}
                  onChange={(e) => handleToggleChecklist(i, e.target.checked)}
                  className="rounded border-slate-600 w-3.5 h-3.5"
                />
                <span className={`text-xs ${c.done ? 'line-through' : ''}`} style={{ color: c.done ? 'var(--gem-dim)' : 'var(--gem-muted)' }}>{c.label}</span>
              </label>
            ))}
          </div>
          {/* Segmented bar */}
          <div className="flex gap-0.5 mt-3">
            {checklist.segments.map((done, i) => (
              <div key={i} className="h-1 flex-1 rounded-sm" style={{ backgroundColor: done ? 'var(--gem-done)' : 'var(--gem-well)', boxShadow: done ? '0 0 4px rgba(16,185,129,0.3)' : 'none' }} />
            ))}
          </div>
          <p className="text-[10px] mt-1" style={{ color: 'var(--gem-dim)' }}>{checklist.done}/{checklist.total}</p>
        </div>

        {/* VVS card */}
        <div className="rounded-lg border p-4 flex items-center gap-3" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <GemVvsRing score={item.validation_score} size={48} />
          <div>
            <p className="text-xs font-medium" style={{ color: 'var(--gem-text)' }}>VVS Score</p>
            <p className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>Validation completeness</p>
          </div>
        </div>

        {/* Details card */}
        <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--gem-text)' }}>Details</h3>
          <dl className="space-y-1.5 text-xs">
            <div className="flex justify-between"><dt style={{ color: 'var(--gem-dim)' }}>Format</dt><dd className="flex items-center gap-1"><span>{formatIcon.icon}</span><span style={{ color: 'var(--gem-muted)' }}>{formatIcon.label}</span></dd></div>
            <div className="flex justify-between"><dt style={{ color: 'var(--gem-dim)' }}>Language</dt><dd><span className={`text-[10px] px-1 py-0.5 rounded ${lang.className}`}>{lang.label}</span></dd></div>
            <div className="flex justify-between"><dt style={{ color: 'var(--gem-dim)' }}>Priority</dt><dd><span className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: priority.accentDim, color: priority.accent }}>{priority.label}</span></dd></div>
            <div className="flex justify-between"><dt style={{ color: 'var(--gem-dim)' }}>Version</dt><dd style={{ color: 'var(--gem-muted)' }}>{item.version}</dd></div>
          </dl>
          {item.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.tags.map((tag) => <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/50 text-cyan-300">{tag}</span>)}
            </div>
          )}
          {collections.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {collections.map((c) => <span key={c.id} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300">{c.name}</span>)}
            </div>
          )}
          {dependencies.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] mb-1" style={{ color: 'var(--gem-dim)' }}>Dependencies:</p>
              {dependencies.map((d, i) => (
                <span key={i} className="text-[10px] px-1 py-0.5 rounded bg-red-900/30 text-red-300 mr-1">{d.depends_on_pipeline.code}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update items/[id]/page.tsx to fetch deps and compute validation**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/items/[id]/page.tsx
import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { PipelineItemDetail } from '../../_components/pipeline-item-detail'
import { computeValidationScore } from '@/lib/pipeline/validation'
import { GEM_CSS_VARS } from '@/lib/pipeline/gem-design'
import type { Format } from '@/lib/pipeline/schemas'

export const dynamic = 'force-dynamic'

export default async function PipelineItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const [itemRes, historyRes, membershipsRes, depsRes] = await Promise.all([
    supabase.from('content_pipeline').select('*').eq('id', id).eq('site_id', siteId).single(),
    supabase.from('content_pipeline_history').select('*').eq('pipeline_id', id).order('changed_at', { ascending: false }).limit(20),
    supabase.from('content_pipeline_memberships').select('collection_id, content_collections(id, code, name, type)').eq('pipeline_id', id),
    supabase.from('content_pipeline_dependencies').select('dependency_type, depends_on_pipeline:depends_on_id(code)').eq('pipeline_id', id),
  ])

  if (itemRes.error || !itemRes.data) notFound()
  const item = itemRes.data

  const collections = (membershipsRes.data ?? []).map((m: any) => m.content_collections).filter(Boolean)
  const dependencies = (depsRes.data ?? []) as Array<{ dependency_type: string; depends_on_pipeline: { code: string } }>

  const score = computeValidationScore({
    title_pt: item.title_pt,
    title_en: item.title_en,
    hook: item.hook,
    synopsis: item.synopsis,
    body_content: item.body_content,
    tags: item.tags ?? [],
    production_checklist: item.production_checklist ?? [],
    format_metadata: item.format_metadata ?? {},
    memberships_count: collections.length,
    format: item.format as Format,
  })

  const enrichedItem = { ...item, validation_score: score.overall }

  return (
    <>
      <CmsTopbar title={item.title_pt || item.title_en || item.code} />
      <div className="gem-pipeline-theme" style={GEM_CSS_VARS as React.CSSProperties}>
        <PipelineItemDetail item={enrichedItem} collections={collections} history={historyRes.data ?? []} dependencies={dependencies} />
      </div>
    </>
  )
}
```

- [ ] **Step 3: Run existing detail tests**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/pipeline-item-detail.test.ts`
Expected: Tests may need updating due to new props (dependencies, validation_score). Update if needed.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx apps/web/src/app/cms/(authed)/pipeline/items/\[id\]/page.tsx
git commit -m "feat(pipeline): rewrite item detail with split layout, VVS ring, stage timeline"
```

---

## Task 9: Body Content Edit Page

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/items/[id]/edit/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-body-editor.tsx`
- Test: `apps/web/test/app/cms/pipeline/pipeline-body-editor.test.tsx`

- [ ] **Step 1: Write failing test for body editor**

```typescript
// apps/web/test/app/cms/pipeline/pipeline-body-editor.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PipelineBodyEditor } from '@/app/cms/(authed)/pipeline/_components/pipeline-body-editor'

vi.mock('../actions', () => ({
  updatePipelineItem: vi.fn().mockResolvedValue({ ok: true, data: { version: 2 } }),
}))

describe('PipelineBodyEditor', () => {
  it('renders textarea with initial content', () => {
    render(<PipelineBodyEditor itemId="1" version={1} initialContent="Hello world" format="video" code="vid-test" />)
    const textarea = screen.getByRole('textbox')
    expect((textarea as HTMLTextAreaElement).value).toBe('Hello world')
  })

  it('shows save indicator', () => {
    render(<PipelineBodyEditor itemId="1" version={1} initialContent="" format="video" code="vid-test" />)
    expect(screen.getByText('Salvo')).toBeDefined()
  })

  it('renders cancel link back to detail', () => {
    render(<PipelineBodyEditor itemId="1" version={1} initialContent="" format="video" code="vid-test" />)
    const cancelLink = screen.getByText('Cancelar')
    expect(cancelLink.getAttribute('href')).toBe('/cms/pipeline/items/1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/pipeline-body-editor.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PipelineBodyEditor**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-body-editor.tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { updatePipelineItem } from '../actions'

interface Props {
  itemId: string
  version: number
  initialContent: string
  format: string
  code: string
}

export function PipelineBodyEditor({ itemId, version: initialVersion, initialContent, format, code }: Props) {
  const [content, setContent] = useState(initialContent)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [currentVersion, setCurrentVersion] = useState(initialVersion)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const save = useCallback(async (text: string) => {
    setSaveState('saving')
    const result = await updatePipelineItem(itemId, currentVersion, { body_content: text })
    if (result.ok && result.data) {
      setCurrentVersion(result.data.version)
      setSaveState('saved')
    } else if (!result.ok) {
      setSaveState('error')
      if (result.error.includes('Version conflict')) {
        toast.error('Item atualizado por outro processo. Recarregando...')
      } else {
        toast.error('Erro ao salvar')
      }
    }
  }, [itemId, currentVersion])

  function handleChange(value: string) {
    setContent(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(value), 2000)
  }

  function handleManualSave() {
    if (timerRef.current) clearTimeout(timerRef.current)
    save(content)
  }

  const stateLabel = saveState === 'saved' ? 'Salvo' : saveState === 'saving' ? 'Salvando...' : 'Erro ao salvar'
  const stateColor = saveState === 'saved' ? 'var(--gem-done)' : saveState === 'saving' ? 'var(--gem-warn)' : 'var(--gem-danger)'

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: 'var(--gem-border)' }}>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--gem-dim)' }}>
          <Link href="/cms/pipeline" className="hover:underline">Pipeline</Link>
          <span>/</span>
          <Link href={`/cms/pipeline/${format}`} className="hover:underline">{format}</Link>
          <span>/</span>
          <span>{code}</span>
          <span>/</span>
          <span style={{ color: 'var(--gem-muted)' }}>Edit</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px]" style={{ color: stateColor }}>{stateLabel}</span>
          <button onClick={handleManualSave} className="text-xs px-3 py-1 rounded" style={{ backgroundColor: 'var(--gem-accent)', color: 'white' }}>
            Salvar
          </button>
          <Link href={`/cms/pipeline/items/${itemId}`} className="text-xs px-3 py-1 rounded border" style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-muted)' }}>
            Cancelar
          </Link>
        </div>
      </div>

      {/* Editor */}
      <textarea
        role="textbox"
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        className="flex-1 w-full p-6 resize-none font-mono text-sm focus:outline-none"
        style={{ backgroundColor: 'var(--gem-well)', color: 'var(--gem-text)', minHeight: '60vh' }}
        placeholder="Escreva o roteiro / body content aqui..."
      />
    </div>
  )
}
```

- [ ] **Step 4: Create edit page server component**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/items/[id]/edit/page.tsx
import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { PipelineBodyEditor } from '../../../_components/pipeline-body-editor'
import { GEM_CSS_VARS } from '@/lib/pipeline/gem-design'

export const dynamic = 'force-dynamic'

export default async function PipelineEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const { data: item, error } = await supabase
    .from('content_pipeline')
    .select('id, code, format, body_content, version')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (error || !item) notFound()

  return (
    <div className="gem-pipeline-theme h-full" style={GEM_CSS_VARS as React.CSSProperties}>
      <PipelineBodyEditor
        itemId={item.id}
        version={item.version}
        initialContent={item.body_content ?? ''}
        format={item.format}
        code={item.code}
      />
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/pipeline-body-editor.test.tsx`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/items/\[id\]/edit/page.tsx apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-body-editor.tsx apps/web/test/app/cms/pipeline/pipeline-body-editor.test.tsx
git commit -m "feat(pipeline): add body content edit page with auto-save"
```

---

## Task 10: List Table Gem Styling

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-list-table.tsx`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/list/page.tsx` (if exists, otherwise the list is rendered elsewhere)

- [ ] **Step 1: Rewrite pipeline-list-table.tsx with gem styling**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-list-table.tsx
'use client'

import Link from 'next/link'
import { getFormatIcon, getPriorityConfig, getLangConfig, getChecklistProgress } from '@/lib/pipeline/gem-design'
import { GemVvsRing } from './gem-vvs-ring'

interface ListItem {
  id: string
  code: string
  title_pt: string | null
  title_en: string | null
  format: string
  stage: string
  priority: number
  language: string
  updated_at: string
  production_checklist: Array<{ label: string; done: boolean }>
  validation_score: number
}

export function PipelineListTable({ items }: { items: ListItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b" style={{ borderColor: 'var(--gem-border)' }}>
            <th className="pb-2 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--gem-dim)' }}>Code</th>
            <th className="pb-2 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--gem-dim)' }}>Title</th>
            <th className="pb-2 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--gem-dim)' }}>Format</th>
            <th className="pb-2 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--gem-dim)' }}>Stage</th>
            <th className="pb-2 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--gem-dim)' }}>Priority</th>
            <th className="pb-2 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--gem-dim)' }}>Lang</th>
            <th className="pb-2 text-center text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--gem-dim)' }}>VVS</th>
            <th className="pb-2 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--gem-dim)' }}>Checklist</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const formatIcon = getFormatIcon(item.format)
            const priority = getPriorityConfig(item.priority)
            const lang = getLangConfig(item.language)
            const checklist = getChecklistProgress(item.production_checklist)
            return (
              <tr key={item.id} className="border-b hover:bg-white/[0.02] transition-colors" style={{ borderColor: 'var(--gem-border)' }}>
                <td className="py-2.5">
                  <Link href={`/cms/pipeline/items/${item.id}`} className="font-mono text-[10px] hover:underline" style={{ color: priority.accent }}>
                    {item.code}
                  </Link>
                </td>
                <td className="py-2.5">
                  <span className="text-xs" style={{ color: 'var(--gem-text)' }}>{item.title_pt || item.title_en || '—'}</span>
                </td>
                <td className="py-2.5">
                  <span className="text-xs">{formatIcon.icon}</span>
                </td>
                <td className="py-2.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--gem-well)', color: 'var(--gem-muted)' }}>{item.stage}</span>
                </td>
                <td className="py-2.5">
                  <span className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: priority.accentDim, color: priority.accent }}>{priority.label}</span>
                </td>
                <td className="py-2.5">
                  <span className={`text-[10px] px-1 py-0.5 rounded ${lang.className}`}>{lang.label}</span>
                </td>
                <td className="py-2.5 text-center">
                  <GemVvsRing score={item.validation_score} size={20} />
                </td>
                <td className="py-2.5">
                  <div className="flex gap-0.5 w-16">
                    {checklist.segments.map((done, i) => (
                      <div key={i} className="h-1 flex-1 rounded-sm" style={{ backgroundColor: done ? 'var(--gem-done)' : 'var(--gem-well)' }} />
                    ))}
                  </div>
                </td>
              </tr>
            )
          })}
          {items.length === 0 && (
            <tr><td colSpan={8} className="py-8 text-center text-xs" style={{ color: 'var(--gem-faint)' }}>No items found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Run existing tests**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-list-table.tsx
git commit -m "feat(pipeline): restyle list table with gem design system"
```

---

## Task 11: Collections Gem Styling

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/collection-manager.tsx`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/collection-detail.tsx`

- [ ] **Step 1: Rewrite collection-manager.tsx with progress bars and gem styling**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/collection-manager.tsx
'use client'

import Link from 'next/link'

interface CollectionData {
  id: string
  code: string
  name: string
  type: string
  description: string | null
  memberCount: number
  progress: number
  nextItem: { code: string; title: string } | null
}

export function CollectionManager({ collections }: { collections: CollectionData[] }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
      {collections.map((c) => {
        const progressPct = c.memberCount > 0 ? Math.round((c.progress / c.memberCount) * 100) : 0
        return (
          <Link
            key={c.id}
            href={`/cms/pipeline/collections/${c.id}`}
            className="block rounded-lg border p-4 transition-all hover:brightness-110"
            style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono" style={{ color: 'var(--gem-muted)' }}>{c.code}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--gem-well)', color: 'var(--gem-dim)' }}>{c.type}</span>
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--gem-text)' }}>{c.name}</p>
            {c.description && (
              <p className="text-[10px] line-clamp-2 mb-2" style={{ color: 'var(--gem-muted)' }}>{c.description}</p>
            )}
            <div className="flex items-center gap-2 mb-1">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--gem-well)' }}>
                <div className="h-full rounded-full" style={{ width: `${progressPct}%`, backgroundColor: 'var(--gem-done)', boxShadow: '0 0 4px rgba(16,185,129,0.3)' }} />
              </div>
              <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>{c.progress}/{c.memberCount}</span>
            </div>
            {c.nextItem && (
              <p className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>
                Próximo: <span style={{ color: 'var(--gem-muted)' }}>{c.nextItem.code}</span> — {c.nextItem.title}
              </p>
            )}
          </Link>
        )
      })}
      {collections.length === 0 && (
        <p className="text-xs col-span-full" style={{ color: 'var(--gem-faint)' }}>No collections yet</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Rewrite collection-detail.tsx to use GemCard**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/collection-detail.tsx
'use client'

import { GemCard, type GemCardItem } from './gem-card'

interface CollectionData {
  id: string
  code: string
  name: string | null
  type: string
  description: string | null
}

interface Props {
  collection: CollectionData
  members: GemCardItem[]
}

export function CollectionDetail({ collection, members }: Props) {
  return (
    <div className="space-y-4">
      {/* Collection header */}
      <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-mono" style={{ color: 'var(--gem-muted)' }}>{collection.code}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--gem-well)', color: 'var(--gem-dim)' }}>{collection.type}</span>
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--gem-text)' }}>{collection.name ?? collection.code}</p>
        {collection.description && (
          <p className="text-xs mt-1" style={{ color: 'var(--gem-muted)' }}>{collection.description}</p>
        )}
        <p className="text-[10px] mt-2" style={{ color: 'var(--gem-dim)' }}>{members.length} items</p>
      </div>

      {/* Members as Gem Cards */}
      <div className="space-y-2">
        {members.map((item) => (
          <GemCard key={item.id} item={item} />
        ))}
      </div>

      {members.length === 0 && (
        <p className="text-xs" style={{ color: 'var(--gem-faint)' }}>No items in this collection</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run tests**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/collection-manager.tsx apps/web/src/app/cms/(authed)/pipeline/_components/collection-detail.tsx
git commit -m "feat(pipeline): restyle collections with gem theme, progress bars, GemCards"
```

---

## Task 12: Navigation Cleanup & Search Removal

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts`
- Remove: `apps/web/src/app/cms/(authed)/pipeline/_components/search-results.tsx`
- Remove: `apps/web/src/app/cms/(authed)/pipeline/search/page.tsx`

- [ ] **Step 1: Remove Search from sidebar nav**

Edit `cms-sections.ts` — remove the Search item from the pipeline section:

```typescript
// apps/web/src/app/cms/(authed)/_shared/cms-sections.ts
import { DEFAULT_SECTIONS, type SidebarSection } from '@tn-figueiredo/cms-ui'

export function buildCmsSections(): SidebarSection[] {
  const sections = DEFAULT_SECTIONS.map(section => {
    if (section.label === 'Content') {
      const items = [
        ...section.items,
        { icon: '🎬', label: 'YouTube', href: '/cms/youtube', minRole: 'editor' as const },
        { icon: '🖼️', label: 'Media', href: '/cms/media', minRole: 'editor' as const },
        { icon: '🔗', label: 'Links', href: '/cms/links', minRole: 'editor' as const },
      ]

      return { ...section, items }
    }
    return section
  })

  const pipelineSection: SidebarSection = {
    label: 'Pipeline',
    items: [
      { icon: '📊', label: 'Overview', href: '/cms/pipeline', minRole: 'editor' as const },
      { icon: '🎬', label: 'Video', href: '/cms/pipeline/video', minRole: 'editor' as const },
      { icon: '✍️', label: 'Blog', href: '/cms/pipeline/blog_post', minRole: 'editor' as const },
      { icon: '📧', label: 'Newsletter', href: '/cms/pipeline/newsletter', minRole: 'editor' as const },
      { icon: '🎓', label: 'Course', href: '/cms/pipeline/course', minRole: 'editor' as const },
      { icon: '📣', label: 'Campaign', href: '/cms/pipeline/campaign', minRole: 'editor' as const },
      { icon: '📁', label: 'Collections', href: '/cms/pipeline/collections', minRole: 'editor' as const },
      { icon: '📝', label: 'Reference', href: '/cms/pipeline/reference', minRole: 'editor' as const },
    ],
  }

  const contentIdx = sections.findIndex(s => s.label === 'Content')
  sections.splice(contentIdx + 1, 0, pipelineSection)
  return sections
}
```

- [ ] **Step 2: Delete search-results.tsx and search/page.tsx**

```bash
rm apps/web/src/app/cms/(authed)/pipeline/_components/search-results.tsx
rm apps/web/src/app/cms/(authed)/pipeline/search/page.tsx
```

- [ ] **Step 3: Run full test suite to verify no regressions**

Run: `cd apps/web && npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/_shared/cms-sections.ts
git rm apps/web/src/app/cms/(authed)/pipeline/_components/search-results.tsx apps/web/src/app/cms/(authed)/pipeline/search/page.tsx
git commit -m "feat(pipeline): remove Search nav item, integrate search into overview"
```

---

## Task 13: Reference Editor Minor Styling

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/reference-editor.tsx`

- [ ] **Step 1: Apply gem theme styling to reference-editor.tsx**

Only minimal changes: replace hardcoded slate colors with gem CSS vars. Keep functionality identical.

Change `border-slate-700` → `border: 1px solid var(--gem-border)`, `bg-slate-800` → `background: var(--gem-surface)`, `text-slate-*` → `color: var(--gem-text/muted/dim)`.

- [ ] **Step 2: Run tests**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/reference-editor.tsx
git commit -m "feat(pipeline): apply gem theme styling to reference editor"
```

---

## Task 14: Full Integration Test & Visual Verification

- [ ] **Step 1: Run the complete test suite**

Run: `cd apps/web && npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Start dev server and visually verify**

Run: `cd apps/web && npm run dev`

Verify in browser:
- `/cms/pipeline` — Overview with KPIs, recommendations, playlists, search, activity
- `/cms/pipeline/video` — Kanban with Gem Cards, filter bar works
- `/cms/pipeline/items/{id}` — Split layout, sidebar cards, inline editing, VVS ring
- `/cms/pipeline/items/{id}/edit` — Full-width editor with auto-save indicator
- `/cms/pipeline/collections` — Cards with progress bars
- `/cms/pipeline/collections/{id}` — Gem Cards for members
- Sidebar nav no longer shows "Search"

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "fix(pipeline): address visual verification issues"
```

- [ ] **Step 5: Run npm test (full project)**

Run: `npm test`
Expected: ALL PASS (both api + web)
