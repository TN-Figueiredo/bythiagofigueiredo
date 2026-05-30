'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { SocialDelivery } from '@tn-figueiredo/social'
import type { SocialPostWithPipeline } from '@/lib/social/actions'
import { duplicatePost } from '@/lib/social/actions'
import { socialToast } from './shared/social-toast'

interface DrawerContentProps {
  post: SocialPostWithPipeline & { deliveries: SocialDelivery[] }
  siteId: string
}

const STATUS_LABELS: Record<string, string> = {
  completed: 'Publicado',
  scheduled: 'Agendado',
  failed: 'Falhou',
  draft: 'Rascunho',
  publishing: 'Publicando',
  cancelled: 'Cancelado',
  partial_failure: 'Parcial',
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500/20 text-green-400',
  scheduled: 'bg-blue-500/20 text-blue-400',
  failed: 'bg-red-500/20 text-red-400',
  draft: 'bg-yellow-500/20 text-yellow-400',
  publishing: 'bg-blue-500/20 text-blue-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
  partial_failure: 'bg-orange-500/20 text-orange-400',
}

export function DrawerContent({ post, siteId: _siteId }: DrawerContentProps) {
  const router = useRouter()
  const title = post.content.title ?? post.content.description ?? '(sem titulo)'
  const imageUrl = post.content.media_urls?.[0] ?? null

  const publishedDeliveries = post.deliveries.filter(d => d.status === 'published')
  const failedDeliveries = post.deliveries.filter(d => d.status === 'failed')

  async function handleDuplicate() {
    const result = await duplicatePost(post.id)
    if (result.ok) {
      socialToast('post_duplicated')
      router.back()
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-cms-border p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="drawer-title" className="truncate text-lg font-semibold text-cms-text">{title}</h2>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[post.status] ?? 'bg-gray-500/20 text-gray-400'}`}>
            {STATUS_LABELS[post.status] ?? post.status}
          </span>
        </div>
        {post.scheduled_at && (
          <p className="mt-1 text-xs text-cms-text-muted">
            {new Date(post.scheduled_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
        {post.published_at && !post.scheduled_at && (
          <p className="mt-1 text-xs text-cms-text-muted">
            Publicado em {new Date(post.published_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>

      {/* Preview */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {imageUrl && (
          <div className="overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="w-full object-cover" />
          </div>
        )}

        {post.content.description && (
          <p className="text-sm text-cms-text-muted line-clamp-4">
            {post.content.description}
          </p>
        )}

        {post.content.hashtags && post.content.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.content.hashtags.map(tag => (
              <span key={tag} className="rounded-full bg-cms-accent/10 px-2 py-0.5 text-xs text-cms-accent">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Delivery summary */}
        {post.deliveries.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-cms-text-muted">
              Entregas
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-cms-surface p-3 text-center">
                <p className="text-lg font-semibold text-cms-text">{post.deliveries.length}</p>
                <p className="text-xs text-cms-text-muted">Total</p>
              </div>
              <div className="rounded-lg bg-cms-surface p-3 text-center">
                <p className="text-lg font-semibold text-green-400">{publishedDeliveries.length}</p>
                <p className="text-xs text-cms-text-muted">Publicadas</p>
              </div>
              <div className="rounded-lg bg-cms-surface p-3 text-center">
                <p className="text-lg font-semibold text-red-400">{failedDeliveries.length}</p>
                <p className="text-xs text-cms-text-muted">Falharam</p>
              </div>
            </div>
          </div>
        )}

        {/* Metrics placeholder — when no deliveries */}
        {post.deliveries.length === 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-cms-surface p-3 text-center">
              <p className="text-lg font-semibold text-cms-text">--</p>
              <p className="text-xs text-cms-text-muted">Cliques</p>
            </div>
            <div className="rounded-lg bg-cms-surface p-3 text-center">
              <p className="text-lg font-semibold text-cms-text">--</p>
              <p className="text-xs text-cms-text-muted">Curtidas</p>
            </div>
            <div className="rounded-lg bg-cms-surface p-3 text-center">
              <p className="text-lg font-semibold text-cms-text">--</p>
              <p className="text-xs text-cms-text-muted">Comentarios</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t border-cms-border p-4 flex gap-2">
        {post.status === 'completed' && (
          <button
            onClick={handleDuplicate}
            className="flex-1 rounded-lg border border-cms-border px-3 py-2 text-sm font-medium text-cms-text hover:bg-cms-surface transition-colors"
          >
            Duplicar
          </button>
        )}
        {post.status === 'scheduled' && (
          <>
            <button
              onClick={handleDuplicate}
              className="flex-1 rounded-lg border border-cms-border px-3 py-2 text-sm font-medium text-cms-text hover:bg-cms-surface transition-colors"
            >
              Duplicar
            </button>
            <Link
              href={`/cms/social/${post.id}`}
              className="flex-1 rounded-lg bg-amber-500/20 px-3 py-2 text-center text-sm font-medium text-amber-400 hover:bg-amber-500/30 transition-colors"
            >
              Editar
            </Link>
          </>
        )}
        {post.status === 'failed' && (
          <Link
            href={`/cms/social/${post.id}`}
            className="flex-1 rounded-lg bg-red-500/20 px-3 py-2 text-center text-sm font-medium text-red-400 hover:bg-red-500/30 transition-colors"
          >
            Ver erro
          </Link>
        )}
        <Link
          href={`/cms/social/${post.id}`}
          className="flex-1 rounded-lg bg-cms-accent px-3 py-2 text-center text-sm font-medium text-white hover:bg-cms-accent-hover transition-colors"
        >
          Detalhes
        </Link>
      </div>
    </div>
  )
}
