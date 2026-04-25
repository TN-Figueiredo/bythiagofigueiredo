import Link from 'next/link'
import { BrandWordmark } from '@/components/brand/brand-wordmark'
import type { GlobalHeaderProps } from './header-types'
import { buildNavItems } from './header-types'
import { HeaderCTAs } from './header-ctas'
import { ThemeToggle } from './theme-toggle'
import { MobileNavDrawer } from './mobile-nav-drawer'

export function GlobalHeader({ locale, currentTheme, current, variant, ctas, t }: GlobalHeaderProps) {
  const homeHref = locale === 'pt-BR' ? '/pt-BR' : '/'
  const items = buildNavItems(locale, variant, t)

  return (
    <header
      style={{
        position: 'sticky',
        top: 44,
        zIndex: 5,
        background: 'var(--pb-bg)',
        borderBottom: '1px dashed var(--pb-line)',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '14px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        {/* Brand + tagline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <Link href={homeHref} aria-label="by Thiago Figueiredo" className="no-underline">
            <BrandWordmark theme={currentTheme} height={28} className="hidden md:block" />
            <BrandWordmark theme={currentTheme} height={22} className="block md:hidden" />
          </Link>
          <span
            className="font-caveat hidden md:inline-block"
            style={{
              fontSize: 17,
              color: 'var(--pb-accent)',
              transform: 'rotate(-1deg)',
              opacity: 0.85,
              whiteSpace: 'nowrap',
            }}
          >
            — blog + canal —
          </span>
        </div>

        {/* Desktop nav */}
        <nav
          aria-label="Main navigation"
          className="hidden md:flex items-center gap-5"
          style={{ fontSize: 14 }}
        >
          {items.map((item) => {
            const isActive = item.key === current
            const style = {
              color: isActive ? 'var(--pb-ink)' : 'var(--pb-muted)',
              fontWeight: isActive ? 600 : 400,
              borderBottom: isActive ? '2px solid var(--pb-accent)' : '2px solid transparent',
              paddingBottom: 2,
              textDecoration: 'none' as const,
              transition: 'color 0.15s ease, border-color 0.15s ease',
              whiteSpace: 'nowrap' as const,
            }
            if (item.external) {
              return (
                <a
                  key={item.key}
                  href={item.href}
                  target="_blank"
                  rel="noopener"
                  data-active={isActive ? 'true' : undefined}
                  style={style}
                >
                  {item.label}
                  <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 3 }}>↗</span>
                </a>
              )
            }
            return (
              <Link
                key={item.key}
                href={item.href}
                data-active={isActive ? 'true' : undefined}
                style={style}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* CTAs + ThemeToggle (desktop) + Mobile hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div className="hidden md:flex items-center gap-3">
            <HeaderCTAs variant={ctas} locale={locale} t={t} />
            <ThemeToggle currentTheme={currentTheme} />
          </div>
          <MobileNavDrawer
            locale={locale}
            currentTheme={currentTheme}
            current={current}
            variant={variant}
            ctas={ctas}
            t={t}
          />
        </div>
      </div>
    </header>
  )
}
