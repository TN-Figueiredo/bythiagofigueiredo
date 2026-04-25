'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { HeaderLocale, HeaderTheme, HeaderCurrent, HeaderVariant, HeaderCtaVariant } from './header-types'
import { buildNavItems } from './header-types'
import { HeaderCTAs } from './header-ctas'
import { ThemeToggle } from './theme-toggle'

type Props = {
  locale: HeaderLocale
  currentTheme: HeaderTheme
  current: HeaderCurrent
  variant: HeaderVariant
  ctas: HeaderCtaVariant
  t: Record<string, string>
}

export function MobileNavDrawer({ locale, currentTheme, current, variant, ctas, t }: Props) {
  const [open, setOpen] = useState(false)
  const items = buildNavItems(locale, variant, t)

  return (
    <>
      <div className="flex items-center gap-2 md:hidden">
        <ThemeToggle currentTheme={currentTheme} size={28} />
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          style={{
            width: 28,
            height: 28,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
            gap: 4,
            padding: 2,
          }}
        >
          <span style={{ width: 20, height: 2, background: 'var(--pb-ink)', borderRadius: 1 }} />
          <span style={{ width: 20, height: 2, background: 'var(--pb-ink)', borderRadius: 1 }} />
          <span style={{ width: 14, height: 2, background: 'var(--pb-ink)', borderRadius: 1 }} />
        </button>
      </div>

      {open && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            background: 'var(--pb-bg)',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 28px', height: 44, marginTop: 44 }}>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              style={{
                width: 36,
                height: 36,
                background: 'transparent',
                border: '1px dashed var(--pb-line)',
                borderRadius: 6,
                cursor: 'pointer',
                color: 'var(--pb-ink)',
                fontSize: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ padding: '0 28px 28px' }}>
            <div
              className="font-caveat"
              style={{ fontSize: 17, color: 'var(--pb-accent)', opacity: 0.85, transform: 'rotate(-1deg)', marginBottom: 24 }}
            >
              — blog + canal —
            </div>

            <nav aria-label="Mobile navigation">
              {items.map((item) => {
                const isActive = item.key === current
                const style = {
                  display: 'flex' as const,
                  alignItems: 'center' as const,
                  gap: 4,
                  padding: '14px 0',
                  paddingLeft: isActive ? 14 : 0,
                  borderLeft: isActive ? '3px solid var(--pb-accent)' : '3px solid transparent',
                  color: isActive ? 'var(--pb-ink)' : 'var(--pb-muted)',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 15,
                  textDecoration: 'none' as const,
                  transition: 'color 0.15s ease',
                }
                return (
                  <div key={item.key} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {item.external ? (
                      <a
                        href={item.href}
                        data-active={isActive ? 'true' : undefined}
                        target="_blank"
                        rel="noopener"
                        style={style}
                      >
                        {item.label}<span style={{ fontSize: 10, opacity: 0.7 }}>↗</span>
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        data-active={isActive ? 'true' : undefined}
                        onClick={() => setOpen(false)}
                        style={style}
                      >
                        {item.label}
                      </Link>
                    )}
                  </div>
                )
              })}
            </nav>

            <div style={{ borderTop: '1px dashed var(--pb-line)', marginTop: 16, paddingTop: 16 }}>
              <HeaderCTAs variant={ctas} locale={locale} t={t} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
