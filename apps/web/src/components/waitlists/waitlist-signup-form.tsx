'use client'

import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { FORM_STRINGS, type WaitlistLocale } from './form-strings'
import { RenderConsentText } from './consent-text'

// WL-R6: cross-boundary JSON (network → client) is untrusted; Zod-parse rather than
// `as`-cast so a malformed payload degrades gracefully instead of poisoning state.
const StatusResponse = z
  .object({ status: z.string().optional(), name: z.string().optional() })
  .passthrough()
const SignupResponse = z
  .object({ success: z.boolean().optional(), duplicate: z.boolean().optional() })
  .passthrough()


type Variant = 'landing' | 'embed' | 'inline'
type PublicStatus = 'open' | 'closed' | 'launched'

// Lifecycle gates whether the form is even shown (M4). For `landing` it is derived
// synchronously from `initialStatus` (the server component already resolved the row);
// for `embed`/`inline` there is no server-resolved status, so it is resolved by a
// mount-GET against the public status route — never render-the-form-then-yank-it.
type Lifecycle = 'loading' | 'open' | 'closed' | 'launched' | 'unavailable' | 'transient-error'

// Submit state machine (spec §7) — only meaningful once lifecycle === 'open'.
// `raceClosed` is DISTINCT from the lifecycle `closed`/`launched`: it is the live POST
// returning 409 (the list closed mid-flight, after the reader had already submitted).
type SubmitState =
  | 'idle'
  | 'submitting'
  | 'success'
  | 'duplicate'
  | 'raceClosed'
  | 'error'
  | 'rateLimited'
  | 'unavailable'

interface Props {
  slug: string
  locale: WaitlistLocale
  /** Waitlist display name — interpolated into the consent label so the rendered
   *  text matches the `consent_texts` ledger string verbatim (LGPD proof-of-consent). */
  name: string
  variant?: Variant
  /** Only consulted for `variant === 'landing'` (server-resolved status). */
  initialStatus?: PublicStatus
}

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void }): string
      reset(id?: string): void
    }
  }
}

const RESULT_STATES: ReadonlySet<SubmitState> = new Set(['success', 'duplicate', 'raceClosed'])

