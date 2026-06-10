import { describe, it, expect } from 'vitest'
import { keyLineText, spokenAnchorText, visNotes, deriveMomentos, deriveBroll, posBriefHasContent } from '@/lib/pipeline/video-pos-derive'
import type { RoteiroBeatV3, PosBrief } from '@/lib/pipeline/video-schemas'

const beatA: RoteiroBeatV3 = {
  idx: 0, name: 'Abertura', status: 'PENDING',
  script: [
    { type: 'line', text: 'Linha comum' },
    { type: 'line', text: 'Linha **chave**', key: true },
    { type: 'vis', text: 'B-roll: drone sobre a praia' },
    { type: 'pause', duration: 0.5 },
    { type: 'vis', text: 'B-roll: close no mapa' },
    { type: 'ed', text: 'Editor: corta o silêncio' },
  ],
}
const beatB: RoteiroBeatV3 = {
  idx: 1, name: 'Sem key', status: 'PENDING',
  script: [{ type: 'line', text: 'Primeira fala' }, { type: 'line', text: 'Segunda fala' }],
}
const beatEmpty: RoteiroBeatV3 = { idx: 2, name: 'Vazio', status: 'PENDING', script: [] }

// Legacy "B-ROLL SHOT LIST" beat: editor-kind (by name) whose shots were authored as
// plain `line`/`action` items before the `vis`/`editor` types existed. Those items ARE
// the shot list and must reach the Pós editor brief.
const beatEditorLegacy: RoteiroBeatV3 = {
  idx: 3, name: 'B-ROLL SHOT LIST', status: 'PENDING',
  script: [
    { type: 'line', text: 'Plano aéreo da fachada' },
    { type: 'action', text: 'Close nas mãos digitando' },
    { type: 'vis', text: 'Inserto do logo' },
  ],
}
// Explicit editor kind with a single line shot — kind wins, line surfaces as b-roll.
const beatEditorExplicit: RoteiroBeatV3 = {
  idx: 4, name: 'Cobertura', status: 'PENDING', kind: 'editor',
  script: [{ type: 'line', text: 'Detalhe do produto na bancada' }],
}
// A prep (logistics) beat that happens to carry a `line` item. The line is a note to
// self, NOT a spoken moment — it must NOT surface as a Momento-chave.
const beatPrep: RoteiroBeatV3 = {
  idx: 5, name: 'KIT', status: 'PENDING', kind: 'prep',
  script: [{ type: 'line', text: 'Lembrar do power bank', key: true }],
}
// An editor (b-roll) beat with a `line` item — its shot reaches the b-roll brief, but
// it is not a key SPOKEN moment, so it must NOT surface as a Momento-chave.
const beatEditorWithLine: RoteiroBeatV3 = {
  idx: 6, name: 'B-ROLL SHOT LIST', status: 'PENDING',
  script: [{ type: 'line', text: 'Plano aéreo da fachada' }],
}

describe('keyLineText', () => {
  it('returns the first key line text', () => {
    expect(keyLineText(beatA)).toBe('Linha chave') // ** emphasis markers stripped
  })
  it('falls back to the first line when no key line', () => {
    expect(keyLineText(beatB)).toBe('Primeira fala')
  })
  it('returns empty string when no line items', () => {
    expect(keyLineText(beatEmpty)).toBe('')
  })
})

describe('visNotes', () => {
  it('collects all vis item texts in order, never ed/line (for non-editor beats)', () => {
    expect(visNotes(beatA)).toEqual(['B-roll: drone sobre a praia', 'B-roll: close no mapa'])
  })
  it('returns empty array when no vis items (and beat is not editor-kind)', () => {
    expect(visNotes(beatB)).toEqual([])
  })
  it('on an editor-kind beat, treats line + action shots AND vis items as b-roll notes', () => {
    expect(visNotes(beatEditorLegacy)).toEqual([
      'Plano aéreo da fachada',
      'Close nas mãos digitando',
      'Inserto do logo',
    ])
  })
})

describe('spokenAnchorText', () => {
  it('returns the key line text for a fala beat', () => {
    expect(spokenAnchorText(beatA)).toBe('Linha chave')
  })
  it('returns "" for a prep beat even when it carries a key line', () => {
    expect(spokenAnchorText(beatPrep)).toBe('')
  })
  it('returns "" for an editor beat even when it carries a line', () => {
    expect(spokenAnchorText(beatEditorWithLine)).toBe('') // 'B-ROLL SHOT LIST' → editor by name
    expect(spokenAnchorText(beatEditorExplicit)).toBe('') // explicit kind: 'editor'
  })
})

