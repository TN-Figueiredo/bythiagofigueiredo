'use client'

import { useState } from 'react'
import type { DisplayLabel } from '@/lib/youtube/ab-types'
import { brDec } from '@/lib/youtube/format'
import { VChip, Badge } from './ab-primitives'
import { LayoutGrid, Search, ListVideo, Smartphone, MousePointerClick, Trophy } from 'lucide-react'

interface ClickMomentProps {
  videoTitle: string
  winnerLabel: DisplayLabel
  winnerColor: string
  variants: Array<{ label: DisplayLabel; color: string; ctr: number; thumbUrl?: string | null }>
}

type Context = 'home' | 'search' | 'sidebar' | 'mobile'

const OVERLAY_TEXT: Record<DisplayLabel, string[]> = {
  A: ['RAMEN DE', 'TÓQUIO'],
  B: ['FILA DE', '3 HORAS'],
  C: ['STREET', 'FOOD'],
  D: ['TOP 10', 'SPOTS'],
}

const THUMB_BG: Record<DisplayLabel, string> = {
  A: 'linear-gradient(135deg, rgb(58,47,40), rgb(31,26,22))',
  B: 'linear-gradient(135deg, rgb(90,47,23), rgb(36,16,8))',
  C: 'linear-gradient(135deg, rgb(30,60,55), rgb(18,35,30))',
  D: 'linear-gradient(135deg, rgb(50,35,70), rgb(25,18,40))',
}

const CTX_BUTTONS: Array<{ ctx: Context; icon: typeof LayoutGrid; label: string }> = [
  { ctx: 'home', icon: LayoutGrid, label: 'Home' },
  { ctx: 'search', icon: Search, label: 'Busca' },
  { ctx: 'sidebar', icon: ListVideo, label: 'Sugeridos' },
  { ctx: 'mobile', icon: Smartphone, label: 'Mobile' },
]

function YTThumb({ label, radius = 10, thumbUrl }: { label: DisplayLabel; radius?: number; thumbUrl?: string | null }) {
  if (thumbUrl) {
    return (
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/9', borderRadius: radius }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbUrl} alt={`Thumbnail variante ${label}`} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
      </div>
    )
  }
  const overlay = OVERLAY_TEXT[label] ?? [label]
  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/9', borderRadius: radius, background: THUMB_BG[label], boxShadow: 'rgba(0,0,0,0.4) 0 0 60px inset' }}>
      <div className="absolute" style={{ left: '8%', bottom: '-6%', width: '46%', height: '92%', background: 'radial-gradient(at 50% 40%, rgba(255,255,255,0.14), transparent 65%)' }} />
      <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.024) 0px, rgba(255,255,255,0.024) 2px, transparent 2px, transparent 9px)' }} />
      <div className="absolute inset-0 flex flex-col items-end justify-center text-right p-[9px_11px]">
        {overlay.map(line => (
          <span key={line} className="text-white uppercase" style={{ fontWeight: 900, lineHeight: 0.96, letterSpacing: '-0.02em', fontSize: 'clamp(13px, 3.1vw, 22px)', textShadow: 'rgba(0,0,0,0.7) 0 2px 8px, rgba(0,0,0,0.9) 0 0 2px' }}>{line}</span>
        ))}
      </div>
      <span className="absolute right-[6px] bottom-[6px] bg-black/80 text-white font-mono text-[10.5px] font-semibold px-[5px] py-px rounded">12:48</span>
    </div>
  )
}

function BehaviorStrip({ label, color, ctr, maxCtr, isWinner, lift }: { label: DisplayLabel; color: string; ctr: number; maxCtr: number; isWinner: boolean; lift: number | null }) {
  const barWidth = maxCtr > 0 ? Math.min(100, (ctr / maxCtr) * 100) : 0
  return (
    <div className="flex items-center gap-[11px] pt-[10px] mt-[11px] border-t border-cms-border">
      <VChip label={label} size={22} ring={isWinner} />
      <div className="flex-1 h-[6px] bg-cms-surface-hover rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${barWidth}%`, backgroundColor: color, transition: 'width 0.6s' }} />
      </div>
      <span className="font-mono text-[15px] font-bold text-cms-text">{brDec(ctr, 1)}%</span>
      {lift != null && lift > 0 && (
        <span className="font-mono text-[11.5px] font-semibold text-cms-green w-[46px] text-right">+{lift}%</span>
      )}
    </div>
  )
}

