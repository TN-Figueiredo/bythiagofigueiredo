# Site Switcher Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the decorative site switcher from admin and fix CMS site switcher React key warnings by passing correctly-shaped RPC data.

**Architecture:** App-layer only changes (Approach A). Admin layout drops its `SiteSwitcherProvider` + RPC call and uses a new minimal `AdminShell` wrapper. CMS layout keeps the provider but passes full RPC-shaped data directly to `CmsSiteSwitcherSlot` as a prop, eliminating the `as unknown as` cast that caused undefined keys.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, `@tn-figueiredo/admin@0.7.1`, `@tn-figueiredo/cms@0.2.0`, Vitest

**Spec:** `docs/superpowers/specs/2026-04-27-site-switcher-consolidation-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/web/src/components/admin/admin-shell.tsx` | **Create** | Client wrapper for `createAdminLayout` with module-level config |
| `apps/web/src/app/admin/(authed)/layout.tsx` | **Modify** | Strip switcher imports/RPC, use `AdminShell` |
| `apps/web/test/admin-layout.test.tsx` | **Modify** | Mock `AdminShell` instead of `AdminShellWithSwitcher` |
| `apps/web/src/components/cms/site-switcher-provider.tsx` | **Modify** | Remove admin exports, add `RpcAccessibleSite` type, fix `CmsSiteSwitcherSlot` to accept `sites` prop |
| `apps/web/src/app/cms/(authed)/layout.tsx` | **Modify** | Keep `rawSites`, pass to `CmsSiteSwitcherSlot` as prop |
| `apps/web/test/cms-layout.test.tsx` | **Modify** | Update mock to match new `CmsSiteSwitcherSlot` signature |
| `apps/web/next.config.ts` | **Modify** | Update stale comment (line 12-15) |

---

## Task 1: Admin — Create AdminShell + Simplify Layout

**Parallel group: A** (independent of Task 2)

**Files:**
- Create: `apps/web/src/components/admin/admin-shell.tsx`
- Modify: `apps/web/src/app/admin/(authed)/layout.tsx`
- Modify: `apps/web/test/admin-layout.test.tsx`

- [ ] **Step 1: Update admin layout test to mock AdminShell**

Replace the current mock of `site-switcher-provider` with a mock of the new `AdminShell` component. Remove the `AdminSiteSwitcherSlot` mock. The test should verify the layout renders children and passes the user email.

```tsx
// apps/web/test/admin-layout.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
  headers: async () => ({ get: () => null }),
}))

vi.mock('../src/components/admin/admin-shell', () => ({
  AdminShell: ({
    userEmail,
    children,
  }: {
    userEmail: string
    children: React.ReactNode
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'admin-shell', 'data-email': userEmail },
      children,
    ),
}))

vi.mock('@tn-figueiredo/auth-nextjs', () => ({
  createServerClient: vi.fn(() => ({
    rpc: vi.fn(async () => ({ data: [], error: null })),
  })),
  requireUser: vi.fn(async () => ({ id: 'u1', email: 'thiago@example.com' })),
  requireArea: vi.fn(async () => undefined),
}))

import Layout from '../src/app/admin/(authed)/layout'

describe('admin/layout', () => {
  it('renders admin shell with children', async () => {
    const el = await Layout({ children: <div>hello-admin</div> })
    const { getByText, getByTestId } = render(el)
    expect(getByText('hello-admin')).toBeTruthy()
    expect(getByTestId('admin-shell')).toBeTruthy()
  })

  it('passes user email to AdminShell', async () => {
    const el = await Layout({ children: <div>hello-admin</div> })
    const { getByTestId } = render(el)
    expect(getByTestId('admin-shell').getAttribute('data-email')).toBe('thiago@example.com')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/admin-layout.test.tsx`

Expected: FAIL — the layout still imports from `site-switcher-provider` which the test no longer mocks.

- [ ] **Step 3: Create AdminShell client component**

```tsx
// apps/web/src/components/admin/admin-shell.tsx
'use client'

import { createAdminLayout } from '@tn-figueiredo/admin'
import type { ReactNode } from 'react'

const AdminLayout = createAdminLayout({
  appName: 'Admin',
  logoutPath: '/admin/logout',
  sections: [
    {
      group: 'System',
      items: [
        { label: 'Dashboard', path: '/admin', icon: 'LayoutDashboard' },
        { label: 'Users', path: '/admin/users', icon: 'Users' },
        { label: 'Anúncios', path: '/admin/ads', icon: 'Megaphone' },
        { label: 'Settings', path: '/admin/settings', icon: 'Settings' },
      ],
    },
  ],
})

export function AdminShell({
  userEmail,
  children,
}: {
  userEmail: string
  children: ReactNode
}) {
  return <AdminLayout userEmail={userEmail}>{children}</AdminLayout>
}
```

