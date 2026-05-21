'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Mail, Send, Loader2, CheckCircle2 } from 'lucide-react'
import type { NewsletterHubStrings } from '../../_i18n/types'

interface TestSendCardProps {
  userEmail: string
  onSend: (toEmail: string) => Promise<{ ok: true } | { ok: false; error: string }>
  strings: NewsletterHubStrings['testCenter']
}

export function TestSendCard({ userEmail, onSend, strings }: TestSendCardProps) {
  const [state, setState] = useState<'idle' | 'sending' | 'success' | 'cooldown' | 'error'>('idle')
  const [cooldownLeft, setCooldownLeft] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [recipient, setRecipient] = useState(userEmail)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => clearTimer, [clearTimer])

  useEffect(() => {
    if (cooldownLeft <= 0) {
      if (state === 'cooldown') setState('idle')
      return
    }
    const timer = setTimeout(() => setCooldownLeft((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldownLeft, state])

  const mapSendError = useCallback((code: string): string => {
    switch (code) {
      case 'rate_limited': return strings.rateLimited
      case 'hourly_limit_exceeded': return strings.errorHourlyLimit
      case 'forbidden': return strings.errorForbidden
      case 'email_send_failed': return strings.failedToSend
      case 'invalid_email': return strings.invalidEmail
      default: return strings.failedToSend
    }
  }, [strings])

  const handleSend = useCallback(async () => {
    setState('sending')
    setErrorMsg('')
    clearTimer()
    try {
      const result = await onSend(recipient)
      if (result.ok) {
        setState('success')
        timerRef.current = setTimeout(() => {
          setState('cooldown')
          setCooldownLeft(60)
        }, 2000)
      } else {
        if (result.error === 'rate_limited' || result.error === 'hourly_limit_exceeded') {
          setState('cooldown')
          setCooldownLeft(60)
        } else {
          setErrorMsg(mapSendError(result.error))
          setState('error')
          timerRef.current = setTimeout(() => setState('idle'), 3000)
        }
      }
    } catch {
      setErrorMsg(strings.unexpectedError)
      setState('error')
      timerRef.current = setTimeout(() => setState('idle'), 3000)
    }
  }, [onSend, recipient, mapSendError, strings.unexpectedError, clearTimer])

  const buttonDisabled = state !== 'idle' || !recipient.trim()

  const statusText =
    state === 'sending' ? strings.sending
    : state === 'success' ? strings.testSent
    : state === 'cooldown' ? `${strings.waitCooldown} (${cooldownLeft}s)`
    : state === 'error' ? (errorMsg || strings.failedToSend)
    : ''

  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-2">
        {strings.sendTest}
      </label>

      <div className="rounded-md border border-gray-800 bg-[#0a0f1a] p-3">
        <div className="mb-3">
          <label htmlFor="test-recipient" className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-1">
            <Mail className="h-3 w-3" />
            {strings.recipientLabel}
          </label>
          <input
            id="test-recipient"
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder={strings.recipientPlaceholder}
            className="w-full rounded-md border border-gray-800 bg-[#060a14] px-3 py-1.5 text-xs text-gray-300 placeholder:text-gray-600 focus:border-indigo-500/50 focus:outline-none"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={buttonDisabled}
          className={`w-full flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
            state === 'cooldown'
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
              : state === 'success'
              ? 'bg-green-600/20 text-green-400'
              : buttonDisabled
              ? 'bg-indigo-600/50 text-white/50 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {state === 'sending' && <><Loader2 className="h-3 w-3 animate-spin" />{strings.sending}</>}
          {state === 'success' && <><CheckCircle2 className="h-3 w-3" />{strings.testSent}</>}
          {state === 'cooldown' && <>{strings.waitCooldown} ({cooldownLeft}s)</>}
          {state === 'error' && strings.failedToSend}
          {state === 'idle' && <><Send className="h-3 w-3" />{strings.sendTestEmail}</>}
        </button>

        <div aria-live="polite" className="min-h-[1rem] mt-1.5 text-center">
          {state === 'sending' && (
            <p className="text-[10px] text-gray-600">{strings.deliveringViaSes}</p>
          )}
          {state === 'error' && errorMsg && (
            <p className="text-[10px] text-red-400">{errorMsg}</p>
          )}
          {state === 'success' && (
            <p className="text-[10px] text-green-400">{strings.testSent}</p>
          )}
        </div>

        <span className="sr-only" aria-live="assertive">{statusText}</span>
      </div>
    </div>
  )
}
