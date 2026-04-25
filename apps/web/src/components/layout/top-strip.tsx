import Link from 'next/link'
import type { HeaderLocale } from './header-types'

type Props = {
  locale: HeaderLocale
}

export function TopStrip({ locale }: Props) {
  const isPt = locale === 'pt-BR'

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999,
        height: 44,
        background: 'rgba(20,18,16,0.94)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 28px',
      }}
    >
      <div
        data-testid="lang-pill"
        className="font-jetbrains"
        style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 999,
          padding: 3,
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        {isPt ? (
          <span
            data-active="true"
            style={{
              background: '#F2EBDB',
              color: '#141210',
              borderRadius: 999,
              padding: '4px 10px',
              fontWeight: 600,
            }}
          >
            PT
          </span>
        ) : (
          <Link
            href="/pt"
            hrefLang="pt"
            style={{
              color: '#F2EBDB',
              borderRadius: 999,
              padding: '4px 10px',
              textDecoration: 'none',
            }}
          >
            PT
          </Link>
        )}
        {!isPt ? (
          <span
            data-active="true"
            style={{
              background: '#F2EBDB',
              color: '#141210',
              borderRadius: 999,
              padding: '4px 10px',
              fontWeight: 600,
            }}
          >
            EN
          </span>
        ) : (
          <Link
            href="/"
            hrefLang="en"
            style={{
              color: '#F2EBDB',
              borderRadius: 999,
              padding: '4px 10px',
              textDecoration: 'none',
            }}
          >
            EN
          </Link>
        )}
      </div>
    </div>
  )
}
