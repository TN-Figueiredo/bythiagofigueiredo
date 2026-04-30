'use client'

interface SummaryBarProps {
  stats: string
  shortcuts?: Array<{ key: string; label: string }>
}

export function SummaryBar({ stats, shortcuts }: SummaryBarProps) {
  return (
    <div
      role="status"
      className="sticky bottom-0 flex items-center justify-between border-t border-gray-800 bg-gray-900 px-6 py-2"
    >
      <span className="text-[11px] text-gray-400">{stats}</span>
      {shortcuts && shortcuts.length > 0 && (
        <div className="flex items-center gap-3">
          {shortcuts.map((s) => (
            <span key={s.key} className="text-[10px] text-gray-500">
              <kbd className="rounded border border-gray-700 bg-gray-800 px-1 py-0.5 font-mono text-[9px] text-gray-400">{s.key}</kbd>
              {' '}{s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
