# Pipeline Renderer Visual Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visual hierarchy to ScriptRenderer and SceneGuideRenderer so video editors can scan editing instructions at a glance — colored tag pills, narration blocks, timeline layout, inline token highlights.

**Architecture:** Pure renderer-level changes — no data model or API changes. A shared `tokens.tsx` provides reusable inline components (TagPill, TimestampChip, etc.). A shared `parse-tokens.tsx` provides regex-based text parsing used by both renderers. ScriptRenderer gets `parseScriptTags()` for beat text → segment array. SceneGuideRenderer gets `categorizeNote()` for edit_notes heuristic classification + timeline layout.

**Tech Stack:** React 19, TypeScript 5, Tailwind 4, Vitest

---

## Dependency Graph

```
Task 1 (tokens.tsx)        ─┐
Task 2 (parse-tokens.tsx)   ├──> Task 5 (ScriptRenderer)
Task 3 (parse-script-tags)  ┘
                          
Task 1 (tokens.tsx)        ─┐
Task 2 (parse-tokens.tsx)   ├──> Task 6 (SceneGuideRenderer)
Task 4 (categorize-note)    ┘

Task 5 + Task 6 ──────────> Task 7 (validation)
```

**Maximum parallelism:** Tasks 1+3+4 can run simultaneously (Task 1 is pure UI, Tasks 3 and 4 are pure logic with no shared deps). Task 2 depends on Task 1 for the types. Tasks 5 and 6 can run in parallel once their dependencies complete. Task 7 is the final gate.

---

### Task 1: Shared Token Components (`tokens.tsx`)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/tokens.tsx`
- Test: `apps/web/test/app/cms/pipeline/renderers/tokens.test.tsx`

This task creates all the reusable inline visual components used by both renderers: TagPill, TimestampChip, DbChip, PauseChip, NegHighlight, EmphHighlight, OptionalBadge. Also exports the TAG_COLORS constant.

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/app/cms/pipeline/renderers/tokens.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import {
  TagPill,
  TimestampChip,
  DbChip,
  PauseChip,
  NegHighlight,
  EmphHighlight,
  OptionalBadge,
  TAG_COLORS,
} from '@/app/cms/(authed)/pipeline/_components/detail/renderers/tokens'

describe('TAG_COLORS', () => {
  it('has entries for all 8 tag types', () => {
    const expected = ['VISUAL', 'TOM', 'B-ROLL', 'CORTE', 'OVERLAY', 'TRANS', 'MUSIC', 'STYLE', 'TIMING', 'ENTRY', 'FLOW', 'NOTE']
    for (const tag of expected) {
      expect(TAG_COLORS[tag]).toBeDefined()
      expect(TAG_COLORS[tag].pill.bg).toBeTruthy()
      expect(TAG_COLORS[tag].pill.color).toBeTruthy()
      expect(TAG_COLORS[tag].text).toBeTruthy()
    }
  })
})

describe('TagPill', () => {
  it('renders the tag name with correct background', () => {
    const { container } = render(<TagPill tag="VISUAL" />)
    const pill = container.firstElementChild as HTMLElement
    expect(pill.textContent).toBe('VISUAL')
    expect(pill.style.background).toBe(TAG_COLORS.VISUAL.pill.bg)
    expect(pill.style.color).toBe(TAG_COLORS.VISUAL.pill.color)
  })

  it('falls back to NOTE styling for unknown tags', () => {
    const { container } = render(<TagPill tag="UNKNOWN" />)
    const pill = container.firstElementChild as HTMLElement
    expect(pill.style.background).toBe(TAG_COLORS.NOTE.pill.bg)
  })
})

describe('TimestampChip', () => {
  it('renders timestamp in monospace', () => {
    const { container } = render(<TimestampChip ts="01:42" />)
    const chip = container.firstElementChild as HTMLElement
    expect(chip.textContent).toBe('01:42')
    expect(chip.className).toContain('font-mono')
  })
})

describe('DbChip', () => {
  it('renders dB value', () => {
    const { container } = render(<DbChip value="-20dB" />)
    expect(container.textContent).toBe('-20dB')
  })
})

describe('PauseChip', () => {
  it('renders pause with duration', () => {
    const { container } = render(<PauseChip duration="0.5s" />)
    expect(container.textContent).toContain('0.5s')
    expect(container.textContent).toContain('⏸')
  })
})

describe('NegHighlight', () => {
  it('renders with red styling', () => {
    const { container } = render(<NegHighlight text="NÃO" />)
    const el = container.firstElementChild as HTMLElement
    expect(el.textContent).toBe('NÃO')
    expect(el.style.color).toBe('#f87171')
  })
})

describe('EmphHighlight', () => {
  it('renders with yellow bold', () => {
    const { container } = render(<EmphHighlight text="HAVE" />)
    const el = container.firstElementChild as HTMLElement
    expect(el.textContent).toBe('HAVE')
    expect(el.style.color).toBe('#fbbf24')
  })
})

