# CMS Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all 10 CMS admin screens (`/cms/*`) with cohesive dark theme, consistent interaction patterns, full RBAC v3 enforcement, LGPD compliance, mobile responsiveness, and keyboard accessibility — each at 98+/100 quality per the approved design spec.

**Architecture:** Thin server-component wrappers in `apps/web` fetch data and pass to client `*-connected.tsx` components. Client components import from `@tn-figueiredo/cms-admin` and `@tn-figueiredo/cms-ui`. All state lives in URL searchParams. Write server actions re-check RBAC and use CAS patterns.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, `@tn-figueiredo/cms-admin@0.1.10`, `@tn-figueiredo/cms-ui@0.1.3`, Vitest, Zod

**Design Spec:** `docs/superpowers/specs/2026-04-24-cms-overhaul-design.md`

---

## File Structure

### New Files
| File | Purpose |
|------|---------|
| `apps/web/src/app/cms/(authed)/settings/page.tsx` | Settings server component |
| `apps/web/src/app/cms/(authed)/settings/settings-connected.tsx` | Settings client component (6-tab layout) |
| `apps/web/src/app/cms/(authed)/settings/actions.ts` | Settings server actions (11 actions) |
| `apps/web/src/app/cms/(authed)/authors/authors-connected.tsx` | Authors client component (card grid + panels) |
| `apps/web/src/app/cms/(authed)/authors/actions.ts` | Authors server actions (5 actions) |
| `apps/web/src/app/cms/(authed)/_components/dashboard-connected.tsx` | Dashboard client component |
| `apps/web/src/app/cms/(authed)/blog/_components/posts-list-connected.tsx` | Posts client component (bulk, filters) |
| `apps/web/src/app/cms/(authed)/schedule/actions.ts` | Schedule server actions (4 CAS actions) |
| `apps/web/src/app/cms/(authed)/analytics/actions.ts` | Analytics server actions (6 actions) |
| `apps/web/src/app/cms/(authed)/newsletters/newsletters-connected.tsx` | Newsletters client component |
| `apps/web/src/app/cms/(authed)/contacts/contacts-connected.tsx` | Contacts client component (slide-in panel) |
| `apps/web/src/app/cms/(authed)/contacts/actions.ts` | Contacts server actions (6 actions) |
| `apps/web/src/app/cms/(authed)/subscribers/subscribers-connected.tsx` | Subscribers client component (detail panel) |
| `apps/web/src/app/cms/(authed)/subscribers/actions.ts` | Subscribers server actions (3 actions) |
| `apps/web/src/app/cms/(authed)/campaigns/campaigns-connected.tsx` | Campaigns client component (bulk, sort) |
| `apps/web/src/app/cms/(authed)/campaigns/bulk-actions.ts` | Campaigns bulk server actions (3 actions) |
| `apps/web/src/app/cms/(authed)/layout-helpers.ts` | Sidebar sections config + badge queries |
| `supabase/migrations/20260424000001_authors_overhaul.sql` | Authors schema: social_links, avatar_color, sort_order, is_default |
| `apps/web/test/cms/settings.test.ts` | Settings tests |
| `apps/web/test/cms/authors.test.ts` | Authors tests |
| `apps/web/test/cms/dashboard.test.ts` | Dashboard tests |
| `apps/web/test/cms/posts-actions.test.ts` | Posts bulk action tests |
| `apps/web/test/cms/posts.test.ts` | Posts connected component tests |
| `apps/web/test/cms/schedule.test.ts` | Schedule tests |
| `apps/web/test/cms/analytics.test.ts` | Analytics tests |
| `apps/web/test/cms/newsletters.test.ts` | Newsletters tests |
| `apps/web/test/cms/contacts.test.ts` | Contacts tests |
| `apps/web/test/cms/subscribers.test.ts` | Subscribers tests |
| `apps/web/test/cms/campaigns.test.ts` | Campaigns tests |
| `apps/web/test/cms/layout.test.ts` | Layout/sidebar tests |

### Modified Files
| File | Changes |
|------|---------|
| `apps/web/src/app/cms/(authed)/layout.tsx` | Contacts pending badge, sidebar restructure, RBAC redirects |
| `apps/web/src/app/cms/(authed)/page.tsx` | Dashboard overhaul: KPIs, last NL banner, 3-col middle, top content |
| `apps/web/src/app/cms/(authed)/blog/page.tsx` | Wire PostsListConnected, 50/page, authors fetch |
| `apps/web/src/app/cms/(authed)/authors/page.tsx` | Wire AuthorsConnected, filter pills, search |
| `apps/web/src/app/cms/(authed)/schedule/page.tsx` | Suspense wrapper, skeleton |
| `apps/web/src/app/cms/(authed)/schedule/schedule-connected.tsx` | Full rewrite: views, backlog, undo, keyboard |
| `apps/web/src/app/cms/(authed)/analytics/page.tsx` | Suspense, URL params forwarding |
| `apps/web/src/app/cms/(authed)/analytics/analytics-tabs-connected.tsx` | Full rewrite: 4 tabs, period, compare, export |
| `apps/web/src/app/cms/(authed)/newsletters/page.tsx` | KPI strip, last NL banner, search |
| `apps/web/src/app/cms/(authed)/contacts/page.tsx` | Full rewrite: KPIs, filters, table, slide-in panel |
| `apps/web/src/app/cms/(authed)/subscribers/page.tsx` | Wire SubscribersConnected |
| `apps/web/src/app/cms/(authed)/campaigns/page.tsx` | Wire CampaignsConnected, submission stats |

### Deleted Files
| File | Reason |
|------|--------|
| `apps/web/src/app/cms/(authed)/contacts/[id]/page.tsx` | Replaced by slide-in panel in contacts-connected.tsx |

---

## Implementation Priority

Per design spec section 6, ordered by dependencies and user impact:

