'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { updatePipelineItem, advancePipelineItem, retreatPipelineItem, archivePipelineItem, restorePipelineItem, toggleChecklist, searchBlogPostsAction } from '../actions'
import { WORKFLOWS } from '@/lib/pipeline/workflows'
import { getPriorityConfig, getStaleness, getFormatIcon, getChecklistProgress, getVvsTier } from '@/lib/pipeline/gem-design'
import { GemVvsRing } from './gem-vvs-ring'
import { TabContainer } from './detail/tab-container'
import { useSection } from './detail/use-section'
import { SectionToolbar } from './detail/section-toolbar'
import { SaveFooter } from './detail/save-footer'
import { CoworkRequestPanel } from './detail/cowork-request-panel'
import { ConflictBanner } from './detail/conflict-banner'
import { SectionContent } from './detail/section-content'
import { ContentCiteSelector } from './detail/content-cite-selector'
import { EmptySection } from './detail/renderers/empty-section'
import { getSectionKey, type SectionData, type SectionDefinition } from '@/lib/pipeline/sections'
import { BLOG_CATEGORIES, LANGUAGES, type Format, type Language } from '@/lib/pipeline/schemas'
import { computeValidationScore, VVS_PUBLISH_THRESHOLD, type ValidationScore } from '@/lib/pipeline/validation'
import { BlogPostCard } from './detail/blog-post-card'
import { BlogPostSearchDialog } from './detail/blog-post-search-dialog'
import { PromptGeneratorModal } from './prompt-generator-modal'
import { useMediaGallery } from '../../_shared/media/use-media-gallery'
import { MediaGalleryModal } from '../../_shared/media/media-gallery-modal'
import { CROP_PRESETS, type MediaAssetResult } from '../../_shared/media/types'
import { trackMediaUsageAction } from '../../media/actions'
import { PipelineMediaProvider, type ImageSelectResult } from './detail/editors/pipeline-media-context'
import { ImageIcon, X, ChevronDown } from 'lucide-react'
import { SocialConfigEditor } from './detail/social-config-editor'
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

