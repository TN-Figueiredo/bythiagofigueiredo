'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Provider, PostType, DeliveryStatus, ErrorType } from '@tn-figueiredo/social'
import { PlatformSelector } from '@/app/cms/(authed)/_shared/social/platform-selector'
import { ComposerEditor } from './composer-editor'
import { PlatformPreviews } from './platform-previews'
import { ImageComposer } from './image-composer'
import { VideoComposer } from './video-composer'
import { ContentPicker, type SelectedContent } from './content-picker'
import { CaptionTabs } from './caption-tabs'
import { ScheduleBar } from './schedule-bar'
import { TemplateCarousel } from './template-carousel'
import { OgCompact } from '@/app/cms/(authed)/_shared/social/og-compact'
import { PublishConfirmationDialog } from './publish-confirmation-dialog'
import { PublishStatusBanner } from './publish-status-banner'
import { OgPreviewSidebar } from './og-preview-sidebar'
import type { OgData } from './og-preview-sidebar'
import type { DuplicateWarnings } from '@/lib/social/duplicate-detection'
import type {
  createSocialPost,
  createFromContentAction,
  getContentForSocialPost,
  editPublishedPost,
  checkDuplicatesAction,
} from '@/lib/social/actions'
import type { SocialStrings } from '../../_i18n/types'
import { getEditRules, type ContentType } from '@/lib/social/types'

type ComposerMode = 'text' | 'image' | 'video'
type SourceMode = 'cms' | 'freeform'
type ScheduleMode = 'now' | 'schedule' | 'queue'

interface MinimalConnection {
  provider: Provider
  account_name: string | null
}

interface ComposerTemplate {
  id: string
  name: string
  aspect_ratio: '9:16' | '1:1' | '16:9'
  thumbnail_url: string | null
  is_default: boolean
}

interface ComposerShellProps {
  connections: MinimalConnection[]
  strings: SocialStrings
  templates?: ComposerTemplate[]
  initialMode?: ComposerMode
  initialSourceMode?: SourceMode
  preselectedContentType?: ContentType
  preselectedContentId?: string
  editPostId?: string
  editDeliveries?: Array<{
    id: string
    provider: Provider
    status: string
    platform_post_id: string | null
  }>
  onRetrySocialDelivery?: (deliveryId: string) => Promise<{ ok: boolean; error?: string }>
  onCreateSocialPost: typeof createSocialPost
  onCreateFromContent: typeof createFromContentAction
  onGetContentForSocialPost: typeof getContentForSocialPost
  onEditPublishedPost: typeof editPublishedPost
  onCheckDuplicates: typeof checkDuplicatesAction
  onFetchQueueSlot?: (timezone: string) => Promise<{ date: string; hour: number; scheduledAt: string; label: string } | null>
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
  templates = [],
  initialMode = 'text',
  initialSourceMode = 'cms',
  preselectedContentType,
  preselectedContentId,
  editPostId,
  editDeliveries,
  onRetrySocialDelivery,
  onCreateSocialPost,
  onCreateFromContent,
  onGetContentForSocialPost,
  onEditPublishedPost,
  onCheckDuplicates,
  onFetchQueueSlot,
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

  // Content loading
  const [loadingContentId, setLoadingContentId] = useState<string | null>(null)

