'use client'

import { useState, useRef } from 'react'
import type { SocialStrings } from '../../_i18n/types'

interface VideoComposerProps {
  strings: SocialStrings
  quotaUsed?: number
}

const YOUTUBE_DAILY_QUOTA = 10000

export function VideoComposer({ strings: t, quotaUsed = 0 }: VideoComposerProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [privacy, setPrivacy] = useState<'private' | 'unlisted' | 'public'>('private')
  const [tags, setTags] = useState('')
  const [firstComment, setFirstComment] = useState('')

  const quotaPct = Math.round((quotaUsed / YOUTUBE_DAILY_QUOTA) * 100)

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f?.type.startsWith('video/')) setFile(f)
  }

  // Suppress unused-variable lint — progress state will be wired to
  // the real upload handler once the publish flow lands.
  void setUploadProgress

  return (
    <div className="space-y-4">
      {!file ? (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => fileRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-cms-border bg-cms-bg py-12 text-cms-text-muted hover:border-cms-accent"
        >
          <p className="text-sm">{t.composer.video.uploadZone}</p>
          <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]) }} />
        </div>
      ) : (
        <div className="rounded-lg border border-cms-border bg-cms-bg p-3 space-y-2">
          <p className="text-sm text-cms-text font-medium">{file.name}</p>
          <div className="h-2 rounded-full bg-gray-700">
            <div className="h-full rounded-full bg-cms-accent transition-all" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-cms-text">{t.composer.video.titleLabel}</label>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} className="mt-1 w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text" />
          <p className="text-xs text-cms-text-dim mt-0.5">{title.length}/100</p>
        </div>
        <div>
          <label className="text-sm font-medium text-cms-text">{t.composer.video.privacyLabel}</label>
          <select value={privacy} onChange={e => setPrivacy(e.target.value as typeof privacy)} className="mt-1 w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text">
            <option value="private">{t.composer.video.privacyPrivate}</option>
            <option value="unlisted">{t.composer.video.privacyUnlisted}</option>
            <option value="public">{t.composer.video.privacyPublic}</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-cms-text">{t.composer.video.descLabel}</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} maxLength={5000} className="mt-1 w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text" />
        <p className="text-xs text-cms-text-dim mt-0.5">{description.length}/5000</p>
      </div>

      <div>
        <label className="text-sm font-medium text-cms-text">{t.composer.video.tagsLabel}</label>
        <input value={tags} onChange={e => setTags(e.target.value)} className="mt-1 w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text" placeholder="tag1, tag2, tag3" />
      </div>

      <div>
        <label className="text-sm font-medium text-cms-text">{t.composer.video.firstComment}</label>
        <textarea value={firstComment} onChange={e => setFirstComment(e.target.value)} rows={2} placeholder="{short_link} | {blog_title}" className="mt-1 w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-dim" />
      </div>

      <div className="rounded-lg border border-cms-border bg-cms-bg p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-cms-text">{t.composer.video.quotaLabel.replace('{used}', String(quotaUsed)).replace('{limit}', String(YOUTUBE_DAILY_QUOTA))}</span>
          <span className={`text-xs ${quotaPct > 80 ? 'text-orange-400' : 'text-cms-text-dim'}`}>{quotaPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-700">
          <div className={`h-full rounded-full transition-all ${quotaPct > 80 ? 'bg-orange-500' : 'bg-cms-accent'}`} style={{ width: `${Math.min(quotaPct, 100)}%` }} />
        </div>
      </div>
    </div>
  )
}
