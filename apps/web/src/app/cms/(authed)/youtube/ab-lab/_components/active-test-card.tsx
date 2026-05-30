'use client'

import type { AbTestCardView } from '@/lib/youtube/ab-types'
import { VARIANT_COLORS } from './ab-constants'
import { VChip, Badge, TypeBadge } from './ab-primitives'
import { ChevronRight, Swords } from 'lucide-react'

export interface ActiveTestCardProps {
  test: AbTestCardView
  onOpen: (id: string) => void
}

export function ActiveTestCard({ test, onOpen }: ActiveTestCardProps) {
  return (
    <article
      aria-label={test.name}
      tabIndex={0}
      onClick={() => onOpen(test.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(test.id) } }}
      className="rounded-[14px] border border-cms-border bg-cms-surface overflow-hidden cursor-pointer focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none"
      style={{ transition: 'border-color 0.18s, transform 0.18s, background 0.18s' }}
    >
      {/* Top section */}
      <div className="py-[16px] px-[18px] pb-[14px]">
        {/* Badge row */}
        <div className="flex items-center gap-[8px] flex-wrap mb-[12px]">
          <TypeBadge type={test.type} />
          {test.hasPlayoff && test.roundNumber > 1 && (
            <Badge tone="cowork">
              <Swords size={11} aria-hidden="true" />
              Round {test.roundNumber - 1}/{test.roundNumber}
            </Badge>
          )}
          <Badge tone="green" dot>
            Dia {test.dayOf}/{test.dayOf + Math.max(0, 14 - test.dayOf)}
          </Badge>
          <span className="ml-auto text-cms-text-dim">
            <ChevronRight size={16} aria-hidden="true" />
          </span>
        </div>

        {/* Title */}
        <div className="text-[15px] font-semibold leading-[1.3] mb-[14px]" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {test.name}
        </div>

        {/* Thumbnail grid */}
        <div className="grid gap-[7px]" style={{ gridTemplateColumns: `repeat(${test.variants.length}, 1fr)` }}>
          {test.variants.map(v => {
            const isLeader = v.label === test.leader
            const color = VARIANT_COLORS[v.label] ?? v.color
            return (
              <div
                key={v.label}
                className="relative rounded-[8px] overflow-hidden"
                style={{ outline: isLeader ? `${color} solid 2px` : '1px solid var(--cms-border, #332D25)', outlineOffset: '-1px' }}
              >
                <div
                  className="relative w-full rounded-[8px] overflow-hidden"
                  style={{
                    aspectRatio: '16/9',
                    background: isLeader
                      ? `linear-gradient(135deg, ${hexToGrad(color, 0.3)}, ${hexToGrad(color, 0.1)})`
                      : 'linear-gradient(135deg, rgb(58,47,40), rgb(31,26,22))',
                    boxShadow: 'rgba(0,0,0,0.4) 0px 0px 60px inset',
                  }}
                >
                  <div className="absolute" style={{ left: '8%', bottom: '-6%', width: '46%', height: '92%', background: 'radial-gradient(at 50% 40%, rgba(255,255,255,0.14), transparent 65%)' }} />
                  <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.024) 0px, rgba(255,255,255,0.024) 2px, transparent 2px, transparent 9px)' }} />
                  <span
                    className="absolute flex items-center justify-center rounded-[6px] font-mono font-bold text-[11px]"
                    style={{
                      left: 7, top: 7, width: 20, height: 20,
                      background: color, color: 'rgb(21,18,13)',
                      boxShadow: 'rgba(0,0,0,0.4) 0px 2px 6px',
                    }}
                  >
                    {v.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom stats */}
      <div className="grid grid-cols-3 border-t border-cms-border bg-cms-bg-side">
        <div className="py-[13px] px-[16px]">
          <div className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] mb-[6px]">Confiança</div>
          <div className="font-mono text-[16px] font-bold text-cms-accent leading-none">{Math.round(test.confidence)}%</div>
          <div className="text-[10.5px] text-cms-text-dim mt-[5px]">meta 95%</div>
        </div>
        <div className="py-[13px] px-[16px] border-l border-cms-border">
          <div className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] mb-[6px]">Líder</div>
          <div className="font-mono text-[16px] font-bold text-cms-text leading-none">
            <span className="inline-flex items-center gap-[6px]">
              <VChip label={test.leader} size={18} />
              {test.lift > 0 ? '+' : ''}{Math.round(test.lift)}%
            </span>
          </div>
          <div className="text-[10.5px] text-cms-text-dim mt-[5px]">{Math.round(test.confidence * 0.7)}% prob. vencer</div>
        </div>
        <div className="py-[13px] px-[16px] border-l border-cms-border">
          <div className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] mb-[6px]">Próx. rotação</div>
          <div className="font-mono text-[16px] font-bold text-cms-text leading-none">
            <span className="inline-flex items-center gap-[5px]">—</span>
          </div>
          <div className="text-[10.5px] text-cms-text-dim mt-[5px]">→ variante —</div>
        </div>
      </div>
    </article>
  )
}

function hexToGrad(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`
}
