import type { JSONContent } from '@tiptap/core'
import { getSpacingClass } from './spacing'
import { slugify } from '@/lib/blog/slugify'

// ─── Public types ────────────────────────────────────────────────────────────

export interface TocEntry {
  slug: string
  text: string
  depth: 2 | 3
}

export interface CompileJsonResult {
  html: string
  toc: TocEntry[]
  readingTimeMin: number
}

// ─── Whitelists for safe CSS class generation ───────────────────────────────

const CALLOUT_VARIANTS = new Set(['info', 'warning', 'tip', 'error'])
const CTA_STYLES = new Set(['primary', 'secondary', 'ghost'])
const CTA_ALIGNS = new Set(['left', 'center', 'right'])
const COLUMN_RATIOS = new Set(['1-1', '2-1', '1-2', '1-1-1'])
const HEADING_LEVELS = new Set([1, 2, 3, 4])

// ─── SVG icons for callout variants ──────────────────────────────────────────

const CALLOUT_ICONS: Record<string, string> = {
  info: '<svg class="pb-callout-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/><text x="12" y="17" text-anchor="middle" font-size="14" fill="currentColor">i</text></svg>',
  warning: '<svg class="pb-callout-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="2" fill="none"/><text x="12" y="17" text-anchor="middle" font-size="13" fill="currentColor">!</text></svg>',
  tip: '<svg class="pb-callout-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21h6m-3-3V12m0 0a5 5 0 100-10 5 5 0 000 10z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  error: '<svg class="pb-callout-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
}

// ─── URL sanitizer ────────────────────────────────────────────────────────────

const UNSAFE_URL_PATTERN = /^\s*(javascript|data|vbscript|file):/i

function sanitizeUrl(url: string): string {
  if (UNSAFE_URL_PATTERN.test(url)) return '#'
  return url
}

// ─── HTML escaping ────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ─── Text extraction helper ────────────────────────────────────────────────────

function extractText(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? ''
  if (!node.content) return ''
  return node.content.map(extractText).join('')
}

// ─── Inline content (marks) rendering ────────────────────────────────────────

function renderInline(nodes: JSONContent[] | undefined): string {
  if (!nodes) return ''
  return nodes.map(renderInlineNode).join('')
}

function renderInlineNode(node: JSONContent): string {
  if (node.type === 'hardBreak') return '<br>'

  if (node.type === 'text') {
    let content = escapeHtml(node.text ?? '')
    const marks = node.marks ?? []

    // Apply marks from innermost to outermost (reversed for wrapping)
    for (const mark of marks) {
      switch (mark.type) {
        case 'bold':
          content = `<strong>${content}</strong>`
          break
        case 'italic':
          content = `<em>${content}</em>`
          break
        case 'underline':
          content = `<u>${content}</u>`
          break
        case 'strike':
          content = `<s>${content}</s>`
          break
        case 'code':
          content = `<code>${content}</code>`
          break
        case 'highlight':
          content = `<mark class="pb-mark">${content}</mark>`
          break
        case 'link': {
          const href = sanitizeUrl(mark.attrs?.href ?? '')
          content = `<a href="${escapeHtml(href)}" rel="noopener noreferrer nofollow">${content}</a>`
          break
        }
      }
    }
    return content
  }

  // Fallback for unexpected inline nodes
  return escapeHtml(extractText(node))
}

// ─── State passed through compilation ────────────────────────────────────────

interface CompileState {
  toc: TocEntry[]
  wordCount: number
}

// ─── Block node renderer ──────────────────────────────────────────────────────

function renderBlock(node: JSONContent, state: CompileState): string {
  switch (node.type) {
    case 'paragraph':
      return renderParagraph(node, state)
    case 'heading':
      return renderHeading(node, state)
    case 'bulletList':
      return renderBulletList(node, state)
    case 'orderedList':
      return renderOrderedList(node, state)
    case 'listItem':
      return renderListItem(node, state)
    case 'blockquote':
      return renderBlockquote(node, state)
    case 'codeBlock':
      return renderCodeBlock(node)
    case 'horizontalRule':
      return renderHorizontalRule()
    case 'image':
      return renderImage(node)
    case 'callout':
      return renderCallout(node, state)
    case 'ctaButton':
      return renderCtaButton(node)
    case 'taskList':
      return renderTaskList(node, state)
    case 'taskItem':
      return renderTaskItem(node, state)
    case 'toggleWrapper':
      return renderToggleWrapper(node, state)
    case 'toggleTitle':
      return renderToggleTitle(node)
    case 'toggleBody':
      return renderToggleBody(node, state)
    case 'columns':
      return renderColumns(node, state)
    case 'column':
      return renderColumn(node, state)
    case 'table':
      return renderTable(node, state)
    case 'tableRow':
      return renderTableRow(node, state)
    case 'tableHeader':
      return renderTableHeader(node, state)
    case 'tableCell':
      return renderTableCell(node, state)
    case 'socialEmbed':
      return renderSocialEmbed(node)
    case 'mergeTag':
      return renderMergeTag(node)
    default:
      // Unknown node: try to render children or text
      if (node.content) {
        return node.content.map((child) => renderBlock(child, state)).join('')
      }
      return ''
  }
}

