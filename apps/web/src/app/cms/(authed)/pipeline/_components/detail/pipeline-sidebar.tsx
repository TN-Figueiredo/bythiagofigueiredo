'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ChevronDown } from 'lucide-react'
import { GemVvsRing } from '../gem-vvs-ring'
import { BlogPostCard } from './blog-post-card'
import { BlogPostSearchDialog } from './blog-post-search-dialog'
import { SocialConfigEditor } from './social-config-editor'
import { CoworkDeepLink } from '@/components/cms/cowork-deep-link'
import { buildCoworkInstruction } from '@/lib/pipeline/cowork-instructions'
import { getPriorityConfig, getStaleness, getFormatIcon, getVvsTier } from '@/lib/pipeline/gem-design'
import { VVS_PUBLISH_THRESHOLD, type ValidationScore } from '@/lib/pipeline/validation'
import { WORKFLOWS, type WorkflowStage } from '@/lib/pipeline/workflows'
import { BLOG_CATEGORIES, LANGUAGES, type Format, type Language } from '@/lib/pipeline/schemas'
import type { SocialConfig } from '@/lib/social/types'

interface ChecklistItem { label: string; done: boolean; toggled_at: string | null }
interface HistoryEntry { id: string; event_type: string; from_value: string | null; to_value: string | null; changed_at: string }
interface Dependency { dependency_type: string; depends_on_pipeline: { code: string } }
interface BlogSearchResult { id: string; title: string; locale: string; status: string; linked_to_code: string | null }

export interface ItemData {
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
  sections: Record<string, unknown> | null
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

export interface PipelineSidebarProps {
  item: ItemData
  history: HistoryEntry[]
  dependencies: Dependency[]
  vvsBreakdown: ValidationScore
  onAdvance: () => void
  onRetreat: () => void
  onArchive: () => void
  onRestore: () => void
  onToggleChecklist: (index: number, done: boolean) => void
  onCategoryChange: (value: string) => void
  onLanguageChange: (value: string) => void
  onSocialConfigChange: (config: SocialConfig) => void
  onShowBlogSearch: () => void
  onGraduate: () => Promise<{ entity_id?: string }>
  isAdvancing: boolean
  isRetreating: boolean
  socialConfig: SocialConfig | null
  showBlogSearch: boolean
  onCloseBlogSearch: () => void
  onBlogSearch: (query: string) => Promise<BlogSearchResult[]>
  itemRef: React.RefObject<ItemData>
  /** Called when active tab changes to auto-collapse; pass through from parent */
  activeTab?: string
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

function GraduateSocialButton({ itemRef, onSuccess }: { itemRef: React.RefObject<ItemData>; onSuccess: () => void }) {
  const [state, setState] = useState<'idle' | 'creating' | 'done'>('idle')
  return (
    <button
      type="button"
      disabled={state !== 'idle'}
      className="w-full mt-2 px-3 py-1.5 rounded text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ background: 'var(--gem-accent)', color: '#fff' }}
      onClick={async () => {
        if (state !== 'idle') return
        setState('creating')
        try {
          const { graduatePipelineToSocial } = await import('../../actions')
          const current = itemRef.current
          const result = await graduatePipelineToSocial(current.id, current.version)
          if (result.ok) {
            setState('done')
            onSuccess()
          } else {
            toast.error(result.error || 'Erro ao criar post social')
            setState('idle')
          }
        } catch {
          toast.error('Erro inesperado ao criar post social')
          setState('idle')
        }
      }}
    >
      {state === 'creating' ? 'Criando...' : state === 'done' ? 'Criado' : 'Criar Post Social'}
    </button>
  )
}

export function PipelineSidebar({
  item,
  history,
  dependencies,
  vvsBreakdown,
  onAdvance,
  onRetreat,
  onArchive,
  onRestore,
  onToggleChecklist,
  onCategoryChange,
  onLanguageChange,
  onSocialConfigChange,
  onShowBlogSearch,
  onGraduate,
  isAdvancing,
  isRetreating,
  socialConfig,
  showBlogSearch,
  onCloseBlogSearch,
  onBlogSearch,
  itemRef,
  activeTab,
}: PipelineSidebarProps) {
  // ── Local sidebar state ──
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [socialExpanded, setSocialExpanded] = useState(() => item.social_config != null)
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const manualOverrideRef = useRef(false)

  // ── Auto-collapse on draft tab ──
  useEffect(() => {
    if (manualOverrideRef.current) {
      if (activeTab !== 'draft') manualOverrideRef.current = false
      return
    }
    if (activeTab != null) {
      setSidebarCollapsed(activeTab === 'draft')
    }
  }, [activeTab])

  const stages = WORKFLOWS[item.format as Format] || []
  const currentStage = stages.find((s) => s.stage === item.stage)
  const currentPosition = currentStage?.position ?? 0
  const priority = getPriorityConfig(item.priority)
  const staleness = getStaleness(item.updated_at)
  const formatIcon = getFormatIcon(item.format)
  const vvsColor = getVvsTier(vvsBreakdown.overall).color

  return (
    <aside
      className={`shrink-0 flex flex-col gap-2.5 lg:sticky lg:top-5 lg:self-start lg:max-h-[calc(100vh-40px)] overflow-y-auto transition-all duration-200 ease-in-out w-full ${sidebarCollapsed ? 'lg:w-12' : 'lg:w-68'}`}
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
            className="w-7 h-7 rounded-md hidden lg:flex items-center justify-center text-xs hover:opacity-80"
            style={{ background: 'var(--gem-well)', color: 'var(--gem-muted)' }}>
            &raquo;
          </button>
        </div>
      ) : (
      <>
        {/* Sticky stage header */}
        <div className="sticky top-0 z-10 pb-2" style={{ background: 'var(--gem-surface)' }}>
          {/* Collapse button */}
          <div className="hidden lg:flex justify-end mb-2">
            <button onClick={() => { manualOverrideRef.current = true; setSidebarCollapsed(true) }} title="Recolher painel lateral"
              className="w-7 h-7 rounded-md flex items-center justify-center text-xs hover:opacity-80"
              style={{ background: 'var(--gem-well)', color: 'var(--gem-muted)' }}>
              &laquo;
            </button>
          </div>

          <div className="rounded-lg border p-4 pb-3" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
            {/* Stage badge + VVS inline */}
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: priority.accentDim, color: priority.accent }}>
                {currentStage?.label_pt || item.stage}
              </span>
              <div className="flex items-center gap-2">
                <GemVvsRing score={vvsBreakdown.overall} size={28} />
                <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>{staleness.label}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="flex gap-1 mb-3" role="progressbar" aria-valuemin={0} aria-valuenow={currentPosition} aria-valuemax={stages.length - 1} aria-label="Stage progress">
              {stages.map((s) => {
                const status = s.position < currentPosition ? 'completed' : s.position === currentPosition ? 'active' : 'pending'
                return (
                  <div
                    key={s.stage}
                    className="h-1.5 flex-1 rounded-sm transition-colors"
                    title={s.label_pt}
                    aria-label={`${s.label_pt}: ${status === 'completed' ? 'concluido' : status === 'active' ? 'atual' : 'pendente'}`}
                    style={{
                      backgroundColor: status === 'completed' ? 'var(--gem-done)' : status === 'active' ? priority.accent : 'transparent',
                      border: status === 'pending' ? '1px dashed var(--gem-border)' : 'none',
                    }}
                  />
                )
              })}
            </div>

