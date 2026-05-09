'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updatePipelineItem, advancePipelineItem, retreatPipelineItem, archivePipelineItem, toggleChecklist } from '../actions'
import { WORKFLOWS } from '@/lib/pipeline/workflows'
import type { Format } from '@/lib/pipeline/schemas'

interface ChecklistItem { label: string; done: boolean; toggled_at: string | null }
interface HistoryEntry { id: string; event_type: string; from_value: string | null; to_value: string | null; changed_at: string }
interface Collection { id: string; code: string; name: string; type: string }

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
  validation_score: { overall: number; breakdown: Record<string, unknown>; computed_at: string } | null
}

interface Props {
  item: ItemData
  collections: Collection[]
  history: HistoryEntry[]
}

export function PipelineItemDetail({ item: initialItem, collections, history }: Props) {
  const router = useRouter()
  const [item, setItem] = useState(initialItem)
  const [titlePt, setTitlePt] = useState(item.title_pt || '')
  const [titleEn, setTitleEn] = useState(item.title_en || '')
  const [hook, setHook] = useState(item.hook || '')
  const [synopsis, setSynopsis] = useState(item.synopsis || '')
  const [bodyContent, setBodyContent] = useState(item.body_content || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stages = WORKFLOWS[item.format as Format] || []
  const currentStage = stages.find((s) => s.stage === item.stage)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const result = await updatePipelineItem(item.id, item.version, {
      title_pt: titlePt || undefined,
      title_en: titleEn || undefined,
      hook: hook || undefined,
      synopsis: synopsis || undefined,
      body_content: bodyContent || undefined,
    })
    if (result.ok && result.data) {
      setItem(result.data)
    } else if (!result.ok) {
      setError(result.error)
    }
    setSaving(false)
  }

  async function handleAdvance() {
    const result = await advancePipelineItem(item.id, item.version)
    if (result.ok) router.refresh()
  }

  async function handleRetreat() {
    const result = await retreatPipelineItem(item.id, item.version)
    if (result.ok) router.refresh()
  }

  async function handleArchive() {
    const result = await archivePipelineItem(item.id)
    if (result.ok) router.push('/cms/pipeline')
  }

  async function handleToggleChecklist(index: number, done: boolean) {
    const result = await toggleChecklist(item.id, index, done)
    if (result.ok && result.data) setItem(result.data)
  }

  return (
    <div className="flex gap-6 p-6">
      <div className="flex-1 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs font-mono text-slate-400">{item.code}</span>
          <span className="px-2 py-0.5 rounded text-xs bg-indigo-900 text-indigo-300">{currentStage?.label_pt || item.stage}</span>
          {item.validation_score && (
            <span className="text-xs text-slate-500">Score: {item.validation_score.overall}%</span>
          )}
        </div>

        <input
          type="text"
          value={titlePt}
          onChange={(e) => setTitlePt(e.target.value)}
          placeholder="Título (PT)"
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-lg font-medium"
        />
        <input
          type="text"
          value={titleEn}
          onChange={(e) => setTitleEn(e.target.value)}
          placeholder="Title (EN)"
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100"
        />
        <input
          type="text"
          value={hook}
          onChange={(e) => setHook(e.target.value)}
          placeholder="Hook"
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm"
        />
        <textarea
          value={synopsis}
          onChange={(e) => setSynopsis(e.target.value)}
          placeholder="Synopsis"
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm resize-y"
        />
        <textarea
          value={bodyContent}
          onChange={(e) => setBodyContent(e.target.value)}
          placeholder="Body / Script content..."
          rows={12}
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm font-mono resize-y"
        />

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={handleAdvance} className="px-4 py-2 rounded-lg bg-green-700 text-white text-sm hover:bg-green-600">Advance</button>
          <button onClick={handleRetreat} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600">Retreat</button>
          <button onClick={handleArchive} className="px-4 py-2 rounded-lg bg-red-900 text-red-300 text-sm hover:bg-red-800">Archive</button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      <div className="w-72 space-y-4">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <h3 className="text-sm font-medium text-slate-200 mb-2">Checklist</h3>
          <div className="space-y-1.5">
            {item.production_checklist.map((c, i) => (
              <label key={i} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={c.done}
                  onChange={(e) => handleToggleChecklist(i, e.target.checked)}
                  className="rounded border-slate-600"
                />
                <span className={`text-sm ${c.done ? 'text-slate-500 line-through' : 'text-slate-300'}`}>{c.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <h3 className="text-sm font-medium text-slate-200 mb-2">Metadata</h3>
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between"><dt className="text-slate-500">Format</dt><dd className="text-slate-300">{item.format}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Language</dt><dd className="text-slate-300">{item.language}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Priority</dt><dd className="text-slate-300">{item.priority}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Version</dt><dd className="text-slate-300">{item.version}</dd></div>
          </dl>
          {item.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.tags.map((tag) => <span key={tag} className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">{tag}</span>)}
            </div>
          )}
        </div>

        {collections.length > 0 && (
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
            <h3 className="text-sm font-medium text-slate-200 mb-2">Collections</h3>
            <ul className="space-y-1">
              {collections.map((c) => <li key={c.id} className="text-xs text-slate-400">{c.name} ({c.type})</li>)}
            </ul>
          </div>
        )}

        {history.length > 0 && (
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
            <h3 className="text-sm font-medium text-slate-200 mb-2">History</h3>
            <ul className="space-y-1">
              {history.slice(0, 10).map((h) => (
                <li key={h.id} className="text-xs text-slate-400">
                  {h.event_type}: {h.from_value || '–'} → {h.to_value || '–'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
