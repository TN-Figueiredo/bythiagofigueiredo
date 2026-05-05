'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import type { ReactNode } from 'react'

const TABS = [
  { label: 'Dashboard', href: '/cms/youtube' },
  { label: 'Videos', href: '/cms/youtube/videos' },
  { label: 'Categories', href: '/cms/youtube/categories' },
  { label: 'Comments', href: '/cms/youtube/comments' },
] as const

export default function YouTubeLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  const activeTab = TABS.find(t => {
    if (t.href === '/cms/youtube') return pathname === '/cms/youtube'
    return pathname.startsWith(t.href)
  })?.href ?? '/cms/youtube'

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cms-border px-6 py-4">
        <h1 className="text-lg font-semibold text-cms-text">YouTube</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/cms/settings?section=youtube"
            className="text-sm text-cms-text-muted hover:text-cms-text"
          >
            Manage Channels
          </Link>
        </div>
      </div>

      {/* Tab bar */}
      <nav className="flex gap-0 border-b border-cms-border px-6" aria-label="YouTube sections">
        {TABS.map(tab => {
          const isActive = tab.href === activeTab
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-b-2 border-cms-accent text-cms-accent'
                  : 'text-cms-text-muted hover:text-cms-text'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {/* Content */}
      <div className="p-6">
        {children}
      </div>
    </div>
  )
}
