export type HeaderLocale = 'en' | 'pt-BR'
export type HeaderTheme = 'dark' | 'light'
export type HeaderCurrent = 'home' | 'writing' | 'videos' | 'newsletters' | 'about' | 'contact'
export type HeaderVariant = 'full' | 'reduced'
export type HeaderCtaVariant = 'home' | 'archive' | 'post'

export type GlobalHeaderProps = {
  locale: HeaderLocale
  currentTheme: HeaderTheme
  current: HeaderCurrent
  variant: HeaderVariant
  ctas: HeaderCtaVariant
  t: Record<string, string>
}

export type NavItem = {
  key: string
  href: string
  label: string
  external?: boolean
}

export const YT_CHANNELS: Record<HeaderLocale, { url: string; flag: string }> = {
  'pt-BR': { url: 'https://youtube.com/@bythiagofigueiredo', flag: '🇧🇷' },
  en: { url: 'https://youtube.com/@thiagofigueiredo', flag: '🇺🇸' },
}

export function buildNavItems(
  locale: HeaderLocale,
  variant: HeaderVariant,
  t: Record<string, string>,
): NavItem[] {
  const home = locale === 'pt-BR' ? '/pt-BR' : '/'
  const l = (key: string): string => t[key] ?? key
  const items: NavItem[] = [
    { key: 'home', href: home, label: l('nav.home') },
    { key: 'writing', href: `/blog/${locale === 'pt-BR' ? 'pt-BR' : 'en'}`, label: l('nav.writing') },
    { key: 'videos', href: YT_CHANNELS[locale].url, label: l('nav.videos'), external: true },
    { key: 'newsletters', href: locale === 'pt-BR' ? '/pt-BR/newsletters' : '/newsletters', label: l('nav.newsletter') },
    { key: 'about', href: '/about', label: l('nav.about') },
  ]

  if (variant === 'full') {
    items.push(
      { key: 'contact', href: '/contact', label: l('nav.contact') },
      { key: 'devSite', href: 'https://dev.bythiagofigueiredo.com', label: l('nav.devSite'), external: true },
    )
  }

  return items
}
