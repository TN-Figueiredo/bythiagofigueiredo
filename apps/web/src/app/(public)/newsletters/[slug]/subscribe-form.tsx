'use client'

import { useRef, useState } from 'react'

export interface SubscribeFormStrings {
  stepLabel: string
  formTitle: string
  formSubtitle: string
  emailLabel: string
  emailPlaceholder: string
  consentPrefix: string
  consentSuffix: string
  privacy: string
  submit: string
  submitting: string
  noSpam: string
  noPitch: string
  oneClickLeave: string
  pendingTitle: string
  pendingBody: string
  pendingStep1: string
  pendingStep2: string
  pendingStep3: string
  pendingTip: string
  pendingResend: string
  pendingResent: string
  pendingChangeEmail: string
  confirmedTitle: string
  confirmedBody: string
  confirmedExclamation: string
  successAgain: string
  errorRateLimit: string
  errorAlreadySubscribed: string
  errorInvalid: string
  errorServer: string
}

type Phase = 'idle' | 'loading' | 'pending' | 'confirmed' | 'error'

const ERROR_MAP: Record<string, keyof SubscribeFormStrings> = {
  rate: 'errorRateLimit',
  dup: 'errorAlreadySubscribed',
  invalid: 'errorInvalid',
}

export interface SubscribeFormProps {
  newsletterId: string
  locale: 'en' | 'pt-BR'
  accentColor: string
  newsletterName: string
  strings: SubscribeFormStrings
  privacyHref: string
  turnstileSiteKey?: string
  onSubscribe: (
    email: string,
    ids: string[],
    locale: 'en' | 'pt-BR',
    token?: string,
  ) => Promise<{ success?: boolean; error?: string; subscribedIds?: string[] }>
}

