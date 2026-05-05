'use client'

import { useState, useTransition } from 'react'
import { createComment, updateComment, deleteComment, reorderComments } from './actions'

export interface CommentRow {
  id: string
  videoId: string
  videoTitle: string
  youtubeVideoId: string
  channelLocale: 'pt' | 'en'
  channelHandle: string
  authorHandle: string
  authorAvatarUrl: string | null
  textPt: string
  textEn: string
  likeCount: number
  targetLocale: 'pt' | 'en' | null
  displayOrder: number
  publishedAt: string | null
}

export interface VideoOption {
  id: string
  youtubeVideoId: string
  title: string
  channelLocale: 'pt' | 'en'
  channelHandle: string
}

interface CommentFormState {
  video_id: string
  author_handle: string
  author_avatar_url: string
  text_pt: string
  text_en: string
  like_count: number
  target_locale: 'pt' | 'en' | 'both'
  published_at: string
}

const DEFAULT_FORM: CommentFormState = {
  video_id: '',
  author_handle: '',
  author_avatar_url: '',
  text_pt: '',
  text_en: '',
  like_count: 0,
  target_locale: 'both',
  published_at: '',
}

function localeBadge(locale: 'pt' | 'en' | null) {
  if (locale === 'pt')
    return (
      <span className="inline-flex items-center rounded-full bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-400">
        PT only
      </span>
    )
  if (locale === 'en')
    return (
      <span className="inline-flex items-center rounded-full bg-blue-900/30 px-2 py-0.5 text-xs font-medium text-blue-400">
        EN only
      </span>
    )
  return (
    <span className="inline-flex items-center rounded-full bg-cms-surface-hover px-2 py-0.5 text-xs font-medium text-cms-text-dim">
      Both
    </span>
  )
}

function channelFlag(locale: 'pt' | 'en') {
  return locale === 'pt' ? '🇧🇷' : '🇺🇸'
}

interface CommentFormProps {
  initial?: CommentFormState
  videos: VideoOption[]
  onSave: (data: CommentFormState) => Promise<void>
  onCancel: () => void
  isPending: boolean
}

