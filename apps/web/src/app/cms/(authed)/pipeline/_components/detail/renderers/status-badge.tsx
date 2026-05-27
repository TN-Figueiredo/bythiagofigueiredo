'use client'

export const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  RECORDED: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: 'Gravado' },
  GRAVADO: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: 'Gravado' },
  IMPROVISED: { bg: 'rgba(249,115,22,0.15)', color: '#f97316', label: 'Improvisado' },
  IMPROVISADO: { bg: 'rgba(249,115,22,0.15)', color: '#f97316', label: 'Improvisado' },
  COMPRESSED: { bg: 'rgba(6,182,212,0.15)', color: '#06b6d4', label: 'Comprimido' },
  EXPANDIDO: { bg: 'rgba(6,182,212,0.15)', color: '#06b6d4', label: 'Expandido' },
  'EDITADO MANUALMENTE': { bg: 'rgba(234,179,8,0.15)', color: '#eab308', label: 'Edit. Manual' },
}

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status.toUpperCase()] ?? { bg: 'rgba(255,255,255,0.05)', color: 'var(--gem-dim)', label: status }
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap"
      style={{ background: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  )
}
