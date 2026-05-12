'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { updatePipelineItem, advancePipelineItem, retreatPipelineItem, archivePipelineItem, restorePipelineItem, toggleChecklist, searchBlogPostsAction } from '../actions'
import { WORKFLOWS } from '@/lib/pipeline/workflows'
import { getPriorityConfig, getStaleness, getFormatIcon, getLangConfig, getChecklistProgress } from '@/lib/pipeline/gem-design'
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
import { getSectionKey, getSectionsForFormat, flattenSections, type SectionData, type SectionDefinition } from '@/lib/pipeline/sections'
import type { Format } from '@/lib/pipeline/schemas'
import { BlogPostCard } from './detail/blog-post-card'
import { BlogPostSearchDialog } from './detail/blog-post-search-dialog'
import { PromptGeneratorModal } from './prompt-generator-modal'

interface ChecklistItem { label: string; done: boolean; toggled_at: string | null }
interface HistoryEntry { id: string; event_type: string; from_value: string | null; to_value: string | null; changed_at: string }
interface Collection { id: string; code: string; name: string; type: string }
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
  blog_post_id: string | null
  site_id: string
  linked_post?: {
    id: string
    title: string
    status: string
    locales: string[]
  } | null
}

interface Props {
  item: ItemData
  collections: Collection[]
  history: HistoryEntry[]
  dependencies: Dependency[]
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

function SectionPanel({ sectionDef, activeSub, lang, itemId, itemVersion, itemCode, itemTitle, sections, format, stage, tags, hook, synopsis }: SectionPanelProps) {
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
export function PipelineItemDetail({ item: initialItem, collections, history, dependencies }: Props) {
  const router = useRouter()
  const [item, setItem] = useState(initialItem)
  const [titlePt, setTitlePt] = useState(item.title_pt || '')
  const [hook, setHook] = useState(item.hook || '')
  const [synopsis, setSynopsis] = useState(item.synopsis || '')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const stages = WORKFLOWS[item.format as Format] || []
  const currentStage = stages.find((s) => s.stage === item.stage)
  const currentPosition = currentStage?.position ?? 0
  const priority = getPriorityConfig(item.priority)
  const staleness = getStaleness(item.updated_at)
  const formatIcon = getFormatIcon(item.format)
  const lang = getLangConfig(item.language)
  const checklist = getChecklistProgress(item.production_checklist)

  const debouncedSave = useCallback((field: string, value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const result = await updatePipelineItem(item.id, item.version, { [field]: value || null })
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
  }, [item.id, item.version, router])

  const [isAdvancing, setIsAdvancing] = useState(false)
  const [isRetreating, setIsRetreating] = useState(false)
  const [showBlogSearch, setShowBlogSearch] = useState(false)
  const [showPromptModal, setShowPromptModal] = useState(false)
  const [promptSections, setPromptSections] = useState<Array<{ section_type: string; language: string; content: string }>>([])
  const [loadingSections, setLoadingSections] = useState(false)

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
    return { entity_id: json.data?.entity_id }
  }, [item.id])

  async function handleAdvance() {
    setIsAdvancing(true)
    try {
      const result = await advancePipelineItem(item.id, item.version)
      if (result.ok) { toast.success('Stage avançado'); router.refresh() }
      else toast.error(result.error)
    } finally {
      setIsAdvancing(false)
    }
  }

