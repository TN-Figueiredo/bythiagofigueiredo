'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { updatePipelineItem, advancePipelineItem, retreatPipelineItem, archivePipelineItem, restorePipelineItem, toggleChecklist, searchBlogPostsAction } from '../actions'
import { getFormatIcon, getPriorityConfig } from '@/lib/pipeline/gem-design'
import { TabContainer } from './detail/tab-container'
import { useSection } from './detail/use-section'
import { SectionToolbar } from './detail/section-toolbar'
import { SaveFooter } from './detail/save-footer'
import { ConflictBanner } from './detail/conflict-banner'
import { SectionContent } from './detail/section-content'
import { EmptySection } from './detail/renderers/empty-section'
import { getSectionKey, type SectionData, type SectionDefinition } from '@/lib/pipeline/sections'
import { type Format, type Language } from '@/lib/pipeline/schemas'
import { computeValidationScore, type ValidationScore } from '@/lib/pipeline/validation'
import { useMediaGallery } from '../../_shared/media/use-media-gallery'
import { MediaGalleryModal } from '../../_shared/media/media-gallery-modal'
import { CROP_PRESETS, type MediaAssetResult } from '../../_shared/media/types'
import { trackMediaUsageAction } from '../../media/actions'
import { PipelineMediaProvider, type ImageSelectResult } from './detail/editors/pipeline-media-context'
import { ImageIcon, X } from 'lucide-react'
import { PipelineSidebar } from './detail/pipeline-sidebar'
import type { SocialConfig } from '@/lib/social/types'

interface ChecklistItem { label: string; done: boolean; toggled_at: string | null }
interface HistoryEntry { id: string; event_type: string; from_value: string | null; to_value: string | null; changed_at: string }
interface Dependency { dependency_type: string; depends_on_pipeline: { code: string } }

interface ItemData {
  id: string
  code: string
  title_pt: string | null
  title_en: string | null
  format: string
  stage: string
  language: string
  priority: number
  hook: string | null
  synopsis: string | null
  body_content: string | null
  tags: string[]
  production_checklist: ChecklistItem[]
  format_metadata: Record<string, unknown>
  version: number
  is_archived: boolean
  updated_at: string
  validation_score: number
  sections: Record<string, SectionData> | null
  category: string | null
  cover_image_url: string | null
  blog_post_id: string | null
  social_config: Record<string, unknown> | null
  social_post_id: string | null
  site_id: string
  materialized_rev_pt?: number | null
  materialized_rev_en?: number | null
  linked_post?: {
    id: string
    title: string
    status: string
    locales: string[]
  } | null
}

interface Props {
  item: ItemData
  history: HistoryEntry[]
  dependencies: Dependency[]
}

function hasPendingChanges(item: ItemData): boolean {
  if (!item.sections || item.stage !== 'published') return false

  const PT_SECTIONS = ['draft_pt', 'seo_pt'] as const
  const EN_SECTIONS = ['draft_en', 'seo_en', 'images_shared'] as const

  if (item.materialized_rev_pt != null) {
    const maxRevPt = PT_SECTIONS.reduce<number>((max, key) => {
      const sec = item.sections![key] as { rev?: number } | undefined
      return sec?.rev != null ? Math.max(max, sec.rev) : max
    }, -Infinity)
    if (maxRevPt > item.materialized_rev_pt) return true
  }

  if (item.materialized_rev_en != null) {
    const maxRevEn = EN_SECTIONS.reduce<number>((max, key) => {
      const sec = item.sections![key] as { rev?: number } | undefined
      return sec?.rev != null ? Math.max(max, sec.rev) : max
    }, -Infinity)
    if (maxRevEn > item.materialized_rev_en) return true
  }

  return false
}

