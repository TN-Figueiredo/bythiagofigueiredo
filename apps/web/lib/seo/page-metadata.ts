import type { Metadata } from 'next'
import type { SiteSeoConfig } from './config'
import { localePath, hreflangCode } from '@/lib/i18n/locale-path'

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

export function generateRootMetadata(config: SiteSeoConfig, locale?: string): Metadata {
  const languages: Record<string, string> = {}
  for (const loc of config.supportedLocales) {
    languages[hreflangCode(loc)] = localePath('/', loc)
  }
  languages['x-default'] = localePath('/', config.defaultLocale)
  const effectiveLocale = locale ?? config.defaultLocale
  const desc = config.personIdentity
    ? effectiveLocale === 'pt-BR'
      ? `Blog, newsletters e projetos de ${config.personIdentity.name}. Engenharia de software, produto e construção em público.`
      : `Blog, newsletters and projects by ${config.personIdentity.name}. Software engineering, product and building in public.`
    : `${config.siteName} — editorial hub.`
  const ogImage = config.defaultOgImageUrl ?? `${config.siteUrl}/og-default.png`
  return {
    ...baseMetadata(config),
    title: { default: config.siteName, template: `%s — ${config.siteName}` },
    description: desc,
    alternates: { canonical: localePath('/', effectiveLocale), languages },
    openGraph: {
      ...baseMetadata(config).openGraph,
      type: 'website',
      url: config.siteUrl,
      title: config.siteName,
      description: desc,
      locale: effectiveLocale.replace('-', '_'),
      images: [{ url: ogImage, width: 1200, height: 630, alt: config.siteName }],
    },
  }
}

export function generateBlogIndexMetadata(config: SiteSeoConfig, locale: string): Metadata {
  const languages: Record<string, string> = {}
  for (const loc of config.supportedLocales) {
    languages[hreflangCode(loc)] = localePath(config.contentPaths.blog, loc)
  }
  languages['x-default'] = localePath(config.contentPaths.blog, config.defaultLocale)
  const desc = locale === 'pt-BR'
    ? `Artigos sobre engenharia de software, produto e carreira por ${config.siteName}.`
    : `Articles on software engineering, product and career by ${config.siteName}.`
  const ogImage = config.defaultOgImageUrl ?? `${config.siteUrl}/og-default.png`
  return {
    ...baseMetadata(config),
    title: 'Blog',
    description: desc,
    alternates: {
      canonical: localePath(config.contentPaths.blog, locale),
      languages,
    },
    openGraph: {
      ...baseMetadata(config).openGraph,
      type: 'website',
      url: `${config.siteUrl}${localePath(config.contentPaths.blog, locale)}`,
      title: `Blog — ${config.siteName}`,
      description: desc,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `Blog — ${config.siteName}` }],
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
    languages[hreflangCode(t.locale)] = localePath(`${config.contentPaths.blog}/${encodeURIComponent(t.slug)}`, t.locale)
  }
  const defaultTx = translations.find((t) => t.locale === config.defaultLocale) ?? tx
  languages['x-default'] = localePath(`${config.contentPaths.blog}/${encodeURIComponent(defaultTx.slug)}`, defaultTx.locale)
  const ogImage = resolveOgImage(config, tx, post)
  return {
    ...baseMetadata(config),
    title: tx.title,
    description: tx.excerpt ?? undefined,
    alternates: {
      canonical: localePath(`${config.contentPaths.blog}/${encodeURIComponent(tx.slug)}`, tx.locale),
      languages,
    },
    openGraph: {
      ...baseMetadata(config).openGraph,
      type: 'article',
      title: tx.title,
      description: tx.excerpt ?? undefined,
      url: `${config.siteUrl}${localePath(`${config.contentPaths.blog}/${encodeURIComponent(tx.slug)}`, tx.locale)}`,
      publishedTime: post.published_at.toISOString(),
      modifiedTime: post.updated_at.toISOString(),
      images: [{ url: ogImage, width: 1200, height: 630, alt: tx.title }],
    },
  }
}

