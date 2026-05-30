'use client'

import type { AbTestCardView } from '@/lib/youtube/ab-types'
import { VChip, TypeBadge, Badge } from './ab-primitives'
import { ChevronRight, Swords } from 'lucide-react'

export interface CompletedRowProps {
  test: AbTestCardView
  onOpen: (id: string) => void
}

export function CompletedRow({ test, onOpen }: CompletedRowProps) {
  const isInconclusive = Math.abs(test.lift) < 0.1 && test.confidence < 90

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(test.id)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(test.id) } }}
      className="flex items-center gap-[14px] py-[12px] px-[14px] rounded-[10px] cursor-pointer transition-[background] duration-[0.15s] hover:bg-cms-surface-hover focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none"
    >
      {/* Thumbnail */}
      <div className="w-[78px] shrink-0">
        <div
          className="relative w-full rounded-[6px] overflow-hidden"
          style={{
            aspectRatio: '16/9',
            background: isInconclusive
              ? 'linear-gradient(135deg, rgb(58,47,40), rgb(31,26,22))'
              : `linear-gradient(135deg, rgb(90,47,23), rgb(36,16,8))`,
            boxShadow: 'rgba(0,0,0,0.4) 0px 0px 60px inset',
          }}
        >
          <div className="absolute" style={{ left: '8%', bottom: '-6%', width: '46%', height: '92%', background: 'radial-gradient(at 50% 40%, rgba(255,255,255,0.14), transparent 65%)' }} />
          <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.024) 0px, rgba(255,255,255,0.024) 2px, transparent 2px, transparent 9px)' }} />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold text-cms-text whitespace-nowrap overflow-hidden text-ellipsis">
          {test.name}
        </div>
        <div className="flex items-center gap-[8px] mt-[5px]">
          <TypeBadge type={test.type} />
          {test.hasPlayoff && (
            <Badge tone="cowork">
              <Swords size={11} aria-hidden="true" />
              Playoff
            </Badge>
          )}
        </div>
      </div>

      {/* Result */}
      <div className="text-right shrink-0">
        {isInconclusive ? (
          <>
            <Badge tone="amber">playoff agendado</Badge>
            <div className="text-[10.5px] text-cms-text-dim mt-[4px]">
              {Math.round(test.confidence)}% — sem vencedor claro
            </div>
          </>
        ) : (
          <>
            <div className="inline-flex items-center gap-[6px]">
              <VChip label={test.leader} size={18} />
              <span className="font-mono text-[16px] font-bold text-cms-green">
                +{test.lift.toFixed(1)}%
              </span>
            </div>
            <div className="text-[10.5px] text-cms-text-dim mt-[4px]">
              {test.confidence.toFixed(1)}% confiança
            </div>
          </>
        )}
      </div>

      {/* Chevron */}
      <ChevronRight size={16} className="text-cms-text-dim shrink-0" aria-hidden="true" />
    </div>
  )
}
