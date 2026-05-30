'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Info, Eye, Users, Target, Trophy } from 'lucide-react'
import type { LinktreeDisplay } from '@tn-figueiredo/links-admin'
import { fmt } from './fmt'

interface TreeTabProps {
  tree: LinktreeDisplay
}

export function TreeTab({ tree }: TreeTabProps) {
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('links-merge-banner-dismissed') === '1'
  })

  return (
    <div className="space-y-5">
      {/* Merge banner */}
      {!bannerDismissed && (
        <div className="flex items-center gap-2.5 rounded-[11px] border border-white/[0.08] bg-[var(--accent-soft,rgba(242,104,60,0.06))] px-4 py-3 text-xs text-foreground">
          <Info className="h-4 w-4 shrink-0 text-[#F2683C]" />
          <span className="flex-1">Link in Bio agora vive aqui. Tudo unificado sob Links.</span>
          <button
            type="button"
            aria-label="Fechar banner"
            onClick={() => {
              setBannerDismissed(true)
              localStorage.setItem('links-merge-banner-dismissed', '1')
            }}
            className="shrink-0 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* Grid 2-col */}
      <div className="grid grid-cols-1 gap-[18px] min-[1080px]:grid-cols-[340px_1fr]">
        {/* Left: Preview card */}
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#161410] p-5">
          <span className="inline-flex items-center self-start gap-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
            porta de entrada
          </span>
          <div className="font-mono text-xs text-muted-foreground">{tree.url || 'URL nao configurada'}</div>

          {/* Compact preview placeholder */}
          <div className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-[#13110d] p-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#E0651E] text-sm font-bold text-foreground" style={{ fontFamily: 'Fraunces, serif' }}>
              TF
            </div>
            <div className="text-sm font-semibold text-foreground" style={{ fontFamily: 'Fraunces, serif' }}>Thiago Figueiredo</div>
            <div className="font-mono text-[10px] text-muted-foreground">{tree.blocks.length} blocos ativos</div>
          </div>

          <div className="flex gap-2">
            <Link href="/cms/links/linktree" className="flex-1 rounded-lg bg-primary px-3 py-2 text-center text-xs font-semibold text-primary-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
              Editar
            </Link>
            {tree.url ? (
              <a href={tree.url} target="_blank" rel="noopener" className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-center text-xs font-medium text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                Abrir
              </a>
            ) : (
              <span className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-center text-xs font-medium text-muted-foreground opacity-50 cursor-not-allowed">Abrir</span>
            )}
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
            {tree.blocks.length > 0 ? (
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
            ) : (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Nenhum bloco configurado.
              </p>
            )}
            <div className="mt-3 flex justify-end">
              <a href="/cms/links?tab=analytics" className="text-[11px] font-medium text-muted-foreground hover:text-foreground">
                Analytics →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
