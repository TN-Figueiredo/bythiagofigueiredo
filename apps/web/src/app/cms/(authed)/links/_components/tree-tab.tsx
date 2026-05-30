'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Info, Eye, Users, TrendingUp, Trophy, ExternalLink, Type, Percent } from 'lucide-react'
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {[
              { label: 'Pageviews', value: fmt(tree.pageviews), Icon: Eye, color: 'var(--accent)' },
              { label: 'Últimos 30d', value: fmt(tree.last30), Icon: TrendingUp, color: 'rgb(70, 177, 126)' },
              { label: 'Únicos', value: fmt(tree.unique), Icon: Users, color: 'rgb(63, 169, 192)' },
              { label: 'Engajamento', value: `${tree.engagement}%`, Icon: Percent, color: 'rgb(224, 162, 60)' },
            ].map((s) => (
              <div
                key={s.label}
                data-stat-card
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r)',
                  padding: 15,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <s.Icon size={14} strokeWidth={1.7} style={{ color: s.color }} />
                  <span className="eyebrow" style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
                    {s.label}
                  </span>
                </div>
                <div className="mono" style={{ fontSize: 23, fontWeight: 700, color: 'var(--ink)' }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Block performance */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: 18 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Trophy size={15} strokeWidth={1.7} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '13.5px', fontWeight: 600, flex: 1, color: 'var(--ink)' }}>Desempenho por bloco</span>
              <a
                href="/cms/links?tab=analytics"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '6px 11px', fontSize: '12.5px', fontWeight: 600,
                  borderRadius: 9, border: '1px solid transparent',
                  background: 'transparent', color: 'var(--ink-dim)',
                  letterSpacing: '-0.01em', whiteSpace: 'nowrap', transition: '0.15s',
                }}
              >
                <TrendingUp size={14} strokeWidth={1.7} />
                Analytics
              </a>
            </div>
            {/* Subtitle */}
            <div style={{ fontSize: '11.5px', color: 'var(--ink-dim)', marginBottom: 14 }}>
              Qual link da árvore mais converte (CTR = cliques ÷ visualizações).
            </div>
            {/* Rows */}
            {tree.blocks.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {tree.blocks.map((b) => {
                  const maxClicks = Math.max(...tree.blocks.map(x => x.clicks), 1)
                  return (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <span style={{ minWidth: 120, maxWidth: 220, fontSize: '12.5px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>
                        {b.label}
                      </span>
                      <span className="mono" style={{ fontSize: '9.5px', color: 'var(--ink-faint)', width: 64, flexShrink: 0, textAlign: 'right' }}>
                        {b.section}
                      </span>
                      <div style={{ flex: 1, height: 8, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ width: `${(b.clicks / maxClicks) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 99 }} />
                      </div>
                      <span className="mono" style={{ width: 64, textAlign: 'right', fontSize: '11.5px', color: 'var(--ink-dim)' }}>
                        {b.clicks} · {b.ctr}%
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p style={{ padding: '16px 0', textAlign: 'center', fontSize: 12, color: 'var(--ink-faint)' }}>
                Nenhum bloco configurado.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
