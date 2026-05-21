'use client'

import { useState, useEffect, useCallback } from 'react'
import { Lock, Send, Loader2, CheckCircle2 } from 'lucide-react'
import type { NewsletterHubStrings } from '../../_i18n/types'

interface TestSendCardProps {
  userEmail: string
  onSend: () => Promise<{ ok: true } | { ok: false; error: string }>
  strings: NewsletterHubStrings['testCenter']
}

export function TestSendCard({ userEmail, onSend, strings }: TestSendCardProps) {
  const [state, setState] = useState<'idle' | 'sending' | 'success' | 'cooldown' | 'error'>('idle')
  const [cooldownLeft, setCooldownLeft] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (cooldownLeft <= 0) {
      if (state === 'cooldown') setState('idle')
      return
    }
    const timer = setTimeout(() => setCooldownLeft((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldownLeft, state])

  const handleSend = useCallback(async () => {
    setState('sending')
    setErrorMsg('')
    try {
      const result = await onSend()
      if (result.ok) {
        setState('success')
        setTimeout(() => {
          setState('cooldown')
          setCooldownLeft(60)
        }, 2000)
      } else {
        if (result.error === 'rate_limited') {
          setState('cooldown')
          setCooldownLeft(60)
        } else {
          setErrorMsg(result.error)
          setState('error')
          setTimeout(() => setState('idle'), 3000)
        }
      }
    } catch {
      setErrorMsg(strings.unexpectedError)
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }, [onSend])

  const buttonDisabled = state !== 'idle'

  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-2">
        {strings.sendTest}
      </label>

      <div className="rounded-md border border-gray-800 bg-[#0a0f1a] p-3">
        <div className="flex items-center gap-2 mb-3">
          <Lock className="h-3 w-3 text-gray-600" />
          <span className="text-xs text-gray-500 truncate" aria-label={strings.recipientLocked}>
            {userEmail}
          </span>
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

        {state === 'sending' && (
          <p className="text-[10px] text-gray-600 mt-1.5 text-center">{strings.deliveringViaSes}</p>
        )}
        {state === 'error' && errorMsg && (
          <p className="text-[10px] text-red-400 mt-1.5 text-center">{errorMsg}</p>
        )}
      </div>
    </div>
  )
}
