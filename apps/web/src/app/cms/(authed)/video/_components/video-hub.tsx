'use client'

import { useState } from 'react'
import { HubHeader } from './hub-header'
import { StatRow } from './stat-row'
import { PillarRail } from './pillar-rail'
import { VideoKanban } from './video-kanban'
import type { VideoHubData } from '@/lib/pipeline/load-video-hub'
import type { PillarId } from '@/lib/pipeline/pillars'

export function VideoHub({ data }: { data: VideoHubData }) {
  const [activePillar, setActivePillar] = useState<PillarId | null>(null)
  return (
    <div className="video-hub">
      <HubHeader />
      <StatRow stats={data.stats} />
      <PillarRail
        total={data.stats.total}
        pillarCounts={data.pillarCounts}
        active={activePillar}
        onChange={setActivePillar}
      />
      <VideoKanban cards={data.cards} activePillar={activePillar} />
    </div>
  )
}
