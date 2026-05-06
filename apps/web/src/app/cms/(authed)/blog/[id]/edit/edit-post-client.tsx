'use client'

import { useState } from 'react'
import { PostEditor } from '@tn-figueiredo/cms'
import { StructuredFields } from '../../_shared/structured-fields'
import { HashtagInput } from '../../_shared/hashtag-input'
import { SeriesFields } from '../../_shared/series-fields'
import { savePost, compilePreview, uploadAsset, searchPosts } from './actions'
import type { SavePostActionInput } from './actions'
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
}: EditPostClientProps) {
  const [keyPoints, setKeyPoints] = useState(initialKeyPoints)
  const [pullQuote, setPullQuote] = useState(initialPullQuote)
  const [notes, setNotes] = useState(initialNotes)
  const [colophon, setColophon] = useState(initialColophon)
  const [previousPostId, setPreviousPostId] = useState(initialPreviousPostId)
  const [continuesInNext, setContinuesInNext] = useState(initialContinuesInNext)
  const [hashtags, setHashtags] = useState(initialHashtags)

  return (
    <>
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
    </>
  )
}
