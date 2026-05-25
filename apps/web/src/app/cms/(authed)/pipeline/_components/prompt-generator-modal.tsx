'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { getFormatIcon } from '@/lib/pipeline/gem-design'
import { useFocusTrap } from '@/lib/hooks/use-focus-trap'
import { generatePrompt } from '@/lib/pipeline/prompt-builders'
import type { PipelineItemForPrompt, SectionForPrompt } from '@/lib/pipeline/prompt-builders'

export { generatePrompt } from '@/lib/pipeline/prompt-builders'
export type {
  PipelineItemForPrompt,
  SectionForPrompt,
  GenerateResult,
} from '@/lib/pipeline/prompt-builders'

export interface PromptGeneratorModalProps {
  item: PipelineItemForPrompt
  sections: SectionForPrompt[]
  targetLocale: 'pt-br' | 'en'
  onClose: () => void
}

export function PromptGeneratorModal({
  item,
  sections,
  targetLocale,
  onClose,
}: PromptGeneratorModalProps) {
  const [instructions, setInstructions] = useState('')
  const [copied, setCopied] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const handleTrapKeyDown = useFocusTrap(dialogRef)

  const formatInfo = getFormatIcon(item.format as Parameters<typeof getFormatIcon>[0])
  const targetTitle = targetLocale === 'en' ? 'em inglês' : 'em português'
  const sourceLocale = targetLocale === 'en' ? 'PT-BR' : 'EN'

  const { text: basePrompt, wasTruncated } = useMemo(
    () => generatePrompt(item, sections, targetLocale),
    [item, sections, targetLocale],
  )

  const fullPrompt = useMemo(() => {
    if (!instructions.trim()) return basePrompt
    return basePrompt.replace(
      '# (opcional: adicione instruções extras abaixo)',
      `# Instruções adicionais\n${instructions.trim()}`,
    )
  }, [basePrompt, instructions])

  const wordCount = useMemo(() => fullPrompt.split(/\s+/).filter(Boolean).length, [fullPrompt])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(fullPrompt).then(() => {
      setCopied(true)
    }).catch(() => {
      window.prompt('Copie o prompt abaixo:', fullPrompt)
    })
  }, [fullPrompt])

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  useEffect(() => {
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [])

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
        className="w-full max-w-lg rounded-lg border p-4 shadow-xl"
        style={{ borderColor: 'var(--gem-border)', backgroundColor: 'var(--gem-surface)' }}
        onKeyDown={handleTrapKeyDown}
      >
        {/* Header */}
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded text-base ${formatInfo.bgClass}`}>
              {formatInfo.icon}
            </span>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--gem-text)' }}>
              Adicionar versão {targetTitle}
            </h2>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs" style={{ color: 'var(--gem-dim)' }}>
            <span className="font-mono font-medium" style={{ color: 'var(--gem-text)' }}>{item.code}</span>
            <span className="rounded px-1.5 py-0.5" style={{ background: 'var(--gem-well)' }}>{item.stage}</span>
            <span className="rounded px-1.5 py-0.5" style={{ background: 'var(--gem-well)' }}>P{item.priority}</span>
            <span>{sourceLocale} → {targetLocale.toUpperCase()}</span>
          </div>
        </div>

        {/* Instructions input */}
        <textarea
          ref={textareaRef}
          value={instructions}
          onChange={(e) => { setInstructions(e.target.value); setCopied(false) }}
          placeholder="Instruções adicionais para a tradução/adaptação... (opcional)"
          aria-label="Instruções para tradução"
          className="w-full text-xs p-2.5 rounded-md resize-y"
          style={{
            background: 'var(--gem-well)',
            border: '1px solid var(--gem-border)',
            color: 'var(--gem-text)',
            minHeight: '60px',
            maxHeight: '120px',
          }}
          rows={3}
        />

        {/* Prompt preview toggle */}
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="text-[10px] hover:underline"
            style={{ color: 'var(--gem-accent)' }}
          >
            {showPreview ? 'Ocultar prompt' : 'Ver prompt completo'}
          </button>
          <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>
            {sections.length} seções · ~{wordCount} palavras
            {wasTruncated && ' (truncado)'}
          </span>
        </div>

        {showPreview && (
          <pre
            className="mt-2 p-2.5 rounded-md text-[10px] overflow-y-auto"
            style={{
              maxHeight: '200px',
              background: 'var(--gem-well)',
              border: '1px solid var(--gem-border)',
              color: 'var(--gem-dim)',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
            }}
          >{fullPrompt}</pre>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center mt-3">
          <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>
            Cole no Claude Code
          </span>
          <div className="flex gap-1.5 items-center">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 text-xs rounded"
              style={{ border: '1px solid var(--gem-border)', color: 'var(--gem-muted)' }}
            >
              Cancelar
            </button>
            {copied ? (
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1 text-xs font-semibold rounded"
                style={{ background: 'var(--gem-done)', color: 'white' }}
              >
                Copiado — fechar
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-1 text-xs font-semibold rounded"
                style={{ background: 'var(--gem-accent)', color: 'white' }}
              >
                Copiar prompt
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
