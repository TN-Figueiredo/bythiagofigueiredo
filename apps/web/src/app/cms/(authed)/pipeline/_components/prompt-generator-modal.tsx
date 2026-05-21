'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { getFormatIcon } from '@/lib/pipeline/gem-design'
import { useFocusTrap } from './use-focus-trap'
import { generatePrompt } from '@/lib/pipeline/prompt-builders'
import type { PipelineItemForPrompt, SectionForPrompt } from '@/lib/pipeline/prompt-builders'

// ---------------------------------------------------------------------------
// Re-exports — keep so existing test imports don't break
// ---------------------------------------------------------------------------

export { generatePrompt } from '@/lib/pipeline/prompt-builders'
export type {
  PipelineItemForPrompt,
  SectionForPrompt,
  GenerateResult,
} from '@/lib/pipeline/prompt-builders'

// ---------------------------------------------------------------------------
// Component-only types
// ---------------------------------------------------------------------------

export interface PromptGeneratorModalProps {
  item: PipelineItemForPrompt
  sections: SectionForPrompt[]
  targetLocale: 'pt-br' | 'en'
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PromptGeneratorModal({
  item,
  sections,
  targetLocale,
  onClose,
}: PromptGeneratorModalProps) {
  const { text: initialText, wasTruncated } = generatePrompt(item, sections, targetLocale)
  const [promptText, setPromptText] = useState(initialText)
  const wordCount = useMemo(() => promptText.split(/\s+/).filter(Boolean).length, [promptText])

  const dialogRef = useRef<HTMLDivElement>(null)
  const handleTrapKeyDown = useFocusTrap(dialogRef)

  const formatInfo = getFormatIcon(item.format as Parameters<typeof getFormatIcon>[0])

  const currentLocale: 'pt-br' | 'en' = targetLocale === 'en' ? 'pt-br' : 'en'
  const directionLabel = `${currentLocale.toUpperCase()} → ${targetLocale.toUpperCase()}`
  const targetTitle = targetLocale === 'en' ? 'English' : 'Português'

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(promptText)
      toast.success('Prompt copiado')
    } catch {
      toast.error('Falha ao copiar — copie manualmente')
    }
  }

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Adicionar versão ${targetTitle} — ${item.code}`}
        className="w-full max-w-lg rounded-lg border border-[#222d40] bg-[#161d2d] p-4 shadow-xl"
        onKeyDown={handleTrapKeyDown}
      >
        {/* Header */}
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded text-base ${formatInfo.bgClass}`}>
              {formatInfo.icon}
            </span>
            <h2 className="text-sm font-semibold text-[#edf2f7]">
              Adicionar versão {targetTitle}
            </h2>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-[#7a8ba3]">
            <span className="font-mono font-medium text-[#edf2f7]">{item.code}</span>
            <span className="rounded bg-[#1a2236] px-1.5 py-0.5">{item.stage}</span>
            <span className="rounded bg-[#1a2236] px-1.5 py-0.5">P{item.priority}</span>
            <span>
              {sections.length} seções · {directionLabel}
            </span>
          </div>
        </div>

        {/* Textarea */}
        <textarea
          aria-label="Prompt editável"
          rows={10}
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          className="w-full rounded border border-[#222d40] bg-[#0c1222] p-3 font-mono text-xs text-[#edf2f7] outline-none focus:border-[#6366f1]"
          style={{ maxHeight: '280px', overflowY: 'auto', resize: 'vertical' }}
          spellCheck={false}
        />

        {/* Footer info */}
        <div className="mt-1.5 flex items-center justify-between text-xs text-[#5a6b7f]">
          <span>
            {sections.length} seções incluídas
            {wasTruncated && ' (conteúdo > 500 chars truncado)'}
          </span>
          <span>~{wordCount} palavras</span>
        </div>

        {/* Workflow hint */}
        <div className="mt-3 rounded border border-indigo-800/50 bg-indigo-900/20 px-3 py-2 text-xs text-indigo-300">
          💡 Cole no Claude Code
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-[#7a8ba3] hover:bg-[#1a2236] hover:text-[#edf2f7]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded bg-[#6366f1] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#4f46e5]"
          >
            📋 Copiar prompt
          </button>
        </div>
      </div>
    </div>
  )
}