| Group | Tasks | Screen | Dependency |
|-------|-------|--------|------------|
| 0 | 41-42 | Layout/Sidebar | None (do first) |
| 1 | 1-5 | Settings | Blocks others (cadence config) |
| 2 | 6-10 | Authors | Schema migration, blocks Posts author display |
| 3 | 11-14 | Dashboard | Highest visibility |
| 4 | 15-19 | Posts | Core content management |
| 5 | 20-24 | Schedule | Depends on cadence config |
| 6 | 25-29 | Analytics | Depends on data accumulation |
| 7 | 30-34 | Newsletters | Existing implementation upgrade |
| 8 | 35-40 | Contacts | Self-contained |
| 9 | 43-46 | Subscribers | Admin-only |
| 10 | 47-49 | Campaigns | Lowest change delta |

---

## Group 0 — Layout & Sidebar (Tasks 41-42)

### Task 41: Sidebar nav restructure + Contatos badge query

**Files:**
- Create: `apps/web/src/app/cms/(authed)/layout-helpers.ts`
- Create: `apps/web/test/cms/layout.test.ts`

- [ ] **41.1** Write failing test for sidebar sections config and contacts badge query

```typescript
// apps/web/test/cms/layout.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
    })),
  })),
}))

describe('SIDEBAR_SECTIONS', () => {
  it('OVERVIEW contains Dashboard and Schedule', async () => {
    const { SIDEBAR_SECTIONS } = await import('@/app/cms/(authed)/layout-helpers')
    const overview = SIDEBAR_SECTIONS.find((s) => s.label === 'OVERVIEW')
    expect(overview).toBeDefined()
    const labels = overview!.items.map((i) => i.label)
    expect(labels).toEqual(['Dashboard', 'Schedule'])
  })

  it('CONTENT contains Posts, Newsletters, Campaigns', async () => {
    const { SIDEBAR_SECTIONS } = await import('@/app/cms/(authed)/layout-helpers')
    const content = SIDEBAR_SECTIONS.find((s) => s.label === 'CONTENT')
    const labels = content!.items.map((i) => i.label)
    expect(labels).toEqual(['Posts', 'Newsletters', 'Campaigns'])
  })

  it('PEOPLE contains Authors, Subscribers, Contatos', async () => {
    const { SIDEBAR_SECTIONS } = await import('@/app/cms/(authed)/layout-helpers')
    const people = SIDEBAR_SECTIONS.find((s) => s.label === 'PEOPLE')
    const labels = people!.items.map((i) => i.label)
    expect(labels).toEqual(['Authors', 'Subscribers', 'Contatos'])
  })

  it('INSIGHTS contains Analytics', async () => {
    const { SIDEBAR_SECTIONS } = await import('@/app/cms/(authed)/layout-helpers')
    const insights = SIDEBAR_SECTIONS.find((s) => s.label === 'INSIGHTS')
    const labels = insights!.items.map((i) => i.label)
    expect(labels).toEqual(['Analytics'])
  })

  it('Settings is a standalone section', async () => {
    const { SIDEBAR_SECTIONS } = await import('@/app/cms/(authed)/layout-helpers')
    const settings = SIDEBAR_SECTIONS.find((s) => s.items.some((i) => i.label === 'Settings'))
    expect(settings).toBeDefined()
  })
})
```

Run: `npm run test:web -- test/cms/layout.test.ts`
Expected: FAIL — module not found

- [ ] **41.2** Create layout-helpers with sidebar config

```typescript
// apps/web/src/app/cms/(authed)/layout-helpers.ts
export interface SidebarItem {
  label: string
  href: string
  badgeKey?: string
}

export interface SidebarSection {
  label: string
  items: SidebarItem[]
}

export const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    label: 'OVERVIEW',
    items: [
      { label: 'Dashboard', href: '/cms' },
      { label: 'Schedule', href: '/cms/schedule' },
    ],
  },
  {
    label: 'CONTENT',
    items: [
      { label: 'Posts', href: '/cms/blog', badgeKey: '/cms/blog' },
      { label: 'Newsletters', href: '/cms/newsletters' },
      { label: 'Campaigns', href: '/cms/campaigns' },
    ],
  },
  {
    label: 'PEOPLE',
    items: [
      { label: 'Authors', href: '/cms/authors' },
      { label: 'Subscribers', href: '/cms/subscribers' },
      { label: 'Contatos', href: '/cms/contacts', badgeKey: '/cms/contacts' },
    ],
  },
  {
    label: 'INSIGHTS',
    items: [
      { label: 'Analytics', href: '/cms/analytics' },
    ],
  },
  {
    label: '',
    items: [
      { label: 'Settings', href: '/cms/settings' },
    ],
  },
]
```

- [ ] **41.3** Run tests — expect all passing

Run: `npm run test:web -- test/cms/layout.test.ts`
Expected: 5 passed

- [ ] **41.4** Commit

```bash
git add apps/web/src/app/cms/\(authed\)/layout-helpers.ts apps/web/test/cms/layout.test.ts
git commit -m "feat(cms): add sidebar sections config + layout tests"
```

---

