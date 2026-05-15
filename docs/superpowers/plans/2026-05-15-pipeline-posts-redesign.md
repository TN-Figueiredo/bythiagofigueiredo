# Pipeline → Posts Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the CMS Pipeline → Posts flow with a two-zone architecture: Pipeline (Ideia/Rascunho/Pronto) for content ideation, and Posts (Em edição/Agendado/Publicado) for editing, SEO, social, and publication.

**Architecture:** New `/cms/posts` route with tabbed post detail (Conteúdo, Imagens, SEO, Social, Publicação). Pipeline kanban limited to 3 stages for blog_post format. `PostEditorContext` (React Context + useReducer) manages cross-tab dirty state and readiness score. Existing blog hub (`/cms/blog`) preserved for overview/schedule/analytics.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, TypeScript 5, @dnd-kit, TipTap, Supabase, Vitest, Zod, sonner

**Spec:** `docs/superpowers/specs/2026-05-15-pipeline-posts-redesign-design.md`
**Mockups:** `brainstorm/62041-1778807735/content/` (8 screens)

---

## File Structure

### New files

```
apps/web/src/
├── lib/posts/
│   ├── types.ts                          — PostDetail, PostTab, PostSection types
│   └── readiness.ts                      — Readiness score computation (weighted sections)
├── app/cms/(authed)/posts/
│   ├── page.tsx                          — Posts kanban page (server component, fetches posts)
│   ├── actions.ts                        — Server actions: savePostTab, schedulePost, publishPost, returnToPipeline
│   ├── [id]/
│   │   └── page.tsx                      — Post detail page (server component, fetches post + translations)
│   └── _components/
│       ├── post-editor-context.tsx        — React Context + useReducer for cross-tab state
│       ├── post-tab-bar.tsx              — 5-tab navigation with dot indicators + lang toggle
│       ├── section-bar.tsx               — Tab section header: badge + status + dirty indicator + Save button
│       ├── readiness-ring.tsx            — SVG circular progress indicator (reusable)
│       ├── post-detail.tsx               — Post detail container (tabs + sidebar + context provider)
│       ├── posts-board.tsx               — Posts kanban board (dnd-kit, 3 columns)
│       ├── post-card.tsx                 — Posts kanban card (cover thumb, social icons, origin badge)
│       ├── sortable-post-card.tsx        — dnd-kit sortable wrapper for post-card
│       ├── tabs/
│       │   ├── content-tab.tsx           — TipTap editor + cover + title + hook + synopsis
│       │   ├── images-tab.tsx            — Cover + gallery + upload + MediaGalleryDialog
│       │   ├── seo-tab.tsx              — SEO score, SERP preview, meta fields, JSON-LD
│       │   ├── social-tab.tsx           — 4 platform cards, per-lang captions, previews
│       │   └── publish-tab.tsx          — Schedule hero, timeline, distribution, pre-publish review
│       └── sidebar/
│           ├── status-card.tsx           — Stage dots + action buttons (Agendar/Publicar/Devolver)
│           ├── origin-card.tsx           — Pipeline item link (code + format icon)
│           ├── pub-summary-card.tsx      — Quick glance: schedule, social, newsletter, visibility
│           ├── sections-panel.tsx        — Section list with colored completion dots
│           └── post-sidebar.tsx          — Composed sidebar assembling all cards
└── test/
    └── lib/posts/
        ├── readiness.test.ts             — Unit tests for readiness score computation
        └── post-editor-reducer.test.ts   — Unit tests for context reducer
```

### Modified files

```
apps/web/src/
├── lib/pipeline/workflows.ts             — Add PIPELINE_ONLY_STAGES for blog_post (idea/draft/ready)
├── app/cms/(authed)/pipeline/
│   ├── _components/pipeline-board.tsx     — Filter to PIPELINE_ONLY_STAGES for blog_post format
│   └── _components/pipeline-item-detail.tsx — Add "Graduar para Post" button, navigate to /cms/posts/[id]
```

---

## Task 1: Post types and readiness score computation

**Files:**
- Create: `apps/web/src/lib/posts/types.ts`
- Create: `apps/web/src/lib/posts/readiness.ts`
- Test: `apps/web/test/lib/posts/readiness.test.ts`

- [ ] **Step 1: Write the failing test for readiness score**

```typescript
// apps/web/test/lib/posts/readiness.test.ts
import { describe, it, expect } from 'vitest'
import { computeReadiness, type ReadinessInput } from '@/lib/posts/readiness'

describe('computeReadiness', () => {
  const empty: ReadinessInput = {
    content: { titleFilled: false, hookFilled: false, bodyFilled: false },
    images: { coverSet: false },
    seo: { metaTitleFilled: false, metaDescriptionFilled: false, score: 0 },
    social: { platformsConfigured: 0 },
    schedule: { dateSet: false, dateSaved: false },
    newsletter: { decisionMade: false },
  }

  it('returns 0 for completely empty post', () => {
    const result = computeReadiness(empty)
    expect(result.score).toBe(0)
    expect(result.sections.content.status).toBe('empty')
  })

  it('returns 100 for fully complete post', () => {
    const full: ReadinessInput = {
      content: { titleFilled: true, hookFilled: true, bodyFilled: true },
      images: { coverSet: true },
      seo: { metaTitleFilled: true, metaDescriptionFilled: true, score: 85 },
      social: { platformsConfigured: 2 },
      schedule: { dateSet: true, dateSaved: true },
      newsletter: { decisionMade: true },
    }
    const result = computeReadiness(full)
    expect(result.score).toBe(100)
    expect(result.sections.content.status).toBe('done')
  })

  it('assigns correct weights: content=20, images=15, seo=20, social=20, schedule=15, newsletter=10', () => {
    const onlyContent: ReadinessInput = {
      ...empty,
      content: { titleFilled: true, hookFilled: true, bodyFilled: true },
    }
    expect(computeReadiness(onlyContent).score).toBe(20)
  })

  it('treats seo score < 70 as warn, not done', () => {
    const lowSeo: ReadinessInput = {
      ...empty,
      seo: { metaTitleFilled: true, metaDescriptionFilled: true, score: 50 },
    }
    const result = computeReadiness(lowSeo)
    expect(result.sections.seo.status).toBe('warn')
  })

  it('partial content (2 of 3 fields) gives proportional score', () => {
    const partial: ReadinessInput = {
      ...empty,
      content: { titleFilled: true, hookFilled: true, bodyFilled: false },
    }
    const result = computeReadiness(partial)
    // 2/3 * 20 weight = ~13
    expect(result.score).toBeCloseTo(13, 0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/test/lib/posts/readiness.test.ts`
Expected: FAIL — module `@/lib/posts/readiness` not found

- [ ] **Step 3: Create types file**

```typescript
// apps/web/src/lib/posts/types.ts
export type PostTab = 'content' | 'images' | 'seo' | 'social' | 'publish'

export type SectionStatus = 'done' | 'warn' | 'empty'

export interface PostTabMeta {
  tab: PostTab
  labelPt: string
  labelEn: string
}

export const POST_TABS: PostTabMeta[] = [
  { tab: 'content', labelPt: 'Conteúdo', labelEn: 'Content' },
  { tab: 'images', labelPt: 'Imagens', labelEn: 'Images' },
  { tab: 'seo', labelPt: 'SEO', labelEn: 'SEO' },
  { tab: 'social', labelPt: 'Social', labelEn: 'Social' },
  { tab: 'publish', labelPt: 'Publicação', labelEn: 'Publication' },
]

export type PostStage = 'editing' | 'scheduled' | 'published'

export const POST_STAGES: Array<{ stage: PostStage; labelPt: string; dbStatus: string }> = [
  { stage: 'editing', labelPt: 'Em edição', dbStatus: 'draft' },
  { stage: 'scheduled', labelPt: 'Agendado', dbStatus: 'scheduled' },
  { stage: 'published', labelPt: 'Publicado', dbStatus: 'published' },
]

export function dbStatusToStage(status: string): PostStage {
  if (status === 'scheduled') return 'scheduled'
  if (status === 'published') return 'published'
  return 'editing'
}

export interface PostDetailData {
  id: string
  siteId: string
  authorId: string
  status: string
  category: string | null
  coverImageUrl: string | null
  locale: string
  scheduledAt: string | null
  publishedAt: string | null
  socialConfig: import('@/lib/social/types').SocialConfig | null
  includeInNewsletter: boolean
  rssIncluded: boolean
  searchIndexable: boolean
  canonicalUrl: string | null
  translations: PostTranslation[]
  pipelineItem: { id: string; code: string; format: string; stage: string; priority: number } | null
  createdAt: string
  updatedAt: string
}

export interface PostTranslation {
  locale: string
  title: string
  slug: string
  excerpt: string | null
  contentMdx: string | null
  contentJson: Record<string, unknown> | null
  contentHtml: string | null
  metaTitle: string | null
  metaDescription: string | null
  ogImageUrl: string | null
  keyPoints: string[] | null
  pullQuote: string | null
}
```

- [ ] **Step 4: Implement readiness score**

```typescript
// apps/web/src/lib/posts/readiness.ts
import type { SectionStatus, PostTab } from './types'

export interface ReadinessInput {
  content: { titleFilled: boolean; hookFilled: boolean; bodyFilled: boolean }
  images: { coverSet: boolean }
  seo: { metaTitleFilled: boolean; metaDescriptionFilled: boolean; score: number }
  social: { platformsConfigured: number }
  schedule: { dateSet: boolean; dateSaved: boolean }
  newsletter: { decisionMade: boolean }
}

export interface ReadinessSection {
  tab: PostTab | 'schedule' | 'newsletter'
  status: SectionStatus
  weight: number
  earned: number
}

export interface ReadinessResult {
  score: number
  sections: Record<string, ReadinessSection>
}

export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const contentFilled = [input.content.titleFilled, input.content.hookFilled, input.content.bodyFilled]
  const contentRatio = contentFilled.filter(Boolean).length / contentFilled.length
  const contentEarned = Math.round(contentRatio * 20)
  const contentStatus: SectionStatus = contentRatio === 1 ? 'done' : contentRatio > 0 ? 'warn' : 'empty'

  const imagesEarned = input.images.coverSet ? 15 : 0
  const imagesStatus: SectionStatus = input.images.coverSet ? 'done' : 'empty'

  const seoFieldsFilled = [input.seo.metaTitleFilled, input.seo.metaDescriptionFilled].filter(Boolean).length
  const seoFieldRatio = seoFieldsFilled / 2
  const seoScoreOk = input.seo.score >= 70
  const seoComplete = seoFieldRatio === 1 && seoScoreOk
  const seoEarned = seoComplete ? 20 : Math.round(seoFieldRatio * 15)
  const seoStatus: SectionStatus = seoComplete ? 'done' : seoFieldRatio > 0 ? 'warn' : 'empty'

  const socialEarned = input.social.platformsConfigured >= 1 ? 20 : 0
  const socialStatus: SectionStatus = input.social.platformsConfigured >= 1 ? 'done' : 'empty'

  const scheduleEarned = input.schedule.dateSet && input.schedule.dateSaved ? 15 : 0
  const scheduleStatus: SectionStatus = input.schedule.dateSet && input.schedule.dateSaved ? 'done' : input.schedule.dateSet ? 'warn' : 'empty'

  const newsletterEarned = input.newsletter.decisionMade ? 10 : 0
  const newsletterStatus: SectionStatus = input.newsletter.decisionMade ? 'done' : 'empty'

  const score = contentEarned + imagesEarned + seoEarned + socialEarned + scheduleEarned + newsletterEarned

  return {
    score,
    sections: {
      content: { tab: 'content', status: contentStatus, weight: 20, earned: contentEarned },
      images: { tab: 'images', status: imagesStatus, weight: 15, earned: imagesEarned },
      seo: { tab: 'seo', status: seoStatus, weight: 20, earned: seoEarned },
      social: { tab: 'social', status: socialStatus, weight: 20, earned: socialEarned },
      schedule: { tab: 'schedule', status: scheduleStatus, weight: 15, earned: scheduleEarned },
      newsletter: { tab: 'newsletter', status: newsletterStatus, weight: 10, earned: newsletterEarned },
    },
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run apps/web/test/lib/posts/readiness.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/posts/types.ts apps/web/src/lib/posts/readiness.ts apps/web/test/lib/posts/readiness.test.ts
git commit -m "feat(posts): add post types and readiness score computation"
```

---

## Task 2: PostEditorContext (React Context + useReducer)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/posts/_components/post-editor-context.tsx`
- Test: `apps/web/test/lib/posts/post-editor-reducer.test.ts`

- [ ] **Step 1: Write the failing test for the reducer**

