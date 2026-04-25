import Link from 'next/link'
import { localePath } from '@/lib/i18n/locale-path'

type Props = {
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}

export function PinboardFooter({ locale, t }: Props) {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-[--pb-line] bg-[--pb-bg] mt-8" style={{ padding: '40px 28px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        {/* Brand + tagline */}
        <div>
          <span className="font-fraunces text-pb-ink text-lg" style={{ letterSpacing: '-0.02em' }}>
            by<em>thiago</em><span className="text-pb-accent">.</span>
          </span>
          <p className="text-pb-muted text-xs mt-1">{t['footer.tagline']}</p>
        </div>

        {/* Links */}
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-pb-muted text-sm" aria-label="Footer navigation">
          <Link href={localePath('/blog', locale)} className="hover:text-pb-ink transition-colors">{t['footer.blog']}</Link>
          <Link href={localePath('/newsletters', locale)} className="hover:text-pb-ink transition-colors">{t['footer.newsletter']}</Link>
          <Link href={localePath('/contact', locale)} className="hover:text-pb-ink transition-colors">{t['footer.contact']}</Link>
          <Link href={localePath('/privacy', locale)} className="hover:text-pb-ink transition-colors">{locale === 'pt-BR' ? 'Privacidade' : 'Privacy'}</Link>
          <Link href={localePath('/terms', locale)} className="hover:text-pb-ink transition-colors">{locale === 'pt-BR' ? 'Termos' : 'Terms'}</Link>
          <a href="/feed.xml" className="hover:text-pb-ink transition-colors" title="RSS Feed">RSS</a>
          <a href="https://dev.bythiagofigueiredo.com" target="_blank" rel="noopener" className="hover:text-pb-ink transition-colors opacity-60">Dev ↗</a>
        </nav>

        {/* Copyright */}
        <p className="text-pb-faint text-xs font-mono">
          {(t['footer.copyright'] ?? '').replace('{year}', String(year))} · {t['footer.madeIn'] ?? ''}
        </p>
      </div>
    </footer>
  )
}
