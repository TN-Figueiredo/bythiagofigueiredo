'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  locale: 'pt-BR' | 'en'
  strings: {
    label: string
    placeholder: string
    submit: string
    sending: string
    // Neutral confirmation — shown regardless of whether the email was registered (no oracle).
    done: string
    error: string
  }
}

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void }): string
      reset(id?: string): void
    }
  }
}

export function WaitlistRightsForm({ locale, strings }: Props) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const needsToken = Boolean(siteKey)

  const [email, setEmail] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const turnstileRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  // Render the Turnstile widget when a site key is configured (same pattern as the signup form).
  useEffect(() => {
    if (!siteKey || !turnstileRef.current || state === 'done') return
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.turnstile && turnstileRef.current) {
        widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: siteKey,
          callback: (tok) => setToken(tok),
        })
      }
    }
    document.head.appendChild(script)
    return () => { script.remove() }
  }, [siteKey, state])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setState('sending')
    try {
      const res = await fetch('/api/waitlists/rights', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, locale, ...(token ? { turnstile_token: token } : {}) }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
    // Reset the (single-use) Turnstile token after any attempt.
    if (window.turnstile && widgetIdRef.current) window.turnstile.reset(widgetIdRef.current)
    setToken(null)
  }

  if (state === 'done') {
    return <p style={{ marginTop: 16 }}>{strings.done}</p>
  }

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
  const disabled = state === 'sending' || !emailValid || (needsToken && !token)

  return (
    <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
      <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>{strings.label}</label>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={strings.placeholder}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', marginBottom: 12 }}
      />
      {needsToken && <div ref={turnstileRef} style={{ marginBottom: 12 }} />}
      <button
        type="submit"
        disabled={disabled}
        style={{ background: '#111', color: '#fff', border: 0, padding: '10px 18px', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}
      >
        {state === 'sending' ? strings.sending : strings.submit}
      </button>
      {state === 'error' && <p style={{ color: '#a33', marginTop: 10 }}>{strings.error}</p>}
    </form>
  )
}
