export type ScriptSegment =
  | { type: 'tag'; tag: 'VISUAL' | 'TOM' | 'B-ROLL' | 'CORTE' | 'OVERLAY' | 'TRANS' | 'DIRECTION' | 'SFX'; content: string }
  | { type: 'narration'; content: string }
  | { type: 'pause'; duration: string }
  | { type: 'section'; label: string; content: string }
  | { type: 'meta'; key: string; value: string }
  | { type: 'text'; content: string }
  | { type: 'blockquote'; content: string }
  | { type: 'bullet-list'; items: string[] }
  | { type: 'separator' }

interface RawMatch {
  start: number
  end: number
  segment: ScriptSegment
}

const TAG_RE = /\[(VISUAL|TOM|B-ROLL|B-ROLLi|CORTE|OVERLAY|TRANS|DIRECTION|SFX|DIREÇÃO):\s*(.+?)\]/g
const PAUSE_RE = /\[PAUS[EA]\s+([\d.]+s)\]/g
const QUOTE_RE = /"([^"]+)"/g
const SECTION_RE = /(?:^|\n)\s*(MINI-HOOK|TALKING POINTS|TRANSITION):\s*([\s\S]+?)(?=\n\s*(?:MINI-HOOK|TALKING POINTS|TRANSITION|Promessa|Credencial|\[)|$)/g
const META_RE = /(?:^|\n)\s*(Promessa|Credencial):\s*(.+?)$/gm

function stripMarkdownTagWrapping(text: string): string {
  return text.replace(/\*\*(\[[A-ZÇÃ\-]+[:\s][\s\S]*?\])\*\*/g, '$1')
}

function collectMatches(text: string): RawMatch[] {
  const matches: RawMatch[] = []

  TAG_RE.lastIndex = 0
  let m: RegExpExecArray | null
  type TagName = Extract<ScriptSegment, { type: 'tag' }>['tag']
  while ((m = TAG_RE.exec(text)) !== null) {
    let rawTag = m[1]!.replace(/i$/, '')
    if (rawTag === 'DIREÇÃO') rawTag = 'DIRECTION'
    let tag = rawTag as TagName
    const content = m[2]!
    if (tag === 'VISUAL' && /^(Text overlay|Lower third)/i.test(content)) {
      tag = 'OVERLAY' as typeof tag
    }
    matches.push({ start: m.index, end: m.index + m[0].length, segment: { type: 'tag', tag, content } })
  }

  PAUSE_RE.lastIndex = 0
  while ((m = PAUSE_RE.exec(text)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length, segment: { type: 'pause', duration: m[1]! } })
  }

  SECTION_RE.lastIndex = 0
  while ((m = SECTION_RE.exec(text)) !== null) {
    const label = m[1]!
    const content = m[2]!.trim()
    matches.push({ start: m.index, end: m.index + m[0].length, segment: { type: 'section', label, content } })
  }

  META_RE.lastIndex = 0
  while ((m = META_RE.exec(text)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length, segment: { type: 'meta', key: m[1]!, value: m[2]!.trim() } })
  }

  matches.sort((a, b) => a.start - b.start)
  return matches
}

export function parseScriptTags(text: string): ScriptSegment[] {
  if (!text) return []
  text = stripMarkdownTagWrapping(text)

  const structuralMatches = collectMatches(text)
  if (structuralMatches.length === 0) {
    return parseGapText(text)
  }

  const merged: RawMatch[] = []
  for (const rm of structuralMatches) {
    if (merged.length > 0 && rm.start < merged[merged.length - 1]!.end) continue
    merged.push(rm)
  }

  const segments: ScriptSegment[] = []
  let cursor = 0

  for (const rm of merged) {
    if (rm.start > cursor) {
      const gap = text.slice(cursor, rm.start).trim()
      if (gap) {
        for (const seg of parseGapText(gap)) segments.push(seg)
      }
    }
    segments.push(rm.segment)
    cursor = rm.end
  }

  if (cursor < text.length) {
    const tail = text.slice(cursor).trim()
    if (tail) {
      for (const seg of parseGapText(tail)) segments.push(seg)
    }
  }

  return segments
}

function parseInlineText(text: string): ScriptSegment[] {
  const segments: ScriptSegment[] = []
  QUOTE_RE.lastIndex = 0
  let cursor = 0
  let m: RegExpExecArray | null
  while ((m = QUOTE_RE.exec(text)) !== null) {
    if (m.index > cursor) {
      const pre = text.slice(cursor, m.index).trim()
      if (pre) segments.push({ type: 'text', content: pre })
    }
    segments.push({ type: 'narration', content: m[1]! })
    cursor = m.index + m[0].length
  }
  if (cursor === 0) {
    segments.push({ type: 'text', content: text })
  } else if (cursor < text.length) {
    const tail = text.slice(cursor).trim()
    if (tail) segments.push({ type: 'text', content: tail })
  }
  return segments
}

function parseGapText(text: string): ScriptSegment[] {
  const segments: ScriptSegment[] = []
  const lines = text.split('\n')
  let buffer: string[] = []
  let mode: 'none' | 'bullet' = 'none'

  function flushBuffer() {
    if (buffer.length === 0) return
    if (mode === 'bullet') {
      segments.push({ type: 'bullet-list', items: buffer.map(b => b.replace(/^-\s*/, '')) })
    } else {
      const joined = buffer.join('\n').trim()
      if (joined) {
        for (const seg of parseInlineText(joined)) segments.push(seg)
      }
    }
    buffer = []
    mode = 'none'
  }

  const SEPARATOR_RE = /^[═─—=\-_~]{3,}$/

  for (const line of lines) {
    const trimmed = line.trim()
    if (SEPARATOR_RE.test(trimmed)) {
      flushBuffer()
      segments.push({ type: 'separator' })
    } else if (trimmed.startsWith('> ')) {
      flushBuffer()
      const content = trimmed.slice(2).trim()
      if (content) segments.push({ type: 'blockquote', content })
    } else if (trimmed.startsWith('- ')) {
      if (mode !== 'bullet') flushBuffer()
      mode = 'bullet'
      buffer.push(trimmed)
    } else {
      if (mode === 'bullet') flushBuffer()
      mode = 'none'
      buffer.push(line)
    }
  }
  flushBuffer()
  return segments
}
