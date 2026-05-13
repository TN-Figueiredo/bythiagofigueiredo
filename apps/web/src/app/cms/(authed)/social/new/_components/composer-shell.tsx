'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Provider, PostType } from '@tn-figueiredo/social'
import { PlatformSelector } from '@/app/cms/(authed)/_shared/social/platform-selector'
import { ComposerEditor } from './composer-editor'
import { PlatformPreviews } from './platform-previews'
import { ImageComposer } from './image-composer'
import { VideoComposer } from './video-composer'
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

function isValidUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
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
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<{
    content?: string
    url?: string
    platforms?: string
  }>({})

  function validate(): boolean {
    const errors: typeof validationErrors = {}
    if (mode === 'text') {
      if (!content && !url) {
        errors.content = t.validation.contentOrUrl
      }
      if (url && !isValidUrl(url)) {
        errors.url = t.validation.invalidUrl
      }
    }
    if (platforms.length === 0) {
      errors.platforms = t.validation.selectPlatform
    }
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handlePublish() {
    setSubmitError(null)
    if (!validate()) return
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
      } else {
        setSubmitError(result.error ?? t.common.error)
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
            <div className="space-y-1">
              <ComposerEditor
                content={content}
                url={url}
                hashtags={hashtags}
                selectedPlatforms={platforms}
                onContentChange={(v) => { setContent(v); setValidationErrors(e => ({ ...e, content: undefined })) }}
                onUrlChange={(v) => { setUrl(v); setValidationErrors(e => ({ ...e, url: undefined })) }}
                onHashtagsChange={setHashtags}
                strings={t}
              />
              {validationErrors.content && (
                <p id="content-error" role="alert" className="text-sm text-red-400">{validationErrors.content}</p>
              )}
              {validationErrors.url && (
                <p id="url-error" role="alert" className="text-sm text-red-400">{validationErrors.url}</p>
              )}
            </div>
          )}

          {mode === 'image' && (
            <ImageComposer images={images} onImagesChange={setImages} caption={caption} onCaptionChange={setCaption} selectedPlatforms={platforms} strings={t} />
          )}

          {mode === 'video' && <VideoComposer strings={t} />}

          <div className="space-y-1">
            <PlatformSelector
              selected={platforms}
              onChange={(v) => { setPlatforms(v); setValidationErrors(e => ({ ...e, platforms: undefined })) }}
              connections={connections}
              disabled={
                mode === 'text'
                  ? ['youtube']
                  : mode === 'video'
                    ? ['instagram']
                    : []
              }
              disabledReason={{
                youtube: t.composer.disabledReason.videoOnly,
                instagram: t.composer.disabledReason.requiresImage,
              }}
            />
            {validationErrors.platforms && (
              <p id="platforms-error" role="alert" className="text-sm text-red-400">{validationErrors.platforms}</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-cms-border bg-cms-bg p-4">
          <PlatformPreviews content={content} url={url} hashtags={hashtags} platforms={platforms} strings={t} />
        </div>
      </div>

      {/* Schedule bar */}
      <div className="space-y-2">
        {submitError && (
          <p id="submit-error" role="alert" className="text-sm text-red-400">{submitError}</p>
        )}
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
            disabled={isPending || platforms.length === 0 || (mode === 'text' && !content && !url)}
            aria-describedby={submitError ? 'submit-error' : undefined}
            className="rounded-md bg-cms-accent px-6 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover disabled:opacity-50"
          >
            {isPending ? t.common.saving : publishLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
