'use client'

import { UpNextCelebration, type CelebrationItem } from './up-next-celebration'
import { UpNextModeCards, type ModeCardItem } from './up-next-mode-cards'
import { UpNextPlaylistStrips, type PlaylistStrip } from './up-next-playlist-strips'
import { UpNextSuggestion } from './up-next-suggestion'
import { UpNextActivity, type ActivityEntry } from './up-next-activity'
import { PipelineSearchDropdown } from './pipeline-search-dropdown'

interface PipelineOverviewProps {
  celebration: { items: CelebrationItem[] }
  modes: { escrever: ModeCardItem | null; gravar: ModeCardItem | null; posProducao: ModeCardItem | null }
  playlists: PlaylistStrip[]
  suggestion: { text: string; linkHref: string | null; linkLabel: string | null }
  activity: ActivityEntry[]
}

export function PipelineOverview({ celebration, modes, playlists, suggestion, activity }: PipelineOverviewProps) {
  return (
    <div className="space-y-6">
      <div className="max-w-sm ml-auto">
        <PipelineSearchDropdown />
      </div>

      <UpNextCelebration items={celebration.items} />

      <UpNextModeCards escrever={modes.escrever} gravar={modes.gravar} posProducao={modes.posProducao} />

      <UpNextPlaylistStrips playlists={playlists} />

      <UpNextSuggestion text={suggestion.text} linkHref={suggestion.linkHref} linkLabel={suggestion.linkLabel} />

      <UpNextActivity entries={activity} />
    </div>
  )
}