export function SubscribeForm({
  newsletterId,
  locale,
  accentColor,
  newsletterName,
  strings,
  privacyHref,
  onSubscribe,
}: SubscribeFormProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [resent, setResent] = useState(false)

  const pendingHeadingRef = useRef<HTMLHeadingElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  const canSubmit = email.includes('@') && consent && phase !== 'loading'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setPhase('loading')
    setErrorMsg('')

    try {
      const result = await onSubscribe(email, [newsletterId], locale)

      if (result.success) {
        setPhase('pending')
        // Focus the pending heading for screen readers
        requestAnimationFrame(() => {
          pendingHeadingRef.current?.focus()
        })
      } else {
        const errorKey = result.error ? ERROR_MAP[result.error] ?? 'errorServer' : 'errorServer'
        setErrorMsg(strings[errorKey] as string)
        setPhase('error')
        requestAnimationFrame(() => {
          errorRef.current?.focus()
        })
      }
    } catch {
      setErrorMsg(strings.errorServer)
      setPhase('error')
      requestAnimationFrame(() => {
        errorRef.current?.focus()
      })
    }
  }

  async function handleResend() {
    try {
      await onSubscribe(email, [newsletterId], locale)
      setResent(true)
    } catch {
      // silently ignore resend errors
    }
  }

  function handleReset() {
    setEmail('')
    setConsent(false)
    setPhase('idle')
    setResent(false)
    setErrorMsg('')
  }

  // CSS variable overrides for accent color
  const accentStyle = {
    '--nl-accent': accentColor,
    '--nl-accent-text': '#fff',
  } as React.CSSProperties

  // ── Confirmed phase ───────────────────────────────────────────────────────

  if (phase === 'confirmed') {
    return (
      <div id="form-hero" data-phase="confirmed" className="nl-form-phase nl-fade-in" style={accentStyle} aria-live="polite">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Steps — all done */}
          <div>
            {[strings.pendingStep1, strings.pendingStep2, strings.pendingStep3].map(
              (step, i) => (
                <div
                  key={i}
                  className="nl-step"
                  style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <StepCircle state="done" accentColor={accentColor} />
                  <span
                    style={{
                      fontFamily: 'var(--font-jetbrains-var), monospace',
                      fontSize: 13,
                      color: 'var(--pb-ink)',
                    }}
                  >
                    {step}
                  </span>
                </div>
              ),
            )}
          </div>

          <h2
            style={{
              fontFamily: 'var(--font-fraunces-var), serif',
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--pb-ink)',
              margin: 0,
            }}
          >
            {strings.confirmedTitle}
          </h2>

          <p style={{ fontSize: 15, color: 'var(--pb-muted)', margin: 0 }}>
            {strings.confirmedBody}
          </p>

          <span
            style={{
              fontFamily: 'var(--font-caveat-var), cursive',
              fontSize: 24,
              color: 'var(--nl-accent)',
            }}
          >
            {strings.confirmedExclamation}
          </span>

          <button
            type="button"
            onClick={handleReset}
            style={{
              background: 'transparent',
              border: '1px solid var(--pb-line)',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontFamily: 'var(--font-jetbrains-var), monospace',
              color: 'var(--pb-muted)',
              cursor: 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            {strings.successAgain}
          </button>
        </div>
      </div>
    )
  }

  // ── Pending phase ─────────────────────────────────────────────────────────

  if (phase === 'pending') {
    const bodyText = strings.pendingBody.replace('{email}', email)

    return (
      <div id="form-hero" data-phase="pending" className="nl-form-phase nl-fade-in" style={accentStyle} aria-live="polite">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h2
            ref={pendingHeadingRef}
            tabIndex={-1}
            style={{
              fontFamily: 'var(--font-fraunces-var), serif',
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--pb-ink)',
              margin: 0,
              outline: 'none',
            }}
          >
            {strings.pendingTitle}
          </h2>

          <p style={{ fontSize: 15, color: 'var(--pb-muted)', margin: 0 }}>{bodyText}</p>

          {/* Email display box */}
          <div
            className="nl-email-display"
            style={{ color: 'var(--pb-ink)' }}
            aria-label={email}
          >
            {email}
          </div>

          {/* Step indicator */}
          <div>
            {[
              { label: strings.pendingStep1, state: 'done' as const },
              { label: strings.pendingStep2, state: 'active' as const },
              { label: strings.pendingStep3, state: 'pending' as const },
            ].map(({ label, state }, i) => (
              <div
                key={i}
                className="nl-step"
                style={{ display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <StepCircle state={state} accentColor={accentColor} />
                <span
                  style={{
                    fontFamily: 'var(--font-jetbrains-var), monospace',
                    fontSize: 13,
                    color: state === 'pending' ? 'var(--pb-faint)' : 'var(--pb-ink)',
                  }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          <p
            style={{
              fontSize: 12,
              color: 'var(--pb-muted)',
              margin: 0,
              fontStyle: 'italic',
            }}
          >
            {strings.pendingTip}
          </p>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleResend}
              disabled={resent}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: 13,
                fontFamily: 'var(--font-jetbrains-var), monospace',
                color: resent ? 'var(--pb-muted)' : 'var(--nl-accent)',
                cursor: resent ? 'default' : 'pointer',
                textDecoration: resent ? 'none' : 'underline',
              }}
            >
              {resent ? strings.pendingResent : strings.pendingResend}
            </button>

            <button
              type="button"
              onClick={handleReset}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: 13,
                fontFamily: 'var(--font-jetbrains-var), monospace',
                color: 'var(--pb-muted)',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              {strings.pendingChangeEmail}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Idle / loading / error phase ──────────────────────────────────────────

  const isLoading = phase === 'loading'

  return (
    <div id="form-hero" data-phase={phase} className="nl-form-phase" style={accentStyle} aria-live="polite">
      <form onSubmit={handleSubmit} noValidate>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Form header */}
          <div>
            <span
              style={{
                fontFamily: 'var(--font-jetbrains-var), monospace',
                fontSize: 11,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.08em',
                color: 'var(--pb-muted)',
              }}
            >
              {strings.stepLabel.replace('{current}', '1').replace('{total}', '3')}
            </span>
            <h2
              style={{
                fontFamily: 'var(--font-fraunces-var), serif',
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--pb-ink)',
                margin: '4px 0 0',
              }}
            >
              <span className="nl-accent-underline">{strings.formTitle}</span>
            </h2>
            <p style={{ fontSize: 13, color: 'var(--pb-muted)', margin: '6px 0 0' }}>
              {strings.formSubtitle}
            </p>
          </div>

          {/* Error alert */}
          {phase === 'error' && errorMsg && (
            <div
              ref={errorRef}
              role="alert"
              tabIndex={-1}
              className="nl-form-error"
              style={{ outline: 'none' }}
            >
              {errorMsg}
            </div>
          )}

          {/* Email input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              htmlFor="nl-email"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--pb-ink)',
                fontFamily: 'var(--font-jetbrains-var), monospace',
              }}
            >
              {strings.emailLabel}
            </label>
            <input
              id="nl-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={strings.emailPlaceholder}
              autoComplete="email"
              disabled={isLoading}
              style={{
                border: '1px solid var(--pb-line)',
                borderRadius: 6,
                padding: '10px 12px',
                fontSize: 15,
                fontFamily: 'var(--font-jetbrains-var), monospace',
                color: 'var(--pb-ink)',
                background: 'var(--pb-bg)',
                width: '100%',
                boxSizing: 'border-box' as const,
              }}
            />
          </div>

          {/* Consent checkbox */}
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--pb-muted)',
              lineHeight: 1.5,
            }}
          >
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={isLoading}
              style={{ marginTop: 2, accentColor: accentColor, flexShrink: 0 }}
            />
            <span>
              {strings.consentPrefix}
              <strong style={{ color: 'var(--pb-ink)' }}>{newsletterName}</strong>
              {strings.consentSuffix}
              <a
                href={privacyHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--nl-accent)' }}
              >
                {strings.privacy}
              </a>
              .
            </span>
          </label>

          {/* Submit button */}
          <button
            type="submit"
            disabled={!canSubmit}
            className={isLoading ? 'nl-pulse' : undefined}
            style={{
              background: canSubmit ? 'var(--nl-accent)' : 'var(--pb-faint)',
              color: canSubmit ? 'var(--nl-accent-text, #fff)' : 'var(--pb-muted)',
              border: 'none',
              borderRadius: 6,
              padding: '12px 20px',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'var(--font-jetbrains-var), monospace',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s ease',
              letterSpacing: '0.04em',
              textTransform: 'uppercase' as const,
            }}
          >
            {isLoading ? strings.submitting : strings.submit}
          </button>

          {/* Trust microcopy */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 8,
              textAlign: 'center' as const,
            }}
          >
            {[strings.noSpam, strings.noPitch, strings.oneClickLeave].map((text, i) => (
              <span
                key={i}
                style={{
                  fontSize: 11,
                  color: 'var(--pb-faint)',
                  fontFamily: 'var(--font-jetbrains-var), monospace',
                }}
              >
                {text}
              </span>
            ))}
          </div>
        </div>
      </form>
    </div>
  )
}

// ── Internal: step circle ─────────────────────────────────────────────────

interface StepCircleProps {
  state: 'done' | 'active' | 'pending'
  accentColor: string
}

function StepCircle({ state, accentColor }: StepCircleProps) {
  const isDone = state === 'done'
  const isActive = state === 'active'

  const bg = isDone || isActive ? accentColor : 'transparent'
  const border = isDone || isActive ? accentColor : 'var(--pb-line)'
  const size = 20

  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        border: `2px solid ${border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {isDone && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path
            d="M1 4l3 3 5-6"
            stroke="#fff"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  )
}