function HomeCard({ v, videoTitle, isWinner, maxCtr, baseline }: { v: { label: DisplayLabel; color: string; ctr: number; thumbUrl?: string | null }; videoTitle: string; isWinner: boolean; maxCtr: number; baseline: number }) {
  const lift = baseline > 0 && v.label !== 'A' ? Math.round(((v.ctr - baseline) / baseline) * 100) : null
  return (
    <div className="relative overflow-hidden rounded-lg bg-cms-surface" style={{ border: isWinner ? `1px solid ${v.color}66` : '1px solid var(--cms-border)', padding: 16 }}>
      {isWinner && <div className="absolute z-10 right-[14px] top-[14px]"><Badge tone="green"><Trophy size={11} aria-hidden="true" />vencedor</Badge></div>}
      <YTThumb label={v.label} thumbUrl={v.thumbUrl} />
      <div className="flex gap-[11px] mt-[11px]">
        <div className="size-[34px] min-w-[34px] rounded-full bg-cms-accent flex items-center justify-center text-[13.6px] font-bold" style={{ color: 'rgb(20, 15, 8)', fontFamily: 'Fraunces, serif' }}>TF</div>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-cms-text leading-[1.3] line-clamp-2">{videoTitle}</div>
          <div className="text-[12.5px] text-cms-text-dim mt-[3px]">ByThiagoFigueiredo</div>
          <div className="text-[12.5px] text-cms-text-dim">12 mil visualizações · há 2 dias</div>
        </div>
      </div>
      <BehaviorStrip label={v.label} color={v.color} ctr={v.ctr} maxCtr={maxCtr} isWinner={isWinner} lift={lift} />
    </div>
  )
}

function SearchCard({ v, videoTitle, isWinner, maxCtr, baseline }: { v: { label: DisplayLabel; color: string; ctr: number; thumbUrl?: string | null }; videoTitle: string; isWinner: boolean; maxCtr: number; baseline: number }) {
  const lift = baseline > 0 && v.label !== 'A' ? Math.round(((v.ctr - baseline) / baseline) * 100) : null
  return (
    <div className="relative overflow-hidden rounded-lg bg-cms-surface" style={{ border: isWinner ? `1px solid ${v.color}66` : '1px solid var(--cms-border)', padding: 16 }}>
      {isWinner && <div className="absolute z-10 right-[14px] top-[14px]"><Badge tone="green"><Trophy size={11} aria-hidden="true" />vencedor</Badge></div>}
      <div className="flex gap-[16px]">
        <div className="w-[340px] shrink-0"><YTThumb label={v.label} thumbUrl={v.thumbUrl} /></div>
        <div className="min-w-0 pt-[2px]">
          <div className="text-[17px] font-semibold text-cms-text leading-[1.25]">{videoTitle}</div>
          <div className="text-[12.5px] text-cms-text-dim mt-[5px]">12 mil visualizações · há 2 dias</div>
          <div className="flex items-center gap-2 my-[9px]">
            <div className="size-[24px] min-w-[24px] rounded-full bg-cms-accent flex items-center justify-center text-[9.6px] font-bold" style={{ color: 'rgb(20, 15, 8)', fontFamily: 'Fraunces, serif' }}>TF</div>
            <span className="text-[12.5px] text-cms-text-dim">ByThiagoFigueiredo</span>
          </div>
          <div className="text-[12.5px] text-cms-text-muted leading-[1.4] line-clamp-2">Fui até o MBK Center em Bangkok pra descobrir se vale a pena. Ouro, ternos sob medida e eletrônicos…</div>
        </div>
      </div>
      <BehaviorStrip label={v.label} color={v.color} ctr={v.ctr} maxCtr={maxCtr} isWinner={isWinner} lift={lift} />
    </div>
  )
}

function SidebarCard({ v, videoTitle, isWinner, maxCtr, baseline }: { v: { label: DisplayLabel; color: string; ctr: number; thumbUrl?: string | null }; videoTitle: string; isWinner: boolean; maxCtr: number; baseline: number }) {
  const lift = baseline > 0 && v.label !== 'A' ? Math.round(((v.ctr - baseline) / baseline) * 100) : null
  return (
    <div className="relative overflow-hidden rounded-lg bg-cms-surface" style={{ border: isWinner ? `1px solid ${v.color}66` : '1px solid var(--cms-border)', padding: 16 }}>
      {isWinner && <div className="absolute z-10 right-[14px] top-[14px]"><Badge tone="green"><Trophy size={11} aria-hidden="true" />vencedor</Badge></div>}
      <div className="flex gap-[10px]">
        <div className="w-[168px] shrink-0"><YTThumb label={v.label} thumbUrl={v.thumbUrl} radius={8} /></div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-cms-text leading-[1.25] line-clamp-2">{videoTitle}</div>
          <div className="text-[11.5px] text-cms-text-dim mt-[5px]">ByThiagoFigueiredo</div>
          <div className="text-[11.5px] text-cms-text-dim">12 mil views · há 2 dias</div>
        </div>
      </div>
      <BehaviorStrip label={v.label} color={v.color} ctr={v.ctr} maxCtr={maxCtr} isWinner={isWinner} lift={lift} />
    </div>
  )
}

