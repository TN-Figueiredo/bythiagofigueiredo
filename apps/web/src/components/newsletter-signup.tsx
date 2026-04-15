'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { subscribeToNewsletter } from '../app/newsletter/subscribe/actions'

// ─── Submit button (reads pending from parent form) ──────────────────────────

function SubmitButton({ label, loadingLabel }: { label: string; loadingLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}>
      {pending ? loadingLabel : label}
    </button>
  )
}

// ─── Strings ─────────────────────────────────────────────────────────────────

const STRINGS = {
  'pt-BR': {
    emailPlaceholder: 'seu@email.com',
    emailLabel: 'Email',
    consentProcessingLabel:
      'Concordo com o tratamento dos meus dados pessoais para envio da newsletter (obrigatório).',
    consentMarketingLabel:
      'Concordo em receber comunicações de marketing e conteúdos promocionais (obrigatório para inscrição).',
    submitLabel: 'Inscrever',
    submittingLabel: 'Enviando…',
    successMessage:
      'Inscrição recebida! Verifique seu email para confirmar.',
    duplicateMessage:
      'Esse email já está inscrito e confirmado.',
    errorTurnstile: 'Verificação de segurança ainda carregando. Aguarde e tente novamente.',
    errorConsent: 'Ambos os consentimentos são obrigatórios para se inscrever.',
    errorGeneric: 'Ocorreu um erro. Tente novamente.',
  },
  en: {
    emailPlaceholder: 'you@email.com',
    emailLabel: 'Email',
    consentProcessingLabel:
      'I agree to the processing of my personal data to receive the newsletter (required).',
    consentMarketingLabel:
      'I agree to receive marketing communications and promotional content (required for subscription).',
    submitLabel: 'Subscribe',
    submittingLabel: 'Sending…',
    successMessage: 'Subscription received! Check your email to confirm.',
    duplicateMessage: 'That email is already subscribed and confirmed.',
    errorTurnstile: 'Security check still loading. Please wait and try again.',
    errorConsent: 'Both consents are required to subscribe.',
    errorGeneric: 'An error occurred. Please try again.',
  },
} as const

type Locale = keyof typeof STRINGS
function t(locale: string): (typeof STRINGS)[Locale] {
  return STRINGS[(locale in STRINGS ? locale : 'pt-BR') as Locale]
}

// ─── Turnstile global ─────────────────────────────────────────────────────────

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, opts: { sitekey: string; callback: (tok: string) => void }): string
      reset(id?: string): void
    }
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface NewsletterSignupProps {
  locale?: string
  className?: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export function NewsletterSignup({ locale = 'pt-BR', className }: NewsletterSignupProps) {
  const strings = t(locale)
  const [status, setStatus] = useState<'idle' | 'success'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [, startTransition] = useTransition()

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey || !turnstileRef.current) return
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.turnstile && turnstileRef.current) {
        const id = window.turnstile.render(turnstileRef.current, {
          sitekey: siteKey,
          callback: (tok) => setTurnstileToken(tok),
        })
        widgetIdRef.current = id
      }
    }
    document.head.appendChild(script)
    return () => {
      script.remove()
    }
  }, [siteKey])

  function resetTurnstile() {
    if (window.turnstile && widgetIdRef.current) {
      window.turnstile.reset(widgetIdRef.current)
    }
    setTurnstileToken(null)
  }

  function handleAction(formData: FormData) {
    setError(null)

    // Client-side guard: Turnstile required only when key is configured
    if (siteKey && !turnstileToken) {
      setError(strings.errorTurnstile)
      return
    }

    const consentProcessing = formData.get('consent_processing') === 'on'
    const consentMarketing = formData.get('consent_marketing') === 'on'
    if (!consentProcessing || !consentMarketing) {
      setError(strings.errorConsent)
      resetTurnstile()
      return
    }

    if (turnstileToken) {
      formData.set('turnstile_token', turnstileToken)
    }

    startTransition(async () => {
      const result = await subscribeToNewsletter(formData)
      if (result.status === 'ok') {
        // Always show success — server no longer reveals duplicate state.
        setStatus('success')
      } else {
        const code = result.code
        if (code === 'turnstile_failed' || code === 'captcha_required') {
          setError(strings.errorTurnstile)
        } else if (code === 'consent_required') {
          setError(strings.errorConsent)
        } else {
          setError(strings.errorGeneric)
        }
        resetTurnstile()
      }
    })
  }

  if (status === 'success') {
    return (
      <div role="status" aria-live="polite" className={className}>
        <p>{strings.successMessage}</p>
      </div>
    )
  }


  return (
    <form action={handleAction} className={className} noValidate>
      <label>
        <span className="sr-only">{strings.emailLabel}</span>
        <input
          type="email"
          name="email"
          required
          placeholder={strings.emailPlaceholder}
          aria-label={strings.emailLabel}
        />
      </label>

      <label>
        <input type="checkbox" name="consent_processing" required />
        <span>{strings.consentProcessingLabel}</span>
      </label>

      <label>
        <input type="checkbox" name="consent_marketing" required />
        <span>{strings.consentMarketingLabel}</span>
      </label>

      {siteKey ? <div ref={turnstileRef} /> : null}

      {error ? (
        <p role="alert" aria-live="assertive">
          {error}
        </p>
      ) : null}

      <SubmitButton label={strings.submitLabel} loadingLabel={strings.submittingLabel} />
    </form>
  )
}
