interface TagColor { pill: { bg: string; color: string; border: string }; text: string }

const NOTE_COLOR: TagColor = { pill: { bg: '#64748b18', color: '#94a3b8', border: '#64748b25' }, text: '#94a3b8' }

export const TAG_COLORS: Record<string, TagColor> = {
  VISUAL:  { pill: { bg: '#7c3aed20', color: '#a78bfa', border: '#7c3aed30' }, text: '#c4b5fd' },
  TOM:     { pill: { bg: '#0ea5e920', color: '#67e8f9', border: '#0ea5e930' }, text: '#a5f3fc' },
  'B-ROLL': { pill: { bg: '#10b98120', color: '#6ee7b7', border: '#10b98130' }, text: '#a7f3d0' },
  CORTE:   { pill: { bg: '#f4363620', color: '#fca5a5', border: '#f4363630' }, text: '#fecaca' },
  OVERLAY: { pill: { bg: '#ec489920', color: '#f9a8d4', border: '#ec489930' }, text: '#fbcfe8' },
  TRANS:   { pill: { bg: '#f59e0b20', color: '#fbbf24', border: '#f59e0b30' }, text: '#fde68a' },
  MUSIC:   { pill: { bg: '#a855f720', color: '#c084fc', border: '#a855f730' }, text: '#d8b4fe' },
  STYLE:   { pill: { bg: '#0ea5e920', color: '#67e8f9', border: '#0ea5e930' }, text: '#a5f3fc' },
  TIMING:  { pill: { bg: '#818cf820', color: '#a5b4fc', border: '#818cf830' }, text: '#c7d2fe' },
  ENTRY:   { pill: { bg: '#818cf820', color: '#a5b4fc', border: '#818cf830' }, text: '#c7d2fe' },
  FLOW:    { pill: { bg: '#f59e0b20', color: '#fbbf24', border: '#f59e0b30' }, text: '#fde68a' },
  NOTE:    NOTE_COLOR,
}

export function getTagColor(tag: string): TagColor {
  return TAG_COLORS[tag] ?? NOTE_COLOR
}

export function TagPill({ tag }: { tag: string }) {
  const { pill } = getTagColor(tag)
  return (
    <span
      className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide shrink-0 whitespace-nowrap"
      style={{ background: pill.bg, color: pill.color, border: `1px solid ${pill.border}`, minWidth: 50 }}
    >
      {tag}
    </span>
  )
}

export function TimestampChip({ ts }: { ts: string }) {
  return (
    <span
      className="font-mono text-[10px] font-semibold px-1 py-px rounded mr-1"
      style={{ color: '#818cf8', background: '#818cf810', border: '1px solid #818cf815' }}
    >
      {ts}
    </span>
  )
}

export function DbChip({ value }: { value: string }) {
  return (
    <span
      className="font-mono text-[10px] font-semibold px-1 py-px rounded"
      style={{ color: '#fbbf24', background: '#f59e0b10' }}
    >
      {value}
    </span>
  )
}

export function PauseChip({ duration }: { duration: string }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 font-mono text-[10px] font-semibold px-2 py-0.5 rounded align-middle mx-0.5"
      style={{ color: '#fbbf24', background: '#f59e0b18', border: '1px solid #f59e0b20' }}
    >
      ⏸ {duration}
    </span>
  )
}

export function NegHighlight({ text }: { text: string }) {
  return (
    <span
      className="font-bold px-1 rounded"
      style={{ color: '#f87171', background: '#f8717110', border: '1px solid #f8717120' }}
    >
      {text}
    </span>
  )
}

export function EmphHighlight({ text }: { text: string }) {
  return (
    <span className="font-bold uppercase" style={{ color: '#fbbf24' }}>
      {text}
    </span>
  )
}

export function OptionalBadge() {
  return (
    <span
      className="text-[8px] font-semibold uppercase tracking-wide px-1.5 py-px rounded mr-1"
      style={{ color: '#64748b', background: '#64748b15' }}
    >
      OPT
    </span>
  )
}
