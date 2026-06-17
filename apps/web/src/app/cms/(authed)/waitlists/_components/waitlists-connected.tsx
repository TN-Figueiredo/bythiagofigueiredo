'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Gift, Plus } from 'lucide-react'
import { WaitlistsTable } from './waitlists-table'
import { WaitlistEditDrawer, type WaitlistDraftPayload, type WaitlistCampaignOption } from './edit-drawer'
import { WaitlistStatusStrip } from './status-strip'
import type { WaitlistStatus } from './wl-badge'
import type { WaitlistListRow } from '../queries'
import type { WaitlistActionResult, WaitlistTransitionResult } from '../actions'

/**
 * Client orchestration island (M2). Owns the drawer/open-state, makes table rows
 * open the edit drawer, and threads the server actions in as PROPS (props-only —
 * the client never imports a 'use server' module). The server page passes
 * `createWaitlist`/`updateWaitlist`/`transitionWaitlistStatus` down.
 *
 * Until the detail page (Task 17) ships, a row opens the edit drawer rather than
 * navigating; the drawer also hosts the status strip (edit mode) so transitions
 * have a home.
 */
export interface WaitlistsConnectedProps {
  rows: WaitlistListRow[]
  /** Site default locale (from getSiteContext) — drives the drawer's consent preview. */
  defaultLocale?: string
  createAction: (form: FormData) => Promise<WaitlistActionResult>
  updateAction: (id: string, form: FormData) => Promise<WaitlistActionResult>
  transitionAction: (id: string, from: WaitlistStatus, to: WaitlistStatus) => Promise<WaitlistTransitionResult>
  campaigns?: WaitlistCampaignOption[]
}

type DrawerState = { mode: 'create' } | { mode: 'edit'; row: WaitlistListRow } | null

function toFormData(payload: WaitlistDraftPayload): FormData {
  const fd = new FormData()
  fd.set('name', payload.name)
  fd.set('slug', payload.slug)
  fd.set('description', payload.description)
  fd.set('intro', payload.intro)
  // Always send campaign_id (empty = none) so the server can distinguish "unlinked"
  // from "unchanged" once campaign-clearing ships (Fase 1 only ever links).
  fd.set('campaign_id', payload.campaignId ?? '')
  fd.set('sender_name', payload.senderName)
  fd.set('sender_email', payload.senderEmail)
  fd.set('reply_to', payload.replyTo)
  return fd
}

export function WaitlistsConnected({
  rows,
  defaultLocale,
  createAction,
  updateAction,
  transitionAction,
  campaigns = [],
}: WaitlistsConnectedProps) {
  const drawerLocale = defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const router = useRouter()
  const [drawer, setDrawer] = useState<DrawerState>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)
  const [transitionPending, startTransition] = useTransition()

  const closeDrawer = () => {
    setDrawer(null)
    setFieldErrors(undefined)
  }

  async function handleSubmit(payload: WaitlistDraftPayload) {
    setSubmitting(true)
    setFieldErrors(undefined)
    try {
      const res = payload.id ? await updateAction(payload.id, toFormData(payload)) : await createAction(toFormData(payload))
      if (res.ok) {
        closeDrawer()
        router.refresh()
        return
      }
      if (res.error === 'validation_failed') setFieldErrors(res.fields)
      else if (res.error === 'slug_taken') setFieldErrors({ slug: 'This slug is already taken on this site.' })
      else setFieldErrors({ slug: 'Could not save — please try again.' })
    } catch {
      // An unexpected throw (network/getSiteContext) would otherwise strand the disabled
      // Save button — surface a retry and re-enable.
      setFieldErrors({ slug: 'Could not save — please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  function handleTransition(id: string, from: WaitlistStatus, to: WaitlistStatus) {
    startTransition(async () => {
      try {
        const res = await transitionAction(id, from, to)
        if (res.ok) {
          closeDrawer()
          router.refresh()
        }
        // On a gated/conflict result we leave the drawer open; the strip re-renders
        // off the unchanged row when router.refresh re-fetches. (Toast UX: Fase 2.)
      } catch {
        // Swallow an unexpected throw — useTransition clears `pending` regardless, so the
        // strip re-enables; the drawer stays open for a retry.
      }
    })
  }

  const editing = drawer?.mode === 'edit' ? drawer.row : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          data-testid="new-waitlist-btn"
          onClick={() => setDrawer({ mode: 'create' })}
          className="inline-flex items-center gap-2 rounded-[var(--cms-radius)] bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover"
        >
          <Plus size={14} aria-hidden="true" />
          New waitlist
        </button>
      </div>

      {rows.length === 0 ? (
        <div
          role="status"
          className="flex flex-col items-center justify-center rounded-[var(--cms-radius)] border border-dashed border-cms-border bg-cms-surface px-6 py-10 text-center"
        >
          <Gift size={28} className="mb-3 text-cms-text-muted" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-cms-text">No waitlists yet</h3>
          <p className="mt-1 text-xs text-cms-text-muted">
            Create a launch-notification list to start collecting signups.
          </p>
        </div>
      ) : (
        <WaitlistsTable rows={rows} onRowClick={(row) => setDrawer({ mode: 'edit', row })} />
      )}

      {drawer && (
        <WaitlistEditDrawer
          mode={drawer.mode}
          locale={drawerLocale}
          campaigns={campaigns}
          fieldErrors={fieldErrors}
          submitting={submitting}
          initial={
            editing
              ? {
                  // FULL hydration: updateWaitlist writes the whole scalar patch, so every
                  // editable column must be seeded or it would be blanked on save.
                  id: editing.id,
                  name: editing.name,
                  slug: editing.slug,
                  description: editing.description ?? '',
                  intro: editing.intro ?? '',
                  campaignId: editing.campaignId,
                  senderName: editing.senderName ?? '',
                  senderEmail: editing.senderEmail ?? '',
                  replyTo: editing.replyTo ?? '',
                }
              : undefined
          }
          topSlot={
            editing ? (
              <WaitlistStatusStrip
                status={editing.status}
                pending={transitionPending}
                onTransition={(to) => handleTransition(editing.id, editing.status, to)}
              />
            ) : undefined
          }
          onClose={closeDrawer}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  )
}
