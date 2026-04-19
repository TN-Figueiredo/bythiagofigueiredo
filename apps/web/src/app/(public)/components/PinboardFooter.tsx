import Link from 'next/link'

type Props = {
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}

export function PinboardFooter({ locale, t }: Props) {
  const year = new Date().getFullYear()
  const blogHref = locale === 'pt-BR' ? '/blog/pt-BR' : '/blog/en'

  return (
    <footer className="border-t border-[--pb-line] bg-[--pb-bg] px-6 py-10 mt-8">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        {/* Brand + tagline */}
        <div>
          <span className="font-fraunces text-pb-ink text-lg" style={{ letterSpacing: '-0.02em' }}>
            by<em>thiago</em><span className="text-pb-accent">.</span>
          </span>
          <p className="text-pb-muted text-xs mt-1">{t['footer.tagline']}</p>
        </div>

        {/* Links */}
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-pb-muted text-sm" aria-label="Footer navigation">
          <Link href={blogHref} className="hover:text-pb-ink transition-colors">{t['footer.blog']}</Link>
          <Link href="/newsletter" className="hover:text-pb-ink transition-colors">{t['footer.newsletter']}</Link>
          <Link href="/contact" className="hover:text-pb-ink transition-colors">{t['footer.contact']}</Link>
          <Link href="/privacy" className="hover:text-pb-ink transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-pb-ink transition-colors">Terms</Link>
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
