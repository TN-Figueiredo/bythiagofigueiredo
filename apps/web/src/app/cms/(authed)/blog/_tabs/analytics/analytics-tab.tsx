'use client'

import { TrendingUp } from 'lucide-react'
import { EmptyState } from '../../_shared/empty-state'
import type { BlogHubStrings } from '../../_i18n/types'

interface AnalyticsTabProps {
  strings?: BlogHubStrings
}

export function AnalyticsTab({ strings }: AnalyticsTabProps) {
  return (
    <EmptyState
      icon={<TrendingUp className="h-10 w-10 text-gray-600" />}
      heading={strings?.analytics.comingSoon ?? 'Analytics Coming Soon'}
      description={strings?.analytics.comingSoonDescription ?? 'Blog analytics with view tracking, engagement metrics, and referral sources will be available in a future update.'}
    />
  )
}
