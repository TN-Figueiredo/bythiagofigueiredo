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

      <label>
        {s.campaign_editor_status}
        <select
          aria-label={s.campaign_editor_status}
          value={value.status}
          onChange={(e) => onChange({ status: e.target.value as CampaignStatus })}
        >
          <option value="draft">{s.campaign_editor_status_draft}</option>
          <option value="scheduled">{s.campaign_editor_status_scheduled}</option>
          <option value="published">{s.campaign_editor_status_published}</option>
          <option value="archived">{s.campaign_editor_status_archived}</option>
        </select>
      </label>

      <label>
        {s.campaign_editor_scheduled_for}
        <input
          type="datetime-local"
          aria-label={s.campaign_editor_scheduled_for}
          value={value.scheduled_for ?? ''}
          onChange={(e) => onChange({ scheduled_for: e.target.value || null })}
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