const HISTORY_EVENT_LABELS: Record<string, string> = {
  stage_change: 'Stage',
  field_update: 'Campo',
  section_save: 'Seção',
  checklist_toggle: 'Checklist',
  status_change: 'Status',
  archive: 'Arquivo',
  restore: 'Restaurado',
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

// ─── ActiveTabObserver ─────────────────────────────────────────────────────────
function ActiveTabObserver({
  activeTab,
  onCollapse,
  manualOverrideRef,
  children,
}: {
  activeTab: string
  onCollapse: (collapsed: boolean) => void
  manualOverrideRef: React.RefObject<boolean>
  children: React.ReactNode
}) {
  useEffect(() => {
    if (manualOverrideRef.current) return
    onCollapse(activeTab === 'draft')
  }, [activeTab, onCollapse, manualOverrideRef])
  return <>{children}</>
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
}

function extractMisplacedSeo(sections: Record<string, SectionData>, lang: string): SectionData | null {
  const draftKey = getSectionKey('draft', lang)
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

function SectionPanel({ sectionDef, activeSub, lang, itemId, itemVersion, itemCode, itemTitle, sections, format, stage, tags, hook, synopsis, siteId, vvsScore }: SectionPanelProps) {
  const sectionType = sectionDef.subSections
    ? (activeSub ?? sectionDef.subSections[0]?.key ?? sectionDef.key)
    : sectionDef.key

  const sectionKey = getSectionKey(sectionType, lang)
  const sectionData = (sections[sectionKey] ?? null) as SectionData | null

  const extractedSeo = sectionType === 'seo' && sectionData === null ? extractMisplacedSeo(sections, lang) : null
  const effectiveData = sectionData ?? extractedSeo

  const section = useSection({ itemId, sectionKey, initialData: effectiveData, itemVersion })
  const [showCowork, setShowCowork] = useState(false)
  const [references, setReferences] = useState<Map<number, string>>(() => new Map())
  const nextIdRef = useRef(1)
  const [insertText, setInsertText] = useState<string | null>(null)
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

  const handleCite = useCallback((text: string) => {
    const id = nextIdRef.current++
    setReferences(prev => {
      const next = new Map(prev)
      next.set(id, text)
      return next
    })
    setInsertText(`[citacao ${id}] `)
    setShowCowork(true)
  }, [])

  const handleSendAndWait = useCallback(() => {
    setReferences(new Map())
    nextIdRef.current = 1
    setShowCowork(false)
    setInsertText(null)
  }, [])

  const handleInsertConsumed = useCallback(() => setInsertText(null), [])

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
        source={section.source}
        edited={section.edited}
        isEditing={section.isEditing}
        isSaving={section.isSaving}
        isDirty={section.isDirty}
        onToggleEdit={section.setIsEditing}
        onSave={() => { void section.save() }}
        onToggleCowork={() => setShowCowork(prev => !prev)}
      />

      <CoworkRequestPanel
        isOpen={showCowork}
        onClose={() => setShowCowork(false)}
        itemId={itemId}
        itemCode={itemCode}
        itemTitle={itemTitle}
        sectionLabel={title}
        sectionKey={sectionKey}
        lang={lang}
        rev={section.rev}
        placeholder={`Instruções para atualizar ${title}...`}
        format={format}
        stage={stage}
        tags={tags}
        hook={hook}
        synopsis={synopsis}
        sectionContent={section.content}
        references={references}
        onSendAndWait={handleSendAndWait}
        insertText={insertText}
        onInsertConsumed={handleInsertConsumed}
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
          className="mx-4 mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-[11px]"
          style={{ background: 'color-mix(in srgb, var(--gem-accent) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--gem-accent) 25%, transparent)', color: 'var(--gem-accent)' }}
        >
          Dados extraídos do Rascunho. Salve para criar a seção SEO separada.
        </div>
      )}

      {section.content != null ? (
        <ContentCiteSelector
          enabled={showCowork && !section.isEditing}
          onCite={handleCite}
        >
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
          />
        </ContentCiteSelector>
      ) : (
        <EmptySection sectionLabel={title} onRequestCowork={() => setShowCowork(true)} />
      )}

      <SaveFooter isDirty={section.isDirty} rev={section.rev} updatedAt={section.updatedAt ?? undefined} />
    </div>
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

  useEffect(() => {
    return () => {
      Object.values(debounceRefs.current).forEach(clearTimeout)
      if (socialConfigDebounceRef.current) clearTimeout(socialConfigDebounceRef.current)
    }
  }, [])

  const stages = WORKFLOWS[item.format as Format] || []
  const currentStage = stages.find((s) => s.stage === item.stage)
  const currentPosition = currentStage?.position ?? 0
  const priority = getPriorityConfig(item.priority)
  const staleness = getStaleness(item.updated_at)
  const formatIcon = getFormatIcon(item.format)
  const checklist = getChecklistProgress(item.production_checklist)

  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(item.cover_image_url)
  const [category, setCategory] = useState<string | null>(item.category)
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
    setCategory(newCategory)
    const current = itemRef.current
    const result = await updatePipelineItem(current.id, current.version, { category: newCategory })
    if (result.ok && result.data) setItem(result.data as typeof item)
    else if (!result.ok) {
      setCategory(current.category)
      if (result.error.includes('Version conflict')) { toast.error('Item atualizado por outro processo. Recarregando...'); router.refresh() }
      else toast.error('Erro ao salvar categoria')
    }
  }, [router])

  const handleLanguageChange = useCallback(async (value: string) => {
    const newLang = value as Language
    const current = itemRef.current
    if (current.language === 'both' && newLang !== 'both') {
      const dropping = newLang === 'pt-br' ? 'inglês' : 'português'
      if (!window.confirm(`Isso vai marcar o conteúdo em ${dropping} como não necessário. Continuar?`)) return
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const manualOverrideRef = useRef(false)
  const [showBlogSearch, setShowBlogSearch] = useState(false)
  const [showPromptModal, setShowPromptModal] = useState(false)
  const [promptTargetLocale, setPromptTargetLocale] = useState<'pt-br' | 'en'>('en')
  const [socialExpanded, setSocialExpanded] = useState(() => item.social_config != null)
  const [historyExpanded, setHistoryExpanded] = useState(false)

  const handleBlogSearch = useCallback(async (query: string) => {
    return searchBlogPostsAction(item.site_id, query)
  }, [item.site_id])

  const handleGraduate = useCallback(async (): Promise<{ entity_id?: string }> => {
    const res = await fetch(`/api/pipeline/items/${item.id}/graduate`, {
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
  }, [item.id, router])

  async function handleAdvance() {
    setIsAdvancing(true)
    try {
      const result = await advancePipelineItem(item.id, item.version)
      if (result.ok) { toast.success('Avançado!'); router.refresh() }
      else toast.error(result.error)
    } finally {
      setIsAdvancing(false)
    }
  }

  async function handleRetreat() {
    setIsRetreating(true)
    try {
      const result = await retreatPipelineItem(item.id, item.version)
      if (result.ok) { toast.success('Recuado'); router.refresh() }
      else toast.error(result.error)
    } finally {
      setIsRetreating(false)
    }
  }

  async function handleArchive() {
    if (!confirm('Arquivar este item?')) return
    const result = await archivePipelineItem(item.id)
    if (result.ok) { toast.success('Arquivado'); router.push(`/cms/pipeline/${item.format}`) }
    else toast.error(result.error)
  }

  async function handleRestore() {
    const result = await restorePipelineItem(item.id)
    if (result.ok) { toast.success('Restaurado'); router.refresh() }
    else toast.error(result.error)
  }

  const promptSections = useMemo(() => {
    const sections = item.sections ?? {}
    return Object.entries(sections).map(([key, sec]) => {
      const parts = key.split('_')
      const suffix = parts.pop() ?? 'pt'
      const sectionType = parts.join('_')
      const language = suffix === 'en' ? 'en' : suffix === 'shared' ? 'shared' : 'pt-br'
      return {
        section_type: sectionType,
        language,
        content: typeof sec.content === 'string' ? sec.content : JSON.stringify(sec.content ?? {}),
      }
    })
  }, [item.sections])

  async function handleRepublish() {
    setIsRepublishing(true)
    try {
      const { materializeBlogPost } = await import('@/lib/pipeline/materialize-blog-client')
      const result = await materializeBlogPost({
        pipelineItemId: item.id,
        targetStage: 'published',
        scheduledFor: null,
        vvsScore: vvsBreakdown.overall,
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
  }

  async function handleToggleChecklist(index: number, done: boolean) {
    const optimistic = { ...item, production_checklist: item.production_checklist.map((c, i) => i === index ? { ...c, done } : c) }
    setItem(optimistic)
    const result = await toggleChecklist(item.id, index, done)
    if (result.ok && result.data) setItem(result.data as typeof item)
    else setItem(item)
  }

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

  const vvsColor = getVvsTier(vvsBreakdown.overall).color

  return (
    <PipelineMediaProvider onRequestImage={handleRequestInlineImage}>
    <div className="flex gap-5" style={{ padding: '20px 24px', maxWidth: 1440, margin: '0 auto' }}>
      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col gap-3.5">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs" style={{ color: 'var(--gem-dim)' }} aria-label="Breadcrumb">
          <Link href="/cms/pipeline" className="hover:underline">Pipeline</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/cms/pipeline/${item.format}`} className="hover:underline">{formatIcon.label}</Link>
          <span aria-hidden="true">/</span>
          <span style={{ color: 'var(--gem-muted)' }}>{item.code}</span>
        </nav>

        {/* Cover image */}
        {coverImageUrl ? (
          <div className="relative group rounded-lg overflow-hidden" style={{ maxHeight: 240 }}>
            <img src={coverImageUrl} alt={item.title_pt || item.title_en || 'Cover image'} className="w-full object-cover" style={{ maxHeight: 240 }} />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => coverGallery.openGallery({ folder: 'blog', cropPreset: CROP_PRESETS['blog-cover'] })}
                className="text-xs text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md transition-colors"
              >
                Trocar
              </button>
              <button
                type="button"
                onClick={handleCoverRemove}
                aria-label="Remover capa"
                className="text-xs text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => coverGallery.openGallery({ folder: 'blog', cropPreset: CROP_PRESETS['blog-cover'] })}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed py-6 transition-colors hover:border-[var(--gem-accent)] hover:bg-[var(--gem-accent)]/5"
            style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-dim)' }}
          >
            <ImageIcon size={16} />
            <span className="text-xs">Adicionar capa</span>
          </button>
        )}

        <input
          type="text"
          value={titlePt}
          onChange={(e) => { setTitlePt(e.target.value); debouncedSave('title_pt', e.target.value) }}
          placeholder="Título do conteúdo"
          aria-label="Título do conteúdo"
          className="w-full bg-transparent border border-transparent rounded-lg hover:border-[var(--gem-border)] hover:bg-[var(--gem-surface-hi)] focus:border-[var(--gem-accent)] focus:bg-[var(--gem-well)] focus:shadow-[0_0_0_2px_rgba(99,102,241,0.12)] focus:outline-none transition-all duration-150"
          style={{ color: 'var(--gem-text)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', lineHeight: 1.3, padding: '10px 14px' }}
        />

        <div className="relative">
          {hook && (
            <span
              id={`hook-label-${item.id}`}
              className="absolute top-[-7px] left-[22px] z-10 px-1.5 text-[9px] uppercase tracking-[1.2px] font-semibold transition-opacity duration-150"
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
            placeholder="O que prende a audiência em uma frase?"
            aria-label="Hook do conteúdo"
            aria-labelledby={hook ? `hook-label-${item.id}` : undefined}
            className="w-full bg-transparent border border-transparent rounded-r-lg hover:border-[var(--gem-border)] hover:bg-[var(--gem-surface-hi)] focus:border-[var(--gem-accent)] focus:bg-[var(--gem-well)] focus:shadow-[0_0_0_2px_rgba(99,102,241,0.12)] focus:outline-none transition-all duration-150"
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
              className="absolute top-[-7px] left-[22px] z-10 px-1.5 text-[9px] uppercase tracking-[1.2px] font-semibold transition-opacity duration-150"
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
            placeholder="Sobre o que é esse conteúdo? Contexto, tese, estrutura..."
            aria-label="Sinopse"
            aria-labelledby={synopsis ? `synopsis-label-${item.id}` : undefined}
            rows={3}
            className="w-full bg-transparent border border-transparent rounded-r-lg hover:border-[var(--gem-border)] hover:bg-[var(--gem-surface-hi)] focus:border-[var(--gem-accent)] focus:bg-[var(--gem-well)] focus:shadow-[0_0_0_2px_rgba(99,102,241,0.12)] focus:outline-none transition-all duration-150 resize-y"
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
          {({ activeTab, activeSub, lang: tabLang, sections, sectionDefs }) => {
            const activeDef = sectionDefs.find(s => s.key === activeTab)
            if (!activeDef) return null
            return (
              <ActiveTabObserver
                activeTab={activeTab}
                onCollapse={setSidebarCollapsed}
                manualOverrideRef={manualOverrideRef}
              >
                {hasPendingChanges(item) && (
                  <div className="flex items-center gap-2 ml-4 mb-2">
                    <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                      Mudanças pendentes
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
                  key={`${activeTab}-${activeSub ?? ''}-${tabLang}`}
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
                />
              </ActiveTabObserver>
            )
          }}
        </TabContainer>
      </div>

      {/* Sidebar */}
      <aside
        className={`shrink-0 flex flex-col gap-2.5 sticky top-5 self-start max-h-[calc(100vh-40px)] overflow-y-auto transition-all duration-200 ease-in-out ${sidebarCollapsed ? 'w-12' : 'w-68'}`}
        style={{ scrollbarWidth: 'thin' }}
        aria-label="Item details"
      >
        {sidebarCollapsed ? (
          <div className="flex flex-col items-center gap-2.5 py-3">
            <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold"
              style={{ borderColor: vvsColor, color: vvsColor }}>
              {vvsBreakdown.overall || '—'}
            </div>
            <button onClick={() => { manualOverrideRef.current = true; setSidebarCollapsed(false) }} title="Expandir painel lateral"
              className="w-7 h-7 rounded-md flex items-center justify-center text-xs hover:opacity-80"
              style={{ background: 'var(--gem-well)', color: 'var(--gem-muted)' }}>
              &raquo;
            </button>
          </div>
        ) : (
        <>{/* Collapse button */}
        <div className="flex justify-end">
          <button onClick={() => { manualOverrideRef.current = true; setSidebarCollapsed(true) }} title="Recolher painel lateral"
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs hover:opacity-80"
            style={{ background: 'var(--gem-well)', color: 'var(--gem-muted)' }}>
            &laquo;
          </button>
        </div>

        {/* ── Group 1: Stage & Metadata ── */}
        <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: priority.accentDim, color: priority.accent }}>
              {currentStage?.label_pt || item.stage}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>{staleness.label}</span>
          </div>
          <div className="flex gap-1 mb-3" role="progressbar" aria-valuemin={0} aria-valuenow={currentPosition} aria-valuemax={stages.length - 1} aria-label="Stage progress">
            {stages.map((s) => {
              const status = s.position < currentPosition ? 'completed' : s.position === currentPosition ? 'active' : 'pending'
              return (
                <div
                  key={s.stage}
                  className="h-1.5 flex-1 rounded-sm transition-colors"
                  title={s.label_pt}
                  aria-label={`${s.label_pt}: ${status === 'completed' ? 'concluído' : status === 'active' ? 'atual' : 'pendente'}`}
                  style={{
                    backgroundColor: status === 'completed' ? 'var(--gem-done)' : status === 'active' ? priority.accent : 'transparent',
                    border: status === 'pending' ? '1px dashed var(--gem-border)' : 'none',
                  }}
                />
              )
            })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRetreat}
              disabled={isRetreating || isAdvancing || currentPosition === 0}
              className="flex-1 text-xs py-1.5 rounded border transition-colors hover:bg-white/5"
              style={{
                borderColor: 'var(--gem-border)',
                color: 'var(--gem-muted)',
                opacity: isRetreating || isAdvancing || currentPosition === 0 ? 0.4 : 1,
                cursor: isRetreating || isAdvancing || currentPosition === 0 ? 'default' : 'pointer',
              }}
            >
              {isRetreating ? '⏳ Recuando...' : '← Recuar'}
            </button>
            <button
              onClick={handleAdvance}
              disabled={isAdvancing || isRetreating}
              className="flex-1 text-xs py-1.5 rounded transition-opacity hover:opacity-80"
              style={{
                backgroundColor: 'var(--gem-done)',
                color: 'white',
                opacity: isAdvancing || isRetreating ? 0.5 : 1,
                cursor: isAdvancing || isRetreating ? 'default' : 'pointer',
              }}
            >
              {isAdvancing ? '⏳ Avançando...' : 'Avançar →'}
            </button>
          </div>
          {item.is_archived ? (
            <button onClick={handleRestore} className="w-full mt-2 text-xs py-1.5 rounded border transition-colors hover:bg-emerald-500/10" style={{ borderColor: 'var(--gem-done)', color: 'var(--gem-done)' }}>
              Restaurar
            </button>
          ) : (
            <button onClick={handleArchive} className="w-full mt-2 text-xs py-1.5 rounded transition-colors hover:bg-red-500/20" style={{ backgroundColor: 'color-mix(in srgb, var(--gem-danger) 10%, transparent)', color: 'var(--gem-danger)' }}>
              Arquivar
            </button>
          )}

          {/* Metadata */}
          <dl className="mt-3 pt-3 space-y-1.5 text-xs" style={{ borderTop: '1px solid var(--gem-border)' }}>
            <div className="flex justify-between">
              <dt style={{ color: 'var(--gem-dim)' }}>Formato</dt>
              <dd className="flex items-center gap-1">
                <span>{formatIcon.icon}</span>
                <span style={{ color: 'var(--gem-muted)' }}>{formatIcon.label}</span>
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt style={{ color: 'var(--gem-dim)' }}>Idioma</dt>
              <dd className="flex items-center gap-1.5">
                <select
                  value={item.language}
                  onChange={(e) => { void handleLanguageChange(e.target.value) }}
                  aria-label="Idioma do conteúdo"
                  className="text-[10px] px-1.5 py-0.5 rounded bg-transparent border cursor-pointer focus:outline-none focus:border-[var(--gem-accent)]"
                  style={{ color: 'var(--gem-muted)', borderColor: 'var(--gem-border)' }}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>{l === 'pt-br' ? 'PT-BR' : l === 'en' ? 'EN' : 'PT+EN'}</option>
                  ))}
                </select>
                {item.language !== 'both' && (
                  <button
                    type="button"
                    onClick={() => {
                      setPromptTargetLocale(item.language === 'pt-br' ? 'en' : 'pt-br')
                      setShowPromptModal(true)
                    }}
                    className="text-[9px]"
                    style={{ color: 'var(--gem-accent)' }}
                    title={`Gerar prompt para ${item.language === 'pt-br' ? 'EN' : 'PT'}`}
                  >
                    + {item.language === 'pt-br' ? 'EN' : 'PT'}
                  </button>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: 'var(--gem-dim)' }}>Prioridade</dt>
              <dd><span className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: priority.accentDim, color: priority.accent }}>{priority.label}</span></dd>
            </div>
            {item.format === 'blog_post' && (
              <div className="flex justify-between items-center">
                <dt style={{ color: 'var(--gem-dim)' }}>Categoria</dt>
                <dd>
                  <select
                    value={category ?? ''}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    aria-label="Categoria do post"
                    className="text-[10px] px-1.5 py-0.5 rounded bg-transparent border cursor-pointer focus:outline-none focus:border-[var(--gem-accent)]"
                    style={{ color: 'var(--gem-muted)', borderColor: 'var(--gem-border)' }}
                  >
                    <option value="">Selecionar</option>
                    {BLOG_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                    ))}
                  </select>
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt style={{ color: 'var(--gem-dim)' }}>Versão</dt>
              <dd style={{ color: 'var(--gem-muted)' }}>{item.version}</dd>
            </div>
          </dl>
          {item.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.tags.map((tag) => <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/50 text-cyan-300">{tag}</span>)}
            </div>
          )}
          {dependencies.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] mb-1" style={{ color: 'var(--gem-dim)' }}>Dependências:</p>
              <div className="flex flex-wrap gap-1">
                {dependencies.map((d, i) => (
                  <span key={i} className="text-[10px] px-1 py-0.5 rounded bg-red-900/30 text-red-300">{d.depends_on_pipeline.code}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Group 2: Readiness (VVS + Checklist) ── */}
        <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <div className="flex items-center gap-3 mb-3">
            <GemVvsRing score={vvsBreakdown.overall} size={44} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium" style={{ color: 'var(--gem-text)' }}>
                Prontidão {vvsBreakdown.overall > 0 ? `${vvsBreakdown.overall}%` : '—'}
              </p>
              <p className="text-[10px]" style={{ color: vvsBreakdown.overall >= VVS_PUBLISH_THRESHOLD ? 'var(--gem-done)' : 'var(--gem-dim)' }}>
                {vvsBreakdown.overall >= VVS_PUBLISH_THRESHOLD ? 'Pronto para publicar' : `Mínimo ${VVS_PUBLISH_THRESHOLD}% para publicar`}
              </p>
            </div>
          </div>
          {/* VVS breakdown grid */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] mb-3">
            {([
              ['Título', vvsBreakdown.breakdown.has_title],
              ['Hook', vvsBreakdown.breakdown.has_hook],
              ['Sinopse', vvsBreakdown.breakdown.has_synopsis],
              ['Conteúdo', vvsBreakdown.breakdown.has_body],
              ['Tags', vvsBreakdown.breakdown.has_tags],
              ['Metadata', vvsBreakdown.breakdown.metadata_complete],
              ...(item.format === 'blog_post' ? [
                ['Slug', vvsBreakdown.breakdown.has_slug ?? false],
                ['Resumo', vvsBreakdown.breakdown.has_excerpt ?? false],
                ['SEO', vvsBreakdown.breakdown.has_seo ?? false],
                ['Capa', vvsBreakdown.breakdown.has_cover ?? false],
              ] : []),
            ] as [string, boolean][]).map(([label, ok]) => (
              <span key={label} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ok ? 'var(--gem-done)' : 'transparent', border: ok ? 'none' : '1px solid var(--gem-dim)' }} />
                <span style={{ color: ok ? 'var(--gem-muted)' : 'var(--gem-dim)' }}>{label}</span>
              </span>
            ))}
          </div>
          {/* Interactive checklist */}
          {item.production_checklist.length > 0 && (
            <div className="space-y-1.5" style={{ borderTop: '1px solid var(--gem-border)', paddingTop: '0.5rem' }}>
              {item.production_checklist.map((c, i) => (
                <label key={i} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={c.done}
                    onChange={(e) => { void handleToggleChecklist(i, e.target.checked) }}
                    className="rounded border-slate-600 w-3.5 h-3.5 accent-emerald-500"
                  />
                  <span className={`text-xs transition-colors ${c.done ? 'line-through' : 'group-hover:text-white/80'}`} style={{ color: c.done ? 'var(--gem-dim)' : 'var(--gem-muted)' }}>
                    {c.label}
                  </span>
                </label>
              ))}
              {checklist.total > 0 && (
                <div className="flex gap-0.5 mt-1">
                  {checklist.segments.map((done, i) => (
                    <div key={i} className="h-1 flex-1 rounded-sm" style={{ backgroundColor: done ? 'var(--gem-done)' : 'var(--gem-well)', boxShadow: done ? '0 0 4px color-mix(in srgb, var(--gem-done) 30%, transparent)' : 'none' }} />
                  ))}
                </div>
              )}
              {checklist.total > 0 && (
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--gem-dim)' }}>{checklist.done}/{checklist.total}</p>
              )}
            </div>
          )}
        </div>

        {/* ── Group 3: Blog Post + Social ── */}
        <BlogPostCard
          itemId={item.id}
          linkedPost={item.linked_post ?? null}
          onGraduate={handleGraduate}
          onShowSearch={() => setShowBlogSearch(true)}
        />
        <BlogPostSearchDialog
          itemId={item.id}
          siteId={item.site_id}
          open={showBlogSearch}
          onClose={() => setShowBlogSearch(false)}
          onSearch={handleBlogSearch}
        />

        {/* Social — collapsible */}
        <div className="rounded-lg border" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <button
            onClick={() => setSocialExpanded(!socialExpanded)}
            className="w-full flex items-center justify-between p-3 text-xs font-medium hover:opacity-80"
            style={{ color: 'var(--gem-text)' }}
            aria-expanded={socialExpanded}
            aria-controls="sidebar-social-content"
          >
            <span className="flex items-center gap-2">
              Social
              {item.social_post_id && (
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--gem-done)' }} />
              )}
            </span>
            <ChevronDown size={14} className={`transition-transform ${socialExpanded ? 'rotate-180' : ''}`} style={{ color: 'var(--gem-dim)' }} />
          </button>
          {socialExpanded && (
            <div id="sidebar-social-content" className="px-3 pb-3">
              {item.social_post_id && (
                <Link
                  href={`/cms/social/${item.social_post_id}`}
                  className="text-[10px] hover:underline block mb-2"
                  style={{ color: 'var(--gem-accent)' }}
                >
                  Ver post social →
                </Link>
              )}
              <SocialConfigEditor
                config={socialConfig}
                onChange={handleSocialConfigChange}
                disabled={!!item.social_post_id}
                contentFormat={item.format}
                autoFillHook={item.hook}
                autoFillTags={item.tags}
              />
            </div>
          )}
        </div>

        {/* ── Group 4: History — collapsible ── */}
        {history.length > 0 && (
          <div className="rounded-lg border" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
            <button
              onClick={() => setHistoryExpanded(!historyExpanded)}
              className="w-full flex items-center justify-between p-3 text-xs font-medium hover:opacity-80"
              style={{ color: 'var(--gem-text)' }}
              aria-expanded={historyExpanded}
              aria-controls="sidebar-history-content"
            >
              <span>Histórico <span className="font-normal" style={{ color: 'var(--gem-dim)' }}>({history.length})</span></span>
              <ChevronDown size={14} className={`transition-transform ${historyExpanded ? 'rotate-180' : ''}`} style={{ color: 'var(--gem-dim)' }} />
            </button>
            {historyExpanded && (
              <div id="sidebar-history-content" className="px-3 pb-3 space-y-2">
                {history.slice(0, 10).map((h) => (
                  <div key={h.id} className="flex items-center gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--gem-accent)' }} />
                    <span style={{ color: 'var(--gem-muted)' }}>{HISTORY_EVENT_LABELS[h.event_type] ?? h.event_type}</span>
                    {h.to_value && <span style={{ color: 'var(--gem-text)' }}>→ {h.to_value}</span>}
                    <span className="ml-auto text-[10px] shrink-0" style={{ color: 'var(--gem-dim)' }}>
                      {new Date(h.changed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                ))}
                {history.length > 10 && (
                  <p className="text-[10px] pt-1" style={{ color: 'var(--gem-dim)' }}>+ {history.length - 10} mais</p>
                )}
              </div>
            )}
          </div>
        )}
        </>)}
      </aside>

      {showPromptModal && (
        <PromptGeneratorModal
          item={{
            id: item.id,
            code: item.code,
            format: item.format,
            stage: item.stage,
            priority: item.priority,
            language: item.language as 'pt-br' | 'en' | 'both',
            title_pt: item.title_pt,
            title_en: item.title_en,
            hook: item.hook ?? null,
            synopsis: item.synopsis ?? null,
          }}
          sections={promptSections}
          targetLocale={promptTargetLocale}
          onClose={() => setShowPromptModal(false)}
        />
      )}

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
