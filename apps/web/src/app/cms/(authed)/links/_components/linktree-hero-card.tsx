'use client'

import { LayoutTemplate, BarChart3, Pencil } from 'lucide-react'

interface Props {
  domain: string
  totalViews: number
  last30dViews: number
  uniqueVisitors: number
  topCountry: string | null
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-border bg-card p-3">
      <span className="block text-[10px] text-muted-foreground">{label}</span>
      <span className="text-lg font-bold text-foreground">{value}</span>
    </div>
  )
}

export function LinktreeHeroCard({ domain, totalViews, last30dViews, uniqueVisitors, topCountry }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutTemplate size={16} className="text-primary" />
          <h2 className="text-sm font-bold text-foreground">Linktree</h2>
          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
            Porta de Entrada
          </span>
          {domain && (
            <a
              href={`https://${domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {domain}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/cms/linktree/analytics"
            className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <BarChart3 size={12} /> Analytics
          </a>
          <a
            href="/cms/linktree"
            className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Pencil size={12} /> Editar
          </a>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Pageviews" value={totalViews.toLocaleString('pt-BR')} />
        <StatCard label="Últimos 30d" value={last30dViews.toLocaleString('pt-BR')} />
        <StatCard label="Únicos" value={uniqueVisitors.toLocaleString('pt-BR')} />
        <StatCard label="Top País" value={topCountry ?? '—'} />
      </div>
    </div>
  )
}
