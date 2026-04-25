import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext, tryGetSiteContext } from '@/lib/cms/site-context'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { generateNewsletterDetailMetadata } from '@/lib/seo/page-metadata'
import { buildBreadcrumbNode } from '@/lib/seo/jsonld/builders'
import { composeGraph } from '@/lib/seo/jsonld/graph'
import { JsonLdScript } from '@/lib/seo/jsonld/render'
import type { Metadata } from 'next'
import { VisualBreadcrumbs } from '../../../components/visual-breadcrumbs'
import enStrings from '@/locales/en.json'
import ptBrStrings from '@/locales/pt-BR.json'

export const revalidate = 3600

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const ctx = await tryGetSiteContext()
  if (!ctx) return { title: 'Newsletter' }
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('newsletter_editions')
    .select('subject')
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .eq('status', 'sent')
    .maybeSingle()
  if (!data?.subject) return { title: 'Newsletter' }
  const host = (await headers()).get('host') ?? ctx.primaryDomain ?? ''
  try {
    const config = await getSiteSeoConfig(ctx.siteId, host)
    return generateNewsletterDetailMetadata(config, data.subject)
  } catch {
    return { title: data.subject }
  }
}

export default async function NewsletterArchivePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('subject, content_html, sent_at, newsletter_types(name, color)')
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .eq('status', 'sent')
    .maybeSingle()

  if (!edition) return notFound()

  const rawType = edition.newsletter_types
  const newsletterType = Array.isArray(rawType)
    ? (rawType[0] as { name: string; color: string } | undefined) ?? null
    : (rawType as unknown as { name: string; color: string } | null)

  const h = await headers()
  const locale = h.get('x-locale') ?? 'en'
  const t = (locale === 'pt-BR' ? ptBrStrings : enStrings) as Record<string, string>

  const sentDate = edition.sent_at ? new Date(edition.sent_at as string) : null

  // JSON-LD breadcrumb
  const host = h.get('host') ?? ctx.primaryDomain ?? ''
  const config = await getSiteSeoConfig(ctx.siteId, host).catch(() => null)
  const graph = config
    ? composeGraph([
        buildBreadcrumbNode([
          { name: t['newsletter.archive.breadcrumb.home'] ?? '', url: config.siteUrl },
          { name: t['newsletter.archive.breadcrumb.archive'] ?? '', url: `${config.siteUrl}/newsletter/archive` },
          { name: edition.subject as string, url: `${config.siteUrl}/newsletter/archive/${id}` },
        ]),
      ])
    : null

  return (
    <>
      {graph && <JsonLdScript graph={graph} />}
      <main id="main-content">
        <article
          className="reader-pinboard"
          lang={locale}
          style={{ maxWidth: 780, margin: '0 auto', padding: '32px 28px 64px' }}
        >
          <VisualBreadcrumbs
            items={[
              { label: t['newsletter.archive.breadcrumb.home'] ?? '', href: '/' },
              { label: t['newsletter.archive.breadcrumb.archive'] ?? '', href: '/newsletter/archive' },
              { label: edition.subject as string },
            ]}
          />

          <header className="mb-8">
            <p className="font-mono text-xs text-pb-muted mb-1">
              {newsletterType?.name}
              {sentDate && (
                <>
                  {' · '}
                  <time dateTime={sentDate.toISOString()}>
                    {sentDate.toLocaleDateString(locale, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </time>
                </>
              )}
            </p>
            <h1 className="font-fraunces text-3xl text-pb-ink">{edition.subject as string}</h1>
          </header>

          {edition.content_html ? (
            <div
              className="prose prose-pb"
              dangerouslySetInnerHTML={{ __html: edition.content_html as string }}
            />
          ) : (
            <p className="text-pb-muted">Content not available.</p>
          )}
        </article>
      </main>
    </>
  )
}