- [ ] **Step 4: Simplify admin layout**

Replace the entire file content. Remove: `ADMIN_CONFIG`, RPC call, site mapping, `AdminShellWithSwitcher`, `AdminSiteSwitcherSlot`, `AccessibleSite` imports. Keep supabase client creation — `requireUser(supabase)` requires it.

```tsx
// apps/web/src/app/admin/(authed)/layout.tsx
import {
  createServerClient,
  requireArea,
  requireUser,
} from '@tn-figueiredo/auth-nextjs'
import { cookies } from 'next/headers'
import type { ReactNode } from 'react'
import { AdminShell } from '@/components/admin/admin-shell'

export default async function Layout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const supabase = createServerClient({
    env: {
      apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          cookieStore.set(name, value, options)
        }
      },
    },
  })
  const user = await requireUser(supabase)
  await requireArea('admin')

  return (
    <AdminShell userEmail={user.email ?? ''}>
      {children}
    </AdminShell>
  )
}
```

- [ ] **Step 5: Run admin layout test to verify it passes**

Run: `cd apps/web && npx vitest run test/admin-layout.test.tsx`

Expected: PASS — both tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/admin/admin-shell.tsx apps/web/src/app/admin/\(authed\)/layout.tsx apps/web/test/admin-layout.test.tsx
git commit -m "refactor(admin): remove site switcher from admin layout

Admin site switcher was decorative — no admin page consumed
currentSiteId from context. Extract AdminShell client component
with module-level config, drop user_accessible_sites RPC call.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: CMS — Fix Site Switcher Provider + Layout

**Parallel group: A** (independent of Task 1)

**Files:**
- Modify: `apps/web/src/components/cms/site-switcher-provider.tsx`
- Modify: `apps/web/src/app/cms/(authed)/layout.tsx`
- Modify: `apps/web/test/cms-layout.test.tsx`

- [ ] **Step 1: Update CMS layout test mock**

Update the mock of `site-switcher-provider` to match the new exports. `CmsSiteSwitcherSlot` now accepts a `sites` prop (ignored in test — returns null). Remove the `AdminShellWithSwitcher` reference if present.

```tsx
// apps/web/test/cms-layout.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
  headers: async () => ({ get: () => null }),
}))

vi.mock('../src/components/cms/site-switcher-provider', () => ({
  CmsSiteSwitcherSlot: () => null,
  SiteSwitcherProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@tn-figueiredo/cms-ui/client', () => ({
  CmsShell: ({
    siteName,
    userDisplayName,
    children,
  }: {
    siteName: string
    userDisplayName: string
    children: React.ReactNode
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'cms-shell', 'data-site': siteName, 'data-user': userDisplayName },
      children,
    ),
}))

vi.mock('@tn-figueiredo/auth-nextjs', () => ({
  createServerClient: vi.fn(() => ({
    rpc: vi.fn(async () => ({ data: [], error: null })),
  })),
  requireUser: vi.fn(async () => ({ id: 'u1', email: 'thiago@example.com' })),
  requireArea: vi.fn(async () => undefined),
}))

vi.mock('@/lib/supabase/service', () => {
  const result = { count: 0, data: null, error: null }
  const chainable: Record<string, unknown> = {}
  chainable.eq = vi.fn(() => chainable)
  chainable.is = vi.fn(() => chainable)
  chainable.then = (resolve: (v: unknown) => void) => resolve(result)
  return {
    getSupabaseServiceClient: vi.fn(() => ({
      from: vi.fn(() => ({
        select: vi.fn(() => chainable),
      })),
    })),
  }
})

import Layout from '../src/app/cms/(authed)/layout'

describe('cms/layout', () => {
  it('renders children wrapped in CmsShell', async () => {
    const el = await Layout({ children: <div>hello-cms</div> })
    const { getByText, getByTestId } = render(el)
    expect(getByText('hello-cms')).toBeTruthy()
    expect(getByTestId('cms-shell')).toBeTruthy()
  })

  it('passes user email as display name when no metadata', async () => {
    const el = await Layout({ children: <div>hello-cms</div> })
    const { getByTestId } = render(el)
    expect(getByTestId('cms-shell').getAttribute('data-user')).toBe('thiago@example.com')
  })
})
```

