'use client'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { CardComposition } from '@tn-figueiredo/links/qr'
import { createDefaultComposition } from '@tn-figueiredo/links/qr'

export interface QrTemplate {
  id: string
  name: string
  composition: CardComposition
  thumbnailUrl: string | null
  createdAt: string
}

interface TemplateBrowserProps {
  templates: QrTemplate[]
  onLoad: (composition: CardComposition) => void
  onSave: (name: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export function TemplateBrowser({ templates, onLoad, onSave, onDelete, onClose }: TemplateBrowserProps) {
  const [saveName, setSaveName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative rounded-xl shadow-2xl w-[640px] max-h-[80vh] overflow-auto"
        style={{ background: 'var(--bg-side)', border: '1px solid var(--line)' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Templates"
      >
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--line-strong)' }}>
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>Templates</h2>
          <button type="button" onClick={onClose} className="text-[12px] hover:opacity-80" style={{ color: 'var(--ink-dim)' }}>Close</button>
        </div>

        <div className="p-4 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
          <button
            type="button"
            onClick={() => {
              onLoad(createDefaultComposition())
              onClose()
            }}
            className="aspect-square rounded-lg flex flex-col items-center justify-center hover:opacity-80"
            style={{ border: '2px dashed var(--line)', color: 'var(--ink-dim)' }}
          >
            <div className="text-[24px] mb-1">+</div>
            <span className="text-[11px]">Blank Canvas</span>
          </button>

          <div
            className="aspect-square rounded-lg flex flex-col items-center justify-center"
            style={{ border: '2px dashed var(--accent)', color: 'var(--accent)' }}
          >
            {showSaveInput ? (
              <div className="p-2 space-y-2">
                <input
                  type="text"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  placeholder="Template name"
                  className="w-full rounded px-2 py-1 text-[11px]"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => { if (saveName.trim()) { onSave(saveName.trim()); setShowSaveInput(false); setSaveName('') } }}
                  className="w-full py-1 rounded text-[11px]"
                  style={{ background: 'var(--accent)', color: 'var(--ink)' }}
                >
                  Save
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowSaveInput(true)} className="w-full h-full flex flex-col items-center justify-center">
                <Plus size={20} className="mb-1" />
                <span className="text-[11px]">Save Current</span>
              </button>
            )}
          </div>

          {templates.map(tpl => (
            <div key={tpl.id} className="relative group">
              <button
                type="button"
                onClick={() => { onLoad(tpl.composition); onClose() }}
                className="w-full aspect-square rounded-lg overflow-hidden"
                style={{ border: '1px solid var(--line)', background: 'var(--surface-2)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--line)' }}
              >
                {tpl.thumbnailUrl ? (
                  <img src={tpl.thumbnailUrl} alt={tpl.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px]" style={{ color: 'var(--ink-faint)' }}>No preview</div>
                )}
              </button>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[10px] truncate" style={{ color: 'var(--ink-dim)' }}>{tpl.name}</span>
                <button
                  type="button"
                  onClick={() => onDelete(tpl.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5"
                  style={{ color: 'var(--ink-faint)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--red)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--ink-faint)' }}
                  aria-label={`Delete template ${tpl.name}`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
