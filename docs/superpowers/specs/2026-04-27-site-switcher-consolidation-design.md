# Site Switcher Consolidation — Admin Removal + CMS Key Fix

**Date:** 2026-04-27
**Scope:** Approach A — app-layer fix only, no package publishes
**Baseline:** 1601 tests passing (186 files)

---

## Problem Statement

Three issues in the current site-switcher implementation:

1. **React key warnings (CRITICAL):** `CmsSiteSwitcherSlot` passes admin-shaped data (`{id, name, slug}`) to `CmsSiteSwitcher` which expects CMS-shaped data (`{site_id, site_name, org_name}`). An unsafe `as unknown as` cast masks the type mismatch. At runtime, `site_id` and `org_name` are `undefined`, producing React warnings for missing keys on `<optgroup>` and `<option>` elements.

2. **Dead code in admin:** The admin layout fetches `user_accessible_sites()`, wraps children in `SiteSwitcherProvider`, and renders `AdminSiteSwitcherSlot` — but no admin page reads `currentSiteId` from the context. The switcher is purely decorative with zero functional effect.

3. **Architectural confusion:** `site-switcher-provider.tsx` lives in `components/cms/` but exports `AdminShellWithSwitcher` and `AdminSiteSwitcherSlot`. Admin components in a CMS directory.

## RPC Contract (source of truth)

`user_accessible_sites()` returns:

| Column | Type |
|--------|------|
| `site_id` | uuid |
| `site_name` | text |
| `site_slug` | text |
| `primary_domain` | text |
| `org_id` | uuid |
| `org_name` | text |
| `user_role` | text |
| `is_master_ring` | boolean |

## Installed Package Versions

- `@tn-figueiredo/admin@0.7.1` — `AccessibleSite = {id, slug, name, primary_domain, logo_url}`
- `@tn-figueiredo/cms@0.2.0` — `CmsSiteSwitcher` expects `{site_id, site_name, org_name, user_role, ...}`
- `@tn-figueiredo/cms-ui@0.1.3` — `CmsShell` accepts `siteSwitcher?: ReactNode`

The admin package's `AccessibleSite` type uses abbreviated field names (`id`, `name`) that don't match the RPC output. The CMS package's type matches the RPC exactly.

## Design

### Principle

Admin = org-level operations (no site switcher). CMS = site-scoped content (site switcher with correct data).

### Change 1: Admin layout — remove switcher entirely

**File:** `apps/web/src/app/admin/(authed)/layout.tsx`

Before:
- Imports `AdminShellWithSwitcher`, `AdminSiteSwitcherSlot`, `AccessibleSite` from `site-switcher-provider.tsx`
- Calls `user_accessible_sites()` RPC, maps result to admin shape
- Wraps children in `<AdminShellWithSwitcher>` with `<AdminSiteSwitcherSlot />`

After:
- Imports `AdminShell` from `@/components/admin/admin-shell`
- No RPC call for sites
- No `ADMIN_CONFIG` (moved to `AdminShell` module)
- No `SiteSwitcherProvider`, no switcher slot

The admin layout drops from ~75 lines to ~25 lines (auth + render).

### Change 2: New `AdminShell` client component

**File:** `apps/web/src/components/admin/admin-shell.tsx` (new)

Minimal client-side wrapper for `createAdminLayout()`. The factory returns a React component that uses client-side hooks (sidebar toggle, etc.) so it can't be called directly from a server component.

```typescript
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

export function AdminShell({ userEmail, children }: {
  userEmail: string
  children: ReactNode
}) {
  return <AdminLayout userEmail={userEmail}>{children}</AdminLayout>
}
```

Config + `createAdminLayout` call are module-level (not per-render), so the layout component is created once at module load. This fixes the useMemo-with-unstable-ref issue from the old `AdminShellWithSwitcher` and moves config ownership to where it belongs — the admin shell component, not the server layout.

### Change 3: Simplify `site-switcher-provider.tsx` — CMS only

**File:** `apps/web/src/components/cms/site-switcher-provider.tsx`

Remove:
- `AdminSiteSwitcherSlot` component
- `AdminShellWithSwitcher` component
- Imports: `SiteSwitcher`, `createAdminLayout`, `AdminLayoutConfig`, `SiteBranding`
- `useMemo` import
- Stale JSDoc comments referencing admin

