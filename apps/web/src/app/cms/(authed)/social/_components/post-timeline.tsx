import type { SocialPost, SocialDelivery } from '@tn-figueiredo/social'
import type { SocialStrings } from '../_i18n/types'

interface PostTimelineProps {
  post: SocialPost
  deliveries: SocialDelivery[]
  strings: SocialStrings
}

interface TimelineEvent {
  time: string
  label: string
  color: string
}

export function PostTimeline({ post, deliveries, strings: t }: PostTimelineProps) {
  const events: TimelineEvent[] = [
    { time: post.created_at, label: t.detail.created, color: 'bg-gray-400' },
  ]

  if (post.scheduled_at) {
    events.push({ time: post.scheduled_at, label: t.detail.scheduledEvent, color: 'bg-blue-400' })
  }

  for (const d of deliveries) {
    if (d.published_at) {
      events.push({ time: d.published_at, label: t.detail.publishedOn.replace('{provider}', d.provider), color: 'bg-green-400' })
    }
    if (d.status === 'failed' && d.last_error) {
      events.push({ time: d.created_at, label: `${t.detail.failedOn.replace('{provider}', d.provider)}: ${d.last_error}`, color: 'bg-red-400' })
    }
  }

  events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

  return (
    <div className="space-y-0">
      <h3 className="text-sm font-semibold text-cms-text mb-3">{t.detail.timeline}</h3>
      {events.map((event, i) => (
        <div key={i} className="flex gap-3 pb-4">
          <div className="flex flex-col items-center">
            <div className={`h-2.5 w-2.5 rounded-full ${event.color}`} />
            {i < events.length - 1 && <div className="w-px flex-1 bg-cms-border" />}
          </div>
          <div className="-mt-0.5">
            <p className="text-sm text-cms-text">{event.label}</p>
            <p className="text-xs text-cms-text-dim">{new Date(event.time).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
