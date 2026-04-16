'use client'

// Sprint 5a Track D — D1: React context for cookie consent state.
// Owns the source of truth for consent flags, persists to localStorage,
// listens to storage events for multi-tab sync, mirrors analytics
// consent to the `cookie_analytics_consent` key read by Sentry init,
// and generates a UUID v4 anonymous_id on first consent so Track C
// API routes can tie consent rows to a stable pre-auth identifier.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export const CONSENT_STORAGE_KEY = 'lgpd_consent_v1'
export const ANALYTICS_CONSENT_MIRROR_KEY = 'cookie_analytics_consent'
export const ANON_ID_STORAGE_KEY = 'lgpd_anon_id'
export const CONSENT_VERSION = 1

export interface CookieConsent {
  functional: true
  analytics: boolean
  marketing: boolean
  version: number
  anonymousId: string
  updatedAt: string
}

export interface CookieConsentInput {
  functional?: true
  analytics: boolean
  marketing: boolean
}

export interface CookieConsentApi {
  consent: CookieConsent | null
  setConsent: (input: CookieConsentInput) => CookieConsent
  clearConsent: () => void
  isOpen: boolean
  openBanner: () => void
  closeBanner: () => void
}

const CookieConsentContext = createContext<CookieConsentApi | null>(null)

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function generateAnonymousId() {
  // Prefer cryptographic randomUUID when available; fall back to RFC 4122 v4 stub.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback polyfill (never hit in Next 15 / modern browsers — defensive only).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function readConsent(): CookieConsent | null {
  if (!isBrowser()) return null
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CookieConsent>
    if (typeof parsed !== 'object' || parsed === null) return null
    return {
      functional: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      version: Number(parsed.version ?? CONSENT_VERSION),
      anonymousId: String(parsed.anonymousId ?? ''),
      updatedAt: String(parsed.updatedAt ?? ''),
    }
  } catch {
    return null
  }
}

function writeConsent(next: CookieConsent) {
  if (!isBrowser()) return
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next))
  // Mirror analytics flag into the dedicated key the Sentry client config
  // reads — keeps the init path a simple string comparison.
  localStorage.setItem(ANALYTICS_CONSENT_MIRROR_KEY, next.analytics ? 'true' : 'false')
  localStorage.setItem(ANON_ID_STORAGE_KEY, next.anonymousId)
}

export interface CookieBannerProviderProps {
  children: ReactNode
  initialOpen?: boolean
}

export function CookieBannerProvider({ children, initialOpen }: CookieBannerProviderProps) {
  const [consent, setConsentState] = useState<CookieConsent | null>(null)
  const [isOpen, setIsOpen] = useState<boolean>(initialOpen ?? false)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from localStorage once after mount (SSR safety).
  useEffect(() => {
    const stored = readConsent()
    setConsentState(stored)
    setHydrated(true)
    if (initialOpen === undefined && !stored) {
      setIsOpen(true)
    }
  }, [initialOpen])

  // Multi-tab sync — another tab writing to localStorage fires a
  // `storage` event in this tab; re-read to stay consistent.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== CONSENT_STORAGE_KEY) return
      setConsentState(readConsent())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setConsent = useCallback(
    (input: CookieConsentInput) => {
      const existingAnon =
        consent?.anonymousId ||
        (isBrowser() ? localStorage.getItem(ANON_ID_STORAGE_KEY) : null) ||
        ''
      const anonymousId = existingAnon || generateAnonymousId()
      const next: CookieConsent = {
        functional: true,
        analytics: Boolean(input.analytics),
        marketing: Boolean(input.marketing),
        version: CONSENT_VERSION,
        anonymousId,
        updatedAt: new Date().toISOString(),
      }
      writeConsent(next)
      setConsentState(next)
      setIsOpen(false)
      // Fire-and-forget POST to the anonymous consent endpoint so audit
      // trail accumulates. Track C may not be live; ignore rejections.
      if (isBrowser()) {
        try {
          void fetch('/api/consents/anonymous', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              anonymous_id: anonymousId,
              categories: {
                functional: true,
                analytics: next.analytics,
                marketing: next.marketing,
              },
              version: CONSENT_VERSION,
            }),
          }).catch(() => undefined)
        } catch {
          // Swallow — network errors must not break UI.
        }
      }
      return next
    },
    [consent],
  )

  const clearConsent = useCallback(() => {
    if (isBrowser()) {
      localStorage.removeItem(CONSENT_STORAGE_KEY)
      localStorage.removeItem(ANALYTICS_CONSENT_MIRROR_KEY)
    }
    setConsentState(null)
    setIsOpen(true)
  }, [])

  const openBanner = useCallback(() => setIsOpen(true), [])
  const closeBanner = useCallback(() => setIsOpen(false), [])

  const value = useMemo<CookieConsentApi>(
    () => ({ consent, setConsent, clearConsent, isOpen, openBanner, closeBanner }),
    [consent, setConsent, clearConsent, isOpen, openBanner, closeBanner],
  )

  // Avoid exposing pre-hydration defaults that differ from SSR — not strictly
  // necessary here (provider has no SSR UI) but keeps semantics explicit.
  void hydrated

  return (
    <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>
  )
}

export function useCookieConsent(): CookieConsentApi {
  const ctx = useContext(CookieConsentContext)
  if (!ctx) {
    throw new Error('useCookieConsent must be used inside <CookieBannerProvider />')
  }
  return ctx
}
