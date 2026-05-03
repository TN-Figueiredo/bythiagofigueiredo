'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PostEditor, type SavePostInput, type SaveResult } from '@tn-figueiredo/cms'
import { createPost } from '../actions'
import { savePost } from '../[id]/edit/actions'
import { compilePreview, uploadAsset } from '../[id]/edit/actions'
import { blogRegistry } from '@/lib/cms/registry'

interface NewPostEditorProps {
  locale: string
  tagId?: string
  defaultLocale: string
}

export function NewPostEditor({ locale, tagId }: NewPostEditorProps) {
  const router = useRouter()
  const [postId, setPostId] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const postIdRef = useRef<string | null>(null)
  const isDirtyRef = useRef(false)

  // Keep refs in sync for use in event handlers
  useEffect(() => {
    postIdRef.current = postId
  }, [postId])

  useEffect(() => {
    isDirtyRef.current = isDirty
  }, [isDirty])

  // Warn on unload when there are unsaved changes and no post created yet
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirtyRef.current && !postIdRef.current) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  async function handleSave(input: SavePostInput): Promise<SaveResult> {
    setIsDirty(true)

    // If we don't have a post yet, create one first
    let currentPostId = postIdRef.current
    if (!currentPostId) {
      const createResult = await createPost({
        title: input.title.trim() || undefined,
        locale,
        tagId: tagId ?? null,
        status: 'draft',
      })
      if (!createResult.ok) {
        return { ok: false, error: 'db_error', message: createResult.error }
      }
      currentPostId = createResult.postId
      postIdRef.current = currentPostId
      setPostId(currentPostId)
    }

    // Save the post content
    const saveResult = await savePost(currentPostId, locale, input)

    if (saveResult.ok) {
      // Navigate to the edit page; replace so back doesn't go back to /new
      router.replace(`/cms/blog/${currentPostId}/edit`)
    }

    // Adapter: map invalid_seo_extras to validation_failed (PostEditor doesn't know the extra type)
    if (!saveResult.ok && saveResult.error === 'invalid_seo_extras') {
      const details = (saveResult as { ok: false; error: 'invalid_seo_extras'; details: Array<{ message?: string }> }).details
      return {
        ok: false,
        error: 'validation_failed',
        fields: {
          content_mdx: details[0]?.message ?? 'invalid seo_extras frontmatter',
        },
      }
    }

    return saveResult
  }

  async function handleUpload(file: File): Promise<{ url: string }> {
    // If post doesn't exist yet, create a stub first
    let currentPostId = postIdRef.current
    if (!currentPostId) {
      const createResult = await createPost({
        locale,
        tagId: tagId ?? null,
        status: 'draft',
      })
      if (!createResult.ok) {
        throw new Error(createResult.error)
      }
      currentPostId = createResult.postId
      postIdRef.current = currentPostId
      setPostId(currentPostId)
    }
    return uploadAsset(file, currentPostId)
  }

  return (
    <PostEditor
      postId={postId ?? undefined}
      initialContent=""
      initialTitle=""
      initialSlug=""
      locale={locale}
      componentNames={Object.keys(blogRegistry)}
      onSave={handleSave}
      onPreview={async (source) => compilePreview(source)}
      onUpload={handleUpload}
    />
  )
}
