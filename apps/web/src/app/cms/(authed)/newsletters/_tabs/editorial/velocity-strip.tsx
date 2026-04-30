'use client'

import { HealthStrip } from '../../_shared/health-strip'
import type { EditorialTabData } from '../../_hub/hub-types'

interface VelocityStripProps {
  velocity: EditorialTabData['velocity']
}

export function VelocityStrip({ velocity }: VelocityStripProps) {
  return (
    <HealthStrip
      metrics={[
        { label: 'Throughput', value: `${velocity.throughput}/mo` },
        { label: 'Avg Idea→Sent', value: velocity.avgIdeaToSent > 0 ? `${velocity.avgIdeaToSent}d` : '—' },
        { label: 'Moved This Week', value: velocity.movedThisWeek },
        { label: 'Bottleneck', value: velocity.bottleneck?.column ?? 'None', color: velocity.bottleneck ? '#f59e0b' : '#22c55e' },
      ]}
    />
  )
}
