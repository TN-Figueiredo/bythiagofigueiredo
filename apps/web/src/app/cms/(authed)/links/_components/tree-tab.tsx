'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Info, Eye, Users, Target, Trophy, ExternalLink, Type } from 'lucide-react'
import type { LinktreeDisplay } from '@tn-figueiredo/links-admin'
import { LinktreePreview } from './linktree/preview'
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
        <div
          className="flex items-center"
          style={{ gap: 10, padding: '11px 15px', background: 'var(--accent-soft)', border: '1px solid var(--line)', borderRadius: 11 }}
        >
          <Info size={15} strokeWidth={1.7} className="shrink-0" style={{ color: 'var(--accent)' }} />
          <div className="flex-1 text-[12.5px]" style={{ color: 'var(--ink-dim)' }}>
            <b style={{ color: 'var(--ink)' }}>Link in Bio agora vive aqui.</b>{' '}
            Unificamos os dois itens de menu: a sua árvore é a{' '}
            <b style={{ color: 'var(--ink)' }}>porta de entrada</b>
            , e os links rastreados ficam na aba ao lado.
          </div>
          <button
            type="button"
            aria-label="Fechar banner"
            onClick={() => {
              setBannerDismissed(true)
              localStorage.setItem('links-merge-banner-dismissed', '1')
            }}
            className="shrink-0 rounded focus:outline-none focus:ring-2 focus:ring-primary/50"
            style={{ color: 'var(--ink-faint)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* Grid 2-col */}
      <div className="grid grid-cols-1 gap-[18px] min-[1080px]:grid-cols-[340px_1fr]">
        {/* Left: Preview card */}
        <div
          className="flex flex-col items-center"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r, 14px)',
            padding: 20,
            gap: 16,
          }}
        >
          {/* Badge row */}
          <div className="flex items-center self-stretch" style={{ gap: 8 }}>
            <span
              className="mono inline-flex items-center shrink-0"
              style={{
                gap: 5,
                padding: '3px 9px',
                borderRadius: 999,
                fontSize: '10.5px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                background: 'var(--amber-soft, rgba(224,162,60,0.13))',
                color: 'var(--amber, #E0A23C)',
              }}
            >
              <ExternalLink size={11} strokeWidth={1.7} />
              porta de entrada
            </span>
            <span className="mono ml-auto" style={{ fontSize: 11, color: 'var(--ink-dim)' }}>
              {tree.url ? tree.url.replace('https://', '') : 'URL não configurada'}
            </span>
          </div>

          {/* Linktree Preview */}
          <LinktreePreview
            width={280}
            taglinePt="código, produto & vida indie"
            taglineEn="code, product & indie life"
            sharedLinks={tree.sharedLinks.map(s => ({
              id: s.id,
              icon: s.icon,
              label_pt: s.labelPt,
              label_en: s.labelEn,
              url: s.url,
            }))}
          />

          {/* Action buttons */}
          <div className="flex self-stretch" style={{ gap: 10 }}>
            <Link
              href="/cms/links/linktree"
              className="inline-flex flex-1 items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary/50"
              style={{
                gap: 7,
                padding: '9px 15px',
                fontSize: '13.5px',
                fontWeight: 600,
                borderRadius: 9,
                border: '1px solid var(--accent)',
                background: 'var(--accent)',
                color: 'rgb(26, 18, 12)',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                transition: '0.15s',
              }}
            >
              <Type size={16} strokeWidth={1.7} />
              Editar
            </Link>
            {tree.url ? (
              <a
                href={tree.url}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary/50"
                style={{
                  gap: 7,
                  padding: '9px 15px',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  borderRadius: 9,
                  border: '1px solid var(--line-strong)',
                  background: 'transparent',
                  color: 'var(--ink-dim)',
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  transition: '0.15s',
                }}
              >
                <ExternalLink size={16} strokeWidth={1.7} />
                Abrir
              </a>
            ) : (
              <span
                className="inline-flex items-center justify-center opacity-40"
                style={{
                  gap: 7,
                  padding: '9px 15px',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  borderRadius: 9,
                  border: '1px solid var(--line-strong)',
                  background: 'transparent',
                  color: 'var(--ink-dim)',
                  letterSpacing: '-0.01em',
                  cursor: 'not-allowed',
                }}
              >
                <ExternalLink size={16} strokeWidth={1.7} />
                Abrir
              </span>
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
