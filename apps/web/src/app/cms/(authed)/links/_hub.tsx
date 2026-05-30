'use client'

import { useState } from 'react'
import { Link2, QrCode, Plus, ChevronRight } from 'lucide-react'
import type { LinktreeDisplay, LinkDisplay, AnalyticsDisplay } from '@tn-figueiredo/links-admin'
import { TabBar, type TabId } from './_components/tab-bar'
import { TreeTab } from './_components/tree-tab'
import { ShortLinksTab } from './_components/short-links-tab'
import { AnalyticsView } from './_components/analytics-view'
import { CreateLinkModal } from './_components/create-link-modal'
import { createLink } from './actions'

interface LatestContent {
  title: string
  meta?: string
}

interface LinksHubProps {
  tree: LinktreeDisplay
  links: LinkDisplay[]
  analytics: AnalyticsDisplay
  activeTab: TabId
  latestPost?: LatestContent | null
  latestVideo?: LatestContent | null
}

export function LinksHub({ tree, links, analytics, activeTab, latestPost, latestVideo }: LinksHubProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)

  return (
    <div style={{ padding: '20px 30px 0' }}>
      {/* Breadcrumb */}
      <div className="mb-[10px] flex items-center gap-[7px]">
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] font-medium text-[var(--ink-dim)]">
          <Link2 size={13} strokeWidth={1.7} />
          Social
        </span>
        <ChevronRight size={13} strokeWidth={1.7} className="shrink-0 text-[var(--ink-faint)] opacity-70" />
        <span className="truncate text-[12.5px] font-semibold text-[var(--ink)]">
          Links
        </span>
      </div>

      {/* Title row */}
      <div className="mb-[6px] flex flex-wrap items-end justify-between gap-[14px]">
        <h1 className="m-0 text-[29px] font-semibold tracking-[-0.01em] whitespace-nowrap" style={{ fontFamily: 'Fraunces, serif' }}>
          Links
        </h1>
        <div className="flex flex-wrap gap-[10px]">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-[9px] border border-[var(--line-strong)] bg-transparent px-[11px] py-[6px] text-[12.5px] font-semibold tracking-[-0.01em] text-[var(--ink-dim)] transition-[0.15s] hover:text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <QrCode size={14} strokeWidth={1.7} />
            QR Card
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-[9px] border border-[var(--accent)] bg-[var(--accent)] px-[15px] py-[9px] text-[13.5px] font-semibold tracking-[-0.01em] text-[rgb(26,18,12)] transition-[0.15s] hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <Plus size={16} strokeWidth={1.7} />
            Novo link
          </button>
        </div>
      </div>

      {/* Subtitle */}
      <p className="mb-[22px] max-w-[640px] text-[13px] text-[var(--ink-dim)]">
        Sua porta de entrada e os links rastreados — agora num lugar só.
      </p>

      {/* Tab bar */}
      <TabBar activeTab={activeTab} />

      {/* Tab content */}
      <div className="pt-5">
        {activeTab === 'tree' && <TreeTab tree={tree} latestPost={latestPost} latestVideo={latestVideo} />}
        {activeTab === 'links' && <ShortLinksTab links={links} onCreateLink={() => setShowCreateModal(true)} />}
        {activeTab === 'analytics' && <AnalyticsView data={analytics} />}
      </div>

      {/* Create link modal */}
      <CreateLinkModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={async (data) => {
          const result = await createLink(data)
          return result
        }}
      />
    </div>
  )
}