### Task 42: Layout contacts badge + RBAC redirects

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/layout.tsx`

- [ ] **42.1** Add contacts pending badge query to the existing `Promise.all` in layout

Add a third query alongside `draftsRes` and `subsRes`:

```typescript
const [draftsRes, subsRes, pendingContactsRes] = await Promise.all([
  svc.from('blog_posts').select('id', { count: 'exact', head: true })
    .eq('site_id', currentSiteId).eq('status', 'draft'),
  svc.from('newsletter_subscriptions').select('id', { count: 'exact', head: true })
    .eq('site_id', currentSiteId).eq('status', 'confirmed'),
  svc.from('contact_submissions').select('id', { count: 'exact', head: true })
    .eq('site_id', currentSiteId).is('replied_at', null).is('anonymized_at', null),
])
```

- [ ] **42.2** Add contacts badge to the badges map

```typescript
if (pendingContactsRes.count) badges['/cms/contacts'] = pendingContactsRes.count
```

- [ ] **42.3** Run full web test suite

Run: `npm run test:web`
Expected: all tests pass

- [ ] **42.4** Commit

```bash
git add apps/web/src/app/cms/\(authed\)/layout.tsx
git commit -m "feat(cms): add contacts pending badge to sidebar"
```

---

## Group 1 — Settings (Tasks 1-5)

### Task 1: Settings route scaffold + RBAC gate

**Files:**
- Create: `apps/web/src/app/cms/(authed)/settings/page.tsx`
- Create: `apps/web/test/cms/settings.test.ts`

- [ ] **1.1** Write failing test for settings page data fetch

```typescript
// apps/web/test/cms/settings.test.ts
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ getAll: () => [] })),
  headers: vi.fn(() => new Map()),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({
    siteId: 'site-1', orgId: 'org-1', defaultLocale: 'pt-BR',
  }),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: table === 'newsletter_types'
          ? [{ id: 'nt-1', name: 'Weekly', cadence_days: 7, sort_order: 0 }]
          : table === 'blog_cadence'
          ? [{ locale: 'pt-BR', cadence_days: 7 }]
          : [],
        error: null,
      }),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'site-1', logo_url: 'https://example.com/logo.png',
          primary_color: '#000000', identity_type: 'person',
          twitter_handle: 'tnFigueiredo', seo_default_og_image: null,
          supported_locales: ['pt-BR', 'en'], default_locale: 'pt-BR',
          cms_enabled: true,
        },
        error: null,
      }),
    })),
  })),
}))

vi.mock('@/app/cms/(authed)/settings/settings-connected', () => ({
  SettingsConnected: (props: Record<string, unknown>) => (
    <div data-testid="settings-connected" data-site-id={(props.site as { id: string })?.id} />
  ),
}))

describe('Settings page', () => {
  it('renders SettingsConnected with site data', async () => {
    const { default: SettingsPage } = await import('@/app/cms/(authed)/settings/page')
    const jsx = await SettingsPage({ searchParams: Promise.resolve({}) })
    render(jsx)
    expect(screen.getByTestId('settings-connected')).toBeDefined()
    expect(screen.getByTestId('settings-connected').getAttribute('data-site-id')).toBe('site-1')
  })
})
```

Run: `npm run test:web -- test/cms/settings.test.ts`
Expected: FAIL — module not found

- [ ] **1.2** Create settings server component

```typescript
// apps/web/src/app/cms/(authed)/settings/page.tsx
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { SettingsConnected } from './settings-connected'

interface Props {
  searchParams: Promise<{ section?: string }>
}

export default async function SettingsPage({ searchParams }: Props) {
  const params = await searchParams
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const [siteRes, typesRes, cadenceRes] = await Promise.all([
    supabase.from('sites').select('*').eq('id', siteId).single(),
    supabase.from('newsletter_types').select('*').eq('site_id', siteId).order('sort_order'),
    supabase.from('blog_cadence').select('*').eq('site_id', siteId).order('locale'),
  ])

  return (
    <div>
      <CmsTopbar title="Settings" />
      <SettingsConnected
        site={siteRes.data}
        newsletterTypes={typesRes.data ?? []}
        blogCadence={cadenceRes.data ?? []}
        initialSection={params.section ?? 'branding'}
      />
    </div>
  )
}
```

- [ ] **1.3** Create minimal SettingsConnected stub for test to pass

```typescript
// apps/web/src/app/cms/(authed)/settings/settings-connected.tsx
'use client'

interface Props {
  site: unknown
  newsletterTypes: unknown[]
  blogCadence: unknown[]
  initialSection: string
}

export function SettingsConnected({ site, newsletterTypes, blogCadence, initialSection }: Props) {
  return <div>Settings stub — {initialSection}</div>
}
```

- [ ] **1.4** Run test — expect pass

Run: `npm run test:web -- test/cms/settings.test.ts`
Expected: 1 passed

- [ ] **1.5** Commit

```bash
git add apps/web/src/app/cms/\(authed\)/settings/ apps/web/test/cms/settings.test.ts
git commit -m "feat(cms): scaffold settings route with server data fetch"
```

---

### Task 2: Settings server actions

**Files:**
- Create: `apps/web/src/app/cms/(authed)/settings/actions.ts`
- Modify: `apps/web/test/cms/settings.test.ts`

- [ ] **2.1** Write failing tests for branding + identity + SEO actions

```typescript
// Append to apps/web/test/cms/settings.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const mockUpdate = vi.fn()
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })),
  })),
}))
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1', orgId: 'org-1', defaultLocale: 'pt-BR' }),
}))
vi.mock('@/lib/cms/auth-guards', () => ({
  requireSiteAdminForRow: vi.fn().mockResolvedValue(undefined),
}))

describe('updateBranding', () => {
  beforeEach(() => vi.clearAllMocks())

  it('validates logo_url starts with https://', async () => {
    const { updateBranding } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateBranding({ logo_url: 'http://bad.com/logo.png', primary_color: '#000000' })
    expect(result.ok).toBe(false)
  })

  it('validates primary_color is hex', async () => {
    const { updateBranding } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateBranding({ logo_url: 'https://ok.com/logo.png', primary_color: 'red' })
    expect(result.ok).toBe(false)
  })

  it('returns ok on valid input', async () => {
    const { updateBranding } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateBranding({ logo_url: 'https://ok.com/logo.png', primary_color: '#ff6600' })
    expect(result.ok).toBe(true)
  })
})

describe('updateIdentity', () => {
  it('validates twitter_handle format', async () => {
    const { updateIdentity } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateIdentity({ identity_type: 'person', twitter_handle: '@too-long-handle!!!' })
    expect(result.ok).toBe(false)
  })

  it('accepts valid identity data', async () => {
    const { updateIdentity } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateIdentity({ identity_type: 'person', twitter_handle: 'tnFigueiredo' })
    expect(result.ok).toBe(true)
  })
})
```

Run: `npm run test:web -- test/cms/settings.test.ts`
Expected: FAIL — module not found

- [ ] **2.2** Create settings actions with validation

```typescript
// apps/web/src/app/cms/(authed)/settings/actions.ts
'use server'

import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'

type ActionResult = { ok: true } | { ok: false; error: string }

const brandingSchema = z.object({
  logo_url: z.string().startsWith('https://').or(z.literal('')),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
})

