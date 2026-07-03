'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Iframe auto-height bridge for the embed surface (Surface 2). Wraps the embed
 * card and emits `postMessage({ type: 'waitlist:resize', height })` to
 * `window.parent` on mount and on every height change (ResizeObserver), so the
 * host page can grow/shrink the iframe without scrollbars:
 *
 *   window.addEventListener('message', (e) => {
 *     if (e.data?.type === 'waitlist:resize') iframe.style.height = e.data.height + 'px'
 *   })
 *
 * targetOrigin is `'*'` BY DESIGN: any third-party site may embed the form, so
 * the parent origin is unknowable, and the payload is a single non-sensitive
 * integer (the rendered height) — nothing to leak. Never widen this payload
 * with reader data without revisiting that decision.
 */
export function WaitlistEmbedFrame({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const post = () => {
      // Opened standalone (not inside an iframe) → nobody to notify.
      if (window.parent === window) return
      window.parent.postMessage(
        { type: 'waitlist:resize', height: Math.ceil(el.getBoundingClientRect().height) },
        '*',
      )
    }
    post()
    // Guarded for old browsers / non-DOM test environments; the mount post above
    // still fires, so the iframe gets at least the initial height.
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(post)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={ref} data-waitlist-embed-frame="">
      {children}
    </div>
  )
}
