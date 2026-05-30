import { formatRelativeTime } from '@tn-figueiredo/cms-ui/client'
import type { ActivityFeedItem } from './dashboard-queries'

interface DashboardActivityFeedProps {
  items: ActivityFeedItem[]
}

const ACTION_LABELS: Record<string, string> = {
  create: 'criou',
  created: 'criou',
  update: 'atualizou',
  updated: 'atualizou',
  publish: 'publicou',
  published: 'publicou',
  delete: 'excluiu',
  deleted: 'excluiu',
  archive: 'arquivou',
  archived: 'arquivou',
  schedule: 'agendou',
  scheduled: 'agendou',
  send: 'enviou',
  sent: 'enviou',
  subscribe: 'inscreveu',
  unsubscribe: 'desinscreveu',
}

const RESOURCE_DOT_COLORS: Record<string, string> = {
  blog_post: 'bg-[var(--color-blog)]',
  newsletter_edition: 'bg-[var(--color-newsletter)]',
  campaign: 'bg-[var(--color-newsletter)]',
  content_pipeline: 'bg-[var(--color-video)]',
  link: 'bg-[var(--color-link)]',
  media: 'bg-[var(--acc)]',
  subscriber: 'bg-[var(--color-newsletter)]',
  setting: 'bg-[var(--t4)]',
}

const RESOURCE_LABELS: Record<string, string> = {
  blog_post: 'post',
  newsletter_edition: 'newsletter',
  campaign: 'campanha',
  content_pipeline: 'pipeline',
  link: 'link',
  media: 'mídia',
  subscriber: 'assinante',
  setting: 'configuração',
}

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

function getResourceDotColor(resourceType: string): string {
  return RESOURCE_DOT_COLORS[resourceType] ?? 'bg-[var(--t5)]'
}

function getResourceLabel(resourceType: string): string {
  return RESOURCE_LABELS[resourceType] ?? resourceType
}

export function DashboardActivityFeed({ items }: DashboardActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div data-testid="activity-feed">
        <h2 className="mb-4 text-sm font-semibold text-[var(--t2)]">Notificações recentes</h2>
        <p className="text-sm text-[var(--t5)]" data-testid="activity-feed-empty">
          Nenhuma atividade recente
        </p>
      </div>
    )
  }

  return (
    <div data-testid="activity-feed">
      <h2 className="mb-4 text-sm font-semibold text-[var(--t2)]">Atividade</h2>
      <ul className="space-y-3" data-testid="activity-feed-list">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${getResourceDotColor(item.resourceType)}`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[var(--t2)]">
                <span className="font-medium text-[var(--t2)]">
                  {getActionLabel(item.action)}
                </span>{' '}
                <span className="text-[var(--t3)]">
                  {getResourceLabel(item.resourceType)}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-[var(--t5)]">
                {formatRelativeTime(item.createdAt)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
