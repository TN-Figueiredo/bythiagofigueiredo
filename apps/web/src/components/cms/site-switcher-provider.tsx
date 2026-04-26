'use client'
/**
 * Client-side composition of admin + cms site-switcher primitives.
 *
 * As of `@tn-figueiredo/admin@0.6.2`, the client-only primitives live in the
 * `./site-switcher` subpath with an explicit `'use client'` banner, so server
 * components can import `createAdminLayout` from the root without tripping the
 * RSC bundler. The shim in this file no longer forces the whole admin root
 * through the client bundle — it just groups the slot components that want
 * React context.
 */
import {
  createAdminLayout,
  type AdminLayoutConfig,
  type SiteBranding,
} from '@tn-figueiredo/admin'
import {
  SiteSwitcher,
  SiteSwitcherProvider,
  useSiteSwitcher,
  type AccessibleSite,
} from '@tn-figueiredo/admin/site-switcher'
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
      sites={sites as unknown as Parameters<typeof CmsSiteSwitcher>[0]['sites']}
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
