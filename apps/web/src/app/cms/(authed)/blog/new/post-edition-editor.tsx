'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import type { JSONContent } from '@tiptap/core'
import {
  ArrowLeft,
  Eye,
  Command,
  ImagePlus,
  X,
  RefreshCw,
  ChevronDown,
  Search,
  Globe,
} from 'lucide-react'
import { TipTapEditor } from '../../_shared/editor/tiptap-editor'
import { useAutosave } from '../../_shared/editor/use-autosave'
import { AutosaveIndicator } from '../../_shared/editor/autosave-indicator'
import { NavigationGuard } from '../../_shared/editor/navigation-guard'
import { DeleteConfirmModal } from '../../_shared/editor/delete-confirm-modal'
import { MoreMenu } from '../../_shared/editor/more-menu'
import { createPost, deleteHubPost, duplicatePost } from '../actions'
import { savePost, compilePreview, uploadAsset } from '../[id]/edit/actions'
import type { SavePostActionInput } from '../[id]/edit/actions'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PostEditionEditorProps {
  locale: string
  tagId?: string | null
  defaultLocale: string
  tags: Array<{ id: string; name: string; color: string }>
  supportedLocales: string[]
}

// ─── Constants ──────────────────────────────────────────────────────────────

const LOCALE_FLAGS: Record<string, string> = {
  'pt-BR': '\u{1F1E7}\u{1F1F7}',
  en: '\u{1F1FA}\u{1F1F8}',
  es: '\u{1F1EA}\u{1F1F8}',
  fr: '\u{1F1EB}\u{1F1F7}',
  de: '\u{1F1E9}\u{1F1EA}',
}

const LOCALE_LABELS: Record<string, string> = {
  'pt-BR': 'PT-BR',
  en: 'EN',
  es: 'ES',
  fr: 'FR',
  de: 'DE',
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

// ─── Tag Selector ───────────────────────────────────────────────────────────

function TagSelector({
  tags,
  selectedTagId,
  onChange,
}: {
  tags: Array<{ id: string; name: string; color: string }>
  selectedTagId: string | null
  onChange: (tagId: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const selected = tags.find((t) => t.id === selectedTagId)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  if (tags.length === 0) return null

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors hover:bg-white/5"
        style={{
          background: selected ? `${selected.color}20` : 'rgba(107,114,128,0.15)',
          color: selected ? selected.color : '#9ca3af',
        }}
      >
        {selected && (
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: selected.color }}
          />
        )}
        {selected?.name ?? 'No tag'}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-[#111827] border border-[#374151] rounded-lg shadow-lg py-1 min-w-44">
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false) }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition-colors text-left ${!selectedTagId ? 'text-white' : 'text-[#9ca3af]'}`}
          >
            No tag
            {!selectedTagId && <span className="ml-auto text-[#818cf8]">&#10003;</span>}
          </button>
          {tags.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { onChange(t.id); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition-colors text-left ${t.id === selectedTagId ? 'text-white' : 'text-[#d1d5db]'}`}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: t.color }}
              />
              {t.name}
              {t.id === selectedTagId && <span className="ml-auto text-[#818cf8]">&#10003;</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Locale Pill ────────────────────────────────────────────────────────────

function LocalePill({ locale }: { locale: string }) {
  const flag = LOCALE_FLAGS[locale] ?? '\u{1F310}'
  const label = LOCALE_LABELS[locale] ?? locale.toUpperCase()
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#1f2937] px-2.5 py-0.5 text-[10px] font-medium text-[#d1d5db]">
      <span className="text-xs">{flag}</span>
      {label}
    </span>
  )
}

// ─── SEO Search Preview ─────────────────────────────────────────────────────

