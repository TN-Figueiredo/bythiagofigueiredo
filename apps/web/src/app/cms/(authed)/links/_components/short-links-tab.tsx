'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Plus, ChevronRight, AlertTriangle, QrCode } from 'lucide-react'
import { SOURCE_COLORS, SOURCE_LABELS, type LinkDisplay, type SourceId } from '@tn-figueiredo/links-admin'
import { Spark, StatTile } from '@tn-figueiredo/links-admin/client'
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
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        <StatTile label="Total de links" value={fmt(links.length)} icon="li" iconTint="#F2683C" />
        <StatTile label="Cliques totais" value={fmt(totalClicks)} icon="tr" iconTint="#46B17E"
          spark={top ? <Spark data={top.spark} color="#46B17E" w={70} h={24} /> : undefined} />
        <StatTile label="Links ativos" value={fmt(active)} icon="ta" iconTint="#3FA9C0" />
        {top && (
          <StatTile label="Top performer" value={top.slug} icon="tr" iconTint="#E0A23C"
            spark={<Spark data={top.spark} color="#E0A23C" w={70} h={24} />} />
        )}
      </div>

      {/* Health panel */}
      {unhealthy.length > 0 && (
        <div className="rounded-[14px] border border-red-500/30 bg-red-500/[0.05] p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-sm font-semibold text-foreground">Saude dos links</span>
            <span className="ml-1 font-mono text-xs text-muted-foreground">{unhealthy.length}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unhealthy.map(l => (
              <Link key={l.id} href={`/cms/links/${l.id}`}
                className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-red-400 hover:bg-white/[0.06]">
                {l.slug}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Search + create */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            aria-label="Buscar links por titulo ou slug"
            placeholder="Buscar links..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full rounded-[9px] bg-muted py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <button
          type="button"
          onClick={onCreateLink}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-1 focus:ring-offset-background"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo link
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <FilterGroup label="Origem" value={sourceFilter} onChange={(v) => { setSourceFilter(v); setPage(1) }} opts={SOURCE_OPTS} />
        <div className="h-5 w-px bg-white/10" />
        <FilterGroup label="Status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1) }} opts={STATUS_OPTS} />
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
