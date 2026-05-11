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
  { category: 'VISUAL',  test: t => /montage|ken burns|b-roll|photo/i.test(t) },
  { category: 'TIMING',  test: t => /^(\d{2}:\d{2})|fade in|fade out/i.test(t) },
  { category: 'FLOW',    test: t => /continues?|don[''']t change|same track|track change/i.test(t) },
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
