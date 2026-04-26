export interface AdConsent {
  marketing: boolean
  analytics: boolean
  loaded: boolean
}

export interface AdConsentAdapter {
  getConsent(): AdConsent
  subscribe(callback: (consent: AdConsent) => void): () => void
}

function parseConsent(raw: string | null): AdConsent {
  if (!raw) return { marketing: false, analytics: false, loaded: false }
  try {
    const consent = JSON.parse(raw) as Record<string, unknown>
    return {
      marketing: consent?.cookie_marketing === true,
      analytics: consent?.cookie_analytics === true,
      loaded: true,
    }
  } catch {
    return { marketing: false, analytics: false, loaded: false }
  }
}

export function createConsentAdapter(): AdConsentAdapter {
  const adapter: AdConsentAdapter = {
    getConsent(): AdConsent {
      const raw =
        typeof window !== 'undefined'
          ? localStorage.getItem('lgpd_consent_v1')
          : null
      return parseConsent(raw)
    },

    subscribe(callback: (consent: AdConsent) => void): () => void {
      const handler = (e: StorageEvent) => {
        if (e.key === 'lgpd_consent_v1') {
          callback(adapter.getConsent())
        }
      }
      window.addEventListener('storage', handler)
      return () => window.removeEventListener('storage', handler)
    },
  }
  return adapter
}
