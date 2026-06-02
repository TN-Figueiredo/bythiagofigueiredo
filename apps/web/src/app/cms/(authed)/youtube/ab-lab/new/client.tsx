'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { brDec } from '@/lib/youtube/format'
import { AbCreateWizard } from '../_components/ab-create-wizard'
import type { WizardVideo } from '../_components/ab-create-wizard'
import type { AbTestSiteSettings } from '@/lib/youtube/ab-types'
import { Search } from 'lucide-react'

interface EligibleVideo {
  id: string
  title: string
  thumbnailUrl: string | null
  durationSeconds: number
  channelHandle: string
  hasActiveTest: boolean
  previousLift: number | null
  sourcePipelineId: string | null
}

interface DraftPrefill {
  id: string
  videoId: string
  videoTitle: string
  thumbnailUrl: string | null
  testType: string
  sourcePipelineId: string | null
}

interface NewTestClientProps {
  siteId: string
  settings: AbTestSiteSettings
  eligibleVideos: EligibleVideo[]
  draftPrefill?: DraftPrefill
}

export function NewTestClient({ siteId, settings, eligibleVideos, draftPrefill }: NewTestClientProps) {
  const router = useRouter()
  const [selectedVideo, setSelectedVideo] = useState<WizardVideo | null>(
    draftPrefill
      ? {
          id: draftPrefill.videoId,
          title: draftPrefill.videoTitle,
          thumbnailUrl: draftPrefill.thumbnailUrl,
          sourcePipelineId: draftPrefill.sourcePipelineId,
        }
      : null,
  )
  const [search, setSearch] = useState('')

  if (selectedVideo) {
    return (
      <AbCreateWizard
        video={selectedVideo}
        siteId={siteId}
        settings={settings}
        onClose={() => router.push('/cms/youtube/ab-lab')}
        onCreated={(testId) => router.push(`/cms/youtube/ab-lab/${testId}`)}
        existingDraftId={draftPrefill?.id}
        prefill={draftPrefill ? { testType: draftPrefill.testType as import('@/lib/youtube/ab-types').TestType } : undefined}
      />
    )
  }

  const filtered = eligibleVideos.filter(
    (v) =>
      v.title.toLowerCase().includes(search.toLowerCase()) ||
      v.channelHandle.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-cms-text">Select a Video</h2>
        <p className="text-sm text-cms-text-muted mt-1">
          Choose a video to create a new A/B test.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-cms-text-dim"
          aria-hidden="true"
        />
        <input
          type="text"
          placeholder="Search videos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-[var(--cms-radius)] border border-cms-border bg-cms-bg text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent"
        />
      </div>

      {/* Video list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-cms-text-dim py-8 text-center">
            {eligibleVideos.length === 0 ? 'No videos available.' : 'No videos match your search.'}
          </p>
        )}
        {filtered.map((v) => (
          <button
            key={v.id}
            type="button"
            disabled={v.hasActiveTest}
            onClick={() =>
              setSelectedVideo({
                id: v.id,
                title: v.title,
                thumbnailUrl: v.thumbnailUrl,
                sourcePipelineId: v.sourcePipelineId,
              })
            }
            className="w-full flex items-center gap-3 p-3 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface hover:bg-cms-surface-hover transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none"
          >
            <div className="w-24 h-[54px] rounded bg-cms-bg shrink-0 overflow-hidden">
              {v.thumbnailUrl ? (
                <img
                  src={v.thumbnailUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-cms-text-dim text-xs">
                  No thumb
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-cms-text truncate">{v.title}</p>
              <p className="text-2xs text-cms-text-muted">{v.channelHandle}</p>
              {v.hasActiveTest && (
                <p className="text-2xs text-amber-400 mt-0.5">Active test in progress</p>
              )}
              {v.previousLift != null && (
                <p className="text-2xs text-cms-text-dim mt-0.5">
                  Lift anterior: {v.previousLift > 0 ? '+' : ''}{brDec(v.previousLift, 1)}%
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Back link */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => router.push('/cms/youtube/ab-lab')}
          className="text-sm text-cms-text-muted hover:text-cms-text transition-colors"
        >
          &larr; Back to A/B Lab
        </button>
      </div>
    </div>
  )
}