function CommentForm({ initial = DEFAULT_FORM, videos, onSave, onCancel, isPending }: CommentFormProps) {
  const [form, setForm] = useState<CommentFormState>(initial)

  function set<K extends keyof CommentFormState>(key: K, value: CommentFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const isValid =
    form.video_id !== '' &&
    form.author_handle.trim() !== '' &&
    form.text_pt.trim() !== '' &&
    form.text_en.trim() !== ''

  return (
    <div className="flex flex-col gap-4">
      {/* Video selector */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-cms-text-muted">Video *</label>
        <select
          value={form.video_id}
          onChange={(e) => set('video_id', e.target.value)}
          className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1.5 text-sm text-cms-text focus:outline-none focus:ring-2 focus:ring-cms-accent"
        >
          <option value="">Select a video…</option>
          {videos.map((v) => (
            <option key={v.id} value={v.id}>
              {channelFlag(v.channelLocale)} {v.title}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Author handle */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-cms-text-muted">Author Handle *</label>
          <input
            type="text"
            value={form.author_handle}
            onChange={(e) => set('author_handle', e.target.value)}
            placeholder="@username"
            className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1.5 text-sm text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent"
          />
        </div>

        {/* Author avatar URL */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-cms-text-muted">Author Avatar URL</label>
          <input
            type="url"
            value={form.author_avatar_url}
            onChange={(e) => set('author_avatar_url', e.target.value)}
            placeholder="https://…"
            className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1.5 text-sm text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent"
          />
        </div>
      </div>

      {/* Text PT */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-cms-text-muted">Comment Text (PT) *</label>
        <textarea
          value={form.text_pt}
          onChange={(e) => set('text_pt', e.target.value)}
          rows={3}
          placeholder="Texto do comentário em português…"
          className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1.5 text-sm text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent resize-none"
        />
      </div>

      {/* Text EN */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-cms-text-muted">Comment Text (EN) *</label>
        <textarea
          value={form.text_en}
          onChange={(e) => set('text_en', e.target.value)}
          rows={3}
          placeholder="Comment text in English…"
          className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1.5 text-sm text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Like count */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-cms-text-muted">Like Count</label>
          <input
            type="number"
            min={0}
            value={form.like_count}
            onChange={(e) => set('like_count', Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1.5 text-sm text-cms-text focus:outline-none focus:ring-2 focus:ring-cms-accent"
          />
        </div>

        {/* Published at */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-cms-text-muted">Published At</label>
          <input
            type="date"
            value={form.published_at}
            onChange={(e) => set('published_at', e.target.value)}
            className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1.5 text-sm text-cms-text focus:outline-none focus:ring-2 focus:ring-cms-accent"
          />
        </div>
      </div>

      {/* Target locale */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-cms-text-muted">Show on</label>
        <div className="flex items-center gap-4">
          {(['both', 'pt', 'en'] as const).map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-1.5 text-sm text-cms-text">
              <input
                type="radio"
                name="target_locale"
                value={opt}
                checked={form.target_locale === opt}
                onChange={() => set('target_locale', opt)}
                className="accent-[var(--cms-accent)]"
              />
              {opt === 'both' ? 'Both locales' : opt === 'pt' ? 'PT only' : 'EN only'}
            </label>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 border-t border-cms-border pt-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-4 py-1.5 text-sm text-cms-text hover:bg-cms-surface-hover disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isPending || !isValid}
          onClick={() => onSave(form)}
          className="rounded-[var(--cms-radius)] bg-cms-accent px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save Comment'}
        </button>
      </div>
    </div>
  )
}

interface Props {
  comments: CommentRow[]
  videos: VideoOption[]
}

export function CommentsConnected({ comments, videos }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function formFromRow(row: CommentRow): CommentFormState {
    return {
      video_id: row.videoId,
      author_handle: row.authorHandle,
      author_avatar_url: row.authorAvatarUrl ?? '',
      text_pt: row.textPt,
      text_en: row.textEn,
      like_count: row.likeCount,
      target_locale: row.targetLocale ?? 'both',
      published_at: row.publishedAt ? row.publishedAt.slice(0, 10) : '',
    }
  }

  function toPayload(form: CommentFormState) {
    return {
      video_id: form.video_id,
      author_handle: form.author_handle.trim(),
      author_avatar_url: form.author_avatar_url.trim() || null,
      text_pt: form.text_pt.trim(),
      text_en: form.text_en.trim(),
      like_count: form.like_count,
      target_locale: form.target_locale === 'both' ? null : (form.target_locale as 'pt' | 'en'),
      published_at: form.published_at || null,
    }
  }

  async function handleCreate(form: CommentFormState) {
    setError(null)
    startTransition(async () => {
      const res = await createComment(toPayload(form))
      if (!res.ok) {
        setError(res.error)
        return
      }
      setShowForm(false)
    })
  }

  async function handleUpdate(id: string, form: CommentFormState) {
    setError(null)
    startTransition(async () => {
      const res = await updateComment(id, toPayload(form))
      if (!res.ok) {
        setError(res.error)
        return
      }
      setEditingId(null)
    })
  }

  async function handleDelete(id: string, handle: string) {
    if (!confirm(`Delete comment by "${handle}"? This cannot be undone.`)) return
    setError(null)
    startTransition(async () => {
      const res = await deleteComment(id)
      if (!res.ok) setError(res.error)
    })
  }

  async function handleMove(index: number, direction: 'up' | 'down') {
    const newOrder = [...comments]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newOrder.length) return
    const temp = newOrder[index]!
    newOrder[index] = newOrder[swapIndex]!
    newOrder[swapIndex] = temp
    setError(null)
    startTransition(async () => {
      const res = await reorderComments(newOrder.map((c) => c.id))
      if (!res.ok) setError('Reorder failed')
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-cms-text">Curated Comments</h1>
          <p className="mt-0.5 text-sm text-cms-text-muted">
            {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => {
              setShowForm(true)
              setEditingId(null)
              setError(null)
            }}
            className="inline-flex items-center gap-2 rounded-[var(--cms-radius)] bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Comment
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-[var(--cms-radius)] border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4">
          <h2 className="mb-4 text-sm font-semibold text-cms-text">New Comment</h2>
          <CommentForm
            videos={videos}
            onSave={handleCreate}
            onCancel={() => {
              setShowForm(false)
              setError(null)
            }}
            isPending={isPending}
          />
        </div>
      )}

      {/* Comment list */}
      {comments.length === 0 && !showForm ? (
        <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-6 py-16 text-center">
          <p className="text-sm text-cms-text-muted">
            No curated comments yet. Add one to highlight great audience feedback.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {comments.map((comment, index) => (
            <div key={comment.id} className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface">
              {editingId === comment.id ? (
                <div className="p-4">
                  <h2 className="mb-4 text-sm font-semibold text-cms-text">Edit Comment</h2>
                  <CommentForm
                    initial={formFromRow(comment)}
                    videos={videos}
                    onSave={(form) => handleUpdate(comment.id, form)}
                    onCancel={() => {
                      setEditingId(null)
                      setError(null)
                    }}
                    isPending={isPending}
                  />
                </div>
              ) : (
                <div className="flex items-start gap-3 px-4 py-3">
                  {/* Reorder buttons */}
                  <div className="flex shrink-0 flex-col gap-0.5 pt-0.5">
                    <button
                      type="button"
                      disabled={isPending || index === 0}
                      onClick={() => handleMove(index, 'up')}
                      className="rounded p-1 text-cms-text-dim hover:bg-cms-surface-hover hover:text-cms-text disabled:opacity-30"
                      aria-label="Move up"
                      title="Move up"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        aria-hidden="true"
                      >
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      disabled={isPending || index === comments.length - 1}
                      onClick={() => handleMove(index, 'down')}
                      className="rounded p-1 text-cms-text-dim hover:bg-cms-surface-hover hover:text-cms-text disabled:opacity-30"
                      aria-label="Move down"
                      title="Move down"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        aria-hidden="true"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </div>

                  {/* Avatar */}
                  {comment.authorAvatarUrl ? (
                    <img
                      src={comment.authorAvatarUrl}
                      alt={comment.authorHandle}
                      className="mt-0.5 h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cms-surface-hover text-xs font-medium text-cms-text-muted"
                      aria-hidden="true"
                    >
                      {comment.authorHandle.replace('@', '').slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  {/* Main info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-cms-text">{comment.authorHandle}</span>
                      {localeBadge(comment.targetLocale)}
                      {comment.likeCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-cms-text-dim">
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
                            <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
                          </svg>
                          {comment.likeCount.toLocaleString()}
                        </span>
                      )}
                    </div>

                    {/* Comment text preview */}
                    <p className="mt-1 line-clamp-2 text-xs text-cms-text-muted">{comment.textPt}</p>

                    {/* Video link */}
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-cms-text-dim">
                      <span>{channelFlag(comment.channelLocale)}</span>
                      <a
                        href={`https://youtube.com/watch?v=${comment.youtubeVideoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate hover:text-cms-accent hover:underline"
                        title={comment.videoTitle}
                      >
                        {comment.videoTitle}
                      </a>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setEditingId(comment.id)
                        setShowForm(false)
                        setError(null)
                      }}
                      className="rounded p-1.5 text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text disabled:opacity-50"
                      aria-label={`Edit comment by ${comment.authorHandle}`}
                      title="Edit"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDelete(comment.id, comment.authorHandle)}
                      className="rounded p-1.5 text-cms-text-muted hover:bg-red-900/20 hover:text-red-400 disabled:opacity-50"
                      aria-label={`Delete comment by ${comment.authorHandle}`}
                      title="Delete"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
