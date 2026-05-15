'use client'

import { usePostEditor } from '../post-editor-context'
import { StatusCard } from './status-card'
import { OriginCard } from './origin-card'
import { PubSummaryCard } from './pub-summary-card'
import { SectionsPanel } from './sections-panel'
import { ReadinessRing } from '../readiness-ring'
import { computeReadiness, type ReadinessInput } from '@/lib/posts/readiness'
import type { PostTab, SectionStatus } from '@/lib/posts/types'

interface PostSidebarProps {
  tabStatuses: Record<PostTab, SectionStatus>
  onSchedule: () => void
  onPublish: () => void
  onReturnToPipeline: () => void
}

export function PostSidebar({ tabStatuses, onSchedule, onPublish, onReturnToPipeline }: PostSidebarProps) {
  const { state } = usePostEditor()
  const { post } = state

  const readinessInput: ReadinessInput = {
    content: {
      titleFilled: (state.sections.content.title as string)?.length > 0 || post.translations.some(t => t.title.length > 0),
      hookFilled: (state.sections.content.excerpt as string)?.length > 0 || post.translations.some(t => (t.excerpt?.length ?? 0) > 0),
      bodyFilled: (state.sections.content.contentMdx as string)?.length > 0 || post.translations.some(t => (t.contentMdx?.length ?? 0) > 0),
    },
    images: { coverSet: !!post.coverImageUrl },
    seo: {
      metaTitleFilled: post.translations.some(t => (t.metaTitle?.length ?? 0) > 0),
      metaDescriptionFilled: post.translations.some(t => (t.metaDescription?.length ?? 0) > 0),
      score: 0,
    },
    social: { platformsConfigured: post.socialConfig?.enabled ? post.socialConfig.platforms.length : 0 },
    schedule: { dateSet: !!post.scheduledAt, dateSaved: !!post.scheduledAt },
    newsletter: { decisionMade: true },
  }
  const readiness = computeReadiness(readinessInput)

  return (
    <aside
      className="w-68 shrink-0 flex flex-col gap-2.5 sticky top-5 self-start max-h-[calc(100vh-40px)] overflow-y-auto"
      style={{ scrollbarWidth: 'thin' }}
      aria-label="Post details"
    >
      <StatusCard
        status={post.status}
        postId={post.id}
        pipelineItemId={post.pipelineItem?.id ?? null}
        onSchedule={onSchedule}
        onPublish={onPublish}
        onReturnToPipeline={onReturnToPipeline}
      />
      <OriginCard pipelineItem={post.pipelineItem} />
      <PubSummaryCard
        scheduledAt={post.scheduledAt}
        socialConfig={post.socialConfig}
        includeInNewsletter={post.includeInNewsletter}
        status={post.status}
      />
      <SectionsPanel tabStatuses={tabStatuses} />
      <div
        className="rounded-lg border p-4 flex items-center gap-3"
        style={{ background: 'var(--gem-surface, #0d1118)', borderColor: 'var(--gem-border, #1a2030)' }}
      >
        <ReadinessRing score={readiness.score} size={48} />
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--gem-text, #e2e8f0)' }}>Readiness</p>
          <p className="text-[10px]" style={{ color: 'var(--gem-dim, #3d4654)' }}>Completude para publicação</p>
        </div>
      </div>
    </aside>
  )
}