**Key change:** The mock for `site-switcher-provider` now exports `SiteSwitcherProvider` directly (previously it was mocked from `@tn-figueiredo/admin/site-switcher` separately). The CMS layout will now import `SiteSwitcherProvider` from the local provider file.

- [ ] **Step 2: Run CMS layout test to verify current state**

Run: `cd apps/web && npx vitest run test/cms-layout.test.tsx`

Expected: PASS (or FAIL if mock changes diverge — either is fine, we're about to change the source).

- [ ] **Step 3: Rewrite site-switcher-provider.tsx — CMS only**

Replace the entire file. Remove all admin exports (`AdminSiteSwitcherSlot`, `AdminShellWithSwitcher`), admin imports (`SiteSwitcher`, `createAdminLayout`, `AdminLayoutConfig`, `SiteBranding`), and `useMemo`. Add `RpcAccessibleSite` interface. Fix `CmsSiteSwitcherSlot` to accept `sites` prop.

```tsx
// apps/web/src/components/cms/site-switcher-provider.tsx
'use client'

import {
  SiteSwitcherProvider,
  useSiteSwitcher,
  type AccessibleSite,
} from '@tn-figueiredo/admin/site-switcher'
import { CmsSiteSwitcher } from '@tn-figueiredo/cms'
import type { ReactNode } from 'react'

export type { AccessibleSite }
export { SiteSwitcherProvider }

export interface RpcAccessibleSite {
  site_id: string
  site_name: string
  site_slug: string
  primary_domain: string
  org_id: string
  org_name: string
  user_role: string
  is_master_ring: boolean
}

export function CmsSiteSwitcherSlot({
  sites,
}: {
  sites: RpcAccessibleSite[]
}): ReactNode {
  const { currentSiteId, setCurrentSiteId } = useSiteSwitcher()
  return (
    <CmsSiteSwitcher
      sites={sites}
      currentSiteId={currentSiteId}
      onChange={setCurrentSiteId}
    />
  )
}
```

- [ ] **Step 4: Update CMS layout to pass rawSites**

Modify `apps/web/src/app/cms/(authed)/layout.tsx`. Changes:

1. Import `SiteSwitcherProvider`, `AccessibleSite`, `CmsSiteSwitcherSlot`, and `RpcAccessibleSite` from `@/components/cms/site-switcher-provider` (not from `@tn-figueiredo/admin/site-switcher` separately).
2. Type `rawSites` as `RpcAccessibleSite[]` and keep the full RPC shape.
3. Still map to admin `AccessibleSite` for `SiteSwitcherProvider`.
4. Pass `rawSites` to `<CmsSiteSwitcherSlot sites={rawSites} />`.

```tsx
// apps/web/src/app/cms/(authed)/layout.tsx
import {
  createServerClient,
  requireArea,
  requireUser,
} from '@tn-figueiredo/auth-nextjs'
import { cookies } from 'next/headers'
import type { ReactNode } from 'react'
import {
  SiteSwitcherProvider,
  CmsSiteSwitcherSlot,
  type AccessibleSite,
  type RpcAccessibleSite,
} from '@/components/cms/site-switcher-provider'
import { CmsShell } from '@tn-figueiredo/cms-ui/client'
import { CmsAdminProvider } from '@tn-figueiredo/cms-admin/client'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import Link from 'next/link'

export default async function Layout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const supabase = createServerClient({
    env: {
      apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          cookieStore.set(name, value, options)
        }
      },
    },
  })
  const user = await requireUser(supabase)
  await requireArea('cms')

  const { data: sitesData } = await supabase.rpc('user_accessible_sites')
  const rawSites = (sitesData ?? []) as RpcAccessibleSite[]
  const sites = rawSites.map((s) => ({
    id: s.site_id,
    slug: s.site_slug,
    name: s.site_name,
    primary_domain: s.primary_domain,
    logo_url: null,
  })) as AccessibleSite[]
  const currentSiteId = rawSites[0]?.site_id ?? ''
  const currentSite = rawSites.find((s) => s.site_id === currentSiteId)
  const userDisplayName = user.email ?? 'User'
  const userRole = currentSite?.user_role ?? 'reporter'

  const svc = getSupabaseServiceClient()
  const [draftsRes, subsRes, pendingContactsRes] = await Promise.all([
    svc.from('blog_posts').select('id', { count: 'exact', head: true })
      .eq('site_id', currentSiteId).eq('status', 'draft'),
    svc.from('newsletter_subscriptions').select('id', { count: 'exact', head: true })
      .eq('site_id', currentSiteId).eq('status', 'confirmed'),
    svc.from('contact_submissions').select('id', { count: 'exact', head: true })
      .eq('site_id', currentSiteId).is('replied_at', null).is('anonymized_at', null),
  ])
  const badges: Record<string, number> = {}
  if (draftsRes.count) badges['/cms/blog'] = draftsRes.count
  if (subsRes.count) badges['/cms/subscribers'] = subsRes.count
  if (pendingContactsRes.count) badges['/cms/contacts'] = pendingContactsRes.count

  return (
    <CmsAdminProvider linkComponent={Link}>
      <SiteSwitcherProvider sites={sites} initialSiteId={currentSiteId}>
        <CmsShell
          siteName={currentSite?.site_name ?? 'OneCMS'}
          siteInitials={currentSite?.site_name?.slice(0, 2).toUpperCase() ?? 'CM'}
          userDisplayName={userDisplayName}
          userRole={userRole}
          siteSwitcher={<CmsSiteSwitcherSlot sites={rawSites} />}
          badges={badges}
        >
          {children}
        </CmsShell>
      </SiteSwitcherProvider>
    </CmsAdminProvider>
  )
}
```

- [ ] **Step 5: Run CMS layout test to verify it passes**

Run: `cd apps/web && npx vitest run test/cms-layout.test.tsx`

Expected: PASS — both tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/cms/site-switcher-provider.tsx apps/web/src/app/cms/\(authed\)/layout.tsx apps/web/test/cms-layout.test.tsx
git commit -m "fix(cms): resolve React key warnings in CmsSiteSwitcher

CmsSiteSwitcherSlot now accepts rawSites prop with full RPC shape
(site_id, org_name, user_role) instead of reading admin-shaped data
from context via unsafe 'as unknown as' cast. Removes dead admin
exports (AdminSiteSwitcherSlot, AdminShellWithSwitcher).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Cleanup + Full Verification

**Depends on:** Tasks 1 and 2 both complete.

**Files:**
- Modify: `apps/web/next.config.ts` (line 12-15 comment)

- [ ] **Step 1: Update next.config.ts comment**

The comment on lines 12-15 references admin's `SiteSwitcherProvider`/`useSiteSwitcher` subpath. Update to reflect CMS-only usage.

In `apps/web/next.config.ts`, replace lines 12-15:

```typescript
  // Since `@tn-figueiredo/admin@0.6.2`, the client primitives (SiteSwitcher,
  // SiteSwitcherProvider, useSiteSwitcher) live under `./site-switcher` with an
  // explicit `'use client'` banner in the published bundle — the consumer no
  // longer needs to add admin to `transpilePackages`.
```

With:

```typescript
  // `@tn-figueiredo/admin` client primitives (SiteSwitcherProvider,
  // useSiteSwitcher) live under `./site-switcher` with `'use client'` banner
  // — used by CMS layout only, no transpilePackages entry needed.
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`

Expected: All 1601+ tests pass, 0 failures. Output ends with:

```
Test Files  186 passed | 18 skipped (204)
     Tests  1601 passed | 141 skipped (1742)
```

- [ ] **Step 3: Verify no `as unknown as` casts remain in site-switcher code**

Run: `grep -n "as unknown as" apps/web/src/components/cms/site-switcher-provider.tsx`

Expected: No output (no matches).

- [ ] **Step 4: Verify admin layout has no switcher references**

Run: `grep -n "SiteSwitcher\|site-switcher\|AdminSiteSwitcher" apps/web/src/app/admin/\(authed\)/layout.tsx`

Expected: No output (no matches).

- [ ] **Step 5: Commit cleanup**

```bash
git add apps/web/next.config.ts
git commit -m "chore: update next.config comment for CMS-only site switcher

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 6: Start dev server and visually verify**

Run: `cd apps/web && npm run dev`

Manual checks:
1. Navigate to `/admin` — no site switcher dropdown visible in header/sidebar
2. Navigate to `/cms` — site switcher renders in sidebar, grouped by org_name
3. Open browser console on `/cms` — no React key warnings about `optgroup` or `option`
4. Switch sites in CMS dropdown — selection persists on reload (localStorage)
