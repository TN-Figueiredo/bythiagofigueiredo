'use client'

import { useState, useRef, useEffect } from 'react'

export const CONTACT_CONSENT_VERSION = 'contact-v1-2026-04'

const FORM_STRINGS = {
  'pt-BR': {
    namePlaceholder: 'Seu nome',
    emailPlaceholder: 'seu@email.com',
    messagePlaceholder: 'Escreva sua mensagem…',
    nameLabel: 'Nome',
    emailLabel: 'Email',
    messageLabel: 'Mensagem',
    consentLabel:
      'Concordo com o tratamento dos meus dados pessoais para fins de resposta ao meu contato (LGPD).',
    marketingLabel:
      'Também quero receber novidades e conteúdos do blog por email.',
    submitLabel: 'Enviar mensagem',
    loadingLabel: 'Enviando…',
    turnstileLoading: 'Verificação anti-bot ainda carregando. Aguarde.',
    consentRequired: 'Você precisa concordar com o tratamento de dados para enviar.',
    submitError: 'Erro ao enviar. Tente novamente.',
  },
  en: {
    namePlaceholder: 'Your name',
    emailPlaceholder: 'your@email.com',
    messagePlaceholder: 'Write your message…',
    nameLabel: 'Name',
    emailLabel: 'Email',
    messageLabel: 'Message',
    consentLabel:
      'I agree to have my personal data processed to respond to my inquiry (LGPD).',
    marketingLabel: 'I also want to receive updates and blog content by email.',
    submitLabel: 'Send message',
    loadingLabel: 'Sending…',
    turnstileLoading: 'Bot-check still loading. Please wait.',
    consentRequired: 'You must agree to data processing to submit.',
    submitError: 'Submit error. Please try again.',
  },
} as const

type FormLocale = keyof typeof FORM_STRINGS
function t(locale: string) {
  return FORM_STRINGS[(locale in FORM_STRINGS ? locale : 'pt-BR') as FormLocale]
}

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void }): string
      reset(id?: string): void
    }
  }
}

interface Props {
  locale?: string
  submitAction: (formData: FormData) => Promise<void>
}

export function ContactForm({ locale = 'pt-BR', submitAction }: Props) {
  const s = t(locale)
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (!sitekey || !turnstileRef.current) return
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.turnstile && turnstileRef.current) {
        const id = window.turnstile.render(turnstileRef.current, {
          sitekey,
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
      setError(s.turnstileLoading)
      return
    }

    const data = new FormData(e.currentTarget)
    const consentProcessing = data.get('consent_processing') === 'on'
    if (!consentProcessing) {
      setError(s.consentRequired)
      resetTurnstile()
      return
    }

    data.set('turnstile_token', token)
    data.set('consent_processing_text_version', CONTACT_CONSENT_VERSION)
    if (data.get('consent_marketing') !== 'on') {
      data.set('consent_marketing', 'false')
    } else {
      data.set('consent_marketing', 'true')
      data.set('consent_marketing_text_version', CONTACT_CONSENT_VERSION)
    }

    setLoading(true)
    try {
      await submitAction(data)
    } catch {
      setError(s.submitError)
      resetTurnstile()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="contact-name" className="block text-sm font-medium mb-1">
          {s.nameLabel}
        </label>
        <input
          id="contact-name"
          type="text"
          name="name"
          required
          minLength={2}
          maxLength={200}
          placeholder={s.namePlaceholder}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="contact-email" className="block text-sm font-medium mb-1">
          {s.emailLabel}
        </label>
        <input
          id="contact-email"
          type="email"
          name="email"
          required
          placeholder={s.emailPlaceholder}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium mb-1">
          {s.messageLabel}
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          placeholder={s.messagePlaceholder}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="consent_processing"
          required
          className="mt-0.5 shrink-0"
        />
        <span>{s.consentLabel}</span>
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent_marketing" className="mt-0.5 shrink-0" />
        <span>{s.marketingLabel}</span>
      </label>

      <div ref={turnstileRef} />

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
      >
        {loading ? s.loadingLabel : s.submitLabel}
      </button>
    </form>
  )
}