Keep and fix:
- `CmsSiteSwitcherSlot` — now accepts a `sites` prop with the full RPC shape, passes directly to `CmsSiteSwitcher`. No `as unknown as` cast. Reads only `currentSiteId` + `setCurrentSiteId` from `useSiteSwitcher()`.

Re-export:
- `SiteSwitcherProvider` and `AccessibleSite` from `@tn-figueiredo/admin/site-switcher` (still needed by CMS layout)

```typescript
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

### Change 4: CMS layout — pass raw RPC data to slot

**File:** `apps/web/src/app/cms/(authed)/layout.tsx`

Before:
- Maps RPC output to admin shape (loses `org_name`, `user_role`, `is_master_ring`)
- Passes admin-shaped sites to `SiteSwitcherProvider`
- Renders `<CmsSiteSwitcherSlot />` with no props (reads from context, gets wrong shape)

After:
- Keeps `rawSites` array with full RPC shape (typed as `RpcAccessibleSite[]`)
- Still maps to admin-shaped `AccessibleSite` for `SiteSwitcherProvider` (required by the installed package's type)
- Passes `rawSites` as prop to `CmsSiteSwitcherSlot`: `<CmsSiteSwitcherSlot sites={rawSites} />`

The `SiteSwitcherProvider` still stores admin-shaped sites for `currentSiteId` state management (URL param, localStorage persistence). The `CmsSiteSwitcherSlot` uses the full RPC data for rendering. The `currentSiteId` value is the same UUID in both shapes (`id` = `site_id` = same value from RPC).

### Change 5: Tests

**`apps/web/test/admin-layout.test.tsx`:**
- Remove mock of `site-switcher-provider` (no longer imported by admin layout)
- Add mock of new `components/admin/admin-shell` (`AdminShell`)
- Keep auth mocks, remove sites RPC mock (no longer called)

**`apps/web/test/cms-layout.test.tsx`:**
- Update mock of `site-switcher-provider` to match new exports (only `CmsSiteSwitcherSlot` + `SiteSwitcherProvider`)
- `CmsSiteSwitcherSlot` mock now accepts `sites` prop (ignored in test, returns null)

### Change 6: Cleanup comment in next.config.ts

Line 13 references admin's `SiteSwitcherProvider`/`useSiteSwitcher` subpath. Update to reflect CMS-only usage.

## Files Changed

| File | Action | Lines ~changed |
|------|--------|---------------|
| `apps/web/src/app/admin/(authed)/layout.tsx` | Simplify — remove switcher + RPC | -30 |
| `apps/web/src/components/admin/admin-shell.tsx` | **New** — minimal createAdminLayout wrapper | +20 |
| `apps/web/src/components/cms/site-switcher-provider.tsx` | Simplify — CMS only + fix types | -50, +25 |
| `apps/web/src/app/cms/(authed)/layout.tsx` | Pass rawSites to slot | ~10 |
| `apps/web/test/admin-layout.test.tsx` | Update mocks | ~15 |
| `apps/web/test/cms-layout.test.tsx` | Update mocks | ~5 |
| `apps/web/next.config.ts` | Update comment | 1 |

**Net:** ~30 fewer lines of code. Zero new dependencies. Zero package changes.

## What This Does NOT Change

- `@tn-figueiredo/admin` package — no publish needed
- `@tn-figueiredo/cms` package — CmsSiteSwitcher API unchanged
- `@tn-figueiredo/cms-ui` package — CmsShell's `siteSwitcher?: ReactNode` slot unchanged
- Database schema / RPCs — no migrations
- Admin page functionality — pages never used the switcher context
- CMS page functionality — same data, now with correct types

## Future Considerations

When the "one admin to rule them all" vision materializes (admin needs site-scoped features like ads per site), the `SiteSwitcherProvider` can be re-added to admin with proper typing. The admin package already exports it — just wire it back.

When the admin package aligns its `AccessibleSite` type with the RPC contract (source already updated in tnf-ecosystem), the CMS layout can drop the dual mapping (admin shape + raw shape) and pass one array everywhere.

## Success Criteria

1. No React key warnings in CMS site switcher
2. Admin area renders without site switcher dropdown
3. CMS site switcher groups sites by `org_name` correctly
4. CMS site switcher shows `user_role` per site
5. All 1601+ tests pass
6. No `as unknown as` casts in site-switcher code
