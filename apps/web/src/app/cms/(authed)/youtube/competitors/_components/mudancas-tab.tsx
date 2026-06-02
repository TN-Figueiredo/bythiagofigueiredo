'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { Search, Bookmark, ChevronRight, ChevronDown, ChevronUp, ZoomIn, ArrowRight, X, Filter, FlaskConical, RotateCcw, Image, List, MessageSquare } from 'lucide-react'
import { YtPortal } from '../../_components/yt-portal'
import { useModalFocusTrap } from '../../../_shared/editor/use-modal-focus-trap'
import { fmtC, fmtRelative } from '@/lib/youtube/format'
import { toggleBookmark } from '../actions'
import type { CompetitorChangeView } from '@/lib/youtube/observatory-types'

interface MudancasTabProps {
  changes: CompetitorChangeView[]
  channelNames: string[]
}

type ChangeTypeFilter = 'all' | 'title' | 'thumbnail' | 'description'

function handleKeyAction(e: React.KeyboardEvent, fn: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fn()
  }
}

const TYPE_LABELS: Record<string, string> = {
  thumbnail: 'Thumbnail',
  title: 'Título',
  description: 'Descrição',
}

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  thumbnail: { bg: 'var(--purple-soft)', color: 'var(--purple)' },
  title: { bg: 'var(--blue-soft)', color: 'var(--blue)' },
  description: { bg: 'var(--amber-soft)', color: 'var(--amber)' },
}