const identitySchema = z.object({
  identity_type: z.enum(['person', 'organization']),
  twitter_handle: z.string().regex(/^[A-Za-z0-9_]{1,15}$/).or(z.literal('')),
})

const seoSchema = z.object({
  seo_default_og_image: z.string().startsWith('https://').or(z.literal('')).nullable(),
})

export async function updateBranding(input: { logo_url: string; primary_color: string }): Promise<ActionResult> {
  const parsed = brandingSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase.from('sites').update(parsed.data).eq('id', siteId)
  if (error) return { ok: false, error: error.message }

  revalidateTag('seo-config')
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function updateIdentity(input: { identity_type: string; twitter_handle: string }): Promise<ActionResult> {
  const parsed = identitySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase.from('sites').update(parsed.data).eq('id', siteId)
  if (error) return { ok: false, error: error.message }

  revalidateTag('seo-config')
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function updateSeoDefaults(input: { seo_default_og_image: string | null }): Promise<ActionResult> {
  const parsed = seoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase.from('sites').update(parsed.data).eq('id', siteId)
  if (error) return { ok: false, error: error.message }

  revalidateTag('seo-config')
  return { ok: true }
}

export async function updateNewsletterType(id: string, data: Record<string, unknown>): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase.from('newsletter_types').update(data).eq('id', id).eq('site_id', siteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function createNewsletterType(data: Record<string, unknown>): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase.from('newsletter_types').insert({ ...data, site_id: siteId })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function deleteNewsletterType(id: string): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase.from('newsletter_types').delete().eq('id', id).eq('site_id', siteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function reorderNewsletterTypes(orderedIds: string[]): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from('newsletter_types').update({ sort_order: i }).eq('id', orderedIds[i]).eq('site_id', siteId)
    if (error) return { ok: false, error: error.message }
  }
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function updateBlogCadence(locale: string, data: Record<string, unknown>): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase.from('blog_cadence').upsert({ ...data, locale, site_id: siteId }, { onConflict: 'site_id,locale' })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function updateSiteLocales(data: { default_locale: string; supported_locales: string[] }): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase.from('sites').update(data).eq('id', siteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function disableCms(): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase.from('sites').update({ cms_enabled: false }).eq('id', siteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms')
  return { ok: true }
}

export async function deleteSite(confirmSlug: string): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { data: site } = await supabase.from('sites').select('slug').eq('id', siteId).single()
  if (!site || site.slug !== confirmSlug) return { ok: false, error: 'Slug confirmation does not match' }
  const { error } = await supabase.from('sites').delete().eq('id', siteId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
```

- [ ] **2.3** Run tests — expect all passing

Run: `npm run test:web -- test/cms/settings.test.ts`
Expected: all passed

- [ ] **2.4** Commit

```bash
git add apps/web/src/app/cms/\(authed\)/settings/actions.ts apps/web/test/cms/settings.test.ts
git commit -m "feat(cms): add 11 settings server actions with Zod validation"
```

---

### Task 3: SettingsConnected client component (6-tab layout)

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/settings/settings-connected.tsx`
- Modify: `apps/web/test/cms/settings.test.ts`

- [ ] **3.1** Write component tests for tab navigation + section rendering

```typescript
// Append to settings.test.ts
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))

vi.mock('@/app/cms/(authed)/settings/actions', () => ({
  updateBranding: vi.fn().mockResolvedValue({ ok: true }),
  updateIdentity: vi.fn().mockResolvedValue({ ok: true }),
  updateSeoDefaults: vi.fn().mockResolvedValue({ ok: true }),
  updateNewsletterType: vi.fn().mockResolvedValue({ ok: true }),
  createNewsletterType: vi.fn().mockResolvedValue({ ok: true }),
  deleteNewsletterType: vi.fn().mockResolvedValue({ ok: true }),
  reorderNewsletterTypes: vi.fn().mockResolvedValue({ ok: true }),
  updateBlogCadence: vi.fn().mockResolvedValue({ ok: true }),
  updateSiteLocales: vi.fn().mockResolvedValue({ ok: true }),
  disableCms: vi.fn().mockResolvedValue({ ok: true }),
  deleteSite: vi.fn().mockResolvedValue({ ok: true }),
}))

const mockSite = {
  id: 'site-1', logo_url: 'https://example.com/logo.png', primary_color: '#000000',
  identity_type: 'person', twitter_handle: 'tnFigueiredo', seo_default_og_image: null,
  supported_locales: ['pt-BR', 'en'], default_locale: 'pt-BR', cms_enabled: true,
}

describe('SettingsConnected', () => {
  it('renders 6 tab buttons', async () => {
    const { SettingsConnected } = await import('@/app/cms/(authed)/settings/settings-connected')
    render(<SettingsConnected site={mockSite} newsletterTypes={[]} blogCadence={[]} initialSection="branding" />)
    expect(screen.getByRole('button', { name: /branding/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /seo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /newsletters/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /blog cadence/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /localization/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /danger zone/i })).toBeInTheDocument()
  })

  it('shows branding section by default', async () => {
    const { SettingsConnected } = await import('@/app/cms/(authed)/settings/settings-connected')
    render(<SettingsConnected site={mockSite} newsletterTypes={[]} blogCadence={[]} initialSection="branding" />)
    expect(screen.getByLabelText(/logo url/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/primary color/i)).toBeInTheDocument()
  })

  it('switches section on tab click', async () => {
    const { SettingsConnected } = await import('@/app/cms/(authed)/settings/settings-connected')
    render(<SettingsConnected site={mockSite} newsletterTypes={[]} blogCadence={[]} initialSection="branding" />)
    fireEvent.click(screen.getByRole('button', { name: /seo/i }))
    expect(screen.getByLabelText(/default og image/i)).toBeInTheDocument()
  })
})
```

Run: `npm run test:web -- test/cms/settings.test.ts`
Expected: FAIL — stub component doesn't render tabs

- [ ] **3.2** Implement full SettingsConnected with 6 sections

The component should:
- Render a sidebar with 6 tab buttons (left, 175px)
- Content area renders the active section
- Each section has its own form with save button
- Save pattern: Default → Saving (spinner) → Success ("Salvo", 2s) → Reset
- Keyboard: Cmd+S saves current section, 1-6 switch tabs

(Full implementation follows the component pattern from the design spec section 4.9. The component reads props for initial data and calls server actions on save.)

- [ ] **3.3** Run tests — all passing

Run: `npm run test:web -- test/cms/settings.test.ts`
Expected: all passed

- [ ] **3.4** Run full web suite

Run: `npm run test:web`
Expected: all tests pass

- [ ] **3.5** Commit

```bash
git add apps/web/src/app/cms/\(authed\)/settings/settings-connected.tsx apps/web/test/cms/settings.test.ts
git commit -m "feat(cms): implement SettingsConnected 6-tab layout with save state machine"
```

---

### Task 4: Settings inline validation + keyboard shortcuts

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/settings/settings-connected.tsx`
- Modify: `apps/web/test/cms/settings.test.ts`

- [ ] **4.1** Add validation tests

```typescript
describe('SettingsConnected — validation', () => {
  it('shows error on invalid logo URL', async () => {
    const { SettingsConnected } = await import('@/app/cms/(authed)/settings/settings-connected')
    render(<SettingsConnected site={mockSite} newsletterTypes={[]} blogCadence={[]} initialSection="branding" />)
    const input = screen.getByLabelText(/logo url/i)
    fireEvent.change(input, { target: { value: 'http://bad.com' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/must start with https/i)).toBeInTheDocument()
  })

  it('shows error on invalid hex color', async () => {
    const { SettingsConnected } = await import('@/app/cms/(authed)/settings/settings-connected')
    render(<SettingsConnected site={mockSite} newsletterTypes={[]} blogCadence={[]} initialSection="branding" />)
    const input = screen.getByLabelText(/primary color/i)
    fireEvent.change(input, { target: { value: 'red' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/valid hex/i)).toBeInTheDocument()
  })
})
```

- [ ] **4.2** Implement inline validation in each section form
- [ ] **4.3** Add keyboard handler: Cmd+S saves, 1-6 switch tabs
- [ ] **4.4** Run tests — all passing

Run: `npm run test:web -- test/cms/settings.test.ts`

- [ ] **4.5** Commit

```bash
git add apps/web/src/app/cms/\(authed\)/settings/settings-connected.tsx apps/web/test/cms/settings.test.ts
git commit -m "feat(cms): add inline validation + keyboard shortcuts to settings"
```

---

### Task 5: Settings full verification

- [ ] **5.1** Run full web test suite: `npm run test:web`
- [ ] **5.2** Typecheck: `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -10`
- [ ] **5.3** Verify no regressions in other CMS pages

---

## Group 2 — Authors (Tasks 6-10)

### Task 6: Authors schema migration

**Files:**
- Create: `supabase/migrations/20260424000001_authors_overhaul.sql`

- [ ] **6.1** Create migration adding new columns

```sql
-- supabase/migrations/20260424000001_authors_overhaul.sql
ALTER TABLE public.authors ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
ALTER TABLE public.authors ADD COLUMN IF NOT EXISTS avatar_color TEXT;
ALTER TABLE public.authors ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE public.authors ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Unique constraint on (site_id, slug)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'authors_site_slug_unique'
  ) THEN
    ALTER TABLE public.authors ADD CONSTRAINT authors_site_slug_unique UNIQUE (site_id, slug);
  END IF;
END $$;

-- Partial unique: only one default per site
CREATE UNIQUE INDEX IF NOT EXISTS authors_one_default_per_site
  ON public.authors (site_id)
  WHERE is_default = true;
```

- [ ] **6.2** Verify migration syntax: `cat supabase/migrations/20260424000001_authors_overhaul.sql`
- [ ] **6.3** Commit

```bash
git add supabase/migrations/20260424000001_authors_overhaul.sql
git commit -m "feat(db): authors overhaul — social_links, avatar_color, sort_order, is_default"
```

---

### Task 7: Authors server actions

**Files:**
- Create: `apps/web/src/app/cms/(authed)/authors/actions.ts`
- Create: `apps/web/test/cms/authors.test.ts`

- [ ] **7.1** Write failing tests for createAuthor, updateAuthor, deleteAuthor, setDefaultAuthor

```typescript
// apps/web/test/cms/authors.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockEq = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: mockInsert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'author-1', slug: 'test' }, error: null }) }) }),
      update: mockUpdate.mockReturnValue({ eq: mockEq.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }),
      delete: mockDelete.mockReturnValue({ eq: mockEq }),
    })),
  })),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1', orgId: 'org-1', defaultLocale: 'pt-BR' }),
}))

