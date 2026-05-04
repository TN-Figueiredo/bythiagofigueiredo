'use client'

import { useEffect, useRef } from 'react'
import { useScrollState } from '@/components/blog/scroll-context'
import { useCookieConsent } from '@/components/lgpd/cookie-banner-context'
import { ReadProgressStore } from './read-progress-store'
import { classifyReferrer } from './referrer'
import type { TrackingConfig, TrackingEvent } from './events'
import {
  VIEW_DELAY_MS,
  READ_COMPLETE_THRESHOLD,
  DEPTH_THRESHOLDS,
  DEDUP_WINDOW_MS,
  CLEANUP_MAX_AGE_DAYS,
  READ_INDICATORS_ENABLED,
} from './config'

const TRACK_URL = '/api/track/content'

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function sendEvents(events: TrackingEvent[]): void {
  try {
    fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
      keepalive: true,
    }).catch((err) => {
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.warn('[tracking] sendEvents failed:', err)
      }
    })
  } catch {
    // synchronous failure — fetch not available
  }
}

function beaconEvents(events: TrackingEvent[]): void {
  try {
    const payload = JSON.stringify({ events })
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
  } catch {
    // synchronous failure — beacon/fetch not available
  }
}

export function useContentTracking(config: TrackingConfig): void {
  const { progress } = useScrollState()
  const { consent } = useCookieConsent()
  const sessionIdRef = useRef(generateSessionId())
  const startTimeRef = useRef(Date.now())
  const viewSentRef = useRef(false)
  const completeSentRef = useRef(false)
  const maxDepthRef = useRef(0)
  const storeRef = useRef<ReadProgressStore | null>(null)

  // Init store + cleanup
  useEffect(() => {
    if (config.isPreview) return
    if (typeof navigator !== 'undefined' && (navigator as { webdriver?: boolean }).webdriver) return
    if (!READ_INDICATORS_ENABLED) return

    storeRef.current = new ReadProgressStore()
    storeRef.current.cleanup(CLEANUP_MAX_AGE_DAYS)
  }, [config.isPreview])

  // View event after VIEW_DELAY_MS
  useEffect(() => {
    if (config.isPreview) return
    if (typeof navigator !== 'undefined' && (navigator as { webdriver?: boolean }).webdriver) return

    const dedupKey = `btf_view_sent:${config.resourceId}`
    const lastSent = sessionStorage.getItem(dedupKey)
    if (lastSent && Date.now() - Number(lastSent) < DEDUP_WINDOW_MS) {
      viewSentRef.current = true
      return
    }

    const timer = setTimeout(() => {
      if (viewSentRef.current) return
      viewSentRef.current = true
      sessionStorage.setItem(dedupKey, String(Date.now()))

      const anonymousId =
        consent?.anonymousId ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('lgpd_anon_id') : null) ||
        generateSessionId()

      sendEvents([{
        sessionId: sessionIdRef.current,
        siteId: config.siteId,
        resourceType: config.resourceType,
        resourceId: config.resourceId,
        eventType: 'view',
        anonymousId,
        locale: config.locale,
        referrerSrc: classifyReferrer(document.referrer, window.location.href),
        hasConsent: consent?.analytics ?? false,
      }])
    }, VIEW_DELAY_MS)

    return () => clearTimeout(timer)
  }, [config.isPreview, config.siteId, config.resourceType, config.resourceId, config.locale, consent])

  // Track scroll progress + read_complete
  useEffect(() => {
    if (config.isPreview) return
    if (typeof navigator !== 'undefined' && (navigator as { webdriver?: boolean }).webdriver) return

    const depthPercent = Math.round(progress * 100)
    if (depthPercent > maxDepthRef.current) {
      maxDepthRef.current = depthPercent
    }

    const store = storeRef.current
    if (store) {
      for (const t of DEPTH_THRESHOLDS) {
        if (depthPercent >= t) {
          store.setProgress(config.resourceId, t)
        }
      }
    }

    if (depthPercent >= READ_COMPLETE_THRESHOLD && !completeSentRef.current) {
      completeSentRef.current = true
      if (store) store.setProgress(config.resourceId, 100)

      const anonymousId =
        consent?.anonymousId ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('lgpd_anon_id') : null) ||
        generateSessionId()

      sendEvents([{
        sessionId: sessionIdRef.current,
        siteId: config.siteId,
        resourceType: config.resourceType,
        resourceId: config.resourceId,
        eventType: 'read_complete',
        anonymousId,
        readDepth: depthPercent,
        locale: config.locale,
        hasConsent: consent?.analytics ?? false,
      }])
    }
  }, [progress, config, consent])

  // Page close — send read_progress via beacon
  useEffect(() => {
    if (config.isPreview) return
    if (typeof navigator !== 'undefined' && (navigator as { webdriver?: boolean }).webdriver) return

    const handleClose = () => {
      const anonymousId =
        consent?.anonymousId ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('lgpd_anon_id') : null) ||
        generateSessionId()

      const timeOnPage = Math.min(
        Math.round((Date.now() - startTimeRef.current) / 1000),
        3600,
      )

      beaconEvents([{
        sessionId: sessionIdRef.current,
        siteId: config.siteId,
        resourceType: config.resourceType,
        resourceId: config.resourceId,
        eventType: 'read_progress',
        anonymousId,
        readDepth: maxDepthRef.current,
        timeOnPage,
        locale: config.locale,
        referrerSrc: classifyReferrer(document.referrer, window.location.href),
        hasConsent: consent?.analytics ?? false,
      }])
    }

    const onVisChange = () => {
      if (document.visibilityState === 'hidden') handleClose()
    }

    document.addEventListener('visibilitychange', onVisChange)
    window.addEventListener('pagehide', handleClose)

    return () => {
      document.removeEventListener('visibilitychange', onVisChange)
      window.removeEventListener('pagehide', handleClose)
    }
  }, [config, consent])
}
