// ---------------------------------------------------------------------------
// Pure prompt-building utilities — extracted from component files so they can
// be shared and tested without React dependencies.
// ---------------------------------------------------------------------------

import { pipelinePaths } from './api-paths'

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

export interface GenerateResult {
  text: string
  wordCount: number
  wasTruncated: boolean
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
// generatePrompt — translation prompt builder (from prompt-generator-modal)
// ---------------------------------------------------------------------------

export function generatePrompt(
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
    '# Workflow',
    `0. GET ${pipelinePaths.items.detail(item.id)}`,
    '   → Note "version" for X-Expected-Version header',
    '',
    '# O que atualizar',
    `1. PATCH ${pipelinePaths.items.detail(item.id)}`,
    '   Headers: { "X-Expected-Version": <version from GET> }',
    `   Body: { "title_${targetSuffix}": "<título adaptado>", "language": "both" }`,
    '',
    `2. Para cada seção _${targetSuffix} a criar:`,
    `   PATCH ${pipelinePaths.items.section(item.id, '<section_key>', targetSuffix)}`,
    '   Headers: { "X-Expected-Version": <version from GET> }',
    '   Body: { "content": <adapted>, "rev": 0, "source": "cowork" }  // rev 0 = new section; if section exists, use current rev from GET',
    '',
    `- Crie seções _${targetSuffix} (rascunho_${targetSuffix}, seo_${targetSuffix})`,
    '- Mantenha seções _shared intactas',
    '',
    '# (opcional: adicione instruções extras abaixo)',
  ]

  const text = lines.join('\n')
  const wordCount = text.split(/\s+/).filter(Boolean).length

  return { text, wordCount, wasTruncated }
}

// ---------------------------------------------------------------------------
// summarizeContent & buildPrompt — cowork request prompt (from cowork-request-panel)
// ---------------------------------------------------------------------------

interface TiptapNode {
  type: string
  text?: string
  content?: TiptapNode[]
}

function isJSONContent(value: unknown): value is TiptapNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && (value as Record<string, unknown>).type === 'doc'
}

function walkText(node: TiptapNode): string[] {
  const texts: string[] = []
  if (node.text) texts.push(node.text)
  if (node.content) {
    for (const child of node.content) texts.push(...walkText(child))
  }
  return texts
}

function summarizeJSONContent(doc: TiptapNode): string {
  if (!doc.content) return 'Seção vazia'
  let headings = 0
  let paragraphs = 0
  for (const node of doc.content) {
    if (node.type === 'heading') headings++
    if (node.type === 'paragraph') paragraphs++
  }
  const allText = walkText(doc).join(' ')
  const words = allText.split(/\s+/).filter(Boolean).length
  const parts = [`${words} palavras`]
  if (headings > 0) parts.push(`${headings} seções`)
  if (paragraphs > 0) parts.push(`${paragraphs} parágrafos`)
  return parts.join(' | ')
}

export function summarizeContent(content: unknown): string {
  if (!content) return 'Seção vazia'
  if (isJSONContent(content)) return summarizeJSONContent(content)
  if (typeof content === 'object' && content !== null && 'body' in content) {
    const body = (content as Record<string, unknown>).body
    if (isJSONContent(body)) return summarizeJSONContent(body)
    if (typeof body === 'string') return summarizeMarkdown(body)
  }
  const text = typeof content === 'string' ? content : JSON.stringify(content)
  return summarizeMarkdown(text)
}

function summarizeMarkdown(text: string): string {
  const words = text.split(/\s+/).filter(Boolean).length
  const headings = (text.match(/^#{1,3}\s+.+$/gm) || []).length
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim() && !/^#{1,3}\s/.test(p.trim()) && !/^-{3,}$/.test(p.trim())).length
  const parts = [`${words} palavras`]
  if (headings > 0) parts.push(`${headings} seções`)
  if (paragraphs > 0) parts.push(`${paragraphs} parágrafos`)
  return parts.join(' | ')
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
  lines.push(`0. GET ${pipelinePaths.docs.domain('items-and-sections')}`)
  lines.push('   → Section schemas, formatting rules, and Tiptap preset reference')
  lines.push(`1. GET ${pipelinePaths.items.section(ctx.itemId, ctx.sectionBase, ctx.lang)}`)
  lines.push('   → Note the "rev" and "item_version" from the response')
  lines.push('2. Apply the instructions above to the current content, following the schema from step 0')
  lines.push(`3. PATCH ${pipelinePaths.items.section(ctx.itemId, ctx.sectionBase, ctx.lang)}`)
  lines.push('   Headers: { "X-Expected-Version": <item_version from GET> }')
  lines.push('   Body: { "content": <updated>, "rev": <rev from GET>, "source": "cowork" }')
  lines.push('   On 409 (rev conflict): re-GET the section, merge changes with new rev, retry PATCH')
  lines.push('   On 412 (version conflict): re-GET the item to refresh item_version, retry')

  return lines.join('\n')
}