describe('createAuthor', () => {
  beforeEach(() => vi.clearAllMocks())
  it('inserts author with auto-generated slug', async () => {
    const { createAuthor } = await import('@/app/cms/(authed)/authors/actions')
    const result = await createAuthor({ display_name: 'Test Author', bio: 'A bio', type: 'virtual' })
    expect(result.ok).toBe(true)
    expect(mockInsert).toHaveBeenCalled()
  })

  it('rejects empty display_name', async () => {
    const { createAuthor } = await import('@/app/cms/(authed)/authors/actions')
    const result = await createAuthor({ display_name: '', bio: '', type: 'virtual' })
    expect(result.ok).toBe(false)
  })
})

describe('setDefaultAuthor', () => {
  it('returns ok on success', async () => {
    const { setDefaultAuthor } = await import('@/app/cms/(authed)/authors/actions')
    const result = await setDefaultAuthor('author-1')
    expect(result.ok).toBe(true)
  })
})
```

Run: `npm run test:web -- test/cms/authors.test.ts`
Expected: FAIL

- [ ] **7.2** Create authors actions

```typescript
// apps/web/src/app/cms/(authed)/authors/actions.ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'

type ActionResult<T = Record<string, unknown>> = { ok: true } & T | { ok: false; error: string }

const createSchema = z.object({
  display_name: z.string().min(1, 'Name is required'),
  bio: z.string().optional(),
  type: z.enum(['virtual', 'linked']),
  user_id: z.string().uuid().optional(),
  avatar_color: z.string().optional(),
  social_links: z.record(z.string()).optional(),
})

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)
}