// ─── ActiveTabSync ─────────────────────────────────────────────────────────────
// Syncs activeTab from the TabContainer render prop back to the parent via useEffect.
function ActiveTabSync({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  useEffect(() => { onTabChange(activeTab) }, [activeTab, onTabChange])
  return null
}

// ─── SectionPanel ──────────────────────────────────────────────────────────────
interface SectionPanelProps {
  sectionDef: SectionDefinition
  activeSub: string | null
  lang: string
  itemId: string
  itemVersion: number
  itemCode: string
  itemTitle: string
  sections: Record<string, SectionData>
  format: string
  stage: string
  tags: string[]
  hook: string | null
  synopsis: string | null
  siteId: string
  vvsScore: number
  blogPostId: string | null
  blogSlug: string | null
  socialPostId: string | null
}

function extractMisplacedSeo(sections: Record<string, SectionData>, lang: string, format: string): SectionData | null {
  const draftKey = getSectionKey('draft', lang, format as Format)
  const draftData = sections[draftKey]
  if (!draftData?.content || typeof draftData.content !== 'object' || Array.isArray(draftData.content)) return null
  const obj = draftData.content as Record<string, unknown>
  if (!obj.seo || typeof obj.seo !== 'object') return null
  return {
    rev: 0,
    source: 'extracted',
    edited: false,
    content: obj.seo as SectionData['content'],
    updated_at: draftData.updated_at,
    cowork_rev: null,
    modified_by: null,
  }
}

function SectionPanel({ sectionDef, activeSub, lang, itemId, itemVersion, itemCode, itemTitle, sections, format, stage, tags, hook, synopsis, siteId, vvsScore, blogPostId, blogSlug, socialPostId }: SectionPanelProps) {
  const sectionType = sectionDef.subSections
    ? (activeSub ?? sectionDef.subSections[0]?.key ?? sectionDef.key)
    : sectionDef.key

  const sectionKey = getSectionKey(sectionType, lang, format as Format)
  const sectionData = (sections[sectionKey] ?? null) as SectionData | null

  const extractedSeo = sectionType === 'seo' && sectionData === null ? extractMisplacedSeo(sections, lang, format) : null
  const effectiveData = sectionData ?? extractedSeo

  const section = useSection({ itemId, sectionKey, initialData: effectiveData, itemVersion })
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (panelRef.current) panelRef.current.dataset.sectionDirty = String(section.isDirty)
  }, [section.isDirty])

  useEffect(() => {
    const handler = () => { void section.save() }
    document.addEventListener('pipeline:save-section', handler)
    return () => document.removeEventListener('pipeline:save-section', handler)
  }, [section.save])

  useEffect(() => {
    const handler = () => section.setIsEditing(!section.isEditing)
    document.addEventListener('pipeline:toggle-edit', handler)
    return () => document.removeEventListener('pipeline:toggle-edit', handler)
  }, [section.isEditing, section.setIsEditing])

  const activeDef = sectionDef.subSections?.find(s => s.key === sectionType) ?? sectionDef
  const isShared = activeDef.shared
  const title = activeDef.label_pt

  return (
    <div
      ref={panelRef}
      className="rounded-lg border overflow-clip"
      style={{ borderColor: 'var(--gem-border)', background: 'var(--gem-surface)' }}
      role="tabpanel"
      id={`panel-${sectionDef.key}`}
      aria-label={title}
    >
      <SectionToolbar
        title={title}
        lang={lang}
        showLang={!isShared}
        itemCode={itemCode}
        sectionKey={sectionKey}
        source={section.source}
        edited={section.edited}
        isEditing={section.isEditing}
        isSaving={section.isSaving}
        isDirty={section.isDirty}
        onToggleEdit={section.setIsEditing}
        onSave={() => { void section.save() }}
      />

      {section.conflict && (
        <ConflictBanner
          onKeepLocal={() => { void section.keepLocal() }}
          onAcceptRemote={section.acceptRemote}
          localContent={section.conflict.localContent}
          remoteContent={section.conflict.remoteData.content}
        />
      )}

      {extractedSeo && section.content != null && (
        <div
          className="mx-4 mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-xs"
          style={{ background: 'color-mix(in srgb, var(--gem-accent) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--gem-accent) 25%, transparent)', color: 'var(--gem-accent)' }}
        >
          Dados extraidos do Rascunho. Salve para criar a secao SEO separada.
        </div>
      )}

      {section.content != null ? (
        <SectionContent
          sectionType={sectionType}
          content={section.content}
          isEditing={section.isEditing}
          lang={lang}
          onContentChange={section.setContent}
          pipelineItemId={itemId}
          siteId={siteId}
          vvsScore={vvsScore}
          format={format}
          stage={stage}
          blogPostId={blogPostId}
          blogSlug={blogSlug}
          socialPostId={socialPostId}
          itemCode={itemCode}
        />
      ) : (
        <EmptySection sectionLabel={title} itemCode={itemCode} sectionKey={sectionKey} />
      )}

      <SaveFooter isDirty={section.isDirty} updatedAt={section.updatedAt ?? undefined} />
    </div>
  )
}

