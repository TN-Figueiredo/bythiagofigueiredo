'use client'

import * as React from 'react'
import { getEditorStrings } from './strings'
import { useAutosave } from '../hooks/use-autosave'
import { getNewDraftId, clearNewDraftId } from '../hooks/new-draft-id'
import {
  CampaignMetaForm,
  type CampaignMetaFormValue,
  type CampaignStatus,
} from './campaign-meta-form'
import {
  CampaignTranslationForm,
  type CampaignTranslationFormValue,
} from './campaign-translation-form'

export interface CampaignEditorInitialCampaign {
  slug: string
  interest: string
  status: CampaignStatus
  scheduled_for: string | null
  pdf_storage_path: string | null
  brevo_list_id: number | null
  brevo_template_id: number | null
  form_fields: unknown
}

export interface CampaignEditorInitialTranslation {
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

export interface CampaignEditorSaveInput {
  patch: Partial<CampaignEditorInitialCampaign>
  translations: CampaignEditorInitialTranslation[]
}

export type CampaignEditorSaveResult =
  | { ok: true; campaignId?: string }
  | { ok: false; error: 'validation_failed'; fields: Record<string, string> }
  | { ok: false; error: 'compile_failed'; message: string }
  | { ok: false; error: 'db_error'; message: string }
  | { ok: false; error: 'status_transition_rejected'; message: string }

export interface CampaignEditorProps {
  campaignId: string
  initialCampaign: CampaignEditorInitialCampaign
  initialTranslations: CampaignEditorInitialTranslation[]
  /** Editor UI locale (pt-BR / en). */
  locale: string
  /** Locales available for translation tabs. */
  availableLocales: string[]
  onSave: (input: CampaignEditorSaveInput) => Promise<CampaignEditorSaveResult>
  onUpload?: (file: File) => Promise<string>
  /** Disable autosave (tests). */
  autosaveDisabled?: boolean
}

interface CampaignDraft {
  campaign: CampaignEditorInitialCampaign
  translations: CampaignEditorInitialTranslation[]
  activeLocale: string
}

function ensureTranslationForLocale(
  translations: CampaignEditorInitialTranslation[],
  locale: string,
): CampaignEditorInitialTranslation[] {
  if (translations.some((t) => t.locale === locale)) return translations
  return [
    ...translations,
    {
      locale,
      main_hook_md: '',
      supporting_argument_md: null,
      introductory_block_md: null,
      body_content_md: null,
      form_intro_md: null,
      form_button_label: null,
      context_tag: null,
      meta_title: null,
      meta_description: null,
      og_image_url: null,
      extras: null,
    },
  ]
}

export function CampaignEditor(props: CampaignEditorProps) {
  const s = getEditorStrings(props.locale)

  const [campaign, setCampaign] = React.useState<CampaignEditorInitialCampaign>(
    props.initialCampaign,
  )
  const [translations, setTranslations] = React.useState<
    CampaignEditorInitialTranslation[]
  >(props.initialTranslations)
  const [activeLocale, setActiveLocale] = React.useState<string>(
    props.initialTranslations[0]?.locale ??
      props.availableLocales[0] ??
      props.locale,
  )
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})

  // Mint per-tab session id when the campaign has no stable id yet.
  const newDraftIdRef = React.useRef<string | null>(null)
  const isNewDraft = !props.campaignId || props.campaignId === 'new'
  if (isNewDraft && newDraftIdRef.current == null) {
    newDraftIdRef.current = getNewDraftId('campaign')
  }
  const draftKeyId = isNewDraft
    ? (newDraftIdRef.current ?? 'new')
    : props.campaignId
  const autosaveKey = `campaign-draft:${draftKeyId}`
  const snapshot = React.useMemo<CampaignDraft>(
    () => ({ campaign, translations, activeLocale }),
    [campaign, translations, activeLocale],
  )
  const autosave = useAutosave<CampaignDraft>(autosaveKey, snapshot, {
    enabled: !props.autosaveDisabled,
  })

  function updateCampaignMeta(patch: Partial<CampaignMetaFormValue>) {
    setCampaign((prev) => ({ ...prev, ...patch }))
  }

  function updateTranslation(
    locale: string,
    patch: Partial<CampaignTranslationFormValue>,
  ) {
    setTranslations((prev) =>
      ensureTranslationForLocale(prev, locale).map((t) =>
        t.locale === locale ? { ...t, ...patch } : t,
      ),
    )
  }

  function handleSelectLocale(locale: string) {
    setTranslations((prev) => ensureTranslationForLocale(prev, locale))
    setActiveLocale(locale)
  }

  function handleRestore() {
    const snap = autosave.restore()
    if (snap) {
      setCampaign(snap.campaign)
      setTranslations(snap.translations)
      setActiveLocale(snap.activeLocale)
    }
  }

  async function handleSave() {
    setError(null)
    setFieldErrors({})
    setSaving(true)
    try {
      const patch: Partial<CampaignEditorInitialCampaign> = {
        slug: campaign.slug,
        interest: campaign.interest,
        status: campaign.status,
        scheduled_for: campaign.scheduled_for,
        pdf_storage_path: campaign.pdf_storage_path,
        brevo_list_id: campaign.brevo_list_id,
        brevo_template_id: campaign.brevo_template_id,
        form_fields: campaign.form_fields,
      }
      const result = await props.onSave({ patch, translations })
      if (!result.ok) {
        if (result.error === 'validation_failed') {
          setFieldErrors(result.fields)
          setError(s.validationFailed(Object.keys(result.fields)))
        } else {
          setError(result.message ?? s.campaign_editor_save_error)
        }
      } else {
        autosave.discard()
        if (isNewDraft) clearNewDraftId('campaign')
      }
    } finally {
      setSaving(false)
    }
  }

  const activeTranslation =
    translations.find((t) => t.locale === activeLocale) ??
    ensureTranslationForLocale(translations, activeLocale).find(
      (t) => t.locale === activeLocale,
    )!

  const metaValue: CampaignMetaFormValue = {
    slug: campaign.slug,
    interest: campaign.interest,
    status: campaign.status,
    scheduled_for: campaign.scheduled_for,
    pdf_storage_path: campaign.pdf_storage_path,
    brevo_list_id: campaign.brevo_list_id,
    brevo_template_id: campaign.brevo_template_id,
  }

  return (
    <div data-campaign-editor>
      <h2>{s.campaign_editor_title}</h2>

      {autosave.hasDraft && (
        <div role="status" data-testid="autosave-banner">
          <span>{s.autosaveRestoreBanner}</span>{' '}
          <button type="button" onClick={handleRestore}>
            {s.autosaveRestore}
          </button>{' '}
          <button type="button" onClick={() => autosave.discard()}>
            {s.autosaveDiscard}
          </button>
        </div>
      )}

      <CampaignMetaForm
        locale={props.locale}
        value={metaValue}
        onChange={updateCampaignMeta}
      />

      <section data-testid="campaign-translations">
        <h3>{s.campaign_editor_translations_section}</h3>
        <div
          role="tablist"
          aria-label={s.campaign_editor_locale_tabs_label}
          data-testid="locale-tabs"
        >
          {props.availableLocales.map((loc) => (
            <button
              key={loc}
              type="button"
              role="tab"
              aria-selected={loc === activeLocale}
              data-active={loc === activeLocale ? 'true' : 'false'}
              onClick={() => handleSelectLocale(loc)}
            >
              {loc}
            </button>
          ))}
        </div>

        <CampaignTranslationForm
          key={activeLocale}
          uiLocale={props.locale}
          value={activeTranslation}
          onChange={(patch) => updateTranslation(activeLocale, patch)}
          onUpload={props.onUpload}
        />
      </section>

      {error && <p role="alert">{error}</p>}
      {Object.keys(fieldErrors).length > 0 && (
        <ul data-testid="campaign-field-errors" role="list">
          {Object.entries(fieldErrors).map(([field, msg]) => (
            <li key={field} data-field={field}>
              <strong>{field}</strong>: {msg}
            </li>
          ))}
        </ul>
      )}

      <button type="button" disabled={saving} onClick={handleSave}>
        {saving ? s.savingButton : s.saveButton}
      </button>
    </div>
  )
}
