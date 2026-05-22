import type { PlaylistRow, PlaylistItemEnriched, PlaylistEdgeRow } from './types'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ReuseCandidateItem {
  id: string
  title: string
  format: string
  language: string
  stage: string
  tags: string[]
}

export interface PlaylistPromptInput {
  playlist: PlaylistRow
  items: PlaylistItemEnriched[]
  edges: PlaylistEdgeRow[]
  focusedItemIds: string[]
  reuseCandidates: ReuseCandidateItem[]
  userInstructions: string
}

export interface PromptResult {
  text: string
  wordCount: number
  tbdCount: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOTES_WORD_LIMIT = 1500

function tiptapToMarkdown(json: Record<string, unknown> | null): string {
  if (!json) return ''
  const content = json.content as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(content)) return ''

  const lines: string[] = []
  for (const node of content) {
    const text = extractText(node)
    if (!text) continue

    switch (node.type) {
      case 'heading': {
        const level = ((node.attrs as Record<string, unknown>)?.level as number) ?? 3
        lines.push(`${'#'.repeat(level)} ${text}`)
        break
      }
      case 'bulletList':
      case 'orderedList':
        lines.push(text)
        break
      default:
        lines.push(text)
    }
  }
  return lines.join('\n')
}

function extractText(node: Record<string, unknown>): string {
  if (node.type === 'text') return (node.text as string) ?? ''
  const content = node.content as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(content)) return ''

  if (node.type === 'bulletList') {
    return content.map(li => `- ${extractText(li)}`).join('\n')
  }
  if (node.type === 'orderedList') {
    return content.map((li, i) => `${i + 1}. ${extractText(li)}`).join('\n')
  }
  return content.map(extractText).join('')
}

function truncateWords(text: string, limit: number): { text: string; truncated: boolean } {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length <= limit) return { text, truncated: false }
  return { text: words.slice(0, limit).join(' ') + '\n...(truncado)', truncated: true }
}

export function extractTextFromJSON(json: Record<string, unknown>): string {
  if (json.type === 'text') return (json.text as string) ?? ''
  const content = json.content as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(content)) return ''
  return content.map(extractTextFromJSON).join(' ')
}

// ---------------------------------------------------------------------------
// buildPlaylistPrompt
// ---------------------------------------------------------------------------

export function buildPlaylistPrompt(input: PlaylistPromptInput): PromptResult {
  const { playlist, items, edges, focusedItemIds, reuseCandidates, userInstructions } = input
  const sections: string[] = []

  const tbdCount = items.filter(i => /^TBD\b/i.test(i.title)).length

  // 1. Header
  const header = [
    `# Playlist: ${playlist.name_en || playlist.name_pt}`,
    `Status: ${playlist.status}${playlist.category ? ` | Categoria: ${playlist.category}` : ''}`,
    `Items: ${items.length} | Edges: ${edges.length}`,
  ]
  if (tbdCount > 0) header.push(`⚠ ${tbdCount} item(s) TBD — renomear com títulos descritivos`)
  sections.push(header.join('\n'))

  // 2. Notas & Decisões do Produtor
  if (playlist.notes) {
    const rawNotes = tiptapToMarkdown(playlist.notes)
    if (rawNotes.trim()) {
      const { text: notesText } = truncateWords(rawNotes, NOTES_WORD_LIMIT)
      sections.push(`## Notas & Decisões do Produtor\n\n${notesText}`)
    }
  }

  // 3. Items em Foco
  if (focusedItemIds.length > 0) {
    const focused = items.filter(i => focusedItemIds.includes(i.id))
    if (focused.length > 0) {
      const lines = focused.map(item => {
        const header = [
          `- **${item.title}**`,
          item.content_type ? `[${item.content_type}]` : null,
          item.language ? `[${item.language}]` : null,
          item.status ? `Stage: ${item.status}` : null,
          item.category ? `Format: ${item.category}` : null,
          item.tags.length > 0 ? `Tags: ${item.tags.join(', ')}` : null,
        ].filter(Boolean).join(' | ')
        const details: string[] = []
        if (item.hook) details.push(`  Hook: ${item.hook}`)
        if (item.synopsis) details.push(`  Synopsis: ${item.synopsis}`)
        return details.length > 0 ? `${header}\n${details.join('\n')}` : header
      })
      sections.push(`## Items em Foco (${focused.length})\n\n${lines.join('\n')}`)
    }
  }

  // 4. Grafo Completo (resumo)
  const sortedItems = [...items].sort((a, b) => a.sort_order - b.sort_order)
  const itemLines = sortedItems.map((item, i) => {
    const lang = item.language ? item.language.toUpperCase() : '??'
    const type = item.content_type ?? 'ghost'
    const tbd = /^TBD\b/i.test(item.title) ? ' ⚠TBD' : ''
    const ghost = item.is_ghost ? ' GHOST—content removed' : ''
    return `[${i + 1}] [${type}-${lang}] "${item.title}" — ${item.status ?? 'n/a'}${tbd}${ghost}`
  })

  let graphSection = `## Grafo Completo\n\n${itemLines.join('\n')}`

  if (edges.length > 0) {
    const edgeLines = edges.map(e => {
      const si = sortedItems.findIndex(i => i.id === e.source_item_id) + 1
      const ti = sortedItems.findIndex(i => i.id === e.target_item_id) + 1
      return `${si}->${ti}(${e.edge_type.slice(0, 3)})`
    })
    graphSection += `\n\nEdges: ${edgeLines.join(' ')}`
  }
  sections.push(graphSection)

  // 5. Candidatos para Reuso
  if (reuseCandidates.length > 0) {
    const top15 = reuseCandidates.slice(0, 15)
    const lines = top15.map(c =>
      `- "${c.title}" [${c.format}-${c.language.toUpperCase()}] Stage: ${c.stage} | Tags: ${c.tags.join(', ')}`,
    )
    sections.push(
      `## Candidatos para Reuso (${top15.length})\n\n` +
      `**PRIORIZE reutilizar items existentes antes de criar novos.**\n\n` +
      lines.join('\n'),
    )
  } else {
    sections.push('Nenhum candidato para reuso encontrado — considere criar novos items.')
  }

  // 6. Regras
  sections.push(
    `## Regras\n\n` +
    `1. GET first — sempre leia o estado atual antes de modificar\n` +
    `2. Priorize reuso de items existentes sobre criação de novos\n` +
    `3. Renomeie items TBD com títulos descritivos\n` +
    `4. Verifique notas do produtor antes de sugerir mudanças\n` +
    `5. Use modos Architect: BUILD, CONNECT, GAP, REORG, CAMPAIGN, COURSE\n` +
    `6. Auto-layout após modificações estruturais\n` +
    `7. Reporte resultado e sugira próximos passos`,
  )

  // 7. Instruções do Produtor
  if (userInstructions.trim()) {
    sections.push(`## Instruções do Produtor\n\n${userInstructions.trim()}`)
  } else {
    sections.push('## Instruções do Produtor\n\n(sem instruções adicionais)')
  }

  const text = sections.join('\n\n---\n\n')
  const wordCount = text.split(/\s+/).filter(Boolean).length

  return { text, wordCount, tbdCount }
}
