import { notFound } from 'next/navigation'
import {
  CampaignEditor,
  type CampaignEditorSaveInput,
  type CampaignEditorSaveResult,
} from '@tn-figueiredo/cms'
import { campaignRepo } from '../../../../../../../lib/cms/repositories'
import { getSiteContext } from '../../../../../../../lib/cms/site-context'
import {
  saveCampaign,
  publishCampaign,
  unpublishCampaign,
  archiveCampaign,
  deleteCampaign,
  type SaveCampaignPatch,
  type SaveCampaignTranslationPatch,
} from './actions'
import { DeleteCampaignButton } from '../../_components/delete-campaign-button'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditCampaignPage({ params }: Props) {
  const { id } = await params
  const ctx = await getSiteContext()
  // getById is site-scoped: returns null for ids that belong to another
  // ring, so cross-ring access falls through to notFound() without leaking.
  const campaign = await campaignRepo().getById(id, ctx.siteId)
  if (!campaign) notFound()

  const primary = campaign.translations[0]
  const label = primary?.meta_title ?? primary?.slug ?? campaign.interest

  // Derive locale tabs: whatever translations already exist, plus the site's
  // default locale so authors can always add a missing primary-locale entry.
  const existingLocales = campaign.translations.map((t) => t.locale)
  const availableLocales = existingLocales.includes(ctx.defaultLocale)
    ? existingLocales
    : [ctx.defaultLocale, ...existingLocales]

  // Map DB row → editor shape. `slug` in the editor's campaign meta mirrors
  // the primary translation's slug (campaigns has no scalar slug column).
  const initialCampaign = {
    slug: primary?.slug ?? '',
    interest: campaign.interest,
    status: campaign.status as 'draft' | 'scheduled' | 'published' | 'archived',
    scheduled_for: campaign.scheduled_for,
    pdf_storage_path: campaign.pdf_storage_path,
    brevo_list_id: campaign.brevo_list_id,
    brevo_template_id: campaign.brevo_template_id,
    form_fields: campaign.form_fields,
  }

  const initialTranslations = campaign.translations.map((t) => ({
    locale: t.locale,
    main_hook_md: t.main_hook_md,
    supporting_argument_md: t.supporting_argument_md,
    introductory_block_md: t.introductory_block_md,
    body_content_md: t.body_content_md,
    form_intro_md: t.form_intro_md,
    form_button_label: t.form_button_label,
    context_tag: t.context_tag,
    meta_title: t.meta_title,
    meta_description: t.meta_description,
    og_image_url: t.og_image_url,
    extras: t.extras,
  }))

  const primaryLocale = campaign.translations[0]?.locale ?? ctx.defaultLocale

  const onSave = async (
    input: CampaignEditorSaveInput,
  ): Promise<CampaignEditorSaveResult> => {
    'use server'
    // Strip the editor-only `slug` field from the campaigns patch — slug is a
    // translation column and is passed through each translation entry below.
    // Also strip status / scheduled_for / published_at: those transitions are
    // owned by dedicated server actions (publish/unpublish/archive) and the
    // RPC now rejects them.
    const {
      slug: slugFromMeta,
      status: _statusIgnored,
      scheduled_for: _scheduledIgnored,
      published_at: _publishedIgnored,
      ...rest
    } = input.patch as Record<string, unknown>
    void _statusIgnored
    void _scheduledIgnored
    void _publishedIgnored
    const campaignPatch = rest as SaveCampaignPatch
    const translations: SaveCampaignTranslationPatch[] = input.translations.map((t) => ({
      locale: t.locale,
      main_hook_md: t.main_hook_md,
      supporting_argument_md: t.supporting_argument_md,
      introductory_block_md: t.introductory_block_md,
      body_content_md: t.body_content_md,
      form_intro_md: t.form_intro_md,
      ...(t.form_button_label !== null && t.form_button_label !== undefined
        ? { form_button_label: t.form_button_label }
        : {}),
      ...(t.context_tag !== null && t.context_tag !== undefined
        ? { context_tag: t.context_tag }
        : {}),
      meta_title: t.meta_title,
      meta_description: t.meta_description,
      og_image_url: t.og_image_url,
      extras: t.extras,
    }))
    // If the editor shipped a slug via meta, apply it to the primary
    // translation so authors can rename the slug.
    const translationsWithSlug =
      typeof slugFromMeta === 'string'
        ? translations.map((t) =>
            t.locale === primaryLocale ? { ...t, slug: slugFromMeta } : t,
          )
        : translations
    const result = await saveCampaign(id, campaignPatch, translationsWithSlug)
    if (result.ok) return { ok: true, campaignId: result.campaignId }
    if (result.error === 'validation_failed') {
      return { ok: false, error: 'validation_failed', fields: result.fields }
    }
    if (result.error === 'status_transition_rejected') {
      return { ok: false, error: 'status_transition_rejected', message: result.message }
    }
    return { ok: false, error: 'db_error', message: result.message }
  }

  return (
    <main>
      <header>
        <h1>Editando campanha: {label}</h1>
        <p>
          Status: <span data-status={campaign.status}>{campaign.status}</span>
        </p>
      </header>

      <CampaignEditor
        campaignId={id}
        initialCampaign={initialCampaign}
        initialTranslations={initialTranslations}
        locale={ctx.defaultLocale}
        availableLocales={availableLocales}
        onSave={onSave}
      />

      <div>
        {campaign.status !== 'published' && (
          <form
            action={async () => {
              'use server'
              await publishCampaign(id)
            }}
          >
            <button type="submit">Publicar</button>
          </form>
        )}
        {campaign.status === 'published' && (
          <form
            action={async () => {
              'use server'
              await unpublishCampaign(id)
            }}
          >
            <button type="submit">Despublicar</button>
          </form>
        )}
        {campaign.status !== 'archived' && (
          <form
            action={async () => {
              'use server'
              await archiveCampaign(id)
            }}
          >
            <button type="submit">Arquivar</button>
          </form>
        )}
        {(campaign.status === 'draft' || campaign.status === 'archived') && (
          <DeleteCampaignButton
            campaignId={id}
            campaignLabel={primary?.main_hook_md?.slice(0, 60) ?? campaign.interest}
            onDelete={deleteCampaign}
          />
        )}
      </div>
    </main>
  )
}
