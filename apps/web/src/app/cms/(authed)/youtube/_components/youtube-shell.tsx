'use client'

import { usePathname } from 'next/navigation'
import { useTransition, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { Toaster } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { triggerSync } from '../videos/actions'
import { CoworkDeepLink } from '@/components/cms/cowork-deep-link'
import { buildCoworkInstruction } from '@/lib/pipeline/cowork-instructions'
import { useTabEdgeFades } from '../_hooks/use-tab-edge-fades'

const TABS = [
  { label: 'Painel', href: '/cms/youtube' },
  { label: 'Vídeos', href: '/cms/youtube/videos' },
  { label: 'A/B Lab', href: '/cms/youtube/ab-lab' },
  { label: 'Categorias', href: '/cms/youtube/categories' },
  { label: 'Comentários', href: '/cms/youtube/comments' },
  { label: 'Conteúdo', href: '/cms/youtube/content' },
  { label: 'Competidores', href: '/cms/youtube/competitors' },
  { label: 'Desempenho', href: '/cms/youtube/analytics' },
] as const

function TokenExpiryBanner({ hoursUntilExpiry }: { hoursUntilExpiry: number }) {
  const router = useRouter()
  const [isConnecting, startReconnect] = useTransition()
  const messageListenerRef = useRef<((e: MessageEvent) => void) | null>(null)

  useEffect(() => {
    return () => {
      if (messageListenerRef.current) {
        window.removeEventListener('message', messageListenerRef.current)
        messageListenerRef.current = null
      }
    }
  }, [])

  const handleReconnect = useCallback(() => {
    startReconnect(() => {
      const width = 600
      const height = 700
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2
      const popup = window.open(
        '/api/social/oauth/google',
        'social-oauth',
        `width=${width},height=${height},left=${left},top=${top}`,
      )

      if (messageListenerRef.current) {
        window.removeEventListener('message', messageListenerRef.current)
      }

      const onMessage = (event: MessageEvent) => {
        if (event.data?.type === 'social-oauth-result') {
          window.removeEventListener('message', onMessage)
          messageListenerRef.current = null
          popup?.close()
          if (event.data.success) {
            router.refresh()
          }
        }
      }
      messageListenerRef.current = onMessage
      window.addEventListener('message', onMessage)
    })
  }, [router])

  return (
    <div className="mx-6 mt-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 flex items-center justify-between gap-3">
      <span className="text-sm text-yellow-300">
        Token do YouTube expira em {Math.round(hoursUntilExpiry)}h. Reconecte para evitar falhas de sync.
      </span>
      <button
        type="button"
        onClick={handleReconnect}
        disabled={isConnecting}
        className="shrink-0 rounded-md bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
      >
        {isConnecting ? 'Conectando…' : '🔑 Reconectar Token'}
      </button>
    </div>
  )
}

interface YouTubeShellProps {
  children: ReactNode
  hoursUntilExpiry: number | null
}

export function YouTubeShell({ children, hoursUntilExpiry }: YouTubeShellProps) {
  const pathname = usePathname()
  const [isSyncing, startTransition] = useTransition()
  const tabBarRef = useTabEdgeFades<HTMLElement>()

  const activeTab = TABS.find(t => {
    if (t.href === '/cms/youtube') return pathname === '/cms/youtube'
    return pathname.startsWith(t.href)
  })?.href ?? '/cms/youtube'

  // Auto-scroll active tab into view on mount
  useEffect(() => {
    const bar = tabBarRef.current
    if (!bar) return
    const activeEl = bar.querySelector<HTMLElement>('.yt-tab.active')
    if (!activeEl) return
    // Use scrollLeft calculation for smooth centering
    const barRect = bar.getBoundingClientRect()
    const tabRect = activeEl.getBoundingClientRect()
    const offset = tabRect.left - barRect.left + bar.scrollLeft - barRect.width / 2 + tabRect.width / 2
    bar.scrollTo({ left: Math.max(0, offset), behavior: 'instant' })
  }, [pathname])

  const handleSyncAll = () => {
    startTransition(async () => {
      await triggerSync()
    })
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cms-border" style={{ padding: '16px 28px' }}>
        <h1 className="display text-[22px] font-semibold text-cms-text">YouTube</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isSyncing}
            onClick={handleSyncAll}
            className={`btn ghost sm${isSyncing ? ' syncing' : ''}`}
          >
            <RefreshCw size={14} aria-hidden="true" />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar tudo'}
          </button>
          <CoworkDeepLink
            instruction={buildCoworkInstruction('youtube-intelligence', {} as Record<string, never>)}
            variant="button"
            className="btn cowork sm"
          />
        </div>
      </div>

      {/* Tab bar */}
      <nav
        ref={tabBarRef}
        className="yt-tab-bar border-b border-cms-border"
        style={{ padding: '0 28px' }}
        aria-label="Seções do YouTube"
      >
        {TABS.map(tab => {
          const isActive = tab.href === activeTab
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`yt-tab${isActive ? ' active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {/* Token expiry warning */}
      {hoursUntilExpiry !== null && hoursUntilExpiry < 48 && (
        <TokenExpiryBanner hoursUntilExpiry={hoursUntilExpiry} />
      )}

      {/* Content */}
      <div style={{ padding: '24px 28px 80px', maxWidth: 1340, margin: '0 auto', width: '100%' }}>
        {children}
      </div>

      <Toaster
        theme="dark"
        position="bottom-center"
        duration={2800}
        toastOptions={{
          style: {
            borderRadius: '999px',
            boxShadow: 'var(--shadow-pop)',
          },
        }}
      />
    </div>
  )
}
