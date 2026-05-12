'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'

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
}

export function summarizeContent(content: unknown): string {
  if (!content) return 'Seção vazia'
  const text = typeof content === 'string'
    ? content
    : typeof content === 'object' && content !== null && 'body' in content && typeof (content as Record<string, unknown>).body === 'string'
      ? (content as Record<string, unknown>).body as string
      : JSON.stringify(content)
  const words = text.split(/\s+/).filter(Boolean).length
  const headings = (text.match(/^#{1,3}\s+.+$/gm) || []).length
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim() && !/^#{1,3}\s/.test(p.trim()) && !/^-{3,}$/.test(p.trim())).length
  const parts = [`${words} palavras`]
  if (headings > 0) parts.push(`${headings} seções`)
  if (paragraphs > 0) parts.push(`${paragraphs} parágrafos`)
  return parts.join(' | ')
}

export function CoworkRequestPanel({
  isOpen, onClose, itemId, itemCode, itemTitle, sectionLabel, sectionKey, lang, rev, placeholder,
  format, stage, tags, hook, synopsis, sectionContent, references, onSendAndWait,
  insertText, onInsertConsumed,
}: CoworkRequestPanelProps) {
  const [instructions, setInstructions] = useState('')
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Insert text at cursor when a citation is triggered
  useEffect(() => {
    if (!insertText || !onInsertConsumed) return
    const ta = textareaRef.current
    if (ta) {
      const start = ta.selectionStart ?? instructions.length
      const before = instructions.slice(0, start)
      const after = instructions.slice(start)
      setInstructions(before + insertText + after)
      // Restore cursor after the inserted text
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
  }, [insertText, onInsertConsumed]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const prompt = instructions.trim()
    ? buildPrompt({ itemCode, itemTitle, format, stage, tags, hook, synopsis, sectionLabel, sectionKey, lang, rev, contentSummary, instructions: instructions.trim(), itemId, sectionBase, references })
    : ''

  const handleCopy = useCallback(() => {
    if (!prompt) return
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true)
    }).catch(() => {
      window.prompt('Copie o prompt abaixo:', prompt)
    })
  }, [prompt])

  const handleSendAndWait = useCallback(() => {
    onSendAndWait()
  }, [onSendAndWait])

  if (!isOpen) return null

  return (
    <div
      className="sticky top-0 z-10 px-4 py-2.5"
      style={{
        background: 'color-mix(in srgb, var(--gem-accent) 4%, var(--gem-surface))',
        borderTop: '1px solid color-mix(in srgb, var(--gem-accent) 15%, transparent)',
        borderBottom: '1px solid color-mix(in srgb, var(--gem-accent) 10%, transparent)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
      }}
    >
      <textarea
        ref={textareaRef}
        value={instructions}
        onChange={(e) => { setInstructions(e.target.value); setCopied(false) }}
        placeholder={placeholder}
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
            return (
              <div key={id} className="group flex gap-1.5 items-baseline" style={{ fontSize: '9px', color: 'var(--gem-dim)', lineHeight: '1.4' }}>
                <span className="shrink-0 font-semibold" style={{ color: 'var(--gem-accent)' }}>[{id}]</span>
                {truncated ? (
                  <>
                    <span className="group-hover:hidden">{text.slice(0, 80)}...</span>
                    <span className="hidden group-hover:inline break-words">{text}</span>
                  </>
                ) : (
                  <span>{text}</span>
                )}
              </div>
            )
          })}
        </div>
      )}
      {prompt && (
        <pre className="mt-2 p-2 rounded-md text-[10px] overflow-y-auto max-h-48" style={{ background: 'color-mix(in srgb, var(--gem-accent) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--gem-accent) 15%, transparent)', color: 'var(--gem-dim)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          {prompt}
        </pre>
      )}
      <div className="flex justify-between items-center mt-2">
        <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>
          {usedCitations.length > 0
            ? `${usedCitations.length} citacoes | Cole no Claude Cowork.`
            : 'Cole no Claude Cowork.'}
        </span>
        <div className="flex gap-1.5 items-center">
          <button onClick={onClose} className="px-2 py-0.5 text-[10px] rounded" style={{ border: '1px solid var(--gem-border)', color: 'var(--gem-muted)' }}>Cancelar</button>
          {copied ? (
            <button
              onClick={handleSendAndWait}
              className="px-2.5 py-0.5 text-[10px] font-semibold rounded"
              style={{ background: 'var(--gem-done)', border: '1px solid var(--gem-done)', color: 'white' }}
            >
              ✓ Enviado — fechar e aguardar
            </button>
          ) : (
            <button
              onClick={handleCopy}
              disabled={!prompt}
              className="px-2 py-0.5 text-[10px] font-semibold rounded"
              style={{ background: 'var(--gem-accent)', border: '1px solid var(--gem-accent)', color: 'white', opacity: prompt ? 1 : 0.3 }}
            >
              Copiar prompt
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function buildPrompt(ctx: {
  itemCode: string; itemTitle: string; format: string; stage: string
  tags: string[]; hook: string | null; synopsis: string | null
  sectionLabel: string; sectionKey: string; lang: string; rev: number
  contentSummary: string; instructions: string; itemId: string; sectionBase: string
  references: Map<number, string>
}): string {
  const lines: string[] = []

  // Expand citations in instructions
  const expandedInstructions = ctx.instructions.replace(/\[citacao (\d+)\]/g, (match, idStr) => {
    const id = Number(idStr)
    const text = ctx.references.get(id)
    if (text === undefined) return match
    const truncated = text.length > 500 ? text.slice(0, 500) + '...' : text
    return `[citacao ${id}: "${truncated}"]`
  })

  lines.push(`Pipeline item: ${ctx.itemCode} — "${ctx.itemTitle}"`)
  lines.push(`Format: ${ctx.format} | Stage: ${ctx.stage} | Language: ${ctx.lang.toUpperCase()}`)
  if (ctx.tags.length > 0) lines.push(`Tags: ${ctx.tags.join(', ')}`)
  lines.push('')

  if (ctx.hook) lines.push(`Hook: ${ctx.hook}`)
  if (ctx.synopsis) lines.push(`Synopsis: ${ctx.synopsis}`)
  if (ctx.hook || ctx.synopsis) lines.push('')

  lines.push(`Section: ${ctx.sectionLabel} (${ctx.sectionKey}) — rev.${ctx.rev}`)
  lines.push(`Current content: ${ctx.contentSummary}`)
  lines.push('')

  lines.push('Instructions:')
  lines.push(expandedInstructions)
  lines.push('')

  lines.push('---')
  lines.push('Use the pipeline API to:')
  lines.push(`1. GET /api/pipeline/items/${ctx.itemId}/sections/${ctx.sectionBase}?lang=${ctx.lang}`)
  lines.push('   → Note the "rev" and "item_version" from the response')
  lines.push('2. Apply the instructions above to the current content')
  lines.push(`3. PATCH /api/pipeline/items/${ctx.itemId}/sections/${ctx.sectionBase}?lang=${ctx.lang}`)
  lines.push('   Headers: { "X-Expected-Version": <item_version from GET> }')
  lines.push('   Body: { "content": <updated>, "rev": <rev from GET>, "source": "cowork" }')

  return lines.join('\n')
}
