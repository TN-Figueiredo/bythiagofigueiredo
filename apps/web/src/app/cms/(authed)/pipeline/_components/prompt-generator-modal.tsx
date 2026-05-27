'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { getFormatIcon } from '@/lib/pipeline/gem-design'
import { useFocusTrap } from '@/lib/hooks/use-focus-trap'
import { generatePrompt } from '@/lib/pipeline/prompt-builders'
import type { PipelineItemForPrompt, SectionForPrompt } from '@/lib/pipeline/prompt-builders'

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
      toast.error('Não foi possível copiar. Use Cmd+A, Cmd+C no preview.')
    })
  }, [fullPrompt])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    function handleKeys(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleCopy()
      }
    }
    document.addEventListener('keydown', handleKeys)
    return () => document.removeEventListener('keydown', handleKeys)
  }, [onClose, handleCopy])

  useEffect(() => {
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm motion-reduce:backdrop-blur-none"
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
            <h2 className="flex-1 text-sm font-semibold" style={{ color: 'var(--gem-text)' }}>
              Adicionar versão {targetTitle}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="rounded p-1 transition-colors hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
              style={{ color: 'var(--gem-dim)' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1 1l12 12M13 1L1 13" />
              </svg>
            </button>
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
            className="text-xs hover:underline focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none rounded"
            style={{ color: 'var(--gem-accent)' }}
          >
            {showPreview ? 'Ocultar prompt' : 'Ver prompt completo'}
          </button>
          <span className="text-xs" style={{ color: 'var(--gem-dim)' }}>
            {sections.length} seções · ~{wordCount} palavras
            {wasTruncated && ' (truncado)'}
          </span>
        </div>

        {showPreview && (
          <pre
            className="mt-2 p-2.5 rounded-md text-xs overflow-y-auto"
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
          <span className="text-xs" style={{ color: 'var(--gem-dim)' }}>
            Cole no Claude Code
          </span>
          <div className="flex gap-1.5 items-center">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 text-xs rounded focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
              style={{ border: '1px solid var(--gem-border)', color: 'var(--gem-muted)' }}
            >
              Cancelar
            </button>
            {copied ? (
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1 text-xs font-semibold rounded focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
                style={{ background: 'var(--gem-done)', color: 'white' }}
              >
                Copiado — fechar
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-1 text-xs font-semibold rounded focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
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
