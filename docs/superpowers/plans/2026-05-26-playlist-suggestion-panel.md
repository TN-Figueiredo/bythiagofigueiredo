# Playlist Suggestion Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a playlist-aware suggestion panel below the weekly grid so users can visually browse available items organized by playlist and click-to-assign them to empty slots.

**Architecture:** Extend SlotCandidate with playlist fields (no new DB queries), add pure ranking/grouping functions (TDD), build a collapsible panel component, wire a "select item → highlight compatible slots → click to assign" flow through PipelineOverview.

**Tech Stack:** React 19, TypeScript, Vitest, SWR, Tailwind 4, gem design tokens

---

### Task 1: Extend SlotCandidate type and fetcher

**Files:**
- Modify: `apps/web/src/lib/pipeline/up-next-types.ts:122`
- Modify: `apps/web/src/lib/pipeline/up-next-fetcher.ts:218`
- Modify: `apps/web/test/cms/use-slot-assignment.test.ts` (update factories)

- [ ] **Step 1: Update SlotCandidate type**

In `apps/web/src/lib/pipeline/up-next-types.ts`, change line 122:

```ts
export type SlotCandidate = Pick<PipelineItemWithSlot,
  'id' | 'title' | 'stage' | 'format' | 'language'
  | 'playlist_id' | 'playlist_name' | 'playlist_position' | 'playlist_total'
>
```

Also update line 131 (candidates in UpNextApiResponse) to use the SlotCandidate type alias:

```ts
candidates: SlotCandidate[]
```

- [ ] **Step 2: Update fetcher to include playlist fields**

In `apps/web/src/lib/pipeline/up-next-fetcher.ts`, change line 218:

```ts
candidates: pipelineItems.map(({ id, title, stage, format, language, playlist_id, playlist_name, playlist_position, playlist_total }) =>
  ({ id, title, stage, format, language, playlist_id, playlist_name, playlist_position, playlist_total })),
```

- [ ] **Step 3: Update test factories**

In `apps/web/test/cms/use-slot-assignment.test.ts`, update `makeSnapshot` candidate factories to include the new fields with defaults:

```ts
const ITEM_A = { id: 'a', title: 'Video A', stage: 'draft' as const, format: 'video' as const, language: 'pt-br' as const, playlist_id: null, playlist_name: null, playlist_position: null, playlist_total: null }
```

Do the same in `apps/web/test/cms/pipeline-overview.test.tsx` if it has candidate factories.

- [ ] **Step 4: Run tests to verify no regressions**

Run: `npm run test:web -- --run --reporter=verbose 2>&1 | tail -20`
Expected: All existing tests pass (type changes are backward-compatible since new fields are nullable).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/up-next-types.ts apps/web/src/lib/pipeline/up-next-fetcher.ts apps/web/test/cms/use-slot-assignment.test.ts apps/web/test/cms/pipeline-overview.test.tsx
git commit -m "feat(pipeline): extend SlotCandidate with playlist fields"
```

---

### Task 2: Pure function — groupCandidatesByPlaylist (TDD)

**Files:**
- Create: `apps/web/src/lib/pipeline/suggest-for-slots.ts`
- Create: `apps/web/test/lib/pipeline/suggest-for-slots.test.ts`

- [ ] **Step 1: Write failing tests for groupCandidatesByPlaylist**

Create `apps/web/test/lib/pipeline/suggest-for-slots.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { groupCandidatesByPlaylist } from '@/lib/pipeline/suggest-for-slots'
import type { SlotCandidate } from '@/lib/pipeline/up-next-types'

function makeCandidate(overrides: Partial<SlotCandidate> = {}): SlotCandidate {
  return {
    id: 'c1',
    title: 'Test Item',
    stage: 'draft',
    format: 'video',
    language: 'pt-br',
    playlist_id: null,
    playlist_name: null,
    playlist_position: null,
    playlist_total: null,
    ...overrides,
  }
}

