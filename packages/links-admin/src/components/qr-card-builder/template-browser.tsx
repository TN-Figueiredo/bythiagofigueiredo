'use client'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { CardComposition } from '@tn-figueiredo/links/qr'

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
        className="relative bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-[640px] max-h-[80vh] overflow-auto"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Templates"
      >
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-[14px] font-semibold text-neutral-200">Templates</h2>
          <button type="button" onClick={onClose} className="text-neutral-500 hover:text-white text-[12px]">Close</button>
        </div>

        <div className="p-4 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
          <button
            type="button"
            onClick={() => {
              onLoad({
                version: 1,
                canvas: { width: 1080, height: 1080, aspectRatio: '1:1' },
                background: { type: 'solid', color: '#ffffff' },
                elements: [],
              })
              onClose()
            }}
            className="aspect-square rounded-lg border-2 border-dashed border-neutral-700 flex flex-col items-center justify-center text-neutral-500 hover:border-neutral-500 hover:text-neutral-300"
          >
            <div className="text-[24px] mb-1">+</div>
            <span className="text-[11px]">Blank Canvas</span>
          </button>

          <div className="aspect-square rounded-lg border-2 border-dashed border-blue-800 flex flex-col items-center justify-center text-blue-400 hover:border-blue-600">
            {showSaveInput ? (
              <div className="p-2 space-y-2">
                <input
                  type="text"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  placeholder="Template name"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-[11px] text-neutral-200"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => { if (saveName.trim()) { onSave(saveName.trim()); setShowSaveInput(false); setSaveName('') } }}
                  className="w-full py-1 rounded bg-blue-600 text-[11px] text-white"
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
                className="w-full aspect-square rounded-lg border border-neutral-700 bg-neutral-800 overflow-hidden hover:border-blue-500"
              >
                {tpl.thumbnailUrl ? (
                  <img src={tpl.thumbnailUrl} alt={tpl.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-600 text-[10px]">No preview</div>
                )}
              </button>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[10px] text-neutral-400 truncate">{tpl.name}</span>
                <button
                  type="button"
                  onClick={() => onDelete(tpl.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-600 hover:text-red-400"
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
