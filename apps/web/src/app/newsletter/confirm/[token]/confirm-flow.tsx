'use client'

import { useState, useCallback, useTransition } from 'react'
import { confirmSubscription } from './actions'
import type { ConfirmActionResult } from './actions'

export interface ConfirmCopy {
  confirm_button: string
  confirm_pending: string
  confirm_body: string
  rpc_error_title: string
  rpc_error_body: string
  not_found_title: string
  not_found_body: string
  expired_title: string
  expired_body: string
  invalid_state_title: string
  invalid_state_body: string
  already_title: string
  already_body: string
  already_signoff: string
  ok_title: string
  ok_body: string
  ok_body_continuation: string
  ok_signoff: string
  go_to_site: string
  read_latest: string
  back_home: string
  subscribed_to: string
}

interface ConfirmFlowProps {
  token: string
  copy: ConfirmCopy
  locale: string
}

/**
 * Two-step confirmation flow.
 * 1. Renders a "Confirm" button (GET does NOT call the RPC).
 * 2. On click, calls the server action and shows the result inline.
 * This defeats email scanner auto-follow (Safe Links, Proofpoint, etc.).
 */
export function ConfirmFlow({ token, copy, locale }: ConfirmFlowProps) {
  const [result, setResult] = useState<ConfirmActionResult | null>(null)
  const [isPending, startTransition] = useTransition()
  const [clicked, setClicked] = useState(false)

  const handleConfirm = useCallback(() => {
    setClicked(true)
    startTransition(async () => {
      const r = await confirmSubscription(token)
      setResult(r)
    })
  }, [token])

  const homePath = locale === 'pt-BR' ? '/pt/' : '/'
  const blogPath = `${homePath}blog`

  // ── Post-confirmation result ─────────────────────────────────────────
  if (result) {
    if (result.state === 'success') {
      return (
        <ResultView accent="#FF8240" icon="❦" shimmer>
          <h1 className="confirm-title font-fraunces font-medium m-0 mb-4" style={{ fontSize: 'clamp(26px, 5vw, 30px)', color: 'var(--pb-ink)', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            {copy.ok_title}
          </h1>
          <p className="font-source-serif leading-[1.65] mx-auto" style={{ fontSize: 17, maxWidth: 420, color: 'var(--pb-muted)', marginBottom: 0 }}>
            {copy.ok_body}
          </p>
          <p className="font-source-serif leading-[1.65] mx-auto" style={{ fontSize: 17, maxWidth: 420, color: 'var(--pb-muted)', marginTop: 20, marginBottom: 0 }}>
            {copy.ok_body_continuation}
          </p>
          <p className="font-source-serif leading-[1.6]" style={{ fontSize: 16, color: 'var(--pb-muted)', marginTop: 20, marginBottom: 0 }}>
            {copy.ok_signoff}<br />— Thiago
          </p>
          <hr className="border-none" style={{ width: '100%', height: 1, background: 'var(--pb-line)', margin: '32px 0' }} />
          <a href={homePath} className="confirm-cta inline-block font-inter font-semibold no-underline transition-all duration-150" style={{ background: 'var(--pb-accent)', color: '#1F1B17', letterSpacing: '0.01em', padding: '15px 40px', borderRadius: 4, fontSize: 15 }}>
            {copy.go_to_site}
          </a>
          <a href={blogPath} className="block font-inter font-medium no-underline" style={{ color: 'var(--pb-accent)', fontSize: 13, marginTop: 20, letterSpacing: '0.01em' }}>
            {copy.read_latest}
          </a>
        </ResultView>
      )
    }

    if (result.state === 'already') {
      return (
        <ResultView accent="#FF8240" icon="❦">
          <h1 className="confirm-title font-fraunces font-medium m-0 mb-4" style={{ fontSize: 'clamp(26px, 5vw, 30px)', color: 'var(--pb-ink)', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            {copy.already_title}
          </h1>
          <p className="font-source-serif leading-[1.65] mx-auto" style={{ fontSize: 17, maxWidth: 420, color: 'var(--pb-muted)', marginBottom: 0 }}>
            {copy.already_body}
          </p>
          <p className="font-source-serif leading-[1.6]" style={{ fontSize: 16, color: 'var(--pb-muted)', marginTop: 20, marginBottom: 0 }}>
            {copy.already_signoff}<br />— Thiago
          </p>
          <hr className="border-none" style={{ width: '100%', height: 1, background: 'var(--pb-line)', margin: '32px 0' }} />
          <a href={homePath} className="font-inter no-underline" style={{ fontSize: 13, fontWeight: 500, color: 'var(--pb-faint)' }}>
            {copy.back_home}
          </a>
        </ResultView>
      )
    }

    // Error states
    const errorMap: Record<string, { title: string; body: string; accent: string; icon: string }> = {
      not_found: { title: copy.not_found_title, body: copy.not_found_body, accent: '#958A75', icon: '⁇' },
      expired: { title: copy.expired_title, body: copy.expired_body, accent: '#E5A100', icon: '⏳' },
      error: { title: copy.rpc_error_title, body: copy.rpc_error_body, accent: '#C14513', icon: '⚠' },
    }
    const err = errorMap[result.state] ?? errorMap.error
    return (
      <ResultView accent={err.accent} icon={err.icon}>
        <h1 className="confirm-title font-fraunces font-medium m-0 mb-4" style={{ fontSize: 'clamp(26px, 5vw, 30px)', color: 'var(--pb-ink)', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
          {err.title}
        </h1>
        <p className="font-source-serif leading-[1.65] mx-auto" style={{ fontSize: 17, maxWidth: 420, color: 'var(--pb-muted)', marginBottom: 0 }}>
          {err.body}
        </p>
        <hr className="border-none" style={{ width: '100%', height: 1, background: 'var(--pb-line)', margin: '32px 0' }} />
        <a href={homePath} className="font-inter no-underline" style={{ fontSize: 13, fontWeight: 500, color: 'var(--pb-faint)' }}>
          {copy.back_home}
        </a>
      </ResultView>
    )
  }

  // ── Initial state: confirm prompt ────────────────────────────────────
  // The <form> with a bound server action provides progressive enhancement:
  // if JS is disabled the form POST still triggers the server action.
  // When JS is available, onClick intercepts for the enhanced transition UX.
  return (
    <div className="text-center">
      <p
        className="font-source-serif leading-[1.65] mx-auto"
        style={{ fontSize: 17, maxWidth: 420, color: 'var(--pb-muted)', marginBottom: 28 }}
      >
        {copy.confirm_body}
      </p>

      <form action={confirmSubscription.bind(null, token)}>
        <button
          type="submit"
          onClick={(e) => {
            e.preventDefault()
            handleConfirm()
          }}
          disabled={isPending || clicked}
          className="confirm-cta inline-block font-inter font-semibold no-underline transition-all duration-150 border-none cursor-pointer disabled:opacity-60 disabled:cursor-wait"
          style={{
            background: 'var(--pb-accent)',
            color: '#1F1B17',
            letterSpacing: '0.01em',
            padding: '15px 40px',
            borderRadius: 4,
            fontSize: 15,
          }}
        >
          {isPending ? copy.confirm_pending : copy.confirm_button}
        </button>
      </form>
    </div>
  )
}

/* ── Helper: result container with card chrome ──────────────────────────── */

function ResultView({ accent, icon, shimmer, children }: { accent: string; icon: string; shimmer?: boolean; children: React.ReactNode }) {
  return (
    <div className="text-center" style={{ animation: 'fadeUp 0.4s ease-out both' }}>
      {/* State icon */}
      {icon === '❦' ? (
        <div className="confirm-fleuron font-source-serif mb-7" style={{ fontSize: 40, color: accent, lineHeight: 1 }} role="img" aria-hidden="true">
          {icon}
        </div>
      ) : (
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5" style={{ border: `2px solid ${accent}`, color: accent, fontSize: 24, lineHeight: 1 }} role="img" aria-hidden="true">
          {icon}
        </div>
      )}
      {children}
    </div>
  )
}