export function generateCampaignMetadata(config: SiteSeoConfig, c: CampaignInput): Metadata {
  const ogImage =
    c.og_image_url ?? `${config.siteUrl}/og/campaigns/${c.locale}/${encodeURIComponent(c.slug)}`
  const languages: Record<string, string> = {}
  for (const loc of config.supportedLocales) {
    languages[hreflangCode(loc)] = localePath(`${config.contentPaths.campaigns}/${encodeURIComponent(c.slug)}`, loc)
  }
  languages['x-default'] = localePath(`${config.contentPaths.campaigns}/${encodeURIComponent(c.slug)}`, config.defaultLocale)
  return {
    ...baseMetadata(config),
    title: c.meta_title,
    description: c.meta_description,
    alternates: {
      canonical: localePath(`${config.contentPaths.campaigns}/${encodeURIComponent(c.slug)}`, c.locale),
      languages,
    },
    openGraph: {
      ...baseMetadata(config).openGraph,
      type: 'article',
      title: c.meta_title,
      description: c.meta_description,
      url: `${config.siteUrl}${localePath(`${config.contentPaths.campaigns}/${encodeURIComponent(c.slug)}`, c.locale)}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: c.meta_title }],
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
  const languages: Record<string, string> = {}
  for (const l of config.supportedLocales) {
    languages[hreflangCode(l)] = localePath(`/${type}`, l)
  }
  languages['x-default'] = localePath(`/${type}`, config.defaultLocale)
  const ogImage = config.defaultOgImageUrl ?? `${config.siteUrl}/og-default.png`
  return {
    ...baseMetadata(config),
    title: titles[type][loc],
    description: descs[type][loc],
    alternates: { canonical: localePath(`/${type}`, locale), languages },
    openGraph: {
      ...baseMetadata(config).openGraph,
      type: 'website',
      url: `${config.siteUrl}${localePath(`/${type}`, locale)}`,
      title: `${titles[type][loc]} — ${config.siteName}`,
      description: descs[type][loc],
      images: [{ url: ogImage, width: 1200, height: 630, alt: titles[type][loc] }],
    },
    robots: { index: true, follow: true },
  }
}

export function generateContactMetadata(config: SiteSeoConfig, locale: string): Metadata {
  const t =
    locale === 'en'
      ? { title: 'Contact', desc: `Get in touch with ${config.siteName}.` }
      : { title: 'Fale comigo', desc: `Entre em contato com ${config.siteName}.` }
  const languages: Record<string, string> = {}
  for (const l of config.supportedLocales) {
    languages[hreflangCode(l)] = localePath('/contact', l)
  }
  languages['x-default'] = localePath('/contact', config.defaultLocale)
  const ogImage = config.defaultOgImageUrl ?? `${config.siteUrl}/og-default.png`
  return {
    ...baseMetadata(config),
    title: t.title,
    description: t.desc,
    alternates: { canonical: localePath('/contact', locale), languages },
    openGraph: {
      ...baseMetadata(config).openGraph,
      type: 'website',
      url: `${config.siteUrl}${localePath('/contact', locale)}`,
      title: `${t.title} — ${config.siteName}`,
      description: t.desc,
      images: [{ url: ogImage, width: 1200, height: 630, alt: t.title }],
    },
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
  const languages: Record<string, string> = {}
  for (const l of config.supportedLocales) {
    languages[hreflangCode(l)] = localePath('/newsletter/archive', l)
  }
  languages['x-default'] = localePath('/newsletter/archive', config.defaultLocale)
  const ogImage = config.defaultOgImageUrl ?? `${config.siteUrl}/og-default.png`
  return {
    ...baseMetadata(config),
    title: t.title,
    description: t.desc,
    alternates: { canonical: localePath('/newsletter/archive', locale), languages },
    openGraph: {
      ...baseMetadata(config).openGraph,
      type: 'website',
      url: `${config.siteUrl}${localePath('/newsletter/archive', locale)}`,
      title: `${t.title} — ${config.siteName}`,
      description: t.desc,
      images: [{ url: ogImage, width: 1200, height: 630, alt: t.title }],
    },
    robots: { index: true, follow: true },
  }
}

export function generateNewsletterDetailMetadata(
  config: SiteSeoConfig,
  subject: string,
  editionId?: string,
  locale?: string,
): Metadata {
  const loc = locale ?? config.defaultLocale
  const ogImage = config.defaultOgImageUrl ?? `${config.siteUrl}/og-default.png`
  const canonical = editionId ? localePath(`/newsletter/archive/${editionId}`, loc) : undefined
  const languages: Record<string, string> = {}
  if (editionId) {
    for (const l of config.supportedLocales) {
      languages[hreflangCode(l)] = localePath(`/newsletter/archive/${editionId}`, l)
    }
    languages['x-default'] = localePath(`/newsletter/archive/${editionId}`, config.defaultLocale)
  }
  return {
    ...baseMetadata(config),
    title: subject,
    description: subject,
    ...(canonical ? { alternates: { canonical, ...(editionId ? { languages } : {}) } } : {}),
    openGraph: {
      ...baseMetadata(config).openGraph,
      type: 'article',
      title: subject,
      description: subject,
      ...(canonical ? { url: `${config.siteUrl}${canonical}` } : {}),
      images: [{ url: ogImage, width: 1200, height: 630, alt: subject }],
    },
    robots: { index: true, follow: true },
  }
}

export function generateNewsletterLandingMetadata(
  config: SiteSeoConfig,
  type: {
    slug: string
    name: string
    description: string | null
    tagline: string | null
    locale: string
    color: string
    og_image_url: string | null
  },
): Metadata {
  const description = type.description ?? type.tagline ?? `Newsletter — ${config.siteName}`
  const ogLocale = type.locale === 'pt-BR' ? 'pt_BR' : 'en_US'

  const ogImage = type.og_image_url
    ?? (process.env.NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED !== 'false'
      ? `${config.siteUrl}/og/newsletter/${type.slug}`
      : config.defaultOgImageUrl ?? `${config.siteUrl}/og-default.png`)

  const languages: Record<string, string> = {}
  for (const loc of config.supportedLocales) {
    languages[hreflangCode(loc)] = localePath(`/newsletters/${type.slug}`, loc)
  }
  languages['x-default'] = localePath(`/newsletters/${type.slug}`, config.defaultLocale)
  return {
    ...baseMetadata(config),
    title: `${type.name} — Newsletter`,
    description,
    alternates: {
      canonical: localePath(`/newsletters/${type.slug}`, type.locale),
      languages,
    },
    openGraph: {
      ...baseMetadata(config).openGraph,
      title: type.name,
      description,
      type: 'website',
      locale: ogLocale,
      url: `${config.siteUrl}${localePath(`/newsletters/${type.slug}`, type.locale)}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: type.name }],
    },
  }
}

