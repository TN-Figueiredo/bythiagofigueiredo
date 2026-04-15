'use client'

import * as React from 'react'
import { getEditorStrings } from './strings'
import { AssetPicker } from './asset-picker'

export interface CampaignTranslationFormValue {
  locale: string
  main_hook_md: string
  supporting_argument_md: string | null
  introductory_block_md: string | null
  body_content_md: string | null
  form_intro_md: string | null
  form_button_label: string | null
  context_tag: string | null
  meta_title: string | null
  meta_description: string | null
  og_image_url: string | null
  extras: unknown
}

export interface CampaignTranslationFormProps {
  uiLocale: string
  value: CampaignTranslationFormValue
  onChange: (patch: Partial<CampaignTranslationFormValue>) => void
  onUpload?: (file: File) => Promise<string>
}

export function CampaignTranslationForm({
  uiLocale,
  value,
  onChange,
  onUpload,
}: CampaignTranslationFormProps) {
  const s = getEditorStrings(uiLocale)

  return (
    <fieldset data-testid={`campaign-translation-form-${value.locale}`}>
      <legend>{value.locale}</legend>

      <label>
        {s.campaign_editor_main_hook}
        <textarea
          aria-label={`${s.campaign_editor_main_hook} (${value.locale})`}
          value={value.main_hook_md}
          onChange={(e) => onChange({ main_hook_md: e.target.value })}
          rows={3}
        />
      </label>

      <label>
        {s.campaign_editor_supporting_argument}
        <textarea
          aria-label={`${s.campaign_editor_supporting_argument} (${value.locale})`}
          value={value.supporting_argument_md ?? ''}
          onChange={(e) => onChange({ supporting_argument_md: e.target.value || null })}
          rows={3}
        />
      </label>

      <label>
        {s.campaign_editor_introductory_block}
        <textarea
          aria-label={`${s.campaign_editor_introductory_block} (${value.locale})`}
          value={value.introductory_block_md ?? ''}
          onChange={(e) => onChange({ introductory_block_md: e.target.value || null })}
          rows={4}
        />
      </label>

      <label>
        {s.campaign_editor_body_content}
        <textarea
          aria-label={`${s.campaign_editor_body_content} (${value.locale})`}
          value={value.body_content_md ?? ''}
          onChange={(e) => onChange({ body_content_md: e.target.value || null })}
          rows={10}
        />
      </label>

      <label>
        {s.campaign_editor_form_intro}
        <textarea
          aria-label={`${s.campaign_editor_form_intro} (${value.locale})`}
          value={value.form_intro_md ?? ''}
          onChange={(e) => onChange({ form_intro_md: e.target.value || null })}
          rows={3}
        />
      </label>

      <label>
        {s.campaign_editor_form_button_label}
        <input
          type="text"
          aria-label={`${s.campaign_editor_form_button_label} (${value.locale})`}
          value={value.form_button_label ?? ''}
          onChange={(e) => onChange({ form_button_label: e.target.value || null })}
        />
      </label>

      <label>
        {s.campaign_editor_context_tag}
        <input
          type="text"
          aria-label={`${s.campaign_editor_context_tag} (${value.locale})`}
          value={value.context_tag ?? ''}
          onChange={(e) => onChange({ context_tag: e.target.value || null })}
        />
      </label>

      <details>
        <summary>{s.seoSectionLabel}</summary>

        <label>
          {s.seoTitleLabel}
          <input
            type="text"
            aria-label={`${s.seoTitleLabel} (${value.locale})`}
            value={value.meta_title ?? ''}
            onChange={(e) => onChange({ meta_title: e.target.value || null })}
          />
        </label>

        <label>
          {s.seoDescriptionLabel}
          <textarea
            aria-label={`${s.seoDescriptionLabel} (${value.locale})`}
            value={value.meta_description ?? ''}
            onChange={(e) => onChange({ meta_description: e.target.value || null })}
            rows={3}
          />
        </label>

        <label>
          {s.ogImageUrlLabel}
          <input
            type="text"
            aria-label={`${s.ogImageUrlLabel} (${value.locale})`}
            value={value.og_image_url ?? ''}
            onChange={(e) => onChange({ og_image_url: e.target.value || null })}
          />
        </label>

        {onUpload && (
          <AssetPicker
            locale={uiLocale}
            onUpload={async (file) => {
              const url = await onUpload(file)
              onChange({ og_image_url: url })
              return { url }
            }}
          />
        )}
      </details>
    </fieldset>
  )
}
