import type { PostStatus, DeliveryStatus } from '@tn-figueiredo/social'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-500/15 text-yellow-400',
  scheduled: 'bg-blue-500/15 text-blue-400',
  publishing: 'bg-blue-500/15 text-blue-400 animate-pulse',
  completed: 'bg-green-500/15 text-green-400',
  published: 'bg-green-500/15 text-green-400',
  partial_failure: 'bg-orange-500/15 text-orange-400',
  failed: 'bg-red-500/15 text-red-400',
  cancelled: 'bg-gray-500/15 text-gray-400',
  pending: 'bg-gray-500/15 text-gray-400',
  retrying: 'bg-orange-500/15 text-orange-400 animate-pulse',
  skipped: 'bg-gray-500/15 text-gray-400',
  queued: 'bg-purple-500/15 text-purple-400',
}

interface SocialStatusBadgeProps {
  status: PostStatus | DeliveryStatus | 'queued'
  label: string
  className?: string
}

export function SocialStatusBadge({ status, label, className = '' }: SocialStatusBadgeProps) {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.draft
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors} ${className}`}
    >
      {label}
    </span>
  )
}
