'use client'

import { useRouter } from 'next/navigation'
import type { LinktreeDisplay, LinkDisplay, AnalyticsDisplay } from '@tn-figueiredo/links-admin'
import { TabBar, type TabId } from './_components/tab-bar'
import { TreeTab } from './_components/tree-tab'
import { ShortLinksTab } from './_components/short-links-tab'
import { AnalyticsView } from './_components/analytics-view'

interface LinksHubProps {
  tree: LinktreeDisplay
  links: LinkDisplay[]
  analytics: AnalyticsDisplay
  activeTab: TabId
}

export function LinksHub({ tree, links, analytics, activeTab }: LinksHubProps) {
  const router = useRouter()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Links</h1>
          <p className="mt-1 text-sm text-muted-foreground">Short links, Linktree e analytics unificados.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
            QR Card
          </button>
          <button
            type="button"
            onClick={() => router.push('/cms/links/new')}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            Novo link
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <TabBar activeTab={activeTab} />

      {/* Tab content */}
      {activeTab === 'tree' && <TreeTab tree={tree} />}
      {activeTab === 'links' && <ShortLinksTab links={links} onCreateLink={() => router.push('/cms/links/new')} />}
      {activeTab === 'analytics' && <AnalyticsView data={analytics} />}
    </div>
  )
}
