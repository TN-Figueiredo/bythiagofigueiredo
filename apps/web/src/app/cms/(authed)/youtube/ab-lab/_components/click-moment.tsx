'use client'

import { useState } from 'react'
import type { DisplayLabel } from '@/lib/youtube/ab-types'
import { brDec } from '@/lib/youtube/format'
import { VChip, Badge } from './ab-primitives'
import { LayoutGrid, Search, ListVideo, Smartphone, MousePointerClick, Trophy } from 'lucide-react'
import './ab-end-test-dialog.css'

interface ClickMomentProps {
  winnerLabel: DisplayLabel
  winnerColor: string
  variants: Array<{ label: DisplayLabel; color: string; ctr: number | null; thumbUrl: string | null; title: string }>
  /** Esconde a barra de CTR/lift (sem medição de entrega o número seria inventado). */
  semCtr?: boolean
  /** Prévia do wizard: ninguém venceu ainda, então sem selo de vencedor e todas as variantes em todos os contextos. */
  semVencedor?: boolean
  /** Dado real do vídeo; ausente (null) some da tela, nunca vira número de exemplo. */
  meta: { canal: string | null; publicadoEm: string | null; duracao: string | null }
  /** Frase do apoio: o que este teste muda (`descricaoDaPrevia`). */
  descricao: string
  /** Variante sem thumbnail oferece "Escolher da Biblioteca". */
  onEscolherDaBiblioteca?: (label: DisplayLabel) => void
}

type Context = 'home' | 'search' | 'sidebar' | 'mobile'
type CardVariant = ClickMomentProps['variants'][number]
type Meta = ClickMomentProps['meta']

const CTX_BUTTONS: Array<{ ctx: Context; icon: typeof LayoutGrid; label: string }> = [
  { ctx: 'home', icon: LayoutGrid, label: 'Home' },
  { ctx: 'search', icon: Search, label: 'Busca' },
  { ctx: 'sidebar', icon: ListVideo, label: 'Sugeridos' },
  { ctx: 'mobile', icon: Smartphone, label: 'Mobile' },
]

function YTThumb({ v, radius = 10, duracao, onEscolherDaBiblioteca }: { v: CardVariant; radius?: number; duracao: string | null; onEscolherDaBiblioteca?: (label: DisplayLabel) => void }) {
  if (v.thumbUrl) {
    return (
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/9', borderRadius: radius }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={v.thumbUrl} alt={`Thumbnail variante ${v.label}`} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
        {duracao && <span className="absolute right-[6px] bottom-[6px] font-mono text-[12px] leading-4 font-semibold px-[5px] rounded" style={{ background: 'rgba(0,0,0,.8)', color: '#fff' }}>{duracao}</span>}
      </div>
    )
  }
  return (
    <div
      className="semimg flex flex-col items-center justify-center gap-[4px] w-full overflow-hidden text-center text-[12px] leading-[14px]"
      style={{ aspectRatio: '16/9', borderRadius: radius, border: '1px dashed var(--etd-ctl)', color: 'var(--cms-text-muted)', background: 'var(--cms-surface-hover)' }}
    >
      <span>Sem thumbnail</span>
      {onEscolherDaBiblioteca && v.label !== 'A' && (
        <button
          type="button"
          onClick={() => onEscolherDaBiblioteca(v.label)}
          className="cursor-pointer text-[12px] font-medium"
          style={{ minHeight: 44, padding: '0 10px', borderRadius: 8, border: '1px dashed var(--cms-border-strong, var(--cms-border))', background: 'none', color: 'var(--cms-text)' }}
        >
          Escolher da Biblioteca
        </button>
      )}
    </div>
  )
}

/** Linha acima da miniatura: chip da variante + "Original"/"Variante X". */
function Rotulo({ label }: { label: DisplayLabel }) {
  return (
    <div className="cml flex items-center gap-2 mb-[10px] text-[12.5px] font-semibold text-cms-text">
      <VChip label={label} size={22} />
      <span>{label === 'A' ? 'Original' : `Variante ${label}`}</span>
    </div>
  )
}

