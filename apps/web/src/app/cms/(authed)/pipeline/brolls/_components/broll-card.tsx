'use client'

import { memo } from 'react'
import { FrameStrip } from './frame-strip'
import { formatDuration, sourceTypeConfig, categoryConfig, sanitizeThumbnailUrl } from '../_helpers/broll-helpers'
import type { BRollAssetRow } from '@/lib/pipeline/broll-schemas'
import styles from './broll-card.module.css'

interface BRollCardProps {
  asset: BRollAssetRow
  selected: boolean
  onSelect: (id: string) => void
}

const STATUS_LABEL: Record<string, string> = {
  available: 'Available',
  pending: 'Pending',
  retired: 'Retired',
}

const STATUS_BADGE_STYLE: Record<string, React.CSSProperties> = {
  pending: {
    background: 'rgba(234,179,8,0.15)',
    color: '#fbbf24',
    border: '1px solid rgba(234,179,8,0.25)',
  },
}


function BRollCardInner({ asset, selected, onSelect }: BRollCardProps) {
  const {
    id,
    original_filename,
    renamed_to,
    source_type,
    category,
    resolution,
    duration_seconds,
    tags,
    status,
    thumbnail_url,
    metadata,
  } = asset

  const isPending = status === 'pending'
  const srcConfig = sourceTypeConfig(source_type)
  const catConfig = categoryConfig(category)
  const displayName = renamed_to ?? original_filename
  const visibleTags = tags.slice(0, 3)
  const overflowCount = tags.length - 3
  const safeThumbnailUrl = sanitizeThumbnailUrl(thumbnail_url)

  const frames = Array.isArray((metadata as Record<string, unknown>)?.frame_strip)
    ? ((metadata as Record<string, unknown>).frame_strip as Array<{ url: string; timestamp: number }>)
    : null

  const ariaLabel = [
    displayName,
    source_type === 'pessoal' ? 'Pessoal' : 'Generico',
    resolution,
    duration_seconds != null ? formatDuration(duration_seconds) : null,
    STATUS_LABEL[status] ?? status,
  ]
    .filter(Boolean)
    .join(', ')

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    cursor: 'pointer',
    outline: 'none',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
    background: 'var(--gem-surface)',
    border: selected
      ? '2px solid var(--gem-accent)'
      : '1px solid var(--gem-border)',
    boxShadow: selected
      ? '0 0 0 3px color-mix(in srgb, var(--gem-accent) 20%, transparent)'
      : 'none',
  }

  function handleClick() {
    onSelect(id)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(id)
    }
  }

  return (
    <article
      role="article"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={selected}
      style={{ ...cardStyle, '--broll-hover-accent': catConfig.hoverAccent } as React.CSSProperties}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-card-id={id}
      className={styles.brollCard}
    >
      {/* Thumbnail hero */}
      <div style={{ position: 'relative' }}>
        <FrameStrip
          variant="card"
          frames={frames}
          duration={duration_seconds}
          resolution={resolution}
          thumbnailUrl={safeThumbnailUrl}
        />

        {/* Duration badge */}
        {duration_seconds != null && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: 4,
              left: 6,
              fontSize: 9,
              fontVariantNumeric: 'tabular-nums',
              color: 'rgba(255,255,255,0.6)',
              background: 'rgba(0,0,0,0.45)',
              borderRadius: 3,
              padding: '1px 4px',
              lineHeight: 1.4,
              pointerEvents: 'none',
            }}
          >
            {formatDuration(duration_seconds)}
          </span>
        )}

        {/* Status badge — pending only */}
        {isPending && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 4,
              left: 6,
              fontSize: 9,
              borderRadius: 3,
              padding: '1px 5px',
              lineHeight: 1.4,
              fontWeight: 600,
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
              pointerEvents: 'none',
              ...(STATUS_BADGE_STYLE[status] ?? {}),
            }}
          >
            {STATUS_LABEL[status]}
          </span>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: '8px 10px 10px' }}>
        {/* Title row: source dot + name */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            marginBottom: 3,
          }}
        >
          <span
            aria-hidden="true"
            title={srcConfig.label}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              flexShrink: 0,
              background: srcConfig.dotColor,
            }}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--gem-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {displayName}
          </span>
        </div>

        {/* Subtitle: source_type . resolution */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            marginBottom: 5,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: 'var(--gem-text-muted, var(--gem-muted))',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {srcConfig.label} {resolution ? `· ${resolution === '4k' ? '4K' : resolution}` : ''}
          </span>
          {category && (
            <span
              style={{
                fontSize: 9,
                borderRadius: 3,
                padding: '1px 5px',
                fontWeight: 600,
                letterSpacing: '0.02em',
                textTransform: 'capitalize',
                background: catConfig.badgeBg,
                color: catConfig.badgeColor,
                flexShrink: 0,
                lineHeight: 1.5,
              }}
            >
              {category}
            </span>
          )}
        </div>

        {/* Tag pills */}
        {visibleTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {visibleTags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 8,
                  borderRadius: 3,
                  padding: '1px 4px',
                  background: 'var(--gem-well)',
                  color: 'var(--gem-text-muted, var(--gem-muted))',
                  lineHeight: 1.5,
                  letterSpacing: '0.01em',
                }}
              >
                {tag}
              </span>
            ))}
            {overflowCount > 0 && (
              <span
                style={{
                  fontSize: 8,
                  borderRadius: 3,
                  padding: '1px 4px',
                  background: 'var(--gem-well)',
                  color: 'var(--gem-text-muted, var(--gem-muted))',
                  lineHeight: 1.5,
                  opacity: 0.7,
                }}
              >
                +{overflowCount}
              </span>
            )}
          </div>
        )}
      </div>

    </article>
  )
}

export const BRollCard = memo(BRollCardInner)
