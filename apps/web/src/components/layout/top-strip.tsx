'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const CONTENT_PREFIXES = ['/blog/', '/campaigns/']

function isContentPath(bare: string): boolean {
  return CONTENT_PREFIXES.some((p) => bare.startsWith(p))
}

export function TopStrip() {
  const pathname = usePathname()
  const isPt = pathname === '/pt' || pathname.startsWith('/pt/')

  const barePath = isPt ? (pathname.slice(3) || '/') : pathname

  const switchedPath = isContentPath(barePath)
    ? (isPt ? '/' : '/pt')
    : (isPt ? barePath : `/pt${pathname}`)

  return (
    <div
      className="top-strip-bar"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999,
        height: 44,
        background: 'color-mix(in srgb, var(--pb-bg) 94%, transparent)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--pb-line)',
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
          background: 'color-mix(in srgb, var(--pb-ink) 8%, transparent)',
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
              background: 'var(--pb-ink)',
              color: 'var(--pb-bg)',
              borderRadius: 999,
              padding: '4px 10px',
              fontWeight: 600,
            }}
          >
            PT
          </span>
        ) : (
          <Link
            href={switchedPath}
            hrefLang="pt"
            style={{
              color: 'var(--pb-ink)',
              borderRadius: 999,
              padding: '4px 10px',
              textDecoration: 'none',
              opacity: 0.6,
            }}
          >
            PT
          </Link>
        )}
        {!isPt ? (
          <span
            data-active="true"
            style={{
              background: 'var(--pb-ink)',
              color: 'var(--pb-bg)',
              borderRadius: 999,
              padding: '4px 10px',
              fontWeight: 600,
            }}
          >
            EN
          </span>
        ) : (
          <Link
            href={switchedPath}
            hrefLang="en"
            style={{
              color: 'var(--pb-ink)',
              borderRadius: 999,
              padding: '4px 10px',
              textDecoration: 'none',
              opacity: 0.6,
            }}
          >
            EN
          </Link>
        )}
      </div>
    </div>
  )
}