function MetaLinhas({ meta, small }: { meta: Meta; small?: boolean }) {
  const cls = small ? 'text-[12px] text-cms-text-dim' : 'text-[12.5px] text-cms-text-dim'
  return (
    <>
      {meta.canal && <div className={`${cls} mt-[3px]`}>@{meta.canal}</div>}
      {meta.publicadoEm && <div className={cls}>Publicado em {meta.publicadoEm}</div>}
    </>
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

interface CardProps {
  v: CardVariant
  isWinner: boolean
  maxCtr: number
  baseline: number | null
  semCtr?: boolean
  meta: Meta
  onEscolherDaBiblioteca?: (label: DisplayLabel) => void
}

function liftDe(v: CardVariant, baseline: number | null): number | null {
  return baseline !== null && v.ctr !== null && baseline > 0 && v.label !== 'A' ? Math.round(((v.ctr - baseline) / baseline) * 100) : null
}

function Strip({ v, isWinner, maxCtr, baseline, semCtr }: Pick<CardProps, 'v' | 'isWinner' | 'maxCtr' | 'baseline' | 'semCtr'>) {
  if (semCtr || v.ctr === null) return null
  return <BehaviorStrip label={v.label} color={v.color} ctr={v.ctr} maxCtr={maxCtr} isWinner={isWinner} lift={liftDe(v, baseline)} />
}

function Selo({ v, isWinner }: { v: CardVariant; isWinner: boolean }) {
  if (!isWinner) return null
  return <div className="absolute z-10 right-[14px] top-[14px]"><Badge tone="green"><Trophy size={11} aria-hidden="true" />vencedor</Badge></div>
}

function cardStyle(v: CardVariant, isWinner: boolean) {
  return { border: isWinner ? `1px solid ${v.color}66` : '1px solid var(--cms-border)', padding: 16 }
}

function HomeCard(p: CardProps) {
  const { v, isWinner, meta } = p
  return (
    <div className="relative overflow-hidden rounded-lg bg-cms-surface" style={cardStyle(v, isWinner)}>
      <Selo v={v} isWinner={isWinner} />
      <Rotulo label={v.label} />
      <YTThumb v={v} duracao={meta.duracao} onEscolherDaBiblioteca={p.onEscolherDaBiblioteca} />
      <div className="mt-[11px] min-w-0">
        <div className="text-[14px] font-semibold text-cms-text leading-[1.3] line-clamp-3">{v.title}</div>
        <MetaLinhas meta={meta} />
      </div>
      <Strip {...p} />
    </div>
  )
}

function SearchCard(p: CardProps) {
  const { v, isWinner, meta } = p
  return (
    <div className="relative overflow-hidden rounded-lg bg-cms-surface" style={cardStyle(v, isWinner)}>
      <Selo v={v} isWinner={isWinner} />
      <Rotulo label={v.label} />
      <div className="flex flex-col sm:flex-row gap-[16px]">
        <div className="w-full sm:w-[340px] shrink-0"><YTThumb v={v} duracao={meta.duracao} onEscolherDaBiblioteca={p.onEscolherDaBiblioteca} /></div>
        <div className="min-w-0 pt-[2px]">
          <div className="text-[17px] font-semibold text-cms-text leading-[1.25] line-clamp-3">{v.title}</div>
          <MetaLinhas meta={meta} />
        </div>
      </div>
      <Strip {...p} />
    </div>
  )
}

function SidebarCard(p: CardProps) {
  const { v, isWinner, meta } = p
  return (
    <div className="relative overflow-hidden rounded-lg bg-cms-surface" style={cardStyle(v, isWinner)}>
      <Selo v={v} isWinner={isWinner} />
      <Rotulo label={v.label} />
      <div className="flex gap-[10px]">
        <div className="w-[168px] shrink-0"><YTThumb v={v} radius={8} duracao={meta.duracao} onEscolherDaBiblioteca={p.onEscolherDaBiblioteca} /></div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-cms-text leading-[1.25] line-clamp-2">{v.title}</div>
          <MetaLinhas meta={meta} small />
        </div>
      </div>
      <Strip {...p} />
    </div>
  )
}

function MobileCard(p: CardProps) {
  const { v, meta } = p
  return (
    <div className="relative overflow-hidden rounded-lg">
      <Rotulo label={v.label} />
      <div className="w-[300px] overflow-hidden" style={{ border: '8px solid #050505', borderRadius: 34, background: '#0a0a0a', boxShadow: 'rgba(0,0,0,0.7) 0 20px 50px -16px' }}>
        <div className="h-[26px] flex items-center justify-center">
          <div className="w-[70px] h-[16px] bg-[#050505] rounded-full" />
        </div>
        <div className="pb-[14px]">
          <YTThumb v={v} radius={0} duracao={meta.duracao} onEscolherDaBiblioteca={p.onEscolherDaBiblioteca} />
          <div className="px-[12px] pt-[11px] min-w-0">
            <div className="text-[13.5px] font-semibold leading-[1.3] line-clamp-2" style={{ color: '#eee' }}>{v.title}</div>
            {meta.canal && <div className="text-[12px] mt-[3px]" style={{ color: '#a8a39a' }}>@{meta.canal}</div>}
            {meta.publicadoEm && <div className="text-[12px]" style={{ color: '#a8a39a' }}>Publicado em {meta.publicadoEm}</div>}
          </div>
        </div>
      </div>
      <div className="mt-[12px]">
        <Strip {...p} />
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

export function ClickMoment({ winnerLabel, variants, semCtr, semVencedor, meta, descricao, onEscolherDaBiblioteca }: ClickMomentProps) {
  const [context, setContext] = useState<Context>('home')

  const maxCtr = Math.max(...variants.flatMap(v => (v.ctr === null ? [] : [v.ctr])), 0.01)
  const baseline = variants.find(v => v.label === 'A')?.ctr ?? null

  // Com a prévia do assistente (sem vencedor) todos os contextos mostram todas as variantes; no resultado, fora da Home só A e o vencedor.
  const displayVariants = context === 'home' || semVencedor ? variants : variants.filter(v => v.label === 'A' || v.label === winnerLabel)

  const CardComponent = { home: HomeCard, search: SearchCard, sidebar: SidebarCard, mobile: MobileCard }[context]

  return (
    <section className="space-y-[16px] etd-tok">
      <div className="mb-[18px]">
        <div className="flex items-center gap-[9px]">
          <MousePointerClick size={17} className="text-cms-accent shrink-0" aria-hidden="true" />
          <h3 className="text-[20px] font-semibold text-cms-text m-0">O momento de clique</h3>
        </div>
        <p className="text-[13px] text-cms-text-dim mt-[6px] max-w-[520px] m-0">
          É assim que cada variante aparece para o espectador. {descricao}
        </p>
      </div>

      {/* Context buttons */}
      <div className="flex gap-[6px] mb-[18px] flex-wrap">
        {CTX_BUTTONS.map(({ ctx, icon: Icon, label }) => {
          const active = ctx === context
          return (
            <button key={ctx} type="button" aria-pressed={active} onClick={() => setContext(ctx)} className="inline-flex items-center gap-[7px] cursor-pointer transition-[0.15s] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cms-accent" style={{ minHeight: 44, padding: '6px 13px', borderRadius: 9, fontSize: '12.5px', fontWeight: 600, border: active ? '1px solid var(--cms-accent)' : '1px solid var(--cms-border)', background: active ? 'var(--cms-accent-subtle)' : 'transparent', color: active ? 'var(--cms-text)' : 'var(--cms-text-dim)' }}>
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          )
        })}
      </div>

      {/* Cards grid */}
      <div className="grid gap-[22px]" style={{ gridTemplateColumns: GRID_COLS[context], justifyContent: GRID_JUSTIFY[context] }}>
        {displayVariants.map(v => (
          <CardComponent key={v.label} v={v} isWinner={!semVencedor && v.label === winnerLabel} maxCtr={maxCtr} baseline={baseline} semCtr={semCtr} meta={meta} onEscolherDaBiblioteca={onEscolherDaBiblioteca} />
        ))}
      </div>
    </section>
  )
}
