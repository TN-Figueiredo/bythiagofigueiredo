import type { JSONContent } from '@tiptap/react'
import type { RoteiroBeat, ScriptLine } from './roteiro-schemas'

/**
 * Converts a RoteiroBeat's script lines into TipTap JSONContent
 * for use inside a beat's TipTap editor instance.
 */
export function roteiroToTipTap(beat: RoteiroBeat): JSONContent {
  const children: JSONContent[] = []

  for (const line of beat.script) {
    switch (line.type) {
      case 'line': {
        const marks: JSONContent['marks'] = []
        if (line.accent) {
          marks.push({ type: 'highlight', attrs: { color: line.accent } })
        }
        children.push({
          type: 'paragraph',
          content: [{ type: 'text', text: line.text, ...(marks.length > 0 ? { marks } : {}) }],
        })
        break
      }
      case 'pause': {
        children.push({
          type: 'scriptPause',
          attrs: { duration: line.duration },
        })
        break
      }
      case 'note': {
        children.push({
          type: 'scriptTag',
          attrs: { tag: line.tag },
          content: [{ type: 'text', text: line.text }],
        })
        break
      }
      case 'ref': {
        children.push({
          type: 'blockquote',
          content: [{
            type: 'paragraph',
            content: [
              { type: 'text', text: 'REF ', marks: [{ type: 'bold' }] },
              { type: 'text', text: line.text },
            ],
          }],
        })
        break
      }
    }
  }

  if (children.length === 0) {
    children.push({ type: 'paragraph' })
  }

  return { type: 'doc', content: children }
}

/**
 * Converts TipTap JSONContent back into ScriptLine[].
 * Inverse of roteiroToTipTap.
 */
export function tipTapToRoteiro(json: JSONContent): ScriptLine[] {
  const lines: ScriptLine[] = []
  if (!json.content) return lines

  for (const node of json.content) {
    switch (node.type) {
      case 'scriptTag': {
        const tag = (node.attrs?.tag ?? 'VISUAL') as ScriptLine & { type: 'note' } extends { tag: infer T } ? T : never
        const text = extractText(node)
        if (text) {
          lines.push({ type: 'note', tag: tag as 'VISUAL' | 'DIRECTION' | 'NARRACAO', text })
        }
        break
      }
      case 'scriptPause': {
        const duration = typeof node.attrs?.duration === 'number' ? node.attrs.duration : 0
        lines.push({ type: 'pause', duration })
        break
      }
      case 'blockquote': {
        const text = extractText(node).replace(/^REF\s*/i, '').trim()
        if (text) {
          lines.push({ type: 'ref', text })
        }
        break
      }
      case 'paragraph': {
        const text = extractText(node)
        if (!text) continue
        const firstContent = node.content?.[0]
        const accent = firstContent?.marks?.find(m => m.type === 'highlight')?.attrs?.color as string | undefined
        lines.push({ type: 'line', text, accent })
        break
      }
    }
  }

  return lines
}

function extractText(node: JSONContent): string {
  if (node.text) return node.text
  if (!node.content) return ''
  return node.content.map(extractText).join('')
}
