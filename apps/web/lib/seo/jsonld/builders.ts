import type { SiteSeoConfig } from '../config'
import type { PersonProfile, OrgProfile } from '../identity-profiles'
import type { SeoExtras, FaqEntry, VideoObjectExtra } from './extras-schema'
import type { JsonLdNode } from './types'

type BlogPostInput = {
  id: string
  translation: { title: string; slug: string; excerpt: string | null; reading_time_min: number }
  updated_at: Date
  published_at: Date
  authorName?: string
}

type TranslationInput = {
  locale: string
  slug: string
  title: string
  excerpt: string | null
  cover_image_url: string | null
  seo_extras: SeoExtras | null
}

export function buildPersonNode(config: SiteSeoConfig, profile: PersonProfile): JsonLdNode {
  return {
    '@type': 'Person',
    '@id': `${config.siteUrl}/#person`,
    name: profile.name,
    jobTitle: profile.jobTitle,
    image: profile.imageUrl,
    url: config.siteUrl,
    sameAs: profile.sameAs,
  }
}

export function buildOrgNode(config: SiteSeoConfig, profile: OrgProfile): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': `${config.siteUrl}/#organization`,
    name: profile.name,
    legalName: profile.legalName,
    logo: profile.logoUrl,
    url: config.siteUrl,
    founder: { '@type': 'Person', name: profile.founderName },
    sameAs: profile.sameAs,
  }
}

export function buildWebSiteNode(config: SiteSeoConfig): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': `${config.siteUrl}/#website`,
    url: config.siteUrl,
    name: config.siteName,
    inLanguage: config.defaultLocale,
    publisher: { '@id': `${config.siteUrl}/#${config.identityType}` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${config.siteUrl}/blog/${config.defaultLocale}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function buildBlogPostingNode(
  config: SiteSeoConfig, post: BlogPostInput, translations: TranslationInput[],
): JsonLdNode {
  const tx = translations.find((t) => t.title === post.translation.title) ?? translations[0]
  if (!tx) throw new Error('buildBlogPostingNode: no translation provided')
  const url = `${config.siteUrl}${config.contentPaths.blog}/${tx.locale}/${tx.slug}`
  const image = resolveOgImageForBlog(config, tx, post)
  return {
    '@type': 'BlogPosting',
    '@id': `${url}#blogposting`,
    headline: tx.title,
    description: tx.excerpt ?? '',
    url,
    mainEntityOfPage: { '@id': url },
    datePublished: post.published_at.toISOString(),
    dateModified: post.updated_at.toISOString(),
    inLanguage: tx.locale,
    author: { '@id': `${config.siteUrl}/#${config.identityType}` },
    publisher: { '@id': `${config.siteUrl}/#${config.identityType}` },
    image,
  }
}

export function buildArticleNode(
  config: SiteSeoConfig, post: BlogPostInput, translations: TranslationInput[],
): JsonLdNode {
  const n = buildBlogPostingNode(config, post, translations)
  return { ...n, '@type': 'Article', '@id': (n['@id'] as string).replace('#blogposting', '#article') }
}

export function buildBreadcrumbNode(crumbs: Array<{ name: string; url: string }>): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  }
}

export function buildFaqNode(faq: FaqEntry[]): JsonLdNode {
  return {
    '@type': 'FAQPage',
    mainEntity: faq.map((entry) => ({
      '@type': 'Question',
      name: entry.q,
      acceptedAnswer: { '@type': 'Answer', text: entry.a },
    })),
  }
}

export function buildHowToNode(howTo: NonNullable<SeoExtras['howTo']>): JsonLdNode {
  return {
    '@type': 'HowTo',
    name: howTo.name,
    step: howTo.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
      ...(s.imageUrl ? { image: s.imageUrl } : {}),
    })),
  }
}

export function buildVideoNode(video: VideoObjectExtra): JsonLdNode {
  return {
    '@type': 'VideoObject',
    name: video.name,
    description: video.description,
    thumbnailUrl: video.thumbnailUrl,
    uploadDate: video.uploadDate,
    ...(video.duration ? { duration: video.duration } : {}),
    ...(video.embedUrl ? { embedUrl: video.embedUrl } : {}),
  }
}

function resolveOgImageForBlog(config: SiteSeoConfig, tx: TranslationInput, post: BlogPostInput): string {
  if (tx.seo_extras?.og_image_url) return tx.seo_extras.og_image_url
  if (tx.cover_image_url) return tx.cover_image_url
  if (process.env.NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED !== 'false') {
    return `${config.siteUrl}/og/blog/${tx.locale}/${encodeURIComponent(tx.slug)}`
  }
  return config.defaultOgImageUrl ?? `${config.siteUrl}/og-default.png`
}