// ─── CoverImageSection ────────────────────────────────────────────────────────
function CoverImageSection({
  coverImageUrl,
  itemTitle,
  onOpenGallery,
  onRemove,
}: {
  coverImageUrl: string | null
  itemTitle: string
  onOpenGallery: () => void
  onRemove: () => void
}) {
  if (coverImageUrl) {
    return (
      <div className="relative group rounded-lg overflow-hidden" style={{ maxHeight: 240 }}>
        <img src={coverImageUrl} alt={itemTitle || 'Cover image'} className="w-full object-cover" style={{ maxHeight: 240 }} />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onOpenGallery}
            className="text-xs text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md transition-colors"
          >
            Trocar
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remover capa"
            className="text-xs text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onOpenGallery}
      className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed py-6 transition-colors hover:border-[var(--gem-accent)] hover:bg-[var(--gem-accent)]/5"
      style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-dim)' }}
    >
      <ImageIcon size={16} />
      <span className="text-xs">Adicionar capa</span>
    </button>
  )
}

// ─── PipelineItemDetail ────────────────────────────────────────────────────────
export function PipelineItemDetail({ item: initialItem, history, dependencies }: Props) {
  const router = useRouter()
  const [item, setItem] = useState(initialItem)
  const [titlePt, setTitlePt] = useState(item.title_pt || '')
  const [hook, setHook] = useState(item.hook || '')
  const [synopsis, setSynopsis] = useState(item.synopsis || '')
  const [focusedField, setFocusedField] = useState<'hook' | 'synopsis' | null>(null)
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const itemRef = useRef(item)
  useEffect(() => { itemRef.current = item }, [item])

  const vvsRef = useRef<ValidationScore>(null!)

  useEffect(() => {
    return () => {
      Object.values(debounceRefs.current).forEach(clearTimeout)
      if (socialConfigDebounceRef.current) clearTimeout(socialConfigDebounceRef.current)
    }
  }, [])

  const formatIcon = getFormatIcon(item.format)
  const priority = getPriorityConfig(item.priority)

  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(item.cover_image_url)
  const coverGallery = useMediaGallery()
  const inlineGallery = useMediaGallery()
  const pendingInlineSelectRef = useRef<((result: ImageSelectResult) => void) | null>(null)

  const [socialConfig, setSocialConfig] = useState<SocialConfig | null>(() => {
    const raw = item.social_config
    if (!raw || typeof raw !== 'object' || typeof (raw as Record<string, unknown>).enabled !== 'boolean') return null
    return raw as unknown as SocialConfig
  })
  const socialConfigDebounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const handleSocialConfigChange = useCallback((config: SocialConfig) => {
    setSocialConfig(config)
    if (socialConfigDebounceRef.current) clearTimeout(socialConfigDebounceRef.current)
    socialConfigDebounceRef.current = setTimeout(async () => {
      const current = itemRef.current
      const result = await updatePipelineItem(current.id, current.version, { social_config: config })
      if (result.ok && result.data) setItem(result.data as typeof item)
      else if (!result.ok) {
        if (result.error.includes('Version conflict')) {
          toast.error('Item atualizado por outro processo. Recarregando...')
          router.refresh()
        } else {
          toast.error('Erro ao salvar config social.')
        }
      }
    }, 800)
  }, [router])

  const handleRequestInlineImage = useCallback((onSelect: (result: ImageSelectResult) => void) => {
    pendingInlineSelectRef.current = onSelect
    inlineGallery.openGallery({ folder: 'blog' })
  }, [inlineGallery])

  const handleInlineImageSelect = useCallback((asset: MediaAssetResult) => {
    if (pendingInlineSelectRef.current) {
      pendingInlineSelectRef.current({ url: asset.url, alt: asset.alt ?? '' })
      pendingInlineSelectRef.current = null
    }
    trackMediaUsageAction(asset.id, 'pipeline_item', itemRef.current.id, 'content_inline').catch(() => {})
  }, [])

  const debouncedSave = useCallback((field: string, value: string) => {
    if (debounceRefs.current[field]) clearTimeout(debounceRefs.current[field])
    debounceRefs.current[field] = setTimeout(async () => {
      const current = itemRef.current
      const result = await updatePipelineItem(current.id, current.version, { [field]: value || null })
      if (result.ok && result.data) setItem(result.data as typeof item)
      else if (!result.ok) {
        if (result.error.includes('Version conflict')) {
          toast.error('Item atualizado por outro processo. Recarregando...')
          router.refresh()
        } else {
          toast.error('Erro ao salvar. Tente novamente.')
        }
      }
    }, 500)
  }, [router])

  const handleCoverSelect = useCallback(async (asset: MediaAssetResult) => {
    setCoverImageUrl(asset.url)
    const current = itemRef.current
    const result = await updatePipelineItem(current.id, current.version, { cover_image_url: asset.url })
    if (result.ok && result.data) setItem(result.data as typeof item)
    else if (!result.ok) {
      setCoverImageUrl(current.cover_image_url)
      if (result.error.includes('Version conflict')) { toast.error('Item atualizado por outro processo. Recarregando...'); router.refresh() }
      else toast.error('Erro ao salvar capa')
    }
    trackMediaUsageAction(asset.id, 'pipeline_item', current.id, 'cover_image').catch(() => {})
  }, [router])

  const handleCoverRemove = useCallback(async () => {
    setCoverImageUrl(null)
    const current = itemRef.current
    const result = await updatePipelineItem(current.id, current.version, { cover_image_url: null })
    if (result.ok && result.data) setItem(result.data as typeof item)
    else if (!result.ok) {
      setCoverImageUrl(current.cover_image_url)
      if (result.error.includes('Version conflict')) { toast.error('Item atualizado por outro processo. Recarregando...'); router.refresh() }
      else toast.error('Erro ao remover capa')
    }
  }, [router])

  const handleCategoryChange = useCallback(async (value: string) => {
    const newCategory = value || null
    const current = itemRef.current
    const result = await updatePipelineItem(current.id, current.version, { category: newCategory })
    if (result.ok && result.data) setItem(result.data as typeof item)
    else if (!result.ok) {
      if (result.error.includes('Version conflict')) { toast.error('Item atualizado por outro processo. Recarregando...'); router.refresh() }
      else toast.error('Erro ao salvar categoria')
    }
  }, [router])

  const handleLanguageChange = useCallback(async (value: string) => {
    const newLang = value as Language
    const current = itemRef.current
    if (current.language === 'both' && newLang !== 'both') {
      const dropping = newLang === 'pt-br' ? 'ingles' : 'portugues'
      if (!window.confirm(`Isso vai marcar o conteudo em ${dropping} como nao necessario. Continuar?`)) return
    }
    const result = await updatePipelineItem(current.id, current.version, { language: newLang })
    if (result.ok && result.data) { setItem(result.data as typeof item); toast.success('Idioma atualizado') }
    else if (!result.ok) {
      if (result.error.includes('Version conflict')) {
        toast.error('Item atualizado por outro processo. Recarregando...')
        router.refresh()
      } else {
        toast.error('Erro ao salvar idioma')
      }
    }
  }, [router])

  const [isAdvancing, setIsAdvancing] = useState(false)
  const [isRetreating, setIsRetreating] = useState(false)
  const [isRepublishing, setIsRepublishing] = useState(false)
  const [showBlogSearch, setShowBlogSearch] = useState(false)
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined)

  const handleBlogSearch = useCallback(async (query: string) => {
    return searchBlogPostsAction(item.site_id, query)
  }, [item.site_id])

  const handleGraduate = useCallback(async (): Promise<{ entity_id?: string }> => {
    const res = await fetch(`/api/pipeline/items/${itemRef.current.id}/graduate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'blog_post' }),
    })
    if (!res.ok) throw new Error('Graduate failed')
    const json = await res.json()
    if (json.data?.entity_id) {
      router.push(`/cms/posts/${json.data.entity_id}`)
    }
    return { entity_id: json.data?.entity_id }
  }, [router])

  const handleAdvance = useCallback(async () => {
    setIsAdvancing(true)
    try {
      const current = itemRef.current
      const result = await advancePipelineItem(current.id, current.version)
      if (result.ok) { toast.success('Avancado!'); router.refresh() }
      else toast.error(result.error)
    } catch {
      toast.error('Erro ao avancar')
    } finally {
      setIsAdvancing(false)
    }
  }, [router])

  const handleRetreat = useCallback(async () => {
    setIsRetreating(true)
    try {
      const current = itemRef.current
      const result = await retreatPipelineItem(current.id, current.version)
      if (result.ok) { toast.success('Recuado'); router.refresh() }
      else toast.error(result.error)
    } catch {
      toast.error('Erro ao recuar')
    } finally {
      setIsRetreating(false)
    }
  }, [router])

  const handleArchive = useCallback(async () => {
    if (!confirm('Arquivar este item?')) return
    try {
      const current = itemRef.current
      const result = await archivePipelineItem(current.id)
      if (result.ok) { toast.success('Arquivado'); router.push(`/cms/pipeline/${current.format}`) }
      else toast.error(result.error)
    } catch {
      toast.error('Erro ao arquivar')
    }
  }, [router])

  const handleRestore = useCallback(async () => {
    try {
      const current = itemRef.current
      const result = await restorePipelineItem(current.id)
      if (result.ok) { toast.success('Restaurado'); router.refresh() }
      else toast.error(result.error)
    } catch {
      toast.error('Erro ao restaurar')
    }
  }, [router])

  const handleRepublish = useCallback(async () => {
    setIsRepublishing(true)
    try {
      const current = itemRef.current
      const { materializeBlogPost } = await import('@/lib/pipeline/materialize-blog-client')
      const result = await materializeBlogPost({
        pipelineItemId: current.id,
        targetStage: 'published',
        scheduledFor: null,
        vvsScore: vvsRef.current.overall,
      })
      if (result.ok) {
        toast.success('Post atualizado no site')
        router.refresh()
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error('Erro ao re-publicar')
    } finally {
      setIsRepublishing(false)
    }
  }, [router])

  const handleToggleChecklist = useCallback(async (index: number, done: boolean) => {
    const current = itemRef.current
    const optimistic = { ...current, production_checklist: current.production_checklist.map((c, i) => i === index ? { ...c, done } : c) }
    setItem(optimistic)
    const result = await toggleChecklist(current.id, index, done)
    if (result.ok && result.data) setItem(result.data as typeof item)
    else setItem(current)
  }, [])

  // Normalise sections to a safe Record
  const sectionsMap = (item.sections ?? {}) as Record<string, SectionData>

  const vvsBreakdown: ValidationScore = useMemo(() => computeValidationScore({
    title_pt: item.title_pt,
    title_en: item.title_en,
    hook: item.hook,
    synopsis: item.synopsis,
    body_content: item.body_content,
    tags: item.tags,
    production_checklist: item.production_checklist,
    format_metadata: item.format_metadata,
    format: item.format as Format,
    sections: item.sections,
    language: item.language,
  }), [item.title_pt, item.title_en, item.hook, item.synopsis, item.body_content, item.tags, item.production_checklist, item.format_metadata, item.format, item.sections, item.language])

  useEffect(() => { vvsRef.current = vvsBreakdown }, [vvsBreakdown])

  return (
    <PipelineMediaProvider onRequestImage={handleRequestInlineImage}>
    <div className="flex flex-col lg:flex-row gap-5" style={{ padding: '20px 24px', maxWidth: 1440, margin: '0 auto' }}>
      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col gap-3.5">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs" style={{ color: 'var(--gem-dim)' }} aria-label="Breadcrumb">
          <Link href="/cms/up-next" className="hover:underline">Up Next</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/cms/pipeline/${item.format}`} className="hover:underline">{formatIcon.label}</Link>
          <span aria-hidden="true">/</span>
          <span style={{ color: 'var(--gem-muted)' }}>{item.code}</span>
        </nav>

        {/* Cover image */}
        <CoverImageSection
          coverImageUrl={coverImageUrl}
          itemTitle={item.title_pt || item.title_en || ''}
          onOpenGallery={() => coverGallery.openGallery({ folder: 'blog', cropPreset: CROP_PRESETS['blog-cover'] })}
          onRemove={handleCoverRemove}
        />

        <input
          type="text"
          value={titlePt}
          onChange={(e) => { setTitlePt(e.target.value); debouncedSave('title_pt', e.target.value) }}
          placeholder="Titulo do conteudo"
          aria-label="Titulo do conteudo"
          className="w-full bg-transparent border border-transparent rounded-lg hover:border-[var(--gem-border)] hover:bg-[var(--gem-surface-hi)] focus:border-[var(--gem-accent)] focus:bg-[var(--gem-well)] focus:shadow-[var(--gem-shadow-focus)] focus:outline-none transition-all duration-150"
          style={{ color: 'var(--gem-text)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', lineHeight: 1.3, padding: '10px 14px' }}
        />

        <div className="relative">
          {hook && (
            <span
              id={`hook-label-${item.id}`}
              className="absolute top-[-7px] left-[22px] z-10 px-1.5 text-[10px] uppercase tracking-[1.2px] font-semibold transition-opacity duration-150"
              style={{ color: priority.accent, background: 'var(--gem-surface)', lineHeight: '14px' }}
            >
              Hook
            </span>
          )}
          <input
            type="text"
            value={hook}
            onChange={(e) => { setHook(e.target.value); debouncedSave('hook', e.target.value) }}
            onFocus={() => setFocusedField('hook')}
            onBlur={() => setFocusedField(null)}
            placeholder="O que prende a audiencia em uma frase?"
            aria-label="Hook do conteudo"
            aria-labelledby={hook ? `hook-label-${item.id}` : undefined}
            className="w-full bg-transparent border border-transparent rounded-r-lg hover:border-[var(--gem-border)] hover:bg-[var(--gem-surface-hi)] focus:border-[var(--gem-accent)] focus:bg-[var(--gem-well)] focus:shadow-[var(--gem-shadow-focus)] focus:outline-none transition-all duration-150"
            style={{
              color: hook ? '#b8c5d6' : undefined,
              fontSize: 15,
              lineHeight: 1.5,
              padding: '10px 14px 10px 16px',
              borderLeft: `3px solid ${hook ? priority.accent : 'var(--gem-faint)'}`,
            }}
          />
          {focusedField === 'hook' && (
            <div
              className="text-right text-[10px] transition-opacity duration-150"
              style={{ color: hook.length >= 240 ? 'var(--gem-warn)' : 'var(--gem-dim)', padding: '3px 14px 0' }}
            >
              {hook.length} / 300
            </div>
          )}
        </div>

        <div className="relative">
          {synopsis && (
            <span
              id={`synopsis-label-${item.id}`}
              className="absolute top-[-7px] left-[22px] z-10 px-1.5 text-[10px] uppercase tracking-[1.2px] font-semibold transition-opacity duration-150"
              style={{ color: 'var(--gem-dim)', background: 'var(--gem-surface)', lineHeight: '14px' }}
            >
              Sinopse
            </span>
          )}
          <textarea
            value={synopsis}
            onChange={(e) => { setSynopsis(e.target.value); debouncedSave('synopsis', e.target.value) }}
            onFocus={() => setFocusedField('synopsis')}
            onBlur={() => setFocusedField(null)}
            placeholder="Sobre o que e esse conteudo? Contexto, tese, estrutura..."
            aria-label="Sinopse"
            aria-labelledby={synopsis ? `synopsis-label-${item.id}` : undefined}
            rows={3}
            className="w-full bg-transparent border border-transparent rounded-r-lg hover:border-[var(--gem-border)] hover:bg-[var(--gem-surface-hi)] focus:border-[var(--gem-accent)] focus:bg-[var(--gem-well)] focus:shadow-[var(--gem-shadow-focus)] focus:outline-none transition-all duration-150 resize-y"
            style={{
              color: 'var(--gem-muted)',
              fontSize: 13,
              lineHeight: 1.6,
              padding: '10px 14px 10px 16px',
              borderLeft: synopsis ? '1px solid var(--gem-faint)' : undefined,
            }}
          />
          {focusedField === 'synopsis' && (
            <div
              className="text-right text-[10px] transition-opacity duration-150"
              style={{ color: 'var(--gem-dim)', padding: '3px 14px 0' }}
            >
              {synopsis.length} / 2000
            </div>
          )}
        </div>

        {/* Tabbed section editor */}
        <TabContainer
          format={item.format as Format}
          stage={item.stage}
          itemId={item.id}
          itemVersion={item.version}
          sections={sectionsMap}
          itemCode={item.code}
          itemTitle={item.title_pt || item.title_en || ''}
          itemLanguage={item.language as 'pt-br' | 'en' | 'both'}
        >
          {({ activeTab: tabActiveTab, activeSub, lang: tabLang, sections, sectionDefs }) => {
            const activeDef = sectionDefs.find(s => s.key === tabActiveTab)
            if (!activeDef) return null
            return (
              <>
                <ActiveTabSync activeTab={tabActiveTab} onTabChange={setActiveTab} />
                {hasPendingChanges(item) && (
                  <div className="flex items-center gap-2 ml-4 mb-2">
                    <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                      Mudancas pendentes
                    </span>
                    <button
                      onClick={handleRepublish}
                      disabled={isRepublishing}
                      className="text-xs font-bold bg-emerald-500 text-white px-3 py-1 rounded hover:bg-emerald-600 transition-colors disabled:opacity-50"
                    >
                      Re-publicar
                    </button>
                  </div>
                )}
                <SectionPanel
                  key={`${tabActiveTab}-${activeSub ?? ''}-${tabLang}`}
                  sectionDef={activeDef}
                  activeSub={activeSub}
                  lang={tabLang}
                  itemId={item.id}
                  itemVersion={item.version}
                  itemCode={item.code}
                  itemTitle={item.title_pt || item.title_en || ''}
                  sections={sections}
                  format={item.format}
                  stage={item.stage}
                  tags={item.tags}
                  hook={item.hook}
                  synopsis={item.synopsis}
                  siteId={item.site_id}
                  vvsScore={vvsBreakdown.overall}
                  blogPostId={item.blog_post_id}
                  blogSlug={typeof item.format_metadata?.slug === 'string' ? item.format_metadata.slug : null}
                  socialPostId={item.social_post_id}
                />
              </>
            )
          }}
        </TabContainer>
      </div>

      {/* Sidebar */}
      <PipelineSidebar
        item={item}
        history={history}
        dependencies={dependencies}
        vvsBreakdown={vvsBreakdown}
        onAdvance={handleAdvance}
        onRetreat={handleRetreat}
        onArchive={handleArchive}
        onRestore={handleRestore}
        onToggleChecklist={handleToggleChecklist}
        onCategoryChange={handleCategoryChange}
        onLanguageChange={handleLanguageChange}
        onSocialConfigChange={handleSocialConfigChange}
        onShowBlogSearch={() => setShowBlogSearch(true)}
        onGraduate={handleGraduate}
        isAdvancing={isAdvancing}
        isRetreating={isRetreating}
        socialConfig={socialConfig}
        showBlogSearch={showBlogSearch}
        onCloseBlogSearch={() => setShowBlogSearch(false)}
        onBlogSearch={handleBlogSearch}
        itemRef={itemRef}
        activeTab={activeTab}
      />

      <MediaGalleryModal
        {...coverGallery.galleryProps}
        onSelect={handleCoverSelect}
        locale="pt-BR"
        siteId={item.site_id}
      />

      <MediaGalleryModal
        {...inlineGallery.galleryProps}
        onSelect={handleInlineImageSelect}
        locale="pt-BR"
        siteId={item.site_id}
      />
    </div>
    </PipelineMediaProvider>
  )
}