export function WaitlistSignupForm({ slug, locale, name, variant = 'landing', initialStatus }: Props) {
  const strings = FORM_STRINGS[locale] ?? FORM_STRINGS.en
  // M4: only require a token when a Turnstile site key is configured — otherwise the
  // button is permanently bricked in keyless dev. Read on every render (env is inlined).
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const needsToken = Boolean(siteKey)

  const [lifecycle, setLifecycle] = useState<Lifecycle>(() =>
    variant === 'landing' ? (initialStatus ?? 'open') : 'loading',
  )
  const [resolvedName, setResolvedName] = useState(name)
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const turnstileRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  // Mount-GET lifecycle for embed/inline (M4). Landing trusts initialStatus.
  useEffect(() => {
    if (variant === 'landing') return
    let cancelled = false
    setLifecycle('loading')
    fetch(`/api/waitlists/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 404) {
          setLifecycle('unavailable')
          return
        }
        if (!res.ok) {
          setLifecycle('transient-error')
          return
        }
        const parsed = StatusResponse.safeParse(await res.json())
        if (cancelled) return
        if (!parsed.success) {
          setLifecycle('transient-error')
          return
        }
        const data = parsed.data
        if (data.name) setResolvedName(data.name)
        if (data.status === 'open' || data.status === 'closed' || data.status === 'launched') {
          setLifecycle(data.status)
        } else {
          setLifecycle('unavailable')
        }
      })
      .catch(() => {
        if (!cancelled) setLifecycle('transient-error')
      })
    return () => {
      cancelled = true
    }
  }, [slug, variant, reloadKey])

  // Turnstile widget — only when a site key is set and the form is actually open.
  useEffect(() => {
    if (!siteKey || lifecycle !== 'open' || !turnstileRef.current) return
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
    return () => {
      script.remove()
    }
  }, [siteKey, lifecycle])

  // Move focus to the result region after a terminal submit (a11y, spec §7).
  useEffect(() => {
    if (RESULT_STATES.has(submitState)) resultRef.current?.focus()
  }, [submitState])

  function resetTurnstile() {
    if (window.turnstile && widgetIdRef.current) window.turnstile.reset(widgetIdRef.current)
    setToken(null)
  }

  const loading = submitState === 'submitting'
  // UI-only gate aligned with the server's z.string().email() intent so the user isn't
  // allowed to submit 'a@' / '@b' and bounce. The server remains authoritative.
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
  const submitDisabled = loading || !consent || !emailValid || (needsToken && !token)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitDisabled) return
    setSubmitState('submitting')
    try {
      const res = await fetch(`/api/waitlists/${encodeURIComponent(slug)}/signup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          locale,
          email,
          consent_launch_notification: true,
          // The route's Zod schema requires a non-empty token; in keyless dev the route
          // skips verification, so a placeholder satisfies the schema without weakening prod
          // (prod always has a real token here because needsToken gates the submit button).
          turnstile_token: token ?? 'no-turnstile',
        }),
      })
      // 409/429/503 carry no body we need; map by status. Spec §7 response→state.
      if (res.status === 429) {
        setSubmitState('rateLimited')
        resetTurnstile()
        return
      }
      if (res.status === 503) {
        setSubmitState('unavailable')
        resetTurnstile()
        return
      }
      if (res.status === 409) {
        setSubmitState('raceClosed')
        return
      }
      if (!res.ok) {
        setSubmitState('error')
        resetTurnstile()
        return
      }
      const parsed = SignupResponse.safeParse(await res.json())
      if (!parsed.success) {
        setSubmitState('error')
        resetTurnstile()
        return
      }
      setSubmitState(parsed.data.duplicate ? 'duplicate' : 'success')
    } catch {
      setSubmitState('error')
      resetTurnstile()
    }
  }

  function retryLifecycle() {
    setLifecycle('loading')
    setReloadKey((k) => k + 1)
  }

  const Spinner = (
    <span
      aria-hidden="true"
      className="inline-block h-3 w-3 animate-spin motion-reduce:animate-none rounded-full border-2 border-current border-t-transparent"
    />
  )

  // ---- lifecycle gates (the form never even opened) ----
  if (lifecycle === 'loading') {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className="flex items-center gap-2 p-6 text-sm text-pb-muted">
        {Spinner}
        <span>{strings.buttonLoading}</span>
      </div>
    )
  }
  if (lifecycle === 'unavailable') {
    return (
      <p role="status" aria-live="polite" className="p-6 text-sm text-pb-muted">
        {strings.unavailable}
      </p>
    )
  }
  if (lifecycle === 'transient-error') {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 p-6 text-sm text-pb-muted">
        <span>{strings.error}</span>
        <button
          type="button"
          onClick={retryLifecycle}
          className="rounded-lg border border-pb-line px-3 py-1.5 text-xs font-medium text-pb-ink hover:border-pb-accent"
        >
          ↻ {strings.button}
        </button>
      </div>
    )
  }
  if (lifecycle === 'closed') {
    return (
      <p role="status" aria-live="polite" className="p-6 text-sm text-pb-muted">
        {strings.closed}
      </p>
    )
  }
  if (lifecycle === 'launched') {
    return (
      <p role="status" aria-live="polite" className="p-6 text-sm text-pb-ink">
        {strings.launched}
      </p>
    )
  }

  // ---- lifecycle === 'open' ----
  // Terminal submit states that REPLACE the form.
  if (submitState === 'success' || submitState === 'duplicate') {
    const headline = submitState === 'success' ? strings.successHeadline : strings.duplicateHeadline
    const body = submitState === 'success' ? strings.successBody : strings.duplicateBody
    return (
      <div
        ref={resultRef}
        role="status"
        aria-live="polite"
        tabIndex={-1}
        className="p-6 outline-none"
      >
        <p className="font-serif text-xl text-pb-ink">{headline}</p>
        <p className="mt-1 text-sm text-pb-muted">{body}</p>
        <p className="mt-3 text-xs text-pb-muted/80">{strings.reassurance}</p>
      </div>
    )
  }
  if (submitState === 'raceClosed') {
    return (
      <div ref={resultRef} role="status" aria-live="polite" tabIndex={-1} className="p-6 outline-none">
        <p className="text-sm text-pb-muted">{strings.raceClosed}</p>
      </div>
    )
  }

  // Form states: idle / submitting / error / rateLimited / unavailable (retryable).
  const errMsg =
    submitState === 'error'
      ? strings.error
      : submitState === 'rateLimited'
        ? strings.rateLimited
        : submitState === 'unavailable'
          ? strings.unavailable
          : null

  const inputClasses =
    'w-full border border-pb-line rounded-lg px-3 py-2 text-sm text-pb-ink bg-pb-bg placeholder:text-pb-muted/50 focus:outline-none focus:ring-2 focus:ring-pb-accent/60 focus:border-pb-accent'

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-6" noValidate>
      <div>
        {/* WCAG 3.3.2/1.3.1: a placeholder is not a label (it vanishes on input).
            Real <label htmlFor> bound to the input id; visually hidden to preserve the
            placeholder-only chrome from the design handoff. The accessible name is a
            dedicated label ("Email"), not the placeholder text (WL-R6). */}
        <label htmlFor="waitlist-email" className="sr-only">
          {strings.emailLabel}
        </label>
        <input
          id="waitlist-email"
          type="email"
          name="email"
          required
          maxLength={320}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={strings.emailPlaceholder}
          aria-invalid={errMsg ? 'true' : 'false'}
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={loading}
          className={inputClasses}
        />
      </div>

      <label htmlFor="waitlist-consent" className="flex items-start gap-2 text-sm text-pb-muted">
        <input
          id="waitlist-consent"
          type="checkbox"
          name="consent_launch_notification"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={loading}
          className="mt-0.5 shrink-0 accent-pb-accent"
        />
        <RenderConsentText name={resolvedName} strings={strings} strongClassName="text-pb-ink" />
      </label>

      {needsToken && <div ref={turnstileRef} />}

      {/* Error text uses a literal hex (not a color-mix/relative-color token): load-bearing
          chrome, and color-mix renders transparent in Opera. */}
      {errMsg && (
        <p role="alert" className="text-sm text-[#c0392b]">
          {errMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={submitDisabled}
        aria-busy={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 font-semibold text-pb-bg transition-all disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundColor: 'var(--pb-accent)', fontFamily: 'var(--font-sans)' }}
      >
        {loading ? (
          <>
            {Spinner}
            {strings.buttonLoading}
          </>
        ) : (
          strings.button
        )}
      </button>

      <p className="pt-1 text-center text-xs text-pb-muted/80">{strings.reassurance}</p>
    </form>
  )
}
