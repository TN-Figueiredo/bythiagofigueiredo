'use client'
/**
 * Track F wrapper around `@tn-figueiredo/admin`'s shell + provider and
 * `@tn-figueiredo/cms`'s `CmsSiteSwitcher`.
 *
 * Why this wrapper exists:
 *   `admin@0.6.0` ships `SiteSwitcherProvider` in the same root bundle as
 *   `createAdminLayout`. The root module evaluates `createContext(null)` at
 *   top level and ships without a `'use client'` directive, so importing the
 *   admin root from a server component evaluates the module in the RSC
 *   runtime — which does not expose `React.createContext` → build fails with
 *   `createContext is not a function`.
 *
 *   By collecting every admin root import into this single file (which starts
 *   with `'use client'`), we force the whole admin root through the client
 *   bundle. Server layouts only see local types + this shim, so they never
 *   evaluate admin's module on the server.
 *
 *   When `@tn-figueiredo/admin` splits its context into a `./site-switcher`
 *   subpath with its own `'use client'` directive (follow-up work), this
 *   shim can be simplified or removed.
 */
import {
  createAdminLayout,
  SiteSwitcher,
  SiteSwitcherProvider,
  useSiteSwitcher,
  type AdminLayoutConfig,
  type AccessibleSite,
  type SiteBranding,
} from '@tn-figueiredo/admin'
import { CmsSiteSwitcher } from '@tn-figueiredo/cms'
import type { ReactNode } from 'react'
import { useMemo } from 'react'

export type { AccessibleSite, SiteBranding }

/**
 * CMS-area site switcher slot. Reads the currently-selected site id from
 * `useSiteSwitcher()` and wires it into `<CmsSiteSwitcher>` — which renders
 * the grouped `<select>` styled for the CMS shell. The underlying component
 * is null when the user has fewer than 2 sites.
 */
export function CmsSiteSwitcherSlot(): ReactNode {
  const { sites, currentSiteId, setCurrentSiteId } = useSiteSwitcher()
  return (
    <CmsSiteSwitcher
      sites={sites as AccessibleSite[]}
      currentSiteId={currentSiteId}
      onChange={setCurrentSiteId}
    />
  )
}

/**
 * Admin-area site switcher slot. Uses the admin package's headless
 * `<SiteSwitcher>` so the admin header keeps its own visual language.
 */
export function AdminSiteSwitcherSlot(): ReactNode {
  const { sites, currentSiteId, setCurrentSiteId } = useSiteSwitcher()
  return (
    <SiteSwitcher
      sites={sites}
      currentSiteId={currentSiteId}
      onChange={setCurrentSiteId}
    />
  )
}

/**
 * Client-side adapter that:
 *   1. builds the admin layout once (memoised on `config`), and
 *   2. wraps it in `<SiteSwitcherProvider>` so descendants (CMS editor,
 *      admin users page, etc.) can read the current selection via
 *      `useSiteSwitcher()`.
 *
 * Consumers (server layouts) should pass:
 *   - `sites`: rows returned by `user_accessible_sites()` RPC
 *   - `userEmail`: signed-in user email for the sidebar footer
 *   - `config`: `createAdminLayout` config including `branding`,
 *     `logoutPath`, and `siteSwitcherSlot`
 */
export function AdminShellWithSwitcher({
  sites,
  userEmail,
  config,
  children,
}: {
  sites: AccessibleSite[]
  userEmail: string
  config: AdminLayoutConfig
  children: ReactNode
}) {
  const AdminLayout = useMemo(() => createAdminLayout(config), [config])
  return (
    <SiteSwitcherProvider sites={sites}>
      <AdminLayout userEmail={userEmail}>{children}</AdminLayout>
    </SiteSwitcherProvider>
  )
}
