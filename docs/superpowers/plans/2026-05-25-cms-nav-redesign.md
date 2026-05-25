# CMS Navigation Redesign — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the CMS sidebar from 4 sections / 27 items to 5 sections / 21 items, absorb Top Fans into Analytics as a tab, add Contacts to nav, and rename Linktree → "Link in Bio".

**Architecture:** Modify the nav config (`cms-sections.ts`), extend the Analytics tab system (types + header + page + redirect), and update all tests that validate nav structure. No URL changes (Phase 2), no new pages, no route moves.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Vitest, Lucide icons

---

## File Structure

| File | Responsibility |
|------|---------------|
| `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts` | Nav section config — rewrite to 5 sections / 21 items |
| `apps/web/src/app/cms/(authed)/analytics/types.ts` | Add `'fans'` to `AnalyticsTab` union |
| `apps/web/src/app/cms/(authed)/analytics/_components/analytics-header.tsx` | Add Fans tab to header |
| `apps/web/src/app/cms/(authed)/analytics/page.tsx` | Render FanLeaderboard when `tab=fans` |
| `apps/web/src/app/cms/(authed)/analytics/fans/page.tsx` | Redirect to `/cms/analytics?tab=fans` |
| `apps/web/test/cms/_shared/cms-sections.test.ts` | Rewrite tests for new 5-section structure |
| `apps/web/test/cms/social-navigation.test.ts` | Update for 4-item Social section |

---

### Task 1: Rewrite `cms-sections.ts` — New 5-Section Navigation

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts`

- [ ] **Step 1: Write the failing test — 5 sections, 21 items**

Replace `apps/web/test/cms/_shared/cms-sections.test.ts` entirely:

```typescript
import { describe, it, expect } from 'vitest'
import { buildCmsSections } from '../../../src/app/cms/(authed)/_shared/cms-sections'

