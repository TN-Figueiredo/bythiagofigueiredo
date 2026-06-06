'use client'

export function SearchPlus({ size = 14 }: { size?: number }) {
  return (
    <svg
      className="lucide"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
      <path d="M11 8v6" />
      <path d="M8 11h6" />
    </svg>
  )
}

import {
  Target,
  ArrowRight,
  FlaskConical,
  CheckCircle2,
  RefreshCw,
  Archive,
  Sparkles,
  Pen,
  Users,
} from 'lucide-react'
import {
  STATUS_META,
  THEME_META,
  HORIZON_META,
  DECISION_STATUS_META,
  SOURCE_META,
} from '@/lib/pipeline/research-types'
import type {
  ResearchStatus,
  ThemeId,
  DecisionHorizon,
  DecisionStatus,
} from '@/lib/pipeline/research-types'
import type { ResearchSource as ResearchSourceEnum } from '@/lib/pipeline/research-schemas'

// ---------------------------------------------------------------------------
// Icon maps
// ---------------------------------------------------------------------------

const HORIZON_ICONS: Record<DecisionHorizon, React.ReactNode> = {
  agora: <Target size={12} />,
  proximo: <ArrowRight size={12} />,
  explorar: <FlaskConical size={12} />,
}

const DECISION_STATUS_ICONS: Record<DecisionStatus, React.ReactNode> = {
  decidido: <CheckCircle2 size={12} />,
  testando: <FlaskConical size={12} />,
  revisar: <RefreshCw size={12} />,
  arquivado: <Archive size={12} />,
}

const SOURCE_ICONS: Record<ResearchSourceEnum, React.ReactNode> = {
  cowork: <Sparkles size={12} />,
  thiago: <Pen size={12} />,
  dupla: <Users size={12} />,
}

// ---------------------------------------------------------------------------
// 1. StatusBadge — inline pill with colored dot + label
// ---------------------------------------------------------------------------

interface StatusBadgeProps {
  status: ResearchStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const meta = STATUS_META[status]
  if (!meta) return null

  return (
    <span
      className={`badge ${meta.kind === 'muted' ? '' : meta.kind}`}
      style={{ fontSize: size === 'sm' ? 11 : 12.5 }}
    >
      <span
        className="dot"
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: meta.dot,
          flexShrink: 0,
        }}
      />
      {meta.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// 2. TemaDot — small colored circle, optionally with label
// ---------------------------------------------------------------------------

interface TemaDotProps {
  id: ThemeId
  showLabel?: boolean
  size?: number
}

export function TemaDot({ id, showLabel = false, size = 8 }: TemaDotProps) {
  const meta = THEME_META[id]
  if (!meta) return null

  return (
    <span className="tema-tag">
      <span
        className="tdot"
        style={{ width: size, height: size, background: meta.color }}
      />
      {showLabel && meta.short}
    </span>
  )
}

// ---------------------------------------------------------------------------
// 3. TemaTag — inline chip with dot + short label (always shows label)
// ---------------------------------------------------------------------------

interface TemaTagProps {
  id: ThemeId
}

export function TemaTag({ id }: TemaTagProps) {
  const meta = THEME_META[id]
  if (!meta) return null

  return (
    <span className="tema-tag">
      <span className="tdot" style={{ background: meta.color }} />
      {meta.short}
    </span>
  )
}

// ---------------------------------------------------------------------------
// 4. HorizonChip — inline pill with icon name + label
// ---------------------------------------------------------------------------

interface HorizonChipProps {
  horizon: DecisionHorizon
}

export function HorizonChip({ horizon }: HorizonChipProps) {
  const meta = HORIZON_META[horizon]
  if (!meta) return null

  return (
    <span
      className="hz-chip"
      style={{ '--hc': meta.color } as React.CSSProperties}
    >
      {HORIZON_ICONS[horizon]}
      {meta.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// 5. DecisionStatusBadge — pill with icon + label, tinted by kind
// ---------------------------------------------------------------------------

interface DecisionStatusBadgeProps {
  status: DecisionStatus
}

export function DecisionStatusBadge({ status }: DecisionStatusBadgeProps) {
  const meta = DECISION_STATUS_META[status]
  if (!meta) return null

  const tone = meta.kind === 'muted' ? 'var(--text-dim)' : `var(--${meta.kind})`

  return (
    <span
      className="dstat"
      style={{ '--ds': tone } as React.CSSProperties}
    >
      {DECISION_STATUS_ICONS[status]}
      {meta.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// 6. SourceTag — inline chip showing authorship
// ---------------------------------------------------------------------------

interface SourceTagProps {
  source: ResearchSourceEnum
}

export function SourceTag({ source }: SourceTagProps) {
  const meta = SOURCE_META[source]
  if (!meta) return null

  return (
    <span
      className="src-tag"
      style={{ '--st': meta.tone } as React.CSSProperties}
    >
      {SOURCE_ICONS[source]}
      {meta.label}
    </span>
  )
}

