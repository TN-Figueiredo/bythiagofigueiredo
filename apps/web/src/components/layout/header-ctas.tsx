import type { HeaderLocale, HeaderCtaVariant } from './header-types'
import { localePath } from '@/lib/i18n/locale-path'

type Props = {
  variant: HeaderCtaVariant
  locale: HeaderLocale
  t: Record<string, string>
  channelUrl?: string | null
}

export function HeaderCTAs({ variant, locale, t, channelUrl }: Props) {
  if (variant === 'home') {
    return (
      <div className="flex items-center gap-2 shrink-0">
        {channelUrl && (
          <a
            href={`${channelUrl}?sub_confirmation=1`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t['header.subscribe']}
            className="font-jetbrains no-underline"
            style={{
              background: 'var(--pb-yt)',
              color: '#FFF',
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
            {locale === 'pt-BR' ? 'Inscrever' : 'Subscribe'}
          </a>
        )}
        <a
          href={localePath('/newsletters', locale)}
          className="font-jetbrains no-underline"
          style={{
            background: 'var(--pb-marker)',
            color: 'var(--pb-ink-on-accent)',
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
          href={localePath('/newsletters', locale)}
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
        href={localePath('/newsletters', locale)}
        className="font-jetbrains no-underline"
        style={{
          background: 'var(--pb-marker)',
          color: 'var(--pb-ink-on-accent)',
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
