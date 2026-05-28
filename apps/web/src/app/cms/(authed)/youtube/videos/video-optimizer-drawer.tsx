'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import type { VideoRow } from './videos-connected'
import type { VideoOptimizerData, PromptVideoInfo } from '@/lib/youtube/prompt-types'
import { buildVideoInfo } from '@/lib/youtube/prompt-builders'
import { fetchVideoOptimizerData, saveVideoNotes } from '../_actions/youtube-prompt-actions'
import { DrawerHeader } from './_components/drawer-header'
import { ThumbnailWithGrade } from './_components/thumbnail-with-grade'
import { VideoStatsCard } from './_components/video-stats-card'
import { CmsNotesEditor } from './_components/cms-notes-editor'
import { DrawerPromptSection } from './_components/drawer-prompt-section'
import { DataFreshnessBadge } from './_components/data-freshness-badge'
import { useFocusTrap } from '@/lib/hooks/use-focus-trap'

interface VideoOptimizerDrawerProps {
  video: VideoRow | null
  onClose: () => void
}

export function VideoOptimizerDrawer({ video, onClose }: VideoOptimizerDrawerProps) {
  const [data, setData] = useState<VideoOptimizerData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!video) { setData(null); return }
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchVideoOptimizerData(video.id).then(result => {
      if (cancelled) return
      if (result.ok) setData(result.data)
      else setError(result.error)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [video?.id])

  useEffect(() => {
    drawerRef.current?.focus()
  }, [video?.id])

  const handleSaveNotes = useCallback(async (videoId: string, notes: string, version: number) => {
    const result = await saveVideoNotes(videoId, notes, version)
    if (!result.ok) throw new Error(result.error)
    return result.data
  }, [])

  const videoInfo: PromptVideoInfo | null = useMemo(() =>
    video ? buildVideoInfo(video) : null,
    [video]
  )

  const handleTrapKeyDown = useFocusTrap(drawerRef, { autoFocus: false })

  if (!video || !videoInfo) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div
        className="fixed inset-y-0 right-0 z-40 flex w-[480px] flex-col border-l border-cms-border bg-cms-surface shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Video Optimizer"
        onKeyDown={e => { handleTrapKeyDown(e); if (e.key === 'Escape') onClose() }}
        tabIndex={-1}
        ref={drawerRef}
      >
      <DrawerHeader
        title={video.title}
        optimizationState={data?.optimizationState ?? 'unflagged'}
        onClose={onClose}
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <ThumbnailWithGrade
          thumbnailUrl={video.thumbnailUrl}
          grade={data?.grade.grade ?? 'C'}
          score={data?.grade.score ?? 0}
        />

        {loading && <div role="status" aria-live="polite" className="text-center text-xs text-cms-text-muted">Carregando dados…</div>}
        {error && <div role="alert" aria-live="assertive" className="rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-400">{error}</div>}

        {data && (
          <>
            {data.snapshotAgeHours > 24 && (
              <DataFreshnessBadge snapshotAgeHours={data.snapshotAgeHours} />
            )}

            <VideoStatsCard
              viewCount={video.viewCount}
              retentionCurve={data.retentionCurve}
              trafficSources={data.trafficSources}
            />

            <CmsNotesEditor
              videoId={video.id}
              initialNotes={video.cmsNotes ?? ''}
              version={video.version}
              onSave={handleSaveNotes}
            />

            <DrawerPromptSection data={data} video={videoInfo} />
          </>
        )}
      </div>
      </div>
    </>
  )
}
