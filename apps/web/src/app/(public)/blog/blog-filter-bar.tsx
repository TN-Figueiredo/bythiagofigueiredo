'use client'

import { type CSSProperties, useRef } from 'react'
import { ptBR } from '@/components/blog/_i18n/pt-BR'
import { en } from '@/components/blog/_i18n/en'
import type { BlogStrings } from '@/components/blog/_i18n/types'

interface BlogFilterBarProps {
  categories: Array<{ key: string; label: string; color: string; count: number }>
  tags: Array<{ tag: string; count: number }>
  totalCount: number
  filteredCount: number
  filters: { cat: string; tag: string; q: string; sort: string }
  onFilterChange: (patch: Partial<BlogFilterBarProps['filters']>) => void
  onReset: () => void
  hasFilters: boolean
  locale: 'pt-BR' | 'en'
}

const tokens = () => ({
  line: 'var(--pb-line)',
  ink: 'var(--pb-ink)',
  muted: 'var(--pb-muted)',
  faint: 'var(--pb-faint)',
  accent: 'var(--pb-accent)',
})

function getSortOptions(t: BlogStrings) {
  return [
    { key: 'recent', label: t.recent },
    { key: 'longest', label: t.longest },
    { key: 'shortest', label: t.shortest },
    { key: 'unread', label: t.unread },
  ] as const
}

const MAX_TAGS_SHOWN = 20

