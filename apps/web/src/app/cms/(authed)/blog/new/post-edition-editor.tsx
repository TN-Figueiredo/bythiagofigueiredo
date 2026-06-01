'use client'

import DOMPurify from 'dompurify'
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
  Rocket,
  Clock,
  CheckCircle2,
  Archive,
  CircleDot,
} from 'lucide-react'
import type { Editor } from '@tiptap/core'
import dynamic from 'next/dynamic'

const TipTapEditor = dynamic(
  () => import('../../_shared/editor/tiptap-editor').then(m => ({ default: m.TipTapEditor })),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-lg bg-cms-border" /> }
)
import { useAutosave } from '../../_shared/editor/use-autosave'
import { AutosaveIndicator } from '../../_shared/editor/autosave-indicator'
import { SaveBar } from '../../_shared/editor/save-bar'
import { PublishSaveDialog } from '../../_shared/editor/publish-save-dialog'
import { NavigationGuard } from '../../_shared/editor/navigation-guard'
import { DeleteConfirmModal } from '../../_shared/editor/delete-confirm-modal'
import { MoreMenu } from '../../_shared/editor/more-menu'
import { useMediaGallery } from '../../_shared/media/use-media-gallery'
import { MediaGalleryModal } from '../../_shared/media/media-gallery-modal'
import { CROP_PRESETS, type MediaAssetResult } from '../../_shared/media/types'
import { trackMediaUsageAction } from '../../media/actions'
import { StructuredFields } from '../_shared/structured-fields'
import { HashtagInput } from '../_shared/hashtag-input'
import { SeriesFields } from '../_shared/series-fields'
import { createPost, deleteHubPost, duplicatePost, removeTranslationLocale, movePost, addLocale } from '../actions'
import { createTag } from '../tag-actions'
import { savePost, saveCoverImage, uploadAsset, searchPosts } from '../[id]/edit/actions'
import type { SavePostActionInput } from '../[id]/edit/actions'
import { getValidTargets } from '../_hub/hub-utils'
import { ScheduleModal } from '../_tabs/editorial/schedule-modal'
import { formatTagNameCms } from '../_hub/tag-locale'
import { PipelinePill } from '../[id]/edit/pipeline-pill'
import { LocaleToggle, LOCALE_FLAGS, LOCALE_LABELS } from '../_shared/locale-toggle'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PostEditionEditorProps {
  locale: string
  tagId?: string | null
  defaultLocale: string
  tags: Array<{ id: string; name: string; color: string; nameTranslations?: Record<string, string> | null }>
  supportedLocales: string[]
  siteId: string
  // Edit mode — pass these to open an existing post
  existingPostId?: string
  initialTitle?: string
  initialSlug?: string
  initialExcerpt?: string
  initialContent?: string
  initialContentJson?: Record<string, unknown> | null
  initialContentHtml?: string | null
  initialCoverImageUrl?: string | null
  initialMetaTitle?: string
  initialMetaDescription?: string
  initialOgImageUrl?: string
  initialKeyPoints?: string[]
  initialPullQuote?: string
  initialNotes?: string[]
  initialColophon?: string
  initialPreviousPostId?: string | null
  initialContinuesInNext?: boolean
  initialHashtags?: Array<{ id: string; name: string; slug: string }>
  initialStatus?: string
  existingLocales?: string[]
  componentNames?: string[]
  initialPipelineItem?: { id: string; code: string; title_pt: string | null; title_en: string | null; stage: string; format: string; priority: number } | null
  hasInstagramConnection?: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  idea: { bg: 'rgba(156,163,175,0.15)', text: '#9ca3af' },
  draft: { bg: 'rgba(99,102,241,0.15)', text: '#818cf8' },
  pending_review: { bg: 'rgba(234,179,8,0.15)', text: '#eab308' },
  ready: { bg: 'rgba(6,182,212,0.15)', text: '#06b6d4' },
  scheduled: { bg: 'rgba(139,92,246,0.15)', text: '#8b5cf6' },
  published: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  archived: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' },
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  idea: <CircleDot size={13} />,
  draft: <CircleDot size={13} />,
  ready: <CheckCircle2 size={13} />,
  scheduled: <Clock size={13} />,
  published: <Rocket size={13} />,
  archived: <Archive size={13} />,
}

