'use client'

import { HealthStrip } from '../../_shared/health-strip'
import type { EditorialTabData } from '../../_hub/hub-types'
import type { NewsletterHubStrings } from '../../_i18n/types'

interface VelocityStripProps {
  velocity: EditorialTabData['velocity']
  strings?: NewsletterHubStrings
}

export function VelocityStrip({ velocity, strings }: VelocityStripProps) {
  const s = strings?.editorial
  return (
    <HealthStrip
      metrics={[
        { label: s?.throughput ?? 'Throughput', value: `${velocity.throughput}${strings?.common.perMonth ?? '/mo'}` },
        { label: s?.avgTime ?? 'Avg Idea→Sent', value: velocity.avgIdeaToSent > 0 ? `${velocity.avgIdeaToSent} ${strings?.schedule.daysUnit ?? 'd'}` : '—' },
        { label: s?.movedForward ?? 'Moved This Week', value: velocity.movedThisWeek },
        { label: s?.bottleneck ?? 'Bottleneck', value: velocity.bottleneck?.column ?? (s?.none ?? 'None'), color: velocity.bottleneck ? '#f59e0b' : '#22c55e' },
      ]}
    />
  )
}
