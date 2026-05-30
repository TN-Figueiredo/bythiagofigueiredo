'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Plus, ChevronRight, AlertTriangle, QrCode, Link2, Zap, Target, Clock, RefreshCw } from 'lucide-react'
import { SOURCE_COLORS, SOURCE_LABELS, type LinkDisplay, type SourceId } from '@tn-figueiredo/links-admin'
import { Spark } from '@tn-figueiredo/links-admin/client'
import { StatusDot } from './status-dot'
import { FilterGroup } from './filter-group'
import { Pagination } from './pagination'
import { fmt } from './fmt'

const SOURCE_OPTS = [
  { id: 'all', label: 'Tudo' },
  { id: 'newsletter', label: 'Newsletter' },
  { id: 'social', label: 'Social' },
  { id: 'blog', label: 'Blog' },
  { id: 'qr', label: 'QR' },
  { id: 'campaign', label: 'Campanha' },
  { id: 'manual', label: 'Manual' },
]

const STATUS_OPTS = [
  { id: 'all', label: 'Tudo' },
  { id: 'active', label: 'Ativos' },
  { id: 'paused', label: 'Pausados' },
]

interface ShortLinksTabProps {
  links: LinkDisplay[]
  onCreateLink: () => void
}

export function ShortLinksTab({ links, onCreateLink }: ShortLinksTabProps) {
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const PER_PAGE = 20

  const totalClicks = links.reduce((s, l) => s + l.clicks, 0)
  const active = links.filter(l => l.status === 'active').length
  const top = links.length > 0 ? [...links].sort((a, b) => b.clicks - a.clicks)[0] : null
  const unhealthy = links.filter(l => l.health !== 'ok')

  const filtered = links.filter(l => {
    if (search && !l.title.toLowerCase().includes(search.toLowerCase()) && !l.slug.toLowerCase().includes(search.toLowerCase())) return false
    if (sourceFilter !== 'all' && l.source !== sourceFilter) return false
    if (statusFilter !== 'all' && l.status !== statusFilter) return false
    return true
  })

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        {[
          { label: 'Total de links', value: fmt(links.length), Icon: Link2, color: 'var(--accent)', tint: 'var(--accent)', spark: null, sub: null },
          { label: 'Cliques totais', value: fmt(totalClicks), Icon: Zap, color: 'rgb(70, 177, 126)', tint: 'rgba(70, 177, 126, 0.133)', spark: top ? top.spark : null, sub: null },
          { label: 'Links ativos', value: fmt(active), Icon: Target, color: 'rgb(63, 169, 192)', tint: 'rgba(63, 169, 192, 0.133)', spark: null, sub: null },
          ...(top ? [{ label: 'Top performer', value: fmt(top.clicks), Icon: Zap, color: 'rgb(224, 162, 60)', tint: 'rgba(224, 162, 60, 0.133)', spark: top.spark, sub: top.slug }] : []),
        ].map((s) => (
          <div
            key={s.label}
            data-stat-tile
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r)',
              padding: 16,
              minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
              <span style={{
                width: 30, height: 30, borderRadius: 8,
                background: s.tint + (s.tint.startsWith('var') ? '22' : ''),
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <s.Icon size={16} strokeWidth={1.7} style={{ color: s.color }} />
              </span>
              <span className="eyebrow" style={{ flex: 1, fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
                {s.label}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div className="mono" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, color: 'var(--ink)' }}>
                  {s.value}
                </div>
                {s.sub && (
                  <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginTop: 4 }}>{s.sub}</div>
                )}
              </div>
              {s.spark && <Spark data={s.spark} color={s.color} w={84} h={30} />}
            </div>
          </div>
        ))}
      </div>

      {/* Health panel */}
      {unhealthy.length > 0 && (
        <div style={{
          background: 'rgba(217, 97, 74, 0.05)',
          border: '1px solid rgba(217, 97, 74, 0.3)',
          borderRadius: 'var(--r)',
          padding: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <AlertTriangle size={16} strokeWidth={1.7} style={{ color: 'var(--red)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Saúde dos links</span>
            <span style={{ fontSize: '12.5px', color: 'var(--ink-dim)' }}>
              {unhealthy.length} link{unhealthy.length !== 1 ? 's' : ''} precisam de atenção:
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
              {unhealthy.map(l => {
                const isBroken = l.health === 'broken'
                const borderColor = isBroken ? 'rgba(217, 97, 74, 0.4)' : 'rgba(224, 162, 60, 0.4)'
                const textColor = isBroken ? 'var(--red)' : 'var(--amber)'
                const StatusIcon = isBroken ? AlertTriangle : Clock
                const statusLabel = isBroken ? 'destino quebrado' : 'a expirar'
                return (
                  <button
                    key={l.id}
                    type="button"
                    className="mono"
                    onClick={() => window.location.href = `/cms/links/${l.id}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: '11.5px', padding: '4px 10px', borderRadius: 99,
                      whiteSpace: 'nowrap', border: `1px solid ${borderColor}`,
                      background: 'transparent', color: textColor, cursor: 'pointer',
                    }}
                  >
                    <StatusIcon size={12} strokeWidth={1.7} />
                    {l.slug} · {statusLabel}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '6px 11px', fontSize: '12.5px', fontWeight: 600,
                borderRadius: 9, border: '1px solid var(--line-strong)',
                background: 'transparent', color: 'var(--ink-dim)',
                letterSpacing: '-0.01em', whiteSpace: 'nowrap', transition: '0.15s',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} strokeWidth={1.7} />
              Revalidar
            </button>
          </div>
        </div>
      )}

      {/* Search + filters card */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r)',
        padding: 14,
      }}>
        {/* Search row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: 12, background: 'var(--surface-2)',
          borderRadius: 9, padding: '9px 12px',
        }}>
          <Search size={16} strokeWidth={1.7} style={{ color: 'var(--ink-faint)' }} />
          <input
            type="text"
            aria-label="Buscar links por titulo ou slug"
            placeholder="Buscar links…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            style={{
              flex: 1, background: 'transparent', border: 'none',
              color: 'var(--ink)', fontSize: '13.5px', outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={onCreateLink}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '6px 11px', fontSize: '12.5px', fontWeight: 600,
              borderRadius: 9, border: '1px solid var(--accent)',
              background: 'var(--accent)', color: 'rgb(26, 18, 12)',
              letterSpacing: '-0.01em', whiteSpace: 'nowrap', transition: '0.15s',
              cursor: 'pointer',
            }}
          >
            <Plus size={14} strokeWidth={1.7} />
            Novo link
          </button>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <FilterGroup label="Origem" value={sourceFilter} onChange={(v) => { setSourceFilter(v); setPage(1) }} opts={SOURCE_OPTS} />
          <div style={{ width: 1, height: 18, background: 'var(--line)' }} />
          <FilterGroup label="Status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1) }} opts={STATUS_OPTS} />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhum link encontrado.</p>
      ) : (
        <div className="flex flex-col">
          <div role="row" aria-label="Cabecalho da tabela de links" className="grid items-center gap-2 border-b border-white/[0.06] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            style={{ gridTemplateColumns: '1.6fr 1.4fr 90px 90px 110px 70px' }}>
            <span>Link</span>
            <span>Destino</span>
            <span>Tendencia</span>
            <span>Cliques</span>
            <span>Status</span>
            <span />
          </div>
          {paginated.map((l) => (
            <Link key={l.id} href={`/cms/links/${l.id}`}
              className="grid items-center gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer"
              style={{ gridTemplateColumns: '1.6fr 1.4fr 90px 90px 110px 70px' }}>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SOURCE_COLORS[l.source] }} />
                  <span className="text-sm font-medium text-foreground truncate">{l.title}</span>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground truncate">{l.slug}</div>
              </div>
              <div className="font-mono text-[10px] text-muted-foreground truncate">{l.dest}</div>
              <Spark data={l.spark} color={SOURCE_COLORS[l.source]} w={70} h={22} />
              <span className="font-mono text-sm font-bold text-foreground">{fmt(l.clicks)}</span>
              <StatusDot status={l.status} />
              <div className="flex items-center gap-1 justify-end">
                <button type="button" aria-label={`QR code para ${l.slug}`} onClick={(e) => e.preventDefault()} className="p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 rounded">
                  <QrCode className="h-3.5 w-3.5" />
                </button>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  )
}
