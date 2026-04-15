import { notFound } from 'next/navigation'
import { compileMdx, MdxRunner } from '@tn-figueiredo/cms'
import { postRepo } from '../../../../../lib/cms/repositories'
import { getSiteContext } from '../../../../../lib/cms/site-context'
import { blogRegistry } from '../../../../../lib/cms/registry'
import { LocaleSwitcher } from '../../../../components/locale-switcher'

export const revalidate = 3600

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

/**
 * Fetch translations for a post by slug + compute cross-locale slug map.
 * `getBySlug` only returns the matching translation (inner join), so we
 * follow up with `getById` to enumerate all available translations — this
 * drives both the hreflang alternates and the locale switcher links.
 */
async function loadPostWithLocales(siteId: string, locale: string, slug: string) {
  const post = await postRepo().getBySlug({ siteId, locale, slug })
  if (!post) return null
  const full = await postRepo().getById(post.id)
  const translations = full?.translations ?? post.translations
  return { post, translations }
}

export default async function BlogDetailPage({ params }: Props) {
  const { locale, slug } = await params
  const ctx = await getSiteContext()

  const loaded = await loadPostWithLocales(ctx.siteId, locale, slug)
  if (!loaded) notFound()
  const { translations } = loaded
  const tx = translations.find((t) => t.locale === locale)
  if (!tx) notFound()

  // Pre-compiled output from admin save (fast path).
  // NULL → runtime compile fallback (slower, used for legacy posts from Sprint 1 seed).
  let compiledSource = tx.content_compiled
  if (!compiledSource) {
    const compiled = await compileMdx(tx.content_mdx, blogRegistry)
    compiledSource = compiled.compiledSource
  }

  const availableLocales = translations.map((t) => t.locale)
  const slugByLocale = new Map(translations.map((t) => [t.locale, t.slug] as const))

  return (
    <main>
      <article>
        <header>
          <LocaleSwitcher
            available={availableLocales}
            current={locale}
            hrefFor={(loc) => `/blog/${loc}/${slugByLocale.get(loc) ?? slug}`}
          />
          <h1>{tx.title}</h1>
          {tx.excerpt && <p>{tx.excerpt}</p>}
          <p>{tx.reading_time_min} min de leitura</p>
        </header>
        <MdxRunner compiledSource={compiledSource} registry={blogRegistry} />
      </article>
      {tx.content_toc.length > 0 && (
        <aside aria-label="Sumário">
          <ul>
            {tx.content_toc.map((entry) => (
              <li key={entry.slug} style={{ marginLeft: entry.depth * 8 }}>
                <a href={`#${entry.slug}`}>{entry.text}</a>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </main>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params
  const ctx = await getSiteContext().catch(() => null)
  if (!ctx) return {}
  const loaded = await loadPostWithLocales(ctx.siteId, locale, slug)
  if (!loaded) return {}
  const tx = loaded.translations.find((t) => t.locale === locale)
  if (!tx) return {}

  // Emit hreflang alternates for every translation + x-default pointing to pt-BR
  // (falling back to the current locale if pt-BR is absent for the post).
  const languages: Record<string, string> = {}
  for (const t of loaded.translations) {
    languages[t.locale] = `/blog/${t.locale}/${t.slug}`
  }
  const defaultTx = loaded.translations.find((t) => t.locale === 'pt-BR') ?? tx
  languages['x-default'] = `/blog/${defaultTx.locale}/${defaultTx.slug}`

  return {
    title: tx.title,
    description: tx.excerpt ?? undefined,
    alternates: {
      canonical: `/blog/${locale}/${slug}`,
      languages,
    },
  }
}