export async function createAuthor(input: z.infer<typeof createSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const slug = slugify(parsed.data.display_name)

  const { data, error } = await supabase.from('authors').insert({
    display_name: parsed.data.display_name,
    slug,
    bio: parsed.data.bio ?? null,
    site_id: siteId,
    user_id: parsed.data.user_id ?? null,
    avatar_color: parsed.data.avatar_color ?? null,
    social_links: parsed.data.social_links ?? {},
  }).select('id').single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/authors')
  return { ok: true, id: data.id }
}

export async function updateAuthor(id: string, data: Record<string, unknown>): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase.from('authors').update(data).eq('id', id).eq('site_id', siteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/authors')
  return { ok: true }
}

export async function deleteAuthor(id: string): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase.from('authors').delete().eq('id', id).eq('site_id', siteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/authors')
  return { ok: true }
}

export async function setDefaultAuthor(id: string): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  await supabase.from('authors').update({ is_default: false }).eq('site_id', siteId).eq('is_default', true)
  const { error } = await supabase.from('authors').update({ is_default: true }).eq('id', id).eq('site_id', siteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/authors')
  return { ok: true }
}

export async function reorderAuthors(orderedIds: string[]): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from('authors').update({ sort_order: i }).eq('id', orderedIds[i]).eq('site_id', siteId)
    if (error) return { ok: false, error: error.message }
  }
  revalidatePath('/cms/authors')
  return { ok: true }
}
```

- [ ] **7.3** Run tests — all passing
- [ ] **7.4** Commit

```bash
git add apps/web/src/app/cms/\(authed\)/authors/actions.ts apps/web/test/cms/authors.test.ts
git commit -m "feat(cms): add authors server actions with slug generation"
```

---

### Task 8: AuthorsConnected client component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/authors/authors-connected.tsx`
- Modify: `apps/web/test/cms/authors.test.ts`

- [ ] **8.1** Write component tests: card grid, filter pills (All/Linked/Virtual), search, create modal, detail panel
- [ ] **8.2** Implement AuthorsConnected with card grid, filter URL params, create/edit modal, detail slide-in panel
- [ ] **8.3** Run tests — all passing
- [ ] **8.4** Commit

---

### Task 9: Wire Authors page.tsx to AuthorsConnected

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/authors/page.tsx`

- [ ] **9.1** Update page to pass authors data + search/filter params to AuthorsConnected
- [ ] **9.2** Add searchParams support for `?type=`, `?q=`
- [ ] **9.3** Run full web test suite
- [ ] **9.4** Commit

---

### Task 10: Authors + Settings full verification

- [ ] **10.1** Run `npm run test:web` — all pass
- [ ] **10.2** Typecheck `npx tsc --noEmit -p apps/web/tsconfig.json` — 0 errors
- [ ] **10.3** Verify migration file present
- [ ] **10.4** Commit all remaining files

---

## Group 3 — Dashboard (Tasks 11-14)

### Task 11: Dashboard data methods

**Files:**
- Modify: `apps/web/lib/cms/admin.ts` (if needed, or use service client directly in page)
- Create: `apps/web/test/cms/dashboard.test.ts`

- [ ] **11.1** Write tests for new dashboard data: last newsletter, recent activity, top content
- [ ] **11.2** Implement data fetching in dashboard page (direct service client queries)
- [ ] **11.3** Run tests — all passing
- [ ] **11.4** Commit

### Task 12: DashboardConnected client component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/_components/dashboard-connected.tsx`

- [ ] **12.1** Write tests: KPI strip (4 cards), last newsletter banner, 3-col middle, top content tabs, empty state
- [ ] **12.2** Implement DashboardConnected
- [ ] **12.3** Run tests — all passing
- [ ] **12.4** Commit

### Task 13: Wire Dashboard page.tsx

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/page.tsx`

- [ ] **13.1** Replace current page with updated server component using DashboardConnected
- [ ] **13.2** Fetch lastNewsletter, recentActivity, topContent in parallel with existing KPIs
- [ ] **13.3** Typecheck + run tests
- [ ] **13.4** Commit

### Task 14: Dashboard edge cases + final verify

- [ ] **14.1** Add edge-case tests (amber unread count, zero-state onboarding)
- [ ] **14.2** Run full suite — all pass
- [ ] **14.3** Commit

---

## Group 4 — Posts (Tasks 15-19)

### Task 15: Posts bulk action server actions

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/actions.ts` (append to existing)
- Create: `apps/web/test/cms/posts-actions.test.ts`

- [ ] **15.1** Write tests for bulkPublish, bulkArchive, bulkDelete, bulkChangeAuthor
- [ ] **15.2** Implement 4 bulk actions with RBAC + CAS
- [ ] **15.3** Run tests — 12 passing
- [ ] **15.4** Commit

### Task 16: PostsListConnected client component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/_components/posts-list-connected.tsx`
- Create: `apps/web/test/cms/posts.test.ts`

- [ ] **16.1** Write tests: table, pagination, empty state, bulk bar visibility, bulk action calls, filter pills
- [ ] **16.2** Implement PostsListConnected with selection, bulk bar, status filter pills
- [ ] **16.3** Run tests — all passing
- [ ] **16.4** Commit

### Task 17: Wire Posts page.tsx + URL router

- [ ] **17.1** Update page to use PostsListConnected, increase pageSize to 50, add authors fetch
- [ ] **17.2** Add `useRouter` + `useSearchParams` in client component for filter URL pushes
- [ ] **17.3** Run tests — all passing
- [ ] **17.4** Commit

### Task 18: Posts search + sort + columns

- [ ] **18.1** Add search input with debounced URL param update
- [ ] **18.2** Add sort dropdown (Newest/Oldest/Recently Published/Most Viewed)
- [ ] **18.3** Verify cover image, locale badges, author columns pass through in Post interface
- [ ] **18.4** Run tests — all passing
- [ ] **18.5** Commit

