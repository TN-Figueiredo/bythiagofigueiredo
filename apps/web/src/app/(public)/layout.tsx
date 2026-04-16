import type { ReactNode } from 'react'
import { CookieBanner } from '@/components/lgpd/cookie-banner'
import { CookieBannerTrigger } from '@/components/lgpd/cookie-banner-trigger'

/**
 * Public (unauthenticated) layout — applies to home, blog, campaigns, privacy,
 * terms, contact, etc. Intentionally NOT applied to /admin, /cms, /account.
 *
 * Sprint 5a Track E wires the LGPD cookie banner + re-open trigger gated by
 * `NEXT_PUBLIC_LGPD_BANNER_ENABLED` so they can be rolled out / rolled back
 * without a redeploy. The `@/components/lgpd/cookie-banner*` modules are
 * placeholder stubs in this PR (they render `null`); Track D's PR overwrites
 * them with the real LGPD-compliant UI (ARIA dialog + 3 toggles + multi-tab
 * sync). The import path is the final contract.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  const lgpdBannerEnabled = process.env.NEXT_PUBLIC_LGPD_BANNER_ENABLED === 'true'
  return (
    <>
      {children}
      {lgpdBannerEnabled && (
        <>
          <CookieBanner />
          <CookieBannerTrigger />
        </>
      )}
    </>
  )
}
