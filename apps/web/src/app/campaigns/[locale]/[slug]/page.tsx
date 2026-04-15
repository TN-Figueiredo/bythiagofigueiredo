import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { SubmitForm } from './submit-form'
import { ExtrasRenderer } from './extras-renderer'

interface PageParams {
  locale: string
  slug: string
}

function Md({ text }: { text: string | null | undefined }) {
  if (!text) return null
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
}

async function loadCampaign(locale: string, slug: string) {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('campaigns')
    .select(
      `
      id, status, pdf_storage_path, brevo_list_id, interest, form_fields,
      campaign_translations!inner(
        locale, slug, meta_title, meta_description, og_image_url,
        main_hook_md, supporting_argument_md, introductory_block_md, body_content_md,
        form_intro_md, form_button_label, form_button_loading_label,
        context_tag, success_headline, success_headline_duplicate,
        success_subheadline, success_subheadline_duplicate,
        check_mail_text, download_button_label, extras
      )
    `,
    )
    .eq('campaign_translations.locale', locale)
    .eq('campaign_translations.slug', slug)
    .maybeSingle()
  if (error || !data) return null
  return data
}

export default async function CampaignPage({ params }: { params: Promise<PageParams> }) {
  const { locale, slug } = await params
  const campaign = await loadCampaign(locale, slug)
  if (!campaign) notFound()
  const tx = (campaign as { campaign_translations: Array<Record<string, unknown>> })
    .campaign_translations[0]
  if (!tx) notFound()

  return (
    <main>
      <section aria-label="beforeForm">
        <Md text={tx.main_hook_md as string} />
        <Md text={tx.supporting_argument_md as string | null} />
        <Md text={tx.introductory_block_md as string | null} />
        <Md text={tx.body_content_md as string | null} />
      </section>

      <section aria-label="form">
        <Md text={tx.form_intro_md as string | null} />
        <SubmitForm
          slug={slug}
          locale={locale}
          formFields={(campaign as { form_fields: unknown }).form_fields as unknown[]}
          buttonLabel={tx.form_button_label as string}
          loadingLabel={tx.form_button_loading_label as string}
          contextTag={tx.context_tag as string}
        />
      </section>

      <section aria-label="afterForm">
        {tx.extras ? <ExtrasRenderer extras={tx.extras} /> : null}
      </section>
    </main>
  )
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }) {
  const { locale, slug } = await params
  const c = await loadCampaign(locale, slug)
  if (!c) return {}
  const tx = (c as { campaign_translations: Array<Record<string, unknown>> })
    .campaign_translations[0]
  if (!tx) return {}
  return {
    title: tx.meta_title as string,
    description: tx.meta_description as string,
    openGraph: { images: tx.og_image_url ? [{ url: tx.og_image_url as string }] : [] },
  }
}
