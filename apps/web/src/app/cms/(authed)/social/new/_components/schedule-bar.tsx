'use client'

import { useState, useEffect } from 'react'
import type { QueueSlot } from '@/lib/social/queue'

type ScheduleMode = 'now' | 'schedule' | 'queue'

interface ScheduleBarProps {
  mode: ScheduleMode
  onModeChange: (mode: ScheduleMode) => void
  scheduledAt: string
  onScheduleChange: (scheduledAt: string) => void
  onPublish: () => void
  onSaveDraft: () => void
  isPending: boolean
  disabled?: boolean
  showPipeline: boolean
  strings?: Record<string, unknown>
  onFetchQueueSlot?: (timezone: string) => Promise<QueueSlot | null>
}

const MODE_LABELS: Record<ScheduleMode, string> = {
  now: 'Agora',
  schedule: 'Agendar',
  queue: 'Fila',
}

const PRIMARY_LABELS: Record<ScheduleMode, string> = {
  now: 'Publicar',
  schedule: 'Agendar',
  queue: 'Adicionar a Fila',
}

const PRIMARY_COLORS: Record<ScheduleMode, string> = {
  now: 'bg-emerald-600 hover:bg-emerald-700',
  schedule: 'bg-blue-600 hover:bg-blue-700',
  queue: 'bg-purple-600 hover:bg-purple-700',
}

export function ScheduleBar({
  mode,
  onModeChange,
  scheduledAt,
  onScheduleChange,
  onPublish,
  onSaveDraft,
  isPending,
  showPipeline,
  onFetchQueueSlot,
}: ScheduleBarProps) {
  const [queueSlot, setQueueSlot] = useState<QueueSlot | null>(null)
  const [queueLoading, setQueueLoading] = useState(false)

  useEffect(() => {
    if (mode !== 'queue' || !onFetchQueueSlot) return
    setQueueLoading(true)
    onFetchQueueSlot('America/Sao_Paulo')
      .then(setQueueSlot)
      .catch(() => setQueueSlot(null))
      .finally(() => setQueueLoading(false))
  }, [mode, onFetchQueueSlot])

  const dateValue = scheduledAt ? scheduledAt.slice(0, 10) : ''
  const timeValue = scheduledAt ? scheduledAt.slice(11, 16) : ''

  const handleDateChange = (date: string) => {
    onScheduleChange(`${date}T${timeValue || '09:00'}`)
  }
  const handleTimeChange = (time: string) => {
    onScheduleChange(`${dateValue || new Date().toISOString().slice(0, 10)}T${time}`)
  }

  return (
    <div className="space-y-2 border-t border-cms-border bg-cms-surface/95 p-4 backdrop-blur-sm">
      {showPipeline && (
        <div className="flex items-center gap-2 text-xs text-cms-text-muted">
          <span className="font-medium uppercase tracking-wider text-cms-accent">
            AUTO
          </span>
          <span>&rarr;</span>
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          <span>Post</span>
          <span>&rarr;</span>
          <span className="inline-block h-2 w-2 rounded-full bg-cyan-400" />
          <span>Short Link</span>
          <span>&rarr;</span>
          <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
          <span>Platform Prepare</span>
          <span>&rarr;</span>
          <span className="inline-block h-2 w-2 rounded-full bg-purple-400" />
          <span>Deliver</span>
          <span className="ml-1 text-cms-text-muted/60">~2-3 min</span>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          {(['now', 'schedule', 'queue'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                mode === m
                  ? 'bg-cms-accent/15 text-cms-accent'
                  : 'text-cms-text-muted hover:text-cms-text'
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {mode === 'schedule' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateValue}
              onChange={(e) => handleDateChange(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="rounded-md border border-cms-border bg-cms-bg px-3 py-1.5 text-sm text-cms-text"
            />
            <input
              type="time"
              value={timeValue}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="rounded-md border border-cms-border bg-cms-bg px-3 py-1.5 text-sm text-cms-text"
            />
            <span className="rounded bg-cms-border/30 px-2 py-0.5 text-xs text-cms-text-muted">
              BRT (UTC-3)
            </span>
          </div>
        )}

        {mode === 'queue' && (
          <div className="text-sm text-cms-text-muted">
            {queueLoading ? (
              <span>Calculando...</span>
            ) : queueSlot ? (
              <span>
                Proximo slot:{' '}
                <span className="font-medium text-cms-text">
                  {queueSlot.label}
                </span>
              </span>
            ) : (
              <span className="text-amber-400">
                Fila cheia -- use Agendar para escolher horario
              </span>
            )}
          </div>
        )}

        <div className="flex-1" />

        <button
          type="button"
          onClick={onSaveDraft}
          disabled={isPending}
          className="rounded-md border border-cms-border px-4 py-2 text-sm font-medium text-cms-text hover:bg-cms-surface disabled:opacity-50"
        >
          Salvar Rascunho
        </button>

        <button
          type="button"
          onClick={onPublish}
          disabled={isPending}
          className={`rounded-md px-6 py-2 text-sm font-medium text-white disabled:opacity-50 ${PRIMARY_COLORS[mode]}`}
        >
          {isPending ? 'Salvando...' : PRIMARY_LABELS[mode]}
        </button>
      </div>
    </div>
  )
}
