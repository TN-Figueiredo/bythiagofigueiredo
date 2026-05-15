'use client'

import { POST_STAGES, dbStatusToStage } from '@/lib/posts/types'

interface StatusCardProps {
  status: string
  pipelineItemId: string | null
  onSchedule: () => void
  onPublish: () => void
  onReturnToPipeline: () => void
}

export function StatusCard({ status, pipelineItemId, onSchedule, onPublish, onReturnToPipeline }: StatusCardProps) {
  const currentStage = dbStatusToStage(status)
  const currentIdx = POST_STAGES.findIndex(s => s.stage === currentStage)

  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: 'var(--gem-surface, #0d1118)', borderColor: 'var(--gem-border, #1a2030)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-medium px-2 py-0.5 rounded"
          style={{
            background: currentStage === 'published' ? 'rgba(34,197,94,0.1)' : currentStage === 'scheduled' ? 'rgba(139,92,246,0.1)' : 'rgba(99,102,241,0.1)',
            color: currentStage === 'published' ? '#22c55e' : currentStage === 'scheduled' ? '#8b5cf6' : '#818cf8',
          }}
        >
          {POST_STAGES[currentIdx]?.labelPt ?? status}
        </span>
      </div>

      <div className="flex gap-1 mb-3" role="progressbar" aria-valuenow={currentIdx} aria-valuemin={0} aria-valuemax={POST_STAGES.length - 1} aria-label="Estágio do post" aria-valuetext={POST_STAGES[currentIdx]?.labelPt ?? status}>
        {POST_STAGES.map((s, i) => (
          <div
            key={s.stage}
            className="h-1.5 flex-1 rounded-sm transition-colors"
            title={s.labelPt}
            style={{
              background: i < currentIdx ? 'var(--gem-done, #22c55e)' : i === currentIdx ? 'var(--gem-accent, #818cf8)' : 'transparent',
              border: i > currentIdx ? '1px dashed var(--gem-border, #1a2030)' : 'none',
            }}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {currentStage === 'editing' && (
          <>
            <button
              type="button"
              onClick={onSchedule}
              className="w-full text-xs py-1.5 rounded transition-opacity hover:opacity-80"
              style={{ background: 'var(--gem-accent, #818cf8)', color: 'white' }}
            >
              Agendar
            </button>
            <button
              type="button"
              onClick={onPublish}
              className="w-full text-xs py-1.5 rounded border transition-colors hover:bg-emerald-500/10"
              style={{ borderColor: 'var(--gem-done, #22c55e)', color: 'var(--gem-done, #22c55e)' }}
            >
              Publicar agora
            </button>
          </>
        )}
        {currentStage === 'scheduled' && (
          <button
            type="button"
            onClick={onPublish}
            className="w-full text-xs py-1.5 rounded transition-opacity hover:opacity-80"
            style={{ background: 'var(--gem-done, #22c55e)', color: 'white' }}
          >
            Publicar agora
          </button>
        )}
        {pipelineItemId && currentStage !== 'published' && (
          <button
            type="button"
            onClick={onReturnToPipeline}
            className="w-full text-[10px] py-1 transition-colors hover:underline"
            style={{ color: 'var(--gem-dim, #3d4654)' }}
          >
            ← Devolver ao Pipeline
          </button>
        )}
      </div>
    </div>
  )
}