```typescript
// apps/web/test/lib/posts/post-editor-reducer.test.ts
import { describe, it, expect } from 'vitest'
import { postEditorReducer, initialState, type PostEditorState } from '@/app/cms/(authed)/posts/_components/post-editor-context'

describe('postEditorReducer', () => {
  it('initializes with all tabs clean', () => {
    const state = initialState({} as PostEditorState['post'])
    expect(state.dirty.content).toBe(false)
    expect(state.dirty.images).toBe(false)
    expect(state.dirty.seo).toBe(false)
    expect(state.dirty.social).toBe(false)
    expect(state.dirty.publish).toBe(false)
  })

  it('SET_DIRTY marks a specific tab dirty', () => {
    const state = initialState({} as PostEditorState['post'])
    const next = postEditorReducer(state, { type: 'SET_DIRTY', tab: 'content', dirty: true })
    expect(next.dirty.content).toBe(true)
    expect(next.dirty.images).toBe(false)
  })

  it('SAVE_TAB clears dirty flag for that tab', () => {
    const state = initialState({} as PostEditorState['post'])
    const dirty = postEditorReducer(state, { type: 'SET_DIRTY', tab: 'seo', dirty: true })
    const saved = postEditorReducer(dirty, { type: 'SAVE_TAB', tab: 'seo' })
    expect(saved.dirty.seo).toBe(false)
  })

  it('SET_ACTIVE_TAB changes active tab', () => {
    const state = initialState({} as PostEditorState['post'])
    const next = postEditorReducer(state, { type: 'SET_ACTIVE_TAB', tab: 'social' })
    expect(next.activeTab).toBe('social')
  })

  it('SET_LOCALE changes active locale', () => {
    const state = initialState({} as PostEditorState['post'])
    const next = postEditorReducer(state, { type: 'SET_LOCALE', locale: 'en' })
    expect(next.activeLocale).toBe('en')
  })

  it('UPDATE_SECTION merges section data', () => {
    const state = initialState({} as PostEditorState['post'])
    const next = postEditorReducer(state, {
      type: 'UPDATE_SECTION',
      tab: 'content',
      data: { title: 'Hello' },
    })
    expect(next.sections.content.title).toBe('Hello')
    expect(next.dirty.content).toBe(true)
  })

  it('hasDirtyTabs returns true when any tab is dirty', () => {
    const state = initialState({} as PostEditorState['post'])
    expect(state.hasDirtyTabs).toBe(false)
    const dirty = postEditorReducer(state, { type: 'SET_DIRTY', tab: 'images', dirty: true })
    expect(dirty.hasDirtyTabs).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/test/lib/posts/post-editor-reducer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the context + reducer**

```typescript
// apps/web/src/app/cms/(authed)/posts/_components/post-editor-context.tsx
'use client'

import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { PostTab } from '@/lib/posts/types'
import type { PostDetailData } from '@/lib/posts/types'

export interface PostEditorState {
  post: PostDetailData
  activeTab: PostTab
  activeLocale: string
  dirty: Record<PostTab, boolean>
  hasDirtyTabs: boolean
  sections: {
    content: Record<string, unknown>
    images: Record<string, unknown>
    seo: Record<string, unknown>
    social: Record<string, unknown>
    publish: Record<string, unknown>
  }
}

export type PostEditorAction =
  | { type: 'SET_ACTIVE_TAB'; tab: PostTab }
  | { type: 'SET_LOCALE'; locale: string }
  | { type: 'SET_DIRTY'; tab: PostTab; dirty: boolean }
  | { type: 'SAVE_TAB'; tab: PostTab }
  | { type: 'UPDATE_SECTION'; tab: PostTab; data: Record<string, unknown> }
  | { type: 'SET_POST'; post: PostDetailData }

const TABS: PostTab[] = ['content', 'images', 'seo', 'social', 'publish']

export function initialState(post: PostDetailData): PostEditorState {
  return {
    post,
    activeTab: 'content',
    activeLocale: post?.locale ?? 'pt-br',
    dirty: { content: false, images: false, seo: false, social: false, publish: false },
    hasDirtyTabs: false,
    sections: {
      content: {},
      images: {},
      seo: {},
      social: {},
      publish: {},
    },
  }
}

export function postEditorReducer(state: PostEditorState, action: PostEditorAction): PostEditorState {
  switch (action.type) {
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.tab }

    case 'SET_LOCALE':
      return { ...state, activeLocale: action.locale }

    case 'SET_DIRTY': {
      const dirty = { ...state.dirty, [action.tab]: action.dirty }
      return { ...state, dirty, hasDirtyTabs: TABS.some(t => dirty[t]) }
    }

    case 'SAVE_TAB': {
      const dirty = { ...state.dirty, [action.tab]: false }
      return { ...state, dirty, hasDirtyTabs: TABS.some(t => dirty[t]) }
    }

    case 'UPDATE_SECTION': {
      const sections = {
        ...state.sections,
        [action.tab]: { ...state.sections[action.tab], ...action.data },
      }
      const dirty = { ...state.dirty, [action.tab]: true }
      return { ...state, sections, dirty, hasDirtyTabs: true }
    }

    case 'SET_POST':
      return { ...state, post: action.post }

    default:
      return state
  }
}

interface PostEditorContextValue {
  state: PostEditorState
  dispatch: React.Dispatch<PostEditorAction>
}

const PostEditorCtx = createContext<PostEditorContextValue | null>(null)

export function PostEditorProvider({ post, children }: { post: PostDetailData; children: ReactNode }) {
  const [state, dispatch] = useReducer(postEditorReducer, post, initialState)
  return <PostEditorCtx.Provider value={{ state, dispatch }}>{children}</PostEditorCtx.Provider>
}

export function usePostEditor(): PostEditorContextValue {
  const ctx = useContext(PostEditorCtx)
  if (!ctx) throw new Error('usePostEditor must be used within PostEditorProvider')
  return ctx
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/test/lib/posts/post-editor-reducer.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/posts/_components/post-editor-context.tsx apps/web/test/lib/posts/post-editor-reducer.test.ts
git commit -m "feat(posts): add PostEditorContext with reducer and dirty-state tracking"
```

---

## Task 3: ReadinessRing SVG component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/posts/_components/readiness-ring.tsx`

- [ ] **Step 1: Implement the ReadinessRing component**

```typescript
// apps/web/src/app/cms/(authed)/posts/_components/readiness-ring.tsx
'use client'

interface ReadinessRingProps {
  score: number
  size?: number
  strokeWidth?: number
}

function getColor(score: number): string {
  if (score >= 80) return 'var(--gem-done, #22c55e)'
  if (score >= 50) return 'var(--gem-warn, #f59e0b)'
  return 'var(--gem-danger, #ef4444)'
}

export function ReadinessRing({ score, size = 48, strokeWidth = 4 }: ReadinessRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const center = size / 2

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Readiness: ${score}%`} role="img">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--gem-border, #1a2030)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={getColor(score)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
        />
      </svg>
      <span
        className="absolute text-[11px] font-bold"
        style={{ color: getColor(score) }}
      >
        {score}%
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -i "readiness-ring" || echo "No type errors"`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/posts/_components/readiness-ring.tsx
git commit -m "feat(posts): add ReadinessRing SVG component"
```

---

## Task 4: SectionBar component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/posts/_components/section-bar.tsx`

- [ ] **Step 1: Implement the SectionBar component**

The section bar appears at the top of each tab with: section badge (teal), status badge, dirty indicator, and Save button (⌘S).

```typescript
// apps/web/src/app/cms/(authed)/posts/_components/section-bar.tsx
'use client'

import type { SectionStatus } from '@/lib/posts/types'

interface SectionBarProps {
  label: string
  status: SectionStatus
  statusText?: string
  isDirty: boolean
  isSaving: boolean
  onSave: () => void
}

const STATUS_COLORS: Record<SectionStatus, { bg: string; text: string }> = {
  done: { bg: 'rgba(34,197,94,0.1)', text: '#22c55e' },
  warn: { bg: 'rgba(245,158,11,0.1)', text: '#f59e0b' },
  empty: { bg: 'rgba(139,148,158,0.1)', text: '#8b949e' },
}

export function SectionBar({ label, status, statusText, isDirty, isSaving, onSave }: SectionBarProps) {
  const colors = STATUS_COLORS[status]

  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 rounded-lg"
      style={{ background: 'var(--gem-surface, #0d1118)', border: '1px solid var(--gem-border, #1a2030)' }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
          style={{ background: 'rgba(20,184,166,0.1)', color: '#14b8a6' }}
        >
          {label}
        </span>
        {statusText && (
          <span
            className="text-[10px] px-2 py-0.5 rounded"
            style={{ background: colors.bg, color: colors.text }}
          >
            {statusText}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        {isDirty && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#f59e0b' }} />
            <span className="text-[10px]" style={{ color: '#f59e0b' }}>Alterações não salvas</span>
          </div>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || !isDirty}
          className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1 rounded-md transition-all"
          style={{
            border: isDirty ? '1px solid var(--gem-accent, #818cf8)' : '1px solid var(--gem-border, #1a2030)',
            color: isDirty ? 'var(--gem-accent, #818cf8)' : 'var(--gem-dim, #3d4654)',
            opacity: isSaving ? 0.6 : 1,
            cursor: isSaving || !isDirty ? 'default' : 'pointer',
          }}
        >
          {isSaving ? 'Salvando...' : 'Salvar'}
          {!isSaving && (
            <kbd
              className="text-[9px] px-1 py-0.5 rounded"
              style={{ background: 'var(--gem-well, #0f1620)', color: 'var(--gem-dim, #3d4654)' }}
            >
              ⌘S
            </kbd>
          )}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -i "section-bar" || echo "No type errors"`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/posts/_components/section-bar.tsx
git commit -m "feat(posts): add SectionBar component with dirty indicator and save"
```

---

## Task 5: PostTabBar component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/posts/_components/post-tab-bar.tsx`

- [ ] **Step 1: Implement the PostTabBar component**

5-tab navigation with colored dot indicators (green/amber/gray) and right-aligned language toggle (PT | EN).

