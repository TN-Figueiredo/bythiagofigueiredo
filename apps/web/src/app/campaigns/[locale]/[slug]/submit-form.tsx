'use client'

import { useState, useRef, useEffect } from 'react'
import { CONSENT_VERSION } from '../../../../../lib/campaigns/consent'

const FORM_STRINGS = {
  'pt-BR': {
    turnstileLoading: 'Turnstile ainda carregando.',
    consentRequired: 'Consentimento obrigatório.',
    submitError: 'Erro ao enviar.',
    consentLabel: 'Concordo em receber comunicações (LGPD).',
  },
  en: {
    turnstileLoading: 'Turnstile still loading.',
    consentRequired: 'Consent is required.',
    submitError: 'Submit error.',
    consentLabel: 'I agree to receive communications (LGPD).',
  },
} as const

type FormLocale = keyof typeof FORM_STRINGS
function stringsFor(locale: string) {
  return FORM_STRINGS[(locale in FORM_STRINGS ? locale : 'pt-BR') as FormLocale]
}

interface FormField {
  name: string
  label: string
  type: 'name' | 'email' | 'phone' | 'textarea' | 'checkbox'
  required?: boolean
  placeholder?: string
}

interface Props {
  slug: string
  locale: string
  formFields: unknown[]
  buttonLabel: string
  loadingLabel: string
  contextTag: string
}

interface SuccessState {
  duplicate: boolean
  pdfUrl: string | null
  successCopy: {
    headline: string
    subheadline: string
    checkMailText: string
    downloadButtonLabel: string
  }
}

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void }): string
      reset(id?: string): void
    }
  }
}

export function SubmitForm(props: Props) {
  const { slug, locale, formFields, buttonLabel, loadingLabel, contextTag } = props
  const t = stringsFor(locale)
  const fields = formFields as FormField[]
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<SuccessState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (!siteKey || !turnstileRef.current) return
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.turnstile && turnstileRef.current) {
        const id = window.turnstile.render(turnstileRef.current, {
          sitekey: siteKey,
          callback: (tok) => setToken(tok),
        })
        widgetIdRef.current = id
      }
    }
    document.head.appendChild(script)
    return () => {
      script.remove()
    }
  }, [])

  function resetTurnstile() {
    if (window.turnstile && widgetIdRef.current) {
      window.turnstile.reset(widgetIdRef.current)
    }
    setToken(null)
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!token) {
      setError(t.turnstileLoading)
      return
    }
    const data = new FormData(e.currentTarget)
    const consent = data.get('consent_marketing') === 'on'
    if (!consent) {
      setError(t.consentRequired)
      resetTurnstile()
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/campaigns/${slug}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: String(data.get('email') ?? ''),
          name: data.get('name') ? String(data.get('name')) : undefined,
          locale,
          consent_marketing: true,
          consent_text_version: CONSENT_VERSION,
          turnstile_token: token,
        }),
      })
      if (!res.ok) {
        setError(t.submitError)
        resetTurnstile()
        return
      }
      const body = (await res.json()) as SuccessState & { success: boolean }
      setSuccess(body)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div role="status">
        <span>{contextTag}</span>
        <h2>{success.successCopy.headline}</h2>
        <p>{success.successCopy.subheadline}</p>
        <p>{success.successCopy.checkMailText}</p>
        {success.pdfUrl ? (
          <a href={success.pdfUrl} download>
            {success.successCopy.downloadButtonLabel}
          </a>
        ) : null}
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit}>
      {fields.map((f) => (
        <label key={f.name}>
          {f.label}
          {f.type === 'textarea' ? (
            <textarea name={f.name} required={f.required} placeholder={f.placeholder} />
          ) : f.type === 'checkbox' ? (
            <input type="checkbox" name={f.name} required={f.required} />
          ) : (
            <input
              type={f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : 'text'}
              name={f.name}
              required={f.required}
              placeholder={f.placeholder}
            />
          )}
        </label>
      ))}
      <label>
        <input type="checkbox" name="consent_marketing" required />
        {t.consentLabel}
      </label>
      <div ref={turnstileRef} />
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={loading}>
        {loading ? loadingLabel : buttonLabel}
      </button>
    </form>
  )
}
