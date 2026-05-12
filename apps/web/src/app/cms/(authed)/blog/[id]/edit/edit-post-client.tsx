'use client'

import { useState } from 'react'
import { PostEditor } from '@tn-figueiredo/cms'
import { TipTapEditor } from '../../../_shared/editor/tiptap-editor'
import type { JSONContent } from '@tiptap/core'
import { StructuredFields } from '../../_shared/structured-fields'
import { HashtagInput } from '../../_shared/hashtag-input'
import { SeriesFields } from '../../_shared/series-fields'
import { savePost, compilePreview, uploadAsset, searchPosts } from './actions'
import type { SavePostActionInput } from './actions'
import { useMediaGallery } from '../../../_shared/media/use-media-gallery'
import { MediaGalleryModal } from '../../../_shared/media/media-gallery-modal'
import { CROP_PRESETS } from '../../../_shared/media/types'
import './editor-theme.css'

interface EditPostClientProps {
  postId: string
  locale: string
  siteId: string
  initialContent: string
  initialTitle: string
  initialSlug: string
  initialExcerpt: string | null
  initialMetaTitle: string | null
  initialMetaDescription: string | null
  initialOgImageUrl: string | null
  initialCoverImageUrl: string | null
  componentNames: string[]
  // Blog overhaul
  initialKeyPoints: string[]
  initialPullQuote: string
  initialNotes: string[]
  initialColophon: string
  initialPreviousPostId: string | null
  initialContinuesInNext: boolean
  initialHashtags: Array<{ id: string; name: string; slug: string }>
  initialContentJson: Record<string, unknown> | null
  initialContentHtml: string | null
}

