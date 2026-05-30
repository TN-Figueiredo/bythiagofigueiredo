'use client'

import { useState, useMemo } from 'react'
import type { z } from 'zod'
import type { LinktreeConfigSchema, LinktreePageData } from '@/app/go/linktree/_lib/types'
import { LinktreeClient } from '@/app/go/linktree/_components/linktree-client'
import { RefreshCw, ExternalLink } from 'lucide-react'

type Config = z.infer<typeof LinktreeConfigSchema>

interface Props {
  config: Config
  pageData: LinktreePageData
}

export function EditorPreview({ config, pageData }: Props) {
  const [locale, setLocale] = useState<'pt-BR' | 'en'>('pt-BR')
  const [refreshKey, setRefreshKey] = useState(0)

  const isPt = locale === 'pt-BR'

  const mergedPageData = useMemo(() => ({
    ...pageData,
    config,
    sharedLinks: config.shared_links,
  }), [pageData, config])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setLocale('pt-BR')}
            className={`rounded px-2 py-0.5 text-[10px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 ${isPt ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
          >
            PT
          </button>
          <button
            onClick={() => setLocale('en')}
            className={`rounded px-2 py-0.5 text-[10px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 ${!isPt ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
          >
            EN
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
          <a
            href="/go/linktree"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
            title="Abrir em nova aba"
          >
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      <div key={refreshKey} className="flex-1 overflow-y-auto bg-[var(--pb-bg,#0f0f0f)]">
        <div
          className="origin-top"
          style={{
            width: '400px',
            transform: 'scale(1)',
            transformOrigin: 'top center',
          }}
        >
          <LinktreeClient
            initialLocale={locale}
            initialTheme="dark"
            {...mergedPageData}
          />
        </div>
      </div>
    </div>
  )
}