            {/* Advance / Retreat buttons */}
            <div className="flex gap-2">
              <button
                onClick={onRetreat}
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
                onClick={onAdvance}
                disabled={isAdvancing || isRetreating}
                className="flex-1 text-xs py-1.5 rounded transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: 'var(--gem-done)',
                  color: 'white',
                  opacity: isAdvancing || isRetreating ? 0.5 : 1,
                  cursor: isAdvancing || isRetreating ? 'default' : 'pointer',
                }}
              >
                {isAdvancing ? '⏳ Avancando...' : 'Avancar →'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Metadata (collapsible) ── */}
        <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <details>
            <summary className="flex justify-between items-center py-2 text-xs cursor-pointer" style={{ color: 'var(--gem-muted)' }}>
              <span>Detalhes</span>
              <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>
                {formatIcon.label} &middot; {item.language === 'pt-br' ? 'PT' : item.language === 'en' ? 'EN' : 'PT+EN'} &middot; {priority.label}
              </span>
            </summary>
            <dl className="mt-1 space-y-1.5 text-xs">
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
                    onChange={(e) => { void onLanguageChange(e.target.value) }}
                    aria-label="Idioma do conteudo"
                    className="text-[10px] px-1.5 py-0.5 rounded bg-transparent border cursor-pointer focus:outline-none focus:border-[var(--gem-accent)]"
                    style={{ color: 'var(--gem-muted)', borderColor: 'var(--gem-border)' }}
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>{l === 'pt-br' ? 'PT-BR' : l === 'en' ? 'EN' : 'PT+EN'}</option>
                    ))}
                  </select>
                  {item.language !== 'both' && (
                    <CoworkDeepLink
                      instruction={buildCoworkInstruction('pipeline-translate', {
                        code: item.code,
                        locale: item.language === 'pt-br' ? 'en' : 'pt-br',
                      })}
                      variant="inline"
                      label={`+ ${item.language === 'pt-br' ? 'EN' : 'PT'}`}
                    />
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
                      value={item.category ?? ''}
                      onChange={(e) => onCategoryChange(e.target.value)}
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
                <dt style={{ color: 'var(--gem-dim)' }}>Versao</dt>
                <dd style={{ color: 'var(--gem-muted)' }}>{item.version}</dd>
              </div>
            </dl>
          </details>
          {item.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.tags.map((tag) => <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/50 text-cyan-300">{tag}</span>)}
            </div>
          )}
          {dependencies.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] mb-1" style={{ color: 'var(--gem-dim)' }}>Dependencias:</p>
              <div className="flex flex-wrap gap-1">
                {dependencies.map((d, i) => (
                  <span key={i} className="text-[10px] px-1 py-0.5 rounded bg-red-900/30 text-red-300">{d.depends_on_pipeline.code}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Readiness (VVS + Checklist) ── */}
        <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <div className="flex items-center gap-3 mb-3">
            <GemVvsRing score={vvsBreakdown.overall} size={44} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium" style={{ color: 'var(--gem-text)' }}>
                Prontidao {vvsBreakdown.overall > 0 ? `${vvsBreakdown.overall}%` : '—'}
              </p>
              <p className="text-[10px]" style={{ color: vvsBreakdown.overall >= VVS_PUBLISH_THRESHOLD ? 'var(--gem-done)' : 'var(--gem-dim)' }}>
                {vvsBreakdown.overall >= VVS_PUBLISH_THRESHOLD ? 'Pronto para publicar' : `Minimo ${VVS_PUBLISH_THRESHOLD}% para publicar`}
              </p>
            </div>
          </div>
          {/* VVS breakdown grid */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs mb-3">
            {([
              ['Titulo', vvsBreakdown.breakdown.has_title],
              ['Hook', vvsBreakdown.breakdown.has_hook],
              ['Sinopse', vvsBreakdown.breakdown.has_synopsis],
              ['Conteudo', vvsBreakdown.breakdown.has_body],
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
                    onChange={(e) => { void onToggleChecklist(i, e.target.checked) }}
                    className="rounded border-slate-600 w-3.5 h-3.5 accent-emerald-500"
                  />
                  <span className={`text-xs transition-colors ${c.done ? 'line-through' : 'group-hover:text-white/80'}`} style={{ color: c.done ? 'var(--gem-dim)' : 'var(--gem-muted)' }}>
                    {c.label}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* ── Blog Post + Social ── */}
        <BlogPostCard
          itemId={item.id}
          linkedPost={item.linked_post ?? null}
          onGraduate={onGraduate}
          onShowSearch={onShowBlogSearch}
        />
        <BlogPostSearchDialog
          itemId={item.id}
          siteId={item.site_id}
          open={showBlogSearch}
          onClose={onCloseBlogSearch}
          onSearch={onBlogSearch}
        />

        {/* Social -- collapsible */}
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
              <div className="flex items-center justify-between mb-2">
                {item.social_post_id && (
                  <Link
                    href={`/cms/social/${item.social_post_id}`}
                    className="text-[10px] hover:underline"
                    style={{ color: 'var(--gem-accent)' }}
                  >
                    Ver post social &rarr;
                  </Link>
                )}
                <CoworkDeepLink
                  instruction={buildCoworkInstruction('pipeline-section', { section: 'social_config', code: item.code })}
                  variant="inline"
                  label="Cowork"
                />
              </div>
              <SocialConfigEditor
                config={socialConfig}
                onChange={onSocialConfigChange}
                disabled={!!item.social_post_id}
                contentFormat={item.format}
                autoFillHook={item.hook}
                autoFillTags={item.tags}
              />
              {!item.social_post_id && socialConfig?.enabled && (
                <GraduateSocialButton itemRef={itemRef} onSuccess={() => { /* handled by parent via router.refresh */ }} />
              )}
            </div>
          )}
        </div>

        {/* ── History -- collapsible ── */}
        {history.length > 0 && (
          <div className="rounded-lg border" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
            <button
              onClick={() => setHistoryExpanded(!historyExpanded)}
              className="w-full flex items-center justify-between p-3 text-xs font-medium hover:opacity-80"
              style={{ color: 'var(--gem-text)' }}
              aria-expanded={historyExpanded}
              aria-controls="sidebar-history-content"
            >
              <span>Historico <span className="font-normal" style={{ color: 'var(--gem-dim)' }}>({history.length})</span></span>
              <ChevronDown size={14} className={`transition-transform ${historyExpanded ? 'rotate-180' : ''}`} style={{ color: 'var(--gem-dim)' }} />
            </button>
            {historyExpanded && (
              <div id="sidebar-history-content" className="px-3 pb-3 space-y-2">
                {history.slice(0, 10).map((h) => (
                  <div key={h.id} className="flex items-center gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--gem-accent)' }} />
                    <span style={{ color: 'var(--gem-muted)' }}>{HISTORY_EVENT_LABELS[h.event_type] ?? h.event_type}</span>
                    {h.to_value && <span style={{ color: 'var(--gem-text)' }}>&rarr; {h.to_value}</span>}
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

        {/* ── Danger zone: Archive/Restore (moved to bottom) ── */}
        {item.is_archived ? (
          <button onClick={onRestore} className="w-full text-xs py-1.5 rounded border transition-colors hover:bg-emerald-500/10" style={{ borderColor: 'var(--gem-done)', color: 'var(--gem-done)' }}>
            Restaurar
          </button>
        ) : (
          <button onClick={onArchive} className="w-full text-xs py-1.5 rounded transition-colors hover:bg-red-500/20" style={{ backgroundColor: 'color-mix(in srgb, var(--gem-danger) 10%, transparent)', color: 'var(--gem-danger)' }}>
            Arquivar
          </button>
        )}
      </>
      )}
    </aside>
  )
}