export function EditPostClient({
  postId,
  locale,
  siteId,
  initialContent,
  initialTitle,
  initialSlug,
  initialExcerpt,
  initialMetaTitle,
  initialMetaDescription,
  initialOgImageUrl,
  initialCoverImageUrl,
  componentNames,
  initialKeyPoints,
  initialPullQuote,
  initialNotes,
  initialColophon,
  initialPreviousPostId,
  initialContinuesInNext,
  initialHashtags,
  initialContentJson,
  initialContentHtml,
}: EditPostClientProps) {
  const [keyPoints, setKeyPoints] = useState(initialKeyPoints)
  const [pullQuote, setPullQuote] = useState(initialPullQuote)
  const [notes, setNotes] = useState(initialNotes)
  const [colophon, setColophon] = useState(initialColophon)
  const [previousPostId, setPreviousPostId] = useState(initialPreviousPostId)
  const [continuesInNext, setContinuesInNext] = useState(initialContinuesInNext)
  const [hashtags, setHashtags] = useState(initialHashtags)
  const [titleState, setTitleState] = useState(initialTitle)
  const [slugState, setSlugState] = useState(initialSlug)
  const [contentJson, setContentJson] = useState<JSONContent | null>(
    initialContentJson as JSONContent | null
  )
  const [contentHtml, setContentHtml] = useState<string | null>(initialContentHtml)
  const useTipTap = contentJson !== null
  const coverGallery = useMediaGallery()

  const setCoverFromGallery = (url: string) => {
    const input = document.querySelector<HTMLInputElement>('[data-testid="cover-image-field"] input')
    if (input) {
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      nativeSetter?.call(input, url)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }

  const handleImageUpload = async (file: File): Promise<string | null> => {
    try {
      const result = await uploadAsset(file, postId)
      return result.url
    } catch {
      return null
    }
  }

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleTipTapSave = async () => {
    if (!contentJson || isSaving) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const result = await savePost(postId, locale, {
        content_mdx: '',
        title: titleState,
        slug: slugState,
        content_json: contentJson as Record<string, unknown>,
        content_html: contentHtml,
        excerpt: initialExcerpt,
        meta_title: initialMetaTitle,
        meta_description: initialMetaDescription,
        og_image_url: initialOgImageUrl,
        cover_image_url: initialCoverImageUrl,
        key_points: keyPoints.filter(Boolean),
        pull_quote: pullQuote || null,
        notes: notes.filter(Boolean),
        colophon: colophon || null,
        previous_post_id: previousPostId,
        continues_in_next: continuesInNext,
        hashtag_ids: hashtags.map(h => h.id),
      })
      if (!result.ok) {
        setSaveError('error' in result ? result.error : 'Save failed')
      }
      return result
    } catch {
      setSaveError('Network error — please try again')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="max-w-[780px] mx-auto px-6 mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => coverGallery.openGallery({ folder: 'blog', cropPreset: CROP_PRESETS['blog-cover'] })}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          {locale === 'pt-BR' ? 'Capa da galeria' : 'Cover from gallery'}
        </button>
      </div>
      {useTipTap ? (
        <>
          <div className="max-w-[780px] mx-auto px-6 mb-4">
            <TipTapEditor
              content={contentJson}
              onChange={(json: JSONContent, html: string) => { setContentJson(json); setContentHtml(html) }}
              onImageUpload={handleImageUpload}
            />
            {saveError && (
              <p className="mt-2 text-sm text-red-400">{saveError}</p>
            )}
            <button
              type="button"
              onClick={handleTipTapSave}
              disabled={isSaving}
              className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (locale === 'pt-BR' ? 'Salvando…' : 'Saving…') : (locale === 'pt-BR' ? 'Salvar' : 'Save')}
            </button>
          </div>
        </>
      ) : (
        <PostEditor
          postId={postId}
          initialContent={initialContent}
          initialTitle={initialTitle}
          initialSlug={initialSlug}
          initialExcerpt={initialExcerpt}
          initialMetaTitle={initialMetaTitle}
          initialMetaDescription={initialMetaDescription}
          initialOgImageUrl={initialOgImageUrl}
          initialCoverImageUrl={initialCoverImageUrl}
          locale={locale}
          componentNames={componentNames}
          onSave={async (input: SavePostActionInput) => {
            const result = await savePost(postId, locale, {
              ...input,
              key_points: keyPoints.filter(Boolean),
              pull_quote: pullQuote || null,
              notes: notes.filter(Boolean),
              colophon: colophon || null,
              previous_post_id: previousPostId,
              continues_in_next: continuesInNext,
              hashtag_ids: hashtags.map(h => h.id),
            })
            if (!result.ok && result.error === 'invalid_seo_extras') {
              return {
                ok: false as const,
                error: 'validation_failed' as const,
                fields: {
                  content_mdx: result.details[0]?.message ?? 'invalid seo_extras frontmatter',
                },
              }
            }
            return result
          }}
          onPreview={async (source: string) => compilePreview(source)}
          onUpload={async (file: File) => uploadAsset(file, postId)}
        />
      )}
      <div className="max-w-[780px] mx-auto px-6 mt-4">
        <StructuredFields
          keyPoints={keyPoints}
          onKeyPointsChange={setKeyPoints}
          pullQuote={pullQuote}
          onPullQuoteChange={setPullQuote}
          notes={notes}
          onNotesChange={setNotes}
          colophon={colophon}
          onColophonChange={setColophon}
        />
        <HashtagInput
          siteId={siteId}
          selected={hashtags}
          onChange={setHashtags}
        />
        <SeriesFields
          siteId={siteId}
          locale={locale}
          currentPostId={postId}
          previousPostId={previousPostId}
          onPreviousPostChange={setPreviousPostId}
          continuesInNext={continuesInNext}
          onContinuesChange={setContinuesInNext}
          searchPostsFn={searchPosts}
        />
      </div>
      <MediaGalleryModal
        {...coverGallery.galleryProps}
        onSelect={(asset) => {
          setCoverFromGallery(asset.url)
          coverGallery.closeGallery()
        }}
        locale={locale as 'en' | 'pt-BR'}
        siteId={siteId}
      />
    </>
  )
}
