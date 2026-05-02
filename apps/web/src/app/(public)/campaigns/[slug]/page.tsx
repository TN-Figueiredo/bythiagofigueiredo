import { cache } from 'react'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { tryGetSiteContext } from '@/lib/cms/site-context'
import { SubmitForm } from './submit-form'
import { ExtrasRenderer } from './extras-renderer'
import { getSiteSeoConfig, type SiteSeoConfig } from '@/lib/seo/config'
import { generateCampaignMetadata } from '@/lib/seo/page-metadata'
import { buildArticleNode, buildBreadcrumbNode } from '@/lib/seo/jsonld/builders'
import { composeGraph } from '@/lib/seo/jsonld/graph'
import { JsonLdScript } from '@/lib/seo/jsonld/render'
import { localePath } from '@/lib/i18n/locale-path'
import { VisualBreadcrumbs } from '../../components/visual-breadcrumbs'
import enStrings from '@/locales/en.json'
import ptBrStrings from '@/locales/pt-BR.json'

interface PageParams {
  slug: string
}

interface ParsedCampaign {
  id: string
  status: string
  pdf_storage_path: string | null
  interest: string
  form_fields: unknown[]
  created_at?: string | null
  updated_at?: string | null
  published_at?: string | null
  campaign_translations: Array<Record<string, unknown>>
}

function Md({ text }: { text: string | null | undefined }) {
  if (!text) return null
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
}

function parseCampaign(raw: unknown): ParsedCampaign | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { campaign_translations?: unknown[] }
  if (!Array.isArray(r.campaign_translations) || r.campaign_translations.length === 0) return null
  return raw as ParsedCampaign
}

const loadCampaign = cache(async function loadCampaignImpl(locale: string, slug: string) {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('campaigns')
    .select(
      `
      id, status, pdf_storage_path, interest, form_fields,
      created_at, updated_at, published_at,
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
  return parseCampaign(data)
})

// Sprint 5b PR-C C.5 — defensive Date parser (mirrors blog detail page).
function parseDateOrNull(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export default async function CampaignPage({ params }: { params: Promise<PageParams> }) {
  const { slug } = await params
  const h = await headers()
  const locale = h.get('x-locale') ?? 'en'
  const campaign = await loadCampaign(locale, slug)
  if (!campaign) notFound()
  const tx = campaign.campaign_translations[0]
  if (!tx) notFound()

  const t = (locale === 'pt-BR' ? ptBrStrings : enStrings) as unknown as Record<string, string>

  // Sprint 5b PR-C C.5 — JSON-LD: Article + Breadcrumb. Reuses buildArticleNode
  // (same shape as BlogPosting with @type swapped) to describe the campaign
  // landing page. Root WebSite + Person/Org nodes come from the public layout.
  const ctx = await tryGetSiteContext()
  const host = h.get('host') ?? ctx?.primaryDomain ?? ''
  const config = ctx
    ? await getSiteSeoConfig(ctx.siteId, host).catch(() => null)
    : null
  const graph = buildCampaignGraph(config, campaign, tx, locale, slug)

  const title = (tx.meta_title as string | undefined) ?? slug

  return (
    <>
      {graph && <JsonLdScript graph={graph} />}
      <main id="main-content">
        <div className="reader-pinboard" style={{ maxWidth: 780, margin: '0 auto', padding: '32px 28px 64px' }}>
          <VisualBreadcrumbs
            items={[
              { label: t['campaigns.breadcrumb.home'] ?? '', href: '/' },
              { label: t['campaigns.breadcrumb.campaigns'] ?? '', href: localePath('/campaigns', locale) },
              { label: title },
            ]}
          />

          <article lang={locale}>
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
                formFields={campaign.form_fields}
                buttonLabel={tx.form_button_label as string}
                loadingLabel={tx.form_button_loading_label as string}
                contextTag={tx.context_tag as string}
              />
            </section>

            <section aria-label="afterForm">
              {tx.extras ? <ExtrasRenderer extras={tx.extras} /> : null}
            </section>
          </article>
        </div>
      </main>
    </>
  )
}

function buildCampaignGraph(
  config: SiteSeoConfig | null,
  campaign: ParsedCampaign,
  tx: Record<string, unknown>,
  locale: string,
  slug: string,
) {
  if (!config) return null
  const title = (tx.meta_title as string | undefined) ?? slug
  const crumbs = buildBreadcrumbNode([
    { name: 'Home', url: config.siteUrl },
    { name: 'Campaigns', url: `${config.siteUrl}${localePath('/campaigns', locale)}` },
    {
      name: title,
      url: `${config.siteUrl}${localePath(`/campaigns/${encodeURIComponent(slug)}`, locale)}`,
    },
  ])
  const updatedAt = parseDateOrNull(campaign.updated_at)
  const publishedAt = parseDateOrNull(campaign.published_at) ?? updatedAt
  if (!publishedAt || !updatedAt) {
    return composeGraph([crumbs])
  }
  // Adapt to BlogPostInput/TranslationInput shapes expected by
  // buildArticleNode. Campaigns don't have a blog-style cover_image_url on
  // the row; use the translation og_image_url if present, else null (the
  // builder falls back to the site default OG endpoint).
  const ogUrl = (tx.og_image_url as string | null | undefined) ?? null
  const articleNode = buildArticleNode(
    config,
    {
      id: campaign.id,
      translation: {
        title,
        slug,
        excerpt: (tx.meta_description as string | null | undefined) ?? null,
        reading_time_min: 0,
      },
      updated_at: updatedAt,
      published_at: publishedAt,
    },
    [
      {
        locale,
        slug,
        title,
        excerpt: (tx.meta_description as string | null | undefined) ?? null,
        cover_image_url: ogUrl,
        seo_extras: null,
      },
    ],
  )
  return composeGraph([articleNode, crumbs])
}

// Sprint 5b PR-C C.5 — replace the artisan generateMetadata with
// generateCampaignMetadata(config, input). The factory emits canonical,
// OG type=article, and OG image (explicit og_image_url > dynamic OG
// endpoint fallback), so the page no longer hardcodes any of that.
export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
  const { slug } = await params
  const h = await headers()
  const locale = h.get('x-locale') ?? 'en'
  const c = await loadCampaign(locale, slug)
  if (!c) return {}
  const tx = c.campaign_translations[0]
  if (!tx) return {}
  const ctx = await tryGetSiteContext()
  if (!ctx) {
    // No site context -> minimal fallback: title + description only. No
    // canonical because we can't guarantee the path resolves to a single
    // site.
    return {
      title: tx.meta_title as string,
      description: tx.meta_description as string,
    }
  }
  const host = (await headers()).get('host') ?? ctx.primaryDomain ?? ''
  try {
    const config = await getSiteSeoConfig(ctx.siteId, host)
    return generateCampaignMetadata(config, {
      slug,
      locale,
      meta_title: tx.meta_title as string,
      meta_description: tx.meta_description as string,
      og_image_url: (tx.og_image_url as string | null | undefined) ?? null,
    })
  } catch {
    return {
      title: tx.meta_title as string,
      description: tx.meta_description as string,
    }
  }
}
