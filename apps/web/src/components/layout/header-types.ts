export type HeaderLocale = 'en' | 'pt-BR'
export type HeaderTheme = 'dark' | 'light'
export type HeaderCurrent = 'home' | 'blog' | 'youtube' | 'newsletters' | 'about' | 'contact'
export type HeaderVariant = 'full' | 'reduced'
export type HeaderCtaVariant = 'home' | 'archive' | 'post'

export type GlobalHeaderProps = {
  locale: HeaderLocale
  currentTheme: HeaderTheme
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
  const home = locale === 'pt-BR' ? '/pt' : '/'
  const l = (key: string): string => t[key] ?? key
  const items: NavItem[] = [
    { key: 'home', href: home, label: l('nav.home') },
    { key: 'blog', href: locale === 'pt-BR' ? '/pt/blog' : '/blog', label: l('nav.blog') },
    { key: 'youtube', href: YT_CHANNELS[locale].url, label: l('nav.youtube'), external: true },
    { key: 'newsletters', href: locale === 'pt-BR' ? '/pt/newsletters' : '/newsletters', label: l('nav.newsletters') },
    { key: 'about', href: '/about', label: l('nav.about') },
  ]

  if (variant === 'full') {
    items.push(
      { key: 'contact', href: '/contact', label: l('nav.contact') },
    )
  }

  return items
}
