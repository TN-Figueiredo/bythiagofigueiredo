'use client'

import type { DisplayLabel } from '@/lib/youtube/ab-types'
import { VChip, Badge } from './ab-primitives'
import { Swords, ArrowRight, Check, Target } from 'lucide-react'

const THUMB_BG: Record<string, string> = {
  A: 'linear-gradient(135deg, rgb(58,47,40), rgb(31,26,22))',
  B: 'linear-gradient(135deg, rgb(90,47,23), rgb(36,16,8))',
  C: 'linear-gradient(135deg, rgb(30,60,55), rgb(18,35,30))',
  D: 'linear-gradient(135deg, rgb(58,36,86), rgb(22,12,36))',
}

const COWORK = 'rgb(155, 147, 246)'
const COWORK_BG = 'rgba(110, 99, 242, 0.15)'
const COWORK_BORDER = 'rgba(110, 99, 242, 0.4)'

export interface PlayoffBannerProps {
  finalists: Array<{ label: DisplayLabel; color: string; ctr: number; thumbnailUrl: string | null }>
  allVariants: Array<{ label: DisplayLabel; isFinalist: boolean; thumbnailUrl: string | null }>
  startsIn: string
  reason: string
}

export function PlayoffBanner({ finalists, allVariants, startsIn, reason }: PlayoffBannerProps) {
  return (
    <div
      data-testid="playoff-banner"
      className="rounded-lg bg-cms-surface overflow-hidden"
      style={{ border: `1px solid ${COWORK_BORDER}` }}
    >
      {/* Header */}
      <div className="flex items-center gap-[12px] border-b border-cms-border py-[18px] px-[22px]" style={{ background: COWORK_BG }}>
        <Swords size={20} style={{ color: COWORK }} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold text-cms-text truncate">Playoff criado automaticamente</div>
          <div className="text-[12px] text-cms-text-dim mt-[2px] truncate">
            Round 2 começa em <b className="font-mono text-cms-text">{startsIn}</b> · só os 2 melhores · convergência mais rápida
          </div>
        </div>
        <Badge tone="cowork" dot>agendado</Badge>
      </div>

      {/* Bracket: grid 1fr auto 1fr */}
      <div className="py-[24px] px-[22px] grid grid-cols-[1fr_auto_1fr] gap-[24px] items-center">
        {/* Round 1 */}
        <div>
          <div className="text-[10px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] mb-[12px]">
            Round 1 · {allVariants.length} variantes
          </div>
          <div className="flex flex-col gap-[7px]">
            {allVariants.map(v => {
              const isFinalist = v.isFinalist
              const finalist = finalists.find(f => f.label === v.label)
              return (
                <div
                  key={v.label}
                  className="flex items-center gap-[9px] py-[8px] px-[11px] rounded-[8px]"
                  style={{
                    background: isFinalist ? COWORK_BG : 'var(--cms-surface-hover)',
                    opacity: isFinalist ? 1 : 0.5,
                    border: isFinalist ? `1px solid ${COWORK_BORDER}` : '1px solid transparent',
                  }}
                >
                  <VChip label={v.label} size={18} />
                  <span className="flex-1 text-[11.5px] text-cms-text-dim whitespace-nowrap overflow-hidden text-ellipsis">
                    {v.label === 'A' ? 'Original' : isFinalist ? 'Finalista' : 'Variante'}
                  </span>
                  <span className="font-mono text-[11.5px] font-bold" style={{ color: isFinalist ? COWORK : 'var(--cms-text-muted)' }}>
                    P{finalist ? Math.round(finalist.ctr * 1000 + 10) : Math.round((v.label.charCodeAt(0) % 20) + 10)}%
                  </span>
                  {isFinalist && <Check size={13} style={{ color: COWORK }} aria-hidden="true" />}
                </div>
              )
            })}
          </div>
        </div>

        {/* Arrow */}
        <ArrowRight size={22} className="text-cms-text-muted" aria-hidden="true" />

        {/* Round 2: finalists with thumbnails */}
        <div>
          <div className="text-[10px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] mb-[12px]">
            Round 2 · finalistas
          </div>
          <div className="flex flex-col gap-[10px]">
            {finalists.map(f => (
              <div
                key={f.label}
                className="flex items-center gap-[11px] py-[12px] px-[14px] rounded-[10px] bg-cms-surface-hover"
                style={{ border: `1px solid ${f.color}55` }}
              >
                <div className="w-[64px] shrink-0 rounded-[6px] overflow-hidden">
                  <div
                    className="w-full aspect-video rounded-[6px] overflow-hidden relative"
                    style={{ background: THUMB_BG[f.label] ?? THUMB_BG.A, boxShadow: 'rgba(0,0,0,0.4) 0 0 60px inset' }}
                  >
                    <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.024) 0px, rgba(255,255,255,0.024) 2px, transparent 2px, transparent 9px)' }} />
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-[7px]">
                    <VChip label={f.label} size={18} />
                    <span className="font-mono text-[12px] font-bold" style={{ color: f.color }}>
                      {(f.ctr * 100).toFixed(1)}% CTR
                    </span>
                  </div>
                  <div className="text-[11px] text-cms-text-dim mt-[4px] whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px]">
                    {f.label === 'B' ? 'Gastei R$50 em Comida de Rua ...' : 'Comi na Rua por 24h e Quase N...'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer reason */}
      <div className="py-[14px] px-[22px] border-t border-cms-border text-[12px] text-cms-text-dim leading-[1.5] flex items-center gap-[9px]">
        <Target size={15} style={{ color: COWORK }} className="shrink-0" aria-hidden="true" />
        {reason}
      </div>
    </div>
  )
}
