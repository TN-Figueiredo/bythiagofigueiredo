'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { JSONContent } from '@tiptap/core'
import { TipTapEditor } from '../../_shared/editor/tiptap-editor'
import { createPost } from '../actions'
import { savePost, uploadAsset } from '../[id]/edit/actions'

interface NewPostEditorProps {
  locale: string
  tagId?: string
  defaultLocale: string
}

export function NewPostEditor({ locale, tagId }: NewPostEditorProps) {
  const router = useRouter()
  const [postId, setPostId] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [contentJson, setContentJson] = useState<JSONContent | null>(null)
  const [contentHtml, setContentHtml] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
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

  function slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
  }

  async function handleSave() {
    if (isSaving || !contentJson) return
    setIsSaving(true)
    setSaveError(null)
    setIsDirty(true)

    try {
      let currentPostId = postIdRef.current
      if (!currentPostId) {
        const createResult = await createPost({
          title: title.trim() || undefined,
          locale,
          tagId: tagId ?? null,
          status: 'draft',
        })
        if (!createResult.ok) {
          setSaveError('Failed to create post')
          return
        }
        currentPostId = createResult.postId
        postIdRef.current = currentPostId
        setPostId(currentPostId)
      }

      const saveResult = await savePost(currentPostId, locale, {
        title,
        slug,
        content_json: contentJson as Record<string, unknown>,
        content_html: contentHtml,
        content_mdx: '',
      })

      if (saveResult.ok) {
        router.replace(`/cms/blog/${currentPostId}/edit`)
      } else {
        setSaveError('error' in saveResult ? saveResult.error : 'Save failed')
      }
    } catch {
      setSaveError('Network error — please try again')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleImageUpload(file: File): Promise<string | null> {
    // If post doesn't exist yet, create a stub first
    let currentPostId = postIdRef.current
    if (!currentPostId) {
      const createResult = await createPost({
        locale,
        tagId: tagId ?? null,
        status: 'draft',
      })
      if (!createResult.ok) {
        return null
      }
      currentPostId = createResult.postId
      postIdRef.current = currentPostId
      setPostId(currentPostId)
    }
    try {
      const result = await uploadAsset(file, currentPostId)
      return result.url
    } catch {
      return null
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-[780px] mx-auto px-6 pt-7 pb-20">
      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          setSlug(slugify(e.target.value))
          setIsDirty(true)
        }}
        aria-label="Post title"
        className="w-full bg-transparent text-[32px] font-bold tracking-[-0.5px] text-[#f9fafb] placeholder-[#374151] outline-none border-none resize-none leading-tight"
        placeholder="Post title..."
        autoFocus
      />

      {/* Slug */}
      <div className="flex items-center gap-0 -mt-2">
        <span className="text-xs text-[#4b5563] opacity-60 select-none">
          /blog/{locale}/
        </span>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          aria-label="Post slug"
          className="flex-1 bg-transparent text-xs text-[#6b7280] placeholder-[#374151] outline-none border-none opacity-60 focus:opacity-100 transition-opacity"
          placeholder="post-slug"
        />
      </div>

      {/* TipTap Editor */}
      <TipTapEditor
        content={contentJson}
        onChange={(json, html) => {
          setContentJson(json)
          setContentHtml(html)
          setIsDirty(true)
        }}
        onImageUpload={handleImageUpload}
        placeholder="Start writing your post... Type / for commands"
      />

      {/* Save button */}
      {saveError && (
        <p className="text-sm text-red-400">{saveError}</p>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? 'Saving…' : 'Save & continue'}
        </button>
      </div>
    </div>
  )
}
