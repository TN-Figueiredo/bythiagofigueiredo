'use client'

import { useEffect, useRef, useCallback } from 'react'
import { classifyLink } from '@/lib/analytics/link-classifier'

const TRACK_URL = '/api/track/content'
const DEDUP_WINDOW_MS = 5_000

interface LinkTrackingConfig {
  siteId: string
  resourceId: string
  siteOrigin: string
  sessionId?: string
}

/**
 * Hook that tracks link clicks inside a container with class `.prose` or via ref.
 *
 * On `<a>` click:
 * - Classifies the link (internal/external/shortlink)
 * - Fires a beacon to /api/track/content with event_type='link_click'
 * - Deduplicates: same href in same session within 5 seconds is skipped
 */
export function useLinkTracking(
  containerRef: React.RefObject<HTMLElement | null>,
  config: LinkTrackingConfig,
): void {
  const recentClicks = useRef<Map<string, number>>(new Map())

  const handleClick = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const anchor = target.closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return

      // Dedup check
      const now = Date.now()
      const lastClick = recentClicks.current.get(href)
      if (lastClick && now - lastClick < DEDUP_WINDOW_MS) return
      recentClicks.current.set(href, now)

      // Classify
      const linkType = classifyLink(href, config.siteOrigin)

      // Send beacon
      const payload = JSON.stringify({
        events: [{
          sessionId: config.sessionId ?? crypto.randomUUID(),
          siteId: config.siteId,
          resourceType: 'blog',
          resourceId: config.resourceId,
          eventType: 'link_click',
          anonymousId: localStorage.getItem('lgpd_anon_id') ?? crypto.randomUUID(),
          destUrl: href,
          linkType,
          hasConsent: false,
        }],
      })

      if (navigator.sendBeacon) {
        navigator.sendBeacon(TRACK_URL, new Blob([payload], { type: 'application/json' }))
      } else {
        fetch(TRACK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {})
      }
    },
    [config.siteId, config.resourceId, config.siteOrigin, config.sessionId],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('click', handleClick)
    return () => container.removeEventListener('click', handleClick)
  }, [containerRef, handleClick])

  // Cleanup old dedup entries periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      for (const [href, time] of recentClicks.current) {
        if (now - time > DEDUP_WINDOW_MS * 2) {
          recentClicks.current.delete(href)
        }
      }
    }, 10_000)
    return () => clearInterval(interval)
  }, [])
}
