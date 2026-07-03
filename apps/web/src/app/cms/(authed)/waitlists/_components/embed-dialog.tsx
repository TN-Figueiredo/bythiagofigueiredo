'use client'

import { createPortal } from 'react-dom'
import { useMemo, useRef, useState } from 'react'
import { Code } from 'lucide-react'
import { useDialogFocus } from './use-dialog-focus'

export interface EmbedDialogProps {
  slug: string
  /** Public base URL of the site (origin, no trailing slash) — e.g. https://bythiagofigueiredo.com */
  appUrl: string
  onClose: () => void
}

/** Accepts `#RRGGBB` or `RRGGBB`; returns the bare 6-hex (no `#`) or null when invalid. */
function parseAccent(input: string): string | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(input.trim())
  return m?.[1] ?? null
}

function buildSnippet(appUrl: string, slug: string, accentHex: string | null): string {
  const base = `${appUrl.replace(/\/+$/, '')}/embed/waitlists/${slug}`
  const src = accentHex ? `${base}?accent=${accentHex}` : base
  return `<iframe
  src="${src}"
  title="Waitlist — ${slug}"
  style="width:100%;border:0;"
  height="520"
  loading="lazy"
></iframe>
<script>
  // Auto-height: the embed posts { type: "waitlist:resize", height } as its content grows.
  window.addEventListener("message", function (e) {
    if (!e.data || e.data.type !== "waitlist:resize" || typeof e.data.height !== "number") return
    var frame = document.querySelector('iframe[src^="${base}"]')
    if (frame) frame.style.height = e.data.height + "px"
  })
</script>`
}

/**
 * Embed dialog (handoff §6, portalled): optional 6-hex accent that live-updates the
 * `?accent=` on a copy-paste <iframe> snippet (swatch preview), a Copy snippet button
 * (clipboard API + execCommand fallback + aria-live announcement), and a note that
 * embed signups land tagged `embed`. Esc closes (useDialogFocus).
 */
export function EmbedDialog({ slug, appUrl, onClose }: EmbedDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [accentInput, setAccentInput] = useState('')
  const [announce, setAnnounce] = useState('')

  useDialogFocus(dialogRef, onClose)

  const accentHex = parseAccent(accentInput)
  const accentInvalid = accentInput.trim() !== '' && accentHex === null
  const snippet = useMemo(() => buildSnippet(appUrl, slug, accentHex), [appUrl, slug, accentHex])

  async function copySnippet() {
    let ok = false
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(snippet)
        ok = true
      }
    } catch {
      ok = false
    }
    if (!ok) {
      // Legacy fallback for browsers/contexts without the async clipboard API.
      const ta = document.createElement('textarea')
      ta.value = snippet
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        ok = document.execCommand('copy')
      } catch {
        ok = false
      }
      ta.remove()
    }
    setAnnounce(ok ? 'Embed snippet copied to clipboard.' : 'Copy failed — select the snippet and copy it manually.')
  }

  const FIELD =
    'mt-1 w-full rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-2 text-sm text-cms-text outline-none focus:border-cms-accent'

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Embed waitlist"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[var(--cms-radius)] bg-cms-bg p-5 shadow-xl outline-none"
      >
        <h2 className="text-sm font-semibold text-cms-text">Embed · {slug}</h2>
        <p className="mt-1 text-sm text-cms-text-muted">
          Paste this snippet where the form should appear. Signups made through the embed arrive tagged with source{' '}
          <code className="font-mono text-xs text-cms-text">embed</code>.
        </p>

        <label className="mt-4 block">
          <span className="text-sm text-cms-text">Accent color (optional)</span>
          <span className="flex items-center gap-2">
            <input
              data-testid="embed-accent"
              type="text"
              placeholder="#C14513"
              maxLength={7}
              className={FIELD}
              value={accentInput}
              onChange={(e) => setAccentInput(e.target.value)}
              aria-invalid={accentInvalid || undefined}
            />
            <span
              data-testid="embed-accent-swatch"
              aria-hidden="true"
              className="mt-1 inline-block h-8 w-8 shrink-0 rounded-[var(--cms-radius)] border border-cms-border"
              style={accentHex ? { background: `#${accentHex}` } : undefined}
            />
          </span>
        </label>
        {accentInvalid && (
          <p role="alert" className="mt-2 text-sm text-[var(--cms-rose,#f43f5e)]">
            Use a 6-digit hex like #C14513 — the accent was not applied.
          </p>
        )}

        <pre
          data-testid="embed-snippet"
          className="mt-4 max-h-56 overflow-auto rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-3 font-mono text-xs leading-relaxed text-cms-text"
        >
          {snippet}
        </pre>
        <p className="mt-2 text-xs text-cms-text-muted">
          The optional <code className="font-mono">waitlist:resize</code> listener auto-sizes the iframe to its
          content; drop it if a fixed height is fine.
        </p>

        <p aria-live="polite" role="status" className="mt-3 min-h-5 text-sm text-cms-text-muted">
          {announce}
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--cms-radius)] px-4 py-2 text-sm text-cms-text-muted hover:bg-cms-surface"
          >
            Close
          </button>
          <button
            type="button"
            onClick={copySnippet}
            className="rounded-[var(--cms-radius)] bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover"
          >
            Copy snippet
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}

/** Detail-page embed island: owns the EmbedDialog open-state (mirrors WaitlistExportButton). */
export function WaitlistEmbedButton({ slug, appUrl }: { slug: string; appUrl: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-[var(--cms-radius)] border border-cms-border px-4 py-2 text-sm text-cms-text hover:bg-cms-surface"
      >
        <Code size={14} aria-hidden="true" />
        Embed
      </button>
      {open && <EmbedDialog slug={slug} appUrl={appUrl} onClose={() => setOpen(false)} />}
    </>
  )
}
