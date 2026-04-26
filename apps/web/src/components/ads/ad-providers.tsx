'use client'

import type { ReactNode } from 'react'
import { createContext, useEffect, useMemo, useState } from 'react'
import Script from 'next/script'
import {
  createConsentAdapter,
  type AdConsent,
  type AdConsentAdapter,
} from '@/lib/ads/consent-adapter'

/**
 * Local consent context — mirrors the `AdConsentContext` shape from
 * `@tn-figueiredo/ad-components` so consumers can `useContext(AdConsentContext)`
 * without the package installed. Once ad-components is wired in, this context
 * will be replaced by the package re-export.
 */
export const AdConsentContext = createContext<AdConsentAdapter | null>(null)

interface AdProvidersProps {
  children: ReactNode
  googleEnabled: boolean
  publisherId: string | null
}

/**
 * Wraps the public layout with ad consent context and conditionally loads the
 * Google AdSense script when:
 * - `googleEnabled` is true (feature flag `AD_GOOGLE_ENABLED`)
 * - `publisherId` is non-null (configured in site settings)
 * - marketing consent has been granted via the LGPD cookie banner
 */
export function AdProviders({
  children,
  googleEnabled,
  publisherId,
}: AdProvidersProps) {
  const [consent, setConsent] = useState<AdConsent>({
    marketing: false,
    analytics: false,
    loaded: false,
  })

  const adapter = useMemo(() => createConsentAdapter(), [])

  useEffect(() => {
    // Read initial consent state from localStorage via the adapter
    setConsent(adapter.getConsent())

    // Subscribe to cross-tab storage changes
    const unsubscribe = adapter.subscribe((next) => {
      setConsent(next)
    })

    // Also listen for same-tab consent changes dispatched by the cookie banner
    const handleSameTab = () => {
      setConsent(adapter.getConsent())
    }
    window.addEventListener('lgpd:consent-changed', handleSameTab)

    // Mark as loaded even if no consent was stored
    setConsent((prev) => (prev.loaded ? prev : { ...prev, loaded: true }))

    return () => {
      unsubscribe()
      window.removeEventListener('lgpd:consent-changed', handleSameTab)
    }
  }, [adapter])

  const showAdSense =
    googleEnabled &&
    publisherId != null &&
    consent.marketing &&
    consent.loaded

  return (
    <AdConsentContext.Provider value={adapter}>
      {showAdSense && (
        <Script
          id="adsense-script"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`}
          strategy="lazyOnload"
          crossOrigin="anonymous"
        />
      )}
      {children}
    </AdConsentContext.Provider>
  )
}