describe('buildCmsSections — v3 nav redesign', () => {
  const sections = buildCmsSections()

  it('has 5 sections', () => {
    expect(sections.length).toBe(5)
  })

  it('has 21 total items', () => {
    const total = sections.reduce((sum, s) => sum + s.items.length, 0)
    expect(total).toBe(21)
  })

  it('section labels in order: Overview, Content, Library, Social, People', () => {
    expect(sections.map(s => s.label)).toEqual([
      'Overview', 'Content', 'Library', 'Social', 'People',
    ])
  })

  it('section item counts: 4, 6, 4, 4, 3', () => {
    expect(sections.map(s => s.items.length)).toEqual([4, 6, 4, 4, 3])
  })

  describe('Overview (4 items)', () => {
    const overview = sections.find(s => s.label === 'Overview')!

    it('items in order: Dashboard, Up Next, Schedule, Analytics', () => {
      expect(overview.items.map(i => i.label)).toEqual([
        'Dashboard', 'Up Next', 'Schedule', 'Analytics',
      ])
    })

    it('correct hrefs', () => {
      expect(overview.items.map(i => i.href)).toEqual([
        '/cms', '/cms/pipeline', '/cms/schedule', '/cms/analytics',
      ])
    })

    it('no Top Fans item (absorbed into Analytics tab)', () => {
      expect(overview.items.find(i => i.label === 'Top Fans')).toBeUndefined()
    })
  })

  describe('Content (6 items)', () => {
    const content = sections.find(s => s.label === 'Content')!

    it('items in order: Blog, Video, Courses, Newsletters, Campaigns, Playlists', () => {
      expect(content.items.map(i => i.label)).toEqual([
        'Blog', 'Video', 'Courses', 'Newsletters', 'Campaigns', 'Playlists',
      ])
    })

    it('does not contain Pipeline, Research, Reference, Audio, Media, Links, Linktree', () => {
      const labels = content.items.map(i => i.label)
      for (const removed of ['Pipeline', 'Research', 'Reference', 'Audio', 'Media', 'Links', 'Linktree', 'Link in Bio']) {
        expect(labels).not.toContain(removed)
      }
    })
  })

  describe('Library (4 items)', () => {
    const library = sections.find(s => s.label === 'Library')!

    it('items in order: Research, Reference, Media, Audio', () => {
      expect(library.items.map(i => i.label)).toEqual([
        'Research', 'Reference', 'Media', 'Audio',
      ])
    })

    it('correct hrefs', () => {
      expect(library.items.map(i => i.href)).toEqual([
        '/cms/pipeline/research', '/cms/pipeline/reference', '/cms/media', '/cms/pipeline/audio',
      ])
    })
  })

  describe('Social (4 items)', () => {
    const social = sections.find(s => s.label === 'Social')!

    it('items in order: YouTube, Posts, Links, Link in Bio', () => {
      expect(social.items.map(i => i.label)).toEqual([
        'YouTube', 'Posts', 'Links', 'Link in Bio',
      ])
    })

    it('correct hrefs', () => {
      expect(social.items.map(i => i.href)).toEqual([
        '/cms/youtube', '/cms/social', '/cms/links', '/cms/linktree',
      ])
    })

    it('no Queue, Composer, Insights, Stories, Templates, Accounts', () => {
      const labels = social.items.map(i => i.label)
      for (const removed of ['Queue', 'Composer', 'Insights', 'Stories', 'Templates', 'Accounts']) {
        expect(labels).not.toContain(removed)
      }
    })
  })

  describe('People (3 items)', () => {
    const people = sections.find(s => s.label === 'People')!

    it('items in order: Authors, Subscribers, Contacts', () => {
      expect(people.items.map(i => i.label)).toEqual([
        'Authors', 'Subscribers', 'Contacts',
      ])
    })

    it('Contacts href is /cms/contacts', () => {
      expect(people.items[2].href).toBe('/cms/contacts')
    })

    it('Contacts requires editor role', () => {
      expect(people.items[2].minRole).toBe('editor')
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && npx vitest run test/cms/_shared/cms-sections.test.ts`
Expected: multiple failures (section count is 4, items are wrong, etc.)

- [ ] **Step 3: Rewrite `cms-sections.ts` with new 5-section structure**

Replace `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts` entirely:

```typescript
import { createElement } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { SidebarSection } from '@tn-figueiredo/cms-ui'
import {
  LayoutDashboard, Calendar,
  FileText, Mail, Megaphone, ListMusic,
  Video, GraduationCap, BookOpen, Microscope, Headphones,
  Image, Link2,
  Youtube, Send,
  UserPen, UsersRound, MessageSquare,
  TrendingUp, Kanban, Shrub,
} from 'lucide-react'

const ICON_SIZE = 16
const STROKE = 1.75
const icon = (Icon: LucideIcon) => createElement(Icon, { size: ICON_SIZE, strokeWidth: STROKE })

export function buildCmsSections(): SidebarSection[] {
  return [
    {
      label: 'Overview',
      items: [
        { icon: icon(LayoutDashboard), label: 'Dashboard', href: '/cms' },
        { icon: icon(Kanban), label: 'Up Next', href: '/cms/pipeline', minRole: 'editor' },
        { icon: icon(Calendar), label: 'Schedule', href: '/cms/schedule' },
        { icon: icon(TrendingUp), label: 'Analytics', href: '/cms/analytics', minRole: 'editor' },
      ],
    },
    {
      label: 'Content',
      items: [
        { icon: icon(FileText), label: 'Blog', href: '/cms/blog' },
        { icon: icon(Video), label: 'Video', href: '/cms/pipeline/video', minRole: 'editor' },
        { icon: icon(GraduationCap), label: 'Courses', href: '/cms/pipeline/course', minRole: 'editor' },
        { icon: icon(Mail), label: 'Newsletters', href: '/cms/newsletters', minRole: 'editor' },
        { icon: icon(Megaphone), label: 'Campaigns', href: '/cms/campaigns', minRole: 'editor' },
        { icon: icon(ListMusic), label: 'Playlists', href: '/cms/playlists', minRole: 'editor' },
      ],
    },
    {
      label: 'Library',
      items: [
        { icon: icon(Microscope), label: 'Research', href: '/cms/pipeline/research', minRole: 'editor' },
        { icon: icon(BookOpen), label: 'Reference', href: '/cms/pipeline/reference', minRole: 'editor' },
        { icon: icon(Image), label: 'Media', href: '/cms/media', minRole: 'editor' },
        { icon: icon(Headphones), label: 'Audio', href: '/cms/pipeline/audio', minRole: 'editor' },
      ],
    },
    {
      label: 'Social',
      items: [
        { icon: icon(Youtube), label: 'YouTube', href: '/cms/youtube', minRole: 'editor' },
        { icon: icon(Send), label: 'Posts', href: '/cms/social', minRole: 'reporter' },
        { icon: icon(Link2), label: 'Links', href: '/cms/links', minRole: 'editor' },
        { icon: icon(Shrub), label: 'Link in Bio', href: '/cms/linktree', minRole: 'editor' },
      ],
    },
    {
      label: 'People',
      items: [
        { icon: icon(UserPen), label: 'Authors', href: '/cms/authors', minRole: 'editor' },
        { icon: icon(UsersRound), label: 'Subscribers', href: '/cms/subscribers', minRole: 'org_admin' },
        { icon: icon(MessageSquare), label: 'Contacts', href: '/cms/contacts', minRole: 'editor' },
      ],
    },
  ]
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/web && npx vitest run test/cms/_shared/cms-sections.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/_shared/cms-sections.ts apps/web/test/cms/_shared/cms-sections.test.ts
git commit -m "feat(cms): restructure nav to 5 sections / 21 items (v3 redesign)"
```

---

### Task 2: Update Social Navigation Tests

**Files:**
- Modify: `apps/web/test/cms/social-navigation.test.ts`

- [ ] **Step 1: Rewrite social navigation test for 4-item Social section**

Replace `apps/web/test/cms/social-navigation.test.ts` entirely:

```typescript
import { describe, it, expect } from 'vitest'
import { buildCmsSections } from '@/app/cms/(authed)/_shared/cms-sections'

describe('buildCmsSections — Social section (v3 redesign)', () => {
  const sections = buildCmsSections()
  const social = sections.find(s => s.label === 'Social')!
  const content = sections.find(s => s.label === 'Content')!

  it('has a Social section with 4 items', () => {
    expect(social).toBeDefined()
    expect(social.items.length).toBe(4)
  })

  it('includes YouTube in Social section, not Content', () => {
    const socialHrefs = social.items.map(i => i.href)
    expect(socialHrefs).toContain('/cms/youtube')
    const contentHrefs = content.items.map(i => i.href)
    expect(contentHrefs).not.toContain('/cms/youtube')
  })

  it('has correct nav items in order', () => {
    const labels = social.items.map(i => i.label)
    expect(labels).toEqual(['YouTube', 'Posts', 'Links', 'Link in Bio'])
  })

  it('has correct routes', () => {
    const hrefs = social.items.map(i => i.href)
    expect(hrefs).toEqual([
      '/cms/youtube',
      '/cms/social',
      '/cms/links',
      '/cms/linktree',
    ])
  })

  it('sets reporter minRole for read-only items', () => {
    const postsItem = social.items.find(i => i.label === 'Posts')!
    expect(postsItem.minRole).toBe('reporter')
  })

  it('does not include removed items (Queue, Composer, Insights, Stories, Templates, Accounts)', () => {
    const labels = social.items.map(i => i.label)
    for (const removed of ['Queue', 'Composer', 'Insights', 'Stories', 'Templates', 'Accounts']) {
      expect(labels).not.toContain(removed)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd apps/web && npx vitest run test/cms/social-navigation.test.ts`
Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/cms/social-navigation.test.ts
git commit -m "test(cms): update social nav tests for v3 4-item structure"
```

---

### Task 3: Absorb Top Fans into Analytics as Tab

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/analytics/types.ts`
- Modify: `apps/web/src/app/cms/(authed)/analytics/_components/analytics-header.tsx`
- Modify: `apps/web/src/app/cms/(authed)/analytics/page.tsx`
- Modify: `apps/web/src/app/cms/(authed)/analytics/fans/page.tsx`

- [ ] **Step 1: Add `'fans'` to the `AnalyticsTab` type**

In `apps/web/src/app/cms/(authed)/analytics/types.ts`, change line 67:

```typescript
// OLD:
export type AnalyticsTab = 'overview' | 'content' | 'links' | 'audience' | 'revenue'

// NEW:
export type AnalyticsTab = 'overview' | 'content' | 'links' | 'audience' | 'fans' | 'revenue'
```

- [ ] **Step 2: Add Fans tab to the analytics header**

In `apps/web/src/app/cms/(authed)/analytics/_components/analytics-header.tsx`, change the TABS array (lines 7-13):

```typescript
// OLD:
const TABS: { id: AnalyticsTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'content', label: 'Content' },
  { id: 'links', label: 'Links' },
  { id: 'audience', label: 'Audience' },
  { id: 'revenue', label: 'Revenue' },
]

// NEW:
const TABS: { id: AnalyticsTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'content', label: 'Content' },
  { id: 'links', label: 'Links' },
  { id: 'audience', label: 'Audience' },
  { id: 'fans', label: 'Fans' },
  { id: 'revenue', label: 'Revenue' },
]
```

- [ ] **Step 3: Render FanLeaderboard in the analytics page for fans tab**

In `apps/web/src/app/cms/(authed)/analytics/page.tsx`:

Add import at top (after existing imports, before `SectionErrorBoundary`):
```typescript
import { getTopFans } from '@/lib/social/actions/fans'
import { FanLeaderboard } from './fans/_components/fan-leaderboard'
```

Update the VALID_TABS array (line 43):
```typescript
// OLD:
const VALID_TABS: AnalyticsTab[] = ['overview', 'content', 'links', 'audience', 'revenue']

// NEW:
const VALID_TABS: AnalyticsTab[] = ['overview', 'content', 'links', 'audience', 'fans', 'revenue']
```

Add the fans tab branch in the JSX, between the `audience` and the final `else` (after line 82, before the `) : (` that leads to `ComingSoonStub`):

```tsx
      ) : activeTab === 'fans' ? (
        <SectionErrorBoundary>
          <Suspense fallback={<AnalyticsSkeleton />}>
            <FansTabSection siteId={siteId} />
          </Suspense>
        </SectionErrorBoundary>
```

Add the FansTabSection async component at the bottom of the file (before `AnalyticsSkeleton`):

```typescript
async function FansTabSection({ siteId }: { siteId: string }) {
  const fans = await getTopFans(siteId, 50)
  return (
    <div className="p-4 md:p-6 space-y-6">
      <FanLeaderboard fans={fans} />
    </div>
  )
}
```

- [ ] **Step 4: Replace standalone fans page with redirect**

Replace `apps/web/src/app/cms/(authed)/analytics/fans/page.tsx` entirely:

```typescript
import { redirect } from 'next/navigation'

export default function FansPage() {
  redirect('/cms/analytics?tab=fans')
}
```

- [ ] **Step 5: Run full test suite to verify nothing is broken**

Run: `cd apps/web && npx vitest run`
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/analytics/types.ts \
  apps/web/src/app/cms/\(authed\)/analytics/_components/analytics-header.tsx \
  apps/web/src/app/cms/\(authed\)/analytics/page.tsx \
  apps/web/src/app/cms/\(authed\)/analytics/fans/page.tsx
git commit -m "feat(analytics): absorb Top Fans as Fans tab in Analytics page"
```

---

### Task 4: Run Full Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run build:packages**

Run: `npm run build:packages`
Expected: clean build

- [ ] **Step 2: Run full web test suite**

Run: `npm run test:web`
Expected: all tests pass

- [ ] **Step 3: Run next build to verify everything compiles**

Run: `cd apps/web && npx next build`
Expected: build succeeds with no errors

---

## Task Dependency Graph

```
Task 1 (cms-sections.ts) ─┐
                           ├── Task 4 (verification)
Task 2 (social tests)     ─┤
                           │
Task 3 (analytics fans)   ─┘
```

Tasks 1, 2, and 3 are independent and can be executed in parallel. Task 4 depends on all three completing.