describe('OptionalBadge', () => {
  it('renders OPT text', () => {
    const { container } = render(<OptionalBadge />)
    expect(container.textContent).toBe('OPT')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/tokens.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/tokens.tsx`:

```tsx
export const TAG_COLORS: Record<string, { pill: { bg: string; color: string; border: string }; text: string }> = {
  VISUAL:  { pill: { bg: '#7c3aed20', color: '#a78bfa', border: '#7c3aed30' }, text: '#c4b5fd' },
  TOM:     { pill: { bg: '#0ea5e920', color: '#67e8f9', border: '#0ea5e930' }, text: '#a5f3fc' },
  'B-ROLL': { pill: { bg: '#10b98120', color: '#6ee7b7', border: '#10b98130' }, text: '#a7f3d0' },
  CORTE:   { pill: { bg: '#f4363620', color: '#fca5a5', border: '#f4363630' }, text: '#fecaca' },
  OVERLAY: { pill: { bg: '#ec489920', color: '#f9a8d4', border: '#ec489930' }, text: '#fbcfe8' },
  TRANS:   { pill: { bg: '#f59e0b20', color: '#fbbf24', border: '#f59e0b30' }, text: '#fde68a' },
  MUSIC:   { pill: { bg: '#a855f720', color: '#c084fc', border: '#a855f730' }, text: '#d8b4fe' },
  STYLE:   { pill: { bg: '#0ea5e920', color: '#67e8f9', border: '#0ea5e930' }, text: '#a5f3fc' },
  TIMING:  { pill: { bg: '#818cf820', color: '#a5b4fc', border: '#818cf830' }, text: '#c7d2fe' },
  ENTRY:   { pill: { bg: '#818cf820', color: '#a5b4fc', border: '#818cf830' }, text: '#c7d2fe' },
  FLOW:    { pill: { bg: '#f59e0b20', color: '#fbbf24', border: '#f59e0b30' }, text: '#fde68a' },
  NOTE:    { pill: { bg: '#64748b18', color: '#94a3b8', border: '#64748b25' }, text: '#94a3b8' },
}

export function TagPill({ tag }: { tag: string }) {
  const c = TAG_COLORS[tag] ?? TAG_COLORS.NOTE
  return (
    <span
      className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide shrink-0 whitespace-nowrap"
      style={{ background: c.pill.bg, color: c.pill.color, border: `1px solid ${c.pill.border}`, minWidth: 50 }}
    >
      {tag}
    </span>
  )
}

export function TimestampChip({ ts }: { ts: string }) {
  return (
    <span
      className="font-mono text-[10px] font-semibold px-1 py-px rounded mr-1"
      style={{ color: '#818cf8', background: '#818cf810', border: '1px solid #818cf815' }}
    >
      {ts}
    </span>
  )
}

export function DbChip({ value }: { value: string }) {
  return (
    <span
      className="font-mono text-[10px] font-semibold px-1 py-px rounded"
      style={{ color: '#fbbf24', background: '#f59e0b10' }}
    >
      {value}
    </span>
  )
}

export function PauseChip({ duration }: { duration: string }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 font-mono text-[10px] font-semibold px-2 py-0.5 rounded align-middle mx-0.5"
      style={{ color: '#fbbf24', background: '#f59e0b18', border: '1px solid #f59e0b20' }}
    >
      ⏸ {duration}
    </span>
  )
}

export function NegHighlight({ text }: { text: string }) {
  return (
    <span
      className="font-bold px-1 rounded"
      style={{ color: '#f87171', background: '#f8717110', border: '1px solid #f8717120' }}
    >
      {text}
    </span>
  )
}

export function EmphHighlight({ text }: { text: string }) {
  return (
    <span className="font-bold uppercase" style={{ color: '#fbbf24' }}>
      {text}
    </span>
  )
}

export function OptionalBadge() {
  return (
    <span
      className="text-[8px] font-semibold uppercase tracking-wide px-1.5 py-px rounded mr-1"
      style={{ color: '#64748b', background: '#64748b15' }}
    >
      OPT
    </span>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/tokens.test.tsx`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/tokens.tsx apps/web/test/app/cms/pipeline/renderers/tokens.test.tsx
git commit -m "feat(pipeline): add shared token components for renderer visual hierarchy"
```

---

### Task 2: Shared Parse-Tokens Utility (`parse-tokens.tsx`)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/parse-tokens.tsx`
- Test: `apps/web/test/app/cms/pipeline/renderers/parse-tokens.test.tsx`

This task creates the inline token parser that converts a plain text string into a React node array with highlighted timestamps, dB values, negations, and emphasis. Used by both renderers.

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/app/cms/pipeline/renderers/parse-tokens.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { tokenizeText } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/parse-tokens'

describe('tokenizeText', () => {
  it('returns plain text unchanged when no tokens match', () => {
    const { container } = render(<span>{tokenizeText('hello world')}</span>)
    expect(container.textContent).toBe('hello world')
  })

  it('highlights timestamps like 01:42', () => {
    const { container } = render(<span>{tokenizeText('At 01:42 do something')}</span>)
    const chips = container.querySelectorAll('.font-mono')
    expect(chips.length).toBe(1)
    expect(chips[0].textContent).toBe('01:42')
  })

  it('highlights timestamp ranges like 00:00-00:03', () => {
    const { container } = render(<span>{tokenizeText('00:00-00:03: montage')}</span>)
    const chips = container.querySelectorAll('.font-mono')
    expect(chips.length).toBe(1)
    expect(chips[0].textContent).toBe('00:00-00:03')
  })

  it('highlights dB values like -20dB', () => {
    const { container } = render(<span>{tokenizeText('volume at -20dB under voice')}</span>)
    expect(container.textContent).toContain('-20dB')
    const dbChips = container.querySelectorAll('[style*="fbbf24"]')
    expect(dbChips.length).toBeGreaterThanOrEqual(1)
  })

  it('highlights NÃO as negative', () => {
    const { container } = render(<span>{tokenizeText('NÃO dramático')}</span>)
    const neg = container.querySelector('[style*="f87171"]')
    expect(neg).toBeTruthy()
    expect(neg!.textContent).toBe('NÃO')
  })

  it('highlights not (case-insensitive, word boundary) as negative', () => {
    const { container } = render(<span>{tokenizeText('feel deliberate, not dramatic')}</span>)
    const neg = container.querySelector('[style*="f87171"]')
    expect(neg).toBeTruthy()
    expect(neg!.textContent).toBe('not')
  })

  it('does not highlight "not" inside other words like "nothing"', () => {
    const { container } = render(<span>{tokenizeText('nothing to worry about notation')}</span>)
    const negs = container.querySelectorAll('[style*="f87171"]')
    expect(negs.length).toBe(0)
  })

  it('handles multiple tokens in one string', () => {
    const { container } = render(<span>{tokenizeText('At 01:42 drop to -25dB, NÃO silence')}</span>)
    expect(container.querySelectorAll('.font-mono').length).toBeGreaterThanOrEqual(1)
    expect(container.querySelector('[style*="f87171"]')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/parse-tokens.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/parse-tokens.tsx`:

```tsx
import type { ReactNode } from 'react'
import { TimestampChip, DbChip, NegHighlight } from './tokens'

interface Token {
  type: 'text' | 'timestamp' | 'db' | 'neg'
  value: string
  start: number
  end: number
}

const PATTERNS: { type: Token['type']; re: RegExp }[] = [
  { type: 'timestamp', re: /\d{2}:\d{2}(?:[-–]\d{2}:\d{2})?/g },
  { type: 'db', re: /-?\d+dB/g },
  { type: 'neg', re: /\b(NÃO|[Nn]ot)\b/g },
]

function findTokens(text: string): Token[] {
  const tokens: Token[] = []
  for (const { type, re } of PATTERNS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      tokens.push({ type, value: m[0], start: m.index, end: m.index + m[0].length })
    }
  }
  tokens.sort((a, b) => a.start - b.start)
  const merged: Token[] = []
  for (const t of tokens) {
    if (merged.length > 0 && t.start < merged[merged.length - 1].end) continue
    merged.push(t)
  }
  return merged
}

export function tokenizeText(text: string): ReactNode[] {
  const tokens = findTokens(text)
  if (tokens.length === 0) return [text]

  const parts: ReactNode[] = []
  let cursor = 0
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.start > cursor) {
      parts.push(text.slice(cursor, t.start))
    }
    switch (t.type) {
      case 'timestamp':
        parts.push(<TimestampChip key={`ts-${i}`} ts={t.value} />)
        break
      case 'db':
        parts.push(<DbChip key={`db-${i}`} value={t.value} />)
        break
      case 'neg':
        parts.push(<NegHighlight key={`neg-${i}`} text={t.value} />)
        break
    }
    cursor = t.end
  }
  if (cursor < text.length) {
    parts.push(text.slice(cursor))
  }
  return parts
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/parse-tokens.test.tsx`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/parse-tokens.tsx apps/web/test/app/cms/pipeline/renderers/parse-tokens.test.tsx
git commit -m "feat(pipeline): add inline token parser for timestamps, dB, negations"
```

---

### Task 3: Script Tag Parser (`parse-script-tags.ts`)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/parse-script-tags.ts`
- Test: `apps/web/test/app/cms/pipeline/renderers/parse-script-tags.test.ts`

Pure function — no React dependency. Parses beat text into an ordered segment array. Can run in parallel with Tasks 1 and 4.

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/app/cms/pipeline/renderers/parse-script-tags.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseScriptTags, type ScriptSegment } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/parse-script-tags'

describe('parseScriptTags', () => {
  it('parses [VISUAL: ...] tag', () => {
    const segments = parseScriptTags('[VISUAL: talking head + fotos]')
    expect(segments).toEqual([{ type: 'tag', tag: 'VISUAL', content: 'talking head + fotos' }])
  })

  it('parses [TOM: ...] tag', () => {
    const segments = parseScriptTags('[TOM: calmo, confiante]')
    expect(segments).toEqual([{ type: 'tag', tag: 'TOM', content: 'calmo, confiante' }])
  })

  it('parses [B-ROLL: ...] tag', () => {
    const segments = parseScriptTags('[B-ROLL: fotos do Canada]')
    expect(segments).toEqual([{ type: 'tag', tag: 'B-ROLL', content: 'fotos do Canada' }])
  })

  it('parses [CORTE: ...] tag', () => {
    const segments = parseScriptTags('[CORTE: intercalar talking head]')
    expect(segments).toEqual([{ type: 'tag', tag: 'CORTE', content: 'intercalar talking head' }])
  })

  it('parses [PAUSE 0.5s]', () => {
    const segments = parseScriptTags('[PAUSE 0.5s]')
    expect(segments).toEqual([{ type: 'pause', duration: '0.5s' }])
  })

  it('promotes VISUAL to OVERLAY when content starts with "Text overlay"', () => {
    const segments = parseScriptTags('[VISUAL: Text overlay (large, center): "Am I here"]')
    expect(segments[0]).toEqual({ type: 'tag', tag: 'OVERLAY', content: 'Text overlay (large, center): "Am I here"' })
  })

  it('promotes VISUAL to OVERLAY when content starts with "Lower third"', () => {
    const segments = parseScriptTags('[VISUAL: Lower third with channel name]')
    expect(segments[0]).toEqual({ type: 'tag', tag: 'OVERLAY', content: 'Lower third with channel name' })
  })

  it('extracts quoted narration', () => {
    const segments = parseScriptTags('"I lived in Canada for four years."')
    expect(segments).toEqual([{ type: 'narration', content: 'I lived in Canada for four years.' }])
  })

  it('parses TRANSITION: as section', () => {
    const segments = parseScriptTags('TRANSITION: "And that realization..."')
    expect(segments[0]).toEqual({ type: 'section', label: 'TRANSITION', content: '"And that realization..."' })
  })

  it('parses MINI-HOOK: as section', () => {
    const segments = parseScriptTags('MINI-HOOK: "Let me take you back"')
    expect(segments[0]).toEqual({ type: 'section', label: 'MINI-HOOK', content: '"Let me take you back"' })
  })

  it('parses TALKING POINTS: as section', () => {
    const segments = parseScriptTags('TALKING POINTS: • The arrival')
    expect(segments[0]).toEqual({ type: 'section', label: 'TALKING POINTS', content: '• The arrival' })
  })

  it('parses Promessa: as meta', () => {
    const segments = parseScriptTags('Promessa: Why each move → the plan')
    expect(segments).toEqual([{ type: 'meta', key: 'Promessa', value: 'Why each move → the plan' }])
  })

  it('parses Credencial: as meta', () => {
    const segments = parseScriptTags('Credencial: Implícita — experiência real')
    expect(segments).toEqual([{ type: 'meta', key: 'Credencial', value: 'Implícita — experiência real' }])
  })

  it('handles a complex beat with mixed content', () => {
    const text = '[VISUAL: 3s — montage] [TOM: calmo, NÃO dramático] "I lived in Canada" [PAUSE 0.5s] "I chose to move back"'
    const segments = parseScriptTags(text)

    expect(segments[0]).toMatchObject({ type: 'tag', tag: 'VISUAL' })
    expect(segments[1]).toMatchObject({ type: 'tag', tag: 'TOM' })
    expect(segments[2]).toMatchObject({ type: 'narration', content: 'I lived in Canada' })
    expect(segments[3]).toMatchObject({ type: 'pause', duration: '0.5s' })
    expect(segments[4]).toMatchObject({ type: 'narration', content: 'I chose to move back' })
  })

  it('returns plain text as a single text segment when no tags found', () => {
    const segments = parseScriptTags('Just some plain text without any tags')
    expect(segments).toEqual([{ type: 'text', content: 'Just some plain text without any tags' }])
  })

  it('handles empty string', () => {
    expect(parseScriptTags('')).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/parse-script-tags.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/parse-script-tags.ts`:

```ts
export type ScriptSegment =
  | { type: 'tag'; tag: 'VISUAL' | 'TOM' | 'B-ROLL' | 'CORTE' | 'OVERLAY' | 'TRANS'; content: string }
  | { type: 'narration'; content: string }
  | { type: 'pause'; duration: string }
  | { type: 'section'; label: string; content: string }
  | { type: 'meta'; key: string; value: string }
  | { type: 'text'; content: string }

interface RawMatch {
  start: number
  end: number
  segment: ScriptSegment
}

const TAG_RE = /\[(VISUAL|TOM|B-ROLL|B-ROLLi|CORTE):\s*(.+?)\]/g
const PAUSE_RE = /\[PAUSE\s+([\d.]+s)\]/g
const QUOTE_RE = /"([^"]+)"/g
const SECTION_RE = /(?:^|\n)\s*(MINI-HOOK|TALKING POINTS|TRANSITION):\s*(.+?)(?=\n\s*(?:MINI-HOOK|TALKING POINTS|TRANSITION|Promessa|Credencial|\[)|$)/gs
const META_RE = /(?:^|\n)\s*(Promessa|Credencial):\s*(.+?)$/gm

function collectMatches(text: string): RawMatch[] {
  const matches: RawMatch[] = []

  TAG_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TAG_RE.exec(text)) !== null) {
    let tag = m[1].replace(/i$/, '') as ScriptSegment & { type: 'tag' } extends { tag: infer T } ? T : never
    const content = m[2]
    if (tag === 'VISUAL' && /^(Text overlay|Lower third)/i.test(content)) {
      tag = 'OVERLAY' as typeof tag
    }
    matches.push({ start: m.index, end: m.index + m[0].length, segment: { type: 'tag', tag, content } })
  }

  PAUSE_RE.lastIndex = 0
  while ((m = PAUSE_RE.exec(text)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length, segment: { type: 'pause', duration: m[1] } })
  }

  SECTION_RE.lastIndex = 0
  while ((m = SECTION_RE.exec(text)) !== null) {
    const label = m[1]
    const content = m[2].trim()
    matches.push({ start: m.index, end: m.index + m[0].length, segment: { type: 'section', label, content } })
  }

  META_RE.lastIndex = 0
  while ((m = META_RE.exec(text)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length, segment: { type: 'meta', key: m[1], value: m[2].trim() } })
  }

  matches.sort((a, b) => a.start - b.start)
  return matches
}

export function parseScriptTags(text: string): ScriptSegment[] {
  if (!text) return []

  const structuralMatches = collectMatches(text)
  if (structuralMatches.length === 0) {
    QUOTE_RE.lastIndex = 0
    const qm = QUOTE_RE.exec(text)
    if (qm) {
      return [{ type: 'narration', content: qm[1] }]
    }
    return [{ type: 'text', content: text }]
  }

  const merged: RawMatch[] = []
  for (const rm of structuralMatches) {
    if (merged.length > 0 && rm.start < merged[merged.length - 1].end) continue
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

function parseGapText(text: string): ScriptSegment[] {
  const segments: ScriptSegment[] = []
  QUOTE_RE.lastIndex = 0
  let cursor = 0
  let m: RegExpExecArray | null
  while ((m = QUOTE_RE.exec(text)) !== null) {
    if (m.index > cursor) {
      const pre = text.slice(cursor, m.index).trim()
      if (pre) segments.push({ type: 'text', content: pre })
    }
    segments.push({ type: 'narration', content: m[1] })
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/parse-script-tags.test.ts`
Expected: All 16 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/parse-script-tags.ts apps/web/test/app/cms/pipeline/renderers/parse-script-tags.test.ts
git commit -m "feat(pipeline): add script tag parser (beat text → typed segments)"
```

---

### Task 4: Note Categorizer (`categorize-note.ts`)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/categorize-note.ts`
- Test: `apps/web/test/app/cms/pipeline/renderers/categorize-note.test.ts`

Pure function — no React dependency. Categorizes a scene edit_note string by content heuristic. Also extracts the first timestamp for timeline sorting. Can run in parallel with Tasks 1 and 3.

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/app/cms/pipeline/renderers/categorize-note.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { categorizeNote, type NoteCategory } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/categorize-note'

describe('categorizeNote', () => {
  it('detects OVERLAY from "Text overlay" keyword', () => {
    expect(categorizeNote('01:42: Text overlay (large, center): "Am I here"')).toMatchObject({ category: 'OVERLAY' })
  })

  it('detects OVERLAY from "lower third" keyword', () => {
    expect(categorizeNote('00:10: Lower third with channel name')).toMatchObject({ category: 'OVERLAY' })
  })

  it('detects MUSIC from mood/genre/BPM keywords', () => {
    expect(categorizeNote('Search Artist: Mood: Mysterious | Genre: Ambient | BPM: 60-80')).toMatchObject({ category: 'MUSIC' })
  })

  it('detects MUSIC from "track" keyword', () => {
    expect(categorizeNote('Track change here. Fade out ambient')).toMatchObject({ category: 'MUSIC' })
  })

  it('detects STYLE from "style:" keyword', () => {
    expect(categorizeNote('Style: Minimal dark pads, subtle low drone')).toMatchObject({ category: 'STYLE' })
  })

  it('detects STYLE from "feel" keyword', () => {
    expect(categorizeNote('Needs to feel deliberate and cinematic')).toMatchObject({ category: 'STYLE' })
  })

  it('detects TIMING from "entry:" keyword', () => {
    expect(categorizeNote('Entry: 00:00, fade in 1s, -20dB')).toMatchObject({ category: 'ENTRY' })
  })

  it('detects TIMING when note starts with timestamp', () => {
    expect(categorizeNote('01:42 Drop music volume to -25dB')).toMatchObject({ category: 'TIMING' })
  })

  it('detects VISUAL from "montage" keyword', () => {
    expect(categorizeNote('00:00-00:03: Consider 3-photo montage')).toMatchObject({ category: 'VISUAL' })
  })

  it('detects VISUAL from "B-roll" keyword', () => {
    expect(categorizeNote('00:20: Optional — B-roll photos of Canada')).toMatchObject({ category: 'VISUAL' })
  })

  it('detects FLOW from "continues" keyword', () => {
    expect(categorizeNote('Continues into Beat 1 — don\'t change track here')).toMatchObject({ category: 'FLOW' })
  })

  it('detects FLOW from "same track" keyword', () => {
    expect(categorizeNote('Same track, volume stays at -20dB')).toMatchObject({ category: 'FLOW' })
  })

  it('falls back to NOTE for unrecognized content', () => {
    expect(categorizeNote('Remember to check the color grading')).toMatchObject({ category: 'NOTE' })
  })

  it('extracts first timestamp from note', () => {
    const result = categorizeNote('01:42: Text overlay "something"')
    expect(result.timestamp).toBe('01:42')
  })

  it('extracts timestamp range', () => {
    const result = categorizeNote('00:00-00:03: Consider montage')
    expect(result.timestamp).toBe('00:00-00:03')
  })

  it('returns null timestamp when no timestamp found', () => {
    const result = categorizeNote('Style: Minimal dark pads')
    expect(result.timestamp).toBeNull()
  })

  it('detects optional notes', () => {
    const result = categorizeNote('Optional — B-roll photos of Canada')
    expect(result.isOptional).toBe(true)
  })

  it('non-optional notes return false', () => {
    const result = categorizeNote('Text overlay: something important')
    expect(result.isOptional).toBe(false)
  })

  it('OVERLAY takes priority over VISUAL for "Text overlay"', () => {
    expect(categorizeNote('Text overlay with Ken Burns photo montage')).toMatchObject({ category: 'OVERLAY' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/categorize-note.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/categorize-note.ts`:

```ts
export type NoteCategory = 'MUSIC' | 'STYLE' | 'TIMING' | 'ENTRY' | 'VISUAL' | 'OVERLAY' | 'FLOW' | 'NOTE'

export interface CategorizedNote {
  category: NoteCategory
  text: string
  timestamp: string | null
  isOptional: boolean
}

const TS_RE = /\d{2}:\d{2}(?:[-–]\d{2}:\d{2})?/

const RULES: { category: NoteCategory; test: (t: string) => boolean }[] = [
  { category: 'OVERLAY', test: t => /text overlay|lower third/i.test(t) },
  { category: 'MUSIC',   test: t => /search artist|mood:|genre:|bpm[:\s]|track change|new track/i.test(t) },
  { category: 'STYLE',   test: t => /^style:|needs? to feel|think\s+["']/i.test(t) },
  { category: 'ENTRY',   test: t => /^entry:/i.test(t) },
  { category: 'TIMING',  test: t => /^(\d{2}:\d{2})|fade in|fade out/i.test(t) },
  { category: 'VISUAL',  test: t => /montage|ken burns|b-roll|photo/i.test(t) },
  { category: 'FLOW',    test: t => /continues?|don['']t change|same track|track change/i.test(t) },
]

export function categorizeNote(text: string): CategorizedNote {
  const lower = text.toLowerCase()
  let category: NoteCategory = 'NOTE'
  for (const rule of RULES) {
    if (rule.test(lower)) {
      category = rule.category
      break
    }
  }

  const tsMatch = text.match(TS_RE)
  const isOptional = /^optional\b/i.test(text.trim())

  return { category, text, timestamp: tsMatch ? tsMatch[0] : null, isOptional }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/categorize-note.test.ts`
Expected: All 19 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/categorize-note.ts apps/web/test/app/cms/pipeline/renderers/categorize-note.test.ts
git commit -m "feat(pipeline): add edit_notes category detection for scene guide"
```

---

### Task 5: Rewrite ScriptRenderer

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/script-renderer.tsx`
- Test: `apps/web/test/app/cms/pipeline/renderers/script-renderer.test.tsx`

**Depends on:** Task 1 (tokens.tsx), Task 2 (parse-tokens.tsx), Task 3 (parse-script-tags.ts)

Replaces the raw `contentEditable` text with parsed, color-coded segments. Preserves existing edit mode behavior (raw text when `isEditing=true`).

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/app/cms/pipeline/renderers/script-renderer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScriptRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/script-renderer'

const noop = vi.fn()

const BEAT_WITH_TAGS = {
  meta: { canal: 'EN', formato: 'Storytelling' },
  beats: [
    {
      number: 0,
      label: 'HOOK — Triple Curiosity Gap',
      status: 'GRAVADO',
      text: '[VISUAL: 3s — montage rápida] [TOM: calmo, NÃO dramático] "I lived in Canada for four years." [PAUSE 0.5s] "I chose to move back."',
    },
  ],
}

describe('ScriptRenderer — read mode', () => {
  it('renders tag pills for VISUAL and TOM', () => {
    const { container } = render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />
    )
    const pills = container.querySelectorAll('[class*="uppercase"]')
    const pillTexts = Array.from(pills).map(p => p.textContent)
    expect(pillTexts).toContain('VISUAL')
    expect(pillTexts).toContain('TOM')
  })

  it('renders narration blocks with border', () => {
    const { container } = render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />
    )
    const narrations = container.querySelectorAll('[class*="narration"]')
    expect(narrations.length).toBeGreaterThanOrEqual(1)
    expect(narrations[0].textContent).toContain('I lived in Canada')
  })

  it('renders pause chips', () => {
    const { container } = render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(container.textContent).toContain('⏸')
    expect(container.textContent).toContain('0.5s')
  })

  it('highlights NÃO in red', () => {
    const { container } = render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />
    )
    const neg = container.querySelector('[style*="f87171"]')
    expect(neg).toBeTruthy()
    expect(neg!.textContent).toBe('NÃO')
  })

  it('renders beat header with number, label, and status', () => {
    render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(screen.getByText('#0')).toBeTruthy()
    expect(screen.getByText('HOOK — Triple Curiosity Gap')).toBeTruthy()
  })

  it('renders meta grid when meta is present', () => {
    const { container } = render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(container.textContent).toContain('Canal')
    expect(container.textContent).toContain('EN')
  })
})

describe('ScriptRenderer — edit mode', () => {
  it('shows raw text in contentEditable when isEditing=true', () => {
    const { container } = render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={true} lang="en" onContentChange={noop} />
    )
    const editable = container.querySelector('[contenteditable="true"]')
    expect(editable).toBeTruthy()
    expect(editable!.textContent).toContain('[VISUAL:')
  })

  it('does NOT render tag pills in edit mode', () => {
    const { container } = render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={true} lang="en" onContentChange={noop} />
    )
    const pills = Array.from(container.querySelectorAll('[class*="uppercase"]')).filter(el => el.textContent === 'VISUAL')
    expect(pills.length).toBe(0)
  })
})

describe('ScriptRenderer — edge cases', () => {
  it('handles beats with no tags as plain text', () => {
    const content = { beats: [{ number: 1, label: 'Beat 1', text: 'Just plain text here' }] }
    const { container } = render(
      <ScriptRenderer content={content} isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(container.textContent).toContain('Just plain text here')
  })

  it('handles empty beats array', () => {
    const { container } = render(
      <ScriptRenderer content={{ beats: [] }} isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(container.textContent).toContain('Nenhum beat')
  })

  it('handles string content fallback', () => {
    const { container } = render(
      <ScriptRenderer content="raw string content" isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(container.textContent).toContain('raw string content')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/script-renderer.test.tsx`
Expected: FAIL — the current renderer doesn't render tag pills

- [ ] **Step 3: Rewrite `script-renderer.tsx`**

Replace the full content of `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/script-renderer.tsx`:

```tsx
'use client'

import { useMemo } from 'react'
import type { RendererProps } from '../section-content'
import { StatusBadge } from './status-badge'
import { TagPill, PauseChip, EmphHighlight, TAG_COLORS } from './tokens'
import { tokenizeText } from './parse-tokens'
import { parseScriptTags, type ScriptSegment } from './parse-script-tags'

interface ScriptMeta {
  canal?: string
  formato?: string
  angulos?: string
  duracao?: string
  framework?: string
  fonte_vvs?: string
}

interface Beat {
  number: number
  label: string
  text: string
  status?: string
  divergence_note?: string
}

interface ScriptContent {
  meta?: ScriptMeta
  beats?: Beat[]
}

function parseContent(content: RendererProps['content']): ScriptContent {
  if (typeof content === 'string') return { beats: [{ number: 1, label: 'Beat 1', text: content, status: undefined }] }
  if (Array.isArray(content) || content === null) return {}
  return content as ScriptContent
}

function SegmentRenderer({ segment }: { segment: ScriptSegment }) {
  switch (segment.type) {
    case 'tag': {
      const textColor = TAG_COLORS[segment.tag]?.text ?? TAG_COLORS.NOTE.text
      return (
        <div className="tag-line flex items-start gap-2 py-1 px-1 rounded transition-colors hover:bg-white/[0.03]">
          <TagPill tag={segment.tag} />
          <span className="text-[11.5px] leading-relaxed" style={{ color: textColor }}>
            {tokenizeText(segment.content)}
          </span>
        </div>
      )
    }
    case 'narration': {
      const parts = segment.content.split(/\b([A-Z]{3,})\b/g)
      return (
        <div
          className="narration text-[13px] leading-[1.85] py-2.5 px-3.5 my-1.5 rounded-r"
          style={{
            color: '#f1f5f9',
            background: 'linear-gradient(90deg, rgba(30,41,59,0.31), transparent 80%)',
            borderLeft: '2px solid #475569',
          }}
        >
          {parts.map((part, i) =>
            i % 2 === 1 && part.length >= 3 ? <EmphHighlight key={i} text={part} /> : part
          )}
        </div>
      )
    }
    case 'pause':
      return <PauseChip duration={segment.duration} />
    case 'section':
      return (
        <div className="my-2">
          <div
            className="text-[8px] font-bold uppercase tracking-widest pb-1 flex items-center gap-2"
            style={{ color: '#64748b' }}
          >
            {segment.label}
            <span className="flex-1 h-px" style={{ background: '#1e293b' }} />
          </div>
          <div className="text-[11.5px] leading-relaxed" style={{ color: '#94a3b8' }}>
            {tokenizeText(segment.content)}
          </div>
        </div>
      )
    case 'meta':
      return (
        <div
          className="inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded my-0.5 text-[10.5px]"
          style={{ background: 'rgba(30,41,59,0.19)' }}
        >
          <span className="text-[8.5px] font-bold uppercase tracking-wide" style={{ color: '#64748b' }}>
            {segment.key}
          </span>
          <span style={{ color: '#94a3b8' }}>{segment.value}</span>
        </div>
      )
    case 'text':
      return (
        <span className="text-[11.5px] leading-relaxed" style={{ color: 'var(--gem-muted)' }}>
          {tokenizeText(segment.content)}
        </span>
      )
  }
}

function groupClusters(segments: ScriptSegment[]): ScriptSegment[][] {
  const groups: ScriptSegment[][] = []
  let current: ScriptSegment[] = []

  for (const seg of segments) {
    if (seg.type === 'tag') {
      current.push(seg)
    } else {
      if (current.length > 0) {
        groups.push(current)
        current = []
      }
      groups.push([seg])
    }
  }
  if (current.length > 0) groups.push(current)
  return groups
}

function ParsedBeatContent({ text }: { text: string }) {
  const segments = useMemo(() => parseScriptTags(text), [text])
  const clusters = useMemo(() => groupClusters(segments), [segments])

  return (
    <div className="space-y-0.5">
      {clusters.map((cluster, ci) => {
        if (cluster.length > 1 || cluster[0].type === 'tag') {
          return (
            <div key={ci} className="pl-2 my-1" style={{ borderLeft: '1px solid var(--gem-border)' }}>
              {cluster.map((seg, si) => (
                <SegmentRenderer key={si} segment={seg} />
              ))}
            </div>
          )
        }
        return <SegmentRenderer key={ci} segment={cluster[0]} />
      })}
    </div>
  )
}

export function ScriptRenderer({ content, isEditing, onContentChange }: RendererProps) {
  const data = parseContent(content)
  const meta = data.meta ?? {}
  const beats = data.beats ?? []

  const metaEntries = [
    ['Canal', meta.canal],
    ['Formato', meta.formato],
    ['Ângulos', meta.angulos],
    ['Duração', meta.duracao],
    ['Framework', meta.framework],
    ['Fonte VVS', meta.fonte_vvs],
  ].filter(([, v]) => v) as [string, string][]

  return (
    <div className="p-5 space-y-3">
      {metaEntries.length > 0 && (
        <div
          className="grid grid-cols-2 gap-x-4 gap-y-1.5 p-3 rounded-md text-[11px]"
          style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}
        >
          {metaEntries.map(([label, value]) => (
            <div key={label} className="flex gap-1.5">
              <span style={{ color: 'var(--gem-dim)' }}>{label}:</span>
              <span style={{ color: 'var(--gem-muted)' }}>{value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {beats.map((beat, idx) => (
          <div
            key={idx}
            className="rounded-md overflow-hidden"
            style={{
              border: '1px solid var(--gem-border)',
              background: beat.divergence_note ? 'rgba(249,115,22,0.05)' : 'transparent',
              borderColor: beat.divergence_note ? 'rgba(249,115,22,0.3)' : 'var(--gem-border)',
            }}
          >
            <div
              className="flex items-center gap-2 px-3 py-1.5"
              style={{ background: 'var(--gem-well)', borderBottom: '1px solid var(--gem-border)' }}
            >
              <span
                className="text-[10px] font-bold tabular-nums"
                style={{ color: 'var(--gem-accent)', minWidth: '1.5rem' }}
              >
                #{beat.number}
              </span>
              <span className="text-[11px] font-medium flex-1" style={{ color: 'var(--gem-text)' }}>
                {beat.label}
              </span>
              {beat.status && <StatusBadge status={beat.status} />}
            </div>

            {isEditing ? (
              <div
                className="px-3 py-2 font-mono text-[11px] leading-relaxed"
                style={{ color: 'var(--gem-muted)' }}
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                onBlur={(e) => {
                  const updated = beats.map((b, i) =>
                    i === idx ? { ...b, text: e.currentTarget.textContent ?? '' } : b
                  )
                  onContentChange({ ...data, beats: updated })
                }}
              >
                {beat.text}
              </div>
            ) : (
              <div className="px-3 py-2">
                <ParsedBeatContent text={beat.text} />
              </div>
            )}

            {beat.divergence_note && (
              <div
                className="px-3 py-1.5 text-[10px]"
                style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316', borderTop: '1px solid rgba(249,115,22,0.2)' }}
              >
                ⚠ {beat.divergence_note}
              </div>
            )}
          </div>
        ))}
      </div>

      {beats.length === 0 && (
        <div className="text-[11px] text-center py-4" style={{ color: 'var(--gem-dim)' }}>
          Nenhum beat encontrado no roteiro.
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/script-renderer.test.tsx`
Expected: All tests PASS

- [ ] **Step 5: Run full test suite**

Run: `npm run test:web`
Expected: All existing tests still pass (no regressions)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/script-renderer.tsx apps/web/test/app/cms/pipeline/renderers/script-renderer.test.tsx
git commit -m "feat(pipeline): script renderer with tag parsing, narration blocks, token highlights"
```

---

### Task 6: Rewrite SceneGuideRenderer

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/scene-guide-renderer.tsx`
- Test: `apps/web/test/app/cms/pipeline/renderers/scene-guide-renderer.test.tsx`

**Depends on:** Task 1 (tokens.tsx), Task 2 (parse-tokens.tsx), Task 4 (categorize-note.ts)

Adds category pills to edit_notes, splits into non-temporal + timeline zones, applies token highlighting to all subsections. Preserves existing expand/collapse and structured subsection behavior.

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/app/cms/pipeline/renderers/scene-guide-renderer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SceneGuideRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/scene-guide-renderer'

const noop = vi.fn()

const SCENE_DATA = {
  scenes: [
    {
      number: 1,
      label: 'Scene 1',
      beat_ref: '0',
      duration: '~15s',
      status: 'DONE',
      narrative: 'Hook — montagem rápida 3 países.',
      edit_notes: [
        'Style: Minimal dark pads, subtle low drone. Not dramatic.',
        'Continues into Beat 1 — don\'t change track here.',
        '00:00: fade in 1s, -20dB under voice',
        '00:10: Lower third with channel name, hold 4s.',
      ],
      music: { search_terms: 'Mysterious, Dark', style: 'Ambient pads', entry_cue: '00:00 fade in' },
      sfx: [{ timestamp: '00:03', description: 'Subtle whoosh', search_terms: 'whoosh soft' }],
      overlays: [{ timestamp: '00:10', instruction: 'Channel name lower third' }],
      mix: [{ parameter: 'Voice', value: '-6dB' }],
      transition: { type: 'Cross-dissolve', reasoning: 'Suave transição' },
    },
  ],
}

describe('SceneGuideRenderer — category pills', () => {
  it('renders category pills for edit notes', () => {
    const { container } = render(
      <SceneGuideRenderer content={SCENE_DATA} isEditing={false} lang="en" onContentChange={noop} />
    )
    const pills = container.querySelectorAll('[class*="uppercase"]')
    const pillTexts = Array.from(pills).map(p => p.textContent)
    expect(pillTexts).toContain('STYLE')
    expect(pillTexts).toContain('FLOW')
  })

  it('renders OVERLAY pill for "Lower third" note', () => {
    const { container } = render(
      <SceneGuideRenderer content={SCENE_DATA} isEditing={false} lang="en" onContentChange={noop} />
    )
    const pills = container.querySelectorAll('[class*="uppercase"]')
    const pillTexts = Array.from(pills).map(p => p.textContent)
    expect(pillTexts).toContain('OVERLAY')
  })
})

describe('SceneGuideRenderer — timeline', () => {
  it('renders timeline points for timestamped notes', () => {
    const { container } = render(
      <SceneGuideRenderer content={SCENE_DATA} isEditing={false} lang="en" onContentChange={noop} />
    )
    const tlPoints = container.querySelectorAll('[class*="tl-point"]')
    expect(tlPoints.length).toBeGreaterThanOrEqual(2)
  })
})

describe('SceneGuideRenderer — narrative summary', () => {
  it('renders narrative when present', () => {
    render(
      <SceneGuideRenderer content={SCENE_DATA} isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(screen.getByText(/Hook — montagem/)).toBeTruthy()
  })
})

describe('SceneGuideRenderer — token highlighting', () => {
  it('highlights -20dB in edit notes', () => {
    const { container } = render(
      <SceneGuideRenderer content={SCENE_DATA} isEditing={false} lang="en" onContentChange={noop} />
    )
    const dbChips = container.querySelectorAll('[style*="fbbf24"]')
    expect(dbChips.length).toBeGreaterThanOrEqual(1)
  })

  it('highlights "Not" negation in edit notes', () => {
    const { container } = render(
      <SceneGuideRenderer content={SCENE_DATA} isEditing={false} lang="en" onContentChange={noop} />
    )
    const negs = container.querySelectorAll('[style*="f87171"]')
    expect(negs.length).toBeGreaterThanOrEqual(1)
  })
})

describe('SceneGuideRenderer — structured subsections', () => {
  it('renders Music subsection', () => {
    const { container } = render(
      <SceneGuideRenderer content={SCENE_DATA} isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(container.textContent).toContain('Mysterious, Dark')
  })

  it('renders SFX subsection', () => {
    const { container } = render(
      <SceneGuideRenderer content={SCENE_DATA} isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(container.textContent).toContain('Subtle whoosh')
  })

  it('renders Transition subsection', () => {
    const { container } = render(
      <SceneGuideRenderer content={SCENE_DATA} isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(container.textContent).toContain('Cross-dissolve')
  })
})

describe('SceneGuideRenderer — edge cases', () => {
  it('handles empty scenes array', () => {
    const { container } = render(
      <SceneGuideRenderer content={{ scenes: [] }} isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(container.textContent).toContain('Nenhuma cena')
  })

  it('handles scenes without edit_notes', () => {
    const content = { scenes: [{ number: 1, status: 'DONE' }] }
    const { container } = render(
      <SceneGuideRenderer content={content} isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(container).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/scene-guide-renderer.test.tsx`
Expected: FAIL — current renderer doesn't render category pills

- [ ] **Step 3: Rewrite `scene-guide-renderer.tsx`**

Replace the full content of `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/scene-guide-renderer.tsx`. This is a large file. The key changes are:
1. Import `TagPill` and `tokenizeText` and `categorizeNote`
2. Replace the flat `<ul>` of edit_notes with categorized note lines split into non-temporal + timeline zones
3. Apply `tokenizeText()` to all text in structured subsections (Music, SFX, Overlays, Mix)
4. Add narrative summary rendering
5. Preserve all existing expand/collapse, status badges, difficulty badges, decide_items behavior

The full rewrite should keep the existing `SceneCard` structure but replace the inner `{scene.edit_notes}` rendering and enhance the subsection text with token highlighting. The complete implementation is too large to inline here — the engineer should:

1. Keep all existing interfaces (`Scene`, `SceneMusic`, `SceneSFX`, `SceneOverlay`, `SceneMixParam`, `SceneTransition`, `SceneGuideContent`), `parseContent`, `STATUS_STYLES`, `DIFFICULTY_STYLES`, and the outer `SceneGuideRenderer` component unchanged
2. Replace the `SubSection` component's children for edit_notes with the new `CategorizedNotes` component (below)
3. Add `tokenizeText()` calls to all text content in Music, SFX, Overlays, Mix subsections
4. Add the narrative summary rendering

Add a new `CategorizedNotes` component inside the file:

```tsx
import { TagPill, OptionalBadge, TAG_COLORS } from './tokens'
import { tokenizeText } from './parse-tokens'
import { categorizeNote, type CategorizedNote } from './categorize-note'

function CategorizedNotes({ notes }: { notes: string[] }) {
  const categorized = notes.map(n => categorizeNote(n))
  const nonTemporal = categorized.filter(n => !n.timestamp)
  const temporal = categorized.filter(n => n.timestamp)
  const grouped = groupByTimestamp(temporal)

  return (
    <div>
      {nonTemporal.map((n, i) => (
        <NoteLine key={`nt-${i}`} note={n} />
      ))}
      {grouped.length > 0 && (
        <div className="tl-strip relative pl-5 mt-1.5" style={{ paddingLeft: 20 }}>
          <div className="absolute left-[7px] top-0 bottom-0 w-px" style={{ background: 'linear-gradient(180deg, rgba(129,140,248,0.19), rgba(129,140,248,0.06))' }} />
          {grouped.map((group, gi) => (
            <div key={gi} className="tl-point relative py-1">
              <div
                className="absolute w-[7px] h-[7px] rounded-full"
                style={{ left: -17, top: 10, background: 'rgba(129,140,248,0.25)', border: '1.5px solid #818cf8' }}
              />
              <span className="font-mono text-[10px] font-bold block mb-0.5" style={{ color: '#818cf8' }}>
                {group.timestamp}
              </span>
              <div className="pl-0.5">
                {group.notes.length > 1 ? (
                  <div style={{ borderLeft: '1px solid var(--gem-border)', paddingLeft: 6 }}>
                    {group.notes.map((n, ni) => <NoteLine key={ni} note={n} />)}
                  </div>
                ) : (
                  <NoteLine note={group.notes[0]} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NoteLine({ note }: { note: CategorizedNote }) {
  const textColor = TAG_COLORS[note.category]?.text ?? TAG_COLORS.NOTE.text
  return (
    <div className="flex items-start gap-2 py-1 px-1 rounded transition-colors hover:bg-white/[0.03]">
      <TagPill tag={note.category} />
      <span className="text-[11px] leading-relaxed" style={{ color: textColor }}>
        {note.isOptional && <OptionalBadge />}
        {tokenizeText(note.text)}
      </span>
    </div>
  )
}

function groupByTimestamp(notes: CategorizedNote[]): { timestamp: string; notes: CategorizedNote[] }[] {
  const map = new Map<string, CategorizedNote[]>()
  for (const n of notes) {
    const ts = n.timestamp!
    if (!map.has(ts)) map.set(ts, [])
    map.get(ts)!.push(n)
  }
  return Array.from(map.entries()).map(([timestamp, notes]) => ({ timestamp, notes }))
}
```

Then replace the edit_notes rendering inside `SceneCard` (the `<SubSection title="Notas de Edição">` block) from:

```tsx
<ul className="pl-3.5 m-0 space-y-1">
  {scene.edit_notes.map((note, i) => (
    <li key={i} className="leading-relaxed" style={{ color: 'var(--gem-muted)' }}>{note}</li>
  ))}
</ul>
```

To:

```tsx
<CategorizedNotes notes={scene.edit_notes} />
```

Add narrative summary at the top of the expanded scene body (before the first `SubSection`):

```tsx
{scene.narrative && (
  <div className="text-[11px] leading-snug italic pb-2 mb-2" style={{ color: '#64748b', borderBottom: '1px solid var(--gem-border)' }}>
    {scene.narrative}
  </div>
)}
```

Apply `tokenizeText()` to structured subsection text values: wrap `{scene.music.style}`, `{fx.description}`, `{ov.instruction}`, `{m.value}` calls with `{tokenizeText(value)}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/scene-guide-renderer.test.tsx`
Expected: All tests PASS

- [ ] **Step 5: Run full test suite**

Run: `npm run test:web`
Expected: All existing tests still pass (no regressions)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/scene-guide-renderer.tsx apps/web/test/app/cms/pipeline/renderers/scene-guide-renderer.test.tsx
git commit -m "feat(pipeline): scene guide with categorized notes, timeline, token highlights"
```

---

### Task 7: Full Validation

**Files:** None (verification only)

**Depends on:** Tasks 5 and 6

- [ ] **Step 1: Run full test suite**

Run: `npm run test:web`
Expected: All tests pass including the new renderer tests

- [ ] **Step 2: Type check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Visual verification**

Open the pipeline item detail page in the browser at `localhost:3001/cms/pipeline/items/<any-video-item>` and verify:
1. Roteiro tab: tags render as colored pills, narration has left border, PAUSE shows as amber chip, NÃO is red
2. Pós-Produção → Cena × Cena tab: edit_notes show category pills, timestamped notes appear in timeline, dB values are highlighted
3. Edit mode toggle: switching to edit shows raw text, switching back shows parsed view
4. Expand/collapse still works on scene cards

- [ ] **Step 4: Final commit (if any fixups needed)**

```bash
git add -u
git commit -m "fix(pipeline): renderer visual hierarchy fixups after validation"
```
