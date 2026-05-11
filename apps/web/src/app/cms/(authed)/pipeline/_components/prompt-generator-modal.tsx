'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { getFormatIcon } from '@/lib/pipeline/gem-design'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PipelineItemForPrompt {
  id: string
  code: string
  format: string
  stage: string
  priority: number
  language: 'pt-br' | 'en' | 'both'
  title_pt: string | null
  title_en: string | null
  hook: string | null
  synopsis: string | null
}

export interface SectionForPrompt {
  section_type: string
  language: string
  content: string
}

export interface PromptGeneratorModalProps {
  item: PipelineItemForPrompt
  sections: SectionForPrompt[]
  targetLocale: 'pt-br' | 'en'
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SECTION_TRUNCATE_LIMIT = 500

const LANG_LABELS: Record<'pt-br' | 'en', { label: string; audience: string }> = {
  'pt-br': { label: 'Português (PT-BR)', audience: 'lusófona' },
  en: { label: 'English', audience: 'anglófona' },
}

// ---------------------------------------------------------------------------
// Pure prompt generator
// ---------------------------------------------------------------------------

interface GenerateResult {
  text: string
  wordCount: number
  wasTruncated: boolean
}

function generatePrompt(
  item: PipelineItemForPrompt,
  sections: SectionForPrompt[],
  targetLocale: 'pt-br' | 'en',
): GenerateResult {
  const currentLocale: 'pt-br' | 'en' = targetLocale === 'en' ? 'pt-br' : 'en'
  const targetSuffix = targetLocale === 'en' ? 'en' : 'pt'
  const currentLangLabel = LANG_LABELS[currentLocale].label
  const targetLabel = LANG_LABELS[targetLocale].label
  const targetAudience = LANG_LABELS[targetLocale].audience

  const currentTitle = currentLocale === 'pt-br' ? item.title_pt : item.title_en

  let wasTruncated = false

  // Build sections block
  const sectionsLines: string[] = []
  for (const section of sections) {
    let content = section.content
    if (content.length > SECTION_TRUNCATE_LIMIT) {
      content = content.slice(0, SECTION_TRUNCATE_LIMIT) + '...'
      wasTruncated = true
    }
    sectionsLines.push(`${section.section_type}: ${content}`)
  }

  // Hook and synopsis lines (skip if null)
  const hookLine = item.hook != null ? `Hook: ${item.hook}` : null
  const synopsisLine = item.synopsis != null ? `Synopsis: ${item.synopsis}` : null

  const contentBlock = [
    `Título: ${currentTitle ?? '(vazio)'}`,
    hookLine,
    synopsisLine,
  ]
    .filter(Boolean)
    .join('\n')

  const lines: string[] = [
    '# Contexto',
    `Pipeline item ${item.code} (${item.format}, stage: ${item.stage}, P${item.priority})`,
    `Possui apenas versão ${currentLocale}.`,
    `Item ID: ${item.id}`,
    `title_${targetSuffix}: (vazio)`,
    '',
    `# Conteúdo ${currentLangLabel}`,
    '',
    contentBlock,
    '',
    `# Seções (${sections.length})`,
    '',
    sectionsLines.join('\n'),
    '',
    '# Instruções',
    `Crie a versão ${targetLabel} deste item de ${item.format}.`,
    `Adapte para audiência ${targetAudience} — não traduza literalmente.`,
    'Tom narrativo e pessoal.',
    '',
    '# O que atualizar',
    'Use updatePipelineItem() server action:',
    `- title_${targetSuffix}: título adaptado`,
    '- language: "both"',
    '',
    `Use PATCH /api/pipeline/items/${item.id}/sections:`,
    `- Crie seções _${targetSuffix} (rascunho_${targetSuffix}, seo_${targetSuffix})`,
    '- Mantenha seções _shared intactas',
    '',
    '[Adicione instruções extras aqui]',
  ]

  const text = lines.join('\n')
  const wordCount = text.split(/\s+/).filter(Boolean).length

  return { text, wordCount, wasTruncated }
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
  const { text: initialText, wordCount, wasTruncated } = generatePrompt(item, sections, targetLocale)
  const [promptText, setPromptText] = useState(initialText)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const formatInfo = getFormatIcon(item.format as Parameters<typeof getFormatIcon>[0])

  const currentLocale: 'pt-br' | 'en' = targetLocale === 'en' ? 'pt-br' : 'en'
  const directionLabel = `${currentLocale.toUpperCase()} → ${targetLocale.toUpperCase()}`
  const targetTitle = targetLocale === 'en' ? 'English' : 'Português'

  async function handleCopy() {
    await navigator.clipboard.writeText(promptText)
    toast.success('Prompt copiado')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-lg border border-[#222d40] bg-[#161d2d] p-4 shadow-xl">
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
          ref={textareaRef}
          role="textbox"
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          className="w-full rounded border border-[#222d40] bg-[#0c1222] p-3 font-mono text-xs text-[#edf2f7] outline-none focus:border-[#6366f1]"
          style={{ maxHeight: '200px', overflowY: 'auto', resize: 'vertical' }}
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
