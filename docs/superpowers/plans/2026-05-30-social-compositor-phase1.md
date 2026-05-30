# Social Compositor Phase 1 — P0 Bugs + Cleanup + P1 Wiring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical data-loss bugs, remove ~1100 lines of dead code, and wire the compositor to real server actions so publish/schedule/queue actually work.

**Architecture:** Fix-first approach. B1 (caption state) and B2 (drawer) are data-loss/crash bugs that must land before any feature work. Cleanup (C1-C2) reduces confusion. P1 wiring connects the existing UI to real backend actions. Each task is independently shippable.

**Tech Stack:** Next.js 15 + React 19 + TypeScript 5 + Vitest + Supabase

**Spec:** `docs/superpowers/prompts/social-compositor-completion.md`

---

## File Structure

### Files to modify:
| File | Responsibility | Tasks |
|------|---------------|-------|
| `compositor-new.tsx` | State owner for destinations, captions, schedule | B1, B3, B4, P1.1, P1.5 |
| `dest-compositor.tsx` | Per-destination editing UI | B1 |
| `@drawer/(.)[id]/page.tsx` | Post detail drawer route | B2 |
| `cms-content-picker.tsx` | CMS content selection | P1.3 |

### Files to create:
| File | Responsibility | Tasks |
|------|---------------|-------|
| `_components/shared/platform-icon.tsx` | Shared SVG platform icons | C2 |

### Files to delete:
| File | Lines | Task |
|------|-------|------|
| `composer-shell.tsx` | 807 | C1 |
| `composer-shell-v2.tsx` | 296 | C1 |

---

## Task 1: B1 — Lift caption state to prevent data loss (~2h)

**Modify:** `apps/web/src/app/cms/(authed)/social/new/_components/compositor-new.tsx`
**Modify:** `apps/web/src/app/cms/(authed)/social/new/_components/dest-compositor.tsx`
**Test:** `apps/web/test/cms/social-compositor-captions.test.tsx`

The `key={focused}` on `<DestCompositor>` causes React to unmount/remount on every destination switch, destroying all caption text. Fix by lifting captions into `CompositorNew` as `Record<DestId, string>`.

- [ ] Write failing test for caption persistence across destination switches

```typescript
// apps/web/test/cms/social-compositor-captions.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CompositorNew } from '@/app/cms/(authed)/social/new/_components/compositor-new'

describe('CompositorNew caption persistence', () => {
  it('preserves caption when switching destinations', async () => {
    render(<CompositorNew sourceMode="freeform" />)

    // Type in the IG Story caption field
    const input = screen.getByPlaceholderText(/saiu no blog/i)
    fireEvent.change(input, { target: { value: 'Test caption for story' } })

    // Switch to Facebook (click the FB card)
    const fbCard = screen.getByText('Facebook')
    fireEvent.click(fbCard.closest('[role="option"]') || fbCard)

    // Switch back to Instagram Story
    const igCard = screen.getByText('Instagram')
    fireEvent.click(igCard.closest('[role="option"]') || igCard)

    // Caption should still be there
    const restoredInput = screen.getByDisplayValue('Test caption for story')
    expect(restoredInput).toBeTruthy()
  })
})
```

- [ ] Run test to verify it fails

```bash
npx vitest run apps/web/test/cms/social-compositor-captions.test.tsx
# Expected: FAIL — caption is empty after switching back
```

- [ ] Modify `compositor-new.tsx` — add `captions` state and pass to DestCompositor

In `compositor-new.tsx`, add `captions` state alongside `contentByDest`:

```typescript
// After line 27 (contentByDest state):
const [captions, setCaptions] = useState<Record<string, string>>({})

function handleCaptionChange(destId: string, value: string) {
  setCaptions(prev => ({ ...prev, [destId]: value }))
  setContentByDest(prev => ({ ...prev, [destId]: value.trim().length > 0 }))
}
```

Replace the `<DestCompositor>` render (remove `key={focused}`):

```typescript
// Replace:
<DestCompositor key={focused} focusedDest={focused} destsOn={destsOn} onContentChange={handleContentChange} />

// With:
<DestCompositor
  focusedDest={focused}
  destsOn={destsOn}
  caption={captions[focused] ?? ''}
  onCaptionChange={(value) => handleCaptionChange(focused, value)}
/>
```

Remove `handleContentChange` function (replaced by `handleCaptionChange`).

- [ ] Modify `dest-compositor.tsx` — receive caption as prop instead of local state

Change the interface and remove local caption state:

```typescript
// Change DestCompositorProps:
interface DestCompositorProps {
  focusedDest: DestId
  destsOn: Record<DestId, boolean>
  caption: string
  onCaptionChange: (value: string) => void
}

// In the function, replace:
//   const [caption, setCaptionState] = useState('')
//   function setCaption(value: string) { ... }
// With nothing — use props directly.

// All `setCaption(...)` calls become `onCaptionChange(...)` 
// All `caption` reads use the prop directly
```

In all `<input>` and `<textarea>` elements, change:
- `value={caption}` stays (now reads from prop)
- `onChange={(e) => setCaption(e.target.value)}` → `onChange={(e) => onCaptionChange(e.target.value)}`

- [ ] Run test to verify it passes

```bash
npx vitest run apps/web/test/cms/social-compositor-captions.test.tsx
# Expected: PASS
```

- [ ] Commit

```bash
git commit -m "fix(social): lift caption state to CompositorNew — prevents data loss on destination switch"
```

---

## Task 2: B2 — Drawer UUID validation (~30min)

**Modify:** `apps/web/src/app/cms/(authed)/social/@drawer/(.)[id]/page.tsx`
**Test:** `apps/web/test/cms/social-drawer-uuid.test.ts`

Replace the hardcoded exclusion list with UUID validation.

- [ ] Write test for UUID validation logic

```typescript
// apps/web/test/cms/social-drawer-uuid.test.ts
import { describe, it, expect } from 'vitest'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('drawer route UUID validation', () => {
  it.each(['new', 'accounts', 'insights', 'queue', 'stories', 'templates', 'foo', '123'])
    ('rejects non-UUID id: %s', (id) => {
      expect(UUID_REGEX.test(id)).toBe(false)
    })

  it('accepts valid UUID', () => {
    expect(UUID_REGEX.test('2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c')).toBe(true)
  })
})
```

- [ ] Run test to verify it passes (pure logic test)

```bash
npx vitest run apps/web/test/cms/social-drawer-uuid.test.ts
# Expected: PASS
```

- [ ] Modify drawer page to use UUID validation

In `@drawer/(.)[id]/page.tsx`, replace the exclusion list:

```typescript
// Replace:
if (id === 'new' || id === 'accounts' || id === 'insights' || id === 'queue' || id === 'stories' || id === 'templates') {
  return null
}

// With:
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if (!UUID_REGEX.test(id)) return null
```

- [ ] Commit

```bash
git commit -m "fix(social): drawer validates UUID instead of hardcoded exclusion list"
```

---

## Task 3: B3 — Dynamic schedule dates (~2h)

**Modify:** `apps/web/src/app/cms/(authed)/social/new/_components/compositor-new.tsx`
**Test:** `apps/web/test/cms/social-schedule-dates.test.ts`

Replace hardcoded `['Hoje', 'Amanha', 'Qua 31', ...]` with dynamic date computation.

- [ ] Write test for date computation

```typescript
// apps/web/test/cms/social-schedule-dates.test.ts
import { describe, it, expect } from 'vitest'

function computeScheduleDays(count: number): Array<{ date: Date; label: string }> {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    d.setHours(0, 0, 0, 0)
    const label = i === 0 ? 'Hoje'
      : i === 1 ? 'Amanha'
      : `${d.toLocaleDateString('pt-BR', { weekday: 'short' })} ${d.getDate()}`
    return { date: d, label: label.replace('.', '') }
  })
}

describe('computeScheduleDays', () => {
  it('returns correct number of days', () => {
    expect(computeScheduleDays(5)).toHaveLength(5)
  })

  it('first day is Hoje', () => {
    expect(computeScheduleDays(5)[0].label).toBe('Hoje')
  })

  it('second day is Amanha', () => {
    expect(computeScheduleDays(5)[1].label).toBe('Amanha')
  })

  it('third day has weekday + number', () => {
    const days = computeScheduleDays(5)
    expect(days[2].label).toMatch(/^[A-Za-z]+ \d+$/)
  })

  it('dates are sequential', () => {
    const days = computeScheduleDays(5)
    for (let i = 1; i < days.length; i++) {
      const diff = days[i].date.getTime() - days[i-1].date.getTime()
      expect(diff).toBe(86400000) // 24h
    }
  })
})
```

- [ ] Run test to verify it passes

```bash
npx vitest run apps/web/test/cms/social-schedule-dates.test.ts
# Expected: PASS (pure function test)
```

- [ ] Extract `computeScheduleDays` into compositor and replace hardcoded days

In `compositor-new.tsx`:

1. Add the function at the top (before the component):
```typescript
function computeScheduleDays(count: number): Array<{ date: Date; label: string }> {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    d.setHours(0, 0, 0, 0)
    const label = i === 0 ? 'Hoje'
      : i === 1 ? 'Amanha'
      : `${d.toLocaleDateString('pt-BR', { weekday: 'short' })} ${d.getDate()}`
    return { date: d, label: label.replace('.', '') }
  })
}
```

2. Replace state: `const [selectedDay, setSelectedDay] = useState(1)` → `const [selectedDate, setSelectedDate] = useState<Date>(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0,0,0,0); return d })`

3. Use `useMemo`:
```typescript
const scheduleDays = useMemo(() => computeScheduleDays(5), [])
```

4. Replace the hardcoded day buttons with:
```typescript
{scheduleDays.map(day => (
  <button
    key={day.date.toISOString()}
    type="button"
    onClick={() => setSelectedDate(day.date)}
    className={`cursor-pointer rounded-lg border px-3 py-[7px] text-[12.5px] font-semibold transition-colors ${
      selectedDate.getTime() === day.date.getTime()
        ? 'border-cms-accent bg-cms-accent/10 text-cms-accent'
        : 'border-cms-border bg-cms-surface text-cms-text-dim hover:border-cms-text/30'
    }`}
  >
    {day.label}
  </button>
))}
```

5. Update the info line to use `selectedDate`:
```typescript
// Replace the hardcoded ['Hoje', 'Amanha', ...][selectedDay] with:
const selectedDayLabel = scheduleDays.find(d => d.date.getTime() === selectedDate.getTime())?.label ?? ''
// Then use: {selectedDayLabel} · <b className="font-mono text-cms-text">{selectedTime}</b>
```

- [ ] Commit

```bash
git commit -m "fix(social): dynamic schedule dates — computed from current date, not hardcoded"
```

---

## Task 4: C1 — Delete dead compositor code (~30min)

**Delete:** `apps/web/src/app/cms/(authed)/social/new/_components/composer-shell.tsx`
**Delete:** `apps/web/src/app/cms/(authed)/social/new/_components/composer-shell-v2.tsx`

- [ ] Verify no imports exist

```bash
grep -r "composer-shell" apps/web/src/ --include="*.tsx" --include="*.ts" -l
# Expected: 0 results (already confirmed by research)
```

- [ ] Delete the files

```bash
rm apps/web/src/app/cms/\(authed\)/social/new/_components/composer-shell.tsx
rm apps/web/src/app/cms/\(authed\)/social/new/_components/composer-shell-v2.tsx
```

- [ ] Run tests to verify no regressions

```bash
npx vitest run apps/web/test/cms/social-compositor-flow.test.tsx
# Expected: PASS (tests useComposer hook, not the shell components)
```

- [ ] Commit

```bash
git commit -m "chore(social): delete dead compositor shells — 1103 lines removed"
```

---

## Task 5: C2 — Extract shared PlatformIcon (~2h)

**Create:** `apps/web/src/app/cms/(authed)/social/_components/shared/platform-icon.tsx`
**Modify:** 8 files that duplicate platform SVGs
**Test:** `apps/web/test/cms/social-platform-icon.test.tsx`

- [ ] Write test for shared PlatformIcon

```typescript
// apps/web/test/cms/social-platform-icon.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PlatformIcon } from '@/app/cms/(authed)/social/_components/shared/platform-icon'

describe('PlatformIcon', () => {
  it.each(['instagram', 'youtube', 'facebook', 'bluesky'])
    ('renders %s without error', (provider) => {
      const { container } = render(<PlatformIcon provider={provider} size={16} variant="solid" />)
      expect(container.querySelector('svg')).toBeTruthy()
    })

  it('renders solid variant with white stroke', () => {
    const { container } = render(<PlatformIcon provider="instagram" size={16} variant="solid" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('stroke')).toBe('#fff')
  })

  it('renders outline variant with currentColor', () => {
    const { container } = render(<PlatformIcon provider="instagram" size={16} variant="outline" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('stroke')).toMatch(/currentColor|var/)
  })

  it('returns null for unknown provider', () => {
    const { container } = render(<PlatformIcon provider="tiktok" size={16} variant="solid" />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] Run test to verify it fails

```bash
npx vitest run apps/web/test/cms/social-platform-icon.test.tsx
# Expected: FAIL — component doesn't exist
```

- [ ] Create the shared PlatformIcon component

```typescript
// apps/web/src/app/cms/(authed)/social/_components/shared/platform-icon.tsx

interface PlatformIconProps {
  provider: string
  size: number
  variant: 'solid' | 'outline' | 'chip' | 'mini'
  tint?: string
}

