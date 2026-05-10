'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { updatePipelineItem, advancePipelineItem, retreatPipelineItem, archivePipelineItem, restorePipelineItem, toggleChecklist } from '../actions'
import { WORKFLOWS } from '@/lib/pipeline/workflows'
import { getPriorityConfig, getStaleness, getFormatIcon, getLangConfig, getChecklistProgress } from '@/lib/pipeline/gem-design'
import { GemVvsRing } from './gem-vvs-ring'
import type { Format } from '@/lib/pipeline/schemas'

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
}

interface Props {
  item: ItemData
  collections: Collection[]
  history: HistoryEntry[]
  dependencies: Dependency[]
}

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
      if (result.ok && result.data) setItem(result.data)
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

  async function handleAdvance() {
    const result = await advancePipelineItem(item.id, item.version)
    if (result.ok) { toast.success('Stage avançado'); router.refresh() }
    else toast.error(result.error)
  }

  async function handleRetreat() {
    const result = await retreatPipelineItem(item.id, item.version)
    if (result.ok) { toast.success('Stage recuado'); router.refresh() }
    else toast.error(result.error)
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

  async function handleToggleChecklist(index: number, done: boolean) {
    const result = await toggleChecklist(item.id, index, done)
    if (result.ok && result.data) setItem(result.data)
  }

  return (
    <div className="flex gap-6 p-6">
      {/* Main content */}
      <div className="flex-1 space-y-4 min-w-0">
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

        {/* Body preview */}
        {item.body_content && (
          <div className="rounded-lg border p-4 max-h-64 overflow-y-auto" style={{ backgroundColor: 'var(--gem-well)', borderColor: 'var(--gem-border)' }}>
            <pre className="text-xs whitespace-pre-wrap font-mono" style={{ color: 'var(--gem-muted)' }}>
              {item.body_content.slice(0, 2000)}{item.body_content.length > 2000 && '...'}
            </pre>
          </div>
        )}
        <Link
          href={`/cms/pipeline/items/${item.id}/edit`}
          className="inline-flex text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-white/5"
          style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-muted)' }}
        >
          Editar roteiro
        </Link>

        {/* History timeline */}
        {history.length > 0 && (
          <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--gem-border)' }}>
            <h3 className="text-xs font-medium mb-3" style={{ color: 'var(--gem-text)' }}>Histórico</h3>
            <div className="space-y-2">
              {history.slice(0, 10).map((h) => (
                <div key={h.id} className="flex items-center gap-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--gem-accent)' }} />
                  <span style={{ color: 'var(--gem-muted)' }}>{h.event_type}</span>
                  {h.to_value && <span style={{ color: 'var(--gem-text)' }}>→ {h.to_value}</span>}
                  <span className="ml-auto text-[10px]" style={{ color: 'var(--gem-dim)' }}>
                    {new Date(h.changed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <aside className="w-72 shrink-0 space-y-3" aria-label="Item details">
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
            <button onClick={handleRetreat} className="flex-1 text-xs py-1.5 rounded border transition-colors hover:bg-white/5" style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-muted)' }}>
              ← Retreat
            </button>
            <button onClick={handleAdvance} className="flex-1 text-xs py-1.5 rounded transition-opacity hover:opacity-80" style={{ backgroundColor: 'var(--gem-done)', color: 'white' }}>
              Advance →
            </button>
          </div>
          {item.is_archived ? (
            <button onClick={handleRestore} className="w-full mt-2 text-xs py-1.5 rounded border transition-colors hover:bg-emerald-500/10" style={{ borderColor: 'var(--gem-done)', color: 'var(--gem-done)' }}>
              Restore
            </button>
          ) : (
            <button onClick={handleArchive} className="w-full mt-2 text-xs py-1.5 rounded transition-colors hover:bg-red-500/20" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
              Archive
            </button>
          )}
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
                  onChange={(e) => handleToggleChecklist(i, e.target.checked)}
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
                  <div key={i} className="h-1 flex-1 rounded-sm" style={{ backgroundColor: done ? 'var(--gem-done)' : 'var(--gem-well)', boxShadow: done ? '0 0 4px rgba(16,185,129,0.3)' : 'none' }} />
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
              <dd><span className={`text-[10px] px-1 py-0.5 rounded ${lang.className}`}>{lang.label}</span></dd>
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
      </aside>
    </div>
  )
}
