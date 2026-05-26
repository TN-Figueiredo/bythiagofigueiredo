'use client'

import { UpNextCelebration, type CelebrationItem } from './up-next-celebration'
import { UpNextModeCards, type ModeCardItem } from './up-next-mode-cards'
import { UpNextPlaylistStrips, type PlaylistStrip } from './up-next-playlist-strips'
import { UpNextSuggestion } from './up-next-suggestion'
import { UpNextActivity, type ActivityEntry } from './up-next-activity'
import { UpNextThisWeek, type WeekDay } from './up-next-this-week'
import { PipelineSearchDropdown } from './pipeline-search-dropdown'

interface PipelineOverviewProps {
  celebration: { items: CelebrationItem[] }
  modes: { escrever: ModeCardItem[]; gravar: ModeCardItem[]; posProducao: ModeCardItem[] }
  playlists: PlaylistStrip[]
  suggestion: { text: string; linkHref: string | null; linkLabel: string | null }
  activity: ActivityEntry[]
  thisWeek: { days: WeekDay[]; nextSlotIn: number | null }
}

export function PipelineOverview({ celebration, modes, playlists, suggestion, activity, thisWeek }: PipelineOverviewProps) {
  return (
    <div className="space-y-6">
      <div className="max-w-sm ml-auto">
        <PipelineSearchDropdown />
      </div>

      <UpNextCelebration items={celebration.items} />

      <UpNextModeCards escrever={modes.escrever} gravar={modes.gravar} posProducao={modes.posProducao} />

      <UpNextThisWeek days={thisWeek.days} nextSlotIn={thisWeek.nextSlotIn} />

      <UpNextPlaylistStrips playlists={playlists} />

      <UpNextSuggestion text={suggestion.text} linkHref={suggestion.linkHref} linkLabel={suggestion.linkLabel} />

      <UpNextActivity entries={activity} />
    </div>
  )
}
