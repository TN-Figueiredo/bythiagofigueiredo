'use client'

import type { SceneMusic } from './types'
import { FillIndicator } from './fill-indicator'
import { MusicHeroCard } from './music-hero-card'
import { MusicAlternativeSlot } from './music-alternative-slot'
import { MusicContinuationCard } from './music-continuation-card'

interface MusicHeroSectionProps {
  music: SceneMusic
  sceneIndex: number
  itemCode?: string
}

function getFillStatus(music: SceneMusic): 'green' | 'amber' | 'red' | 'dim' {
  if (music.continuation) {
    if (music.resolve_status === 'LOCAL') return 'green'
    if (music.fill_count > 0) return 'amber'
    return 'dim'
  }
  if (music.fill_count === 0) return 'red'
  if (music.fill_count === 3 && music.recommendations.every(r => r.resolve_status === 'LOCAL')) return 'green'
  return 'amber'
}

export function MusicHeroSection({ music, sceneIndex, itemCode }: MusicHeroSectionProps) {
  const isContinuation = !!music.continuation
  const fillStatus = getFillStatus(music)
  const safeFavIndex = Math.min(music.favorite_index ?? 0, 2)
  const favorite = music.recommendations[safeFavIndex]

  return (
    <div
      className="rounded-lg mb-3"
      style={{
        border: '1px solid rgba(167,139,250,0.12)',
        borderRadius: 8,
        background: 'linear-gradient(135deg, rgba(167,139,250,0.03), rgba(99,102,241,0.02))',
        padding: 10,
      }}
      role="region"
      aria-label={`Recomendações de música para cena ${sceneIndex}`}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-[13px]" aria-hidden="true">♪</span>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#a78bfa' }}>Música</span>
        {music.entry_cue && !isContinuation && (
          <span className="text-[10px] font-medium px-1.5 py-px rounded" style={{ background: 'rgba(129,140,248,0.1)', color: '#818cf8' }}>
            Entrada: {music.entry_cue}
          </span>
        )}
        {isContinuation && (
          <span className="text-[10px] px-1.5 py-px rounded" style={{ background: 'rgba(255,255,255,0.04)', color: '#5a6b7f' }}>
            ↩ Continua da {music.continuation}
          </span>
        )}
        <span className="ml-auto">
          <FillIndicator filled={music.fill_count} total={music.recommendations.length} status={fillStatus} />
        </span>
      </div>

      {music.style && !isContinuation && (
        <div className="text-[10px] mb-2.5" style={{ color: '#5a6b7f', paddingLeft: 21 }}>
          {music.search_terms && <span>{music.search_terms} · </span>}
          {music.style}
        </div>
      )}

      {isContinuation ? (
        <>
          <MusicContinuationCard music={music} />
          {music.recommendations[1] && (
            <MusicAlternativeSlot
              recommendation={music.recommendations[1]}
              slotIndex={2}
              searchTier={music.recommendations[1].artlist_search_tier}
              searchUrl={music.search_tiers.medium}
              searchTerms={music.search_terms}
            />
          )}
          {music.recommendations[2] && (
            <MusicAlternativeSlot
              recommendation={music.recommendations[2]}
              slotIndex={3}
              searchTier={music.recommendations[2].artlist_search_tier}
              searchUrl={music.search_tiers.broad}
              searchTerms={music.search_terms}
            />
          )}
        </>
      ) : (
        <>
          {favorite && !favorite.is_empty_slot ? (
            <MusicHeroCard recommendation={favorite} music={music} itemCode={itemCode} />
          ) : favorite ? (
            <MusicAlternativeSlot
              recommendation={favorite}
              slotIndex={1}
              searchTier="narrow"
              searchUrl={music.search_tiers.narrow}
              searchTerms={music.search_terms}
            />
          ) : null}
          {music.recommendations.filter((_, i) => i !== safeFavIndex).map((rec, i) => (
            <MusicAlternativeSlot
              key={rec.track || rec.artlist_search_tier}
              recommendation={rec}
              slotIndex={(i + 2) as 1 | 2 | 3}
              searchTier={rec.artlist_search_tier}
              searchUrl={rec.artlist_search_url}
              searchTerms={music.search_terms}
            />
          ))}
        </>
      )}

      {(music.fill_count < 3 || music.recommendations.some(r => r.resolve_status === 'PENDING_MATCH')) && (
        <div className="flex items-center justify-center mt-2 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          <span className="text-[10px]" style={{ color: '#4b5563' }}>
            ↻ Re-resolver após importar novas tracks
          </span>
        </div>
      )}
    </div>
  )
}
