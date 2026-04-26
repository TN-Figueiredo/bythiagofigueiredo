'use client'

import { useState, useRef, useEffect } from 'react'

export type InquiryResult =
  | { status: 'ok' }
  | { status: 'validation' }
  | { status: 'captcha_failed' }
  | { status: 'rate_limited' }
  | { status: 'error' }

const STRINGS = {
  'pt-BR': {
    nameLabel: 'Seu nome',
    namePlaceholder: 'Nome completo',
    emailLabel: 'Email',
    emailPlaceholder: 'seu@email.com',
    companyLabel: 'Produto / Empresa',
    companyPlaceholder: 'Nome do produto ou empresa',
    websiteLabel: 'Site (opcional)',
    websitePlaceholder: 'https://',
    messageLabel: 'Conte sobre seu projeto',
    messagePlaceholder: 'Descreva seu produto, público-alvo e o que espera do anúncio…',
    budgetLabel: 'Orçamento mensal (opcional)',
    budgetOptions: {
      '': 'Selecione…',
      under_500: 'Até R$ 500',
      '500_2000': 'R$ 500 – R$ 2.000',
      '2000_5000': 'R$ 2.000 – R$ 5.000',
      above_5000: 'Acima de R$ 5.000',
      not_sure: 'Ainda não sei',
    },
    consentLabel:
      'Concordo com o tratamento dos meus dados para fins de contato comercial sobre anúncios (LGPD).',
    submitLabel: 'Enviar interesse',
    loadingLabel: 'Enviando…',
    turnstileLoading: 'Verificação anti-bot carregando. Aguarde.',
    consentRequired: 'Você precisa concordar com o tratamento de dados.',
    submitError: 'Erro ao enviar. Tente novamente.',
    rateLimited: 'Muitas tentativas. Aguarde alguns minutos.',
    captchaFailed: 'Verificação anti-bot falhou. Recarregue a página.',
    validationError: 'Dados inválidos. Verifique os campos.',
    successTitle: 'Interesse enviado!',
    successBody: 'Entrarei em contato em até 2 dias úteis.',
  },
  en: {
    nameLabel: 'Your name',
    namePlaceholder: 'Full name',
    emailLabel: 'Email',
    emailPlaceholder: 'your@email.com',
    companyLabel: 'Product / Company',
    companyPlaceholder: 'Product or company name',
    websiteLabel: 'Website (optional)',
    websitePlaceholder: 'https://',
    messageLabel: 'Tell me about your project',
    messagePlaceholder: 'Describe your product, target audience, and what you expect from the ad…',
    budgetLabel: 'Monthly budget (optional)',
    budgetOptions: {
      '': 'Select…',
      under_500: 'Under $100',
      '500_2000': '$100 – $500',
      '2000_5000': '$500 – $1,000',
      above_5000: 'Above $1,000',
      not_sure: 'Not sure yet',
    },
    consentLabel:
      'I agree to have my data processed for commercial contact about advertising (LGPD).',
    submitLabel: 'Submit interest',
    loadingLabel: 'Sending…',
    turnstileLoading: 'Bot-check loading. Please wait.',
    consentRequired: 'You must agree to data processing.',
    submitError: 'Submit error. Please try again.',
    rateLimited: 'Too many attempts. Please wait a few minutes.',
    captchaFailed: 'Bot-check failed. Refresh the page.',
    validationError: 'Invalid data. Check the fields.',
    successTitle: 'Interest submitted!',
    successBody: 'I\'ll get back to you within 2 business days.',
  },
} as const

type Locale = keyof typeof STRINGS

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
  submitAction: (formData: FormData) => Promise<InquiryResult>
}

export function AdInquiryForm({ locale = 'pt-BR', submitAction }: Props) {
  const s = STRINGS[(locale in STRINGS ? locale : 'pt-BR') as Locale]
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
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
    return () => { script.remove() }
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
    if (data.get('consent_processing') !== 'on') {
      setError(s.consentRequired)
      resetTurnstile()
      return
    }

    data.set('turnstile_token', token)
    data.set('locale', locale)

    setLoading(true)
    try {
      const result = await submitAction(data)
      switch (result.status) {
        case 'ok':
          setSuccess(true)
          return
        case 'rate_limited':
          setError(s.rateLimited)
          break
        case 'captcha_failed':
          setError(s.captchaFailed)
          break
        case 'validation':
          setError(s.validationError)
          break
        default:
          setError(s.submitError)
      }
      resetTurnstile()
    } catch {
      setError(s.submitError)
      resetTurnstile()
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center" role="status" aria-live="polite">
        <p className="text-lg font-semibold text-green-800 mb-1">{s.successTitle}</p>
        <p className="text-sm text-green-700">{s.successBody}</p>
      </div>
    )
  }

  const inputClass = 'w-full border border-border rounded-lg px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-primary'

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="inq-name" className="block text-sm font-medium mb-1">{s.nameLabel}</label>
          <input id="inq-name" type="text" name="name" required minLength={2} maxLength={200} placeholder={s.namePlaceholder} className={inputClass} />
        </div>
        <div>
          <label htmlFor="inq-email" className="block text-sm font-medium mb-1">{s.emailLabel}</label>
          <input id="inq-email" type="email" name="email" required placeholder={s.emailPlaceholder} className={inputClass} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="inq-company" className="block text-sm font-medium mb-1">{s.companyLabel}</label>
          <input id="inq-company" type="text" name="company" maxLength={200} placeholder={s.companyPlaceholder} className={inputClass} />
        </div>
        <div>
          <label htmlFor="inq-website" className="block text-sm font-medium mb-1">{s.websiteLabel}</label>
          <input id="inq-website" type="url" name="website" maxLength={500} placeholder={s.websitePlaceholder} className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="inq-budget" className="block text-sm font-medium mb-1">{s.budgetLabel}</label>
        <select id="inq-budget" name="budget" className={inputClass}>
          {Object.entries(s.budgetOptions).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="inq-message" className="block text-sm font-medium mb-1">{s.messageLabel}</label>
        <textarea id="inq-message" name="message" required minLength={10} maxLength={5000} rows={4} placeholder={s.messagePlaceholder} className={`${inputClass} resize-y`} />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent_processing" required className="mt-0.5 shrink-0" />
        <span>{s.consentLabel}</span>
      </label>

      <div ref={turnstileRef} />

      {error && (
        <p role="alert" className="text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {loading ? s.loadingLabel : s.submitLabel}
      </button>
    </form>
  )
}
