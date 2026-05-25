'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { summarizeContent, buildPrompt } from '@/lib/pipeline/prompt-builders'


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
  format: string
  stage: string
  tags: string[]
  hook: string | null
  synopsis: string | null
  sectionContent: unknown
  references: Map<number, string>
  onSendAndWait: () => void
  insertText?: string | null
  onInsertConsumed?: () => void
  baseUrl?: string
}

export function CoworkRequestPanel({
  isOpen, onClose, itemId, itemCode, itemTitle, sectionLabel, sectionKey, lang, rev, placeholder,
  format, stage, tags, hook, synopsis, sectionContent, references, onSendAndWait,
  insertText, onInsertConsumed, baseUrl,
}: CoworkRequestPanelProps) {
  const [instructions, setInstructions] = useState('')
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [expandedCitations, setExpandedCitations] = useState<Set<number>>(new Set())

  // Insert text at cursor when a citation is triggered
  useEffect(() => {
    if (!insertText || !onInsertConsumed) return
    const ta = textareaRef.current
    if (ta) {
      const start = ta.selectionStart ?? ta.value.length
      const before = ta.value.slice(0, start)
      const after = ta.value.slice(start)
      setInstructions(before + insertText + after)
      requestAnimationFrame(() => {
        const pos = start + insertText.length
        ta.setSelectionRange(pos, pos)
        ta.focus()
      })
    } else {
      setInstructions(prev => prev + insertText)
    }
    setCopied(false)
    onInsertConsumed()
  }, [insertText, onInsertConsumed])

  const sectionBase = sectionKey.replace(/_(?:en|pt|shared)$/, '')
  const contentSummary = useMemo(() => summarizeContent(sectionContent), [sectionContent])

  const usedCitations = useMemo(() => {
    const ids: number[] = []
    const re = /\[citacao (\d+)\]/g
    let m: RegExpExecArray | null
    while ((m = re.exec(instructions)) !== null) {
      const id = Number(m[1])
      if (references.has(id) && !ids.includes(id)) ids.push(id)
    }
    return ids
  }, [instructions, references])

  const prompt = useMemo(() => instructions.trim()
    ? buildPrompt({ itemCode, itemTitle, format, stage, tags, hook, synopsis, sectionLabel, sectionKey, lang, rev, contentSummary, instructions: instructions.trim(), itemId, sectionBase, references, baseUrl: baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : '') })
    : ''
  , [instructions, itemCode, itemTitle, format, stage, tags, hook, synopsis, sectionLabel, sectionKey, lang, rev, contentSummary, itemId, sectionBase, references, baseUrl])

  const handleCopy = useCallback(() => {
    if (!prompt) return
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true)
    }).catch(() => {
      toast.error('Não foi possível copiar automaticamente. Use Cmd+A, Cmd+C no preview acima.')
    })
  }, [prompt])

  const handleSendAndWait = useCallback(() => {
    setInstructions('')
    setCopied(false)
    onSendAndWait()
  }, [onSendAndWait])

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      role="region"
      aria-label="Painel de requisição Cowork"
      aria-description="Pressione Escape para fechar"
      className="sticky top-0 z-10 px-4 py-2.5"
      style={{
        background: 'color-mix(in srgb, var(--gem-accent) 4%, var(--gem-surface))',
        borderTop: '1px solid color-mix(in srgb, var(--gem-accent) 15%, transparent)',
        borderBottom: '1px solid color-mix(in srgb, var(--gem-accent) 10%, transparent)',
        boxShadow: '0 4px 12px color-mix(in srgb, var(--gem-shadow, #000) 25%, transparent)',
      }}
    >
      <textarea
        ref={textareaRef}
        value={instructions}
        onChange={(e) => { setInstructions(e.target.value); setCopied(false) }}
        placeholder={placeholder}
        aria-label="Instruções para o Cowork"
        className="w-full text-xs p-2 rounded-md resize-y font-sans"
        style={{
          background: 'var(--gem-well)',
          border: '1px solid color-mix(in srgb, var(--gem-accent) 20%, transparent)',
          color: 'var(--gem-text)',
          minHeight: '60px',
        }}
      />
      {usedCitations.length > 0 && (
        <div
          className="mt-1.5 rounded-md px-2 py-1.5"
          style={{
            background: 'color-mix(in srgb, var(--gem-accent) 4%, transparent)',
            border: '1px solid color-mix(in srgb, var(--gem-accent) 10%, transparent)',
          }}
        >
          {usedCitations.map((id) => {
            const text = references.get(id) ?? ''
            const truncated = text.length > 80
            const isExpanded = expandedCitations.has(id)
            return (
              <div key={id} className="group flex gap-1.5 items-baseline" style={{ fontSize: '9px', color: 'var(--gem-dim)', lineHeight: '1.4' }}>
                <span className="shrink-0 font-semibold" style={{ color: 'var(--gem-accent)' }}>[{id}]</span>
                {truncated ? (
                  <span
                    tabIndex={0}
                    role="button"
                    aria-expanded={isExpanded}
                    aria-label={`Citacao ${id}`}
                    onFocus={() => setExpandedCitations(prev => { const next = new Set(prev); next.add(id); return next })}
                    onBlur={() => setExpandedCitations(prev => { const next = new Set(prev); next.delete(id); return next })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setExpandedCitations(prev => {
                          const next = new Set(prev)
                          if (next.has(id)) next.delete(id)
                          else next.add(id)
                          return next
                        })
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <span className={isExpanded ? 'hidden' : 'group-hover:hidden'}>{text.slice(0, 80)}...</span>
                    <span className={isExpanded ? 'inline break-words' : 'hidden group-hover:inline break-words'}>{text}</span>
                  </span>
                ) : (
                  <span>{text}</span>
                )}
              </div>
            )
          })}
        </div>
      )}
      {prompt && (
        <pre className="mt-2 p-2 rounded-md text-[11px] overflow-y-auto max-h-48" style={{ background: 'color-mix(in srgb, var(--gem-accent) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--gem-accent) 15%, transparent)', color: 'var(--gem-dim)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{prompt}</pre>
      )}
      <div className="flex justify-between items-center mt-2">
        <span className="text-[11px]" style={{ color: 'var(--gem-dim)' }}>
          {usedCitations.length > 0
            ? `${usedCitations.length} citacoes | Cole no Claude Cowork.`
            : 'Cole no Claude Cowork.'}
        </span>
        <div className="flex gap-1.5 items-center">
          <button type="button" onClick={onClose} className="px-2 py-0.5 text-[11px] rounded focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)]" style={{ border: '1px solid var(--gem-border)', color: 'var(--gem-muted)' }}>Cancelar</button>
          {copied ? (
            <button
              type="button"
              onClick={handleSendAndWait}
              className="px-2.5 py-0.5 text-[11px] font-semibold rounded focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)]"
              style={{ background: 'var(--gem-done)', border: '1px solid var(--gem-done)', color: 'var(--gem-on-accent, #fff)' }}
            >
              ✓ Enviado — fechar e aguardar
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCopy}
              disabled={!prompt}
              className="px-2 py-0.5 text-[11px] font-semibold rounded disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)]"
              style={{ background: 'var(--gem-accent)', border: '1px solid var(--gem-accent)', color: 'var(--gem-on-accent, #fff)' }}
            >
              Copiar prompt
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

