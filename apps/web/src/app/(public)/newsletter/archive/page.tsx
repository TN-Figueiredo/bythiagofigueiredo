import Link from 'next/link'
import { headers } from 'next/headers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext, tryGetSiteContext } from '@/lib/cms/site-context'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { generateNewsletterArchiveMetadata } from '@/lib/seo/page-metadata'
import { localePath } from '@/lib/i18n/locale-path'
import type { Metadata } from 'next'
import { VisualBreadcrumbs } from '../../components/visual-breadcrumbs'
import enStrings from '@/locales/en.json'
import ptBrStrings from '@/locales/pt-BR.json'

export const revalidate = 3600

const PER_PAGE = 20

interface Props {
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await tryGetSiteContext()
  if (!ctx) return { title: 'Newsletter Archive' }
  const h = await headers()
  const host = h.get('host') ?? ctx.primaryDomain ?? ''
  const locale = h.get('x-locale') ?? 'en'
  try {
    const config = await getSiteSeoConfig(ctx.siteId, host)
    return generateNewsletterArchiveMetadata(config, locale)
  } catch {
    return { title: 'Newsletter Archive' }
  }
}

export default async function NewsletterArchiveListPage({ searchParams }: Props) {
  const sp = await searchParams
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const h = await headers()
  const locale = h.get('x-locale') ?? 'en'
  const t = (locale === 'pt-BR' ? ptBrStrings : enStrings) as Record<string, string>

  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10))
  const from = (page - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  const { data: editions, count } = await supabase
    .from('newsletter_editions')
    .select('id, subject, sent_at, newsletter_types!inner(name, color, locale)', { count: 'exact' })
    .eq('site_id', ctx.siteId)
    .eq('status', 'sent')
    .eq('newsletter_types.locale', locale)
    .order('sent_at', { ascending: false })
    .range(from, to)

  const totalPages = Math.ceil((count ?? 0) / PER_PAGE)

  return (
    <main id="main-content">
      <div className="reader-pinboard" style={{ maxWidth: 780, margin: '0 auto', padding: '32px 28px 64px' }}>
        <VisualBreadcrumbs
          items={[
            { label: t['newsletter.archive.breadcrumb.home'] ?? '', href: '/' },
            { label: t['newsletter.archive.breadcrumb.archive'] ?? '' },
          ]}
        />

        <h1 className="font-fraunces text-3xl text-pb-ink mb-8">
          {t['newsletter.archive.title']}
        </h1>

        {(editions ?? []).length === 0 ? (
          <p className="text-pb-muted">{t['newsletter.archive.empty']}</p>
        ) : (
          <ul className="space-y-4">
            {(editions ?? []).map((e) => {
              const typeName = Array.isArray(e.newsletter_types)
                ? e.newsletter_types[0]?.name
                : (e.newsletter_types as { name: string } | null)?.name
              const typeColor = Array.isArray(e.newsletter_types)
                ? e.newsletter_types[0]?.color
                : (e.newsletter_types as { color: string } | null)?.color
              const sentDate = e.sent_at ? new Date(e.sent_at) : null

              return (
                <li key={e.id}>
                  <Link
                    href={localePath(`/newsletter/archive/${e.id}`, locale)}
                    className="block rounded-lg border border-pb-faint p-4 hover:border-pb-accent transition-colors"
                    style={{ borderLeftColor: typeColor ?? '#C14513', borderLeftWidth: 4 }}
                  >
                    <p className="font-mono text-xs text-pb-muted mb-1">
                      {typeName ?? 'Newsletter'}
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
                    <h2 className="font-fraunces font-semibold text-pb-ink">{e.subject}</h2>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        {totalPages > 1 && (
          <nav aria-label="Pagination" className="flex items-center justify-between mt-8 font-mono text-sm">
            {page > 1 ? (
              <Link
                href={`${localePath('/newsletter/archive', locale)}?page=${page - 1}`}
                className="text-pb-accent hover:underline"
              >
                {t['newsletter.archive.pagination.prev']}
              </Link>
            ) : (
              <span className="text-pb-faint">{t['newsletter.archive.pagination.prev']}</span>
            )}

            <span className="text-pb-muted">
              {page} / {totalPages}
            </span>

            {page < totalPages ? (
              <Link
                href={`${localePath('/newsletter/archive', locale)}?page=${page + 1}`}
                className="text-pb-accent hover:underline"
              >
                {t['newsletter.archive.pagination.next']}
              </Link>
            ) : (
              <span className="text-pb-faint">{t['newsletter.archive.pagination.next']}</span>
            )}
          </nav>
        )}
      </div>
    </main>
  )
}
