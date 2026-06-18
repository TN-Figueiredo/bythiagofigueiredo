'use client'

import { useState } from 'react'

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

export function WaitlistRightsForm({ locale, strings }: Props) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setState('sending')
    try {
      const res = await fetch('/api/waitlists/rights', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, locale }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'done') {
    return <p style={{ marginTop: 16 }}>{strings.done}</p>
  }

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
      <button
        type="submit"
        disabled={state === 'sending'}
        style={{ background: '#111', color: '#fff', border: 0, padding: '10px 18px', borderRadius: 8, cursor: 'pointer' }}
      >
        {state === 'sending' ? strings.sending : strings.submit}
      </button>
      {state === 'error' && <p style={{ color: '#a33', marginTop: 10 }}>{strings.error}</p>}
    </form>
  )
}
