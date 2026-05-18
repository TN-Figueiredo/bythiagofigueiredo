'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { SocialPost, SocialDelivery } from '@tn-figueiredo/social'
import { useSocialDeliveries, useSocialPostStatus } from '@/lib/social/realtime'
import { SocialStatusBadge } from '@/app/cms/(authed)/_shared/social/social-status-badge'
import { DeliveryCard } from './delivery-card'
import { PostTimeline } from './post-timeline'
import type { SocialStrings } from '../_i18n/types'

interface PostDetailProps {
  post: SocialPost & { deliveries: SocialDelivery[] } & {
    origin?: string | null
    source_content_type?: string | null
    source_content_id?: string | null
    short_link_id?: string | null
  }
  strings: SocialStrings
  onCancel: (id: string) => Promise<{ ok: boolean; error?: string }>
  onDelete: (id: string) => Promise<{ ok: boolean; error?: string }>
  onUpdate: (id: string, data: { content?: Record<string, unknown> }) => Promise<{ ok: boolean; error?: string }>
  onRetryDelivery: (deliveryId: string) => Promise<{ ok: boolean; error?: string }>
}

const ORIGIN_LABELS: Record<string, string> = {
  manual: 'Manual',
  auto: 'Automático',
  publish_modal: 'Modal de Publicação',
  pipeline: 'Pipeline',
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  blog: 'Blog Post',
  newsletter: 'Newsletter',
  campaign: 'Campanha',
  video: 'Vídeo',
}

function getContentLink(type: string, id: string): string {
  switch (type) {
    case 'blog': return `/cms/blog/${id}`
    case 'newsletter': return `/cms/newsletters/${id}`
    case 'campaign': return `/cms/campaigns/${id}`
    default: return '#'
  }
}

type EditField = 'description' | 'hashtags'