function MobileCard({ v, videoTitle, isWinner, maxCtr, baseline }: { v: { label: DisplayLabel; color: string; ctr: number; thumbUrl?: string | null }; videoTitle: string; isWinner: boolean; maxCtr: number; baseline: number }) {
  const lift = baseline > 0 && v.label !== 'A' ? Math.round(((v.ctr - baseline) / baseline) * 100) : null
  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className="w-[300px] overflow-hidden" style={{ border: '8px solid #050505', borderRadius: 34, background: '#0a0a0a', boxShadow: 'rgba(0,0,0,0.7) 0 20px 50px -16px' }}>
        <div className="h-[26px] flex items-center justify-center">
          <div className="w-[70px] h-[16px] bg-[#050505] rounded-full" />
        </div>
        <div className="pb-[14px]">
          <YTThumb label={v.label} thumbUrl={v.thumbUrl} radius={0} />
          <div className="flex gap-[10px] px-[12px] pt-[11px]">
            <div className="size-[32px] min-w-[32px] rounded-full bg-cms-accent flex items-center justify-center text-[12.8px] font-bold" style={{ color: 'rgb(20, 15, 8)', fontFamily: 'Fraunces, serif' }}>TF</div>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold leading-[1.3] line-clamp-2" style={{ color: '#eee' }}>{videoTitle}</div>
              <div className="text-[11.5px] mt-[3px]" style={{ color: '#9a958c' }}>ByThiagoFigueiredo · 12 mil · há 2 dias</div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-[12px]">
        <BehaviorStrip label={v.label} color={v.color} ctr={v.ctr} maxCtr={maxCtr} isWinner={isWinner} lift={lift} />
      </div>
    </div>
  )
}

const GRID_COLS: Record<Context, string> = {
  home: '1fr 1fr',
  search: '1fr',
  sidebar: '1fr',
  mobile: 'repeat(auto-fit, 300px)',
}

const GRID_JUSTIFY: Record<Context, string | undefined> = {
  home: undefined,
  search: undefined,
  sidebar: undefined,
  mobile: 'center',
}

export function ClickMoment({ videoTitle, winnerLabel, winnerColor, variants }: ClickMomentProps) {
  const [mode, setMode] = useState<'compare' | 'feed'>('compare')
  const [context, setContext] = useState<Context>('home')

  const maxCtr = Math.max(...variants.map(v => v.ctr), 0.01)
  const baseline = variants.find(v => v.label === 'A')?.ctr ?? 0

  const displayVariants = context === 'home' ? variants : variants.filter(v => v.label === 'A' || v.label === winnerLabel)

  const CardComponent = { home: HomeCard, search: SearchCard, sidebar: SidebarCard, mobile: MobileCard }[context]

  return (
    <section className="space-y-[16px]">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-[14px] mb-[18px]">
        <div>
          <div className="flex items-center gap-[9px]">
            <MousePointerClick size={17} className="text-cms-accent shrink-0" aria-hidden="true" />
            <h3 className="text-[20px] font-semibold text-cms-text m-0">O momento de clique</h3>
          </div>
          <p className="text-[13px] text-cms-text-dim mt-[6px] max-w-[520px] m-0">
            É assim que cada variante disputa a atenção do espectador. Compare lado a lado — e cruze com o comportamento (CTR).
          </p>
        </div>
        <div className="inline-flex bg-cms-surface-hover rounded-[9px] p-[3px] gap-[2px]">
          {(['compare', 'feed'] as const).map(m => (
            <button key={m} type="button" onClick={() => setMode(m)} className="border-none cursor-pointer transition-[0.15s]" style={{ padding: '6px 13px', borderRadius: 7, fontSize: '12.5px', fontWeight: 600, background: m === mode ? 'var(--cms-accent)' : 'transparent', color: m === mode ? 'rgb(20, 15, 8)' : 'var(--cms-text-dim)' }}>
              {m === 'compare' ? 'Comparar' : 'No feed'}
            </button>
          ))}
        </div>
      </div>

      {/* Context buttons */}
      <div className="flex gap-[6px] mb-[18px] flex-wrap">
        {CTX_BUTTONS.map(({ ctx, icon: Icon, label }) => {
          const active = ctx === context
          return (
            <button key={ctx} type="button" onClick={() => setContext(ctx)} className="inline-flex items-center gap-[7px] cursor-pointer transition-[0.15s] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cms-accent" style={{ padding: '7px 13px', borderRadius: 8, fontSize: '13px', fontWeight: 600, border: active ? '1px solid var(--cms-accent)' : '1px solid var(--cms-border)', background: active ? 'var(--cms-accent-subtle)' : 'var(--cms-surface)', color: active ? 'var(--cms-accent)' : 'var(--cms-text-dim)' }}>
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          )
        })}
      </div>

      {/* Cards grid */}
      <div className="grid gap-[22px]" style={{ gridTemplateColumns: GRID_COLS[context], justifyContent: GRID_JUSTIFY[context] }}>
        {displayVariants.map(v => (
          <CardComponent key={v.label} v={v} videoTitle={videoTitle} isWinner={v.label === winnerLabel} maxCtr={maxCtr} baseline={baseline} />
        ))}
      </div>
    </section>
  )
}
