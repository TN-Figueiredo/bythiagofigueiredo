'use client'

import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import DOMPurify from 'isomorphic-dompurify'
import { slugify } from '@/lib/blog/slugify'
import { FORM_STRINGS, type WaitlistLocale } from '@/components/waitlists/form-strings'
import { RenderConsentText } from '@/components/waitlists/consent-text'

/**
 * Payload the drawer hands back on save. The connected island (which owns the
 * server actions per the props-only convention) converts this to FormData and
 * calls `createWaitlist`/`updateWaitlist`. The drawer itself never imports a
 * server action.
 */
export interface WaitlistDraftPayload {
  id?: string
  name: string
  slug: string
  description: string
  intro: string
  campaignId: string | null
  senderName: string
  senderEmail: string
  replyTo: string
}

export interface WaitlistCampaignOption {
  id: string
  label: string
}

export interface WaitlistEditDrawerProps {
  mode: 'create' | 'edit'
  initial?: Partial<WaitlistDraftPayload>
  /**
   * Locale for the consent preview. The connected island passes the site's
   * defaultLocale so the drawer preview matches what an en-default visitor sees.
   * Defaults to 'en' (EN-first CMS chrome).
   */
  locale?: WaitlistLocale
  /** Campaigns available to link (passed by the connected island). */
  campaigns?: WaitlistCampaignOption[]
  /** Server-side field errors to surface inline (e.g. { slug, sender_email }). */
  fieldErrors?: Record<string, string>
  submitting?: boolean
  /** Rendered at the top of the drawer body — used for the status strip in edit mode. */
  topSlot?: ReactNode
  onClose: () => void
  onSubmit: (draft: WaitlistDraftPayload) => void
}

const FIELD =
  'mt-1 w-full rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-2 text-sm text-cms-text outline-none focus:border-cms-accent'

