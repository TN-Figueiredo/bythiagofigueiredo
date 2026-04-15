'use client'

import * as React from 'react'
import { getEditorStrings } from './strings'

export type CampaignStatus = 'draft' | 'scheduled' | 'published' | 'archived'

export interface CampaignMetaFormValue {
  slug: string
  interest: string
  status: CampaignStatus
  scheduled_for: string | null
  pdf_storage_path: string | null
  brevo_list_id: number | null
  brevo_template_id: number | null
}

export interface CampaignMetaFormProps {
  locale: string
  value: CampaignMetaFormValue
  onChange: (patch: Partial<CampaignMetaFormValue>) => void
}

function parseIntOrNull(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : null
}

/**
 * Convert an HTML `<input type="datetime-local">` value (wall-clock, no
 * offset) into an ISO-8601 UTC string using the browser's local TZ.
 * Returns null for empty input and for inputs `new Date` rejects.
 */
export function localDatetimeToIso(raw: string): string | null {
  if (raw.trim() === '') return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

/**
 * Convert an ISO timestamp back to a `datetime-local` wall-clock string for
 * display in the input. Returns '' for null/invalid input.
 */
export function isoToLocalDatetime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  // yyyy-MM-ddTHH:mm in local TZ
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

export function CampaignMetaForm({ locale, value, onChange }: CampaignMetaFormProps) {
  const s = getEditorStrings(locale)

  return (
    <fieldset data-testid="campaign-meta-form">
      <legend>{s.campaign_editor_meta_section}</legend>

      <label>
        {s.campaign_editor_slug}
        <input
          type="text"
          aria-label={s.campaign_editor_slug}
          value={value.slug}
          onChange={(e) => onChange({ slug: e.target.value })}
        />
      </label>

      <label>
        {s.campaign_editor_interest}
        <input
          type="text"
          aria-label={s.campaign_editor_interest}
          value={value.interest}
          onChange={(e) => onChange({ interest: e.target.value })}
        />
      </label>

      {/* Status is read-only in this form: the RPC rejects status transitions
          via the generic save path. Keep it visible as a label so authors
          know the current state; transitions go through dedicated buttons. */}
      <p data-testid="campaign-status-readonly">
        <strong>{s.campaign_editor_status}:</strong>{' '}
        <span data-status={value.status}>
          {value.status === 'draft'
            ? s.campaign_editor_status_draft
            : value.status === 'scheduled'
              ? s.campaign_editor_status_scheduled
              : value.status === 'published'
                ? s.campaign_editor_status_published
                : s.campaign_editor_status_archived}
        </span>
      </p>

      <label>
        {s.campaign_editor_scheduled_for}
        <input
          type="datetime-local"
          aria-label={s.campaign_editor_scheduled_for}
          value={isoToLocalDatetime(value.scheduled_for)}
          onChange={(e) =>
            onChange({ scheduled_for: localDatetimeToIso(e.target.value) })
          }
        />
      </label>

      <label>
        {s.campaign_editor_brevo_list_id}
        <input
          type="number"
          aria-label={s.campaign_editor_brevo_list_id}
          value={value.brevo_list_id ?? ''}
          onChange={(e) => onChange({ brevo_list_id: parseIntOrNull(e.target.value) })}
        />
      </label>

      <label>
        {s.campaign_editor_brevo_template_id}
        <input
          type="number"
          aria-label={s.campaign_editor_brevo_template_id}
          value={value.brevo_template_id ?? ''}
          onChange={(e) => onChange({ brevo_template_id: parseIntOrNull(e.target.value) })}
        />
      </label>

      <label>
        {s.campaign_editor_pdf_path}
        <input
          type="text"
          aria-label={s.campaign_editor_pdf_path}
          value={value.pdf_storage_path ?? ''}
          onChange={(e) => onChange({ pdf_storage_path: e.target.value || null })}
        />
      </label>
    </fieldset>
  )
}