export function generateAboutMetadata(
  config: SiteSeoConfig,
  subtitle: string | null,
  aboutPhotoUrl: string | null,
  locale: string,
  availableLocales: string[],
): Metadata {
  const title = locale === 'pt-BR'
    ? `Sobre — ${config.siteName}`
    : `About — ${config.siteName}`
  const description = subtitle ?? `About ${config.siteName}`
  const ogImage = config.defaultOgImageUrl ?? `${config.siteUrl}/og-default.png`

  const languages: Record<string, string> = {}
  for (const loc of availableLocales) {
    languages[hreflangCode(loc)] = localePath('/about', loc)
  }
  if (availableLocales.length > 0) {
    const defaultLoc = availableLocales.includes(config.defaultLocale)
      ? config.defaultLocale
      : availableLocales[0]!
    languages['x-default'] = localePath('/about', defaultLoc)
  }

  return {
    ...baseMetadata(config),
    title,
    description,
    openGraph: {
      ...baseMetadata(config).openGraph,
      type: 'profile',
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      url: `${config.siteUrl}${localePath('/about', locale)}`,
    },
    alternates: {
      canonical: localePath('/about', locale),
      languages,
    },
  }
}

export function generateYoutubeMetadata(
  config: SiteSeoConfig,
  locale: string,
): Metadata {
  const isEn = locale === 'en'
  const title = isEn ? 'Videos' : 'Vídeos'
  const description = isEn
    ? 'Live-coding, dev setup, career insights — two YouTube channels, one head.'
    : 'Live-coding, dev setup, carreira — dois canais no YouTube, uma cabeça.'

  return {
    title: `${title} — ${config.siteName}`,
    description,
    alternates: {
      canonical: `${config.siteUrl}/youtube`,
      languages: {
        'pt-BR': `${config.siteUrl}/youtube`,
        en: `${config.siteUrl}/youtube`,
      },
    },
    openGraph: {
      title: `${title} — ${config.siteName}`,
      description,
      url: `${config.siteUrl}/youtube`,
      siteName: config.siteName,
      type: 'website',
      images: [{ url: config.defaultOgImageUrl ?? `${config.siteUrl}/og-default.png` }],
    },
    twitter: {
      card: 'summary_large_image',
      site: config.twitterHandle ? `@${config.twitterHandle}` : undefined,
    },
  }
}

export function generateLinktreeMetadata(
  config: SiteSeoConfig,
  goDomain: string,
  personName: string,
): Metadata {
  const goUrl = `https://${goDomain}`
  const title = `Links — ${config.siteName}`
  const description = `Todos os links de ${personName} — blog, YouTube, newsletter e mais.`

  const languages: Record<string, string> = { 'x-default': goUrl }
  for (const loc of config.supportedLocales) {
    languages[hreflangCode(loc)] = goUrl
  }

  return {
    ...baseMetadata(config),
    metadataBase: new URL(goUrl),
    title,
    description,
    alternates: { canonical: goUrl, languages },
    openGraph: {
      ...baseMetadata(config).openGraph,
      type: 'website',
      url: goUrl,
      title,
      description,
      images: [{ url: `${goUrl}/og/linktree`, width: 1200, height: 630, alt: title }],
      locale: config.defaultLocale.replace('-', '_'),
      alternateLocale: config.supportedLocales
        .filter((l) => l !== config.defaultLocale)
        .map((l) => l.replace('-', '_')),
    },
    robots: { index: true, follow: true },
    other: {
      'color-scheme': 'dark light',
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-title': 'TF Links',
      'apple-mobile-web-app-status-bar-style': 'black-translucent',
    },
    manifest: `${config.siteUrl}/manifest.webmanifest`,
    icons: {
      icon: `${config.siteUrl}/icon.svg`,
      apple: `${config.siteUrl}/apple-icon.svg`,
    },
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