```typescript
// apps/web/src/app/cms/(authed)/posts/_components/post-tab-bar.tsx
'use client'

import { POST_TABS, type PostTab, type SectionStatus } from '@/lib/posts/types'
import { usePostEditor } from './post-editor-context'

interface PostTabBarProps {
  tabStatuses: Record<PostTab, SectionStatus>
  availableLocales: string[]
}

const DOT_COLORS: Record<SectionStatus, string> = {
  done: 'var(--gem-done, #22c55e)',
  warn: 'var(--gem-warn, #f59e0b)',
  empty: 'transparent',
}

export function PostTabBar({ tabStatuses, availableLocales }: PostTabBarProps) {
  const { state, dispatch } = usePostEditor()

  return (
    <div
      className="flex items-end justify-between"
      style={{ borderBottom: '1px solid var(--gem-border, #1a2030)' }}
    >
      <div className="flex overflow-x-auto" role="tablist" aria-label="Post sections" style={{ scrollbarWidth: 'none' }}>
        {POST_TABS.map(({ tab, labelPt }) => {
          const isActive = state.activeTab === tab
          const status = tabStatuses[tab]
          const isDirty = state.dirty[tab]

          return (
            <button
              key={tab}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab}`}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium whitespace-nowrap select-none transition-colors"
              style={{
                color: isActive ? 'var(--gem-text, #e2e8f0)' : 'var(--gem-dim, #3d4654)',
                borderBottom: isActive ? '2px solid var(--gem-accent, #818cf8)' : '2px solid transparent',
                cursor: 'pointer',
              }}
              onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', tab })}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  background: isDirty ? 'var(--gem-warn, #f59e0b)' : DOT_COLORS[status],
                  border: status === 'empty' && !isDirty ? '1px solid var(--gem-dim, #3d4654)' : 'none',
                }}
              />
              {labelPt}
            </button>
          )
        })}
      </div>

      {availableLocales.length > 1 && (
        <div className="flex mb-2 rounded overflow-hidden" style={{ border: '1px solid var(--gem-border, #1a2030)' }}>
          {availableLocales.map(locale => {
            const label = locale === 'pt-br' ? 'PT' : 'EN'
            const isActive = state.activeLocale === locale

            return (
              <button
                key={locale}
                className="px-2.5 py-0.5 text-[10px] font-bold tracking-wider transition-colors"
                style={{
                  background: isActive ? 'var(--gem-accent, #818cf8)' : 'transparent',
                  color: isActive ? 'white' : 'var(--gem-dim, #3d4654)',
                }}
                onClick={() => dispatch({ type: 'SET_LOCALE', locale })}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -i "post-tab-bar" || echo "No type errors"`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/posts/_components/post-tab-bar.tsx
git commit -m "feat(posts): add PostTabBar with dot indicators and language toggle"
```

---

## Task 6: Sidebar cards (StatusCard, OriginCard, PubSummaryCard)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/posts/_components/sidebar/status-card.tsx`
- Create: `apps/web/src/app/cms/(authed)/posts/_components/sidebar/origin-card.tsx`
- Create: `apps/web/src/app/cms/(authed)/posts/_components/sidebar/pub-summary-card.tsx`
- Create: `apps/web/src/app/cms/(authed)/posts/_components/sidebar/sections-panel.tsx`

- [ ] **Step 1: Implement StatusCard**

Shows stage progress dots (Em edição → Agendado → Publicado) + action buttons (Agendar, Publicar, Devolver ao Pipeline).

```typescript
// apps/web/src/app/cms/(authed)/posts/_components/sidebar/status-card.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { POST_STAGES, dbStatusToStage } from '@/lib/posts/types'

interface StatusCardProps {
  status: string
  postId: string
  pipelineItemId: string | null
  onSchedule: () => void
  onPublish: () => void
  onReturnToPipeline: () => void
}

export function StatusCard({ status, postId, pipelineItemId, onSchedule, onPublish, onReturnToPipeline }: StatusCardProps) {
  const currentStage = dbStatusToStage(status)
  const currentIdx = POST_STAGES.findIndex(s => s.stage === currentStage)

  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: 'var(--gem-surface, #0d1118)', borderColor: 'var(--gem-border, #1a2030)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-medium px-2 py-0.5 rounded"
          style={{
            background: currentStage === 'published' ? 'rgba(34,197,94,0.1)' : currentStage === 'scheduled' ? 'rgba(139,92,246,0.1)' : 'rgba(99,102,241,0.1)',
            color: currentStage === 'published' ? '#22c55e' : currentStage === 'scheduled' ? '#8b5cf6' : '#818cf8',
          }}
        >
          {POST_STAGES[currentIdx]?.labelPt ?? status}
        </span>
      </div>

      <div className="flex gap-1 mb-3" role="progressbar" aria-valuenow={currentIdx} aria-valuemax={POST_STAGES.length - 1}>
        {POST_STAGES.map((s, i) => (
          <div
            key={s.stage}
            className="h-1.5 flex-1 rounded-sm transition-colors"
            title={s.labelPt}
            style={{
              background: i < currentIdx ? 'var(--gem-done, #22c55e)' : i === currentIdx ? 'var(--gem-accent, #818cf8)' : 'transparent',
              border: i > currentIdx ? '1px dashed var(--gem-border, #1a2030)' : 'none',
            }}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {currentStage === 'editing' && (
          <>
            <button
              type="button"
              onClick={onSchedule}
              className="w-full text-xs py-1.5 rounded transition-opacity hover:opacity-80"
              style={{ background: 'var(--gem-accent, #818cf8)', color: 'white' }}
            >
              Agendar
            </button>
            <button
              type="button"
              onClick={onPublish}
              className="w-full text-xs py-1.5 rounded border transition-colors hover:bg-emerald-500/10"
              style={{ borderColor: 'var(--gem-done, #22c55e)', color: 'var(--gem-done, #22c55e)' }}
            >
              Publicar agora
            </button>
          </>
        )}
        {currentStage === 'scheduled' && (
          <button
            type="button"
            onClick={onPublish}
            className="w-full text-xs py-1.5 rounded transition-opacity hover:opacity-80"
            style={{ background: 'var(--gem-done, #22c55e)', color: 'white' }}
          >
            Publicar agora
          </button>
        )}
        {pipelineItemId && currentStage !== 'published' && (
          <button
            type="button"
            onClick={onReturnToPipeline}
            className="w-full text-[10px] py-1 transition-colors hover:underline"
            style={{ color: 'var(--gem-dim, #3d4654)' }}
          >
            ← Devolver ao Pipeline
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement OriginCard**

```typescript
// apps/web/src/app/cms/(authed)/posts/_components/sidebar/origin-card.tsx
'use client'

import Link from 'next/link'
import { getFormatIcon } from '@/lib/pipeline/gem-design'

interface OriginCardProps {
  pipelineItem: { id: string; code: string; format: string; stage: string; priority: number } | null
}

export function OriginCard({ pipelineItem }: OriginCardProps) {
  if (!pipelineItem) return null

  const formatIcon = getFormatIcon(pipelineItem.format)

  return (
    <Link
      href={`/cms/pipeline/${pipelineItem.format}/${pipelineItem.id}`}
      className="block rounded-lg border p-3 transition-colors hover:border-[var(--gem-accent)]"
      style={{ background: 'var(--gem-surface, #0d1118)', borderColor: 'var(--gem-border, #1a2030)' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">{formatIcon.icon}</span>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-mono" style={{ color: 'var(--gem-accent, #818cf8)' }}>
            ← {pipelineItem.code}
          </span>
          <p className="text-[10px]" style={{ color: 'var(--gem-dim, #3d4654)' }}>
            Pipeline · {pipelineItem.stage}
          </p>
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 3: Implement PubSummaryCard**

```typescript
// apps/web/src/app/cms/(authed)/posts/_components/sidebar/pub-summary-card.tsx
'use client'

import type { SocialConfig } from '@/lib/social/types'

interface PubSummaryCardProps {
  scheduledAt: string | null
  socialConfig: SocialConfig | null
  includeInNewsletter: boolean
  status: string
}

export function PubSummaryCard({ scheduledAt, socialConfig, includeInNewsletter, status }: PubSummaryCardProps) {
  const platformCount = socialConfig?.enabled ? socialConfig.platforms.length : 0
  const isPublished = status === 'published'

  return (
    <div
      className="rounded-lg border p-3"
      style={{ background: 'var(--gem-surface, #0d1118)', borderColor: 'var(--gem-border, #1a2030)' }}
    >
      <h3 className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--gem-dim, #3d4654)' }}>
        Publicação
      </h3>
      <div className="space-y-1.5">
        <SummaryRow label="Agendamento" value={scheduledAt ? new Date(scheduledAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Não definido'} ok={!!scheduledAt} />
        <SummaryRow label="Social" value={platformCount > 0 ? `${platformCount} plataforma${platformCount > 1 ? 's' : ''}` : 'Não configurado'} ok={platformCount > 0} />
        <SummaryRow label="Newsletter" value={includeInNewsletter ? 'Incluído' : 'Não incluído'} ok={includeInNewsletter} />
        <SummaryRow label="Status" value={isPublished ? 'Publicado' : 'Rascunho'} ok={isPublished} />
      </div>
    </div>
  )
}

function SummaryRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between text-[10px]">
      <span style={{ color: 'var(--gem-dim, #3d4654)' }}>{label}</span>
      <span className="flex items-center gap-1">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: ok ? 'var(--gem-done, #22c55e)' : 'var(--gem-dim, #3d4654)' }}
        />
        <span style={{ color: ok ? 'var(--gem-muted, #8b949e)' : 'var(--gem-dim, #3d4654)' }}>{value}</span>
      </span>
    </div>
  )
}
```

- [ ] **Step 4: Implement SectionsPanel**

```typescript
// apps/web/src/app/cms/(authed)/posts/_components/sidebar/sections-panel.tsx
'use client'

import { POST_TABS, type PostTab, type SectionStatus } from '@/lib/posts/types'
import { usePostEditor } from '../post-editor-context'

interface SectionsPanelProps {
  tabStatuses: Record<PostTab, SectionStatus>
}

const STATUS_COLORS: Record<SectionStatus, string> = {
  done: 'var(--gem-done, #22c55e)',
  warn: 'var(--gem-warn, #f59e0b)',
  empty: 'transparent',
}

export function SectionsPanel({ tabStatuses }: SectionsPanelProps) {
  const { dispatch } = usePostEditor()

  return (
    <div
      className="rounded-lg border p-3"
      style={{ background: 'var(--gem-surface, #0d1118)', borderColor: 'var(--gem-border, #1a2030)' }}
    >
      <h3 className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--gem-dim, #3d4654)' }}>
        Seções
      </h3>
      <div className="space-y-1.5">
        {POST_TABS.map(({ tab, labelPt }) => {
          const status = tabStatuses[tab]
          return (
            <button
              key={tab}
              type="button"
              onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', tab })}
              className="w-full flex items-center justify-between text-[11px] py-0.5 transition-colors hover:opacity-80"
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    background: STATUS_COLORS[status],
                    border: status === 'empty' ? '1px solid var(--gem-dim, #3d4654)' : 'none',
                  }}
                />
                <span style={{ color: status !== 'empty' ? 'var(--gem-muted, #8b949e)' : 'var(--gem-dim, #3d4654)' }}>
                  {labelPt}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify all compile**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -c "error" || echo "No type errors"`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/posts/_components/sidebar/
git commit -m "feat(posts): add sidebar cards — StatusCard, OriginCard, PubSummaryCard, SectionsPanel"
```

---

## Task 7: Pipeline board — limit blog_post to 3 stages

**Files:**
- Modify: `apps/web/src/lib/pipeline/workflows.ts`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-board.tsx`

- [ ] **Step 1: Add PIPELINE_ONLY_STAGES constant to workflows.ts**

Add after the existing `WORKFLOWS` export:

```typescript
// In apps/web/src/lib/pipeline/workflows.ts, after WORKFLOWS definition:

export const PIPELINE_ONLY_STAGES: Partial<Record<Format, string[]>> = {
  blog_post: ['idea', 'draft', 'ready'],
}

export function getPipelineStages(format: Format): WorkflowStage[] {
  const allowed = PIPELINE_ONLY_STAGES[format]
  if (!allowed) return WORKFLOWS[format]
  return WORKFLOWS[format].filter(s => allowed.includes(s.stage))
}
```

- [ ] **Step 2: Update pipeline-board.tsx to use getPipelineStages**

In `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-board.tsx`, change the stages resolution:

```diff
- import { WORKFLOWS } from '@/lib/pipeline/workflows'
+ import { WORKFLOWS, getPipelineStages } from '@/lib/pipeline/workflows'

  export function PipelineBoard({ format, items, collections }: PipelineBoardProps) {
-   const stages = WORKFLOWS[format]
+   const stages = getPipelineStages(format)
    const stageKeys = stages.map((s) => s.stage)
```

- [ ] **Step 3: Verify existing tests still pass**

Run: `npx vitest run apps/web/test --reporter=verbose 2>&1 | tail -5`
Expected: All existing tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/pipeline/workflows.ts apps/web/src/app/cms/\(authed\)/pipeline/_components/pipeline-board.tsx
git commit -m "feat(pipeline): limit blog_post kanban to 3 pipeline stages (idea/draft/ready)"
```

---

## Task 8: Posts server actions

**Files:**
- Create: `apps/web/src/app/cms/(authed)/posts/actions.ts`

- [ ] **Step 1: Implement posts server actions**

These actions handle: saving tab data, scheduling, publishing, and reverse graduation (devolver ao pipeline).

```typescript
// apps/web/src/app/cms/(authed)/posts/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { revalidateBlogPostSeo } from '@/lib/seo/cache-invalidation'
import { syncPipelineOnPostStatusChange } from '@/lib/pipeline/blog-sync'
import type { SocialConfig } from '@/lib/social/types'

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string }

async function requireEditScope(siteId: string): Promise<void> {
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
}

export async function savePostContent(
  postId: string,
  locale: string,
  data: {
    title?: string
    slug?: string
    excerpt?: string
    contentMdx?: string
    contentJson?: Record<string, unknown>
    contentHtml?: string
  },
): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const svc = getSupabaseServiceClient()

  const patch: Record<string, unknown> = {}
  if (data.title !== undefined) patch.title = data.title
  if (data.slug !== undefined) patch.slug = data.slug
  if (data.excerpt !== undefined) patch.excerpt = data.excerpt
  if (data.contentMdx !== undefined) patch.content_mdx = data.contentMdx
  if (data.contentJson !== undefined) patch.content_json = data.contentJson
  if (data.contentHtml !== undefined) patch.content_html = data.contentHtml

  const { error } = await svc
    .from('blog_translations')
    .update(patch)
    .eq('post_id', postId)
    .eq('locale', locale)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/cms/posts/${postId}`)
  return { ok: true }
}

export async function savePostSeo(
  postId: string,
  locale: string,
  data: {
    metaTitle?: string
    metaDescription?: string
    ogImageUrl?: string | null
    focusKeyword?: string
  },
): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const svc = getSupabaseServiceClient()

  const patch: Record<string, unknown> = {}
  if (data.metaTitle !== undefined) patch.meta_title = data.metaTitle
  if (data.metaDescription !== undefined) patch.meta_description = data.metaDescription
  if (data.ogImageUrl !== undefined) patch.og_image_url = data.ogImageUrl

  const { error } = await svc
    .from('blog_translations')
    .update(patch)
    .eq('post_id', postId)
    .eq('locale', locale)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/cms/posts/${postId}`)
  revalidateBlogPostSeo(siteId, postId, locale, '')
  return { ok: true }
}

export async function savePostSocialConfig(
  postId: string,
  config: SocialConfig,
): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const svc = getSupabaseServiceClient()

  const { error } = await svc
    .from('blog_posts')
    .update({ social_config: config })
    .eq('id', postId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/cms/posts/${postId}`)
  return { ok: true }
}

export async function savePostPublishSettings(
  postId: string,
  data: {
    includeInNewsletter?: boolean
    rssIncluded?: boolean
    searchIndexable?: boolean
    canonicalUrl?: string | null
  },
): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const svc = getSupabaseServiceClient()

  const patch: Record<string, unknown> = {}
  if (data.includeInNewsletter !== undefined) patch.include_in_newsletter = data.includeInNewsletter
  if (data.rssIncluded !== undefined) patch.rss_included = data.rssIncluded
  if (data.searchIndexable !== undefined) patch.search_indexable = data.searchIndexable
  if (data.canonicalUrl !== undefined) patch.canonical_url = data.canonicalUrl

  const { error } = await svc
    .from('blog_posts')
    .update(patch)
    .eq('id', postId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/cms/posts/${postId}`)
  return { ok: true }
}

export async function savePostCoverImage(
  postId: string,
  coverImageUrl: string | null,
): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const svc = getSupabaseServiceClient()

  const { error } = await svc
    .from('blog_posts')
    .update({ cover_image_url: coverImageUrl })
    .eq('id', postId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/cms/posts/${postId}`)
  return { ok: true }
}

export async function schedulePost(
  postId: string,
  scheduledAt: string,
  timezone: string,
): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const svc = getSupabaseServiceClient()

  const { data: post, error: fetchError } = await svc
    .from('blog_posts')
    .select('id, status, social_config')
    .eq('id', postId)
    .eq('site_id', siteId)
    .single()

  if (fetchError || !post) return { ok: false, error: 'Post not found' }
  if (post.status === 'published') return { ok: false, error: 'Post already published' }

  const { error } = await svc
    .from('blog_posts')
    .update({ status: 'scheduled', scheduled_at: scheduledAt })
    .eq('id', postId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  syncPipelineOnPostStatusChange(postId, 'scheduled', post.status).catch(() => {})

  revalidatePath('/cms/posts')
  revalidatePath(`/cms/posts/${postId}`)
  return { ok: true }
}

export async function publishPost(
  postId: string,
): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const svc = getSupabaseServiceClient()

  const { data: post, error: fetchError } = await svc
    .from('blog_posts')
    .select('id, status, social_config, blog_translations(locale, slug)')
    .eq('id', postId)
    .eq('site_id', siteId)
    .single()

  if (fetchError || !post) return { ok: false, error: 'Post not found' }
  if (post.status === 'published') return { ok: false, error: 'Post already published' }

  const { error } = await svc
    .from('blog_posts')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  const translations = (post as { blog_translations: Array<{ locale: string; slug: string }> }).blog_translations ?? []
  for (const tx of translations) {
    revalidateBlogPostSeo(siteId, postId, tx.locale, tx.slug)
  }

  syncPipelineOnPostStatusChange(postId, 'published', post.status).catch(() => {})

  const socialConfig = (post as { social_config?: { enabled: boolean } }).social_config
  if (socialConfig?.enabled) {
    import('@/lib/social/create-from-content').then(({ createSocialPostFromContent }) =>
      createSocialPostFromContent({
        supabase: svc,
        siteId,
        contentType: 'blog',
        contentId: postId,
        config: socialConfig as unknown as SocialConfig,
        origin: 'auto',
        userId: 'system',
      }).catch(() => {}),
    )
  }

  revalidatePath('/cms/posts')
  revalidatePath(`/cms/posts/${postId}`)
  revalidatePath('/cms/blog')
  return { ok: true }
}

export async function returnToPipeline(
  postId: string,
): Promise<ActionResult<{ pipelineItemId: string }>> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const svc = getSupabaseServiceClient()

  const { data: pipelineItem } = await svc
    .from('content_pipeline')
    .select('id, stage, version')
    .eq('blog_post_id', postId)
    .eq('site_id', siteId)
    .maybeSingle()

  if (!pipelineItem) return { ok: false, error: 'No linked pipeline item found' }

  // Archive the blog post (soft delete)
  const { error: archiveErr } = await svc
    .from('blog_posts')
    .update({ status: 'archived' })
    .eq('id', postId)
    .eq('site_id', siteId)

  if (archiveErr) return { ok: false, error: archiveErr.message }

  // Null out the FK and reset pipeline item to draft stage
  const { error: pipelineErr } = await svc
    .from('content_pipeline')
    .update({
      blog_post_id: null,
      social_config: null,
      stage: 'draft',
      version: pipelineItem.version + 1,
    })
    .eq('id', pipelineItem.id)
    .eq('version', pipelineItem.version)

  if (pipelineErr) return { ok: false, error: pipelineErr.message }

  await svc.from('content_pipeline_history').insert({
    pipeline_id: pipelineItem.id,
    event_type: 'returned_from_post',
    from_value: `post:${postId}`,
    to_value: 'draft',
  })

  revalidatePath('/cms/posts')
  revalidatePath('/cms/pipeline')
  return { ok: true, data: { pipelineItemId: pipelineItem.id } }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -c "error" || echo "No type errors"`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/posts/actions.ts
git commit -m "feat(posts): add server actions — save, schedule, publish, returnToPipeline"
```

---

## Task 9: Posts kanban board

**Files:**
- Create: `apps/web/src/app/cms/(authed)/posts/_components/post-card.tsx`
- Create: `apps/web/src/app/cms/(authed)/posts/_components/sortable-post-card.tsx`
- Create: `apps/web/src/app/cms/(authed)/posts/_components/posts-board.tsx`

- [ ] **Step 1: Implement PostCard**

```typescript
// apps/web/src/app/cms/(authed)/posts/_components/post-card.tsx
'use client'

import Link from 'next/link'
import type { Provider } from '@tn-figueiredo/social'

export interface PostBoardItem {
  id: string
  title: string
  hook: string | null
  status: string
  coverImageUrl: string | null
  locales: string[]
  socialPlatforms: Provider[]
  scheduledAt: string | null
  publishedAt: string | null
  pipelineCode: string | null
  sortOrder: number
}

interface PostCardProps {
  item: PostBoardItem
  isDragging?: boolean
}

const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#f87171',
  facebook: '#60a5fa',
  instagram: '#e879f9',
  bluesky: '#38bdf8',
}

export function PostCard({ item, isDragging }: PostCardProps) {
  return (
    <Link
      href={`/cms/posts/${item.id}`}
      className="block rounded-lg border p-3 transition-all hover:border-[var(--gem-accent)]"
      style={{
        background: 'var(--gem-surface, #0d1118)',
        borderColor: isDragging ? 'var(--gem-accent, #818cf8)' : 'var(--gem-border, #1a2030)',
        opacity: isDragging ? 0.85 : 1,
      }}
    >
      <div className="flex gap-2.5">
        {item.coverImageUrl && (
          <img
            src={item.coverImageUrl}
            alt=""
            className="w-12 h-12 rounded object-cover shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: 'var(--gem-text, #e2e8f0)' }}>
            {item.title}
          </p>
          {item.hook && (
            <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--gem-muted, #8b949e)' }}>
              {item.hook}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          {item.locales.map(l => (
            <span
              key={l}
              className="text-[9px] font-bold px-1 py-0.5 rounded"
              style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}
            >
              {l === 'pt-br' ? 'PT' : 'EN'}
            </span>
          ))}
          {item.socialPlatforms.map(p => (
            <span
              key={p}
              className="w-3 h-3 rounded-full"
              style={{ background: PLATFORM_COLORS[p] ?? '#666' }}
              title={p}
            />
          ))}
        </div>
        {item.pipelineCode && (
          <span className="text-[9px] font-mono" style={{ color: 'var(--gem-dim, #3d4654)' }}>
            ← {item.pipelineCode}
          </span>
        )}
      </div>

      {item.scheduledAt && (
        <div className="mt-1.5 text-[9px]" style={{ color: 'var(--gem-muted, #8b949e)' }}>
          {new Date(item.scheduledAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </Link>
  )
}
```

- [ ] **Step 2: Implement SortablePostCard**

```typescript
// apps/web/src/app/cms/(authed)/posts/_components/sortable-post-card.tsx
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PostCard, type PostBoardItem } from './post-card'

interface SortablePostCardProps {
  item: PostBoardItem
}

export function SortablePostCard({ item }: SortablePostCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : undefined }}
      {...attributes}
      {...listeners}
    >
      <PostCard item={item} isDragging={isDragging} />
    </div>
  )
}
```

- [ ] **Step 3: Implement PostsBoard**

```typescript
// apps/web/src/app/cms/(authed)/posts/_components/posts-board.tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  DndContext,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { toast } from 'sonner'
import { PostCard, type PostBoardItem } from './post-card'
import { SortablePostCard } from './sortable-post-card'
import { POST_STAGES } from '@/lib/posts/types'

interface PostsBoardProps {
  items: PostBoardItem[]
}

const COLUMN_COLORS = ['#818cf8', '#8b5cf6', '#22c55e']

export function PostsBoard({ items }: PostsBoardProps) {
  const [localItems, setLocalItems] = useState(items)
  const [activeItem, setActiveItem] = useState<PostBoardItem | null>(null)

  useEffect(() => { setLocalItems(items) }, [items])

  const itemsByStage = POST_STAGES.reduce<Record<string, PostBoardItem[]>>((acc, stage) => {
    acc[stage.dbStatus] = localItems
      .filter(i => i.status === stage.dbStatus)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return acc
  }, {})

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const item = localItems.find(i => i.id === event.active.id)
    if (item) setActiveItem(item)
  }, [localItems])

  const handleDragEnd = useCallback(() => {
    setActiveItem(null)
  }, [])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[calc(100vh-14rem)]">
        {POST_STAGES.map((stage, idx) => {
          const stageItems = itemsByStage[stage.dbStatus] ?? []
          return (
            <div key={stage.dbStatus} className="flex-shrink-0 w-72">
              <div className="sticky top-0 pb-2 z-10" style={{ background: 'var(--gem-well, #0f1620)' }}>
                <div
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg"
                  style={{ background: 'var(--gem-surface, #0d1118)', borderLeft: `3px solid ${COLUMN_COLORS[idx]}` }}
                >
                  <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--gem-muted, #8b949e)' }}>
                    {stage.labelPt}
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: 'var(--gem-border, #1a2030)', color: 'var(--gem-dim, #3d4654)' }}
                  >
                    {stageItems.length}
                  </span>
                </div>
              </div>
              <SortableContext items={stageItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5 min-h-[48px]">
                  {stageItems.map(item => (
                    <SortablePostCard key={item.id} item={item} />
                  ))}
                  {stageItems.length === 0 && (
                    <p className="text-[10px] text-center py-8" style={{ color: 'var(--gem-faint, #181e28)' }}>
                      Nenhum em {stage.labelPt}
                    </p>
                  )}
                </div>
              </SortableContext>
            </div>
          )
        })}
      </div>
      <DragOverlay>
        {activeItem ? (
          <div className="opacity-85 scale-[1.02] shadow-2xl">
            <PostCard item={activeItem} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
```

- [ ] **Step 4: Verify all compile**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -c "error" || echo "No type errors"`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/posts/_components/post-card.tsx apps/web/src/app/cms/\(authed\)/posts/_components/sortable-post-card.tsx apps/web/src/app/cms/\(authed\)/posts/_components/posts-board.tsx
git commit -m "feat(posts): add Posts kanban board with 3-column layout"
```

---

## Task 10: Posts kanban page (server component)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/posts/page.tsx`

- [ ] **Step 1: Implement the posts kanban page**

Server component that fetches blog posts and renders the PostsBoard.

```typescript
// apps/web/src/app/cms/(authed)/posts/page.tsx
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { PostsBoard } from './_components/posts-board'
import type { PostBoardItem } from './_components/post-card'
import type { SocialConfig } from '@/lib/social/types'

export const metadata = { title: 'Posts' }

export default async function PostsPage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'read' })

  const svc = getSupabaseServiceClient()
  const { data: posts } = await svc
    .from('blog_posts')
    .select(`
      id,
      status,
      cover_image_url,
      scheduled_at,
      published_at,
      social_config,
      blog_translations(locale, title, excerpt),
      content_pipeline!content_pipeline_blog_post_id_fkey(code)
    `)
    .eq('site_id', siteId)
    .in('status', ['draft', 'scheduled', 'published'])
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })
    .limit(100)

  const items: PostBoardItem[] = (posts ?? []).map((post: Record<string, unknown>) => {
    const translations = (post.blog_translations ?? []) as Array<{ locale: string; title: string; excerpt: string | null }>
    const primaryTx = translations[0]
    const socialConfig = post.social_config as SocialConfig | null
    const pipeline = (post.content_pipeline ?? []) as Array<{ code: string }>

    return {
      id: post.id as string,
      title: primaryTx?.title ?? 'Untitled',
      hook: primaryTx?.excerpt ?? null,
      status: post.status as string,
      coverImageUrl: post.cover_image_url as string | null,
      locales: translations.map(tx => tx.locale),
      socialPlatforms: socialConfig?.enabled ? socialConfig.platforms : [],
      scheduledAt: post.scheduled_at as string | null,
      publishedAt: post.published_at as string | null,
      pipelineCode: pipeline[0]?.code ?? null,
      sortOrder: 0,
    }
  })

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--gem-text, #e2e8f0)' }}>Posts</h1>
      </div>
      <PostsBoard items={items} />
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -i "posts/page" || echo "No type errors"`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/posts/page.tsx
git commit -m "feat(posts): add Posts kanban page with server-side data fetching"
```

---

## Task 11: Post detail page shell

**Files:**
- Create: `apps/web/src/app/cms/(authed)/posts/[id]/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/posts/_components/post-detail.tsx`
- Create: `apps/web/src/app/cms/(authed)/posts/_components/sidebar/post-sidebar.tsx`

- [ ] **Step 1: Implement PostSidebar (composed sidebar)**

```typescript
// apps/web/src/app/cms/(authed)/posts/_components/sidebar/post-sidebar.tsx
'use client'

import { usePostEditor } from '../post-editor-context'
import { StatusCard } from './status-card'
import { OriginCard } from './origin-card'
import { PubSummaryCard } from './pub-summary-card'
import { SectionsPanel } from './sections-panel'
import { ReadinessRing } from '../readiness-ring'
import { computeReadiness, type ReadinessInput } from '@/lib/posts/readiness'
import type { PostTab, SectionStatus } from '@/lib/posts/types'

interface PostSidebarProps {
  tabStatuses: Record<PostTab, SectionStatus>
  onSchedule: () => void
  onPublish: () => void
  onReturnToPipeline: () => void
}

export function PostSidebar({ tabStatuses, onSchedule, onPublish, onReturnToPipeline }: PostSidebarProps) {
  const { state } = usePostEditor()
  const { post } = state

  const readinessInput: ReadinessInput = {
    content: {
      titleFilled: (state.sections.content.title as string)?.length > 0 || post.translations.some(t => t.title.length > 0),
      hookFilled: (state.sections.content.excerpt as string)?.length > 0 || post.translations.some(t => (t.excerpt?.length ?? 0) > 0),
      bodyFilled: (state.sections.content.contentMdx as string)?.length > 0 || post.translations.some(t => (t.contentMdx?.length ?? 0) > 0),
    },
    images: { coverSet: !!post.coverImageUrl },
    seo: {
      metaTitleFilled: post.translations.some(t => (t.metaTitle?.length ?? 0) > 0),
      metaDescriptionFilled: post.translations.some(t => (t.metaDescription?.length ?? 0) > 0),
      score: 0,
    },
    social: { platformsConfigured: post.socialConfig?.enabled ? post.socialConfig.platforms.length : 0 },
    schedule: { dateSet: !!post.scheduledAt, dateSaved: !!post.scheduledAt },
    newsletter: { decisionMade: true },
  }
  const readiness = computeReadiness(readinessInput)

  return (
    <aside
      className="w-68 shrink-0 flex flex-col gap-2.5 sticky top-5 self-start max-h-[calc(100vh-40px)] overflow-y-auto"
      style={{ scrollbarWidth: 'thin' }}
      aria-label="Post details"
    >
      <StatusCard
        status={post.status}
        postId={post.id}
        pipelineItemId={post.pipelineItem?.id ?? null}
        onSchedule={onSchedule}
        onPublish={onPublish}
        onReturnToPipeline={onReturnToPipeline}
      />
      <OriginCard pipelineItem={post.pipelineItem} />
      <PubSummaryCard
        scheduledAt={post.scheduledAt}
        socialConfig={post.socialConfig}
        includeInNewsletter={post.includeInNewsletter}
        status={post.status}
      />
      <SectionsPanel tabStatuses={tabStatuses} />
      <div
        className="rounded-lg border p-4 flex items-center gap-3"
        style={{ background: 'var(--gem-surface, #0d1118)', borderColor: 'var(--gem-border, #1a2030)' }}
      >
        <ReadinessRing score={readiness.score} size={48} />
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--gem-text, #e2e8f0)' }}>Readiness</p>
          <p className="text-[10px]" style={{ color: 'var(--gem-dim, #3d4654)' }}>Completude para publicação</p>
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Implement PostDetail container**

```typescript
// apps/web/src/app/cms/(authed)/posts/_components/post-detail.tsx
'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { PostEditorProvider, usePostEditor } from './post-editor-context'
import { PostTabBar } from './post-tab-bar'
import { PostSidebar } from './sidebar/post-sidebar'
import { ContentTab } from './tabs/content-tab'
import { ImagesTab } from './tabs/images-tab'
import { SeoTab } from './tabs/seo-tab'
import { SocialTab } from './tabs/social-tab'
import { PublishTab } from './tabs/publish-tab'
import { schedulePost, publishPost, returnToPipeline } from '../actions'
import type { PostDetailData, PostTab, SectionStatus } from '@/lib/posts/types'

interface PostDetailProps {
  post: PostDetailData
}

function PostDetailInner() {
  const router = useRouter()
  const { state, dispatch } = usePostEditor()
  const { post, activeTab } = state

  const tabStatuses: Record<PostTab, SectionStatus> = {
    content: post.translations.some(t => t.title && t.contentMdx) ? 'done' : post.translations.some(t => t.title) ? 'warn' : 'empty',
    images: post.coverImageUrl ? 'done' : 'empty',
    seo: post.translations.some(t => t.metaTitle && t.metaDescription) ? 'done' : post.translations.some(t => t.metaTitle || t.metaDescription) ? 'warn' : 'empty',
    social: post.socialConfig?.enabled && post.socialConfig.platforms.length > 0 ? 'done' : 'empty',
    publish: post.scheduledAt ? 'done' : 'empty',
  }

  const handleSchedule = useCallback(async () => {
    // Tab navigation to Publicação for setting date
    dispatch({ type: 'SET_ACTIVE_TAB', tab: 'publish' })
  }, [dispatch])

  const handlePublish = useCallback(async () => {
    if (!confirm('Publicar imediatamente? O post ficará visível no /blog e os posts sociais serão disparados.')) return
    const result = await publishPost(post.id)
    if (result.ok) {
      toast.success('Post publicado!')
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }, [post.id, router])

  const handleReturnToPipeline = useCallback(async () => {
    if (!confirm('Devolver ao Pipeline? O post voltará como item de pipeline no estágio Rascunho. Social config e data de agendamento serão removidos.')) return
    const result = await returnToPipeline(post.id)
    if (result.ok && result.data) {
      toast.success('Devolvido ao pipeline')
      router.push(`/cms/pipeline/blog_post/${result.data.pipelineItemId}`)
    } else if (!result.ok) {
      toast.error(result.error)
    }
  }, [post.id, router])

  // ⌘S keyboard shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('posts:save-tab'))
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // Unsaved changes guard
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (state.hasDirtyTabs) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [state.hasDirtyTabs])

  return (
    <div className="flex gap-5" style={{ padding: '20px 24px', maxWidth: 1440, margin: '0 auto' }}>
      <div className="flex-1 min-w-0 flex flex-col gap-3.5">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs" style={{ color: 'var(--gem-dim, #3d4654)' }} aria-label="Breadcrumb">
          <Link href="/cms/posts" className="hover:underline">Posts</Link>
          <span aria-hidden="true">/</span>
          <span style={{ color: 'var(--gem-muted, #8b949e)' }}>
            {post.translations[0]?.title ?? 'Untitled'}
          </span>
        </nav>

        {/* Tab bar */}
        <PostTabBar tabStatuses={tabStatuses} availableLocales={post.translations.map(t => t.locale)} />

        {/* Tab content */}
        <div role="tabpanel" id={`tabpanel-${activeTab}`} aria-label={activeTab}>
          {activeTab === 'content' && <ContentTab />}
          {activeTab === 'images' && <ImagesTab />}
          {activeTab === 'seo' && <SeoTab />}
          {activeTab === 'social' && <SocialTab />}
          {activeTab === 'publish' && <PublishTab />}
        </div>
      </div>

      <PostSidebar
        tabStatuses={tabStatuses}
        onSchedule={handleSchedule}
        onPublish={handlePublish}
        onReturnToPipeline={handleReturnToPipeline}
      />
    </div>
  )
}

export function PostDetail({ post }: PostDetailProps) {
  return (
    <PostEditorProvider post={post}>
      <PostDetailInner />
    </PostEditorProvider>
  )
}
```

- [ ] **Step 3: Implement the detail page (server component)**

```typescript
// apps/web/src/app/cms/(authed)/posts/[id]/page.tsx
import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { PostDetail } from '../_components/post-detail'
import type { PostDetailData, PostTranslation } from '@/lib/posts/types'
import type { SocialConfig } from '@/lib/social/types'

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'read' })

  const svc = getSupabaseServiceClient()
  const { data: post } = await svc
    .from('blog_posts')
    .select(`
      id, site_id, author_id, status, category, cover_image_url, locale,
      scheduled_at, published_at, social_config,
      include_in_newsletter, rss_included, search_indexable, canonical_url,
      created_at, updated_at,
      blog_translations(locale, title, slug, excerpt, content_mdx, content_json, content_html, meta_title, meta_description, og_image_url, key_points, pull_quote),
      content_pipeline!content_pipeline_blog_post_id_fkey(id, code, format, stage, priority)
    `)
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (!post) notFound()

  const rawTranslations = (post.blog_translations ?? []) as Array<Record<string, unknown>>
  const translations: PostTranslation[] = rawTranslations.map(tx => ({
    locale: tx.locale as string,
    title: tx.title as string,
    slug: tx.slug as string,
    excerpt: tx.excerpt as string | null,
    contentMdx: tx.content_mdx as string | null,
    contentJson: tx.content_json as Record<string, unknown> | null,
    contentHtml: tx.content_html as string | null,
    metaTitle: tx.meta_title as string | null,
    metaDescription: tx.meta_description as string | null,
    ogImageUrl: tx.og_image_url as string | null,
    keyPoints: tx.key_points as string[] | null,
    pullQuote: tx.pull_quote as string | null,
  }))

  const rawPipeline = (post.content_pipeline ?? []) as Array<Record<string, unknown>>
  const pipelineItem = rawPipeline[0] ? {
    id: rawPipeline[0].id as string,
    code: rawPipeline[0].code as string,
    format: rawPipeline[0].format as string,
    stage: rawPipeline[0].stage as string,
    priority: rawPipeline[0].priority as number,
  } : null

  const postData: PostDetailData = {
    id: post.id as string,
    siteId: post.site_id as string,
    authorId: post.author_id as string,
    status: post.status as string,
    category: post.category as string | null,
    coverImageUrl: post.cover_image_url as string | null,
    locale: post.locale as string,
    scheduledAt: post.scheduled_at as string | null,
    publishedAt: post.published_at as string | null,
    socialConfig: post.social_config as SocialConfig | null,
    includeInNewsletter: (post.include_in_newsletter as boolean) ?? true,
    rssIncluded: (post.rss_included as boolean) ?? true,
    searchIndexable: (post.search_indexable as boolean) ?? true,
    canonicalUrl: post.canonical_url as string | null,
    translations,
    pipelineItem,
    createdAt: post.created_at as string,
    updatedAt: post.updated_at as string,
  }

  return <PostDetail post={postData} />
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -c "error" || echo "No type errors"`
Expected: No type errors (tabs are stub components at this point — implemented in Tasks 12-16)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/posts/\[id\]/page.tsx apps/web/src/app/cms/\(authed\)/posts/_components/post-detail.tsx apps/web/src/app/cms/\(authed\)/posts/_components/sidebar/post-sidebar.tsx
git commit -m "feat(posts): add post detail page shell with sidebar, tabs, and context"
```

---

## Task 12: Content Tab

**Files:**
- Create: `apps/web/src/app/cms/(authed)/posts/_components/tabs/content-tab.tsx`

- [ ] **Step 1: Implement ContentTab**

Integrates TipTap editor + cover image + title + hook + synopsis. Uses `usePostEditor()` context for dirty state and save via server action.

```typescript
// apps/web/src/app/cms/(authed)/posts/_components/tabs/content-tab.tsx
'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { usePostEditor } from '../post-editor-context'
import { SectionBar } from '../section-bar'
import { savePostContent, savePostCoverImage } from '../../actions'
import { TipTapEditor } from '../../../_shared/editor/tiptap-editor'
import { useMediaGallery } from '../../../_shared/media/use-media-gallery'
import { MediaGalleryModal } from '../../../_shared/media/media-gallery-modal'
import { CROP_PRESETS, type MediaAssetResult } from '../../../_shared/media/types'
import { ImageIcon, X } from 'lucide-react'
import type { SectionStatus } from '@/lib/posts/types'

export function ContentTab() {
  const { state, dispatch } = usePostEditor()
  const { post, activeLocale } = state
  const tx = post.translations.find(t => t.locale === activeLocale) ?? post.translations[0]

  const [title, setTitle] = useState(tx?.title ?? '')
  const [excerpt, setExcerpt] = useState(tx?.excerpt ?? '')
  const [contentJson, setContentJson] = useState(tx?.contentJson ?? null)
  const [coverUrl, setCoverUrl] = useState(post.coverImageUrl)
  const [isSaving, setIsSaving] = useState(false)
  const coverGallery = useMediaGallery()

  // Sync on locale change
  useEffect(() => {
    const t = post.translations.find(t => t.locale === activeLocale) ?? post.translations[0]
    if (t) {
      setTitle(t.title)
      setExcerpt(t.excerpt ?? '')
      setContentJson(t.contentJson)
    }
  }, [activeLocale, post.translations])

  const markDirty = useCallback(() => {
    dispatch({ type: 'SET_DIRTY', tab: 'content', dirty: true })
  }, [dispatch])

  const handleTitleChange = useCallback((val: string) => {
    setTitle(val)
    markDirty()
  }, [markDirty])

  const handleExcerptChange = useCallback((val: string) => {
    setExcerpt(val)
    markDirty()
  }, [markDirty])

  const handleEditorChange = useCallback((json: Record<string, unknown>) => {
    setContentJson(json)
    markDirty()
  }, [markDirty])

  const handleSave = useCallback(async () => {
    if (!tx) return
    setIsSaving(true)
    const result = await savePostContent(post.id, activeLocale, {
      title,
      excerpt: excerpt || undefined,
      contentJson: contentJson ?? undefined,
    })
    setIsSaving(false)
    if (result.ok) {
      dispatch({ type: 'SAVE_TAB', tab: 'content' })
      toast.success('Conteúdo salvo')
    } else {
      toast.error(result.error)
    }
  }, [post.id, activeLocale, title, excerpt, contentJson, tx, dispatch])

  // ⌘S listener
  useEffect(() => {
    const handler = () => { if (state.dirty.content) void handleSave() }
    document.addEventListener('posts:save-tab', handler)
    return () => document.removeEventListener('posts:save-tab', handler)
  }, [handleSave, state.dirty.content])

  const handleCoverSelect = useCallback(async (asset: MediaAssetResult) => {
    setCoverUrl(asset.url)
    const result = await savePostCoverImage(post.id, asset.url)
    if (!result.ok) { toast.error('Erro ao salvar capa'); setCoverUrl(post.coverImageUrl) }
  }, [post.id, post.coverImageUrl])

  const handleCoverRemove = useCallback(async () => {
    setCoverUrl(null)
    const result = await savePostCoverImage(post.id, null)
    if (!result.ok) { toast.error('Erro ao remover capa'); setCoverUrl(post.coverImageUrl) }
  }, [post.id, post.coverImageUrl])

  const sectionStatus: SectionStatus = title && contentJson ? 'done' : title ? 'warn' : 'empty'

  return (
    <div className="flex flex-col gap-3.5">
      <SectionBar
        label="Conteúdo"
        status={sectionStatus}
        statusText={title ? `rev.${post.translations.length}` : undefined}
        isDirty={state.dirty.content}
        isSaving={isSaving}
        onSave={handleSave}
      />

      {/* Cover image */}
      {coverUrl ? (
        <div className="relative group rounded-lg overflow-hidden" style={{ maxHeight: 240 }}>
          <img src={coverUrl} alt="" className="w-full object-cover" style={{ maxHeight: 240 }} />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button type="button" onClick={() => coverGallery.openGallery({ folder: 'blog', cropPreset: CROP_PRESETS['blog-cover'] })} className="text-xs text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md transition-colors">Trocar</button>
            <button type="button" onClick={handleCoverRemove} className="text-xs text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md transition-colors"><X size={14} /></button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => coverGallery.openGallery({ folder: 'blog', cropPreset: CROP_PRESETS['blog-cover'] })}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed py-6 transition-colors hover:border-[var(--gem-accent)] hover:bg-[var(--gem-accent)]/5"
          style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-dim)' }}
        >
          <ImageIcon size={16} />
          <span className="text-xs">Adicionar capa</span>
        </button>
      )}

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={e => handleTitleChange(e.target.value)}
        placeholder="Título do post"
        aria-label="Title"
        className="w-full bg-transparent border border-transparent rounded-lg hover:border-[var(--gem-border)] focus:border-[var(--gem-accent)] focus:outline-none transition-all"
        style={{ color: 'var(--gem-text)', fontSize: 24, fontWeight: 700, padding: '10px 14px' }}
      />

      {/* Hook/Excerpt */}
      <input
        type="text"
        value={excerpt}
        onChange={e => handleExcerptChange(e.target.value)}
        placeholder="Hook — o que prende a audiência em uma frase?"
        aria-label="Excerpt"
        className="w-full bg-transparent border-l-[3px] rounded-r-lg hover:bg-[var(--gem-surface-hi)] focus:border-[var(--gem-accent)] focus:outline-none transition-all"
        style={{ color: 'var(--gem-muted)', fontSize: 15, padding: '10px 14px', borderLeftColor: excerpt ? 'var(--gem-accent)' : 'var(--gem-faint)' }}
      />

      {/* TipTap Editor */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--gem-border)' }}>
        <TipTapEditor
          content={contentJson ?? undefined}
          onUpdate={({ editor }) => {
            handleEditorChange(editor.getJSON() as Record<string, unknown>)
          }}
          editable
          locale={activeLocale === 'pt-br' ? 'pt-BR' : 'en'}
        />
      </div>

      <MediaGalleryModal
        {...coverGallery.galleryProps}
        onSelect={handleCoverSelect}
        locale={activeLocale === 'pt-br' ? 'pt-BR' : 'en'}
        siteId={post.siteId}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -c "error" || echo "No type errors"`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/posts/_components/tabs/content-tab.tsx
git commit -m "feat(posts): add Content tab with TipTap, cover image, title, hook"
```

---

## Task 13: Images Tab

**Files:**
- Create: `apps/web/src/app/cms/(authed)/posts/_components/tabs/images-tab.tsx`

- [ ] **Step 1: Implement ImagesTab**

Cover management + image gallery grid + upload zone + MediaGalleryDialog.

```typescript
// apps/web/src/app/cms/(authed)/posts/_components/tabs/images-tab.tsx
'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { usePostEditor } from '../post-editor-context'
import { SectionBar } from '../section-bar'
import { savePostCoverImage } from '../../actions'
import { useMediaGallery } from '../../../_shared/media/use-media-gallery'
import { MediaGalleryModal } from '../../../_shared/media/media-gallery-modal'
import { CROP_PRESETS, type MediaAssetResult } from '../../../_shared/media/types'
import { ImageIcon, Upload, X, Sparkles } from 'lucide-react'
import type { SectionStatus } from '@/lib/posts/types'

export function ImagesTab() {
  const { state } = usePostEditor()
  const { post, activeLocale } = state
  const [coverUrl, setCoverUrl] = useState(post.coverImageUrl)
  const [isSaving, setIsSaving] = useState(false)
  const coverGallery = useMediaGallery()
  const addGallery = useMediaGallery()

  const handleCoverSelect = useCallback(async (asset: MediaAssetResult) => {
    setCoverUrl(asset.url)
    setIsSaving(true)
    const result = await savePostCoverImage(post.id, asset.url)
    setIsSaving(false)
    if (!result.ok) { toast.error('Erro ao salvar capa'); setCoverUrl(post.coverImageUrl) }
    else toast.success('Capa atualizada')
  }, [post.id, post.coverImageUrl])

  const handleCoverRemove = useCallback(async () => {
    setCoverUrl(null)
    const result = await savePostCoverImage(post.id, null)
    if (!result.ok) { toast.error('Erro ao remover capa'); setCoverUrl(post.coverImageUrl) }
  }, [post.id, post.coverImageUrl])

  const sectionStatus: SectionStatus = coverUrl ? 'done' : 'empty'

  return (
    <div className="flex flex-col gap-4">
      <SectionBar
        label="Imagens"
        status={sectionStatus}
        statusText={coverUrl ? '1 imagem' : undefined}
        isDirty={false}
        isSaving={isSaving}
        onSave={() => {}}
      />

      {/* Cover Section */}
      <div>
        <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--gem-text)' }}>Capa do Post</h3>
        {coverUrl ? (
          <div className="relative group rounded-lg overflow-hidden" style={{ maxHeight: 280, border: '1px solid var(--gem-border)' }}>
            <img src={coverUrl} alt="Cover" className="w-full object-cover" style={{ maxHeight: 280 }} />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button type="button" onClick={() => coverGallery.openGallery({ folder: 'blog', cropPreset: CROP_PRESETS['blog-cover'] })} className="text-xs text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md">Trocar</button>
              <button type="button" onClick={handleCoverRemove} className="text-xs text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md"><X size={14} /></button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => coverGallery.openGallery({ folder: 'blog', cropPreset: CROP_PRESETS['blog-cover'] })}
            className="w-full flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-12 transition-colors hover:border-[var(--gem-accent)] hover:bg-[var(--gem-accent)]/5"
            style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-dim)' }}
          >
            <Upload size={24} />
            <span className="text-sm">Arraste uma imagem ou clique para selecionar</span>
            <span className="text-[10px]">PNG, JPG, WebP — até 5 MB</span>
          </button>
        )}
      </div>

      {/* Gallery section placeholder — will show body images */}
      <div>
        <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--gem-text)' }}>Galeria</h3>
        <button
          type="button"
          onClick={() => addGallery.openGallery({ folder: 'blog' })}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed py-4 transition-colors hover:border-[var(--gem-accent)] hover:bg-[var(--gem-accent)]/5"
          style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-dim)' }}
        >
          <ImageIcon size={14} />
          <span className="text-xs">Adicionar imagem à galeria</span>
        </button>
      </div>

      <MediaGalleryModal {...coverGallery.galleryProps} onSelect={handleCoverSelect} locale={activeLocale === 'pt-br' ? 'pt-BR' : 'en'} siteId={post.siteId} />
      <MediaGalleryModal {...addGallery.galleryProps} onSelect={() => {}} locale={activeLocale === 'pt-br' ? 'pt-BR' : 'en'} siteId={post.siteId} />
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles and commit**

```bash
npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -c "error" || echo "No type errors"
git add apps/web/src/app/cms/\(authed\)/posts/_components/tabs/images-tab.tsx
git commit -m "feat(posts): add Images tab with cover management and gallery"
```

---

## Task 14: SEO Tab

**Files:**
- Create: `apps/web/src/app/cms/(authed)/posts/_components/tabs/seo-tab.tsx`

- [ ] **Step 1: Implement SeoTab**

SEO score ring, SERP preview, meta fields with character counters, OG image precedence, JSON-LD preview.

```typescript
// apps/web/src/app/cms/(authed)/posts/_components/tabs/seo-tab.tsx
'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { usePostEditor } from '../post-editor-context'
import { SectionBar } from '../section-bar'
import { ReadinessRing } from '../readiness-ring'
import { savePostSeo } from '../../actions'
import { Sparkles } from 'lucide-react'
import type { SectionStatus } from '@/lib/posts/types'

function computeSeoScore(metaTitle: string, metaDesc: string, slug: string, hasOgImage: boolean): { score: number; items: Array<{ label: string; ok: boolean; detail: string }> } {
  const items: Array<{ label: string; ok: boolean; detail: string }> = []

  const titleLen = metaTitle.length
  const titleOk = titleLen >= 50 && titleLen <= 60
  items.push({ label: 'Título SEO', ok: titleOk, detail: titleOk ? `${titleLen} chars (ideal)` : titleLen === 0 ? 'Vazio' : `${titleLen} chars (ideal: 50-60)` })

  const descLen = metaDesc.length
  const descOk = descLen >= 150 && descLen <= 160
  items.push({ label: 'Meta Description', ok: descOk, detail: descOk ? `${descLen} chars (ideal)` : descLen === 0 ? 'Vazio' : `${descLen} chars (ideal: 150-160)` })

  const slugOk = slug.length > 0 && !slug.includes(' ')
  items.push({ label: 'Slug', ok: slugOk, detail: slugOk ? slug : 'Slug inválido' })

  items.push({ label: 'OG Image', ok: hasOgImage, detail: hasOgImage ? 'Definida' : 'Usando fallback' })

  const passCount = items.filter(i => i.ok).length
  const score = Math.round((passCount / items.length) * 100)
  return { score, items }
}

export function SeoTab() {
  const { state, dispatch } = usePostEditor()
  const { post, activeLocale } = state
  const tx = post.translations.find(t => t.locale === activeLocale) ?? post.translations[0]

  const [metaTitle, setMetaTitle] = useState(tx?.metaTitle ?? '')
  const [metaDescription, setMetaDescription] = useState(tx?.metaDescription ?? '')
  const [ogImageUrl, setOgImageUrl] = useState(tx?.ogImageUrl ?? null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const t = post.translations.find(t => t.locale === activeLocale) ?? post.translations[0]
    if (t) {
      setMetaTitle(t.metaTitle ?? '')
      setMetaDescription(t.metaDescription ?? '')
      setOgImageUrl(t.ogImageUrl ?? null)
    }
  }, [activeLocale, post.translations])

  const slug = tx?.slug ?? ''
  const { score, items } = useMemo(() => computeSeoScore(metaTitle, metaDescription, slug, !!ogImageUrl || !!post.coverImageUrl), [metaTitle, metaDescription, slug, ogImageUrl, post.coverImageUrl])

  const markDirty = useCallback(() => {
    dispatch({ type: 'SET_DIRTY', tab: 'seo', dirty: true })
  }, [dispatch])

  const handleSave = useCallback(async () => {
    if (!tx) return
    setIsSaving(true)
    const result = await savePostSeo(post.id, activeLocale, { metaTitle, metaDescription, ogImageUrl })
    setIsSaving(false)
    if (result.ok) {
      dispatch({ type: 'SAVE_TAB', tab: 'seo' })
      toast.success('SEO salvo')
    } else {
      toast.error(result.error)
    }
  }, [post.id, activeLocale, metaTitle, metaDescription, ogImageUrl, tx, dispatch])

  useEffect(() => {
    const handler = () => { if (state.dirty.seo) void handleSave() }
    document.addEventListener('posts:save-tab', handler)
    return () => document.removeEventListener('posts:save-tab', handler)
  }, [handleSave, state.dirty.seo])

  const sectionStatus: SectionStatus = score >= 70 ? 'done' : metaTitle || metaDescription ? 'warn' : 'empty'

  return (
    <div className="flex flex-col gap-4">
      <SectionBar label="SEO" status={sectionStatus} statusText={`${score}/100`} isDirty={state.dirty.seo} isSaving={isSaving} onSave={handleSave} />

      {/* SEO Score */}
      <div className="flex items-start gap-4 rounded-lg border p-4" style={{ background: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
        <ReadinessRing score={score} size={64} strokeWidth={5} />
        <div className="flex-1 space-y-1.5">
          {items.map(item => (
            <div key={item.label} className="flex items-center gap-2 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.ok ? 'var(--gem-done)' : 'var(--gem-warn)' }} />
              <span style={{ color: 'var(--gem-muted)' }}>{item.label}</span>
              <span className="ml-auto" style={{ color: item.ok ? 'var(--gem-done)' : 'var(--gem-warn)' }}>{item.detail}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Meta Title */}
      <div>
        <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--gem-text)' }}>Meta Title</label>
        <input
          type="text"
          value={metaTitle}
          onChange={e => { setMetaTitle(e.target.value); markDirty() }}
          placeholder="Título para motores de busca"
          className="w-full bg-transparent rounded-lg border px-3 py-2 text-sm focus:border-[var(--gem-accent)] focus:outline-none transition-colors"
          style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-text)' }}
        />
        <div className="flex justify-end mt-1">
          <CharCounter current={metaTitle.length} min={50} max={60} />
        </div>
      </div>

      {/* Meta Description */}
      <div>
        <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--gem-text)' }}>Meta Description</label>
        <textarea
          value={metaDescription}
          onChange={e => { setMetaDescription(e.target.value); markDirty() }}
          placeholder="Descrição para resultados de busca"
          rows={3}
          className="w-full bg-transparent rounded-lg border px-3 py-2 text-sm resize-y focus:border-[var(--gem-accent)] focus:outline-none transition-colors"
          style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-text)' }}
        />
        <div className="flex justify-end mt-1">
          <CharCounter current={metaDescription.length} min={150} max={160} />
        </div>
      </div>

      {/* SERP Preview */}
      <div className="rounded-lg border p-4" style={{ background: 'var(--gem-well)', borderColor: 'var(--gem-border)' }}>
        <h4 className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--gem-dim)' }}>Prévia Google</h4>
        <div className="space-y-0.5">
          <p className="text-sm" style={{ color: '#8ab4f8' }}>{metaTitle || tx?.title || 'Título do post'}</p>
          <p className="text-[11px]" style={{ color: '#bdc1c6' }}>bythiagofigueiredo.com/blog/{slug || 'slug'}</p>
          <p className="text-[11px] line-clamp-2" style={{ color: '#969ba1' }}>{metaDescription || 'Adicione uma meta description...'}</p>
        </div>
      </div>
    </div>
  )
}

function CharCounter({ current, min, max }: { current: number; min: number; max: number }) {
  const inRange = current >= min && current <= max
  return (
    <span className="text-[10px]" style={{ color: inRange ? 'var(--gem-done)' : current > max ? 'var(--gem-danger)' : 'var(--gem-dim)' }}>
      {current}/{max}
    </span>
  )
}
```

- [ ] **Step 2: Verify it compiles and commit**

```bash
npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -c "error" || echo "No type errors"
git add apps/web/src/app/cms/\(authed\)/posts/_components/tabs/seo-tab.tsx
git commit -m "feat(posts): add SEO tab with score ring, SERP preview, meta fields"
```

---

## Task 15: Social Tab

**Files:**
- Create: `apps/web/src/app/cms/(authed)/posts/_components/tabs/social-tab.tsx`

- [ ] **Step 1: Implement SocialTab**

4 platform cards (YouTube, Facebook, Instagram, Bluesky), per-language captions, character counters, scheduling mode selector.

```typescript
// apps/web/src/app/cms/(authed)/posts/_components/tabs/social-tab.tsx
'use client'

import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { usePostEditor } from '../post-editor-context'
import { SectionBar } from '../section-bar'
import { savePostSocialConfig } from '../../actions'
import type { SocialConfig, DeliveryFormat } from '@/lib/social/types'
import type { Provider } from '@tn-figueiredo/social'
import type { SectionStatus } from '@/lib/posts/types'

const PLATFORMS: Array<{ provider: Provider; label: string; color: string; charLimit: number }> = [
  { provider: 'youtube', label: 'YouTube Community', color: '#f87171', charLimit: 5000 },
  { provider: 'facebook', label: 'Facebook', color: '#60a5fa', charLimit: 63206 },
  { provider: 'instagram', label: 'Instagram', color: '#e879f9', charLimit: 2200 },
  { provider: 'bluesky', label: 'Bluesky', color: '#38bdf8', charLimit: 300 },
]

const DEFAULT_SOCIAL_CONFIG: SocialConfig = {
  enabled: false,
  platforms: [],
  captions: {},
  hashtags: [],
  image_source: 'cover_image',
  ig_template: 'card',
  formats: {},
}

export function SocialTab() {
  const { state, dispatch } = usePostEditor()
  const { post, activeLocale } = state
  const [config, setConfig] = useState<SocialConfig>(post.socialConfig ?? DEFAULT_SOCIAL_CONFIG)
  const [expandedPlatform, setExpandedPlatform] = useState<Provider | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const updateConfig = useCallback((patch: Partial<SocialConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...patch }
      dispatch({ type: 'SET_DIRTY', tab: 'social', dirty: true })
      return next
    })
  }, [dispatch])

  const togglePlatform = useCallback((provider: Provider) => {
    setConfig(prev => {
      const platforms = prev.platforms.includes(provider)
        ? prev.platforms.filter(p => p !== provider)
        : [...prev.platforms, provider]
      const enabled = platforms.length > 0
      dispatch({ type: 'SET_DIRTY', tab: 'social', dirty: true })
      return { ...prev, platforms, enabled }
    })
  }, [dispatch])

  const setCaption = useCallback((provider: Provider, locale: 'pt' | 'en', text: string) => {
    setConfig(prev => {
      const captions = { ...prev.captions, [provider]: { ...prev.captions[provider], [locale]: text } }
      dispatch({ type: 'SET_DIRTY', tab: 'social', dirty: true })
      return { ...prev, captions }
    })
  }, [dispatch])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    const result = await savePostSocialConfig(post.id, config)
    setIsSaving(false)
    if (result.ok) {
      dispatch({ type: 'SAVE_TAB', tab: 'social' })
      toast.success('Social config salva')
    } else {
      toast.error(result.error)
    }
  }, [post.id, config, dispatch])

  useEffect(() => {
    const handler = () => { if (state.dirty.social) void handleSave() }
    document.addEventListener('posts:save-tab', handler)
    return () => document.removeEventListener('posts:save-tab', handler)
  }, [handleSave, state.dirty.social])

  const configuredCount = config.platforms.length
  const sectionStatus: SectionStatus = configuredCount > 0 ? 'done' : 'empty'
  const captionLocale = activeLocale === 'pt-br' ? 'pt' : 'en' as const

  const hasMultiLang = post.translations.length > 1

  return (
    <div className="flex flex-col gap-4">
      <SectionBar label="Social" status={sectionStatus} statusText={configuredCount > 0 ? `${configuredCount} de 4` : undefined} isDirty={state.dirty.social} isSaving={isSaving} onSave={handleSave} />

      {/* Multi-language info banner */}
      {hasMultiLang && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-[11px]" style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', color: '#38bdf8' }}>
          Este post tem PT + EN. Cada idioma gera posts sociais separados com intervalo de 30 min para evitar flood.
        </div>
      )}

      {/* Platform cards */}
      <div className="grid grid-cols-4 gap-2">
        {PLATFORMS.map(({ provider, label, color }) => {
          const isActive = config.platforms.includes(provider)
          return (
            <button
              key={provider}
              type="button"
              onClick={() => togglePlatform(provider)}
              className="flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all"
              style={{
                borderColor: isActive ? color : 'var(--gem-border)',
                background: isActive ? `${color}10` : 'var(--gem-surface)',
              }}
            >
              <span className="w-6 h-6 rounded-full" style={{ background: color }} />
              <span className="text-[10px] font-medium" style={{ color: isActive ? color : 'var(--gem-muted)' }}>{label.split(' ')[0]}</span>
              <span className="text-[9px]" style={{ color: isActive ? 'var(--gem-done)' : 'var(--gem-dim)' }}>
                {isActive ? 'Configurado' : 'Não configurado'}
              </span>
            </button>
          )
        })}
      </div>

      {/* Expanded platform editors */}
      {PLATFORMS.filter(p => config.platforms.includes(p.provider)).map(({ provider, label, color, charLimit }) => {
        const caption = config.captions[provider]?.[captionLocale] ?? ''
        const isExpanded = expandedPlatform === provider

        return (
          <div
            key={provider}
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: `${color}40`, background: 'var(--gem-surface)' }}
          >
            <button
              type="button"
              onClick={() => setExpandedPlatform(isExpanded ? null : provider)}
              className="w-full flex items-center justify-between px-4 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ background: color }} />
                <span className="text-xs font-medium" style={{ color: 'var(--gem-text)' }}>{label}</span>
              </div>
              <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>{isExpanded ? '▲' : '▼'}</span>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <label className="text-[10px] mb-1 block" style={{ color: 'var(--gem-dim)' }}>
                    Texto ({captionLocale.toUpperCase()})
                  </label>
                  <textarea
                    value={caption}
                    onChange={e => setCaption(provider, captionLocale, e.target.value)}
                    rows={3}
                    className="w-full bg-transparent rounded border px-3 py-2 text-xs resize-y focus:border-[var(--gem-accent)] focus:outline-none"
                    style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-text)' }}
                    maxLength={charLimit}
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px]" style={{ color: 'var(--gem-dim)' }}>Limite: {charLimit.toLocaleString()}</span>
                    <span
                      className="text-[9px]"
                      style={{ color: caption.length > charLimit * 0.9 ? 'var(--gem-warn)' : 'var(--gem-dim)' }}
                    >
                      {caption.length}/{charLimit}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles and commit**

```bash
npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -c "error" || echo "No type errors"
git add apps/web/src/app/cms/\(authed\)/posts/_components/tabs/social-tab.tsx
git commit -m "feat(posts): add Social tab with 4 platform cards and per-lang captions"
```

---

## Task 16: Publish Tab

**Files:**
- Create: `apps/web/src/app/cms/(authed)/posts/_components/tabs/publish-tab.tsx`

- [ ] **Step 1: Implement PublishTab**

Schedule hero + multi-lang timeline + distribution section + pre-publish review grid + URL preview.

```typescript
// apps/web/src/app/cms/(authed)/posts/_components/tabs/publish-tab.tsx
'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { usePostEditor } from '../post-editor-context'
import { SectionBar } from '../section-bar'
import { ReadinessRing } from '../readiness-ring'
import { schedulePost, publishPost, savePostPublishSettings } from '../../actions'
import { computeReadiness, type ReadinessInput } from '@/lib/posts/readiness'
import type { SectionStatus, PostTab } from '@/lib/posts/types'

export function PublishTab() {
  const router = useRouter()
  const { state, dispatch } = usePostEditor()
  const { post, activeLocale } = state
  const tx = post.translations.find(t => t.locale === activeLocale) ?? post.translations[0]

  const [scheduleDate, setScheduleDate] = useState(() => {
    if (!post.scheduledAt) return ''
    return new Date(post.scheduledAt).toISOString().slice(0, 10)
  })
  const [scheduleTime, setScheduleTime] = useState(() => {
    if (!post.scheduledAt) return '09:00'
    return new Date(post.scheduledAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  })
  const [timezone] = useState('America/Sao_Paulo')
  const [includeNewsletter, setIncludeNewsletter] = useState(post.includeInNewsletter)
  const [isSaving, setIsSaving] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  const handleSchedule = useCallback(async () => {
    if (!scheduleDate) { toast.error('Selecione uma data'); return }
    setIsScheduling(true)
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString()
    const result = await schedulePost(post.id, scheduledAt, timezone)
    setIsScheduling(false)
    if (result.ok) {
      toast.success('Post agendado!')
      dispatch({ type: 'SAVE_TAB', tab: 'publish' })
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }, [post.id, scheduleDate, scheduleTime, timezone, dispatch, router])

  const handlePublish = useCallback(async () => {
    if (!confirm('Publicar imediatamente? O post ficará visível no /blog e os posts sociais serão disparados.')) return
    setIsPublishing(true)
    const result = await publishPost(post.id)
    setIsPublishing(false)
    if (result.ok) {
      toast.success('Post publicado!')
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }, [post.id, router])

  const handleSaveSettings = useCallback(async () => {
    setIsSaving(true)
    const result = await savePostPublishSettings(post.id, { includeInNewsletter: includeNewsletter })
    setIsSaving(false)
    if (result.ok) {
      dispatch({ type: 'SAVE_TAB', tab: 'publish' })
      toast.success('Configurações salvas')
    } else {
      toast.error(result.error)
    }
  }, [post.id, includeNewsletter, dispatch])

  useEffect(() => {
    const handler = () => { if (state.dirty.publish) void handleSaveSettings() }
    document.addEventListener('posts:save-tab', handler)
    return () => document.removeEventListener('posts:save-tab', handler)
  }, [handleSaveSettings, state.dirty.publish])

  const socialConfig = post.socialConfig
  const configuredPlatforms = socialConfig?.enabled ? socialConfig.platforms.length : 0
  const hasMultiLang = post.translations.length > 1
  const sectionStatus: SectionStatus = post.scheduledAt ? 'done' : scheduleDate ? 'warn' : 'empty'

  // Pre-publish review
  const reviewItems: Array<{ label: string; value: string; ok: boolean; tab?: PostTab }> = [
    { label: 'Conteúdo', value: tx?.title ? `rev.${post.translations.length}` : 'Vazio', ok: !!(tx?.title && tx?.contentMdx), tab: 'content' },
    { label: 'Imagens', value: post.coverImageUrl ? '1 img' : 'Sem capa', ok: !!post.coverImageUrl, tab: 'images' },
    { label: 'SEO', value: tx?.metaTitle ? 'Configurado' : 'Pendente', ok: !!(tx?.metaTitle && tx?.metaDescription), tab: 'seo' },
    { label: 'Social', value: configuredPlatforms > 0 ? `${configuredPlatforms} de 4` : 'Não configurado', ok: configuredPlatforms > 0, tab: 'social' },
    { label: 'Data', value: scheduleDate ? `${scheduleDate} ${scheduleTime}` : 'Não definida', ok: !!scheduleDate },
    { label: 'Newsletter', value: includeNewsletter ? 'Incluído' : 'Não incluído', ok: true },
  ]

  return (
    <div className="flex flex-col gap-4">
      <SectionBar label="Publicação" status={sectionStatus} isDirty={state.dirty.publish} isSaving={isSaving} onSave={handleSaveSettings} />

      {/* Schedule Hero */}
      <div className="rounded-xl p-5" style={{ background: 'var(--gem-surface)', border: '1px solid var(--gem-border)' }}>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-lg">📅</span>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--gem-text)' }}>Agendamento</h3>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label className="text-[10px] mb-1 block" style={{ color: 'var(--gem-dim)' }}>Data</label>
            <input
              type="date"
              value={scheduleDate}
              onChange={e => { setScheduleDate(e.target.value); dispatch({ type: 'SET_DIRTY', tab: 'publish', dirty: true }) }}
              className="w-full bg-transparent rounded border px-2 py-1.5 text-xs focus:border-[var(--gem-accent)] focus:outline-none"
              style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-text)' }}
            />
          </div>
          <div>
            <label className="text-[10px] mb-1 block" style={{ color: 'var(--gem-dim)' }}>Horário</label>
            <input
              type="time"
              value={scheduleTime}
              onChange={e => { setScheduleTime(e.target.value); dispatch({ type: 'SET_DIRTY', tab: 'publish', dirty: true }) }}
              className="w-full bg-transparent rounded border px-2 py-1.5 text-xs focus:border-[var(--gem-accent)] focus:outline-none"
              style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-text)' }}
            />
          </div>
          <div>
            <label className="text-[10px] mb-1 block" style={{ color: 'var(--gem-dim)' }}>Fuso</label>
            <div className="text-[10px] px-2 py-2 rounded border" style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-muted)' }}>
              BRT (UTC−3)
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSchedule}
            disabled={isScheduling || !scheduleDate}
            className="flex-1 text-xs py-2 rounded-lg font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--gem-accent), #6366f1)', color: 'white' }}
          >
            {isScheduling ? 'Agendando...' : scheduleDate ? `Agendar para ${scheduleDate} às ${scheduleTime}` : 'Selecione uma data'}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing}
            className="text-xs px-4 py-2 rounded-lg border font-medium transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
            style={{ borderColor: 'var(--gem-done)', color: 'var(--gem-done)' }}
          >
            {isPublishing ? 'Publicando...' : 'Publicar agora'}
          </button>
        </div>
      </div>

      {/* Multi-Lang Timeline */}
      {hasMultiLang && scheduleDate && (
        <div className="rounded-lg border p-4" style={{ background: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <h4 className="text-[10px] font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--gem-dim)' }}>Timeline Multi-Idioma</h4>
          <div className="flex items-center gap-3">
            <div className="flex-1 text-center">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>PT</span>
              <p className="text-[10px] mt-1" style={{ color: 'var(--gem-muted)' }}>{scheduleTime}</p>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-8 h-px" style={{ background: 'var(--gem-border)' }} />
              <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>+30 min</span>
              <div className="w-8 h-px" style={{ background: 'var(--gem-border)' }} />
            </div>
            <div className="flex-1 text-center">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8' }}>EN</span>
              <p className="text-[10px] mt-1" style={{ color: 'var(--gem-muted)' }}>
                {(() => {
                  const [h, m] = scheduleTime.split(':').map(Number)
                  const d = new Date(2000, 0, 1, h, m + 30)
                  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                })()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Distribuição */}
      <div className="rounded-lg border p-4" style={{ background: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
        <h4 className="text-[10px] font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--gem-dim)' }}>Distribuição</h4>
        <div className="space-y-2">
          {configuredPlatforms > 0 && socialConfig?.platforms.map(p => (
            <div key={p} className="flex items-center justify-between text-[11px]">
              <span style={{ color: 'var(--gem-muted)' }}>{p}</span>
              <button type="button" onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', tab: 'social' })} className="text-[10px] hover:underline" style={{ color: 'var(--gem-accent)' }}>Editar</button>
            </div>
          ))}
          <div className="border-t pt-2 mt-2" style={{ borderColor: 'var(--gem-border)' }}>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-[11px]" style={{ color: 'var(--gem-muted)' }}>Incluir na próxima newsletter</span>
              <input
                type="checkbox"
                checked={includeNewsletter}
                onChange={e => { setIncludeNewsletter(e.target.checked); dispatch({ type: 'SET_DIRTY', tab: 'publish', dirty: true }) }}
                className="rounded border-slate-600 w-3.5 h-3.5 accent-emerald-500"
              />
            </label>
            <p className="text-[9px] mt-1" style={{ color: 'var(--gem-dim)' }}>Vários posts podem ser incluídos na mesma edição quinzenal</p>
          </div>
        </div>
      </div>

      {/* Pre-Publish Review */}
      <div className="rounded-lg border p-4" style={{ background: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
        <h4 className="text-[10px] font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--gem-dim)' }}>Revisão Pré-Publicação</h4>
        <div className="grid grid-cols-3 gap-2">
          {reviewItems.map(item => (
            <button
              key={item.label}
              type="button"
              onClick={() => item.tab && dispatch({ type: 'SET_ACTIVE_TAB', tab: item.tab })}
              className="rounded-lg border p-2.5 text-left transition-colors hover:border-[var(--gem-accent)]"
              style={{
                borderColor: 'var(--gem-border)',
                borderLeft: `3px solid ${item.ok ? 'var(--gem-done)' : 'var(--gem-warn)'}`,
                cursor: item.tab ? 'pointer' : 'default',
              }}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: item.ok ? 'var(--gem-done)' : 'var(--gem-warn)' }} />
                <span className="text-[10px] font-medium" style={{ color: 'var(--gem-text)' }}>{item.label}</span>
              </span>
              <p className="text-[9px] mt-0.5" style={{ color: 'var(--gem-dim)' }}>{item.value}</p>
            </button>
          ))}
        </div>
      </div>

      {/* URL & Visibilidade */}
      <div className="rounded-lg border p-4" style={{ background: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
        <h4 className="text-[10px] font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--gem-dim)' }}>URL & Visibilidade</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] rounded px-2 py-1.5" style={{ background: 'var(--gem-well)' }}>
            <span className="px-1 py-0.5 rounded text-[8px] font-bold" style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>Preview</span>
            <span style={{ color: 'var(--gem-dim)' }}>bythiagofigueiredo.com/blog/{tx?.slug ?? '...'}</span>
          </div>
          <p className="text-[9px]" style={{ color: 'var(--gem-dim)' }}>O post só existe publicamente após a publicação.</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles and commit**

```bash
npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -c "error" || echo "No type errors"
git add apps/web/src/app/cms/\(authed\)/posts/_components/tabs/publish-tab.tsx
git commit -m "feat(posts): add Publish tab with schedule, timeline, review, distribution"
```

---

## Task 17: Pipeline detail — graduation navigation

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx`

- [ ] **Step 1: Update graduation handler to navigate to /cms/posts/[id]**

In `pipeline-item-detail.tsx`, the existing `handleGraduate` function calls `/api/pipeline/items/${item.id}/graduate` and returns `entity_id`. After successful graduation, navigate to the new post detail page.

Find the `handleGraduate` callback and the `BlogPostCard` usage. Update `BlogPostCard`'s `onGraduate` handler to navigate to `/cms/posts/[entity_id]` after successful graduation:

```diff
  const handleGraduate = useCallback(async (): Promise<{ entity_id?: string }> => {
    const res = await fetch(`/api/pipeline/items/${item.id}/graduate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'blog_post' }),
    })
    if (!res.ok) throw new Error('Graduate failed')
    const json = await res.json()
+   if (json.data?.entity_id) {
+     router.push(`/cms/posts/${json.data.entity_id}`)
+   }
    return { entity_id: json.data?.entity_id }
  }, [item.id])
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -i "pipeline-item-detail" || echo "No type errors"`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/pipeline-item-detail.tsx
git commit -m "feat(pipeline): navigate to /cms/posts/[id] after graduation"
```

