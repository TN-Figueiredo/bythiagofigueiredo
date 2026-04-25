import type { Metadata } from 'next'
import type { SiteSeoConfig } from './config'
import { localePath } from '@/lib/i18n/locale-path'

type BlogPostInput = Parameters<typeof import('./jsonld/builders').buildBlogPostingNode>[1]
type TranslationInput = Parameters<typeof import('./jsonld/builders').buildBlogPostingNode>[2][number]
type CampaignInput = {
  slug: string
  locale: string
  meta_title: string
  meta_description: string
  og_image_url?: string | null
}

function baseMetadata(config: SiteSeoConfig): Metadata {
  return {
    metadataBase: new URL(config.siteUrl),
    openGraph: {
      siteName: config.siteName,
      locale: config.defaultLocale.replace('-', '_'),
    },
    ...(config.twitterHandle
      ? {
          twitter: {
            site: `@${config.twitterHandle}`,
            creator: `@${config.twitterHandle}`,
            card: 'summary_large_image',
          },
        }
      : {}),
  }
}

export function generateRootMetadata(config: SiteSeoConfig): Metadata {
  return {
    ...baseMetadata(config),
    title: { default: config.siteName, template: `%s — ${config.siteName}` },
    description: config.personIdentity
      ? `Hub de ${config.personIdentity.name}. Build in public, learn out loud.`
      : `${config.siteName} — conteúdo editorial.`,
    alternates: { canonical: '/' },
  }
}

export function generateBlogIndexMetadata(config: SiteSeoConfig, locale: string): Metadata {
  const languages: Record<string, string> = {}
  for (const loc of config.supportedLocales) {
    languages[loc] = `${config.contentPaths.blog}/${loc}`
  }
  languages['x-default'] = `${config.contentPaths.blog}/${config.defaultLocale}`
  return {
    ...baseMetadata(config),
    title: 'Blog',
    description: `Últimos posts de ${config.siteName}.`,
    alternates: {
      canonical: `${config.contentPaths.blog}/${locale}`,
      languages,
    },
  }
}

export function generateBlogPostMetadata(
  config: SiteSeoConfig,
  post: BlogPostInput,
  translations: TranslationInput[],
): Metadata {
  const tx = translations.find((t) => t.title === post.translation.title) ?? translations[0]
  if (!tx) throw new Error('generateBlogPostMetadata: no translation')
  const languages: Record<string, string> = {}
  for (const t of translations) {
    languages[t.locale] = `${config.contentPaths.blog}/${t.locale}/${encodeURIComponent(t.slug)}`
  }
  const defaultTx = translations.find((t) => t.locale === config.defaultLocale) ?? tx
  languages['x-default'] = `${config.contentPaths.blog}/${defaultTx.locale}/${encodeURIComponent(defaultTx.slug)}`
  const ogImage = resolveOgImage(config, tx, post)
  return {
    ...baseMetadata(config),
    title: tx.title,
    description: tx.excerpt ?? undefined,
    alternates: {
      canonical: `${config.contentPaths.blog}/${tx.locale}/${encodeURIComponent(tx.slug)}`,
      languages,
    },
    openGraph: {
      ...baseMetadata(config).openGraph,
      type: 'article',
      publishedTime: post.published_at.toISOString(),
      modifiedTime: post.updated_at.toISOString(),
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
  }
}

export function generateCampaignMetadata(config: SiteSeoConfig, c: CampaignInput): Metadata {
  const ogImage =
    c.og_image_url ?? `${config.siteUrl}/og/campaigns/${c.locale}/${encodeURIComponent(c.slug)}`
  return {
    ...baseMetadata(config),
    title: c.meta_title,
    description: c.meta_description,
    alternates: {
      canonical: localePath(`${config.contentPaths.campaigns}/${encodeURIComponent(c.slug)}`, c.locale),
    },
    openGraph: {
      ...baseMetadata(config).openGraph,
      type: 'article',
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
  }
}

export function generateLegalMetadata(
  config: SiteSeoConfig,
  type: 'privacy' | 'terms',
  locale: string,
): Metadata {
  const titles = {
    privacy: { 'pt-BR': 'Política de Privacidade', en: 'Privacy Policy' },
    terms: { 'pt-BR': 'Termos de Uso', en: 'Terms of Use' },
  }
  const descs = {
    privacy: { 'pt-BR': 'LGPD — dados, direitos, cookies.', en: 'GDPR/LGPD — data, rights, cookies.' },
    terms: { 'pt-BR': 'Termos de uso.', en: 'Terms of use.' },
  }
  const loc = (locale === 'en' ? 'en' : 'pt-BR') as 'pt-BR' | 'en'
  return {
    ...baseMetadata(config),
    title: titles[type][loc],
    description: descs[type][loc],
    alternates: { canonical: `/${type}` },
    robots: { index: true, follow: true },
  }
}

export function generateContactMetadata(config: SiteSeoConfig, locale: string): Metadata {
  const t =
    locale === 'en'
      ? { title: 'Contact', desc: `Get in touch with ${config.siteName}.` }
      : { title: 'Fale comigo', desc: `Entre em contato com ${config.siteName}.` }
  return {
    ...baseMetadata(config),
    title: t.title,
    description: t.desc,
    alternates: { canonical: '/contact' },
    robots: { index: true, follow: true },
  }
}

export function generateNoindexMetadata(config: SiteSeoConfig): Metadata {
  return {
    ...baseMetadata(config),
    robots: { index: false, follow: false },
  }
}

export function generateNewsletterArchiveMetadata(
  config: SiteSeoConfig,
  locale: string,
): Metadata {
  const t = locale === 'en'
    ? { title: 'Newsletter Archive', desc: `Past editions from ${config.siteName}.` }
    : { title: 'Arquivo de Newsletters', desc: `Edições anteriores de ${config.siteName}.` }
  return {
    ...baseMetadata(config),
    title: t.title,
    description: t.desc,
    alternates: { canonical: '/newsletter/archive' },
    robots: { index: true, follow: true },
  }
}

export function generateNewsletterDetailMetadata(
  config: SiteSeoConfig,
  subject: string,
): Metadata {
  return {
    ...baseMetadata(config),
    title: subject,
    robots: { index: true, follow: true },
  }
}

function resolveOgImage(
  config: SiteSeoConfig,
  tx: TranslationInput,
  post: BlogPostInput,
): string {
  void post
  if (tx.seo_extras?.og_image_url) return tx.seo_extras.og_image_url
  if (tx.cover_image_url) return tx.cover_image_url
  if (process.env.NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED !== 'false') {
    return `${config.siteUrl}/og/blog/${tx.locale}/${encodeURIComponent(tx.slug)}`
  }
  return config.defaultOgImageUrl ?? `${config.siteUrl}/og-default.png`
}
