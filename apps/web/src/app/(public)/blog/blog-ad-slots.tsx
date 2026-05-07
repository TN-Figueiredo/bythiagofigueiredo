'use client'

import { useState, useCallback } from 'react'

export interface MockAdCreative {
  id: string
  label: string
  brand: string
  brandColor: string
  headline: string
  body: string
  cta: string
  url: string
  tagline: string
}

// ---------------------------------------------------------------------------
// Theme tokens (dark mode hardcoded)
// ---------------------------------------------------------------------------
const theme = {
  bg: '#1E1A12',
  paper: '#262117',
  paper2: '#2B261C',
  ink: '#EFE6D2',
  muted: '#958A75',
  faint: '#6B634F',
  line: '#2E2718',
  accent: '#FF8240',
  tape: '#E8C44A',
  tape2: '#5B8FB8',
  tapeR: '#C44B3D',
}

// ---------------------------------------------------------------------------
// Local dismiss helpers (parallels use-dismissable but keyed by prefix + id)
// ---------------------------------------------------------------------------
const DISMISS_KEY = 'btf_ads_dismissed'

function getDismissed(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}') as Record<string, number>
  } catch {
    return {}
  }
}

function setDismissed(id: string): void {
  const d = getDismissed()
  d[id] = Date.now()
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify(d))
  } catch {
    // localStorage may be full or unavailable
  }
}

function useLocalDismissable(
  prefix: string,
  creativeId: string,
): [dismissed: boolean, dismiss: () => void] {
  const key = `${prefix}${creativeId}`
  const [dismissed, setLocal] = useState(() => {
    if (typeof window === 'undefined') return false
    return Boolean(getDismissed()[key])
  })
  const dismiss = useCallback(() => {
    setDismissed(key)
    setLocal(true)
  }, [key])
  return [dismissed, dismiss]
}

// ---------------------------------------------------------------------------
// 1. Daily rotation selector
// ---------------------------------------------------------------------------
export function getDailyAdCreative(creatives: MockAdCreative[], slotIndex: number): MockAdCreative {
  const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24))
  const idx = (day + slotIndex + 2) % creatives.length
  return creatives[idx]!
}

// ---------------------------------------------------------------------------
// 2. Placement algorithm
// ---------------------------------------------------------------------------
export function getAdPositions(visibleCount: number): number[] {
  if (visibleCount < 6) return [visibleCount] // last position
  if (visibleCount <= 12) return [5] // position 6 (0-indexed: 5), start of row 3
  // > 12: every 6*n + offset, offset varies daily
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24),
  )
  const offset = (dayOfYear % 3) + 1
  const positions: number[] = []
  let pos = 6 + offset - 1 // 0-indexed
  while (pos < visibleCount) {
    positions.push(pos)
    pos += 6
  }
  return positions
}

// ---------------------------------------------------------------------------
// Shared: DismissButton
// ---------------------------------------------------------------------------
function DismissButton({
  onClick,
  label,
  color,
}: {
  onClick: () => void
  label: string
  color?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        background: 'transparent',
        border: 'none',
        color: color || theme.muted,
        cursor: 'pointer',
        padding: 4,
        fontSize: 14,
        lineHeight: 1,
        opacity: 0.55,
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '1'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '0.55'
      }}
    >
      ×
    </button>
  )
}

// ---------------------------------------------------------------------------
// Rotation + tape helpers (same logic as WritingCard)
// ---------------------------------------------------------------------------
function getRotation(index: number): string {
  const rotations = [-0.8, 0.5, -0.3, 0.7, -0.6, 0.4]
  return `rotate(${rotations[index % rotations.length]}deg)`
}

function getTapeColor(index: number): string {
  const colors = [theme.tape, theme.tape2, theme.tapeR, theme.tape, theme.tape2]
  return colors[index % colors.length]!
}

function getPaperBg(index: number): string {
  return index % 2 === 0 ? theme.paper : theme.paper2
}

// ---------------------------------------------------------------------------
// 3. BookmarkAd
// ---------------------------------------------------------------------------
interface BookmarkAdProps {
  creative: MockAdCreative
  index: number
  locale: 'pt-BR' | 'en'
}