export function WaitlistEditDrawer({
  mode,
  initial,
  locale = 'en',
  campaigns = [],
  fieldErrors,
  submitting = false,
  topSlot,
  onClose,
  onSubmit,
}: WaitlistEditDrawerProps) {
  const isNew = mode === 'create'
  const dialogRef = useRef<HTMLDivElement>(null)
  const introRef = useRef<HTMLDivElement>(null)
  const slugRef = useRef<HTMLInputElement>(null)
  const senderEmailRef = useRef<HTMLInputElement>(null)
  // Sanitize the DB-sourced intro before it touches dangerouslySetInnerHTML so the
  // contentEditable never hydrates with un-sanitized stored HTML (WL-01). Read-back
  // is sanitized again on save below; any future render surface MUST also sanitize.
  const introInit = useRef(DOMPurify.sanitize(initial?.intro ?? ''))
  // Restore focus to whatever triggered the drawer when it closes (WL-08). The full
  // focus-trap is owned by the connected island (M2 work, WL-07); this covers restore.
  const triggerRef = useRef<HTMLElement | null>(
    typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null,
  )
  const consentStrings = FORM_STRINGS[locale] ?? FORM_STRINGS.en

  const [name, setName] = useState(initial?.name ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [description, setDescription] = useState(initial?.description ?? '')
  const [campaignId, setCampaignId] = useState<string | null>(initial?.campaignId ?? null)
  const [senderName, setSenderName] = useState(initial?.senderName ?? '')
  const [senderEmail, setSenderEmail] = useState(initial?.senderEmail ?? '')
  const [replyTo, setReplyTo] = useState(initial?.replyTo ?? '')
  const [nameErr, setNameErr] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    const FOCUSABLE =
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[contenteditable="true"],[tabindex]:not([tabindex="-1"])'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      // Focus trap: keep Tab / Shift+Tab cycling inside the dialog (WCAG dialog, WL-07).
      if (e.key === 'Tab' && dialog) {
        const nodes = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (!first || !last) return
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    // Move focus to the first real field on open (WCAG 2.4.3) — not the tabIndex=-1
    // container. rAF lets the portalled dialog mount before we focus.
    const raf = requestAnimationFrame(() => {
      const firstField = dialog?.querySelector<HTMLElement>('[data-testid="wl-name"]')
      ;(firstField ?? dialog)?.focus()
    })
    const trigger = triggerRef.current
    return () => {
      document.removeEventListener('keydown', onKey)
      cancelAnimationFrame(raf)
      // Restore focus to the trigger after the drawer unmounts (a11y, WL-08).
      trigger?.focus?.()
    }
  }, [onClose])

  // M3: on a server validation failure, move focus to the first erroring field so
  // keyboard/SR users are taken straight to what to fix (the drawer stays open).
  useEffect(() => {
    if (fieldErrors?.slug) slugRef.current?.focus()
    else if (fieldErrors?.sender_email) senderEmailRef.current?.focus()
  }, [fieldErrors])

  const onName = (v: string) => {
    setName(v)
    setNameErr(false)
    if (!slugTouched) setSlug(slugify(v))
  }

  const save = () => {
    if (!name.trim()) {
      setNameErr(true)
      return
    }
    // Intro is an UNCONTROLLED contentEditable (read on save) — this avoids the
    // React removeChild crash that a controlled rich-text node triggers. Read
    // the live DOM, falling back to the initial value if the ref never mounted.
    // Sanitize the read-back HTML before it leaves the drawer so unsanitized markup
    // is never persisted (WL-01); the compile/render boundary must sanitize too.
    const rawIntro = introRef.current ? introRef.current.innerHTML : introInit.current
    const intro = DOMPurify.sanitize(rawIntro)
    onSubmit({
      ...(initial?.id ? { id: initial.id } : {}),
      name: name.trim(),
      slug: slug.trim() || slugify(name),
      description: description.trim(),
      intro,
      campaignId,
      senderName: senderName.trim(),
      senderEmail: senderEmail.trim(),
      replyTo: replyTo.trim(),
    })
  }

  const slugErr = fieldErrors?.slug
  const senderErr = fieldErrors?.sender_email

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
        data-testid="wl-drawer-scrim"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? 'New waitlist' : 'Edit waitlist'}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-cms-bg shadow-xl outline-none"
      >
        <div className="flex items-center gap-2 border-b border-cms-border px-5 py-4">
          <span className="text-sm font-semibold text-cms-text">{isNew ? 'New waitlist' : 'Edit waitlist'}</span>
          <span className="grow" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-cms-text-muted hover:bg-cms-surface hover:text-cms-text"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {topSlot && <div className="mb-5 border-b border-cms-border pb-5">{topSlot}</div>}
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-cms-text-muted">Essentials</div>

          <label className="block">
            <span className="text-sm text-cms-text">Name</span>
            <input
              data-testid="wl-name"
              className={FIELD}
              value={name}
              onChange={(e) => onName(e.target.value)}
              aria-invalid={nameErr || undefined}
              placeholder="e.g. Nômade Dev · Turma 1"
            />
            {nameErr && (
              <span role="alert" className="mt-1 block text-xs text-[var(--danger)]">
                Name is required.
              </span>
            )}
          </label>

          <label className="mt-3 block">
            <span className="text-sm text-cms-text">Slug</span>
            <input
              ref={slugRef}
              data-testid="wl-slug"
              className={`${FIELD} font-mono${slugErr ? ' border-[var(--danger)]' : ''}`}
              value={slug}
              onChange={(e) => {
                setSlug(slugify(e.target.value))
                setSlugTouched(true)
              }}
              aria-invalid={slugErr ? true : undefined}
              placeholder="nomade-dev-turma-1"
            />
            {slugErr ? (
              <span role="alert" className="mt-1 block text-xs text-[var(--danger)]">{slugErr}</span>
            ) : (
              <span className="mt-1 block text-xs text-cms-text-muted">
                Public URL: <span className="font-mono">/waitlists/{slug || 'slug'}</span> · auto-filled from name.
              </span>
            )}
          </label>

          <label className="mt-3 block">
            <span className="text-sm text-cms-text">Description</span>
            <textarea
              data-testid="wl-description"
              className={FIELD}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One line on what's coming."
            />
          </label>

          <div id="wl-intro-label" className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-cms-text-muted">
            Intro · rich text
          </div>
          <div className="overflow-hidden rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface">
            <div
              data-testid="wl-intro-editor"
              contentEditable
              role="textbox"
              aria-multiline="true"
              aria-labelledby="wl-intro-label"
              suppressContentEditableWarning
              ref={introRef}
              className="min-h-16 px-3 py-3 text-sm leading-relaxed text-cms-text outline-none"
              dangerouslySetInnerHTML={{ __html: introInit.current }}
            />
          </div>
          <span className="mt-1 block text-xs text-cms-text-muted">
            Authored here, compiled + sanitized. Shown above the form on the public page.
          </span>

          {campaigns.length > 0 && (
            <>
              <div className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-cms-text-muted">Link</div>
              <label className="block">
                <span className="text-sm text-cms-text">Linked campaign · optional</span>
                <select
                  data-testid="wl-campaign"
                  className={FIELD}
                  value={campaignId ?? ''}
                  onChange={(e) => setCampaignId(e.target.value || null)}
                >
                  <option value="">None</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <div className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-cms-text-muted">Sender</div>
          <label className="block">
            <span className="text-sm text-cms-text">Sender name</span>
            <input data-testid="wl-sender-name" className={FIELD} value={senderName} onChange={(e) => setSenderName(e.target.value)} />
          </label>
          <label className="mt-3 block">
            <span className="text-sm text-cms-text">Sender email</span>
            <input
              ref={senderEmailRef}
              data-testid="wl-sender-email"
              className={`${FIELD} font-mono${senderErr ? ' border-[var(--danger)]' : ''}`}
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              aria-invalid={senderErr ? true : undefined}
            />
            {senderErr ? (
              <span role="alert" className="mt-1 block text-xs text-[var(--danger)]">{senderErr}</span>
            ) : (
              <span className="mt-1 block text-xs text-cms-text-muted">Validated against your verified domains at save.</span>
            )}
          </label>
          <label className="mt-3 block">
            <span className="text-sm text-cms-text">Reply-to · optional</span>
            <input
              data-testid="wl-reply-to"
              className={`${FIELD} font-mono`}
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder="thiago@bythiagofigueiredo.com"
            />
          </label>

          <div className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-cms-text-muted">Consent the visitor sees</div>
          <div className="flex items-start gap-2 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-2 text-sm text-cms-text">
            <span className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border border-cms-border" />
            <RenderConsentText name={name || '{Product}'} strings={consentStrings} />
          </div>
          <span className="mt-2 block text-xs text-cms-text-muted">
            Email + this single consent checkbox are the only fields collected. No name, no phone, no price.
          </span>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-cms-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--cms-radius)] px-4 py-2 text-sm text-cms-text-muted hover:bg-cms-surface"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={submitting}
            className="rounded-[var(--cms-radius)] bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover disabled:opacity-60"
          >
            {isNew ? 'Create waitlist' : 'Save changes'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
