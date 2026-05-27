'use client'

import { memo } from 'react'
import Link from 'next/link'
import { Pin, X } from 'lucide-react'
import { gemMix } from '@/lib/pipeline/gem-design'
import { FORMAT_COLORS } from '@/lib/pipeline/colors'
import type { WorkingTodayPin } from '../working-today-actions'

const MAX_PINS = 3

const STAGE_SHORT: Record<string, string> = {
  idea: 'ideia', outline: 'roteiro', draft: 'rascunho', roteiro: 'roteiro',
  gravacao: 'gravacao', edicao: 'edicao', pos_producao: 'pos',
  ready: 'pronto', scheduled: 'agendado',
}

interface PinnedQueueProps {
  pins: WorkingTodayPin[]
  onUnpin: (itemId: string) => void
  showGhosts: boolean
}

export const PinnedQueue = memo(function PinnedQueue({ pins, onUnpin, showGhosts }: PinnedQueueProps) {
  if (pins.length === 0 && !showGhosts) return null

  const ghostCount = showGhosts ? Math.max(0, MAX_PINS - pins.length) : 0

  return (
    <section aria-label="Foco de hoje" role="region">
      <h3
        className="flex items-center gap-1.5 text-xs font-semibold mb-2"
        style={{ color: 'var(--gem-muted)' }}
      >
        <Pin size={12} aria-hidden="true" />
        Foco de hoje
        <span className="text-[10px] font-normal" style={{ color: 'var(--gem-dim)' }}>
          ({pins.length}/{MAX_PINS})
        </span>
      </h3>

      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {pins.map((pin) => {
          const colors = FORMAT_COLORS[pin.format] ?? {
            accent: 'var(--gem-accent)',
            text: 'var(--gem-muted)',
            border: 'var(--gem-border)',
          }

          return (
            <li key={pin.itemId} className="relative group">
              <Link
                href={`/cms/pipeline/items/${pin.itemId}`}
                className="flex items-stretch gap-2 rounded-lg border p-2.5 cursor-pointer motion-safe:transition-transform motion-safe:hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
                style={{
                  background: 'var(--gem-surface)',
                  borderColor: 'var(--gem-border)',
                }}
                aria-label={`${pin.title}. ${STAGE_SHORT[pin.stage] ?? pin.stage}.`}
              >
                <div
                  className="w-[3px] shrink-0 rounded-full"
                  style={{ background: colors.accent }}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs font-medium truncate"
                    style={{ color: 'var(--gem-text)' }}
                  >
                    {pin.title}
                  </p>
                  <p
                    className="text-[10px] mt-0.5"
                    style={{ color: 'var(--gem-dim)' }}
                  >
                    {STAGE_SHORT[pin.stage] ?? pin.stage}
                  </p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => onUnpin(pin.itemId)}
                className="absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 focus-visible:opacity-100 motion-safe:transition-opacity min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
                style={{ color: 'var(--gem-dim)' }}
                aria-label={`Desafixar ${pin.title}`}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          )
        })}

        {Array.from({ length: ghostCount }).map((_, i) => (
          <li
            key={`ghost-${i}`}
            data-testid="ghost-suggestion"
            className="flex items-center justify-center rounded-lg border border-dashed p-4"
            style={{
              borderColor: gemMix('--gem-border', 40),
              background: gemMix('--gem-surface', 30),
            }}
          >
            <span
              className="text-[10px]"
              style={{ color: gemMix('--gem-dim', 50) }}
            >
              Fixe um item da fila
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
})
