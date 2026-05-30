import { listSocialPosts } from '@/lib/social/actions'
import { getPostTitle } from './shared/social-helpers'
import { DraftsList } from './drafts-list'

export async function DraftsViewLoader({ siteId }: { siteId: string }) {
  const result = await listSocialPosts(siteId)
  if (!result.ok) return <p className="text-sm text-cms-text-muted">Erro ao carregar rascunhos</p>

  const drafts = result.data
    .filter(p => p.status === 'draft' && p.origin === 'auto')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  if (drafts.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-cms-text-muted">Nenhum rascunho automatico</p>
        <p className="text-xs text-cms-text-dim">
          Configure automacoes em Contas para gerar rascunhos automaticos
        </p>
      </div>
    )
  }

  const items = drafts.map(post => {
    const pipeline = (post.pipeline_snapshot ?? {}) as Record<string, unknown>
    const confidence = typeof pipeline.confidence === 'number' ? pipeline.confidence : null
    return {
      id: post.id,
      title: getPostTitle(post.content),
      description: post.content.description ?? '',
      confidence,
      trigger: String(pipeline.trigger ?? 'auto'),
      createdAt: post.created_at,
    }
  })

  return <DraftsList items={items} />
}