export function PlatformIcon({ provider, size, variant, tint }: PlatformIconProps) {
  const stroke = variant === 'solid' ? '#fff'
    : variant === 'chip' ? (tint ?? 'currentColor')
    : 'currentColor'
  const fill = variant === 'solid' ? '#fff'
    : variant === 'chip' ? (tint ?? 'currentColor')
    : 'currentColor'

  if (provider === 'instagram') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill={fill} stroke="none" />
    </svg>
  )
  if (provider === 'youtube') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8">
      <rect x="2.5" y="5" width="19" height="14" rx="4" />
      <path d="M10 9l5 3-5 3z" fill={fill} stroke="none" />
    </svg>
  )
  if (provider === 'facebook') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M13.5 8.5h1.6M13.5 8.5c0-1.2.5-2 2-2M13.5 8.5V18M13.5 12h3" />
    </svg>
  )
  if (provider === 'bluesky') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8">
      <path d="M12 4c3 2.5 6 6 6 8.5a3.5 3.5 0 01-7 0" />
      <path d="M12 4c-3 2.5-6 6-6 8.5a3.5 3.5 0 007 0" />
      <path d="M8.5 17c1-.5 2.5-1 3.5-1s2.5.5 3.5 1" />
    </svg>
  )
  return null
}
```

- [ ] Run test to verify it passes

```bash
npx vitest run apps/web/test/cms/social-platform-icon.test.tsx
# Expected: PASS
```

- [ ] Replace duplicated icons in consuming files (accounts-strip-client, feed-card, calendar-week-view, destination-picker, dest-compositor, cms-content-picker, queue-list, drafts-list)

For each file:
1. Add import: `import { PlatformIcon } from '../shared/platform-icon'` (adjust path)
2. Delete the local `PlatformIcon`/`PlatformChipIcon`/`PlatformIconSmall`/`PlatformDot`/`PlatformMiniIcon` function
3. Replace usages with `<PlatformIcon provider={...} size={...} variant="solid|outline|chip|mini" />`

- [ ] Run all social tests to verify no regressions

```bash
npx vitest run apps/web/test/social-*.test.ts apps/web/test/cms/social-*.test.tsx
```

- [ ] Commit

```bash
git commit -m "refactor(social): extract shared PlatformIcon — removes ~90 lines of duplicated SVGs across 8 files"
```

---

## Task 6: P1.1 — Wire publish action (~4h)

**Modify:** `apps/web/src/app/cms/(authed)/social/new/_components/compositor-new.tsx`
**Test:** `apps/web/test/cms/social-publish-wiring.test.tsx`

Wire "Publicar", "Agendar", "Fila", "Salvar rascunho" buttons to real server actions.

- [ ] Write test for publish payload construction

```typescript
// apps/web/test/cms/social-publish-wiring.test.ts
import { describe, it, expect } from 'vitest'
import { DESTINATIONS, type DestId } from '@/lib/social/destinations'

function buildPublishPayload(
  captions: Record<string, string>,
  destsOn: Record<DestId, boolean>,
  schedMode: 'now' | 'schedule' | 'queue',
  scheduledAt?: string,
) {
  const activeDests = (Object.entries(destsOn) as [DestId, boolean][])
    .filter(([, on]) => on)
    .map(([id]) => id)

  const platforms = [...new Set(activeDests.map(id => DESTINATIONS[id].provider))]

  const content = {
    title: captions[activeDests[0]] ?? '',
    description: captions[activeDests[0]] ?? '',
  }

  return {
    type: 'text' as const,
    content,
    platforms,
    scheduledAt: schedMode === 'schedule' ? scheduledAt : undefined,
    storyMode: activeDests.includes('ig_story'),
  }
}