function renderParagraph(node: JSONContent, state: CompileState): string {
  const inner = renderInline(node.content)
  // Count words from text nodes
  const text = extractText(node)
  state.wordCount += text.split(/\s+/).filter(Boolean).length
  return `<p class="pb-p">${inner}</p>`
}

function renderHeading(node: JSONContent, state: CompileState): string {
  const rawLevel = Number(node.attrs?.level ?? 2)
  const level = HEADING_LEVELS.has(rawLevel) ? rawLevel : 2
  const text = extractText(node)
  state.wordCount += text.split(/\s+/).filter(Boolean).length
  const slug = slugify(text)
  const inner = renderInline(node.content)

  if (level === 2 || level === 3) {
    state.toc.push({ slug, text, depth: level as 2 | 3 })
  }

  return `<h${level} id="${escapeHtml(slug)}" class="pb-h${level}">${inner}</h${level}>`
}

function renderBulletList(node: JSONContent, state: CompileState): string {
  const items = (node.content ?? []).map((child) => renderBlock(child, state)).join('')
  return `<ul class="pb-ul">${items}</ul>`
}

function renderOrderedList(node: JSONContent, state: CompileState): string {
  const items = (node.content ?? []).map((child) => renderBlock(child, state)).join('')
  return `<ol class="pb-ol">${items}</ol>`
}

function renderListItem(node: JSONContent, state: CompileState): string {
  const inner = (node.content ?? []).map((child) => renderBlock(child, state)).join('')
  return `<li>${inner}</li>`
}

function renderBlockquote(node: JSONContent, state: CompileState): string {
  const inner = (node.content ?? []).map((child) => renderBlock(child, state)).join('')
  return `<blockquote class="pb-quote">${inner}</blockquote>`
}

function renderCodeBlock(node: JSONContent): string {
  const lang = node.attrs?.language ?? ''
  const code = (node.content ?? []).map((n) => escapeHtml(n.text ?? '')).join('')
  const langAttr = lang ? ` data-lang="${escapeHtml(lang)}"` : ''
  return `<pre class="pb-code"${langAttr}><code>${code}</code></pre>`
}

function renderHorizontalRule(): string {
  return `<div class="pb-divider"><span class="pb-divider-ornament">&#10043;</span></div>`
}

function renderImage(node: JSONContent): string {
  const src = escapeHtml(sanitizeUrl(node.attrs?.src ?? ''))
  const alt = escapeHtml(node.attrs?.alt ?? '')
  const title = node.attrs?.title as string | undefined
  const caption = title ? `<figcaption class="pb-figcaption">${escapeHtml(title)}</figcaption>` : ''
  return `<figure class="pb-figure"><img src="${src}" alt="${alt}" class="pb-img">${caption}</figure>`
}

function renderCallout(node: JSONContent, state: CompileState): string {
  const raw = String(node.attrs?.variant ?? 'info')
  const variant = CALLOUT_VARIANTS.has(raw) ? raw : 'info'
  const icon = CALLOUT_ICONS[variant] ?? CALLOUT_ICONS.info
  const inner = (node.content ?? []).map((child) => renderBlock(child, state)).join('')
  const hasBlockContent = node.content?.some((c) => c.type !== 'text' && c.type !== 'hardBreak')
  const body = hasBlockContent ? inner : renderInline(node.content)
  return `<aside class="pb-callout pb-callout-${variant}" role="note" aria-label="${variant}">${icon}<div class="pb-callout-content">${body}</div></aside>`
}

function renderCtaButton(node: JSONContent): string {
  const rawAlign = String(node.attrs?.align ?? 'center')
  const align = CTA_ALIGNS.has(rawAlign) ? rawAlign : 'center'
  const rawButtons = Array.isArray(node.attrs?.buttons) ? node.attrs.buttons : []
  const btns = (rawButtons as Array<Record<string, unknown>>)
    .map((btn) => {
      const href = escapeHtml(sanitizeUrl(String(btn.url ?? '')))
      const rawStyle = String(btn.style ?? 'primary')
      const style = CTA_STYLES.has(rawStyle) ? rawStyle : 'primary'
      const text = escapeHtml(String(btn.text ?? ''))
      return `<a href="${href}" class="pb-cta-${style}" rel="noopener noreferrer nofollow">${text}</a>`
    })
    .join('')
  return `<div class="pb-cta pb-cta-align-${align}">${btns}</div>`
}

