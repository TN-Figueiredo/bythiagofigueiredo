import type { SceneMusic } from './types'
import { RESOLVE_COLORS } from './types'

interface MusicContinuationCardProps {
  music: SceneMusic
}

export function MusicContinuationCard({ music }: MusicContinuationCardProps) {
  const status = music.resolve_status ? RESOLVE_COLORS[music.resolve_status] : null

  return (
    <div
      className="rounded-md overflow-hidden mb-1.5"
      style={{ border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #5a6b7f', background: 'rgba(255,255,255,0.015)', padding: '10px 12px' }}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[10px]" style={{ color: '#5a6b7f' }} aria-hidden="true">↩</span>
        <span className="text-[12px] font-semibold" style={{ color: 'var(--gem-text)' }}>{music.track || 'Track anterior'}</span>
        {music.artist && <span className="text-[10px]" style={{ color: '#5a6b7f' }}>— {music.artist}</span>}
        {status && (
          <span className="text-[9px] px-1.5 py-px rounded font-semibold ml-auto" style={{ background: status.bg, color: status.color }}>
            {status.label}
          </span>
        )}
      </div>
      {music.recommendations[0] && !music.recommendations[0].is_empty_slot && (
        <div className="text-[9px] mt-1" style={{ paddingLeft: 18, color: '#5a6b7f' }}>
          {music.recommendations[0].track}
        </div>
      )}
    </div>
  )
}