  // Pre-publish confirmation dialog
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmationShortUrl, setConfirmationShortUrl] = useState<string | null>(null)
  const [isPrePublishLoading, setIsPrePublishLoading] = useState(false)

  // OG data (derived from selected content)
  const [ogData, setOgData] = useState<OgData | null>(null)

  // Template selection
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    templates.find((t) => t.is_default)?.id ?? null,
  )

  // Edit mode state
  const [editCaption, setEditCaption] = useState('')
  const isEditMode = !!editPostId

  // Duplicate detection (CMS mode only)
  const [duplicateWarnings, setDuplicateWarnings] = useState<DuplicateWarnings | null>(null)

  // Post-publish delivery status (shown before navigation)
  const [publishedDeliveries, setPublishedDeliveries] = useState<Array<{
    id: string
    provider: Provider
    status: DeliveryStatus
    error: string | null
    errorType: ErrorType | null
  }>>([])
  const [publishedPostId, setPublishedPostId] = useState<string | null>(null)

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
    onGetContentForSocialPost(preselectedContentType, preselectedContentId).then((res) => {
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
  }, [preselectedContentType, preselectedContentId, onGetContentForSocialPost])

  // Derive OG data from selected content
  useEffect(() => {
    if (!selectedContent) {
      setOgData(null)
      return
    }
    const domain = selectedContent.url
      ? (() => {
          try {
            return new URL(selectedContent.url).hostname
          } catch {
            return ''
          }
        })()
      : ''
    setOgData({
      title: selectedContent.title,
      description: selectedContent.excerpt ?? '',
      image: selectedContent.image ?? null,
      domain,
    })
  }, [selectedContent])

  // Run duplicate check whenever content or platform selection changes in CMS mode
  useEffect(() => {
    if (sourceMode !== 'cms' || !selectedContent || platforms.length === 0) {
      setDuplicateWarnings(null)
      return
    }

    onCheckDuplicates(
      selectedContent.contentType,
      selectedContent.contentId,
      platforms,
    ).then((res) => {
      if (res.ok) {
        setDuplicateWarnings(res.data)
      }
    }).catch(() => {
      // Silently ignore — duplicate check is informational only
    })
  }, [sourceMode, selectedContent, platforms, onCheckDuplicates])

  function handleContentSelect(
    type: ContentType,
    id: string,
    _metadata: { title: string; thumbnail: string | null; status: string; updatedAt: string },
  ) {
    setLoadingContentId(id)
    setSubmitError(null)
    onGetContentForSocialPost(type, id).then((res) => {
      setLoadingContentId(null)
      if (!res.ok) {
        setSubmitError(`Erro ao carregar conteúdo: ${res.error}`)
        return
      }
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
    }).catch(() => {
      setLoadingContentId(null)
      setSubmitError('Erro ao carregar conteúdo. Tente novamente.')
    })
  }

  function handleModeChange(mode: SourceMode) {
    setSourceMode(mode)
    if (mode === 'freeform') {
      setSelectedContent(null)
      setDuplicateWarnings(null)
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
        const result = await onCreateFromContent({
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
        const result = await onCreateSocialPost({
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

  function handlePrePublish() {
    setSubmitError(null)
    if (!validate()) return

    if (sourceMode === 'cms' && selectedContent) {
      setIsPrePublishLoading(true)
      try {
        // JIT short link — placeholder until Phase 1 provides ensureTrackedLink
        setConfirmationShortUrl(
          `${process.env.NEXT_PUBLIC_SHORT_DOMAIN ?? 'go.btf.com'}/______`,
        )
        setShowConfirmation(true)
      } catch {
        setSubmitError('Erro ao preparar publicacao')
      } finally {
        setIsPrePublishLoading(false)
      }
    } else {
      // Freeform mode: publish directly (no confirmation needed)
      handlePublishConfirm()
    }
  }

  function handlePublishConfirm() {
    setShowConfirmation(false)
    handlePublish()
  }

  function handlePublishCancel() {
    setShowConfirmation(false)
    setConfirmationShortUrl(null)
  }

  function handlePublish() {
    setSubmitError(null)
    if (!validate()) return

    // Show pending delivery statuses immediately while the publish runs
    setPublishedDeliveries(
      platforms.map((p, i) => ({
        id: `pending-${i}`,
        provider: p,
        status: 'publishing' as DeliveryStatus,
        error: null,
        errorType: null,
      })),
    )

    startTransition(async () => {
      if (sourceMode === 'cms' && selectedContent) {
        const result = await onCreateFromContent({
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
          setPublishedPostId(result.data.postId)
          router.push(`/cms/social/${result.data.postId}`)
        } else {
          setPublishedDeliveries([])
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
        const result = await onCreateSocialPost({
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
          setPublishedPostId(result.data.id)
          router.push(`/cms/social/${result.data.id}`)
        } else {
          setPublishedDeliveries([])
          setSubmitError(result.error ?? t.common.error)
        }
      }
    })
  }

  function handleEditSave(deliveryId: string) {
    if (!editPostId || !editCaption.trim()) return
    setSubmitError(null)
    startTransition(async () => {
      const result = await onEditPublishedPost(editPostId, deliveryId, { caption: editCaption })
      if (result.ok) {
        router.push(`/cms/social/${editPostId}`)
      } else {
        setSubmitError(result.error ?? t.common.error)
      }
    })
  }

  const showPipeline = sourceMode === 'cms' && !!selectedContent

  // -----------------------------------------------------------------------
  // Edit mode: show per-platform edit rules + caption editor
  // -----------------------------------------------------------------------
  if (isEditMode && editDeliveries) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-cms-border bg-cms-surface p-4 space-y-4">
          <h3 className="text-sm font-semibold text-cms-text">
            Editar post publicado
          </h3>

          {editDeliveries.map((d) => {
            const rules = getEditRules(d.provider)
            return (
              <div key={d.id} className="rounded-md border border-cms-border bg-cms-bg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize text-cms-text">
                    {d.provider}
                  </span>
                  {rules.readOnly ? (
                    <span className="rounded-full bg-cms-text-muted/10 px-2 py-0.5 text-xs text-cms-text-muted">
                      {rules.readOnlyReason ?? 'Somente leitura'}
                    </span>
                  ) : (
                    <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
                      {rules.method === 'update' ? 'Editavel' : 'Recriar'}
                    </span>
                  )}
                </div>

                {rules.warning && (
                  <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                    {rules.warning}
                  </p>
                )}

                {!rules.readOnly && rules.canEditCaption && d.status === 'published' && (
                  <div className="space-y-2">
                    <textarea
                      value={editCaption}
                      onChange={(e) => setEditCaption(e.target.value)}
                      rows={3}
                      placeholder="Nova legenda..."
                      className="w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text"
                    />
                    <button
                      type="button"
                      onClick={() => handleEditSave(d.id)}
                      disabled={isPending || !editCaption.trim()}
                      className="rounded-md bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent/90 disabled:opacity-50"
                    >
                      {isPending ? 'Salvando...' : 'Salvar alteracao'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {submitError && (
          <p role="alert" className="text-sm text-red-400">{submitError}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Source mode toggle (CMS vs Freeform) — rendered by ContentPicker */}
      <ContentPicker
        mode={sourceMode}
        onModeChange={handleModeChange}
        onSelect={handleContentSelect}
        selectedId={selectedContent?.contentId ?? loadingContentId}
        isLoadingContent={!!loadingContentId}
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

          {/* Per-platform OG preview sidebar — shown when platforms are selected */}
          {ogData && platforms.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer select-none text-xs font-medium text-cms-text-muted hover:text-cms-text list-none flex items-center gap-1">
                <span className="transition-transform group-open:rotate-90">▶</span>
                Visualização por plataforma
              </summary>
              <div className="mt-3 overflow-x-auto">
                <OgPreviewSidebar
                  platforms={platforms}
                  ogData={ogData}
                />
              </div>
            </details>
          )}
        </div>
      )}

      {/* Duplicate post warning banner (CMS mode only) */}
      {sourceMode === 'cms' && duplicateWarnings && duplicateWarnings.severity !== 'none' && (
        <div
          data-testid="duplicate-warning-banner"
          className={`rounded-md border px-4 py-3 text-sm ${
            duplicateWarnings.severity === 'confirm'
              ? 'border-red-500/30 bg-red-500/10 text-red-400'
              : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
          }`}
        >
          {duplicateWarnings.severity === 'confirm' ? (
            <>
              <strong>Aviso:</strong> Este conteudo ja foi postado em{' '}
              {duplicateWarnings.samePlatformPosts.map((p) => p.platform).join(', ')}.
              Publicar novamente criara uma postagem duplicada.
            </>
          ) : (
            <>
              <strong>Info:</strong> Este conteudo ja foi postado em outra(s) plataforma(s) (
              {duplicateWarnings.totalExisting} post
              {duplicateWarnings.totalExisting !== 1 ? 's' : ''} existente
              {duplicateWarnings.totalExisting !== 1 ? 's' : ''}).
            </>
          )}
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
          contentTitle={selectedContent.title}
          contentUrl={selectedContent.url ?? url}
          shortDomain={process.env.NEXT_PUBLIC_SHORT_DOMAIN ?? 'go.btf.com'}
        />
      )}

      {/* Template carousel — shown when templates are available */}
      {templates.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-cms-text-muted">Visual template</p>
          <TemplateCarousel
            templates={templates}
            selectedId={selectedTemplateId}
            onSelect={setSelectedTemplateId}
          />
        </div>
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
        onPublish={handlePrePublish}
        onSaveDraft={handleSaveDraft}
        isPending={isPending}
        showPipeline={showPipeline}
        onFetchQueueSlot={onFetchQueueSlot}
      />

      {/* Post-publish delivery status banner — shown while navigating to detail page */}
      {publishedDeliveries.length > 0 && (
        <PublishStatusBanner
          deliveries={publishedDeliveries}
          onRetry={async (deliveryId) => {
            if (onRetrySocialDelivery) await onRetrySocialDelivery(deliveryId)
            if (publishedPostId) {
              router.push(`/cms/social/${publishedPostId}`)
            }
          }}
          strings={t}
        />
      )}

      {/* Pre-publish confirmation dialog (CMS mode only) */}
      {showConfirmation && selectedContent && (
        <PublishConfirmationDialog
          open={showConfirmation}
          onClose={handlePublishCancel}
          onConfirm={handlePublishConfirm}
          platforms={platforms}
          captions={captions}
          contentTitle={selectedContent.title}
          contentUrl={selectedContent.url ?? url}
          shortUrl={confirmationShortUrl ?? ''}
          ogData={ogData}
          isLoading={isPending}
        />
      )}
    </div>
  )
}
