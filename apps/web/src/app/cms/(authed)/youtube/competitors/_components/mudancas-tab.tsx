'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { Search, Bookmark, ChevronDown, ChevronUp, ZoomIn, ArrowRight, X, Filter, FlaskConical } from 'lucide-react'
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
        <div className="flex flex-col gap-4">
          {grouped.map(([day, dayChanges]) => (
            <div key={day} className="change-group">
              <div className="change-day">
                <span className="eyebrow">{day}</span>
                <div className="change-day-line" />
              </div>
              <div className="flex flex-col gap-2">
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
  const tc = TYPE_COLORS[c.changeType] ?? { bg: 'var(--surface)', color: 'var(--text-muted)' }

  const handleBookmark = async () => {
    setOptimisticBookmark(v => !v)
    await toggleBookmark(c.id)
  }

  return (
    <div
      className="md-card rounded-[14px] overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Bookmark */}
        <button
          className={`md-mark flex-shrink-0 rounded-lg p-1.5 ${optimisticBookmark ? 'on' : ''}`}
          style={{ border: '1px solid var(--border)' }}
          onClick={handleBookmark}
          aria-label={optimisticBookmark ? 'Remover marcação' : 'Marcar'}
        >
          <Bookmark className="h-3.5 w-3.5" fill={optimisticBookmark ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>

        <div className="flex-1 min-w-0">
          {/* Top row: badge + channel + time */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase"
              style={{ background: tc.bg, color: tc.color }}
            >
              {TYPE_LABELS[c.changeType] ?? c.changeType}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.channelName}</span>
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{fmtRelative(c.detectedAt)}</span>
          </div>

          {/* Video title */}
          {c.videoTitle && (
            <p className="text-xs font-medium mt-1 truncate" style={{ color: 'var(--text)' }}>{c.videoTitle}</p>
          )}

          {/* Change content */}
          {c.changeType === 'title' && c.oldTitle && c.newTitle && (
            <div
              className="mt-2 text-xs flex items-center gap-1.5 flex-wrap cursor-pointer"
              role="button"
              tabIndex={0}
              onClick={onZoom}
              onKeyDown={e => handleKeyAction(e, onZoom)}
              aria-label="Ampliar comparação de título"
            >
              <span className="line-through" style={{ color: 'var(--red, #EF4444)', opacity: 0.7 }}>{c.oldTitle}</span>
              <ArrowRight className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--text-dim)' }} aria-hidden="true" />
              <span style={{ color: 'var(--green)' }}>{c.newTitle}</span>
              <ZoomIn className="h-3 w-3 flex-shrink-0 ml-1" style={{ color: 'var(--text-dim)' }} aria-hidden="true" />
            </div>
          )}

          {c.changeType === 'thumbnail' && (
            <div
              className="mt-2 flex items-center gap-2 cursor-pointer"
              role="button"
              tabIndex={0}
              onClick={onZoom}
              onKeyDown={e => handleKeyAction(e, onZoom)}
              aria-label="Ampliar comparação de thumbnail"
            >
              {c.oldThumbnailUrl ? (
                <div className="md-mini relative flex-shrink-0">
                  <img src={c.oldThumbnailUrl} alt="antes" referrerPolicy="no-referrer" className="h-14 w-24 rounded-lg object-cover" style={{ opacity: 0.5 }} />
                  <span className="absolute top-0.5 left-0.5 rounded px-1 py-0.5 text-[8px] font-bold" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>ANTES</span>
                  <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                    <div className="rounded-full flex items-center justify-center" style={{ width: 22, height: 22, background: 'rgba(0,0,0,0.55)' }}>
                      <PlayIcon size={9} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-14 w-24 rounded-lg flex items-center justify-center text-[8px] flex-shrink-0" style={{ background: 'var(--surface-3)', color: 'var(--text-dim)' }}>ANTES</div>
              )}
              <ArrowRight className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--text-dim)' }} aria-hidden="true" />
              {c.newThumbnailUrl ? (
                <div className="md-mini relative flex-shrink-0">
                  <img src={c.newThumbnailUrl} alt="depois" referrerPolicy="no-referrer" className="h-14 w-24 rounded-lg object-cover" />
                  <span className="absolute top-0.5 left-0.5 rounded px-1 py-0.5 text-[8px] font-bold" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>DEPOIS</span>
                  <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                    <div className="rounded-full flex items-center justify-center" style={{ width: 22, height: 22, background: 'rgba(0,0,0,0.55)' }}>
                      <PlayIcon size={9} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-14 w-24 rounded-lg flex items-center justify-center text-[8px] flex-shrink-0" style={{ background: 'var(--surface-3)', color: 'var(--text-dim)' }}>DEPOIS</div>
              )}
              <ZoomIn className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--text-dim)' }} aria-hidden="true" />
            </div>
          )}

          {c.changeType === 'description' && (
            <div
              className="text-[10px] mt-1.5 cursor-pointer inline-flex items-center gap-1"
              role="button"
              tabIndex={0}
              onClick={onZoom}
              onKeyDown={e => handleKeyAction(e, onZoom)}
              style={{ color: 'var(--text-dim)' }}
            >
              <span>
                Descricao alterada
                {c.viewCountAtChange != null && <> · {fmtC(c.viewCountAtChange)} views na mudanca</>}
              </span>
              <ZoomIn className="h-2.5 w-2.5 flex-shrink-0" aria-hidden="true" />
            </div>
          )}

          {/* View count */}
          {c.changeType !== 'description' && c.viewCountAtChange != null && (
            <p className="text-[10px] mt-1 tnum" style={{ color: 'var(--text-dim)' }}>
              {fmtC(c.viewCountAtChange)} views na mudança
            </p>
          )}

          {/* History toggle */}
          {c.history.length > 0 && (
            <>
              <button
                className="md-history-toggle flex items-center gap-1 mt-2 text-[10px] font-medium"
                style={{ color: 'var(--text-muted)' }}
                onClick={onToggleExpand}
                aria-expanded={expanded}
              >
                {expanded ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />}
                {expanded ? 'Esconder' : `Ver histórico completo (${c.history.length})`}
              </button>

              {expanded && (
                <div className="mt-3 ml-2 flex flex-col gap-0" style={{ borderLeft: '2px solid var(--border)', paddingLeft: 14 }}>
                  {c.history.map((h, idx) => {
                    const htc = TYPE_COLORS[h.changeType] ?? { bg: 'var(--surface)', color: 'var(--text-muted)' }
                    return (
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
                            background: htc.color,
                            left: -18,
                            top: 14,
                          }}
                          aria-hidden="true"
                        />

                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                            style={{ background: htc.bg, color: htc.color }}
                          >
                            {TYPE_LABELS[h.changeType] ?? h.changeType}
                          </span>
                          <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                            {fmtRelative(h.detectedAt)}
                          </span>
                          {h.viewCountAtChange != null && (
                            <span className="text-[10px] tnum" style={{ color: 'var(--text-dim)' }}>
                              {fmtC(h.viewCountAtChange)} views
                            </span>
                          )}
                        </div>

                        {/* Content per type */}
                        {h.changeType === 'title' && h.oldTitle && h.newTitle && (
                          <div className="mt-1 text-[11px] flex items-center gap-1.5 flex-wrap">
                            <span className="line-through" style={{ color: 'var(--red, #EF4444)', opacity: 0.7 }}>
                              {h.oldTitle}
                            </span>
                            <ArrowRight className="h-2.5 w-2.5 flex-shrink-0" style={{ color: 'var(--text-dim)' }} aria-hidden="true" />
                            <span style={{ color: 'var(--green)' }}>{h.newTitle}</span>
                          </div>
                        )}

                        {h.changeType === 'thumbnail' && (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            {h.oldThumbnailUrl ? (
                              <div className="relative flex-shrink-0">
                                <img
                                  src={h.oldThumbnailUrl}
                                  alt="antes"
                                  referrerPolicy="no-referrer"
                                  className="h-10 w-[72px] rounded object-cover"
                                  style={{ opacity: 0.5 }}
                                />
                              </div>
                            ) : (
                              <div
                                className="h-10 w-[72px] rounded flex items-center justify-center text-[8px] flex-shrink-0"
                                style={{ background: 'var(--surface-3)', color: 'var(--text-dim)' }}
                              >
                                antes
                              </div>
                            )}
                            <ArrowRight className="h-2.5 w-2.5 flex-shrink-0" style={{ color: 'var(--text-dim)' }} aria-hidden="true" />
                            {h.newThumbnailUrl ? (
                              <div className="relative flex-shrink-0">
                                <img
                                  src={h.newThumbnailUrl}
                                  alt="depois"
                                  referrerPolicy="no-referrer"
                                  className="h-10 w-[72px] rounded object-cover"
                                />
                              </div>
                            ) : (
                              <div
                                className="h-10 w-[72px] rounded flex items-center justify-center text-[8px] flex-shrink-0"
                                style={{ background: 'var(--surface-3)', color: 'var(--text-dim)' }}
                              >
                                depois
                              </div>
                            )}
                          </div>
                        )}

                        {h.changeType === 'description' && (
                          <p className="mt-1 text-[10px]" style={{ color: 'var(--text-dim)' }}>
                            Descricao alterada
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
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
