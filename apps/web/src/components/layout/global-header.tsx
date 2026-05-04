import Link from 'next/link'
import { BrandWordmark } from '@/components/brand/brand-wordmark'
import type { GlobalHeaderProps } from './header-types'
import { buildNavItems } from './header-types'
import { DesktopNav } from './desktop-nav'
import { HeaderCTAs } from './header-ctas'
import { ThemeToggle } from './theme-toggle'
import { MobileNavDrawer } from './mobile-nav-drawer'

export function GlobalHeader({ locale, currentTheme, variant, ctas, t }: GlobalHeaderProps) {
  const homeHref = locale === 'pt-BR' ? '/pt' : '/'
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
        className="px-[18px] md:px-7"
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          paddingTop: 14,
          paddingBottom: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <Link href={homeHref} aria-label="by Thiago Figueiredo" className="no-underline">
            <span className="hidden md:inline-block"><BrandWordmark theme={currentTheme} size={22} /></span>
            <span className="inline-block md:hidden"><BrandWordmark theme={currentTheme} size={18} /></span>
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

        <DesktopNav items={items} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div className="hidden md:flex items-center gap-2">
            <HeaderCTAs variant={ctas} locale={locale} t={t} />
            <ThemeToggle currentTheme={currentTheme} />
          </div>
          <MobileNavDrawer
            locale={locale}
            currentTheme={currentTheme}
            variant={variant}
            ctas={ctas}
            t={t}
          />
        </div>
      </div>
    </header>
  )
}
