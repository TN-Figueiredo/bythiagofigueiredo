import type { ReactNode } from 'react'
import { CookieBanner } from '@/components/lgpd/cookie-banner'
import { CookieBannerTrigger } from '@/components/lgpd/cookie-banner-trigger'
import { CookieBannerProvider } from '@/components/lgpd/cookie-banner-context'

/**
 * Public (unauthenticated) layout — applies to home, blog, campaigns, privacy,
 * terms, contact, etc. Intentionally NOT applied to /admin, /cms, /account.
 *
 * Sprint 5a Track E wires the LGPD cookie banner + re-open trigger gated by
 * `NEXT_PUBLIC_LGPD_BANNER_ENABLED` so they can be rolled out / rolled back
 * without a redeploy. The provider itself is always mounted (so pages like
 * `/account/settings/privacy` that invoke `useCookieConsent()` work even when
 * the banner UI is disabled); only the banner + trigger are flag-gated.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  const lgpdBannerEnabled = process.env.NEXT_PUBLIC_LGPD_BANNER_ENABLED === 'true'
  return (
    <CookieBannerProvider>
      {children}
      {lgpdBannerEnabled && (
        <>
          <CookieBanner />
          <CookieBannerTrigger />
        </>
      )}
    </CookieBannerProvider>
  )
}
