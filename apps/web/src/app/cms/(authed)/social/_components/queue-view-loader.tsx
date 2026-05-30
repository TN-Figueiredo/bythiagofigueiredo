import { listSocialPosts } from '@/lib/social/actions'
import type { SocialPostContent } from '@tn-figueiredo/social'
import { getPostTitle } from './shared/social-helpers'
import { QueueList } from './queue-list'

export async function QueueViewLoader({ siteId }: { siteId: string }) {
  const result = await listSocialPosts(siteId)
  if (!result.ok) return <p className="text-sm text-cms-text-muted">Erro ao carregar fila</p>

  const queuedPosts = result.data
    .filter(p => p.status === 'scheduled' || p.status === 'queued')
    .filter(p => p.queue_position != null)
    .sort((a, b) => (a.queue_position ?? 0) - (b.queue_position ?? 0))

  if (queuedPosts.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-cms-text-muted">Nenhum post na fila</p>
        <p className="text-xs text-cms-text-dim">Posts agendados com posicao aparecem aqui</p>
      </div>
    )
  }

  const items = queuedPosts.map(post => {
    return {
      id: post.id,
      title: getPostTitle(post.content as SocialPostContent),
      queuePosition: post.queue_position ?? 0,
      scheduledAt: post.scheduled_at,
      status: post.status,
    }
  })

  return <QueueList initialItems={items} />
}
