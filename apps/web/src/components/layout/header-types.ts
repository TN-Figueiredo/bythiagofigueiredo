import { localePath } from '@/lib/i18n/locale-path'

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
  const l = (key: string): string => t[key] ?? key
  const items: NavItem[] = [
    { key: 'home', href: localePath('/', locale), label: l('nav.home') },
    { key: 'blog', href: localePath('/blog', locale), label: l('nav.blog') },
    { key: 'youtube', href: localePath('/youtube', locale), label: l('nav.youtube') },
    { key: 'newsletters', href: localePath('/newsletters', locale), label: l('nav.newsletters') },
    { key: 'about', href: localePath('/about', locale), label: l('nav.about') },
  ]

  if (variant === 'full') {
    items.push(
      { key: 'contact', href: localePath('/contact', locale), label: l('nav.contact') },
    )
  }

  return items
}
