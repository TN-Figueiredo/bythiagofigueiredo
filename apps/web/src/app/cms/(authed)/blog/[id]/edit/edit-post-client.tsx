'use client'

import { PostEditor } from '@tn-figueiredo/cms'
import { savePost, compilePreview, uploadAsset } from './actions'
import type { SavePostActionInput } from './actions'
import './editor-theme.css'

interface EditPostClientProps {
  postId: string
  locale: string
  initialContent: string
  initialTitle: string
  initialSlug: string
  initialExcerpt: string | null
  initialMetaTitle: string | null
  initialMetaDescription: string | null
  initialOgImageUrl: string | null
  initialCoverImageUrl: string | null
  componentNames: string[]
}

export function EditPostClient({
  postId,
  locale,
  initialContent,
  initialTitle,
  initialSlug,
  initialExcerpt,
  initialMetaTitle,
  initialMetaDescription,
  initialOgImageUrl,
  initialCoverImageUrl,
  componentNames,
}: EditPostClientProps) {
  return (
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
        const result = await savePost(postId, locale, input)
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
  )
}