export function BookmarkAd({ creative, index, locale }: BookmarkAdProps) {
  const [dismissed, dismiss] = useLocalDismissable('b_', creative.id)
  if (dismissed) return null

  const paperBg = getPaperBg(index)
  const rotation = getRotation(index)
  const tapeColor = getTapeColor(index)
  const labelText = creative.label.includes('CASA') || creative.label.includes('HOUSE')
    ? (locale === 'pt-BR' ? 'DA CASA' : 'HOUSE')
    : (locale === 'pt-BR' ? 'PATROCINADO' : 'SPONSORED')

  return (
    <div
      data-slot-key="archive:grid:bookmark"
      style={{
        position: 'relative',
        background: paperBg,
        padding: '20px 20px 22px',
        transform: rotation,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        boxShadow: '0 6px 16px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.03)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'rotate(0deg) translateY(-3px)'
        e.currentTarget.style.boxShadow =
          '0 12px 28px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.05)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = rotation
        e.currentTarget.style.boxShadow =
          '0 6px 16px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.03)'
      }}
    >
      {/* Tape decoration */}
      <div
        style={{
          position: 'absolute',
          top: -9,
          left: '50%',
          transform: 'translateX(-50%) rotate(2deg)',
          width: 64,
          height: 15,
          background: tapeColor,
          opacity: 0.75,
          boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
        }}
      />

      {/* Header: label + dismiss */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 9,
            letterSpacing: '0.18em',
            color: theme.muted,
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: creative.brandColor,
              display: 'inline-block',
            }}
          />
          {labelText}
        </div>
        <DismissButton
          onClick={dismiss}
          label={locale === 'pt-BR' ? 'Fechar anúncio' : 'Dismiss ad'}
        />
      </div>

      {/* Title */}
      <div
        style={{
          fontFamily: '"Fraunces", serif',
          fontSize: 17,
          fontWeight: 500,
          lineHeight: 1.25,
          color: theme.ink,
          letterSpacing: '-0.005em',
          marginBottom: 8,
        }}
      >
        {creative.headline}
      </div>

      {/* Body */}
      <div
        style={{
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontSize: 13,
          color: theme.muted,
          lineHeight: 1.5,
          marginBottom: 14,
          flex: 1,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {creative.body}
      </div>

      {/* CTA button */}
      <a
        href={creative.url}
        style={{
          display: 'inline-block',
          padding: '8px 14px',
          border: `1px solid ${creative.brandColor}`,
          color: creative.brandColor,
          textDecoration: 'none',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 600,
          alignSelf: 'flex-start',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = creative.brandColor
          e.currentTarget.style.color = '#FFFCEE'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = creative.brandColor
        }}
      >
        {creative.cta}
      </a>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 4. MarginaliaAd
// ---------------------------------------------------------------------------
interface MarginaliaAdProps {
  creative: MockAdCreative
  locale: 'pt-BR' | 'en'
}

export function MarginaliaAd({ creative, locale }: MarginaliaAdProps) {
  const [dismissed, dismiss] = useLocalDismissable('m_', creative.id)
  if (dismissed) return null

  const labelText = creative.label.includes('CASA') || creative.label.includes('HOUSE')
    ? (locale === 'pt-BR' ? 'DA CASA' : 'HOUSE')
    : (locale === 'pt-BR' ? 'PATROCINADO' : 'SPONSORED')

  return (
    <div
      data-slot-key="archive:footer:marginalia"
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '20px 24px',
        background: theme.paper2,
        borderTop: `1px dashed ${theme.line}`,
        borderBottom: `1px dashed ${theme.line}`,
        position: 'relative',
      }}
    >
      {/* Header: label + dismiss */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 10,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 9,
            letterSpacing: '0.16em',
            color: theme.muted,
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: creative.brandColor,
              display: 'inline-block',
            }}
          />
          {labelText}
        </div>
        <DismissButton
          onClick={dismiss}
          label={locale === 'pt-BR' ? 'Fechar' : 'Close'}
        />
      </div>

      {/* Content */}
      <a href={creative.url} style={{ textDecoration: 'none', display: 'block' }}>
        <div
          style={{
            fontFamily: '"Fraunces", serif',
            fontSize: 16,
            fontWeight: 500,
            color: theme.ink,
            lineHeight: 1.25,
            marginBottom: 6,
            letterSpacing: '-0.005em',
          }}
        >
          {creative.headline}
        </div>
        <div
          style={{
            fontFamily: '"Source Serif 4", Georgia, serif',
            fontSize: 13,
            color: theme.muted,
            lineHeight: 1.5,
            marginBottom: 10,
          }}
        >
          {creative.body}
        </div>
        <div
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10,
            letterSpacing: '0.06em',
            color: creative.brandColor,
            fontWeight: 600,
          }}
        >
          {creative.cta} →
        </div>
      </a>

      {/* Brand tagline */}
      <div
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 9,
          color: theme.faint,
          letterSpacing: '0.04em',
          marginTop: 8,
        }}
      >
        {creative.brand} · {creative.tagline}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 5. BowtieAd (newsletter CTA form)
