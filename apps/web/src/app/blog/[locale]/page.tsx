import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { postRepo } from '../../../../lib/cms/repositories'
import { getSiteContext, tryGetSiteContext } from '../../../../lib/cms/site-context'
import { LocaleSwitcher } from '../../../components/locale-switcher'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { generateBlogIndexMetadata } from '@/lib/seo/page-metadata'
import { buildBreadcrumbNode } from '@/lib/seo/jsonld/builders'
import { composeGraph } from '@/lib/seo/jsonld/graph'
import { JsonLdScript } from '@/lib/seo/jsonld/render'

export const revalidate = 3600

interface Props {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ page?: string }>
}

// NOTE (Sprint 2): UI strings hardcoded as pt-BR intentionally.
// i18n lands in Sprint 3; user currently only has pt-BR + en sites.
export default async function BlogListPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const ctx = await getSiteContext()
  const page = Number.parseInt(sp.page ?? '1', 10)

  const posts = await postRepo().list({
    siteId: ctx.siteId,
    locale,
    status: 'published',
    page,
    perPage: 12,
  })

  // Derive locales available across the current page of posts. Not exhaustive
  // across the whole site (we don't have a sites.locales column), but good
  // enough to hide the switcher on single-locale sites.
  const availableLocales = Array.from(
    new Set(posts.flatMap((p) => p.available_locales ?? []).concat(locale))
  )

  // Sprint 5b PR-C C.4 — breadcrumb JSON-LD (Home -> Blog) on the index. The
  // root WebSite + Person/Org nodes are already mounted by the public layout.
  const host = (await headers()).get('host') ?? ctx.primaryDomain ?? ''
  const config = await getSiteSeoConfig(ctx.siteId, host).catch(() => null)
  const breadcrumbGraph = config
    ? composeGraph([
        buildBreadcrumbNode([
          { name: 'Home', url: config.siteUrl },
          { name: 'Blog', url: `${config.siteUrl}/blog/${locale}` },
        ]),
      ])
    : null

  return (
    <>
      {breadcrumbGraph && <JsonLdScript graph={breadcrumbGraph} />}
      <main>
        <h1>Blog</h1>
        <LocaleSwitcher
          available={availableLocales}
          current={locale}
          hrefFor={(loc) => `/blog/${loc}`}
        />
        {posts.length === 0 && <p>Nenhum post ainda.</p>}
        <ul>
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/blog/${locale}/${p.translation.slug}`}>
                <h2>{p.translation.title}</h2>
                {p.translation.excerpt && <p>{p.translation.excerpt}</p>}
                <small>{p.translation.reading_time_min} min de leitura</small>
              </Link>
            </li>
          ))}
        </ul>
        <nav>
          {page > 1 && <Link href={`?page=${page - 1}`}>Anterior</Link>}
          {posts.length === 12 && <Link href={`?page=${page + 1}`}>Próximo</Link>}
        </nav>
      </main>
    </>
  )
}

// Sprint 5b PR-C C.4 — replace the artisan generateMetadata (which emitted
// hardcoded hreflang for pt-BR + en) with generateBlogIndexMetadata(config,
// locale). The factory derives hreflang from config.supportedLocales, which
// matches the site row, so adding a third locale to the site no longer
// requires editing this page.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const ctx = await tryGetSiteContext()
  if (!ctx) {
    return { title: 'Blog', alternates: { canonical: `/blog/${locale}` } }
  }
  const host = (await headers()).get('host') ?? ctx.primaryDomain ?? ''
  try {
    const config = await getSiteSeoConfig(ctx.siteId, host)
    return generateBlogIndexMetadata(config, locale)
  } catch {
    return { title: 'Blog', alternates: { canonical: `/blog/${locale}` } }
  }
}
