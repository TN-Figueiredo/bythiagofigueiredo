'use client'
import { useEffect, useCallback, useRef } from 'react'
import { hasAnalyticsConsent } from '@/components/lgpd/cookie-banner-context'

const DEDUP_MS = 5_000

export function useLinktreeTracking(siteId: string) {
  const sent = useRef(new Map<string, number>())

  useEffect(() => {
    // LGPD Art. 7: aggregate counts are always recorded, but raw PII
    // (ip / user-agent / referrer) is only stored server-side with explicit
    // analytics consent. Re-checked per call so revocation takes effect at once.
    navigator.sendBeacon(
      '/api/go/linktree/track',
      JSON.stringify({ type: 'pageview', siteId, hasConsent: hasAnalyticsConsent() }),
    )
  }, [siteId])

  const trackClick = useCallback(
    (linkKey: string) => {
      const now = Date.now()
      const lastSent = sent.current.get(linkKey)
      if (lastSent && now - lastSent < DEDUP_MS) return
      sent.current.set(linkKey, now)
      navigator.sendBeacon(
        '/api/go/linktree/track',
        JSON.stringify({ type: 'link_click', key: linkKey, siteId, hasConsent: hasAnalyticsConsent() }),
      )
    },
    [siteId],
  )

  return { trackClick }
}
