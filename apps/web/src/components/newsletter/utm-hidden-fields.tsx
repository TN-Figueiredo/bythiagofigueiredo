'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import type { UtmAttributionInput } from '../../../lib/newsletter/attribution'

/**
 * The five canonical UTM params read from the landing URL.
 */
const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

/**
 * Renders hidden <input>s carrying the five canonical UTM params read from the
 * current landing URL, so newsletter signup forms that submit via NATIVE
 * FormData forward attribution to the server action. Only params actually
 * present in the URL are emitted.
 *
 * Sanitization (trim/length-cap/control-char strip) happens server-side in
 * lib/newsletter/attribution.ts — these inputs are best-effort, untrusted hints.
 *
 * Used by the genuinely FormData-based forms (newsletter-signup.tsx,
 * blog/newsletter-cta.tsx). Programmatic-submit forms use
 * {@link UtmAttributionCapture} instead.
 */
export function UtmHiddenFields() {
  const searchParams = useSearchParams()
  return (
    <>
      {UTM_PARAMS.map((name) => {
        const value = searchParams.get(name)
        return value ? <input key={name} type="hidden" name={name} value={value} /> : null
      })}
    </>
  )
}

/**
 * Reads the five canonical UTM params from the current landing URL and reports
 * them to a parent via `onCapture`. Renders nothing.
 *
 * Newsletter signup forms that submit PROGRAMMATICALLY (not via native
 * FormData) cannot rely on hidden <input>s, so this component lifts the values
 * into parent state instead. The parent forwards them as the `attribution` arg
 * of the server action, which performs the authoritative sanitization
 * (trim / length-cap / control-char strip / null-if-empty) in
 * lib/newsletter/attribution.ts. These values are best-effort, untrusted hints.
 *
 * `useSearchParams()` requires a <Suspense> boundary in statically rendered
 * routes, so callers MUST wrap this in <Suspense>.
 */
export function UtmAttributionCapture({
  onCapture,
}: {
  onCapture: (attribution: UtmAttributionInput) => void
}) {
  const searchParams = useSearchParams()
  // Effect deps must be stable primitives: `searchParams` and `onCapture` can
  // change identity every render (e.g. mocked useSearchParams in tests, inline
  // callbacks), and the effect calls a setState — depending on those object
  // identities caused an infinite render/effect loop. Key the effect on the
  // serialized query string and read the latest callback from a ref instead.
  const queryString = searchParams.toString()
  const onCaptureRef = useRef(onCapture)
  useEffect(() => {
    onCaptureRef.current = onCapture
  })

  useEffect(() => {
    const params = new URLSearchParams(queryString)
    const attribution: UtmAttributionInput = {}
    for (const name of UTM_PARAMS) {
      attribution[name] = params.get(name)
    }
    onCaptureRef.current(attribution)
  }, [queryString])

  return null
}
