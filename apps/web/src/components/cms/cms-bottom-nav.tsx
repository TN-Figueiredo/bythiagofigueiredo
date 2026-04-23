'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebar } from './sidebar-context'

const TABS = [
  { icon: '📊', label: 'Home', href: '/cms' },
  { icon: '📅', label: 'Schedule', href: '/cms/schedule' },
  { icon: '📝', label: 'Posts', href: '/cms/blog' },
  { icon: '📈', label: 'Analytics', href: '/cms/analytics' },
  { icon: '📰', label: 'Letters', href: '/cms/newsletters' },
] as const

export function CmsBottomNav() {
  const { mode } = useSidebar()
  const pathname = usePathname()

  if (mode !== 'mobile') return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-14 bg-cms-surface border-t border-cms-border flex items-center justify-around z-50">
      {TABS.map((tab) => {
        const isActive = tab.href === '/cms' ? pathname === '/cms' : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center gap-0.5 text-[10px] ${isActive ? 'text-cms-accent' : 'text-cms-text-dim'}`}
          >
            <span className="text-lg">{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
