'use client'
import { useEffect, useCallback, useRef } from 'react'

const DEDUP_MS = 5_000

export function useLinktreeTracking(siteId: string) {
  const sent = useRef(new Map<string, number>())

  useEffect(() => {
    navigator.sendBeacon(
      '/api/go/linktree/track',
      JSON.stringify({ type: 'pageview', siteId }),
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
        JSON.stringify({ type: 'link_click', key: linkKey, siteId }),
      )
    },
    [siteId],
  )

  return { trackClick }
}