describe('deriveMomentos (#1-indexed)', () => {
  it('maps beats to {n, beatName, text}, 1-indexed, skipping empty key text', () => {
    expect(deriveMomentos([beatA, beatB])).toEqual([
      { n: 1, beatName: 'Abertura', text: 'Linha chave' },
      { n: 2, beatName: 'Sem key', text: 'Primeira fala' },
    ])
  })
  it('does NOT surface a prep beat as a key moment (coherence leak fix)', () => {
    // beatPrep sits between two fala beats; only the fala beats become momentos, and
    // numbering stays contiguous (the prep beat is skipped, not numbered as a gap).
    expect(deriveMomentos([beatA, beatPrep, beatB])).toEqual([
      { n: 1, beatName: 'Abertura', text: 'Linha chave' },
      { n: 2, beatName: 'Sem key', text: 'Primeira fala' },
    ])
  })
  it('does NOT surface an editor beat as a key moment (b-roll line is not spoken)', () => {
    expect(deriveMomentos([beatEditorWithLine, beatEditorExplicit])).toEqual([])
  })
})

describe('deriveBroll (#1-indexed)', () => {
  it('maps beats to {n, beatName, notes}, 1-indexed, only beats with b-roll notes', () => {
    expect(deriveBroll([beatA, beatB])).toEqual([
      { n: 1, beatName: 'Abertura', notes: ['B-roll: drone sobre a praia', 'B-roll: close no mapa'] },
    ])
  })
  it('surfaces an editor-kind beat whose shots are stored as line/action items', () => {
    expect(deriveBroll([beatB, beatEditorLegacy])).toEqual([
      { n: 1, beatName: 'B-ROLL SHOT LIST', notes: ['Plano aéreo da fachada', 'Close nas mãos digitando', 'Inserto do logo'] },
    ])
  })
  it('respects an explicit editor kind, surfacing its line shot as b-roll', () => {
    expect(deriveBroll([beatEditorExplicit])).toEqual([
      { n: 1, beatName: 'Cobertura', notes: ['Detalhe do produto na bancada'] },
    ])
  })
})

// THE shared "has the brief been started?" test — used by BOTH the Pós stage chooser and
// the editor-shell handoff fallback. The override case is load-bearing: a brief carrying
// only beat edits must count as content, or the handoff falls back to the other language
// and silently drops those edits from the printed sheet.
describe('posBriefHasContent (single content test for Pós screen + handoff fallback)', () => {
  const empty: PosBrief = { kind: 'brief', deliverables: {}, style: [], ctas: { note: '', rows: [], display: '' } }

  it('null / empty shell (incl. whitespace-only values) → false', () => {
    expect(posBriefHasContent(null)).toBe(false)
    expect(posBriefHasContent(empty)).toBe(false)
    expect(posBriefHasContent({ ...empty, deliverables: { editor: '  ', references: ['', '  '] }, overrides: {} })).toBe(false)
  })

  it('style rows / CTA rows count as content', () => {
    expect(posBriefHasContent({ ...empty, style: [{ k: 'Ritmo', v: '' }] })).toBe(true)
    expect(posBriefHasContent({ ...empty, ctas: { note: '', rows: [{ k: 'QR', pt: '', en: '' }], display: '' } })).toBe(true)
  })

  it('CTA note/display text counts as content', () => {
    expect(posBriefHasContent({ ...empty, ctas: { note: 'confira o QR', rows: [], display: '' } })).toBe(true)
    expect(posBriefHasContent({ ...empty, ctas: { note: '', rows: [], display: 'últimos 8s' } })).toBe(true)
  })

  it('a filled deliverable field — incl. a non-empty reference — counts as content', () => {
    expect(posBriefHasContent({ ...empty, deliverables: { editor: 'João' } })).toBe(true)
    expect(posBriefHasContent({ ...empty, deliverables: { references: ['vídeo X'] } })).toBe(true)
  })

  it('a per-beat override ALONE counts as content (own-lang edits must block the handoff fallback)', () => {
    expect(posBriefHasContent({ ...empty, overrides: { i0: { line: 'editado' } } })).toBe(true)
  })
})
