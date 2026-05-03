'use client'

import { HealthStrip } from '../../_shared/health-strip'
import type { EditorialTabData } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'

interface VelocityStripProps {
  velocity: EditorialTabData['velocity']
  strings?: BlogHubStrings
}

export function VelocityStrip({ velocity, strings }: VelocityStripProps) {
  const s = strings?.editorial
  const sd = strings?.schedule
  return (
    <HealthStrip
      metrics={[
        {
          label: s?.throughput ?? 'Throughput',
          value: `${velocity.throughput}/mo`,
        },
        {
          label: s?.avgTime ?? 'Avg Idea→Pub',
          value:
            velocity.avgIdeaToPublished > 0
              ? `${velocity.avgIdeaToPublished} ${sd?.daysUnit ?? 'd'}`
              : '—',
        },
        {
          label: s?.movedForward ?? 'Moved This Week',
          value: velocity.movedThisWeek,
        },
        {
          label: s?.bottleneck ?? 'Bottleneck',
          value: velocity.bottleneck?.column ?? (s?.none ?? 'None'),
          color: velocity.bottleneck ? '#f59e0b' : '#22c55e',
        },
      ]}
    />
  )
}
