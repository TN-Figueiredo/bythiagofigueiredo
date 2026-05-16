'use client'

import { memo } from 'react'
import { WaveformDisplay } from './waveform-display'
import { energyColor, formatDuration, categoryConfig } from '../_helpers/audio-helpers'
import type { AudioAssetRow } from '@/lib/pipeline/audio-schemas'

interface AudioCardProps {
  asset: AudioAssetRow
  selected: boolean
  onSelect: (id: string) => void
}

const TYPE_EMOJI: Record<string, string> = {
  music: '🎵',
  sfx: '⚡',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  retired: 'Retired',
  downloaded: 'Downloaded',
}

const STATUS_BADGE_STYLE: Record<string, React.CSSProperties> = {
  pending: {
    background: 'rgba(234,179,8,0.15)',
    color: '#fbbf24',
    border: '1px solid rgba(234,179,8,0.25)',
  },
  retired: {
    background: 'rgba(107,114,128,0.15)',
    color: '#9ca3af',
    border: '1px solid rgba(107,114,128,0.25)',
  },
}

function AudioCardInner({ asset, selected, onSelect }: AudioCardProps) {
  const {
    id,
    track_name,
    artist,
    type,
    category,
    bpm,
    music_key,
    energy,
    duration_seconds,
    tags,
    status,
    energy: energyLevel,
  } = asset

  const isPending = status === 'pending'
  const isRetired = status === 'retired'
  const catConfig = categoryConfig(category)
  const eColor = energyColor(energyLevel)
  const displayName = track_name ?? asset.original_filename
  const emoji = TYPE_EMOJI[type] ?? '🎵'
  const visibleTags = tags.slice(0, 3)
  const overflowCount = tags.length - 3

  const ariaLabel = [
    displayName,
    type === 'music' ? 'Music' : 'SFX',
    bpm != null ? `${bpm} BPM` : null,
    energyLevel != null ? `Energy ${energyLevel}` : null,
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
    opacity: isRetired ? 0.55 : 1,
    filter: isRetired ? 'saturate(0.3)' : 'none',
  }

  const energyBarStyle: React.CSSProperties = {
    height: 2,
    background: `linear-gradient(90deg, ${eColor}, color-mix(in srgb, ${eColor} 40%, transparent))`,
    width: '100%',
    flexShrink: 0,
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
      style={cardStyle}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-card-id={id}
      className="audio-card"
    >
      {/* Energy bar */}
      <div style={energyBarStyle} aria-hidden="true" />

      {/* Waveform hero */}
      <div style={{ position: 'relative', height: 64 }}>
        <WaveformDisplay
          variant="card"
          peaks={isPending ? [] : (asset.metadata?.peaks as number[] | undefined) ?? []}
          energy={energyLevel}
          type={type}
          duration={duration_seconds}
        />

        {/* Duration badge */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: 4,
            right: 6,
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

        {/* Status badge — pending / retired only */}
        {(isPending || isRetired) && (
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
        {/* Title row: emoji + name + status dot */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            marginBottom: 3,
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 12, lineHeight: 1, flexShrink: 0 }}>
            {emoji}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--gem-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              fontStyle: isPending ? 'italic' : 'normal',
            }}
          >
            {displayName}
          </span>
          {/* Status dot (downloaded = green, others indicated via badge) */}
          <span
            aria-hidden="true"
            title={STATUS_LABEL[status] ?? status}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              flexShrink: 0,
              background:
                status === 'downloaded'
                  ? '#22c55e'
                  : status === 'pending'
                    ? '#fbbf24'
                    : '#6b7280',
            }}
          />
        </div>

        {/* Artist + category badge */}
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
              color: 'var(--gem-text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {artist ?? '—'}
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

        {/* Pending notice */}
        {isPending && (
          <p
            style={{
              fontSize: 9,
              color: 'var(--gem-text-muted)',
              fontStyle: 'italic',
              marginBottom: 5,
              lineHeight: 1.4,
            }}
          >
            Metadata available after download
          </p>
        )}

        {/* Metadata line: BPM, key, energy dots */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: visibleTags.length > 0 ? 6 : 0,
          }}
        >
          {bpm != null && (
            <span style={{ fontSize: 9, color: 'var(--gem-text-muted)', whiteSpace: 'nowrap' }}>
              {bpm} BPM
            </span>
          )}
          {music_key && (
            <span style={{ fontSize: 9, color: '#818cf8', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {music_key}
            </span>
          )}
          {/* Energy dots */}
          {energyLevel != null && (
            <span
              aria-label={`Energy ${energyLevel} of 5`}
              style={{ display: 'flex', gap: 2, alignItems: 'center', marginLeft: 'auto' }}
            >
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  data-energy-dot={i + 1}
                  style={{
                    display: 'inline-block',
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: i < energyLevel ? energyColor(energyLevel) : 'var(--gem-well)',
                  }}
                />
              ))}
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
                  color: 'var(--gem-text-muted)',
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
                  color: 'var(--gem-text-muted)',
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

      <style>{`
        .audio-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.2);
          border-color: ${catConfig.hoverAccent} !important;
        }
        .audio-card:focus-visible {
          box-shadow: 0 0 0 2px var(--gem-accent);
        }
      `}</style>
    </article>
  )
}

export const AudioCard = memo(AudioCardInner)