export function BlogFilterBar({
  categories,
  tags,
  totalCount,
  filteredCount,
  filters,
  onFilterChange,
  onReset,
  hasFilters,
  locale,
}: BlogFilterBarProps) {
  const c = tokens()
  const t = locale === 'pt-BR' ? ptBR : en
  const sortOptions = getSortOptions(t)
  const searchRef = useRef<HTMLInputElement>(null)

  const mono: CSSProperties = { fontFamily: '"JetBrains Mono", monospace' }

  const labelStyle: CSSProperties = {
    ...mono,
    fontSize: 10,
    color: c.faint,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    flexShrink: 0,
    marginRight: 8,
  }

  const chipRotation = (text: string) => {
    const code = text.charCodeAt(0) || 0
    return ((code % 3) - 1) * 0.6
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Row 1: Search + Sort + Clear All */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        {/* Search Input */}
        <div
          style={{
            flex: '1 1 280px',
            maxWidth: 440,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: 10,
              ...mono,
              fontSize: 14,
              color: c.faint,
              pointerEvents: 'none',
            }}
            aria-hidden="true"
          >
            ⌕
          </span>
          <input
            ref={searchRef}
            type="text"
            role="searchbox"
            aria-label={t.searchPlaceholder}
            placeholder={t.searchPlaceholder}
            value={filters.q}
            onChange={(e) => onFilterChange({ q: e.target.value })}
            data-search-input
            style={{
              ...mono,
              fontSize: 13,
              width: '100%',
              padding: '8px 32px 8px 30px',
              border: `1.5px solid ${c.line}`,
              borderRadius: 4,
              background: 'transparent',
              color: c.ink,
              outline: 'none',
            }}
          />
          {filters.q && (
            <button
              onClick={() => {
                onFilterChange({ q: '' })
                searchRef.current?.focus()
              }}
              aria-label={t.clearFilters}
              style={{
                position: 'absolute',
                right: 8,
                ...mono,
                fontSize: 14,
                color: c.muted,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 4px',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Sort Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={labelStyle}>{t.sort.toLowerCase()}:</span>
          {sortOptions.map((opt) => {
            const active = filters.sort === opt.key
            return (
              <button
                key={opt.key}
                onClick={() => onFilterChange({ sort: opt.key })}
                aria-pressed={active}
                style={{
                  ...mono,
                  fontSize: 11,
                  padding: '5px 10px',
                  border: active ? 'none' : `1.5px solid ${c.line}`,
                  borderRadius: 3,
                  background: active ? c.ink : 'transparent',
                  color: active ? 'var(--pb-bg)' : c.muted,
                  cursor: 'pointer',
                  fontWeight: active ? 600 : 400,
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* Clear All */}
        {hasFilters && (
          <button
            onClick={onReset}
            style={{
              ...mono,
              fontSize: 11,
              padding: '5px 12px',
              border: `1.5px dashed ${c.accent}`,
              borderRadius: 3,
              background: 'transparent',
              color: c.accent,
              cursor: 'pointer',
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            ✕ {t.clearAll}
          </button>
        )}
      </div>

      {/* Row 2: Categories */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          overflowX: 'auto',
        }}
      >
        <span style={labelStyle}>{t.categories.toLowerCase()}:</span>

        <CategoryChip
          label={t.allPosts.toUpperCase()}
          count={totalCount}
          active={!filters.cat}
          color={c.accent}
          tokens={c}
          onClick={() => onFilterChange({ cat: '' })}
          rotation={0}
        />

        {categories.map((cat) => (
          <CategoryChip
            key={cat.key}
            label={cat.label.toUpperCase()}
            count={cat.count}
            active={filters.cat === cat.key}
            color={cat.color}
            tokens={c}
            onClick={() => onFilterChange({ cat: filters.cat === cat.key ? '' : cat.key })}
            rotation={chipRotation(cat.label)}
          />
        ))}
      </div>

      {/* Row 3: Tags */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
          paddingBottom: 14,
          borderBottom: `1px dashed ${c.line}`,
          overflowX: 'auto',
        }}
      >
        <span style={labelStyle}>{t.tags.toLowerCase()}:</span>

        {tags.slice(0, MAX_TAGS_SHOWN).map((t) => {
          const active = filters.tag === t.tag
          return (
            <button
              key={t.tag}
              onClick={() => onFilterChange({ tag: active ? '' : t.tag })}
              aria-pressed={active}
              style={{
                ...mono,
                fontSize: 10.5,
                letterSpacing: '0.04em',
                padding: '4px 8px',
                border: active ? 'none' : `1px solid ${c.line}`,
                borderRadius: 3,
                background: active ? c.accent : 'transparent',
                color: active ? '#fff' : c.muted,
                cursor: 'pointer',
                fontWeight: active ? 600 : 400,
                transition: 'background 0.15s, color 0.15s',
                textTransform: 'lowercase',
              }}
            >
              #{t.tag}
              <span
                style={{
                  fontSize: 9,
                  opacity: active ? 0.8 : 0.5,
                  marginLeft: 4,
                }}
              >
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Row 4: Result count + "começa por aqui" */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div aria-live="polite" style={{ ...mono, fontSize: 12, color: c.muted }}>
          <span style={{ fontWeight: 700, color: c.ink }}>{filteredCount}</span>{' '}
          {t.results}
          {hasFilters && (
            <span style={{ opacity: 0.7 }}>
              {' · '}
              {t.filtering}
              {filters.cat && ` · ${filters.cat}`}
              {filters.tag && ` · #${filters.tag}`}
              {filters.q && ` · "${filters.q}"`}
            </span>
          )}
        </div>

        {!hasFilters && (
          <span
            style={{
              fontFamily: '"Caveat", cursive',
              fontSize: 17,
              color: c.accent,
              transform: 'rotate(-1deg)',
              display: 'inline-block',
            }}
          >
            ↓ {t.startHere}
          </span>
        )}
      </div>
    </div>
  )
}

function CategoryChip({
  label,
  count,
  active,
  color,
  tokens: c,
  onClick,
  rotation,
}: {
  label: string
  count: number
  active: boolean
  color: string
  tokens: ReturnType<typeof tokens>
  onClick: () => void
  rotation: number
}) {
  const baseStyle: CSSProperties = {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: 11,
    letterSpacing: '0.12em',
    fontWeight: 600,
    padding: '5px 10px',
    borderRadius: 3,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'background 0.15s, color 0.15s, transform 0.15s',
    border: active ? 'none' : `1.5px solid ${c.line}`,
    background: active ? color : 'transparent',
    color: active ? '#fff' : c.muted,
    transform: active ? `rotate(${rotation}deg)` : 'none',
  }

  return (
    <button onClick={onClick} aria-pressed={active} style={baseStyle}>
      {!active && (
        <span style={{ color, fontSize: 10, lineHeight: 1 }} aria-hidden="true">●</span>
      )}
      {label}
      <span
        style={{
          fontSize: 10,
          padding: '1px 5px',
          borderRadius: 3,
          background: active ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)',
          lineHeight: 1.4,
        }}
      >
        {count}
      </span>
    </button>
  )
}
