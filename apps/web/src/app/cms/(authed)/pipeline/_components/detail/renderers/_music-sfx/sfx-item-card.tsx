import type { SceneSFX } from './types'
import { RESOLVE_COLORS, SFX_CATEGORY_COLORS } from './types'
import { ScoreBar } from './score-bar'
import { buildArtlistSfxUrl } from '@/lib/pipeline/artlist-search'

interface SFXItemCardProps {
  sfx: SceneSFX
}

export function SFXItemCard({ sfx }: SFXItemCardProps) {
  const resolveStatus = sfx.resolve_status ? RESOLVE_COLORS[sfx.resolve_status] : null
  const categoryColor = sfx.sfx_category ? SFX_CATEGORY_COLORS[sfx.sfx_category] : null
  const hasFile = sfx.original_filename && sfx.resolve_status !== 'NO_MATCH'
  const showSearch = sfx.resolve_status === 'NO_MATCH' || sfx.resolve_status === 'PARTIAL_MATCH'
  const searchUrl = sfx.search_terms ? buildArtlistSfxUrl(sfx.search_terms) : (sfx.artlist_url ?? null)
  const borderColor = sfx.resolve_status === 'NO_MATCH' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)'

  return (
    <div
      className="rounded-md px-2.5 py-1.5"
      style={{ border: `1px solid ${borderColor}`, background: 'rgba(255,255,255,0.02)' }}
    >
      <div className="flex gap-2 items-start">
        <span className="font-mono text-[10px] flex-shrink-0 mt-0.5" style={{ color: '#818cf8' }}>
          {sfx.timestamp}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {categoryColor && sfx.sfx_category && (
              <span
                className="text-[8px] font-bold uppercase px-1.5 py-px rounded"
                style={{ background: categoryColor.bg, color: categoryColor.color }}
              >
                {sfx.sfx_category}
              </span>
            )}
            <span className="text-[11px]" style={{ color: 'var(--gem-muted)' }}>
              {sfx.description}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {hasFile && (
              <span className="text-[9px] font-semibold" style={{ color: 'var(--gem-text)' }}>
                {sfx.original_filename}
              </span>
            )}
            {resolveStatus && (
              <span
                className="text-[9px] px-1.5 py-px rounded font-semibold"
                style={{ background: resolveStatus.bg, color: resolveStatus.color }}
              >
                {resolveStatus.label}
              </span>
            )}
            {sfx.score != null && sfx.score_max != null && (
              <ScoreBar score={sfx.score} max={sfx.score_max} />
            )}
            {showSearch && searchUrl && (
              <a
                href={searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] font-medium transition-colors hover:underline"
                style={{ color: '#fbbf24' }}
              >
                ↗ Buscar SFX
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
