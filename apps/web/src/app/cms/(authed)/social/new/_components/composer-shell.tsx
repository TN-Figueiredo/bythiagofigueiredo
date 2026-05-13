'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Provider, PostType } from '@tn-figueiredo/social'
import { PlatformSelector } from '@/app/cms/(authed)/_shared/social/platform-selector'
import { ComposerEditor } from './composer-editor'
import { PlatformPreviews } from './platform-previews'
import { ImageComposer } from './image-composer'
import { createSocialPost } from '@/lib/social/actions'
import type { SocialStrings } from '../../_i18n/types'

type ComposerMode = 'text' | 'image' | 'video'

interface MinimalConnection {
  provider: Provider
  account_name: string | null
}

interface ComposerShellProps {
  connections: MinimalConnection[]
  strings: SocialStrings
  initialMode?: ComposerMode
}

export function ComposerShell({
  connections,
  strings: t,
  initialMode = 'text',
}: ComposerShellProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [mode, setMode] = useState<ComposerMode>(initialMode)
  const [content, setContent] = useState('')
  const [url, setUrl] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [platforms, setPlatforms] = useState<Provider[]>([])
  const [scheduleMode, setScheduleMode] = useState<'now' | 'schedule' | 'queue'>(
    'now',
  )
  const [images, setImages] = useState<string[]>([])
  const [caption, setCaption] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')

  function handlePublish() {
    if (platforms.length === 0) return
    startTransition(async () => {
      const postType: PostType =
        mode === 'video' ? 'video' : mode === 'image' ? 'image' : url ? 'link' : 'text'
      const result = await createSocialPost({
        type: postType,
        content: {
          description: content || undefined,
          url: url || undefined,
          hashtags: hashtags.length > 0 ? hashtags : undefined,
        },
        platforms,
        scheduledAt: scheduleMode === 'schedule' ? scheduledAt : undefined,
      })
      if (result.ok) {
        router.push(`/cms/social/${result.data.id}`)
      }
    })
  }

  const scheduleModeLabels: Record<'now' | 'schedule' | 'queue', string> = {
    now: t.composer.schedule.now,
    schedule: t.composer.schedule.scheduled,
    queue: t.composer.schedule.queue,
  }

  const publishLabel =
    scheduleMode === 'now'
      ? t.composer.schedule.publish
      : scheduleMode === 'schedule'
        ? t.composer.schedule.scheduleAction
        : t.composer.schedule.addToQueue

  return (
    <div className="space-y-6">
      {/* Mode tabs */}
      <div className="flex gap-2 border-b border-cms-border pb-2">
        {(['text', 'image', 'video'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 text-sm font-medium ${
              mode === m
                ? 'border-b-2 border-cms-accent text-cms-accent'
                : 'text-cms-text-muted hover:text-cms-text'
            }`}
          >
            {t.composer.modes[m]}
          </button>
        ))}
      </div>

      {/* Editor + Preview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {mode === 'text' && (
            <ComposerEditor
              content={content}
              url={url}
              hashtags={hashtags}
              selectedPlatforms={platforms}
              onContentChange={setContent}
              onUrlChange={setUrl}
              onHashtagsChange={setHashtags}
              strings={t}
            />
          )}

          {mode === 'image' && (
            <ImageComposer images={images} onImagesChange={setImages} caption={caption} onCaptionChange={setCaption} selectedPlatforms={platforms} strings={t} />
          )}

          {mode === 'video' && (
            <div className="rounded-lg border border-dashed border-cms-border p-8 text-center text-cms-text-muted">
              {t.composer.video.uploadZone}
            </div>
          )}

          <PlatformSelector
            selected={platforms}
            onChange={setPlatforms}
            connections={connections}
            disabled={
              mode === 'text'
                ? ['youtube']
                : mode === 'video'
                  ? ['instagram']
                  : []
            }
            disabledReason={{
              youtube: 'Video mode only',
              instagram: 'Requires image',
            }}
          />
        </div>

        <div className="rounded-lg border border-cms-border bg-cms-bg p-4">
          <PlatformPreviews content={content} url={url} hashtags={hashtags} platforms={platforms} strings={t} />
        </div>
      </div>

      {/* Schedule bar */}
      <div className="flex items-center gap-4 rounded-lg border border-cms-border bg-cms-surface px-4 py-3">
        <div className="flex gap-2">
          {(['now', 'schedule', 'queue'] as const).map((sm) => (
            <button
              key={sm}
              type="button"
              onClick={() => setScheduleMode(sm)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                scheduleMode === sm
                  ? 'bg-cms-accent/15 text-cms-accent'
                  : 'text-cms-text-muted hover:text-cms-text'
              }`}
            >
              {scheduleModeLabels[sm]}
            </button>
          ))}
        </div>

        {scheduleMode === 'schedule' && (
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="rounded-md border border-cms-border bg-cms-bg px-3 py-1.5 text-sm text-cms-text"
          />
        )}

        <div className="flex-1" />

        <button
          type="button"
          onClick={handlePublish}
          disabled={isPending || platforms.length === 0 || (!content && !url)}
          className="rounded-md bg-cms-accent px-6 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover disabled:opacity-50"
        >
          {isPending ? '...' : publishLabel}
        </button>
      </div>
    </div>
  )
}