  async function handleRetreat() {
    setIsRetreating(true)
    try {
      const result = await retreatPipelineItem(item.id, item.version)
      if (result.ok) { toast.success('Stage recuado'); router.refresh() }
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

  async function handleOpenPromptGenerator() {
    setLoadingSections(true)
    try {
      const res = await fetch(`/api/pipeline/items/${item.id}/sections`)
      if (!res.ok) throw new Error('Failed to fetch sections')
      const data = await res.json()
      setPromptSections(
        (data.sections ?? []).map((s: { section_type: string; language: string; content: string }) => ({
          section_type: s.section_type,
          language: s.language,
          content: s.content,
        })),
      )
      setShowPromptModal(true)
    } catch {
      toast.error('Erro ao carregar seções')
    } finally {
      setLoadingSections(false)
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

  return (
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

        {/* Title */}
        <input
          type="text"
          value={titlePt}
          onChange={(e) => { setTitlePt(e.target.value); debouncedSave('title_pt', e.target.value) }}
          placeholder="Título (PT)"
          aria-label="Title"
          className="w-full px-3 py-2 rounded-lg text-lg font-semibold bg-transparent border border-transparent hover:border-[var(--gem-border)] focus:border-[var(--gem-accent)] focus:outline-none transition-colors"
          style={{ color: 'var(--gem-text)' }}
        />

        {/* Hook */}
        <input
          type="text"
          value={hook}
          onChange={(e) => { setHook(e.target.value); debouncedSave('hook', e.target.value) }}
          placeholder="Hook — o que prende a audiência"
          aria-label="Hook"
          className="w-full px-3 py-1.5 rounded-lg text-sm bg-transparent border border-transparent hover:border-[var(--gem-border)] focus:border-[var(--gem-accent)] focus:outline-none transition-colors"
          style={{ color: 'var(--gem-muted)', borderLeft: `2px solid ${priority.accent}` }}
        />

        {/* Synopsis */}
        <textarea
          value={synopsis}
          onChange={(e) => { setSynopsis(e.target.value); debouncedSave('synopsis', e.target.value) }}
          placeholder="Synopsis — resumo para orientação"
          aria-label="Synopsis"
          rows={3}
          className="w-full px-3 py-2 rounded-lg text-sm bg-transparent border border-transparent hover:border-[var(--gem-border)] focus:border-[var(--gem-accent)] focus:outline-none transition-colors resize-y"
          style={{ color: 'var(--gem-muted)' }}
        />

        {/* Tabbed section editor */}
        <TabContainer
          format={item.format as Format}
          itemId={item.id}
          itemVersion={item.version}
          sections={sectionsMap}
          itemCode={item.code}
          itemTitle={item.title_pt || item.title_en || ''}
        >
          {({ activeTab, activeSub, lang: tabLang, sections, sectionDefs }) => {
            const activeDef = sectionDefs.find(s => s.key === activeTab)
            if (!activeDef) return null
            return (
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
              />
            )
          }}
        </TabContainer>
      </div>

      {/* Sidebar */}
      <aside
        className="w-68 shrink-0 flex flex-col gap-2.5 sticky top-5 self-start max-h-[calc(100vh-40px)] overflow-y-auto"
        style={{ scrollbarWidth: 'thin' }}
        aria-label="Item details"
      >
        {/* Stage card */}
        <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: priority.accentDim, color: priority.accent }}>
              {currentStage?.label_pt || item.stage}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>há {staleness.days}d</span>
          </div>
          {/* Stage progress dots */}
          <div className="flex gap-1 mb-3" role="progressbar" aria-valuenow={currentPosition} aria-valuemax={stages.length - 1} aria-label="Stage progress">
            {stages.map((s) => (
              <div
                key={s.stage}
                className="h-1.5 flex-1 rounded-sm transition-colors"
                title={s.label_pt}
                style={{
                  backgroundColor: s.position < currentPosition ? 'var(--gem-done)' : s.position === currentPosition ? priority.accent : 'transparent',
                  border: s.position > currentPosition ? '1px dashed var(--gem-border)' : 'none',
                }}
              />
            ))}
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
              {isRetreating ? '⏳ Recuando...' : '← Retreat'}
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
              {isAdvancing ? '⏳ Avançando...' : 'Advance →'}
            </button>
          </div>
          {item.is_archived ? (
            <button onClick={handleRestore} className="w-full mt-2 text-xs py-1.5 rounded border transition-colors hover:bg-emerald-500/10" style={{ borderColor: 'var(--gem-done)', color: 'var(--gem-done)' }}>
              Restore
            </button>
          ) : (
            <button onClick={handleArchive} className="w-full mt-2 text-xs py-1.5 rounded transition-colors hover:bg-red-500/20" style={{ backgroundColor: 'color-mix(in srgb, var(--gem-danger) 10%, transparent)', color: 'var(--gem-danger)' }}>
              Archive
            </button>
          )}
        </div>

        {/* Blog Post card */}
        <BlogPostCard
          itemId={item.id}
          linkedPost={item.linked_post ?? null}
          onGraduate={handleGraduate}
          onShowSearch={() => setShowBlogSearch(true)}
        />

        {/* Blog Post search dialog */}
        <BlogPostSearchDialog
          itemId={item.id}
          siteId={item.site_id}
          open={showBlogSearch}
          onClose={() => setShowBlogSearch(false)}
          onSearch={handleBlogSearch}
        />

        {/* Sections card */}
        <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--gem-text)' }}>Seções</h3>
          <div className="space-y-1">
            {flattenSections(getSectionsForFormat(item.format as Format))
              .filter(s => !s.subSections)
              .map(def => {
                // Check both EN and PT and shared keys for existence
                const keyEn = getSectionKey(def.key, 'en')
                const keyPt = getSectionKey(def.key, 'pt')
                const dataEn = sectionsMap[keyEn]
                const dataPt = sectionsMap[keyPt]
                const data = dataEn ?? dataPt ?? null
                const hasContent = data != null

                return (
                  <div key={def.key} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          background: hasContent ? 'var(--gem-done)' : 'transparent',
                          border: hasContent ? 'none' : '1px solid var(--gem-dim)',
                        }}
                      />
                      <span style={{ color: hasContent ? 'var(--gem-muted)' : 'var(--gem-dim)' }}>{def.label_pt}</span>
                    </span>
                    {data && (
                      <span className="font-mono text-[9px]" style={{ color: 'var(--gem-dim)' }}>rev.{data.rev}</span>
                    )}
                  </div>
                )
              })}
          </div>
        </div>

