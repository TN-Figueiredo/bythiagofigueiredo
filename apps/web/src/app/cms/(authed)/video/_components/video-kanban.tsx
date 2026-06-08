import { VideoCard } from './video-card'
import type { VideoHubCard } from '@/lib/pipeline/load-video-hub'
import type { VideoColumn } from '@/lib/pipeline/video-lifecycle'
import type { PillarId } from '@/lib/pipeline/pillars'

interface ColumnDef {
  key: VideoColumn
  label: string
}

const COLUMNS: ColumnDef[] = [
  { key: 'idea', label: 'Ideia' },
  { key: 'roteiro', label: 'Roteiro' },
  { key: 'gravacao', label: 'Gravação' },
  { key: 'published', label: 'Publicado' },
]

export function VideoKanban({
  cards,
  activePillar,
}: {
  cards: VideoHubCard[]
  activePillar: PillarId | null
}) {
  const filtered = activePillar ? cards.filter((c) => c.pillar === activePillar) : cards
  return (
    <div className="vkanban">
      {COLUMNS.map((col) => {
        const colCards = filtered.filter((c) => c.column === col.key)
        return (
          <div key={col.key} className="vcol">
            <div className="vcol-head">
              <span>{col.label}</span>
              <span className="vcol-count">{colCards.length}</span>
            </div>
            <div className="vcol-body">
              {colCards.length === 0 ? (
                <div className="vcol-empty">Vazio</div>
              ) : (
                colCards.map((c) => <VideoCard key={c.id} card={c} />)
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