// ---------------------------------------------------------------------------
interface BowtieAdProps {
  locale: 'pt-BR' | 'en'
}

export function BowtieAd({ locale }: BowtieAdProps) {
  const [dismissed, dismiss] = useLocalDismissable('bw_', 'archive-bowtie')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  if (dismissed) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSent(true)
  }

  return (
    <div
      data-slot-key="archive:footer:bowtie"
      style={{
        width: '100%',
        padding: '32px 28px 28px',
        background: theme.paper,
        borderTop: `1px dashed ${theme.line}`,
        borderBottom: `1px dashed ${theme.line}`,
        position: 'relative',
      }}
    >
      <div style={{ maxWidth: 620, margin: '0 auto', position: 'relative' }}>
        {/* Dismiss */}
        <div style={{ position: 'absolute', top: -8, right: -8 }}>
          <DismissButton
            onClick={dismiss}
            label={locale === 'pt-BR' ? 'Fechar' : 'Close'}
          />
        </div>

        {/* Title (cursive hand-drawn feel) */}
        <div
          style={{
            fontFamily: '"Caveat", cursive',
            fontSize: 28,
            fontWeight: 600,
            color: theme.ink,
            lineHeight: 1.15,
            marginBottom: 8,
            textWrap: 'balance',
            textAlign: 'center',
          }}
        >
          {locale === 'pt-BR'
            ? 'Receba o próximo ensaio antes de virar público'
            : 'Get the next essay before it goes public'}
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontFamily: '"Source Serif 4", Georgia, serif',
            fontSize: 14,
            color: theme.muted,
            lineHeight: 1.5,
            marginBottom: 20,
            maxWidth: 520,
            margin: '0 auto 20px',
            textAlign: 'center',
          }}
        >
          {locale === 'pt-BR'
            ? 'Uma vez por semana, direto no email. Sem spam, sem algoritmo — só texto que vale a pena ler.'
            : 'Once a week, straight to your inbox. No spam, no algorithm — just writing worth reading.'}
        </div>

        {/* Form or success */}
        {!sent ? (
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={locale === 'pt-BR' ? 'voce@email.com' : 'you@email.com'}
              style={{
                flex: 1,
                minWidth: 200,
                padding: '12px 14px',
                fontSize: 14,
                border: `1px solid ${theme.faint}`,
                background: theme.bg,
                color: theme.ink,
                fontFamily: '"Inter", sans-serif',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '12px 20px',
                background: theme.accent,
                color: theme.bg,
                border: 'none',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 11,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.85'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1'
              }}
            >
              {locale === 'pt-BR' ? 'Assinar' : 'Subscribe'}
            </button>
          </form>
        ) : (
          <div
            style={{
              fontFamily: '"Caveat", cursive',
              fontSize: 20,
              color: theme.accent,
              padding: '10px 0',
              textAlign: 'center',
            }}
          >
            {locale === 'pt-BR' ? 'Recebido. Confira sua caixa.' : 'Got it. Check your inbox.'}
          </div>
        )}
      </div>
    </div>
  )
}

