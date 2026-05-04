'use client'

import Link from 'next/link'
import type { NavItem } from './header-types'
import { useActiveNav } from './use-active-nav'

type Props = {
  items: NavItem[]
}

export function DesktopNav({ items }: Props) {
  const current = useActiveNav()

  return (
    <nav
      aria-label="Main navigation"
      className="hidden md:flex flex-wrap items-center"
      style={{ gap: 22, fontSize: 14 }}
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
          display: 'inline-flex' as const,
          alignItems: 'center' as const,
          gap: 4,
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
              <span style={{ fontSize: 10, opacity: 0.7 }}>↗</span>
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
  )
}