### Task 19: Posts full verification

- [ ] **19.1** Run `npm run test:web` — all pass
- [ ] **19.2** Typecheck — 0 errors
- [ ] **19.3** Commit

---

## Group 5 — Schedule (Tasks 20-24)

### Task 20: Schedule server actions (CAS)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/schedule/actions.ts`
- Create: `apps/web/test/cms/schedule.test.ts`

- [ ] **20.1** Write tests for scheduleItem, unslotItem, publishNow, reorderBacklog
- [ ] **20.2** Implement actions with Zod type validation + CAS patterns
- [ ] **20.3** Run tests — 9 passing
- [ ] **20.4** Commit

### Task 21: Schedule page Suspense wrapper

- [ ] **21.1** Rewrite page.tsx with Suspense boundary + skeleton fallback
- [ ] **21.2** Typecheck
- [ ] **21.3** Commit

### Task 22: ScheduleConnected client component

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/schedule/schedule-connected.tsx`

- [ ] **22.1** Write tests: view toggle (week/agenda/month), backlog sidebar, prev/next week, keyboard 1/2/3
- [ ] **22.2** Implement with useReducer state management, 3 views, backlog sidebar, optimistic scheduling, undo toast
- [ ] **22.3** Run tests — all passing
- [ ] **22.4** Commit

### Task 23: Schedule conflict detection + quick-schedule

- [ ] **23.1** Add tests for busy-day badge, overdue count, undo toast after schedule
- [ ] **23.2** Implement conflict badges + undo toast wiring
- [ ] **23.3** Run tests
- [ ] **23.4** Commit

### Task 24: Schedule full verification

- [ ] **24.1** Typecheck
- [ ] **24.2** Run `npm run test:web` — all pass
- [ ] **24.3** Commit

---

## Group 6 — Analytics (Tasks 25-29)

### Task 25: Analytics server actions

**Files:**
- Create: `apps/web/src/app/cms/(authed)/analytics/actions.ts`
- Create: `apps/web/test/cms/analytics.test.ts`

- [ ] **25.1** Write tests for fetchOverview, fetchNewsletterStats, fetchCampaignStats, fetchContentStats, refreshStats, exportReport
- [ ] **25.2** Implement with Zod period validation + cms.analytics delegates
- [ ] **25.3** Run tests — all passing
- [ ] **25.4** Commit

### Task 26: Analytics page Suspense wrapper

- [ ] **26.1** Rewrite page with searchParams forwarding (tab, period, compare)
- [ ] **26.2** Typecheck
- [ ] **26.3** Commit

### Task 27: AnalyticsTabsConnected client component

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/analytics/analytics-tabs-connected.tsx`

- [ ] **27.1** Write tests: 4 tabs, period selector, aria-selected/pressed, tab switch, keyboard 1-4
- [ ] **27.2** Implement with useReducer, tab panels (Overview/Newsletters/Campaigns/Content), period buttons, compare toggle
- [ ] **27.3** Run tests — all passing
- [ ] **27.4** Commit

### Task 28: Analytics stale data + export dialog

- [ ] **28.1** Add tests: refresh button hidden when not stale, E key opens export, cancel closes, download triggers exportReport
- [ ] **28.2** Implement export dialog with format/sections/period selection
- [ ] **28.3** Run tests
- [ ] **28.4** Commit

### Task 29: Analytics full verification

- [ ] **29.1** Typecheck
- [ ] **29.2** Run `npm run test:web` + `npm run test:api` — all pass
- [ ] **29.3** Commit

---

## Group 7 — Newsletters (Tasks 30-34)

### Task 30: Newsletters KPI data + last sent banner

**Files:**
- Create: `apps/web/test/cms/newsletters.test.ts`

- [ ] **30.1** Write tests for KPI strip rendering (4 cards: Unique Subs, Editions Sent, Avg Open Rate, Bounce Rate)
- [ ] **30.2** Write tests for last newsletter banner (gradient card with stats)
- [ ] **30.3** Implement data queries in page.tsx using cms.newsletters
- [ ] **30.4** Run tests
- [ ] **30.5** Commit

### Task 31: NewslettersConnected client component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/newsletters-connected.tsx`

- [ ] **31.1** Write tests: type card selection with indigo border, edition table with row variants, search input, sort by column
- [ ] **31.2** Implement with URL params for type filter + status filter + search
- [ ] **31.3** Run tests
- [ ] **31.4** Commit

### Task 32: Wire Newsletters page.tsx

- [ ] **32.1** Add KPI strip + last NL banner above existing TypeCards
- [ ] **32.2** Add search input + pagination
- [ ] **32.3** Run tests
- [ ] **32.4** Commit

### Task 33: Newsletters context menu + retry action

- [ ] **33.1** Add retryEdition server action
- [ ] **33.2** Add per-row context menu varying by edition status
- [ ] **33.3** Run tests
- [ ] **33.4** Commit

### Task 34: Newsletters full verification

- [ ] **34.1** Run `npm run test:web` — all pass
- [ ] **34.2** Commit

---

## Group 8 — Contacts (Tasks 35-40)

### Task 35: Contacts server actions

**Files:**
- Create: `apps/web/src/app/cms/(authed)/contacts/actions.ts`
- Create: `apps/web/test/cms/contacts.test.ts`

- [ ] **35.1** Write tests for markReplied, undoMarkReplied, anonymizeSubmission, bulkAnonymize, sendReply, exportContacts

