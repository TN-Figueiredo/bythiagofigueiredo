'use client'

import { useState } from 'react'
import type { DisplayLabel } from '@/lib/youtube/ab-types'
import { VARIANT_COLORS } from './ab-constants'
import { VChip, Badge } from './ab-primitives'
import { LayoutGrid, Search, ListVideo, Smartphone, MousePointerClick } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface ClickMomentProps {
  videoTitle: string
  winnerLabel: DisplayLabel
  winnerColor: string
  variants: Array<{ label: DisplayLabel; color: string; ctr: number }>
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

type Mode = 'compare' | 'feed'
type Context = 'home' | 'search' | 'sidebar' | 'mobile'

const CONTEXT_BUTTONS: Array<{ ctx: Context; icon: typeof LayoutGrid; label: string }> = [
  { ctx: 'home', icon: LayoutGrid, label: 'Home' },
  { ctx: 'search', icon: Search, label: 'Busca' },
  { ctx: 'sidebar', icon: ListVideo, label: 'Sugeridos' },
  { ctx: 'mobile', icon: Smartphone, label: 'Mobile' },
]

/* Mock card data per variant */
const CARD_MOCK: Record<'A' | 'B', {
  overlayLines: string[]
  thumbGradient: string
  overlayBg: string
  duration: string
  views: string
  age: string
}> = {
  A: {
    overlayLines: ['RAMEN DE', 'TÓQUIO'],
    thumbGradient: 'linear-gradient(135deg, #E8823C22 0%, #E8823C11 50%, transparent 100%)',
    overlayBg: 'radial-gradient(circle at 40% 45%, #E8823C33 0%, transparent 60%)',
    duration: '12:48',
    views: '12 mil visualizações',
    age: 'há 2 dias',
  },
  B: {
    overlayLines: ['FILA DE', '3 HORAS'],
    thumbGradient: 'linear-gradient(135deg, #E8823C33 0%, #E8823C11 50%, transparent 100%)',
    overlayBg: 'radial-gradient(circle at 40% 45%, #E8823C44 0%, transparent 60%)',
    duration: '12:48',
    views: '12 mil visualizações',
    age: 'há 2 dias',
  },
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

/** YouTube-style thumbnail with gradient bg + text overlay */
function Thumb({ variant }: { variant: 'A' | 'B' }) {
  const mock = CARD_MOCK[variant]
  return (
    <div
      className="relative overflow-hidden"
      style={{ aspectRatio: '16/9', borderRadius: 10 }}
    >
      {/* Gradient bg */}
      <div className="absolute inset-0" style={{ background: mock.thumbGradient }} />
      <div className="absolute inset-0" style={{ background: mock.overlayBg }} />
      {/* Texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, transparent, transparent 8px, currentColor 8px, currentColor 9px)',
        }}
      />
      {/* Overlay text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {mock.overlayLines.map((line) => (
          <span
            key={line}
            className="uppercase text-white/80 leading-tight"
            style={{
              fontWeight: 900,
              fontSize: 'clamp(13px, 3.1vw, 22px)',
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}
          >
            {line}
          </span>
        ))}
      </div>
      {/* Duration chip */}
      <span
        className="absolute bottom-[6px] right-[6px] px-[5px] py-[2px] rounded bg-black/80 text-white"
        style={{
          fontFamily: 'var(--font-jetbrains, monospace)',
          fontSize: '10.5px',
          fontWeight: 600,
        }}
      >
        {mock.duration}
      </span>
    </div>
  )
}

/** Channel info row below the thumbnail */
function ChannelRow() {
  return (
    <div className="flex gap-[8px] mt-[10px]">
      {/* Avatar circle */}
      <div
        className="shrink-0 flex items-center justify-center rounded-full"
        style={{
          width: 34,
          height: 34,
          backgroundColor: 'var(--cms-accent)',
        }}
      >
        <span
          className="text-white"
          style={{
            fontFamily: 'var(--font-fraunces, serif)',
            fontSize: '13px',
            fontWeight: 700,
          }}
        >
          TF
        </span>
      </div>
      {/* Text */}
      <div className="flex flex-col min-w-0">
        <p
          className="text-[var(--cms-text)] line-clamp-2 leading-snug"
          style={{ fontSize: '14px', fontWeight: 600 }}
        >
          Como Fazer o Ramen Perfeito em Tóquio
        </p>
        <p
          className="text-[var(--cms-text-muted)]"
          style={{ fontSize: '12.5px' }}
        >
          ByThiagoFigueiredo
        </p>
        <p
          className="text-[var(--cms-text-dim)]"
          style={{ fontSize: '12.5px' }}
        >
          12 mil visualizações &middot; há 2 dias
        </p>
      </div>
    </div>
  )
}

/** The bar strip at the bottom of each card: VChip + progress bar + CTR + delta */
function CardBehaviorStrip({
  label,
  color,
  ctr,
  maxCtr,
  isWinner,
  delta,
}: {
  label: DisplayLabel
  color: string
  ctr: number
  maxCtr: number
  isWinner: boolean
  delta?: number
}) {
  const barWidth = maxCtr > 0 ? Math.min(100, (ctr / maxCtr) * 100) : 0

  return (
    <div
      className="flex items-center gap-[8px] pt-[10px]"
      style={{ borderTop: '1px solid var(--cms-border)' }}
    >
      <VChip label={label} size={22} ring={isWinner} />
      {/* Progress bar */}
      <div
        className="flex-1 overflow-hidden"
        style={{
          height: 6,
          borderRadius: 99,
          backgroundColor: 'var(--cms-surface)',
        }}
      >
        <div
          className="h-full transition-all duration-[600ms] ease-out"
          style={{
            width: `${barWidth}%`,
            borderRadius: 99,
            backgroundColor: color,
          }}
        />
      </div>
      {/* CTR value */}
      <span
        style={{
          fontSize: '15px',
          fontWeight: 700,
          fontFamily: 'var(--font-jetbrains, monospace)',
          color: 'var(--cms-text)',
        }}
      >
        {ctr.toFixed(1)}%
      </span>
      {/* Lift delta */}
      {delta != null && (
        <span
          style={{
            fontSize: '12.5px',
            fontWeight: 600,
            color: 'var(--cms-green)',
          }}
        >
          +{delta}%
        </span>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export function ClickMoment({ videoTitle, winnerLabel, winnerColor, variants }: ClickMomentProps) {
  const [mode, setMode] = useState<Mode>('compare')
  const [context, setContext] = useState<Context>('home')

  // Only handle 2 variants (A and B)
  const a = variants.find((v) => v.label === 'A')
  const b = variants.find((v) => v.label === 'B')
  if (!a || !b) return null

  const maxCtr = Math.max(a.ctr, b.ctr, 0.01)
  const liftPercent = a.ctr > 0 ? Math.round(((b.ctr - a.ctr) / a.ctr) * 100) : 0

  return (
    <section className="space-y-[16px]">
      {/* ---- Header row ---- */}
      <div className="flex items-center justify-between gap-[12px] flex-wrap">
        <div className="flex items-center gap-[8px]">
          <MousePointerClick
            size={17}
            className="text-[var(--cms-accent)] shrink-0"
            aria-hidden="true"
          />
          <div>
            <h3
              className="text-[var(--cms-text)]"
              style={{ fontSize: '20px', fontWeight: 700, lineHeight: 1.2 }}
            >
              O momento de clique
            </h3>
            <p
              className="text-[var(--cms-text-dim)]"
              style={{ fontSize: '13px', marginTop: 2 }}
            >
              Compare como as thumbnails aparecem no YouTube
            </p>
          </div>
        </div>

        {/* Mode toggle (Comparar / No feed) */}
        <div
          className="inline-flex items-center"
          style={{
            background: 'var(--cms-surface-3, var(--cms-surface))',
            borderRadius: 9,
            padding: 3,
            gap: 2,
          }}
        >
          {(['compare', 'feed'] as const).map((m) => {
            const active = m === mode
            const label = m === 'compare' ? 'Comparar' : 'No feed'
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="transition-colors duration-150"
                style={{
                  padding: '6px 13px',
                  borderRadius: 7,
                  fontSize: '12.5px',
                  fontWeight: 600,
                  background: active ? 'var(--cms-accent)' : 'transparent',
                  color: active ? '#1A1714' : 'var(--cms-text-dim)',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ---- Context buttons row ---- */}
      <div className="flex gap-[6px]" role="radiogroup" aria-label="Contexto YouTube">
        {CONTEXT_BUTTONS.map(({ ctx, icon: Icon, label }) => {
          const active = ctx === context
          return (
            <button
              key={ctx}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setContext(ctx)}
              className="inline-flex items-center gap-[6px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cms-accent)]"
              style={{
                padding: '7px 13px',
                borderRadius: 8,
                fontSize: '13px',
                fontWeight: 600,
                border: active
                  ? '1px solid var(--cms-accent)'
                  : '1px solid var(--cms-border)',
                background: active
                  ? 'var(--cms-accent-subtle)'
                  : 'var(--cms-surface)',
                color: active
                  ? 'var(--cms-accent)'
                  : 'var(--cms-text-dim)',
                cursor: 'pointer',
              }}
            >
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          )
        })}
      </div>

      {/* ---- Cards grid (Compare mode only — hardcoded) ---- */}
      <div
        className="grid"
        style={{ gridTemplateColumns: '1fr 1fr', gap: 22 }}
      >
        {/* Card A (Original) */}
        <div
          className="relative overflow-hidden"
          style={{
            background: 'var(--cms-surface)',
            border: '1px solid var(--cms-border)',
            borderRadius: 14,
            padding: 16,
          }}
        >
          <Thumb variant="A" />
          <ChannelRow />
          <div className="mt-[12px]">
            <CardBehaviorStrip
              label="A"
              color={a.color}
              ctr={a.ctr}
              maxCtr={maxCtr}
              isWinner={false}
            />
          </div>
        </div>

        {/* Card B (Winner) */}
        <div
          className="relative overflow-hidden"
          style={{
            background: 'var(--cms-surface)',
            border: '1px solid rgba(232,130,60,0.4)',
            borderRadius: 14,
            padding: 16,
          }}
        >
          {/* Winner badge */}
          <div className="absolute z-10" style={{ top: 14, right: 14 }}>
            <Badge tone="green">
              <span aria-hidden="true">🏆</span> VENCEDOR
            </Badge>
          </div>

          <Thumb variant="B" />
          <ChannelRow />
          <div className="mt-[12px]">
            <CardBehaviorStrip
              label="B"
              color={b.color}
              ctr={b.ctr}
              maxCtr={maxCtr}
              isWinner
              delta={liftPercent > 0 ? liftPercent : undefined}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