        {/* Checklist card */}
        <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--gem-text)' }}>Checklist</h3>
          <div className="space-y-1.5">
            {item.production_checklist.map((c, i) => (
              <label key={i} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={c.done}
                  onChange={(e) => { void handleToggleChecklist(i, e.target.checked) }}
                  className="rounded border-slate-600 w-3.5 h-3.5 accent-emerald-500"
                  aria-label={c.label}
                />
                <span className={`text-xs transition-colors ${c.done ? 'line-through' : 'group-hover:text-white/80'}`} style={{ color: c.done ? 'var(--gem-dim)' : 'var(--gem-muted)' }}>
                  {c.label}
                </span>
              </label>
            ))}
          </div>
          {checklist.total > 0 && (
            <>
              <div className="flex gap-0.5 mt-3">
                {checklist.segments.map((done, i) => (
                  <div key={i} className="h-1 flex-1 rounded-sm" style={{ backgroundColor: done ? 'var(--gem-done)' : 'var(--gem-well)', boxShadow: done ? '0 0 4px color-mix(in srgb, var(--gem-done) 30%, transparent)' : 'none' }} />
                ))}
              </div>
              <p className="text-[10px] mt-1" style={{ color: 'var(--gem-dim)' }}>{checklist.done}/{checklist.total}</p>
            </>
          )}
        </div>

        {/* VVS card */}
        <div className="rounded-lg border p-4 flex items-center gap-3" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <GemVvsRing score={item.validation_score} size={48} />
          <div>
            <p className="text-xs font-medium" style={{ color: 'var(--gem-text)' }}>VVS Score</p>
            <p className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>Validation completeness</p>
          </div>
        </div>

        {/* Details card */}
        <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--gem-text)' }}>Details</h3>
          <dl className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <dt style={{ color: 'var(--gem-dim)' }}>Format</dt>
              <dd className="flex items-center gap-1">
                <span>{formatIcon.icon}</span>
                <span style={{ color: 'var(--gem-muted)' }}>{formatIcon.label}</span>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: 'var(--gem-dim)' }}>Language</dt>
              <dd className="flex items-center gap-2">
                <span className={`text-[10px] px-1 py-0.5 rounded ${lang.className}`}>{lang.label}</span>
                {item.language !== 'both' && (
                  <button
                    type="button"
                    onClick={handleOpenPromptGenerator}
                    disabled={loadingSections}
                    className="text-[9px] disabled:opacity-50"
                    style={{ color: 'var(--gem-accent)' }}
                  >
                    {loadingSections ? '...' : `+ ${item.language === 'pt-br' ? 'EN' : 'PT'}`}
                  </button>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: 'var(--gem-dim)' }}>Priority</dt>
              <dd><span className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: priority.accentDim, color: priority.accent }}>{priority.label}</span></dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: 'var(--gem-dim)' }}>Version</dt>
              <dd style={{ color: 'var(--gem-muted)' }}>{item.version}</dd>
            </div>
          </dl>
          {item.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.tags.map((tag) => <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/50 text-cyan-300">{tag}</span>)}
            </div>
          )}
          {collections.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {collections.map((c) => <span key={c.id} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300">{c.name}</span>)}
            </div>
          )}
          {dependencies.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] mb-1" style={{ color: 'var(--gem-dim)' }}>Dependencies:</p>
              <div className="flex flex-wrap gap-1">
                {dependencies.map((d, i) => (
                  <span key={i} className="text-[10px] px-1 py-0.5 rounded bg-red-900/30 text-red-300">{d.depends_on_pipeline.code}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* History card */}
        {history.length > 0 && (
          <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
            <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--gem-text)' }}>Histórico</h3>
            <div className="space-y-2">
              {history.slice(0, 10).map((h) => (
                <div key={h.id} className="flex items-center gap-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--gem-accent)' }} />
                  <span style={{ color: 'var(--gem-muted)' }}>{h.event_type}</span>
                  {h.to_value && <span style={{ color: 'var(--gem-text)' }}>→ {h.to_value}</span>}
                  <span className="ml-auto text-[10px] shrink-0" style={{ color: 'var(--gem-dim)' }}>
                    {new Date(h.changed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
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
          targetLocale={item.language === 'pt-br' ? 'en' : 'pt-br'}
          onClose={() => setShowPromptModal(false)}
        />
      )}
    </div>
  )
}