---

## Task 18: DB migration — add missing columns

**Files:**
- Create: `supabase/migrations/YYYYMMDD_posts_redesign_columns.sql`

- [ ] **Step 1: Check if columns exist, then create migration if needed**

The spec requires `include_in_newsletter`, `rss_included`, `search_indexable`, `canonical_url` on `blog_posts`. Check if they exist:

```bash
grep -r "include_in_newsletter\|rss_included\|search_indexable\|canonical_url" supabase/migrations/ | head -10
```

If missing, create migration:

```sql
-- supabase/migrations/20260515200000_posts_redesign_columns.sql
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS include_in_newsletter boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS rss_included boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS search_indexable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS canonical_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz DEFAULT NULL;
```

- [ ] **Step 2: Run migration locally**

```bash
npm run db:push:local
```
Expected: Migration applies cleanly

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260515200000_posts_redesign_columns.sql
git commit -m "chore(db): add blog_posts columns for posts redesign"
```

---

## Task 19: Full integration test

**Files:**
- Test: `apps/web/test/lib/posts/readiness.test.ts` (already exists from Task 1)
- Test: `apps/web/test/lib/posts/post-editor-reducer.test.ts` (already exists from Task 2)

- [ ] **Step 1: Run all tests**

```bash
npm run test:web
```
Expected: All tests pass, including the new readiness and reducer tests.

- [ ] **Step 2: Run full typecheck**

```bash
npx tsc --noEmit --project apps/web/tsconfig.json
```
Expected: No type errors

- [ ] **Step 3: Verify dev server starts cleanly**

```bash
cd apps/web && npx next dev --port 3001
```
Navigate to `http://localhost:3001/cms/posts` — should render the Posts kanban (empty state).
Navigate to `http://localhost:3001/cms/pipeline/blog_post` — should show only 3 columns.

