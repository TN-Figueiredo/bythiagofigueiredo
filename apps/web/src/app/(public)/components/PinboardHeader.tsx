import Link from 'next/link'
import { ThemeToggle } from './ThemeToggle'

type Props = {
  locale: 'en' | 'pt-BR'
  currentTheme: 'dark' | 'light'
  t: Record<string, string>
}

const YT_CHANNELS = {
  en: 'https://www.youtube.com/@byThiagoFigueiredo',
  'pt-BR': 'https://www.youtube.com/@tnFigueiredoTV',
}

export function PinboardHeader({ locale, currentTheme, t }: Props) {
  const altLocale = locale === 'en' ? 'pt-BR' : 'en'
  const altHref = locale === 'en' ? '/pt-BR' : '/'

  return (
    <header className="sticky top-0 z-40 border-b border-[--pb-line] bg-[--pb-bg]/90 backdrop-blur-sm">
      {/* Top strip: lang + theme */}
      <div className="flex items-center justify-end gap-3 px-6 py-1 text-xs text-pb-muted border-b border-[--pb-line]">
        <Link href={altHref} className="hover:text-pb-ink transition-colors font-mono" hrefLang={altLocale}>
          {altLocale === 'pt-BR' ? '🇧🇷 PT-BR' : '🌎 EN'}
        </Link>
        <ThemeToggle currentTheme={currentTheme} />
      </div>

      {/* Main header row */}
      <div className="flex items-center justify-between px-6 py-3 gap-4">
        {/* Brand */}
        <Link href={locale === 'pt-BR' ? '/pt-BR' : '/'} className="shrink-0">
          <span
            className="font-fraunces text-pb-ink text-xl"
            style={{ letterSpacing: '-0.02em' }}
          >
            by<em>thiago</em>
            <span className="text-pb-accent">.</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-5 text-sm text-pb-muted font-sans" aria-label="Main navigation">
          <Link href={locale === 'pt-BR' ? '/pt-BR' : '/'} className="hover:text-pb-ink transition-colors">{t['nav.home']}</Link>
          <Link href={locale === 'pt-BR' ? '/blog/pt-BR' : '/blog/en'} className="hover:text-pb-ink transition-colors">{t['nav.writing']}</Link>
          <Link href={YT_CHANNELS[locale]} className="hover:text-pb-ink transition-colors" target="_blank" rel="noopener">{t['nav.videos']}</Link>
          <Link href={locale === 'pt-BR' ? '/pt-BR/newsletters' : '/newsletters'} className="hover:text-pb-ink transition-colors">{t['nav.newsletter']}</Link>
          <Link href="/contact" className="hover:text-pb-ink transition-colors">{t['nav.contact']}</Link>
          <a href="https://dev.bythiagofigueiredo.com" className="hover:text-pb-ink transition-colors opacity-60" target="_blank" rel="noopener">
            {t['nav.devSite']} ↗
          </a>
        </nav>

        {/* CTAs */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <a
            href={YT_CHANNELS[locale]}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t['header.subscribe']}
            className="bg-pb-yt text-white text-xs font-mono font-semibold px-3 py-1.5 rounded"
            style={{ transform: 'rotate(-1deg)', display: 'inline-block' }}
          >
            ▶ YouTube
          </a>
          <a
            href="#newsletter"
            className="text-xs font-mono font-semibold px-3 py-1.5 rounded"
            style={{ background: 'var(--pb-marker)', color: '#161208' }}
          >
            ✉ Newsletter
          </a>
        </div>
      </div>
    </header>
  )
}
