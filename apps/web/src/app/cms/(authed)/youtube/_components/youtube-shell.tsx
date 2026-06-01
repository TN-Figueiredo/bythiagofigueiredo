'use client'

import { usePathname } from 'next/navigation'
import { useTransition } from 'react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { triggerSync } from '../videos/actions'
import { CoworkDeepLink } from '@/components/cms/cowork-deep-link'
import { buildCoworkInstruction } from '@/lib/pipeline/cowork-instructions'

const TABS = [
  { label: 'Dashboard', href: '/cms/youtube' },
  { label: 'Videos', href: '/cms/youtube/videos' },
  { label: 'A/B Lab', href: '/cms/youtube/ab-lab' },
  { label: 'Categories', href: '/cms/youtube/categories' },
  { label: 'Comments', href: '/cms/youtube/comments' },
  { label: 'Content', href: '/cms/youtube/content' },
  { label: 'Competitors', href: '/cms/youtube/competitors' },
  { label: 'Performance', href: '/cms/youtube/analytics' },
] as const

interface YouTubeShellProps {
  children: ReactNode
  hoursUntilExpiry: number | null
}

export function YouTubeShell({ children, hoursUntilExpiry }: YouTubeShellProps) {
  const pathname = usePathname()
  const [isSyncing, startTransition] = useTransition()

  const activeTab = TABS.find(t => {
    if (t.href === '/cms/youtube') return pathname === '/cms/youtube'
    return pathname.startsWith(t.href)
  })?.href ?? '/cms/youtube'

  const handleSyncAll = () => {
    startTransition(async () => {
      await triggerSync()
    })
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cms-border px-6 py-4">
        <h1 className="text-lg font-semibold text-cms-text">YouTube</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isSyncing}
            onClick={handleSyncAll}
            className="rounded border border-cms-border px-3 py-1.5 text-sm font-medium text-cms-text-muted hover:bg-cms-surface-hover disabled:opacity-50"
          >
            {isSyncing ? '⟳ Syncing…' : '⟳ Sync All'}
          </button>
          <CoworkDeepLink
            instruction={buildCoworkInstruction('youtube-intelligence', {} as Record<string, never>)}
            variant="button"
          />
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

      {/* Token expiry warning */}
      {hoursUntilExpiry !== null && hoursUntilExpiry < 48 && (
        <div className="mx-6 mt-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
          Token do YouTube expira em {Math.round(hoursUntilExpiry)}h.{' '}
          Use o botao &ldquo;Reconectar Token&rdquo; na{' '}
          <Link href="/cms/youtube" className="underline">
            pagina de Canais
          </Link>{' '}
          para evitar falhas.
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {children}
      </div>
    </div>
  )
}