- [ ] **Step 4: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix(posts): resolve integration issues from posts redesign"
```

---

## Task 20: Smoke test the full flow

**Files:** No new files — verification only.

- [ ] **Step 1: Test Pipeline → Graduation → Posts flow**

1. Go to `/cms/pipeline/blog_post`
2. Verify only 3 columns: Ideia, Rascunho, Pronto
3. Open an existing pipeline item in "Pronto" stage
4. Click "Graduar para Post"
5. Verify navigation to `/cms/posts/[id]`
6. Verify all 5 tabs render: Conteúdo, Imagens, SEO, Social, Publicação
7. Verify sidebar shows StatusCard, OriginCard, PubSummaryCard, SectionsPanel, ReadinessRing

- [ ] **Step 2: Test tab dirty state and save**

1. In Conteúdo tab, edit the title
2. Verify amber dirty indicator appears in SectionBar
3. Verify tab dot turns amber in PostTabBar
4. Press ⌘S
5. Verify "Conteúdo salvo" toast appears
6. Verify dirty indicator clears

- [ ] **Step 3: Test Posts Kanban**

1. Navigate to `/cms/posts`
2. Verify 3 columns: Em edição, Agendado, Publicado
3. Verify post cards show cover thumbnail, title, locale badges, social platform dots
4. Verify origin badge (← TG-86) links back to pipeline item

- [ ] **Step 4: Test publication flow**

1. In Publicação tab, set a date and time
2. Click "Agendar para [date]"
3. Verify post moves to "Agendado" column in kanban
4. Or click "Publicar agora" and confirm dialog
5. Verify post moves to "Publicado" column

- [ ] **Step 5: Commit final state**

```bash
npm run test:web
git add -A
git commit -m "feat(posts): complete Pipeline → Posts redesign implementation"
```