const MOVE_ACTION_LABELS: Record<string, string> = {
  idea: 'Back to idea',
  draft: 'Back to draft',
  ready: 'Mark ready',
  scheduled: 'Schedule…',
  published: 'Publish now',
  archived: 'Archive',
}

const AUTO_SAVE_STATUSES = new Set(['idea', 'draft'])

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
  onCreateTag,
  defaultLocale,
}: {
  tags: Array<{ id: string; name: string; color: string; nameTranslations?: Record<string, string> | null }>
  selectedTagId: string | null
  onChange: (tagId: string | null) => void
  onCreateTag?: (name: string) => Promise<{ id: string; name: string; color: string; nameTranslations?: Record<string, string> | null } | null>
  defaultLocale?: string
}) {
  const [open, setOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [creating, setCreating] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
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

  async function handleCreateTag() {
    const name = newTagName.trim()
    if (!name || !onCreateTag || creating) return
    setCreating(true)
    const result = await onCreateTag(name)
    setCreating(false)
    if (result) {
      onChange(result.id)
      setNewTagName('')
      setOpen(false)
    }
  }

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
        {selected ? formatTagNameCms({ name: selected.name, nameTranslations: selected.nameTranslations }) : 'No tag'}
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
              {formatTagNameCms({ name: t.name, nameTranslations: t.nameTranslations })}
              {t.id === selectedTagId && <span className="ml-auto text-[#818cf8]">&#10003;</span>}
            </button>
          ))}
          {onCreateTag && (
            <>
              <div className="h-px bg-[#1f2937] my-1" />
              <div className="px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleCreateTag() }
                      e.stopPropagation()
                    }}
                    placeholder={defaultLocale ? `${LOCALE_FLAGS[defaultLocale] ?? ''} ${LOCALE_LABELS[defaultLocale] ?? defaultLocale} name...` : 'New tag...'}
                    disabled={creating}
                    className="flex-1 bg-[#030712] border border-[#374151] rounded-md px-2 py-1 text-[11px] text-[#d1d5db] placeholder-[#4b5563] outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim() || creating}
                    className="rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    {creating ? '...' : '+'}
                  </button>
                </div>
                <p className="text-[9px] text-[#4b5563] mt-1 px-0.5">Add translations in tag settings</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
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
  onRemove,
  onOpenGallery,
  disabled,
}: {
  coverUrl: string | null
  onRemove: () => void
  onOpenGallery: () => void
  disabled: boolean
}) {
  if (coverUrl) {
    return (
      <div className="relative group rounded-lg overflow-hidden">
        <img
          src={coverUrl}
          alt="Cover"
          className="w-full max-h-[400px] object-cover"
        />
        {!disabled && (
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenGallery}
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
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => !disabled && onOpenGallery()}
      className={`w-full rounded-lg border-2 border-dashed transition-colors cursor-pointer flex flex-col items-center justify-center h-36 gap-2 border-[#1f2937] hover:border-[#374151] bg-transparent ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <ImagePlus size={24} className="text-[#4b5563]" />
      <span className="text-xs text-[#6b7280]">Select cover image</span>
    </button>
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
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
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
  siteId,
  existingPostId,
  initialTitle: initTitle,
  initialSlug: initSlug,
  initialExcerpt: initExcerpt,
  initialContent: initContent,
  initialContentJson: initContentJson,
  initialContentHtml: initContentHtml,
  initialCoverImageUrl: initCover,
  initialMetaTitle: initMetaTitle,
  initialMetaDescription: initMetaDesc,
  initialOgImageUrl: initOgImage,
  initialKeyPoints: initKeyPoints,
  initialPullQuote: initPullQuote,
  initialNotes: initNotes,
  initialColophon: initColophon,
  initialPreviousPostId: initPrevPostId,
  initialContinuesInNext: initContinues,
  initialHashtags: initHashtags,
  initialStatus: initStatus,
  existingLocales: initExistingLocales,
  initialPipelineItem,
  hasInstagramConnection,
}: PostEditionEditorProps) {
  const router = useRouter()
  const isEditMode = !!existingPostId

  // ── Ephemeral / isDirty pattern ───────────────────────────────────────────
  const [postId, setPostId] = useState<string | null>(existingPostId ?? null)
  const isEphemeral = postId === null
  const creationPromiseRef = useRef<Promise<string | null> | null>(null)

  // ── Field state ───────────────────────────────────────────────────────────
  const [title, setTitle] = useState(initTitle ?? '')
  const [slug, setSlug] = useState(initSlug ?? '')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [excerpt, setExcerpt] = useState(initExcerpt ?? '')
  const [contentJson, setContentJson] = useState<JSONContent | string | null>(
    (initContentJson as JSONContent) ?? initContentHtml ?? null,
  )
  const [contentHtml, setContentHtml] = useState(initContentHtml ?? initContent ?? '')
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(initCover ?? null)
  const [selectedTagId, setSelectedTagId] = useState<string | null>(initialTagId ?? null)
  const [localTags, setLocalTags] = useState<Array<{ id: string; name: string; color: string; nameTranslations?: Record<string, string> | null }>>([])
  const [metaTitle, setMetaTitle] = useState(initMetaTitle ?? '')
  const [metaDescription, setMetaDescription] = useState(initMetaDesc ?? '')
  const [ogImageUrl, setOgImageUrl] = useState(initOgImage ?? '')
  // Blog overhaul: structured + series + hashtags
  const [keyPoints, setKeyPoints] = useState<string[]>(initKeyPoints ?? [])
  const [pullQuote, setPullQuote] = useState(initPullQuote ?? '')
  const [notes, setNotes] = useState<string[]>(initNotes ?? [])
  const [colophon, setColophon] = useState(initColophon ?? '')
  const [previousPostId, setPreviousPostId] = useState<string | null>(initPrevPostId ?? null)
  const [continuesInNext, setContinuesInNext] = useState(initContinues ?? false)
  const [hashtags, setHashtags] = useState<Array<{ id: string; name: string; slug: string }>>(initHashtags ?? [])

  // ── Status state ──────────────────────────────────────────────────────────
  const [currentStatus, setCurrentStatus] = useState(initStatus ?? 'draft')
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const statusDropdownRef = useRef<HTMLDivElement>(null)

  // ── UI state ──────────────────────────────────────────────────────────────
  const [showPreview, setShowPreview] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // ── Media gallery ────────────────────────────────────────────────────────
  const coverGallery = useMediaGallery()
  const inlineGallery = useMediaGallery()
  const editorInstanceRef = useRef<Editor | null>(null)

  // ── Refs ───────────────────────────────────────────────────────────────────
  const fieldsRef = useRef({
    title, slug, excerpt, contentJson, contentHtml,
    coverImageUrl, metaTitle, metaDescription, ogImageUrl,
    selectedTagId,
    keyPoints, pullQuote, notes, colophon,
    previousPostId, continuesInNext, hashtags,
  })
  fieldsRef.current = {
    title, slug, excerpt, contentJson, contentHtml,
    coverImageUrl, metaTitle, metaDescription, ogImageUrl,
    selectedTagId,
    keyPoints, pullQuote, notes, colophon,
    previousPostId, continuesInNext, hashtags,
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
      // Blog overhaul fields
      content_json: (data.content_json as Record<string, unknown> | null) ?? null,
      content_html: (data.content_html as string) || null,
      key_points: (data.key_points as string[]) ?? [],
      pull_quote: (data.pull_quote as string) || null,
      notes: (data.notes as string[]) ?? [],
      colophon: (data.colophon as string) || null,
      previous_post_id: (data.previous_post_id as string) || null,
      continues_in_next: (data.continues_in_next as boolean) ?? false,
      hashtag_ids: (data.hashtag_ids as string[]) ?? [],
    }
    return savePost(postId, locale, input)
  }, [postId, locale])

  const saveMode = AUTO_SAVE_STATUSES.has(currentStatus)
    ? 'auto' as const
    : currentStatus === 'published' ? 'guarded' as const : 'manual' as const

  const {
    state: saveState,
    lastSavedAt,
    hasUnsavedChanges,
    scheduleSave,
    saveNow: saveImmediate,
    forceSave,
    setHasUnsavedChanges,
    needsConfirmation,
    confirmSave,
    cancelSave,
  } = useAutosave({
    editionId: postId,
    saveFn,
    enabled: !isEphemeral,
    mode: saveMode,
    getPayload: getSavePayload,
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
      // Blog overhaul fields
      content_json: f.contentJson as Record<string, unknown> | null,
      content_html: f.contentHtml || null,
      key_points: f.keyPoints.filter(Boolean),
      pull_quote: f.pullQuote || null,
      notes: f.notes.filter(Boolean),
      colophon: f.colophon || null,
      previous_post_id: f.previousPostId,
      continues_in_next: f.continuesInNext,
      hashtag_ids: f.hashtags.map(h => h.id),
    }
  }

  function scheduleAutosave() {
    scheduleSave(getSavePayload())
  }

  // ── Ephemeral creation ────────────────────────────────────────────────────
  const handleFirstCreate = useCallback(async () => {
    if (!isEphemeral) return
    const created = await ensurePostCreated()
    if (created) {
      router.replace(`/cms/blog/${created}/edit`)
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
      if (saveMode === 'auto') {
        saveImmediate({ ...getSavePayload(), tag_id: tagId || undefined })
      } else {
        scheduleAutosave()
      }
    }
  }

  async function handleCreateTagInline(name: string): Promise<{ id: string; name: string; color: string; nameTranslations?: Record<string, string> | null } | null> {
    const result = await createTag({ name })
    if (!result.ok) {
      toast.error(result.error === 'name_already_exists' ? 'Tag already exists' : 'Failed to create tag')
      return null
    }
    const newTag = { id: result.tagId, name: name.trim(), color: '#6366f1', nameTranslations: null }
    setLocalTags(prev => [...prev, newTag])
    toast.success(`Tag "${name.trim()}" created`)
    return newTag
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
    if (creationPromiseRef.current) return creationPromiseRef.current

    creationPromiseRef.current = (async () => {
      const result = await createPost({
        title: fieldsRef.current.title.trim() || undefined,
        locale,
        tagId: fieldsRef.current.selectedTagId,
        status: 'draft',
      })
      if (!result.ok) {
        toast.error('Failed to create post')
        creationPromiseRef.current = null
        return null
      }
      setPostId(result.postId)
      setHasUnsavedChanges(false)
      return result.postId
    })()

    return creationPromiseRef.current
  }

  // ── Cover image upload ────────────────────────────────────────────────────
  async function handleCoverUpload(file: File) {
    const currentPostId = await ensurePostCreated()
    if (!currentPostId) {
      toast.error('Cannot upload: post creation failed')
      return
    }

    const toastId = toast.loading('Uploading cover image...')
    try {
      const result = await uploadAsset(file, currentPostId)
      setCoverImageUrl(result.url)
      fieldsRef.current.coverImageUrl = result.url
      await saveCoverImage(currentPostId, result.url)
      toast.success('Cover uploaded', { id: toastId })
    } catch {
      toast.error('Upload failed', { id: toastId })
    }
  }

  function handleCoverRemove() {
    setCoverImageUrl(null)
    fieldsRef.current.coverImageUrl = null
    if (postId) {
      saveCoverImage(postId, null)
    }
  }

  function handleCoverFromGallery(asset: MediaAssetResult) {
    setCoverImageUrl(asset.url)
    fieldsRef.current.coverImageUrl = asset.url
    coverGallery.closeGallery()
    if (postId) {
      saveCoverImage(postId, asset.url)
      trackMediaUsageAction(asset.id, 'blog_post', postId, 'cover_image').catch(() => {})
    }
  }

  function handleInlineImageFromGallery(asset: { url: string; alt: string }) {
    const editor = editorInstanceRef.current
    if (editor) {
      editor.chain().focus().setImage({ src: asset.url, alt: asset.alt }).run()
      if (!isEphemeral) {
        if (saveMode === 'auto') {
          saveImmediate(getSavePayload())
        } else {
          scheduleAutosave()
        }
      }
    }
    inlineGallery.closeGallery()
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
  function handleTogglePreview() {
    if (showPreview) {
      setShowPreview(false)
      return
    }
    if (isEphemeral) return
    setPreviewHtml(fieldsRef.current.contentHtml || '')
    setShowPreview(true)
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

  async function handleRemoveLocale() {
    if (!postId) return
    const result = await removeTranslationLocale(postId, locale)
    if (result.ok) {
      toast.success('Locale removed')
      router.push(`/cms/blog/${postId}/edit`)
    } else {
      toast.error(result.error === 'last_locale' ? 'Cannot remove the only locale' : 'Failed to remove locale')
    }
  }

  const allExistingLocales = initExistingLocales ?? [locale]
  const canRemoveLocale = allExistingLocales.length > 1

  // ── Status transitions ───────────────────────────────────────────────────
  const EDITOR_STATUS_TARGETS = new Set(['draft', 'idea', 'ready', 'scheduled', 'published', 'archived'])
  const statusTargets = getValidTargets(currentStatus).filter(s => EDITOR_STATUS_TARGETS.has(s))

  async function handleStatusChange(newStatus: string) {
    if (!postId) return
    setShowStatusDropdown(false)

    if (newStatus === 'scheduled') {
      setShowScheduleModal(true)
      return
    }

    if (hasUnsavedChanges) {
      await forceSave(getSavePayload())
    }

    const result = await movePost(postId, newStatus)
    if (result.ok) {
      setCurrentStatus(newStatus)
      toast.success(newStatus === 'published' ? 'Published!' : `Moved to ${newStatus}`)
      if (newStatus === 'published') {
        router.push('/cms/blog')
      }
    } else {
      toast.error(result.error === 'invalid_transition' ? 'Invalid transition' : `Failed: ${result.error}`)
    }
  }

  async function handleScheduleConfirm(scheduledFor: string) {
    if (!postId) return
    setShowScheduleModal(false)

    if (hasUnsavedChanges) {
      await forceSave(getSavePayload())
    }

    const result = await movePost(postId, 'scheduled', scheduledFor)
    if (result.ok) {
      setCurrentStatus('scheduled')
      toast.success('Scheduled!')
    } else {
      toast.error(`Failed: ${result.error}`)
    }
  }

  useEffect(() => {
    if (!showStatusDropdown) return
    function handleClickOutside(e: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) setShowStatusDropdown(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); setShowStatusDropdown(false) }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showStatusDropdown])

  // ── NavigationGuard save callback ─────────────────────────────────────────
  const handleGuardSave = useCallback(async () => {
    if (postId) {
      await forceSave(getSavePayload())
    }
  }, [postId, forceSave])

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

  const allTags = useMemo(
    () => {
      const ids = new Set(tags.map(t => t.id))
      return [...tags, ...localTags.filter(t => !ids.has(t.id))]
    },
    [tags, localTags],
  )

  const selectedTag = useMemo(
    () => allTags.find((t) => t.id === selectedTagId),
    [allTags, selectedTagId],
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

          <LocaleToggle
            currentLocale={locale}
            existingLocales={initExistingLocales ?? [locale]}
            supportedLocales={supportedLocales}
            isPostPersisted={!!postId}
            isSaving={saveState === 'saving'}
            onSwitchLocale={(toLocale) => {
              router.push(`/cms/blog/${postId}/edit?locale=${toLocale}`)
            }}
            onAddLocale={async (newLocale) => {
              if (!postId) return
              const result = await addLocale(postId, newLocale)
              if (result.ok) {
                toast.success('Locale added')
                router.push(`/cms/blog/${postId}/edit?locale=${newLocale}`)
              } else {
                toast.error(result.error === 'locale_exists' ? 'Locale already exists' : 'Failed to add locale')
              }
            }}
          />

          <TagSelector
            tags={allTags}
            selectedTagId={selectedTagId}
            onChange={handleTagChange}
            onCreateTag={handleCreateTagInline}
            defaultLocale={defaultLocale}
          />

          {/* Status pill */}
          {isEphemeral ? (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-[#374151] text-[#d1d5db] animate-pulse shrink-0">
              new
            </span>
          ) : (
            <div className="relative" ref={statusDropdownRef}>
              <button
                type="button"
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize shrink-0 transition-colors hover:bg-white/10"
                style={{
                  background: STATUS_STYLES[currentStatus]?.bg ?? 'rgba(55,65,81,1)',
                  color: STATUS_STYLES[currentStatus]?.text ?? '#d1d5db',
                }}
              >
                {currentStatus.replace('_', ' ')}
                <ChevronDown size={10} />
              </button>
              {showStatusDropdown && statusTargets.length > 0 && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-[#111827] border border-[#374151] rounded-lg shadow-lg py-1 min-w-44">
                  {statusTargets.map((target) => (
                    <button
                      key={target}
                      type="button"
                      onClick={() => handleStatusChange(target)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition-colors text-left ${target === 'published' ? 'font-medium text-emerald-400' : 'text-[#d1d5db]'}`}
                    >
                      <span style={{ color: STATUS_STYLES[target]?.text ?? '#9ca3af' }}>
                        {STATUS_ICONS[target] ?? <CircleDot size={13} />}
                      </span>
                      {MOVE_ACTION_LABELS[target] ?? target.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isEphemeral && (
            <AutosaveIndicator state={saveState} lastSavedAt={lastSavedAt} mode={saveMode} />
          )}

          {!isEphemeral && postId && (
            <PipelinePill
              postId={postId}
              siteId={siteId}
              initialItem={initialPipelineItem ?? null}
            />
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          {hasInstagramConnection && !isEphemeral && postId && (
            <Link
              href={`/cms/social/stories/new?source=blog&id=${postId}&locale=${locale}`}
              className="rounded-lg bg-gradient-to-r from-[#f09433] to-[#dc2743] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
            >
              Criar Story
            </Link>
          )}
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
              status={currentStatus}
              onDuplicate={handleDuplicate}
              onDelete={() => setShowDeleteModal(true)}
              canRemoveLocale={canRemoveLocale}
              onRemoveLocale={handleRemoveLocale}
            />
          ) : (
            <MoreMenu
              status="draft"
              onDelete={() => router.push('/cms/blog')}
            />
          )}
        </div>
      </div>

      {/* ── Pipeline banner ────────────────────────────────────────────────── */}
      {initialPipelineItem && (
        <div className="shrink-0 px-4 py-2.5 border-b border-indigo-500/20 bg-indigo-500/5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-indigo-300">
              Este post é gerenciado pelo Pipeline
            </p>
            <p className="text-xs text-[#6b7280]">
              Edite no Pipeline para manter o workflow unificado.
            </p>
          </div>
          <a
            href={`/cms/pipeline?item=${initialPipelineItem.id}`}
            className="shrink-0 px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-bold hover:bg-indigo-600 transition-colors"
          >
            Editar no Pipeline →
          </a>
        </div>
      )}

      {/* ── Scrollable content area ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-[780px] mx-auto px-6 pt-7 pb-20">
          {/* Cover image */}
          <CoverImageSection
            coverUrl={coverImageUrl}
            onRemove={handleCoverRemove}
            onOpenGallery={() => coverGallery.openGallery({ folder: 'blog', cropPreset: CROP_PRESETS['blog-cover'] })}
            disabled={!!initialPipelineItem}
          />

          {/* Title */}
          <textarea
            value={title}
            onChange={(e) => {
              if (initialPipelineItem) return
              handleTitleChange(e.target.value)
              autoGrow(e.target)
            }}
            onBlur={handleTitleBlur}
            rows={1}
            aria-label="Post title"
            readOnly={!!initialPipelineItem}
            className={`w-full bg-transparent text-[32px] font-bold tracking-[-0.5px] text-[#f9fafb] placeholder-[#374151] outline-none border-none mt-6 resize-none overflow-hidden leading-tight${initialPipelineItem ? ' opacity-70 cursor-default select-text' : ''}`}
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
              onChange={(e) => { if (!initialPipelineItem) handleSlugChange(e.target.value) }}
              aria-label="Post slug"
              readOnly={!!initialPipelineItem}
              className={`flex-1 bg-transparent text-xs text-[#6b7280] placeholder-[#374151] outline-none border-none opacity-60 transition-opacity${initialPipelineItem ? ' cursor-default' : ' focus:opacity-100'}`}
              placeholder="post-slug"
            />
          </div>

          {/* Excerpt */}
          <textarea
            value={excerpt}
            onChange={(e) => {
              if (initialPipelineItem) return
              handleExcerptChange(e.target.value)
              autoGrow(e.target)
            }}
            rows={1}
            aria-label="Post excerpt"
            readOnly={!!initialPipelineItem}
            className={`w-full bg-transparent text-[15px] italic text-[#9ca3af] placeholder-[#374151] outline-none border-none resize-none overflow-hidden mb-6 leading-relaxed${initialPipelineItem ? ' opacity-70 cursor-default select-text' : ''}`}
            placeholder="Brief excerpt for search results and social previews..."
            ref={(el) => { if (el) autoGrow(el) }}
          />

          {/* TipTap Editor */}
          <div className="mb-6">
            <TipTapEditor
              content={contentJson}
              onChange={handleEditorChange}
              onImageInserted={() => {
                if (!isEphemeral && !initialPipelineItem) {
                  if (saveMode === 'auto') {
                    saveImmediate(getSavePayload())
                  } else {
                    scheduleAutosave()
                  }
                }
              }}
              onImageUpload={initialPipelineItem ? async () => null : handleImageUpload}
              onOpenGallery={initialPipelineItem ? undefined : () => inlineGallery.openGallery({ folder: 'blog', cropPreset: CROP_PRESETS.free })}
              editorInstanceRef={editorInstanceRef}
              editable={!initialPipelineItem}
              placeholder="Start writing your post... Type / for commands"
            />
          </div>

          {/* Structured metadata + series + hashtags */}
          <StructuredFields
            keyPoints={keyPoints}
            onKeyPointsChange={v => { setKeyPoints(v); if (postId) scheduleAutosave() }}
            pullQuote={pullQuote}
            onPullQuoteChange={v => { setPullQuote(v); if (postId) scheduleAutosave() }}
            notes={notes}
            onNotesChange={v => { setNotes(v); if (postId) scheduleAutosave() }}
            colophon={colophon}
            onColophonChange={v => { setColophon(v); if (postId) scheduleAutosave() }}
          />
          <HashtagInput
            siteId={siteId}
            selected={hashtags}
            onChange={v => { setHashtags(v); if (postId) scheduleAutosave() }}
          />
          <SeriesFields
            siteId={siteId}
            locale={locale}
            currentPostId={postId}
            previousPostId={previousPostId}
            onPreviousPostChange={v => { setPreviousPostId(v); if (postId) scheduleAutosave() }}
            continuesInNext={continuesInNext}
            onContinuesChange={v => { setContinuesInNext(v); if (postId) scheduleAutosave() }}
            searchPostsFn={searchPosts}
          />

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
                {formatTagNameCms({ name: selectedTag.name, nameTranslations: selectedTag.nameTranslations })}
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

      <SaveBar
        state={saveState}
        hasUnsavedChanges={hasUnsavedChanges}
        mode={saveMode}
        status={currentStatus}
        onSave={() => saveImmediate(getSavePayload())}
        onRetry={() => saveImmediate(getSavePayload())}
      />

      <PublishSaveDialog
        open={needsConfirmation}
        onConfirm={confirmSave}
        onCancel={cancelSave}
      />

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <DeleteConfirmModal
        open={showDeleteModal}
        title={`Delete "${title || 'Untitled'}"?`}
        description="This cannot be undone."
        impactLevel={contentHtml ? 'medium' : 'low'}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />

      {/* ── Schedule modal ──────────────────────────────────────────────── */}
      <ScheduleModal
        isOpen={showScheduleModal}
        postTitle={title || 'Untitled'}
        siteTimezone="America/Sao_Paulo"
        onConfirm={handleScheduleConfirm}
        onCancel={() => setShowScheduleModal(false)}
      />

      {/* ── Media gallery modals ──────────────────────────────────────────── */}
      <MediaGalleryModal
        {...coverGallery.galleryProps}
        onSelect={handleCoverFromGallery}
        locale={locale as 'en' | 'pt-BR'}
        siteId={siteId}
      />
      <MediaGalleryModal
        {...inlineGallery.galleryProps}
        onSelect={handleInlineImageFromGallery}
        locale={locale as 'en' | 'pt-BR'}
        siteId={siteId}
      />
    </div>
  )
}
