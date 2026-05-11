'use client'

import { useState, useCallback } from 'react'

interface CoworkRequestPanelProps {
  isOpen: boolean
  onClose: () => void
  itemId: string
  itemCode: string
  itemTitle: string
  sectionLabel: string
  sectionKey: string
  lang: string
  rev: number
  placeholder: string
}

export function CoworkRequestPanel({ isOpen, onClose, itemId, itemCode, itemTitle, sectionLabel, sectionKey, lang, rev, placeholder }: CoworkRequestPanelProps) {
  const [instructions, setInstructions] = useState('')
  const [copied, setCopied] = useState(false)

  const sectionBase = sectionKey.replace(/_(?:en|pt|shared)$/, '')

  const prompt = instructions.trim()
    ? `Pipeline item: ${itemCode} — "${itemTitle}"
Section: ${sectionLabel} (${sectionKey})
Language: ${lang.toUpperCase()}
Section revision: rev.${rev}

Instructions:
${instructions.trim()}

---
Use the pipeline API to:
1. GET /api/pipeline/items/${itemId}/sections/${sectionBase}?lang=${lang}
2. Apply the instructions above to the current content
3. PATCH /api/pipeline/items/${itemId}/sections/${sectionBase}?lang=${lang} with updated content`
    : ''

  const handleCopy = useCallback(() => {
    if (!prompt) return
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [prompt])

  if (!isOpen) return null

  return (
    <div className="px-4 py-2.5" style={{ background: 'rgba(167,139,250,0.04)', borderTop: '1px solid rgba(167,139,250,0.15)' }}>
      <textarea
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        placeholder={placeholder}
        className="w-full text-xs p-2 rounded-md resize-y font-sans"
        style={{
          background: 'var(--gem-well)',
          border: '1px solid rgba(167,139,250,0.2)',
          color: 'var(--gem-text)',
          minHeight: '60px',
        }}
      />
      {prompt && (
        <pre className="mt-2 p-2 rounded-md text-[10px] overflow-y-auto max-h-20" style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', color: 'var(--gem-dim)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          {prompt}
        </pre>
      )}
      <div className="flex justify-between items-center mt-2">
        <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>Cole no Claude Cowork.</span>
        <div className="flex gap-1.5 items-center">
          {copied && <span className="text-[10px]" style={{ color: 'var(--gem-done)' }}>✓ Copiado!</span>}
          <button onClick={onClose} className="px-2 py-0.5 text-[10px] rounded" style={{ border: '1px solid var(--gem-border)', color: 'var(--gem-muted)' }}>Cancelar</button>
          <button
            onClick={handleCopy}
            disabled={!prompt}
            className="px-2 py-0.5 text-[10px] font-semibold rounded"
            style={{ background: '#a78bfa', border: '1px solid #a78bfa', color: 'white', opacity: prompt ? 1 : 0.3 }}
          >
            Copiar prompt
          </button>
        </div>
      </div>
    </div>
  )
}
