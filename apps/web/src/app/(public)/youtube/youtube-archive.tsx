'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { YouTubeVideoView, YouTubeCategoryView } from './youtube-types'
import { YouTubeArchiveCard } from './youtube-archive-card'
import { type Theme } from './youtube-atoms'

interface YouTubeArchiveProps {
  locale: 'pt' | 'en'
  theme: Theme
  filters: { cat: string; ch: string; tag: string; q: string }
  update: (patch: Partial<{ cat: string; ch: string; tag: string; q: string }>) => void
  reset: () => void
  filtered: YouTubeVideoView[]
  visible: YouTubeVideoView[]
  hasFilters: boolean
  page: number
  setPage: React.Dispatch<React.SetStateAction<number>>
  categories: YouTubeCategoryView[]
  allTags: { tag: string; n: number }[]
  totalVideoCount: number
  fmtNum: (n: number) => string
}

export function YouTubeArchive({
  locale,
  theme,
  filters,
  update,
  reset,
  filtered,
  visible,
  hasFilters,
  page,
  setPage,
  categories,
  allTags,
  totalVideoCount,
  fmtNum,
}: YouTubeArchiveProps) {
  const { ink, muted, faint, line, accent, yt, hand } = theme
  const L = locale

  const [loadMoreHovered, setLoadMoreHovered] = useState(false)
  const [clearHovered, setClearHovered] = useState(false)

  const moreLeft = filtered.length > visible.length

  // Series chip list: "★ Latest" virtual + categories
  const seriesChips = [
    { key: 'latest', label: L === 'pt' ? 'Latest' : 'Latest', count: totalVideoCount },
    ...categories.map(c => ({
      key: c.slug,
      label: L === 'pt' ? c.namePt : c.nameEn,
      count: c.count,
    })),
  ]

  return (
    <>
      {/* ── Filter bar section ── */}
      <section
        id="archive"
        style={{ maxWidth: 1280, margin: '0 auto', padding: '92px 28px 0', scrollMarginTop: 60 }}
      >
        {/* Section kicker */}
        <div style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
          letterSpacing: '0.2em', textTransform: 'uppercase',
          color: accent, marginBottom: 12,
        }}>
          {'§ 04 · '}{L === 'pt' ? 'arquivo' : 'archive'}
        </div>

        {/* Section title */}
        <h2 style={{
          fontFamily: '"Fraunces", serif', fontSize: 40, margin: '0 0 28px', fontWeight: 500,
          letterSpacing: '-0.022em', lineHeight: 1.05,
        }}>
          {L === 'pt' ? 'Tudo que tá no canal' : 'Everything on the channel'}
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 18,
            color: faint, marginLeft: 14, fontWeight: 400, letterSpacing: '0.04em',
          }}>
            [{totalVideoCount}]
          </span>
        </h2>

        {/* Search + channel filter row */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          {/* Search input */}
          <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 440 }}>
            <span style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              fontSize: 14, color: faint,
            }}>
              ⌕
            </span>
            <input
              type="text"
              value={filters.q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder={L === 'pt' ? 'buscar título, tag, série…' : 'search title, tag, series…'}
              style={{
                width: '100%', padding: '12px 14px 12px 36px',
                border: `1.5px solid ${line}`, background: 'transparent', color: ink,
                fontFamily: '"JetBrains Mono", monospace', fontSize: 13, outline: 'none',
                boxSizing: 'border-box' as CSSProperties['boxSizing'],
              }}
            />
          </div>

          {/* Channel toggle */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
              letterSpacing: '0.16em', textTransform: 'uppercase', color: faint, marginRight: 4,
            }}>
              {L === 'pt' ? 'canal:' : 'channel:'}
            </span>
            {[
              { k: 'all', l: L === 'pt' ? 'Ambos' : 'Both', flag: '🌐' },
              { k: 'pt', l: 'PT', flag: '🇧🇷' },
              { k: 'en', l: 'EN', flag: '🇺🇸' },
            ].map(({ k, l, flag }) => {
              const active = filters.ch === k
              return (
                <button
                  key={k}
                  onClick={() => update({ ch: k })}
                  style={{
                    padding: '5px 10px', fontSize: 10,
                    background: active ? ink : 'transparent',
                    color: active ? '#141210' : muted,
                    border: `1px solid ${active ? ink : line}`,
                    fontFamily: '"JetBrains Mono", monospace',
                    letterSpacing: '0.14em', textTransform: 'uppercase',
                    fontWeight: 600, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <span>{flag}</span> {l}
                </button>
              )
            })}
          </div>

          {/* Clear button */}
          {hasFilters && (
            <button
              onClick={reset}
              style={{
                padding: '5px 10px', fontSize: 10,
                background: 'transparent', color: yt,
                border: `1px dashed ${yt}`, marginLeft: 'auto',
                fontFamily: '"JetBrains Mono", monospace',
                letterSpacing: '0.14em', textTransform: 'uppercase',
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              ✕ {L === 'pt' ? 'limpar tudo' : 'clear all'}
            </button>
          )}
        </div>

        {/* Series chips row */}
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap',
          marginBottom: 14, alignItems: 'center',
        }}>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
            letterSpacing: '0.16em', textTransform: 'uppercase', color: faint, marginRight: 4,
          }}>
            {L === 'pt' ? 'série:' : 'series:'}
          </span>
          {seriesChips.map(({ key, label, count }) => {
            const active = filters.cat === key
            const rotation = active ? ((key.charCodeAt(0) || 0) % 3 - 1) * 0.6 : 0
            return (
              <button
                key={key}
                onClick={() => update({ cat: key })}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 13px',
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                  letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: active ? yt : 'transparent',
                  color: active ? '#FFF' : ink,
                  border: `1.5px solid ${active ? yt : line}`,
                  transform: active ? `rotate(${rotation}deg)` : 'none',
                }}
              >
                {key === 'latest' ? '★' : '▶'} {label}
                <span style={{
                  fontSize: 10, opacity: active ? 0.85 : 0.55,
                  padding: '1px 5px',
                  background: active ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)',
                  fontWeight: 500,
                }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Tags row */}
        <div style={{
          display: 'flex', gap: 6, flexWrap: 'wrap',
          marginBottom: 30, paddingBottom: 26,
          borderBottom: `1px dashed ${line}`, alignItems: 'center',
        }}>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
            letterSpacing: '0.16em', textTransform: 'uppercase', color: faint, marginRight: 4,
          }}>
            tags:
          </span>
          {allTags.map(({ tag, n }) => {
            const active = filters.tag === tag
            return (
              <button
                key={tag}
                onClick={() => update({ tag: active ? '' : tag })}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 9px',
                  background: active ? accent : 'transparent',
                  color: active ? '#FFF' : muted,
                  border: `1px solid ${active ? accent : line}`,
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5,
                  letterSpacing: '0.04em', cursor: 'pointer',
                }}
              >
                #{tag}
                <span style={{ fontSize: 9, opacity: active ? 0.8 : 0.5 }}>{n}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Grid section ── */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '0 28px 24px' }}>
        {/* Results count + sort annotation */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginBottom: 24, flexWrap: 'wrap', gap: 12,
        }}>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 12,
            color: muted, letterSpacing: '0.06em',
          }}>
            <span style={{ color: ink, fontWeight: 600 }}>{filtered.length}</span>
            {' '}
            {filtered.length === 1
              ? (L === 'pt' ? 'vídeo' : 'video')
              : (L === 'pt' ? 'vídeos' : 'videos')}
            {hasFilters && (
              <span style={{ color: faint, marginLeft: 8 }}>
                · {L === 'pt' ? 'filtrado' : 'filtered'}
              </span>
            )}
          </div>
          {!hasFilters && (
            <div style={{ ...hand, fontSize: 17, color: yt, transform: 'rotate(-1deg)' }}>
              ↓ {L === 'pt' ? 'do mais novo pro mais antigo' : 'newest first'}
            </div>
          )}
        </div>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            <div style={{ ...hand, fontSize: 32, color: muted, marginBottom: 12 }}>
              {L === 'pt' ? 'nenhum vídeo.' : 'no videos.'}
            </div>
            <button
              onClick={reset}
              style={{
                padding: '10px 22px', background: yt, color: '#FFF', border: 'none',
                fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {L === 'pt' ? 'limpar filtros' : 'clear filters'}
            </button>
          </div>
        ) : (
          <>
            {/* Video grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 32,
              rowGap: 48,
            }}>
              {visible.map((video, i) => (
                <YouTubeArchiveCard
                  key={video.id}
                  video={video}
                  index={i}
                  locale={L}
                  theme={theme}
                  fmtNum={fmtNum}
                />
              ))}
            </div>

            {/* Load more */}
            {moreLeft && (
              <div style={{ textAlign: 'center', marginTop: 56 }}>
                <button
                  onClick={() => setPage(p => p + 1)}
                  onMouseEnter={() => setLoadMoreHovered(true)}
                  onMouseLeave={() => setLoadMoreHovered(false)}
                  style={{
                    padding: '12px 28px',
                    background: loadMoreHovered ? yt : 'transparent',
                    color: loadMoreHovered ? '#FFF' : yt,
                    border: `1.5px solid ${yt}`,
                    fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                    letterSpacing: '0.18em', textTransform: 'uppercase',
                    fontWeight: 700, cursor: 'pointer',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  ▼ {L === 'pt' ? 'carregar mais' : 'load more'} ({filtered.length - visible.length})
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  )
}
