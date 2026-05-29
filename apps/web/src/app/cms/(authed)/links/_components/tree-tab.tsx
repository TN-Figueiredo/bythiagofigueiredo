'use client'

import Link from 'next/link'
import { Info, Eye, Users, Target, Trophy } from 'lucide-react'
import type { LinktreeDisplay } from '@tn-figueiredo/links-admin'

function fmt(n: number): string {
  return n.toLocaleString('pt-BR')
}

interface TreeTabProps {
  tree: LinktreeDisplay
}

export function TreeTab({ tree }: TreeTabProps) {
  return (
    <div className="space-y-5">
      {/* Merge banner */}
      <div className="flex items-center gap-2.5 rounded-[11px] border border-white/[0.08] bg-[var(--accent-soft,rgba(242,104,60,0.06))] px-4 py-3 text-xs text-foreground">
        <Info className="h-4 w-4 shrink-0 text-[#F2683C]" />
        <span>Link in Bio agora vive aqui. Tudo unificado sob Links.</span>
      </div>

      {/* Grid 2-col */}
      <div className="grid gap-[18px]" style={{ gridTemplateColumns: '340px 1fr' }}>
        {/* Left: Preview card */}
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#161410] p-5">
          <span className="inline-flex items-center self-start gap-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
            porta de entrada
          </span>
          <div className="font-mono text-xs text-muted-foreground">{tree.url}</div>

          {/* Compact preview placeholder */}
          <div className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-[#13110d] p-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#E0651E] text-sm font-bold text-foreground" style={{ fontFamily: 'Fraunces, serif' }}>
              TF
            </div>
            <div className="text-sm font-semibold text-foreground" style={{ fontFamily: 'Fraunces, serif' }}>Thiago Figueiredo</div>
            <div className="font-mono text-[10px] text-muted-foreground">{tree.blocks.length} blocos ativos</div>
          </div>

          <div className="flex gap-2">
            <Link href="/cms/links/linktree" className="flex-1 rounded-lg bg-primary px-3 py-2 text-center text-xs font-semibold text-primary-foreground">
              Editar
            </Link>
            <a href={tree.url} target="_blank" rel="noopener" className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-center text-xs font-medium text-muted-foreground hover:text-foreground">
              Abrir
            </a>
          </div>
        </div>

        {/* Right: Stats + performance */}
        <div className="flex flex-col gap-4">
          {/* 4 stat cards */}
          <div className="grid auto-rows-fr gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            {[
              { label: 'Pageviews', value: fmt(tree.pageviews), icon: Eye },
              { label: 'Ultimos 30d', value: fmt(tree.last30), icon: Target },
              { label: 'Unicos', value: fmt(tree.unique), icon: Users },
              { label: 'Engajamento', value: `${tree.engagement}%`, icon: Target },
            ].map((s) => (
              <div key={s.label} data-stat-card className="rounded-[14px] border border-white/[0.08] bg-[#161410] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</span>
                </div>
                <div className="font-mono text-xl font-bold text-foreground">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Block performance */}
          <div className="rounded-[14px] border border-white/[0.08] bg-[#161410] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400" />
              <span className="text-[13px] font-semibold text-foreground">Desempenho por bloco</span>
            </div>
            <div className="flex flex-col gap-2">
              {tree.blocks.map((b) => (
                <div key={b.id} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-xs text-foreground">{b.label}</span>
                  <div className="flex-1 h-[7px] rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#F2683C]"
                      style={{ width: `${(b.ctr / Math.max(...tree.blocks.map(x => x.ctr), 1)) * 100}%` }}
                    />
                  </div>
                  <span className="w-12 text-right font-mono text-[11px] text-muted-foreground">{b.ctr}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
