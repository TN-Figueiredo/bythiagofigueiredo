import type {
  LinktreeConfig,
  NewsletterTypeInfo,
  YouTubeChannelInfo,
  LangSection,
  LangSectionItem,
} from './types'

const LOCALE_META: Record<string, { flag: string; label: string; hand: string; blogLabel: string }> = {
  'pt-BR': { flag: '🇧🇷', label: 'Português', hand: 'em português', blogLabel: 'Blog' },
  'en': { flag: '🇺🇸', label: 'English', hand: 'in english', blogLabel: 'Blog' },
}

export function normalizeLocale(locale: string): string {
  if (locale.startsWith('pt')) return 'pt-BR'
  if (locale.startsWith('en')) return 'en'
  return locale
}

export function localeMatches(itemLocale: string, sectionLocale: string): boolean {
  const normItem = normalizeLocale(itemLocale)
  const normSection = normalizeLocale(sectionLocale)
  return normItem === normSection
}

export function buildLangSections(
  locales: string[],
  newsletters: NewsletterTypeInfo[],
  channels: YouTubeChannelInfo[],
  config: LinktreeConfig,
  primaryDomain: string,
): LangSection[] {
  return locales.map((locale) => {
    const meta = LOCALE_META[normalizeLocale(locale)] ?? {
      flag: '🌐', label: locale, hand: locale, blogLabel: 'Blog',
    }
    const siteUrl = `https://${primaryDomain}`
    const isPortuguese = locale.startsWith('pt')
    const prefix = isPortuguese ? '/pt' : ''
    const blogDesc = isPortuguese ? config.blog_desc_pt : config.blog_desc_en

    const items: LangSectionItem[] = []

    items.push({
      id: `blog-${locale}`,
      type: 'blog',
      label: meta.blogLabel,
      desc: blogDesc || (isPortuguese ? 'Artigos' : 'Articles'),
      url: `${siteUrl}${prefix}/blog`,
      icon: 'blog',
    })

    for (const nl of newsletters.filter((n) => localeMatches(n.locale, locale))) {
      items.push({
        id: `nl-${nl.slug}`,
        type: 'newsletter',
        label: nl.name,
        desc: nl.cadenceLabel ? `Newsletter ${nl.cadenceLabel}` : 'Newsletter',
        url: `${siteUrl}${prefix}/newsletters/${nl.slug}`,
        icon: 'mail',
      })
    }

    for (const ch of channels.filter((c) => localeMatches(c.locale, locale))) {
      const handle = ch.handle.replace(/^@/, '')
      items.push({
        id: `yt-${handle}`,
        type: 'youtube',
        label: 'YouTube',
        desc: `@${handle}${ch.scheduleLabel ? ` · ${ch.scheduleLabel}` : ''}`,
        url: `https://youtube.com/@${handle}`,
        icon: 'youtube',
        subscriberCount: ch.subscriberCount,
      })
    }

    return { locale, flag: meta.flag, label: meta.label, hand: meta.hand, items }
  })
}