function renderTaskList(node: JSONContent, state: CompileState): string {
  const items = (node.content ?? []).map((child) => renderBlock(child, state)).join('')
  return `<ul class="pb-checklist">${items}</ul>`
}

function renderTaskItem(node: JSONContent, state: CompileState): string {
  const checked = node.attrs?.checked === true
  const checkedAttr = checked ? ' checked' : ''
  const inner = (node.content ?? []).map((child) => renderBlock(child, state)).join('')
  return `<li class="pb-checklist-item"><span class="pb-check"><input type="checkbox"${checkedAttr} disabled></span>${inner}</li>`
}

function renderToggleWrapper(node: JSONContent, state: CompileState): string {
  const inner = (node.content ?? []).map((child) => renderBlock(child, state)).join('')
  return `<details class="pb-toggle">${inner}</details>`
}

function renderToggleTitle(node: JSONContent): string {
  const inner = renderInline(node.content)
  return `<summary class="pb-toggle-title">${inner}</summary>`
}

function renderToggleBody(node: JSONContent, state: CompileState): string {
  const inner = (node.content ?? []).map((child) => renderBlock(child, state)).join('')
  return `<div class="pb-toggle-body">${inner}</div>`
}

function renderColumns(node: JSONContent, state: CompileState): string {
  const raw = ((node.attrs?.ratio as string | undefined) ?? '1:1').replace(/:/g, '-')
  const ratio = COLUMN_RATIOS.has(raw) ? raw : '1-1'
  const inner = (node.content ?? []).map((child) => renderBlock(child, state)).join('')
  return `<div class="pb-columns pb-cols-${ratio}">${inner}</div>`
}

function renderColumn(node: JSONContent, state: CompileState): string {
  const inner = (node.content ?? []).map((child) => renderBlock(child, state)).join('')
  return `<div class="pb-column">${inner}</div>`
}

function renderTable(node: JSONContent, state: CompileState): string {
  const caption = node.attrs?.caption as string | undefined
  const captionHtml = caption ? `<caption class="pb-table-caption">${escapeHtml(caption)}</caption>` : ''
  const rows = (node.content ?? []).map((child) => renderBlock(child, state)).join('')
  return `<div class="pb-table-wrap"><table class="pb-table">${captionHtml}${rows}</table></div>`
}

function renderTableRow(node: JSONContent, state: CompileState): string {
  const cells = (node.content ?? []).map((child) => renderBlock(child, state)).join('')
  return `<tr>${cells}</tr>`
}

function renderTableHeader(node: JSONContent, state: CompileState): string {
  const inner = (node.content ?? []).map((child) => renderBlock(child, state)).join('')
  return `<th class="pb-th">${inner}</th>`
}

function renderTableCell(node: JSONContent, state: CompileState): string {
  const inner = (node.content ?? []).map((child) => renderBlock(child, state)).join('')
  return `<td class="pb-td">${inner}</td>`
}

function renderSocialEmbed(node: JSONContent): string {
  const provider = escapeHtml(node.attrs?.provider ?? '')
  const url = escapeHtml(node.attrs?.url ?? '')
  return `<div class="pb-embed" data-provider="${provider}" data-url="${url}"></div>`
}

function renderMergeTag(node: JSONContent): string {
  const tag = escapeHtml(String(node.attrs?.tag ?? ''))
  return `<span class="pb-merge-tag" data-tag="${tag}">{{${tag}}}</span>`
}

// ─── Top-level doc compiler ───────────────────────────────────────────────────

export async function compileJsonContent(json: JSONContent): Promise<CompileJsonResult> {
  if (!json?.content) {
    return { html: '', toc: [], readingTimeMin: 0 }
  }
  const blocks = json.content
  const state: CompileState = { toc: [], wordCount: 0 }

  if (blocks.length === 0) {
    return { html: '', toc: [], readingTimeMin: 0 }
  }

  const parts: string[] = []
  let prevType: string | null = null

  for (const block of blocks) {
    const blockHtml = renderBlock(block, state)
    if (!blockHtml) {
      prevType = block.type ?? prevType
      continue
    }

    const spacingClass = getSpacingClass(prevType, block.type ?? '')

    if (spacingClass) {
      parts.push(`<div class="${spacingClass}">${blockHtml}</div>`)
    } else {
      parts.push(blockHtml)
    }

    prevType = block.type ?? prevType
  }

  const html = parts.join('\n')
  const readingTimeMin = Math.ceil(state.wordCount / 200)

  return {
    html,
    toc: state.toc,
    readingTimeMin,
  }
}
