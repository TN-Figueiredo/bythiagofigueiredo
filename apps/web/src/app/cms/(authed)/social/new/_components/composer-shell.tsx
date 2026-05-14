'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Provider, PostType } from '@tn-figueiredo/social'
import { PlatformSelector } from '@/app/cms/(authed)/_shared/social/platform-selector'
import { ComposerEditor } from './composer-editor'
import { PlatformPreviews } from './platform-previews'
import { ImageComposer } from './image-composer'
import { VideoComposer } from './video-composer'
import { ContentPicker, type SelectedContent } from './content-picker'
import { CaptionTabs } from './caption-tabs'
import { ScheduleBar } from './schedule-bar'
import { OgCompact } from '@/app/cms/(authed)/_shared/social/og-compact'
import {
  createSocialPost,
  createFromContentAction,
  getContentForSocialPost,
} from '@/lib/social/actions'
import type { SocialStrings } from '../../_i18n/types'
import type { ContentType } from '@/lib/social/types'

type ComposerMode = 'text' | 'image' | 'video'
type SourceMode = 'cms' | 'freeform'
type ScheduleMode = 'now' | 'schedule' | 'queue'

interface MinimalConnection {
  provider: Provider
  account_name: string | null
}

interface ComposerShellProps {
  connections: MinimalConnection[]
  strings: SocialStrings
  initialMode?: ComposerMode
  initialSourceMode?: SourceMode
  preselectedContentType?: ContentType
  preselectedContentId?: string
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
  initialSourceMode = 'cms',
  preselectedContentType,
  preselectedContentId,
}: ComposerShellProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Source mode: cms (select from CMS content) or freeform (write from scratch)
  const [sourceMode, setSourceMode] = useState<SourceMode>(
    preselectedContentType ? 'cms' : initialSourceMode,
  )
  const [composerMode, setComposerMode] = useState<ComposerMode>(initialMode)

  // Selected CMS content
  const [selectedContent, setSelectedContent] = useState<SelectedContent | null>(null)

  // Freeform fields
  const [content, setContent] = useState('')
  const [url, setUrl] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])

  // Captions (CMS mode: per-platform, per-locale)
  const [captions, setCaptions] = useState<Record<string, Record<string, string>>>({})
  const [captionsAutoFilled, setCaptionsAutoFilled] = useState(false)

  // Shared fields
  const [platforms, setPlatforms] = useState<Provider[]>([])
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('now')
  const [scheduledAt, setScheduledAt] = useState('')

  // Images (image mode)
  const [images, setImages] = useState<string[]>([])
  const [caption, setCaption] = useState('')

  // Errors
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<{
    content?: string
    url?: string
    platforms?: string
  }>({})

  // If a content was preselected (e.g. from publish modal), load its metadata
  useEffect(() => {
    if (!preselectedContentType || !preselectedContentId) return
    getContentForSocialPost(preselectedContentType, preselectedContentId).then((res) => {
      if (!res.ok) return
      const d = res.data
      setSelectedContent({
        contentType: d.contentType as ContentType,
        contentId: d.contentId,
        title: d.title,
        url: d.url,
        image: d.image,
        excerpt: d.excerpt,
        tags: d.tags,
        locale: d.locale,
      })
      setUrl(d.url)
    })
  }, [preselectedContentType, preselectedContentId])

  function handleContentSelect(
    type: ContentType,
    id: string,
    metadata: { title: string; thumbnail: string | null; status: string; updatedAt: string },
  ) {
    // Fetch full metadata for the selected content
    getContentForSocialPost(type, id).then((res) => {
      if (!res.ok) return
      const d = res.data
      const sel: SelectedContent = {
        contentType: type,
        contentId: id,
        title: d.title,
        url: d.url,
        image: d.image,
        excerpt: d.excerpt,
        tags: d.tags,
        locale: d.locale,
      }
      setSelectedContent(sel)
      setUrl(d.url)

      // Auto-fill captions for each selected platform
      if (platforms.length > 0) {
        const autoCaptions: Record<string, Record<string, string>> = {}
        for (const p of platforms) {
          autoCaptions[p] = {
            pt: d.excerpt ?? d.title,
            en: '',
          }
        }
        setCaptions(autoCaptions)
        setCaptionsAutoFilled(true)
      }
    })
  }

  function handleModeChange(mode: SourceMode) {
    setSourceMode(mode)
    if (mode === 'freeform') {
      setSelectedContent(null)
    }
  }

  function validate(): boolean {
    const errors: typeof validationErrors = {}

    if (sourceMode === 'freeform') {
      if (composerMode === 'text') {
        if (!content && !url) {
          errors.content = t.validation.contentOrUrl
        }
        if (url && !isValidUrl(url)) {
          errors.url = t.validation.invalidUrl
        }
      }
    } else {
      if (!selectedContent) {
        errors.content = 'Selecione um conteúdo do CMS'
      }
    }

    if (platforms.length === 0) {
      errors.platforms = t.validation.selectPlatform
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleSaveDraft() {
    setSubmitError(null)
    startTransition(async () => {
      if (sourceMode === 'cms' && selectedContent) {
        const result = await createFromContentAction({
          contentType: selectedContent.contentType,
          contentId: selectedContent.contentId,
          config: {
            enabled: true,
            platforms,
            captions,
            hashtags,
            image_source: 'og_image',
            ig_template: 'minimal',
            formats: {},
          },
          origin: 'manual',
          scheduledAt: undefined,
        })
        if (result.ok) {
          router.push(`/cms/social/${result.data.postId}`)
        } else {
          setSubmitError(result.error ?? t.common.error)
        }
      } else {
        const postType: PostType =
          composerMode === 'video'
            ? 'video'
            : composerMode === 'image'
              ? 'image'
              : url
                ? 'link'
                : 'text'
        const result = await createSocialPost({
          type: postType,
          content: {
            description: content || undefined,
            url: url || undefined,
            hashtags: hashtags.length > 0 ? hashtags : undefined,
          },
          platforms,
        })
        if (result.ok) {
          router.push(`/cms/social/${result.data.id}`)
        } else {
          setSubmitError(result.error ?? t.common.error)
        }
      }
    })
  }

  function handlePublish() {
    setSubmitError(null)
    if (!validate()) return

    startTransition(async () => {
      if (sourceMode === 'cms' && selectedContent) {
        const result = await createFromContentAction({
          contentType: selectedContent.contentType,
          contentId: selectedContent.contentId,
          config: {
            enabled: true,
            platforms,
            captions,
            hashtags,
            image_source: 'og_image',
            ig_template: 'minimal',
            formats: {},
          },
          origin: 'manual',
          scheduledAt: scheduleMode === 'schedule' ? scheduledAt : undefined,
        })
        if (result.ok) {
          router.push(`/cms/social/${result.data.postId}`)
        } else {
          setSubmitError(result.error ?? t.common.error)
        }
      } else {
        const postType: PostType =
          composerMode === 'video'
            ? 'video'
            : composerMode === 'image'
              ? 'image'
              : url
                ? 'link'
                : 'text'
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
      }
    })
  }

  const showPipeline = sourceMode === 'cms' && !!selectedContent

  return (
    <div className="space-y-6">
      {/* Source mode toggle (CMS vs Freeform) — rendered by ContentPicker */}
      <ContentPicker
        mode={sourceMode}
        onModeChange={handleModeChange}
        onSelect={handleContentSelect}
      />

      {/* Selected content OG preview (CMS mode only) */}
      {sourceMode === 'cms' && selectedContent && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="rounded bg-cms-accent/10 px-2 py-0.5 text-xs font-medium text-cms-accent">
              {selectedContent.contentType}
            </span>
            <span className="truncate text-sm font-medium text-cms-text">
              {selectedContent.title}
            </span>
          </div>
          <OgCompact
            ogTitle={selectedContent.title}
            ogDescription={selectedContent.excerpt}
            ogImage={selectedContent.image}
          />
        </div>
      )}

      {/* Freeform composer: mode tabs + editor */}
      {sourceMode === 'freeform' && (
        <>
          {/* Composer mode tabs (text / image / video) */}
          <div className="flex gap-2 border-b border-cms-border pb-2">
            {(['text', 'image', 'video'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setComposerMode(m)}
                className={`px-3 py-1.5 text-sm font-medium ${
                  composerMode === m
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
              {composerMode === 'text' && (
                <div className="space-y-1">
                  <ComposerEditor
                    content={content}
                    url={url}
                    hashtags={hashtags}
                    selectedPlatforms={platforms}
                    onContentChange={(v) => {
                      setContent(v)
                      setValidationErrors((e) => ({ ...e, content: undefined }))
                    }}
                    onUrlChange={(v) => {
                      setUrl(v)
                      setValidationErrors((e) => ({ ...e, url: undefined }))
                    }}
                    onHashtagsChange={setHashtags}
                    strings={t}
                  />
                  {validationErrors.content && (
                    <p id="content-error" role="alert" className="text-sm text-red-400">
                      {validationErrors.content}
                    </p>
                  )}
                  {validationErrors.url && (
                    <p id="url-error" role="alert" className="text-sm text-red-400">
                      {validationErrors.url}
                    </p>
                  )}
                </div>
              )}

              {composerMode === 'image' && (
                <ImageComposer
                  images={images}
                  onImagesChange={setImages}
                  caption={caption}
                  onCaptionChange={setCaption}
                  selectedPlatforms={platforms}
                  strings={t}
                />
              )}

              {composerMode === 'video' && <VideoComposer strings={t} />}
            </div>

            <div className="rounded-lg border border-cms-border bg-cms-bg p-4">
              <PlatformPreviews
                content={content}
                url={url}
                hashtags={hashtags}
                platforms={platforms}
                strings={t}
              />
            </div>
          </div>
        </>
      )}

      {/* Platform selector (always visible) */}
      <div className="space-y-1">
        <PlatformSelector
          selected={platforms}
          onChange={(v) => {
            setPlatforms(v)
            setValidationErrors((e) => ({ ...e, platforms: undefined }))
          }}
          connections={connections}
          disabled={
            sourceMode === 'freeform'
              ? composerMode === 'text'
                ? ['youtube']
                : composerMode === 'video'
                  ? ['instagram']
                  : []
              : []
          }
          disabledReason={{
            youtube: t.composer.disabledReason.videoOnly,
            instagram: t.composer.disabledReason.requiresImage,
          }}
        />
        {validationErrors.platforms && (
          <p id="platforms-error" role="alert" className="text-sm text-red-400">
            {validationErrors.platforms}
          </p>
        )}
      </div>

      {/* Caption tabs — CMS mode only, when content is selected */}
      {sourceMode === 'cms' && selectedContent && platforms.length > 0 && (
        <CaptionTabs
          captions={captions}
          onChange={setCaptions}
          platforms={platforms}
          autoFilled={captionsAutoFilled}
        />
      )}

      {/* Submit error */}
      {submitError && (
        <p id="submit-error" role="alert" className="text-sm text-red-400">
          {submitError}
        </p>
      )}

      {/* Schedule bar */}
      <ScheduleBar
        mode={scheduleMode}
        onModeChange={setScheduleMode}
        scheduledAt={scheduledAt}
        onScheduleChange={setScheduledAt}
        onPublish={handlePublish}
        onSaveDraft={handleSaveDraft}
        isPending={isPending}
        showPipeline={showPipeline}
        siteId=""
      />
    </div>
  )
}