```typescript
// apps/web/test/cms/contacts.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
const mockUpdate = vi.fn()
const mockRpc = vi.fn()
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: mockUpdate.mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
    })),
    rpc: mockRpc.mockResolvedValue({ error: null }),
  })),
}))
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1', orgId: 'org-1', defaultLocale: 'pt-BR' }),
}))

describe('markReplied', () => {
  beforeEach(() => vi.clearAllMocks())
  it('updates replied_at on submission', async () => {
    const { markReplied } = await import('@/app/cms/(authed)/contacts/actions')
    const result = await markReplied('sub-1')
    expect(result.ok).toBe(true)
    expect(mockUpdate).toHaveBeenCalled()
  })
})

describe('undoMarkReplied', () => {
  it('clears replied_at', async () => {
    const { undoMarkReplied } = await import('@/app/cms/(authed)/contacts/actions')
    const result = await undoMarkReplied('sub-1')
    expect(result.ok).toBe(true)
  })
})

describe('anonymizeSubmission', () => {
  it('calls anonymize_contact_submission RPC', async () => {
    const { anonymizeSubmission } = await import('@/app/cms/(authed)/contacts/actions')
    const result = await anonymizeSubmission('sub-1')
    expect(result.ok).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('anonymize_contact_submission', { p_id: 'sub-1' })
  })
})
```

- [ ] **35.2** Implement 6 contacts server actions
- [ ] **35.3** Run tests — all passing
- [ ] **35.4** Commit

### Task 36: Contacts KPI strip + data queries

- [ ] **36.1** Add KPI queries in page server component (Total, Pending, Replied, Avg Response Time)
- [ ] **36.2** Add status filter + search + pagination via URL params
- [ ] **36.3** Run tests
- [ ] **36.4** Commit

### Task 37: ContactsConnected client component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/contacts/contacts-connected.tsx`

- [ ] **37.1** Write tests: table rendering, status filter tabs, row click opens detail panel, detail panel close on Esc
- [ ] **37.2** Implement with: checkbox selection, status filters, detail slide-in panel (380px), KPI cards, pagination
- [ ] **37.3** Run tests
- [ ] **37.4** Commit

### Task 38: Contacts optimistic mark replied + undo toast

- [ ] **38.1** Write tests: clicking mark replied flips badge immediately, undo toast appears, Z key triggers undo
- [ ] **38.2** Implement optimistic update + 5s undo toast with countdown + server sync
- [ ] **38.3** Run tests
- [ ] **38.4** Commit

### Task 39: Contacts LGPD features (anonymize, quick reply, retention banner)

- [ ] **39.1** Write tests: anonymize dialog shows field breakdown, bulk anonymize progress, quick reply textarea
- [ ] **39.2** Implement single + bulk anonymize dialogs, quick reply inline textarea (via Resend), retention info banner
- [ ] **39.3** Run tests
- [ ] **39.4** Commit

### Task 40: Contacts page rewrite + keyboard shortcuts + delete old detail page

- [ ] **40.1** Rewrite contacts/page.tsx to use ContactsConnected, remove [id]/page.tsx
- [ ] **40.2** Add keyboard handler: J/K navigate rows, Enter open panel, Esc close, R reply, M mark replied, Z undo, / search
- [ ] **40.3** Wire pending contacts badge in layout
- [ ] **40.4** Run `npm run test:web` — all pass
- [ ] **40.5** Commit

---

## Group 9 — Subscribers (Tasks 43-46)

### Task 43: Subscribers server actions

**Files:**
- Create: `apps/web/src/app/cms/(authed)/subscribers/actions.ts`
- Create: `apps/web/test/cms/subscribers.test.ts`

- [ ] **43.1** Write tests for exportSubscribers (CSV generation, excludes anonymized), batchUnsubscribe, toggleTrackingConsent
- [ ] **43.2** Implement 3 server actions
- [ ] **43.3** Run tests — 7 passing
- [ ] **43.4** Commit

### Task 44: SubscribersConnected client component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/subscribers/subscribers-connected.tsx`

- [ ] **44.1** Write tests: detail panel on row click, batch bar on selection, export dialog, column sort
- [ ] **44.2** Implement with detail slide-in (420px), batch actions bar, export CSV dialog, sortable columns
- [ ] **44.3** Run tests — all passing
- [ ] **44.4** Commit

### Task 45: Wire Subscribers page.tsx

- [ ] **45.1** Import SubscribersConnected, pass initialSubscribers + newsletterTypes + userRole
- [ ] **45.2** Run tests + typecheck
- [ ] **45.3** Commit

### Task 46: Subscribers mobile layout

- [ ] **46.1** Add mobile card list (md:hidden), hide table on mobile, sticky batch bar, full-screen detail sheet
- [ ] **46.2** Run tests
- [ ] **46.3** Commit

---

## Group 10 — Campaigns (Tasks 47-49)

### Task 47: Campaigns bulk actions

**Files:**
- Create: `apps/web/src/app/cms/(authed)/campaigns/bulk-actions.ts`
- Create: `apps/web/test/cms/campaigns.test.ts`

- [ ] **47.1** Write tests for bulkPublishCampaigns, bulkArchiveCampaigns, bulkDeleteCampaigns
- [ ] **47.2** Implement 3 bulk actions
- [ ] **47.3** Run tests — 6 passing
- [ ] **47.4** Commit

### Task 48: CampaignsConnected client component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/campaigns/campaigns-connected.tsx`

- [ ] **48.1** Write tests: campaign rows, submission count + conversion rate, bulk bar, URL param filters, column sort
- [ ] **48.2** Implement with bulk bar, client-side URL params, sort, pagination, mobile cards
- [ ] **48.3** Run tests — all passing
- [ ] **48.4** Commit

### Task 49: Wire Campaigns page.tsx + context menu

- [ ] **49.1** Replace CampaignTable with CampaignsConnected, add submission stats fetch
- [ ] **49.2** Add per-row context menu varying by status (Edit/Publish/Archive/Delete)
- [ ] **49.3** Run full test suite + typecheck
- [ ] **49.4** Commit

---

## Final Verification

- [ ] Run `npm run test:web` — all tests pass (baseline + ~100 new)
- [ ] Run `npm run test:api` — no regressions
- [ ] Typecheck `npx tsc --noEmit -p apps/web/tsconfig.json` — 0 errors
- [ ] Verify all new files exist: `find apps/web/src/app/cms -name "*connected*" -o -name "actions.ts" | wc -l` — expect ~12
- [ ] Verify migration: `ls supabase/migrations/ | grep authors_overhaul` — present
- [ ] Git status clean (all committed)