export function PostDetail({ post, strings: t, onCancel, onDelete, onUpdate, onRetryDelivery }: PostDetailProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const liveDeliveries = useSocialDeliveries(post.id)
  const liveStatus = useSocialPostStatus(post.id)

  const deliveries = liveDeliveries.length > 0 ? liveDeliveries : post.deliveries
  const status = liveStatus ?? post.status
  const statusLabel = t.status[status as keyof typeof t.status] ?? status

  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState<EditField | null>(null)
  const [editDescription, setEditDescription] = useState(post.content.description ?? '')
  const [editHashtags, setEditHashtags] = useState((post.content.hashtags ?? []).join(', '))

  const canEdit = status === 'draft' || status === 'scheduled'
  const canEditPublished = status === 'completed' || status === 'partial_failure'
  const canCancel = status === 'draft' || status === 'scheduled'
  const canDelete = status === 'draft' || status === 'cancelled' || status === 'failed'

  function handleCancel() {
    setActionError(null)
    startTransition(async () => {
      const result = await onCancel(post.id)
      if (!result.ok) setActionError(result.error ?? t.common.error)
      else router.refresh()
    })
  }

  function handleDelete() {
    setActionError(null)
    startTransition(async () => {
      const result = await onDelete(post.id)
      if (!result.ok) setActionError(result.error ?? t.common.error)
      else router.push('/cms/social')
    })
  }

  function handleSaveField(field: EditField) {
    setActionError(null)
    startTransition(async () => {
      const updatedContent = { ...post.content }
      if (field === 'description') {
        updatedContent.description = editDescription
      } else if (field === 'hashtags') {
        updatedContent.hashtags = editHashtags
          .split(',')
          .map((h) => h.trim().replace(/^#/, ''))
          .filter(Boolean)
      }
      const result = await onUpdate(post.id, { content: updatedContent })
      if (!result.ok) {
        setActionError(result.error ?? t.common.error)
      } else {
        setEditing(null)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/cms/social" className="text-sm text-cms-accent hover:underline">{t.detail.back}</Link>
        <div className="flex items-center gap-3">
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(editing ? null : 'description')}
              className="rounded-md border border-cms-border px-3 py-1.5 text-sm text-cms-text hover:bg-cms-surface"
            >
              {editing ? 'Fechar edição' : t.detail.edit}
            </button>
          )}
          {canEditPublished && (
            <Link
              href={`/cms/social/new?post=${post.id}`}
              className="rounded-md border border-cms-accent/30 px-3 py-1.5 text-sm text-cms-accent hover:bg-cms-accent/10"
            >
              Editar publicado
            </Link>
          )}
          {canCancel && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="rounded-md border border-amber-500/30 px-3 py-1.5 text-sm text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
            >
              Cancelar post
            </button>
          )}
          {canDelete && !confirmDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-md border border-red-500/30 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
            >
              {t.detail.delete}
            </button>
          )}
          {confirmDelete && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400">{t.detail.deleteConfirm}</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-sm text-cms-text-muted hover:text-cms-text"
              >
                Não
              </button>
            </div>
          )}
          <SocialStatusBadge status={status} label={statusLabel} />
        </div>
      </div>

      {actionError && (
        <p role="alert" className="text-sm text-red-400">{actionError}</p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-4">
          {post.content.title && <h2 className="text-xl font-semibold text-cms-text">{post.content.title}</h2>}

          {editing === 'description' ? (
            <div className="space-y-2">
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveField('description')}
                  disabled={isPending}
                  className="rounded-md bg-cms-accent px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  Salvar
                </button>
                <button type="button" onClick={() => setEditing(null)} className="text-sm text-cms-text-muted">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            post.content.description && (
              <p
                className={`text-sm text-cms-text-muted ${canEdit ? 'cursor-pointer hover:text-cms-text' : ''}`}
                onClick={() => canEdit && setEditing('description')}
              >
                {post.content.description}
              </p>
            )
          )}

          {post.content.url && (
            <a href={post.content.url} target="_blank" rel="noopener noreferrer" className="text-sm text-cms-accent hover:underline block">
              {post.content.url}
            </a>
          )}

          {editing === 'hashtags' ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editHashtags}
                onChange={(e) => setEditHashtags(e.target.value)}
                placeholder="tag1, tag2, tag3"
                className="w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveField('hashtags')}
                  disabled={isPending}
                  className="rounded-md bg-cms-accent px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  Salvar
                </button>
                <button type="button" onClick={() => setEditing(null)} className="text-sm text-cms-text-muted">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            post.content.hashtags && post.content.hashtags.length > 0 && (
              <div
                className={`flex flex-wrap gap-1 ${canEdit ? 'cursor-pointer' : ''}`}
                onClick={() => canEdit && setEditing('hashtags')}
              >
                {post.content.hashtags.map(tag => (
                  <span key={tag} className="rounded-full bg-cms-accent/10 px-2 py-0.5 text-xs text-cms-accent">{tag}</span>
                ))}
              </div>
            )
          )}

          {/* Per-platform captions */}
          {(() => {
            const captions = (post.content as Record<string, unknown>).captions as Record<string, Record<string, string>> | undefined
            if (!captions || Object.keys(captions).length === 0) return null
            return (
            <div className="space-y-2 pt-2 border-t border-cms-border">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-cms-text-muted">Legendas por plataforma</h4>
              {Object.entries(captions).map(([platform, locales]) => (
                <div key={platform} className="rounded-md border border-cms-border bg-cms-bg p-3">
                  <span className="text-xs font-medium text-cms-accent uppercase">{platform}</span>
                  {Object.entries(locales).map(([locale, text]) => (
                    text && (
                      <p key={locale} className="mt-1 text-sm text-cms-text-muted">
                        <span className="text-xs text-cms-text-dim mr-1">[{locale.toUpperCase()}]</span>
                        {text}
                      </p>
                    )
                  ))}
                </div>
              ))}
            </div>
            )
          })()}

          <div className="pt-4">
            <PostTimeline post={post} deliveries={deliveries} strings={t} />
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {/* Post metadata */}
          <div className="rounded-lg border border-cms-border bg-cms-surface p-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-cms-text-muted">Detalhes</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-cms-text-muted">Tipo</span>
                <span className="text-cms-text">{post.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cms-text-muted">Origem</span>
                <span className="text-cms-text">{ORIGIN_LABELS[post.origin ?? 'manual'] ?? post.origin ?? 'manual'}</span>
              </div>
              {post.source_content_type && post.source_content_id && (
                <div className="flex justify-between">
                  <span className="text-cms-text-muted">Conteúdo</span>
                  <Link
                    href={getContentLink(post.source_content_type, post.source_content_id)}
                    className="text-cms-accent hover:underline"
                  >
                    {CONTENT_TYPE_LABELS[post.source_content_type] ?? post.source_content_type}
                  </Link>
                </div>
              )}
              {post.scheduled_at && (
                <div className="flex justify-between">
                  <span className="text-cms-text-muted">Agendado</span>
                  <span className="text-cms-text">{new Date(post.scheduled_at).toLocaleString('pt-BR')}</span>
                </div>
              )}
              {post.published_at && (
                <div className="flex justify-between">
                  <span className="text-cms-text-muted">Publicado</span>
                  <span className="text-cms-text">{new Date(post.published_at).toLocaleString('pt-BR')}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-cms-text-muted">Criado</span>
                <span className="text-cms-text">{new Date(post.created_at).toLocaleString('pt-BR')}</span>
              </div>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-cms-text">{t.detail.deliveryStatus}</h3>
          {deliveries.length === 0 && (
            <p className="text-sm text-cms-text-muted">Nenhuma entrega configurada</p>
          )}
          {deliveries.map(d => (
            <DeliveryCard key={d.id} delivery={d} strings={t} onRetry={onRetryDelivery} />
          ))}
        </div>
      </div>
    </div>
  )
}