function SeoSearchPreview({
  title,
  excerpt,
  slug,
  locale,
  metaTitle,
  metaDescription,
  ogImageUrl,
  onMetaTitleChange,
  onMetaDescriptionChange,
  onOgImageUrlChange,
}: {
  title: string
  excerpt: string
  slug: string
  locale: string
  metaTitle: string
  metaDescription: string
  ogImageUrl: string
  onMetaTitleChange: (v: string) => void
  onMetaDescriptionChange: (v: string) => void
  onOgImageUrlChange: (v: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const displayTitle = metaTitle || title || 'Post title'
  const displayDescription = metaDescription || excerpt || 'Post excerpt will appear here as the meta description...'
  const displayUrl = `bythiagofigueiredo.com/blog/${locale}/${slug || 'post-slug'}`

  return (
    <div className="rounded-lg border border-[#1f2937] bg-[#0a0f1a] overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-[#6b7280]">
          <Search size={13} />
          Search Preview
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-[#818cf8] hover:text-[#a5b4fc] transition-colors"
        >
          {expanded ? 'Hide overrides' : 'Customize'}
        </button>
      </div>
      {/* SERP card */}
      <div className="px-4 pb-3">
        <div className="rounded-lg bg-[#111827] border border-[#1f2937] p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-5 w-5 rounded-full bg-[#1f2937] flex items-center justify-center">
              <Globe size={10} className="text-[#6b7280]" />
            </div>
            <span className="text-[11px] text-[#9ca3af] truncate">{displayUrl}</span>
          </div>
          <h3 className="text-sm font-medium text-[#8ab4f8] leading-snug line-clamp-2 mb-0.5">
            {displayTitle}
          </h3>
          <p className="text-xs text-[#bdc1c6] leading-relaxed line-clamp-2">
            {displayDescription}
          </p>
        </div>
      </div>
      {/* Override fields */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-[#1f2937] pt-3">
          <div>
            <label className="block text-[10px] font-medium text-[#6b7280] uppercase tracking-wider mb-1">
              Meta Title Override
            </label>
            <input
              type="text"
              value={metaTitle}
              onChange={(e) => onMetaTitleChange(e.target.value)}
              placeholder="Leave empty to use post title"
              className="w-full bg-[#030712] border border-[#1f2937] rounded-md px-3 py-1.5 text-sm text-[#d1d5db] placeholder-[#374151] outline-none focus:border-indigo-500"
            />
            <span className="text-[10px] text-[#4b5563] mt-0.5 block">
              {(metaTitle || title).length}/60 characters
            </span>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[#6b7280] uppercase tracking-wider mb-1">
              Meta Description Override
            </label>
            <textarea
              value={metaDescription}
              onChange={(e) => onMetaDescriptionChange(e.target.value)}
              placeholder="Leave empty to use excerpt"
              rows={2}
              className="w-full bg-[#030712] border border-[#1f2937] rounded-md px-3 py-1.5 text-sm text-[#d1d5db] placeholder-[#374151] outline-none focus:border-indigo-500 resize-none"
            />
            <span className="text-[10px] text-[#4b5563] mt-0.5 block">
              {(metaDescription || excerpt).length}/160 characters
            </span>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[#6b7280] uppercase tracking-wider mb-1">
              OG Image URL
            </label>
            <input
              type="url"
              value={ogImageUrl}
              onChange={(e) => onOgImageUrlChange(e.target.value)}
              placeholder="https://... (leave empty for auto-generated)"
              className="w-full bg-[#030712] border border-[#1f2937] rounded-md px-3 py-1.5 text-sm text-[#d1d5db] placeholder-[#374151] outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Cover Image ────────────────────────────────────────────────────────────

function CoverImageSection({
  coverUrl,
  onUpload,
  onRemove,
  disabled,
}: {
  coverUrl: string | null
  onUpload: (file: File) => void
  onRemove: () => void
  disabled: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    if (disabled) return
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      onUpload(file)
    }
  }

  if (coverUrl) {
    return (
      <div className="relative group rounded-lg overflow-hidden">
        <img
          src={coverUrl}
          alt="Cover"
          className="w-full h-48 object-cover"
        />
        {!disabled && (
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-md bg-white/15 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25 transition-colors"
            >
              <RefreshCw size={13} />
              Replace
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="flex items-center gap-1.5 rounded-md bg-red-500/20 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-[#f87171] hover:bg-red-500/30 transition-colors"
            >
              <X size={13} />
              Remove
            </button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUpload(file)
            e.target.value = ''
          }}
        />
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragOver(true) }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && fileInputRef.current?.click()}
      className={`rounded-lg border-2 border-dashed transition-colors cursor-pointer flex flex-col items-center justify-center h-36 gap-2 ${
        isDragOver
          ? 'border-indigo-500/60 bg-indigo-500/5'
          : 'border-[#1f2937] hover:border-[#374151] bg-transparent'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <ImagePlus size={24} className="text-[#4b5563]" />
      <span className="text-xs text-[#4b5563]">Drop cover image or click to upload</span>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onUpload(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ─── MDX Preview Panel ──────────────────────────────────────────────────────

function MdxPreviewPanel({
  html,
  onClose,
}: {
  html: string
  onClose: () => void
}) {
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#030712]">
      <div className="flex items-center justify-between h-12 px-4 border-b border-[#1f2937] shrink-0">
        <span className="text-sm font-medium text-[#d1d5db]">Preview</span>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-md border border-[#374151] px-3 py-1.5 text-xs font-medium text-[#d1d5db] hover:bg-[#111827] transition-colors"
        >
          Close Preview
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[780px] mx-auto px-6 py-8">
          <div
            className="prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PostEditionEditor({
  locale,
  tagId: initialTagId,
  defaultLocale,
  tags,
  supportedLocales,
}: PostEditionEditorProps) {
  const router = useRouter()

  // ── Ephemeral / isDirty pattern ───────────────────────────────────────────
  const [postId, setPostId] = useState<string | null>(null)
  const isEphemeral = postId === null
  const isCreatingRef = useRef(false)

  // ── Field state ───────────────────────────────────────────────────────────
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [excerpt, setExcerpt] = useState('')
  const [contentJson, setContentJson] = useState<JSONContent | null>(null)
  const [contentHtml, setContentHtml] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [selectedTagId, setSelectedTagId] = useState<string | null>(initialTagId ?? null)
  const [metaTitle, setMetaTitle] = useState('')
  const [metaDescription, setMetaDescription] = useState('')
  const [ogImageUrl, setOgImageUrl] = useState('')

  // ── UI state ──────────────────────────────────────────────────────────────
  const [showPreview, setShowPreview] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // ── Refs ───────────────────────────────────────────────────────────────────
  const fieldsRef = useRef({
    title, slug, excerpt, contentJson, contentHtml,
    coverImageUrl, metaTitle, metaDescription, ogImageUrl,
    selectedTagId,
  })
  fieldsRef.current = {
    title, slug, excerpt, contentJson, contentHtml,
    coverImageUrl, metaTitle, metaDescription, ogImageUrl,
    selectedTagId,
  }

  // ── Autosave ──────────────────────────────────────────────────────────────
  const saveFn = useCallback(async (data: Record<string, unknown>) => {
    if (!postId) return { ok: false, error: 'ephemeral' }
    const input: SavePostActionInput = {
      content_mdx: (data.content_mdx as string) ?? '',
      title: (data.title as string) ?? '',
      slug: (data.slug as string) ?? '',
      excerpt: (data.excerpt as string) || null,
      meta_title: (data.meta_title as string) || null,
      meta_description: (data.meta_description as string) || null,
      og_image_url: (data.og_image_url as string) || null,
      cover_image_url: (data.cover_image_url as string) || null,
      tag_id: (data.tag_id as string) || null,
    }
    return savePost(postId, locale, input)
  }, [postId, locale])

  const {
    state: saveState,
    lastSavedAt,
    hasUnsavedChanges,
    scheduleSave,
    saveNow: saveImmediate,
    setHasUnsavedChanges,
  } = useAutosave({
    editionId: postId,
    saveFn,
    enabled: !isEphemeral,
  })

  // ── Payload builder ───────────────────────────────────────────────────────
  function getSavePayload() {
    const f = fieldsRef.current
    return {
      content_mdx: f.contentHtml || '',
      title: f.title,
      slug: f.slug,
      excerpt: f.excerpt || undefined,
      meta_title: f.metaTitle || undefined,
      meta_description: f.metaDescription || undefined,
      og_image_url: f.ogImageUrl || undefined,
      cover_image_url: f.coverImageUrl || undefined,
      tag_id: f.selectedTagId || undefined,
    }
  }

  function scheduleAutosave() {
    scheduleSave(getSavePayload())
  }

  // ── Ephemeral creation ────────────────────────────────────────────────────
  const handleFirstCreate = useCallback(async () => {
    if (!isEphemeral || isCreatingRef.current) return
    const created = await ensurePostCreated()
    if (!created) {
      toast.error('Failed to create post')
    }
  }, [isEphemeral])

  // ── Title blur triggers creation ──────────────────────────────────────────
  function handleTitleBlur() {
    if (isEphemeral && title.trim().length > 0) {
      fieldsRef.current.title = title
      handleFirstCreate()
    }
  }

  // ── Field handlers ────────────────────────────────────────────────────────
  function handleTitleChange(value: string) {
    setTitle(value)
    if (!slugManuallyEdited) {
      setSlug(slugify(value))
    }
    if (!isEphemeral) {
      fieldsRef.current.title = value
      if (!slugManuallyEdited) fieldsRef.current.slug = slugify(value)
      scheduleAutosave()
    }
  }

  function handleSlugChange(value: string) {
    setSlug(value)
    setSlugManuallyEdited(true)
    if (!isEphemeral) {
      fieldsRef.current.slug = value
      scheduleAutosave()
    }
  }

  function handleExcerptChange(value: string) {
    setExcerpt(value)
    if (!isEphemeral) {
      fieldsRef.current.excerpt = value
      scheduleAutosave()
    }
  }

  function handleEditorChange(json: JSONContent, html: string) {
    setContentJson(json)
    setContentHtml(html)
    if (!isEphemeral) {
      fieldsRef.current.contentJson = json
      fieldsRef.current.contentHtml = html
      scheduleAutosave()
    }
  }

  function handleTagChange(tagId: string | null) {
    setSelectedTagId(tagId)
    fieldsRef.current.selectedTagId = tagId
    if (!isEphemeral && postId) {
      saveImmediate({ ...getSavePayload(), tag_id: tagId || undefined })
    }
  }

  function handleMetaTitleChange(value: string) {
    setMetaTitle(value)
    if (!isEphemeral) {
      fieldsRef.current.metaTitle = value
      scheduleAutosave()
    }
  }

  function handleMetaDescriptionChange(value: string) {
    setMetaDescription(value)
    if (!isEphemeral) {
      fieldsRef.current.metaDescription = value
      scheduleAutosave()
    }
  }

  function handleOgImageUrlChange(value: string) {
    setOgImageUrl(value)
    if (!isEphemeral) {
      fieldsRef.current.ogImageUrl = value
      scheduleAutosave()
    }
  }

  // ── Ensure post exists (shared by cover + inline image upload) ─────────
  async function ensurePostCreated(): Promise<string | null> {
    if (postId) return postId
    if (isCreatingRef.current) return null
    isCreatingRef.current = true
    const result = await createPost({
      title: fieldsRef.current.title.trim() || undefined,
      locale,
      tagId: fieldsRef.current.selectedTagId,
      status: 'draft',
    })
    if (!result.ok) {
      toast.error('Failed to create post')
      isCreatingRef.current = false
      return null
    }
    setPostId(result.postId)
    setHasUnsavedChanges(false)
    router.replace(`/cms/blog/${result.postId}/edit`)
    return result.postId
  }

  // ── Cover image upload ────────────────────────────────────────────────────
  async function handleCoverUpload(file: File) {
    const currentPostId = await ensurePostCreated()
    if (!currentPostId) return

    const toastId = toast.loading('Uploading cover image...')
    try {
      const result = await uploadAsset(file, currentPostId)
      setCoverImageUrl(result.url)
      fieldsRef.current.coverImageUrl = result.url
      toast.success('Cover uploaded', { id: toastId })
      saveImmediate({ ...getSavePayload(), cover_image_url: result.url })
    } catch {
      toast.error('Upload failed', { id: toastId })
    }
  }

  function handleCoverRemove() {
    setCoverImageUrl(null)
    fieldsRef.current.coverImageUrl = null
    if (!isEphemeral) {
      saveImmediate({ ...getSavePayload(), cover_image_url: undefined })
    }
  }

  // ── Image upload for TipTap ───────────────────────────────────────────────
  async function handleImageUpload(file: File): Promise<string | null> {
    const currentPostId = await ensurePostCreated()
    if (!currentPostId) return null

    const toastId = toast.loading('Uploading image...')
    try {
      const result = await uploadAsset(file, currentPostId)
      toast.success('Image uploaded', { id: toastId })
      return result.url
    } catch {
      toast.error('Upload failed', { id: toastId })
      return null
    }
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  async function handleTogglePreview() {
    if (showPreview) {
      setShowPreview(false)
      return
    }
    if (isEphemeral) return
    try {
      const html = fieldsRef.current.contentHtml || ''
      const compiled = await compilePreview(html)
      setPreviewHtml(compiled.compiledSource)
      setShowPreview(true)
    } catch {
      toast.error('Failed to compile preview')
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleDuplicate() {
    if (!postId) return
    const result = await duplicatePost(postId)
    if (result.ok) {
      toast.success('Duplicated')
      router.push(`/cms/blog/${result.newPostId}/edit`)
    } else {
      toast.error('Duplicate failed')
    }
  }

  async function handleDelete() {
    if (!postId) return
    const result = await deleteHubPost(postId)
    if (result.ok) {
      toast.success('Deleted')
      router.push('/cms/blog')
    } else {
      toast.error(`Delete failed: ${result.error}`)
    }
  }

  // ── NavigationGuard save callback ─────────────────────────────────────────
  const handleGuardSave = useCallback(async () => {
    if (postId) {
      saveImmediate(getSavePayload())
    }
  }, [postId, saveImmediate])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (!isEphemeral) {
          saveImmediate(getSavePayload())
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault()
        if (!isEphemeral) {
          handleTogglePreview()
        }
      }
      if (e.key === 'Escape') {
        if (showPreview) {
          setShowPreview(false)
        } else if (isEphemeral) {
          router.push('/cms/blog')
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [saveImmediate, isEphemeral, showPreview, router])

  // ── Derived values ────────────────────────────────────────────────────────
  const wordCount = contentHtml
    ? contentHtml.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length
    : 0
  const readingTimeMin = Math.max(1, Math.ceil(wordCount / 200))

  const selectedTag = useMemo(
    () => tags.find((t) => t.id === selectedTagId),
    [tags, selectedTagId],
  )

  // ── Auto-grow textarea helper ─────────────────────────────────────────────
  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  // ── Preview render ────────────────────────────────────────────────────────
  if (showPreview && postId) {
    return (
      <div className="flex flex-col h-[calc(100vh-64px)] bg-[#030712]">
        <NavigationGuard hasUnsavedChanges={hasUnsavedChanges} onSave={handleGuardSave} />
        <MdxPreviewPanel html={previewHtml} onClose={() => setShowPreview(false)} />
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#030712]">
      <NavigationGuard hasUnsavedChanges={hasUnsavedChanges} onSave={handleGuardSave} />

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between h-12 px-4 border-b border-[#1f2937] bg-[#030712] shrink-0">
        {/* Left side */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/cms/blog"
            onClick={(e) => {
              e.preventDefault()
              router.back()
            }}
            className="flex items-center gap-1.5 text-xs text-[#9ca3af] hover:text-[#d1d5db] transition-colors shrink-0"
          >
            <ArrowLeft size={14} />
            Hub
          </Link>
          <div className="w-px h-5 bg-[#1f2937] shrink-0" />

          <LocalePill locale={locale} />

          <TagSelector
            tags={tags}
            selectedTagId={selectedTagId}
            onChange={handleTagChange}
          />

          {/* Status pill */}
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize shrink-0 ${
              isEphemeral
                ? 'bg-[#374151] text-[#d1d5db] animate-pulse'
                : 'bg-[#374151] text-[#d1d5db]'
            }`}
          >
            {isEphemeral ? 'new' : 'draft'}
          </span>

          {!isEphemeral && (
            <AutosaveIndicator state={saveState} lastSavedAt={lastSavedAt} />
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          {!isEphemeral ? (
            <button
              type="button"
              onClick={handleTogglePreview}
              className="flex items-center gap-1.5 rounded-md border border-[#374151] px-3 py-1.5 text-xs font-medium text-[#d1d5db] hover:bg-[#111827] transition-colors"
            >
              <Eye size={13} />
              Preview
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="flex items-center gap-1.5 rounded-md border border-[#374151] px-3 py-1.5 text-xs font-medium text-[#4b5563] cursor-not-allowed"
            >
              <Eye size={13} />
              Preview
            </button>
          )}

          {/* MoreMenu */}
          {!isEphemeral ? (
            <MoreMenu
              status="draft"
              onDuplicate={handleDuplicate}
              onDelete={() => setShowDeleteModal(true)}
            />
          ) : (
            <MoreMenu
              status="draft"
              onDelete={() => router.push('/cms/blog')}
            />
          )}
        </div>
      </div>

      {/* ── Scrollable content area ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-[780px] mx-auto px-6 pt-7 pb-20">
          {/* Cover image */}
          <CoverImageSection
            coverUrl={coverImageUrl}
            onUpload={handleCoverUpload}
            onRemove={handleCoverRemove}
            disabled={false}
          />

          {/* Title */}
          <textarea
            value={title}
            onChange={(e) => {
              handleTitleChange(e.target.value)
              autoGrow(e.target)
            }}
            onBlur={handleTitleBlur}
            rows={1}
            aria-label="Post title"
            className="w-full bg-transparent text-[32px] font-bold tracking-[-0.5px] text-[#f9fafb] placeholder-[#374151] outline-none border-none mt-6 resize-none overflow-hidden leading-tight"
            placeholder="Post title..."
            autoFocus={isEphemeral}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault()
            }}
            ref={(el) => { if (el) autoGrow(el) }}
          />

          {/* Slug */}
          <div className="flex items-center gap-0 mt-1 mb-4">
            <span className="text-xs text-[#4b5563] opacity-60 select-none">
              /blog/{locale}/
            </span>
            <input
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              aria-label="Post slug"
              className="flex-1 bg-transparent text-xs text-[#6b7280] placeholder-[#374151] outline-none border-none opacity-60 focus:opacity-100 transition-opacity"
              placeholder="post-slug"
            />
          </div>

          {/* Excerpt */}
          <textarea
            value={excerpt}
            onChange={(e) => {
              handleExcerptChange(e.target.value)
              autoGrow(e.target)
            }}
            rows={1}
            aria-label="Post excerpt"
            className="w-full bg-transparent text-[15px] italic text-[#9ca3af] placeholder-[#374151] outline-none border-none resize-none overflow-hidden mb-6 leading-relaxed"
            placeholder="Brief excerpt for search results and social previews..."
            ref={(el) => { if (el) autoGrow(el) }}
          />

          {/* TipTap Editor */}
          <div className="mb-6">
            <TipTapEditor
              content={contentJson}
              onChange={handleEditorChange}
              onImageInserted={() => {
                if (!isEphemeral) saveImmediate(getSavePayload())
              }}
              onImageUpload={handleImageUpload}
              editable
              placeholder="Start writing your post... Type / for commands"
            />
          </div>

          {/* SEO Search Preview */}
          <SeoSearchPreview
            title={title}
            excerpt={excerpt}
            slug={slug}
            locale={locale}
            metaTitle={metaTitle}
            metaDescription={metaDescription}
            ogImageUrl={ogImageUrl}
            onMetaTitleChange={handleMetaTitleChange}
            onMetaDescriptionChange={handleMetaDescriptionChange}
            onOgImageUrlChange={handleOgImageUrlChange}
          />
        </div>
      </div>

      {/* ── Bottom bar ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-[#1f2937] bg-[#030712] px-5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-4 text-[10px] text-[#6b7280]">
          <span className="flex items-center gap-1">
            <span className="text-xs">{LOCALE_FLAGS[locale] ?? '\u{1F310}'}</span>
            {LOCALE_LABELS[locale] ?? locale}
          </span>
          {selectedTag && (
            <>
              <span className="w-px h-3 bg-[#1f2937]" />
              <span className="flex items-center gap-1">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: selectedTag.color }}
                />
                {selectedTag.name}
              </span>
            </>
          )}
          <span className="w-px h-3 bg-[#1f2937]" />
          <span>{readingTimeMin} min read</span>
          <span className="w-px h-3 bg-[#1f2937]" />
          <span>{wordCount.toLocaleString()} word{wordCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-[#4b5563]">
          <span className="flex items-center gap-1">
            <kbd className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded bg-[#1f2937] text-[9px] text-[#6b7280] font-mono">
              <Command size={8} />S
            </kbd>
            Save
          </span>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded bg-[#1f2937] text-[9px] text-[#6b7280] font-mono">
              <Command size={8} /><span className="text-[8px]">&#8679;</span>P
            </kbd>
            Preview
          </span>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded bg-[#1f2937] text-[9px] text-[#6b7280] font-mono">
              Esc
            </kbd>
            Exit
          </span>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <DeleteConfirmModal
        open={showDeleteModal}
        title={`Delete "${title || 'Untitled'}"?`}
        description="This cannot be undone."
        impactLevel={contentHtml ? 'medium' : 'low'}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  )
}