export function MudancasTab({ changes, channelNames }: MudancasTabProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ChangeTypeFilter>('all')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [onlyBookmarked, setOnlyBookmarked] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [zoomChange, setZoomChange] = useState<CompetitorChangeView | null>(null)

  const filtered = useMemo(() => {
    return changes.filter(c => {
      if (typeFilter !== 'all' && c.changeType !== typeFilter) return false
      if (channelFilter !== 'all' && c.channelName !== channelFilter) return false
      if (onlyBookmarked && !c.bookmarked) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !c.videoTitle?.toLowerCase().includes(q) &&
          !c.channelName.toLowerCase().includes(q) &&
          !c.oldTitle?.toLowerCase().includes(q) &&
          !c.newTitle?.toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [changes, typeFilter, channelFilter, onlyBookmarked, search])

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<string, CompetitorChangeView[]>()
    for (const c of filtered) {
      const day = new Date(c.detectedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
      const list = map.get(day) ?? []
      list.push(c)
      map.set(day, list)
    }
    return [...map.entries()]
  }, [filtered])

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isFiltered = typeFilter !== 'all' || channelFilter !== 'all' || onlyBookmarked || search.length > 0

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* md-filterbar */}
      <div className="md-filterbar flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative" style={{ minWidth: 200, maxWidth: 320, flex: '1 1 200px' }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-dim)' }} aria-hidden="true" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar mudanças..."
            className="w-full rounded-[9px] py-2 pl-9 pr-3 text-xs"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />
        </div>

        {/* Type select */}
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as ChangeTypeFilter)}
          className="md-select rounded-[9px] px-3 py-2 text-xs"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          <option value="all">Todos os tipos</option>
          <option value="thumbnail">Thumbnail</option>
          <option value="title">Título</option>
          <option value="description">Descrição</option>
        </select>

        {/* Channel select */}
        <select
          value={channelFilter}
          onChange={e => setChannelFilter(e.target.value)}
          className="md-select rounded-[9px] px-3 py-2 text-xs"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          <option value="all">Todos os canais</option>
          {channelNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        {/* Only bookmarked chip */}
        <button
          className={`chip ${onlyBookmarked ? 'on' : ''}`}
          onClick={() => setOnlyBookmarked(v => !v)}
        >
          <Bookmark className="h-3 w-3" aria-hidden="true" />
          Só marcados
        </button>
      </div>

      {/* Context band */}
      {isFiltered && (
        <div
          className="md-context flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: 'var(--accent-soft)', color: 'var(--text)', border: '1px solid var(--accent-line)' }}
        >
          <Filter className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          Mostrando {filtered.length} de {changes.length} mudanças
          <button
            className="ml-auto text-[10px] underline"
            onClick={() => { setSearch(''); setTypeFilter('all'); setChannelFilter('all'); setOnlyBookmarked(false) }}
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* Timeline grouped by day */}
      {grouped.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--text-dim)' }}>
          <p className="text-sm">Nenhuma mudança encontrada.</p>
          {isFiltered && <p className="text-xs mt-1">Tente ajustar os filtros.</p>}
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: 12 }}>
          {grouped.map(([day, dayChanges]) => (
            <div key={day} className="change-group">
              <div className="change-day">
                <span className="eyebrow">{day}</span>
                <div className="change-day-line" />
              </div>
              <div className="flex flex-col" style={{ gap: 12 }}>
                {dayChanges.map(c => (
                  <ChangeCard
                    key={c.id}
                    change={c}
                    expanded={expandedIds.has(c.id)}
                    onToggleExpand={() => toggleExpand(c.id)}
                    onZoom={() => setZoomChange(c)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zoom modal */}
      {zoomChange && (
        <ZoomModal change={zoomChange} onClose={() => setZoomChange(null)} />
      )}
    </div>
  )
}

/* ── Palette: deterministic color per channel name (same as channel-card) ── */

const CHANNEL_COLORS = [
  '#E8753A',
  '#A78BFA',
  '#60A5FA',
  '#F472B6',
  '#34D399',
  '#FBBF24',
  '#F87171',
  '#818CF8',
]

function colorFor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return CHANNEL_COLORS[Math.abs(h) % CHANNEL_COLORS.length]!
}

const CHANGE_TYPE_ICON: Record<string, typeof Image> = {
  thumbnail: Image,
  title: List,
  description: MessageSquare,
}

const BADGE_VARIANT: Record<string, string> = {
  thumbnail: 'purple',
  title: 'blue',
  description: 'amber',
}

/** Count changes by type across the main change + its full history. */
function countByType(c: CompetitorChangeView): Record<string, number> {
  const counts: Record<string, number> = {}
  const all = [c, ...c.history]
  for (const ev of all) {
    counts[ev.changeType] = (counts[ev.changeType] ?? 0) + 1
  }
  return counts
}

/** Check if probable AB test (2+ changes in 14 days). */
function isProbableAbTest(c: CompetitorChangeView): boolean {
  const total = 1 + c.history.length
  if (total < 2) return false
  const all = [c, ...c.history]
  const dates = all.map(ev => new Date(ev.detectedAt).getTime())
  const range = Math.max(...dates) - Math.min(...dates)
  return range <= 14 * 24 * 60 * 60 * 1000
}

function ChangeCard({
  change: c,
  expanded,
  onToggleExpand,
  onZoom,
}: {
  change: CompetitorChangeView
  expanded: boolean
  onToggleExpand: () => void
  onZoom: () => void
}) {
  const [optimisticBookmark, setOptimisticBookmark] = useState(c.bookmarked)
  const channelColor = colorFor(c.channelName)
  const totalChanges = 1 + c.history.length
  const abTest = isProbableAbTest(c)
  const typeCounts = countByType(c)

  const handleBookmark = async () => {
    setOptimisticBookmark(v => !v)
    await toggleBookmark(c.id)
  }

  // Build summary string: "N trocas de thumbnail · N trocas de titulo"
  const summaryParts: string[] = []
  if (typeCounts['thumbnail']) summaryParts.push(`${typeCounts['thumbnail']} troca${typeCounts['thumbnail']! > 1 ? 's' : ''} de thumbnail`)
  if (typeCounts['title']) summaryParts.push(`${typeCounts['title']} troca${typeCounts['title']! > 1 ? 's' : ''} de titulo`)
  if (typeCounts['description']) summaryParts.push(`${typeCounts['description']} troca${typeCounts['description']! > 1 ? 's' : ''} de descricao`)

  return (
    <div className="md-card">
      {/* Left color rail */}
      <div className="change-rail" style={{ background: channelColor }} />

      {/* Card body */}
      <div className="md-card-body">
        {/* Header row: channel name + badges + bookmark */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap" style={{ minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: channelColor }}>{c.channelName}</span>
            <span className="md-badge">
              <RotateCcw className="h-[11px] w-[11px]" aria-hidden="true" />
              {totalChanges} mudanca{totalChanges > 1 ? 's' : ''}
            </span>
            {abTest && (
              <span className="md-badge amber">
                <FlaskConical className="h-[11px] w-[11px]" aria-hidden="true" />
                Provavel A/B test
              </span>
            )}
          </div>
          <button
            className={`md-mark flex-shrink-0 rounded-lg p-1.5 ${optimisticBookmark ? 'on' : ''}`}
            style={{ border: '1px solid var(--border)' }}
            onClick={handleBookmark}
            aria-label={optimisticBookmark ? 'Remover marcacao' : 'Marcar'}
          >
            <Bookmark style={{ width: 15, height: 15 }} fill={optimisticBookmark ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
        </div>

        {/* Video title */}
        {c.videoTitle && (
          <p style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3, color: 'var(--text)', marginTop: 6 }}>
            {c.videoTitle}
          </p>
        )}

        {/* Meta row: views + published + summary */}
        <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 5 }}>
          {c.viewCountAtChange != null && (
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              {fmtC(c.viewCountAtChange)} views · publicado {fmtRelative(c.detectedAt)}
            </span>
          )}
          {summaryParts.length > 0 && (
            <span className="md-summary">{summaryParts.join(' · ')}</span>
          )}
        </div>

        {/* "Mudanca mais recente" section */}
        <div className="md-latest">
          <span className="section-label">Mudanca mais recente</span>

          <div className="md-ev">
            <ChangeEventInline ev={c} onZoom={onZoom} />
            <span className="mono dim md-ev-time">{fmtRelative(c.detectedAt)}</span>
          </div>
        </div>

        {/* History toggle */}
        {c.history.length > 0 && (
          <>
            <button
              className="md-history-toggle"
              onClick={onToggleExpand}
              aria-expanded={expanded}
            >
              {expanded
                ? <ChevronDown className="h-3 w-3" aria-hidden="true" />
                : <ChevronRight className="h-3 w-3" aria-hidden="true" />
              }
              {expanded ? 'Esconder historico' : `Ver historico completo (${c.history.length})`}
            </button>

            {expanded && (
              <div className="mt-3 ml-2 flex flex-col gap-0" style={{ borderLeft: '2px solid var(--border)', paddingLeft: 14 }}>
                {c.history.map((h, idx) => (
                  <div
                    key={h.id}
                    className="fade-in relative py-2.5"
                    style={{
                      animationDelay: `${idx * 50}ms`,
                      borderBottom: idx < c.history.length - 1 ? '1px solid var(--border-subtle, rgba(255,255,255,0.04))' : 'none',
                    }}
                  >
                    {/* Timeline dot */}
                    <div
                      className="absolute rounded-full"
                      style={{
                        width: 7, height: 7,
                        background: TYPE_COLORS[h.changeType]?.color ?? 'var(--text-muted)',
                        left: -18,
                        top: 14,
                      }}
                      aria-hidden="true"
                    />
                    <div className="md-ev">
                      <ChangeEventInline ev={h} onZoom={onZoom} />
                      <span className="mono dim md-ev-time">{fmtRelative(h.detectedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* CTA button */}
        <div className="flex items-center gap-2" style={{ marginTop: 14 }}>
          <button className="btn primary sm" onClick={onZoom}>
            <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
            Testar esta abordagem
          </button>
        </div>
      </div>
    </div>
  )
}

/** Inline rendering of a single change event (used in "Mudanca mais recente" and history). */
function ChangeEventInline({ ev, onZoom }: { ev: CompetitorChangeView; onZoom: () => void }) {
  const variant = BADGE_VARIANT[ev.changeType] ?? ''
  const Icon = CHANGE_TYPE_ICON[ev.changeType] ?? MessageSquare

  return (
    <>
      <span className={`md-badge ${variant}`}>
        <Icon className="h-[11px] w-[11px]" aria-hidden="true" />
        {TYPE_LABELS[ev.changeType] ?? ev.changeType}
      </span>

      {ev.changeType === 'thumbnail' && (
        <div
          className="md-ev-ba thumbs"
          role="button"
          tabIndex={0}
          onClick={onZoom}
          onKeyDown={e => handleKeyAction(e, onZoom)}
          aria-label="Ampliar comparacao de thumbnail"
        >
          <div className="md-mini-wrap">
            {ev.oldThumbnailUrl ? (
              <img src={ev.oldThumbnailUrl} alt="antes" referrerPolicy="no-referrer" className="md-mini thumb" style={{ opacity: 0.55 }} />
            ) : (
              <div className="md-mini thumb flex items-center justify-center text-[7px]" style={{ background: 'var(--surface-3)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>?</div>
            )}
            <span className="md-mini-label">antes</span>
          </div>
          <ArrowRight className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--text-dim)' }} aria-hidden="true" />
          <div className="md-mini-wrap">
            {ev.newThumbnailUrl ? (
              <img src={ev.newThumbnailUrl} alt="depois" referrerPolicy="no-referrer" className="md-mini thumb after" />
            ) : (
              <div className="md-mini thumb flex items-center justify-center text-[7px]" style={{ background: 'var(--surface-3)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>?</div>
            )}
            <span className="md-mini-label">depois</span>
          </div>
          <ZoomIn className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--text-dim)' }} aria-hidden="true" />
        </div>
      )}

      {ev.changeType === 'title' && ev.oldTitle && ev.newTitle && (
        <div
          className="md-ev-ba text"
          role="button"
          tabIndex={0}
          onClick={onZoom}
          onKeyDown={e => handleKeyAction(e, onZoom)}
          aria-label="Ampliar comparacao de titulo"
        >
          <span className="ba-strike">{ev.oldTitle}</span>
          <ArrowRight className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--text-dim)' }} aria-hidden="true" />
          <span className="ba-new">{ev.newTitle}</span>
          <ZoomIn className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--text-dim)' }} aria-hidden="true" />
        </div>
      )}

      {ev.changeType === 'description' && (
        <div
          className="md-ev-ba text"
          role="button"
          tabIndex={0}
          onClick={onZoom}
          onKeyDown={e => handleKeyAction(e, onZoom)}
          aria-label="Ampliar comparacao de descricao"
        >
          <span style={{ color: 'var(--text-dim)' }}>Descricao alterada</span>
          <ZoomIn className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--text-dim)' }} aria-hidden="true" />
        </div>
      )}
    </>
  )
}

function ZoomModal({ change, onClose }: { change: CompetitorChangeView; onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null)
  const handleClose = useCallback(() => onClose(), [onClose])
  useModalFocusTrap(modalRef, true, handleClose)

  const tc = TYPE_COLORS[change.changeType] ?? { bg: 'var(--surface)', color: 'var(--text-muted)' }

  return (
    <YtPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)' }}
        onClick={handleClose}
      >
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label="Comparação ampliada"
          className="mdz rounded-[14px] relative"
          style={{
            background: 'var(--bg, #1A1714)',
            boxShadow: 'var(--shadow-pop)',
            border: '1px solid var(--border)',
            maxWidth: 720,
            width: '95%',
            animation: 'fade var(--t-enter) var(--ease-out) both',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header: badge + title (inline) + close */}
          <div className="flex items-start gap-3 p-5 pb-0">
            <div className="flex-1 min-w-0" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span
                className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase flex-shrink-0"
                style={{ background: tc.bg, color: tc.color }}
              >
                {TYPE_LABELS[change.changeType] ?? change.changeType}
              </span>
              {change.videoTitle && (
                <span
                  className="text-sm font-semibold truncate"
                  style={{ color: 'var(--text)' }}
                >
                  {change.videoTitle}
                </span>
              )}
            </div>
            <button className="ic-btn flex-shrink-0" onClick={handleClose} aria-label="Fechar">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Body: before/after comparison */}
          <div className="p-5 pt-4">
            {change.changeType === 'thumbnail' && (
              <div className="mdz-thumbs">
                <div>
                  <p className="eyebrow mb-2">
                    ANTES
                    <span className="ml-1.5 normal-case tracking-normal" style={{ color: 'var(--text-dim)', fontSize: 10 }}>
                      {fmtRelative(change.detectedAt)}
                    </span>
                  </p>
                  {change.oldThumbnailUrl ? (
                    <div className="relative">
                      <img
                        src={change.oldThumbnailUrl}
                        alt="Thumbnail anterior"
                        referrerPolicy="no-referrer"
                        className="w-full rounded-lg"
                        style={{ opacity: 0.7 }}
                      />
                      <a
                        href={`https://youtube.com/watch?v=${change.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 flex items-center justify-center"
                        aria-label="Assistir no YouTube"
                      >
                        <div
                          className="rounded-full flex items-center justify-center"
                          style={{
                            width: 40, height: 40,
                            background: 'rgba(0,0,0,0.65)',
                            backdropFilter: 'blur(4px)',
                          }}
                        >
                          <PlayIcon />
                        </div>
                      </a>
                    </div>
                  ) : (
                    <ThumbPlaceholder />
                  )}
                </div>
                <div className="mdz-arrow">
                  <ArrowRight className="h-5 w-5" style={{ color: 'var(--text-dim)' }} aria-hidden="true" />
                </div>
                <div>
                  <p className="eyebrow mb-2" style={{ color: 'var(--accent)' }}>DEPOIS</p>
                  {change.newThumbnailUrl ? (
                    <div className="relative">
                      <img
                        src={change.newThumbnailUrl}
                        alt="Thumbnail nova"
                        referrerPolicy="no-referrer"
                        className="w-full rounded-lg"
                      />
                      <a
                        href={`https://youtube.com/watch?v=${change.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 flex items-center justify-center"
                        aria-label="Assistir no YouTube"
                      >
                        <div
                          className="rounded-full flex items-center justify-center"
                          style={{
                            width: 40, height: 40,
                            background: 'rgba(0,0,0,0.65)',
                            backdropFilter: 'blur(4px)',
                          }}
                        >
                          <PlayIcon />
                        </div>
                      </a>
                    </div>
                  ) : (
                    <ThumbPlaceholder />
                  )}
                </div>
              </div>
            )}

            {change.changeType === 'title' && (
              <div className="mdz-text">
                <div className="mdz-textbox strike">
                  <p className="eyebrow mb-1">ANTES</p>
                  <p className="text-sm">{change.oldTitle}</p>
                </div>
                <div className="mdz-textbox new">
                  <p className="eyebrow mb-1" style={{ color: 'var(--accent)' }}>DEPOIS</p>
                  <p className="text-sm">{change.newTitle}</p>
                </div>
              </div>
            )}

            {change.changeType === 'description' && (
              <div
                className="rounded-lg p-4 text-xs"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
              >
                Descricao alterada. Abra o video no YouTube para ver as mudancas.
              </div>
            )}
          </div>

          {/* Footer: channel + views + CTA */}
          <div
            className="flex items-center justify-between gap-3 px-5 py-3.5"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-medium truncate" style={{ color: 'var(--text-muted)' }}>
                {change.channelName}
              </span>
              {change.viewCountAtChange != null && (
                <span className="text-[10px] tnum flex-shrink-0" style={{ color: 'var(--text-dim)' }}>
                  {fmtC(change.viewCountAtChange)} views
                </span>
              )}
            </div>
            <button
              className="btn sm primary flex-shrink-0"
              onClick={() => {
                // Navigate to AB Lab create wizard with this as inspiration
                handleClose()
              }}
            >
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
              Testar esta abordagem
            </button>
          </div>
        </div>
      </div>
    </YtPortal>
  )
}

/** Play button triangle icon for thumbnail overlays. */
function PlayIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 2.5L13 8L4 13.5V2.5Z" fill="#fff" />
    </svg>
  )
}

/** Gradient placeholder for missing thumbnails in the zoom modal. */
function ThumbPlaceholder() {
  return (
    <div
      className="w-full aspect-video rounded-lg flex items-center justify-center text-xs"
      style={{
        background: 'linear-gradient(135deg, var(--surface-3), var(--surface-2))',
        color: 'var(--text-dim)',
      }}
    >
      <span className="thumb-label">frame do video</span>
    </div>
  )
}