describe('groupCandidatesByPlaylist', () => {
  it('returns empty array for empty candidates', () => {
    expect(groupCandidatesByPlaylist([])).toEqual([])
  })

  it('groups items without playlist into Avulsos', () => {
    const candidates = [makeCandidate({ id: '1' }), makeCandidate({ id: '2' })]
    const groups = groupCandidatesByPlaylist(candidates)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.playlistName).toBe('Avulsos')
    expect(groups[0]!.playlistId).toBeNull()
    expect(groups[0]!.items).toHaveLength(2)
  })

  it('groups items by playlist_id', () => {
    const candidates = [
      makeCandidate({ id: '1', playlist_id: 'p1', playlist_name: 'CSS Mastery', playlist_position: 1, playlist_total: 5 }),
      makeCandidate({ id: '2', playlist_id: 'p1', playlist_name: 'CSS Mastery', playlist_position: 2, playlist_total: 5 }),
      makeCandidate({ id: '3', playlist_id: 'p2', playlist_name: 'React Deep', playlist_position: 1, playlist_total: 3 }),
    ]
    const groups = groupCandidatesByPlaylist(candidates)
    expect(groups).toHaveLength(2)
    expect(groups.find(g => g.playlistName === 'CSS Mastery')!.items).toHaveLength(2)
    expect(groups.find(g => g.playlistName === 'React Deep')!.items).toHaveLength(1)
  })

  it('sorts near-completion playlists first', () => {
    const candidates = [
      makeCandidate({ id: '1', playlist_id: 'p1', playlist_name: 'Big Playlist', playlist_position: 1, playlist_total: 20 }),
      makeCandidate({ id: '2', playlist_id: 'p2', playlist_name: 'Almost Done', playlist_position: 9, playlist_total: 10 }),
    ]
    const groups = groupCandidatesByPlaylist(candidates)
    expect(groups[0]!.playlistName).toBe('Almost Done')
    expect(groups[0]!.nearCompletion).toBe(true)
  })

  it('marks nearCompletion when <=20% items remain', () => {
    const candidates = [
      makeCandidate({ id: '1', playlist_id: 'p1', playlist_name: 'PL', playlist_position: 9, playlist_total: 10 }),
    ]
    const groups = groupCandidatesByPlaylist(candidates)
    expect(groups[0]!.nearCompletion).toBe(true)
  })

  it('Avulsos group always sorted last', () => {
    const candidates = [
      makeCandidate({ id: '1' }),
      makeCandidate({ id: '2', playlist_id: 'p1', playlist_name: 'PL', playlist_position: 1, playlist_total: 5 }),
    ]
    const groups = groupCandidatesByPlaylist(candidates)
    expect(groups[groups.length - 1]!.playlistName).toBe('Avulsos')
  })

  it('sorts items within group by playlist_position', () => {
    const candidates = [
      makeCandidate({ id: '2', playlist_id: 'p1', playlist_name: 'PL', playlist_position: 3, playlist_total: 5 }),
      makeCandidate({ id: '1', playlist_id: 'p1', playlist_name: 'PL', playlist_position: 1, playlist_total: 5 }),
    ]
    const groups = groupCandidatesByPlaylist(candidates)
    expect(groups[0]!.items[0]!.id).toBe('1')
    expect(groups[0]!.items[1]!.id).toBe('2')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:web -- --run test/lib/pipeline/suggest-for-slots.test.ts 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 3: Implement groupCandidatesByPlaylist**

Create `apps/web/src/lib/pipeline/suggest-for-slots.ts`:

```ts
import type { SlotCandidate } from './up-next-types'

export interface PlaylistGroup {
  playlistId: string | null
  playlistName: string
  items: SlotCandidate[]
  progress: { done: number; total: number }
  nearCompletion: boolean
}

export function groupCandidatesByPlaylist(candidates: SlotCandidate[]): PlaylistGroup[] {
  if (candidates.length === 0) return []

  const map = new Map<string | null, SlotCandidate[]>()
  for (const c of candidates) {
    const key = c.playlist_id
    const group = map.get(key)
    if (group) group.push(c)
    else map.set(key, [c])
  }

  const groups: PlaylistGroup[] = []
  for (const [playlistId, items] of map) {
    const first = items[0]!
    const total = first.playlist_total ?? items.length
    const position = Math.max(...items.map(i => i.playlist_position ?? 0))
    const done = playlistId ? position : 0
    const remaining = total - done
    const nearCompletion = playlistId !== null && total > 0 && remaining / total <= 0.2

    items.sort((a, b) => (a.playlist_position ?? 0) - (b.playlist_position ?? 0))

    groups.push({
      playlistId: playlistId ?? null,
      playlistName: playlistId ? (first.playlist_name ?? 'Playlist') : 'Avulsos',
      items,
      progress: { done, total },
      nearCompletion,
    })
  }

  groups.sort((a, b) => {
    if (a.playlistId === null) return 1
    if (b.playlistId === null) return -1
    if (a.nearCompletion !== b.nearCompletion) return a.nearCompletion ? -1 : 1
    return b.progress.total - a.progress.total
  })

  return groups
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:web -- --run test/lib/pipeline/suggest-for-slots.test.ts 2>&1 | tail -10`
Expected: All 7 tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/suggest-for-slots.ts apps/web/test/lib/pipeline/suggest-for-slots.test.ts
git commit -m "feat(pipeline): add groupCandidatesByPlaylist pure function (TDD)"
```

---

### Task 3: Pure function — suggestForSlot (TDD)

**Files:**
- Modify: `apps/web/src/lib/pipeline/suggest-for-slots.ts`
- Modify: `apps/web/test/lib/pipeline/suggest-for-slots.test.ts`

- [ ] **Step 1: Write failing tests for suggestForSlot**

Add to `apps/web/test/lib/pipeline/suggest-for-slots.test.ts`:

```ts
import { suggestForSlot } from '@/lib/pipeline/suggest-for-slots'
import type { WeekSlot } from '@/lib/pipeline/up-next-types'

function makeSlot(overrides: Partial<WeekSlot> = {}): WeekSlot {
  return {
    day: '2026-05-26',
    dayLabel: 'Seg 26',
    hour: null,
    format: 'video',
    channelLocale: 'pt',
    channelId: null,
    isRestDay: false,
    assignedItem: null,
    effortMinutes: 60,
    ...overrides,
  }
}

describe('suggestForSlot', () => {
  it('returns empty for no candidates', () => {
    const slot = makeSlot()
    expect(suggestForSlot(slot, [], [])).toEqual([])
  })

  it('filters by format match', () => {
    const slot = makeSlot({ format: 'video' })
    const candidates = [
      makeCandidate({ id: '1', format: 'video' }),
      makeCandidate({ id: '2', format: 'blog_post' }),
    ]
    const suggestions = suggestForSlot(slot, candidates, [])
    expect(suggestions.every(s => s.candidate.format === 'video')).toBe(true)
  })

  it('excludes items already assigned this week', () => {
    const slot = makeSlot({ format: 'video' })
    const weekSlots = [makeSlot({ assignedItem: { id: '1', title: 'A', stage: 'draft' } })]
    const candidates = [
      makeCandidate({ id: '1', format: 'video' }),
      makeCandidate({ id: '2', format: 'video' }),
    ]
    const suggestions = suggestForSlot(slot, candidates, weekSlots)
    expect(suggestions.map(s => s.candidate.id)).toEqual(['2'])
  })

  it('excludes items at scheduled stage or beyond', () => {
    const slot = makeSlot({ format: 'video' })
    const candidates = [
      makeCandidate({ id: '1', format: 'video', stage: 'scheduled' }),
      makeCandidate({ id: '2', format: 'video', stage: 'published' }),
      makeCandidate({ id: '3', format: 'video', stage: 'ready' }),
    ]
    const suggestions = suggestForSlot(slot, candidates, [])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]!.candidate.id).toBe('3')
  })

  it('ranks progressed items higher', () => {
    const slot = makeSlot({ format: 'video' })
    const candidates = [
      makeCandidate({ id: '1', format: 'video', stage: 'idea' }),
      makeCandidate({ id: '2', format: 'video', stage: 'ready' }),
    ]
    const suggestions = suggestForSlot(slot, candidates, [])
    expect(suggestions[0]!.candidate.id).toBe('2')
  })

  it('penalizes playlists already assigned this week', () => {
    const slot = makeSlot({ day: '2026-05-27', format: 'video' })
    const weekSlots = [
      makeSlot({ day: '2026-05-26', assignedItem: { id: 'x', title: 'X', stage: 'draft' }, format: 'video' }),
    ]
    const candidates = [
      makeCandidate({ id: '1', format: 'video', stage: 'draft', playlist_id: 'p1', playlist_name: 'PL1' }),
      makeCandidate({ id: 'x', format: 'video', stage: 'draft', playlist_id: 'p1', playlist_name: 'PL1' }),
      makeCandidate({ id: '2', format: 'video', stage: 'draft', playlist_id: 'p2', playlist_name: 'PL2' }),
    ]
    const suggestions = suggestForSlot(slot, candidates, weekSlots)
    // p2 candidate ranks higher because p1 already has an assigned item
    expect(suggestions[0]!.candidate.playlist_id).toBe('p2')
  })

  it('respects maxSuggestions limit', () => {
    const slot = makeSlot({ format: 'video' })
    const candidates = Array.from({ length: 10 }, (_, i) =>
      makeCandidate({ id: `${i}`, format: 'video' })
    )
    const suggestions = suggestForSlot(slot, candidates, [], 3)
    expect(suggestions).toHaveLength(3)
  })

  it('tags reason for each suggestion', () => {
    const slot = makeSlot({ format: 'video' })
    const candidates = [makeCandidate({ id: '1', format: 'video', stage: 'ready' })]
    const suggestions = suggestForSlot(slot, candidates, [])
    expect(suggestions[0]!.reason).toBeDefined()
    expect(suggestions[0]!.reasonLabel).toBeTruthy()
  })

  it('filters by language compatibility when slot has channelLocale', () => {
    const slot = makeSlot({ format: 'video', channelLocale: 'pt' })
    const candidates = [
      makeCandidate({ id: '1', format: 'video', language: 'pt-br' }),
      makeCandidate({ id: '2', format: 'video', language: 'en' }),
      makeCandidate({ id: '3', format: 'video', language: 'both' }),
    ]
    const suggestions = suggestForSlot(slot, candidates, [])
    const ids = suggestions.map(s => s.candidate.id)
    expect(ids).toContain('1')
    expect(ids).toContain('3')
    expect(ids).not.toContain('2')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:web -- --run test/lib/pipeline/suggest-for-slots.test.ts 2>&1 | tail -10`
Expected: FAIL — suggestForSlot not found

- [ ] **Step 3: Implement suggestForSlot**

Add to `apps/web/src/lib/pipeline/suggest-for-slots.ts`:

```ts
import { STAGE_ORDER, LOCALE_TO_LANGUAGE } from './up-next-constants'
import type { WeekSlot, SlotCandidate } from './up-next-types'

export interface SlotSuggestion {
  candidate: SlotCandidate
  reason: 'progressed' | 'playlist_rotation' | 'backlog'
  reasonLabel: string
  score: number
}

const STAGE_SCORE: Record<string, number> = Object.fromEntries(
  Object.entries(STAGE_ORDER).map(([stage, order]) => [stage, order * 10])
)

const EXCLUDED_STAGES = new Set(['scheduled', 'published'])

export function suggestForSlot(
  slot: WeekSlot,
  candidates: SlotCandidate[],
  weekSlots: WeekSlot[],
  maxSuggestions = 5,
): SlotSuggestion[] {
  const assignedIds = new Set(
    weekSlots.filter(s => s.assignedItem).map(s => s.assignedItem!.id)
  )

  const assignedPlaylistIds = new Set(
    weekSlots
      .filter(s => s.assignedItem)
      .map(s => {
        const c = candidates.find(c => c.id === s.assignedItem!.id)
        return c?.playlist_id
      })
      .filter(Boolean) as string[]
  )

  const localeLanguage = slot.channelLocale
    ? LOCALE_TO_LANGUAGE[slot.channelLocale as keyof typeof LOCALE_TO_LANGUAGE]
    : null

  const scored = candidates
    .filter(c => {
      if (c.format !== slot.format) return false
      if (EXCLUDED_STAGES.has(c.stage)) return false
      if (assignedIds.has(c.id)) return false
      if (localeLanguage && c.language !== 'both' && c.language !== localeLanguage) return false
      return true
    })
    .map(c => {
      const stageScore = STAGE_SCORE[c.stage] ?? 0
      const playlistPenalty = c.playlist_id && assignedPlaylistIds.has(c.playlist_id) ? -30 : 0
      const score = stageScore + playlistPenalty

      let reason: SlotSuggestion['reason'] = 'backlog'
      let reasonLabel = 'No backlog'
      if (stageScore >= 60) {
        reason = 'progressed'
        reasonLabel = `Avançado (${c.stage})`
      } else if (playlistPenalty === 0 && c.playlist_id) {
        reason = 'playlist_rotation'
        reasonLabel = 'Rodízio de playlist'
      }

      return { candidate: c, reason, reasonLabel, score }
    })
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, maxSuggestions)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:web -- --run test/lib/pipeline/suggest-for-slots.test.ts 2>&1 | tail -10`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/suggest-for-slots.ts apps/web/test/lib/pipeline/suggest-for-slots.test.ts
git commit -m "feat(pipeline): add suggestForSlot ranking function (TDD)"
```

---

### Task 4: PlaylistSuggestionPanel component (TDD)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/playlist-suggestion-panel.tsx`
- Create: `apps/web/test/cms/playlist-suggestion-panel.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/web/test/cms/playlist-suggestion-panel.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

vi.mock('@/lib/pipeline/gem-design', () => ({
  gemMix: vi.fn((color: string, pct: number) => `rgba(0,0,0,${pct / 100})`),
}))

vi.mock('@/lib/pipeline/colors', () => ({
  FORMAT_COLORS: {
    video: { accent: 'var(--gem-accent)', bg: 'rgba(0,0,0,0.08)', text: 'var(--gem-accent)', border: 'rgba(0,0,0,0.25)' },
    blog_post: { accent: 'var(--gem-done)', bg: 'rgba(0,0,0,0.08)', text: 'var(--gem-done)', border: 'rgba(0,0,0,0.25)' },
    newsletter: { accent: 'var(--gem-warn)', bg: 'rgba(0,0,0,0.08)', text: 'var(--gem-warn)', border: 'rgba(0,0,0,0.25)' },
  },
  getPlaylistColor: vi.fn(() => ({ accent: 'var(--gem-accent)', bg: 'rgba(0,0,0,0.08)', text: 'var(--gem-accent)', border: 'rgba(0,0,0,0.25)' })),
}))

import { PlaylistSuggestionPanel } from '../../src/app/cms/(authed)/pipeline/_components/playlist-suggestion-panel'
import type { SlotCandidate, WeekSlot } from '../../src/lib/pipeline/up-next-types'

function makeCandidate(overrides: Partial<SlotCandidate> = {}): SlotCandidate {
  return {
    id: 'c1', title: 'Test', stage: 'draft', format: 'video', language: 'pt-br',
    playlist_id: null, playlist_name: null, playlist_position: null, playlist_total: null,
    ...overrides,
  }
}

describe('PlaylistSuggestionPanel', () => {
  const defaultProps = {
    candidates: [] as SlotCandidate[],
    weekSlots: [] as WeekSlot[],
    onSelectItem: vi.fn(),
    selectedItem: null,
    collapsed: false,
    onToggleCollapse: vi.fn(),
  }

  it('returns null when candidates is empty', () => {
    const { container } = render(<PlaylistSuggestionPanel {...defaultProps} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders panel header with item count', () => {
    const candidates = [makeCandidate({ id: '1' }), makeCandidate({ id: '2' })]
    render(<PlaylistSuggestionPanel {...defaultProps} candidates={candidates} />)
    expect(screen.getByText(/2 disponíveis/)).toBeTruthy()
  })

  it('renders playlist groups', () => {
    const candidates = [
      makeCandidate({ id: '1', playlist_id: 'p1', playlist_name: 'CSS Mastery' }),
      makeCandidate({ id: '2' }),
    ]
    render(<PlaylistSuggestionPanel {...defaultProps} candidates={candidates} />)
    expect(screen.getByText('CSS Mastery')).toBeTruthy()
    expect(screen.getByText('Avulsos')).toBeTruthy()
  })

  it('calls onSelectItem when item chip is clicked', () => {
    const onSelect = vi.fn()
    const candidates = [makeCandidate({ id: '1', title: 'My Video' })]
    render(<PlaylistSuggestionPanel {...defaultProps} candidates={candidates} onSelectItem={onSelect} />)
    fireEvent.click(screen.getByText('My Video'))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }))
  })

  it('highlights selected item with aria-pressed', () => {
    const candidate = makeCandidate({ id: '1', title: 'My Video' })
    render(<PlaylistSuggestionPanel {...defaultProps} candidates={[candidate]} selectedItem={candidate} />)
    const chip = screen.getByText('My Video').closest('[role="button"]')
    expect(chip?.getAttribute('aria-pressed')).toBe('true')
  })

  it('shows collapsed state with badge only', () => {
    const candidates = [makeCandidate({ id: '1' })]
    render(<PlaylistSuggestionPanel {...defaultProps} candidates={candidates} collapsed={true} />)
    expect(screen.getByText(/1 disponíveis/)).toBeTruthy()
    expect(screen.queryByText('Avulsos')).toBeNull()
  })

  it('calls onToggleCollapse when header is clicked', () => {
    const onToggle = vi.fn()
    const candidates = [makeCandidate({ id: '1' })]
    render(<PlaylistSuggestionPanel {...defaultProps} candidates={candidates} onToggleCollapse={onToggle} />)
    fireEvent.click(screen.getByTestId('panel-toggle'))
    expect(onToggle).toHaveBeenCalled()
  })

  it('shows near-completion badge', () => {
    const candidates = [
      makeCandidate({ id: '1', playlist_id: 'p1', playlist_name: 'Almost', playlist_position: 9, playlist_total: 10 }),
    ]
    render(<PlaylistSuggestionPanel {...defaultProps} candidates={candidates} />)
    expect(screen.getByText(/quase/i)).toBeTruthy()
  })

  it('has accessible region landmark', () => {
    const candidates = [makeCandidate({ id: '1' })]
    render(<PlaylistSuggestionPanel {...defaultProps} candidates={candidates} />)
    expect(screen.getByRole('region')).toBeTruthy()
  })

  it('deselects when clicking selected item again', () => {
    const onSelect = vi.fn()
    const candidate = makeCandidate({ id: '1', title: 'My Video' })
    render(<PlaylistSuggestionPanel {...defaultProps} candidates={[candidate]} selectedItem={candidate} onSelectItem={onSelect} />)
    fireEvent.click(screen.getByText('My Video'))
    expect(onSelect).toHaveBeenCalledWith(null)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:web -- --run test/cms/playlist-suggestion-panel.test.tsx 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PlaylistSuggestionPanel**

Create `apps/web/src/app/cms/(authed)/pipeline/_components/playlist-suggestion-panel.tsx`:

```tsx
'use client'

import { useMemo, memo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { FORMAT_COLORS } from '@/lib/pipeline/colors'
import { gemMix } from '@/lib/pipeline/gem-design'
import { groupCandidatesByPlaylist } from '@/lib/pipeline/suggest-for-slots'
import type { SlotCandidate, WeekSlot } from '@/lib/pipeline/up-next-types'

export interface PlaylistSuggestionPanelProps {
  candidates: SlotCandidate[]
  weekSlots: WeekSlot[]
  onSelectItem: (candidate: SlotCandidate | null) => void
  selectedItem: SlotCandidate | null
  collapsed: boolean
  onToggleCollapse: () => void
}

const STAGE_SHORT: Record<string, string> = {
  idea: 'ideia',
  outline: 'roteiro',
  draft: 'rascunho',
  roteiro: 'roteiro',
  gravacao: 'gravação',
  edicao: 'edição',
  pos_producao: 'pós',
  ready: 'pronto',
}

export const PlaylistSuggestionPanel = memo(function PlaylistSuggestionPanel({
  candidates, weekSlots, onSelectItem, selectedItem, collapsed, onToggleCollapse,
}: PlaylistSuggestionPanelProps) {
  const groups = useMemo(() => groupCandidatesByPlaylist(candidates), [candidates])

  if (candidates.length === 0) return null

  const totalAvailable = candidates.length

  return (
    <section
      role="region"
      aria-label="Sugestões de conteúdo por playlist"
      className="rounded-lg border"
      style={{ background: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}
    >
      <button
        type="button"
        data-testid="panel-toggle"
        className="flex items-center justify-between w-full px-3 py-2 text-left min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        aria-controls="suggestion-panel-body"
      >
        <span className="flex items-center gap-2">
          {collapsed ? <ChevronRight size={14} style={{ color: 'var(--gem-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--gem-muted)' }} />}
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gem-muted)' }}>
            Sugestões por Playlist
          </span>
        </span>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full"
          style={{ background: gemMix('--gem-accent', 12), color: 'var(--gem-accent)' }}
        >
          {totalAvailable} disponíveis
        </span>
      </button>

      {!collapsed && (
        <div
          id="suggestion-panel-body"
          className="px-3 pb-3 overflow-x-auto"
        >
          <div className="flex gap-4 min-w-min">
            {groups.map((group) => (
              <div
                key={group.playlistId ?? 'avulsos'}
                className="flex-shrink-0 min-w-[180px] max-w-[220px]"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span
                    className="text-xs font-medium truncate"
                    style={{ color: 'var(--gem-text)' }}
                  >
                    {group.playlistName}
                  </span>
                  {group.nearCompletion && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: gemMix('--gem-done', 15), color: 'var(--gem-done)' }}
                    >
                      quase!
                    </span>
                  )}
                </div>

                {group.playlistId && (
                  <div
                    className="h-1 rounded-full mb-2 overflow-hidden"
                    style={{ background: 'var(--gem-faint)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round((group.progress.done / Math.max(group.progress.total, 1)) * 100)}%`,
                        background: 'var(--gem-done)',
                      }}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  {group.items.map((item) => {
                    const colors = FORMAT_COLORS[item.format] ?? { accent: 'var(--gem-accent)', text: 'var(--gem-muted)' }
                    const isSelected = selectedItem?.id === item.id

                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="button"
                        aria-pressed={isSelected}
                        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] w-full text-left truncate min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none motion-safe:transition-all"
                        style={{
                          background: isSelected ? gemMix(colors.accent, 20) : gemMix(colors.accent, 6),
                          border: isSelected ? `2px solid ${colors.accent}` : `1px solid ${gemMix(colors.accent, 15)}`,
                          color: colors.text,
                        }}
                        onClick={() => onSelectItem(isSelected ? null : item)}
                        aria-label={`${item.title} — ${item.stage}, ${item.format}`}
                      >
                        <span className="truncate flex-1">{item.title}</span>
                        <span
                          className="text-[10px] px-1 rounded whitespace-nowrap"
                          style={{ background: gemMix(colors.accent, 15) }}
                        >
                          {STAGE_SHORT[item.stage] ?? item.stage}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:web -- --run test/cms/playlist-suggestion-panel.test.tsx 2>&1 | tail -10`
Expected: All 10 tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/playlist-suggestion-panel.tsx apps/web/test/cms/playlist-suggestion-panel.test.tsx
git commit -m "feat(pipeline): add PlaylistSuggestionPanel component (TDD)"
```

---

### Task 5: UpNextThisWeek highlight mode

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/up-next-this-week.tsx`
- Modify: `apps/web/test/cms/up-next-this-week.test.tsx`

- [ ] **Step 1: Write failing tests for highlight mode**

Add to `apps/web/test/cms/up-next-this-week.test.tsx`:

```tsx
describe('highlight mode', () => {
  it('adds highlight class to compatible empty slots when selectedItem is set', () => {
    const slots = [makeSlot({ day: '2026-05-26', format: 'video', assignedItem: null })]
    const selectedItem = { id: 'x', title: 'X', stage: 'draft' as const, format: 'video' as const, language: 'pt-br' as const, playlist_id: null, playlist_name: null, playlist_position: null, playlist_total: null }
    render(<UpNextThisWeek {...defaultProps} slots={slots} selectedItem={selectedItem} />)
    const emptySlot = screen.getByTestId('empty-slot-2026-05-26')
    expect(emptySlot.className).toContain('ring-2')
  })

  it('does not highlight slots with wrong format', () => {
    const slots = [makeSlot({ day: '2026-05-26', format: 'blog_post', assignedItem: null })]
    const selectedItem = { id: 'x', title: 'X', stage: 'draft' as const, format: 'video' as const, language: 'pt-br' as const, playlist_id: null, playlist_name: null, playlist_position: null, playlist_total: null }
    render(<UpNextThisWeek {...defaultProps} slots={slots} selectedItem={selectedItem} />)
    const emptySlot = screen.getByTestId('empty-slot-2026-05-26')
    expect(emptySlot.className).not.toContain('ring-2')
  })

  it('clicking highlighted empty slot calls onAssignSlot with selectedItem id', async () => {
    const onAssign = vi.fn().mockResolvedValue(undefined)
    const slots = [makeSlot({ day: '2026-05-26', format: 'video', hour: null, assignedItem: null })]
    const selectedItem = { id: 'x', title: 'X', stage: 'draft' as const, format: 'video' as const, language: 'pt-br' as const, playlist_id: null, playlist_name: null, playlist_position: null, playlist_total: null }
    render(<UpNextThisWeek {...defaultProps} slots={slots} selectedItem={selectedItem} onAssignSlot={onAssign} />)
    fireEvent.click(screen.getByTestId('empty-slot-2026-05-26'))
    expect(onAssign).toHaveBeenCalledWith('x', '2026-05-26', null, undefined)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:web -- --run test/cms/up-next-this-week.test.tsx 2>&1 | tail -10`
Expected: FAIL — selectedItem prop not recognized / no ring-2 class

- [ ] **Step 3: Add selectedItem prop and highlight logic**

In `apps/web/src/app/cms/(authed)/pipeline/_components/up-next-this-week.tsx`:

1. Add to WeekGridProps interface:
```ts
selectedItem?: SlotCandidate | null
onItemAssigned?: () => void
```

2. Add to UpNextThisWeek destructuring:
```ts
selectedItem = null, onItemAssigned,
```

3. In SlotChip, add `selectedItem` prop and update the empty slot button:
- If `selectedItem` is set and `selectedItem.format === slot.format`, add `ring-2 ring-[var(--gem-accent)]` class and change onClick to call onAssignSlot directly with selectedItem.id
- If formats don't match, show dimmed appearance

4. Update SlotChipProps:
```ts
interface SlotChipProps {
  slot: WeekSlot
  onEmptyClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  onSwapClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  selectedItem?: SlotCandidate | null
  onDirectAssign?: (itemId: string, day: string, hour: string | null) => void
}
```

5. In SlotChip empty slot rendering, when selectedItem is present and compatible:
```tsx
const isCompatible = selectedItem && selectedItem.format === slot.format
const isHighlighted = isCompatible && !slot.assignedItem

// In the button className, conditionally add:
className={`... ${isHighlighted ? 'ring-2 ring-[var(--gem-accent)] animate-pulse' : ''}`}

// In onClick:
onClick={isHighlighted && onDirectAssign
  ? () => onDirectAssign(selectedItem!.id, slot.day, slot.hour)
  : onEmptyClick}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:web -- --run test/cms/up-next-this-week.test.tsx 2>&1 | tail -10`
Expected: All tests pass (including new highlight tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/up-next-this-week.tsx apps/web/test/cms/up-next-this-week.test.tsx
git commit -m "feat(pipeline): add highlight mode for click-to-assign from panel"
```

---

### Task 6: PipelineOverview orchestration

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx`
- Modify: `apps/web/test/cms/pipeline-overview.test.tsx`

- [ ] **Step 1: Write failing tests for panel integration**

Add to `apps/web/test/cms/pipeline-overview.test.tsx`:

```tsx
describe('playlist suggestion panel', () => {
  it('renders suggestion panel when candidates exist', () => {
    // Set SWR data with candidates that include playlist fields
    render(<PipelineOverview {...defaultProps} />)
    expect(screen.getByRole('region', { name: /sugestões/i })).toBeTruthy()
  })

  it('does not render panel when no candidates', () => {
    // Set SWR data with empty candidates
    render(<PipelineOverview {...defaultProps} />)
    expect(screen.queryByRole('region', { name: /sugestões/i })).toBeNull()
  })
})
```

Adapt these to the existing test file's mocking pattern (SWR mock, module-level state).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:web -- --run test/cms/pipeline-overview.test.tsx 2>&1 | tail -10`
Expected: FAIL — panel not rendered

- [ ] **Step 3: Wire panel into PipelineOverview**

In `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx`:

1. Import PlaylistSuggestionPanel (lazy via next/dynamic):
```ts
const LazyPlaylistSuggestionPanel = dynamic(
  () => import('./playlist-suggestion-panel').then(m => ({ default: m.PlaylistSuggestionPanel })),
  { ssr: false }
)
```

2. Add state:
```ts
const [selectedCandidate, setSelectedCandidate] = useState<SlotCandidate | null>(null)
const [panelCollapsed, setPanelCollapsed] = useState(false)
```

3. Add handler to clear selection after assignment:
```ts
const handleAssignFromPanel = useCallback(async (
  itemId: string, slotDay: string, slotHour: string | null, previousItemId?: string,
) => {
  await handleAssignSlot(itemId, slotDay, slotHour, previousItemId)
  setSelectedCandidate(null)
}, [handleAssignSlot])
```

4. Add announcement on selection:
```ts
useEffect(() => {
  if (selectedCandidate) {
    // The existing announcement live region will pick this up
  }
}, [selectedCandidate])
```

5. Render panel between UpNextThisWeek and UpNextPlaylistStrips:
```tsx
{upNext.candidates.length > 0 && (
  <LazyPlaylistSuggestionPanel
    candidates={upNext.candidates}
    weekSlots={upNext.weekSlots}
    onSelectItem={setSelectedCandidate}
    selectedItem={selectedCandidate}
    collapsed={panelCollapsed}
    onToggleCollapse={() => setPanelCollapsed(p => !p)}
  />
)}
```

6. Pass selectedItem to UpNextThisWeek:
```tsx
<UpNextThisWeek
  ...existing props...
  selectedItem={selectedCandidate}
  onAssignSlot={selectedCandidate ? handleAssignFromPanel : handleAssignSlot}
  onItemAssigned={() => setSelectedCandidate(null)}
/>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:web -- --run test/cms/pipeline-overview.test.tsx 2>&1 | tail -10`
Expected: All tests pass

- [ ] **Step 5: Run full test suite**

Run: `npm run test:web -- --run 2>&1 | tail -5`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx apps/web/test/cms/pipeline-overview.test.tsx
git commit -m "feat(pipeline): wire PlaylistSuggestionPanel into command center"
```

---

### Task 7: Screen reader announcement + ESC key to clear selection

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/up-next-this-week.tsx`

- [ ] **Step 1: Add announcement on item selection**

In PipelineOverview, update the announcement live region to include selection state. When selectedCandidate changes, set announcement text:

```ts
useEffect(() => {
  if (selectedCandidate) {
    // Use a ref to set the announcement without triggering re-render of the live region
    const el = document.getElementById('up-next-announcement')
    if (el) el.textContent = `${selectedCandidate.title} selecionado. Clique em um slot compatível para atribuir.`
  }
}, [selectedCandidate])
```

- [ ] **Step 2: Add ESC key handler to clear selection**

In PipelineOverview, add a keydown listener:

```ts
useEffect(() => {
  if (!selectedCandidate) return
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setSelectedCandidate(null)
  }
  document.addEventListener('keydown', handler)
  return () => document.removeEventListener('keydown', handler)
}, [selectedCandidate])
```

- [ ] **Step 3: Write test for ESC clearing selection**

Add test in pipeline-overview tests:

```tsx
it('ESC key clears selectedCandidate (hides highlight)', () => {
  // Render with candidates, click item to select, press Escape, verify highlight removed
})
```

- [ ] **Step 4: Run tests**

Run: `npm run test:web -- --run test/cms/pipeline-overview.test.tsx 2>&1 | tail -10`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx apps/web/src/app/cms/(authed)/pipeline/_components/up-next-this-week.tsx
git commit -m "feat(pipeline): announce selection to screen readers + ESC to clear"
```