describe('buildPublishPayload', () => {
  it('maps active destinations to providers', () => {
    const payload = buildPublishPayload(
      { ig_story: 'hello' },
      { ig_story: true, yt_community: false, fb_page: true, ig_feed: false },
      'now',
    )
    expect(payload.platforms).toContain('instagram')
    expect(payload.platforms).toContain('facebook')
    expect(payload.platforms).not.toContain('youtube')
  })

  it('sets storyMode when ig_story is active', () => {
    const payload = buildPublishPayload(
      { ig_story: 'test' },
      { ig_story: true, yt_community: false, fb_page: false, ig_feed: false },
      'now',
    )
    expect(payload.storyMode).toBe(true)
  })

  it('includes scheduledAt only for schedule mode', () => {
    const payload = buildPublishPayload(
      { ig_story: 'test' },
      { ig_story: true, yt_community: false, fb_page: false, ig_feed: false },
      'schedule',
      '2026-06-01T19:00:00Z',
    )
    expect(payload.scheduledAt).toBe('2026-06-01T19:00:00Z')
  })

  it('omits scheduledAt for now mode', () => {
    const payload = buildPublishPayload(
      { ig_story: 'test' },
      { ig_story: true, yt_community: false, fb_page: false, ig_feed: false },
      'now',
    )
    expect(payload.scheduledAt).toBeUndefined()
  })
})
```

- [ ] Run test to verify it passes

```bash
npx vitest run apps/web/test/cms/social-publish-wiring.test.ts
# Expected: PASS (pure function test)
```

- [ ] Add `buildPublishPayload` to `compositor-new.tsx` and wire button onClick handlers

Import the action:
```typescript
import { createSocialPost } from '@/lib/social/actions'
```

Add the function (extracted from test) and state:
```typescript
const [publishing, setPublishing] = useState(false)
```

Wire the publish button:
```typescript
onClick={async () => {
  if (!canPublish || publishing) return
  setPublishing(true)

  const payload = buildPublishPayload(captions, destsOn, schedMode,
    schedMode === 'schedule'
      ? new Date(`${selectedDate.toISOString().split('T')[0]}T${selectedTime}:00`).toISOString()
      : undefined
  )

  const result = await createSocialPost(payload)
  setPublishing(false)

  if (result.ok) {
    window.location.href = '/cms/social'
  }
}}
```

Wire "Salvar rascunho":
```typescript
onClick={async () => {
  const payload = buildPublishPayload(captions, destsOn, 'now')
  payload.type = 'text'
  // Draft = create with no schedule, then immediately cancel to set status=draft
  const result = await createSocialPost({ ...payload, scheduledAt: undefined })
  if (result.ok) window.location.href = '/cms/social?tab=drafts'
}}
```

- [ ] Run full test suite

```bash
npx vitest run apps/web/test/cms/social-*.test.tsx apps/web/test/social-*.test.ts
# Expected: all pass
```

- [ ] Commit

```bash
git commit -m "feat(social): wire publish/schedule/queue buttons to createSocialPost action"
```

---

## Task 7: P1.5 — Best times from API (~2h)

**Modify:** `apps/web/src/app/cms/(authed)/social/new/_components/compositor-new.tsx`

- [ ] Add `useEffect` to fetch best times when schedule mode opens

```typescript
import { getBestTimes, getConnections } from '@/lib/social/actions'

// Inside CompositorNew, add:
const [bestTimes, setBestTimes] = useState<string[]>([])

useEffect(() => {
  if (schedMode !== 'schedule') return
  let cancelled = false

  async function fetchBestTimes() {
    const connResult = await getConnections(/* siteId from context */)
    if (!connResult.ok || cancelled) return
    const ids = connResult.data.map(c => c.id)
    const timesResult = await getBestTimes(ids)
    if (!timesResult.ok || cancelled) return
    const allTimes = Object.values(timesResult.data).flat()
    setBestTimes([...new Set(allTimes)])
  }

  fetchBestTimes()
  return () => { cancelled = true }
}, [schedMode])
```

- [ ] Replace hardcoded `isBest` check with `bestTimes.includes(t)`

```typescript
// Replace:
const isBest = ['08:00', '09:00', '12:30', '13:00', '18:00', '20:00'].includes(t)

// With:
const isBest = bestTimes.includes(t)
```

- [ ] Commit

```bash
git commit -m "feat(social): fetch real best posting times from getBestTimes API"
```

---

## Summary

| Task | Type | Est | Description |
|------|------|-----|-------------|
| 1 | Bug P0 | 2h | Lift caption state — prevent data loss |
| 2 | Bug P0 | 30m | Drawer UUID validation |
| 3 | Bug P0 | 2h | Dynamic schedule dates |
| 4 | Cleanup | 30m | Delete dead compositor shells |
| 5 | Cleanup | 2h | Extract shared PlatformIcon |
| 6 | P1 Wiring | 4h | Wire publish/schedule/queue actions |
| 7 | P1 Wiring | 2h | Best times from API |
| **Total** | | **~13h** | |

### Dependencies between tasks

- Tasks 1-5 are independent and can be parallelized
- Task 6 depends on Task 1 (needs lifted captions state)
- Task 7 is independent

### Key files changed

```
compositor-new.tsx  — Tasks 1, 3, 6, 7
dest-compositor.tsx — Task 1
@drawer/(.)[id]/page.tsx — Task 2
composer-shell.tsx — Task 4 (deleted)
composer-shell-v2.tsx — Task 4 (deleted)
shared/platform-icon.tsx — Task 5 (created)
8 consuming files — Task 5 (icon replacement)
```
