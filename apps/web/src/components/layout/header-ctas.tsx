import type { HeaderLocale, HeaderCtaVariant } from './header-types'
import { YT_CHANNELS } from './header-types'

type Props = {
  variant: HeaderCtaVariant
  locale: HeaderLocale
  t: Record<string, string>
}

export function HeaderCTAs({ variant, locale, t }: Props) {
  const channel = YT_CHANNELS[locale]

  if (variant === 'home') {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <a
          href={channel.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t['header.subscribe']}
          className="font-jetbrains text-white no-underline"
          style={{
            background: '#FF3333',
            padding: '7px 12px',
            fontSize: 12,
            fontWeight: 600,
            transform: 'rotate(-1deg)',
            boxShadow: '0 2px 0 rgba(0,0,0,0.1)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          {channel.flag} {locale === 'pt-BR' ? 'Inscrever' : 'Subscribe'}
        </a>
        <a
          href="/newsletters"
          className="font-jetbrains no-underline"
          style={{
            background: '#FFE37A',
            color: '#1A140C',
            padding: '7px 12px',
            fontSize: 12,
            fontWeight: 600,
            transform: 'rotate(1deg)',
            display: 'inline-block',
            boxShadow: '0 2px 0 rgba(0,0,0,0.1)',
          }}
        >
          ✉ Newsletter
        </a>
      </div>
    )
  }

  if (variant === 'archive') {
    return (
      <div className="shrink-0">
        <a
          href="/newsletters"
          className="font-jetbrains no-underline"
          style={{
            background: 'var(--pb-accent)',
            color: '#FFF',
            border: '1.5px solid var(--pb-accent)',
            padding: '7px 12px',
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            fontWeight: 700,
            display: 'inline-block',
          }}
        >
          ✉ NEWSLETTER
        </a>
      </div>
    )
  }

  return (
    <div className="shrink-0">
      <a
        href="/newsletters"
        className="font-jetbrains no-underline"
        style={{
          background: '#FFE37A',
          color: '#1A140C',
          padding: '7px 12px',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.04em',
          transform: 'rotate(-1deg)',
          display: 'inline-block',
        }}
      >
        {locale === 'pt-BR' ? 'Assinar' : 'Subscribe'}
      </a>
    </div>
  )
}
