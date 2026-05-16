import type { SceneSFX } from './types'
import { RESOLVE_COLORS, SFX_CATEGORY_COLORS } from './types'
import { ScoreBar } from './score-bar'

interface SFXItemCardProps {
  sfx: SceneSFX
}

export function SFXItemCard({ sfx }: SFXItemCardProps) {
  const resolveStatus = sfx.resolve_status ? RESOLVE_COLORS[sfx.resolve_status] : null
  const categoryColor = sfx.sfx_category ? SFX_CATEGORY_COLORS[sfx.sfx_category] : null
  const hasFile = sfx.original_filename && sfx.resolve_status !== 'NO_MATCH'
  const showSearch = sfx.resolve_status === 'NO_MATCH' || sfx.resolve_status === 'PARTIAL_MATCH'
  const borderColor = sfx.resolve_status === 'NO_MATCH' ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.05)'

  return (
    <div
      className="rounded-[5px] px-2.5 py-[7px]"
      style={{
        border: `1px solid ${borderColor}`,
        background: sfx.resolve_status === 'NO_MATCH' ? 'rgba(59,130,246,0.02)' : 'rgba(255,255,255,0.015)',
      }}
    >
      <div className="flex gap-2 items-start">
        <span className="font-mono text-[10px] flex-shrink-0 w-8" style={{ color: '#818cf8' }}>
          {sfx.timestamp}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-[3px]">
            {categoryColor && sfx.sfx_category && (
              <span
                className="text-[8px] font-bold uppercase px-[5px] py-px rounded tracking-wide"
                style={{ background: categoryColor.bg, color: categoryColor.color }}
              >
                {sfx.sfx_category}
              </span>
            )}
            <span className="text-[10px]" style={{ color: '#8b949e' }}>
              {sfx.description}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {hasFile && (
              <span className="text-[9px] font-semibold" style={{ color: '#c9d1d9' }}>
                {sfx.original_filename}
              </span>
            )}
            {resolveStatus && (
              <span
                className="text-[9px] px-[6px] py-px rounded font-semibold"
                style={{ background: resolveStatus.bg, color: resolveStatus.color }}
              >
                {resolveStatus.label}
              </span>
            )}
            {sfx.score != null && sfx.score_max != null && (
              <ScoreBar score={sfx.score} max={sfx.score_max} />
            )}
          </div>

          {showSearch && sfx.search_terms && (
            <div className="flex items-center gap-[5px] flex-wrap mt-1.5">
              <span
                className="text-[9px] px-[6px] py-px rounded font-semibold"
                style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}
              >
                🔗
              </span>
              {sfx.search_terms.split(',').map((term) => {
                const trimmed = term.trim()
                if (!trimmed) return null
                const url = `https://artlist.io/royalty-free-sound-effects?search=${encodeURIComponent(trimmed)}`
                return (
                  <a
                    key={trimmed}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] font-medium rounded-full px-[6px] py-px transition-colors"
                    style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}
                  >
                    {trimmed} ↗
                  </a>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
