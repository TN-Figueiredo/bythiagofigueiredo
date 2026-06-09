// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  nextStatus,
  ensureBeatIds,
  normalizeBeatText,
  beatContentHash,
  reconcileRecording,
  asMarkGran,
  markGranClass,
  MARK_GRANS,
  MARK_GRAN_LABEL,
  DEFAULT_MARK_GRAN,
  type RecStatus,
  type MarkGran,
  type StoredRecRow,
} from '@/lib/pipeline/video-recording'
import type { RoteiroBeatV3, RoteiroContentV3 } from '@/lib/pipeline/roteiro-schemas'

const beat = (
  name: string,
  script: RoteiroBeatV3['script'] = [],
  extra: Partial<RoteiroBeatV3> = {},
): RoteiroBeatV3 => ({ idx: 0, name, status: 'PENDING', script, ...extra })

const content = (beats: RoteiroBeatV3[]): RoteiroContentV3 => ({ version: 3, meta: {}, beats })

describe('nextStatus — 3-state cycle', () => {
  it('cycles pendente → gravada → refazer → pendente', () => {
    expect(nextStatus('pendente')).toBe('gravada')
    expect(nextStatus('gravada')).toBe('refazer')
    expect(nextStatus('refazer')).toBe('pendente')
  })
  it('is total over the union (round-trips in 3 steps)', () => {
    const states: RecStatus[] = ['pendente', 'gravada', 'refazer']
    for (const s of states) {
      expect(nextStatus(nextStatus(nextStatus(s)))).toBe(s)
    }
  })
})

describe('ensureBeatIds — stable id stamping', () => {
  it('assigns ids to beats missing one and flags changed', () => {
    const input = content([beat('HOOK'), beat('FECHO')])
    const { content: out, changed } = ensureBeatIds(input)
    expect(changed).toBe(true)
    expect(out.beats.every((b) => typeof b.id === 'string' && b.id.length > 0)).toBe(true)
    // unique ids
    expect(new Set(out.beats.map((b) => b.id)).size).toBe(2)
  })
  it('does not mutate the input', () => {
    const input = content([beat('HOOK')])
    const before = JSON.stringify(input)
    ensureBeatIds(input)
    expect(JSON.stringify(input)).toBe(before)
    expect(input.beats[0]!.id).toBeUndefined()
  })
  it('preserves existing ids and reports changed=false when all present', () => {
    const input = content([beat('HOOK', [], { id: 'fixed-1' }), beat('FECHO', [], { id: 'fixed-2' })])
    const { content: out, changed } = ensureBeatIds(input)
    expect(changed).toBe(false)
    expect(out.beats.map((b) => b.id)).toEqual(['fixed-1', 'fixed-2'])
  })
  it('only stamps the missing ids in a mixed content (changed=true)', () => {
    const input = content([beat('HOOK', [], { id: 'fixed-1' }), beat('FECHO')])
    const { content: out, changed } = ensureBeatIds(input)
    expect(changed).toBe(true)
    expect(out.beats[0]!.id).toBe('fixed-1')
    expect(out.beats[1]!.id).toBeTruthy()
  })
})

describe('normalizeBeatText — change detection text', () => {
  it('concatenates spoken line and action texts', () => {
    const b = beat('HOOK', [
      { type: 'line', text: 'Olha isso' },
      { type: 'action', text: 'aponta pra tela' },
    ])
    expect(normalizeBeatText(b)).toBe('Olha isso aponta pra tela')
  })
  it('strips ** emphasis markers and collapses whitespace', () => {
    const b = beat('HOOK', [{ type: 'line', text: '  **Isso**   é    importante  ' }])
    expect(normalizeBeatText(b)).toBe('Isso é importante')
  })
  it('ignores dir/vis/ed/pause items', () => {
    const b = beat('HOOK', [
      { type: 'line', text: 'fala' },
      { type: 'pause', duration: 1 },
      { type: 'dir', text: 'tom calmo' },
      { type: 'vis', text: 'b-roll' },
      { type: 'ed', text: 'corta aqui' },
    ])
    expect(normalizeBeatText(b)).toBe('fala')
  })
  it('returns empty string for an empty beat', () => {
    expect(normalizeBeatText(beat('EMPTY'))).toBe('')
  })
})

describe('beatContentHash — stable sync hash', () => {
  it('is deterministic for the same text', () => {
    const b = beat('HOOK', [{ type: 'line', text: 'Olha isso' }])
    expect(beatContentHash(b)).toBe(beatContentHash(b))
  })
  it('differs on a one-char change', () => {
    const a = beat('HOOK', [{ type: 'line', text: 'Olha isso' }])
    const c = beat('HOOK', [{ type: 'line', text: 'Olha issa' }])
    expect(beatContentHash(a)).not.toBe(beatContentHash(c))
  })
  it('is stable across ** markers and whitespace (hashes the normalized text)', () => {
    const a = beat('HOOK', [{ type: 'line', text: '**Olha**  isso' }])
    const c = beat('HOOK', [{ type: 'line', text: 'Olha isso' }])
    expect(beatContentHash(a)).toBe(beatContentHash(c))
  })
})

describe('reconcileRecording — durable rows ↔ live beats', () => {
  const falaBeat = (id: string, name: string, lineText: string): RoteiroBeatV3 =>
    beat(name, [{ type: 'line', text: lineText }], { id })

  const row = (over: Partial<StoredRecRow> & { beat_id: string }): StoredRecRow => ({
    status: 'gravada',
    retake_note: null,
    beat_name: null,
    content_hash: null,
    ...over,
  })

  it('carries status/note verbatim when beat_id + content_hash match (stale:false)', () => {
    const b = falaBeat('b1', 'HOOK', 'Olha isso')
    const hash = beatContentHash(b)
    const { beats, orphans } = reconcileRecording(
      [b],
      [row({ beat_id: 'b1', status: 'refazer', retake_note: 'luz ruim', content_hash: hash })],
    )
    expect(orphans).toEqual([])
    expect(beats).toHaveLength(1)
    expect(beats[0]).toMatchObject({
      beat_id: 'b1',
      beat_name: 'HOOK',
      status: 'refazer',
      retake_note: 'luz ruim',
      content_hash: hash,
      stale: false,
    })
  })

  it('flags stale:true when beat_id matches but content_hash differs (roteiro mudou)', () => {
    const b = falaBeat('b1', 'HOOK', 'Texto novo')
    const { beats } = reconcileRecording(
      [b],
      [row({ beat_id: 'b1', status: 'gravada', content_hash: 'hash-antigo' })],
    )
    expect(beats[0]!.status).toBe('gravada') // status still carried, never silently dropped
    expect(beats[0]!.stale).toBe(true)
    expect(beats[0]!.content_hash).toBe(beatContentHash(b)) // current hash surfaced
  })

  it('returns pendente for a beat with no stored row (stale:false)', () => {
    const b = falaBeat('b1', 'HOOK', 'Olha isso')
    const { beats, orphans } = reconcileRecording([b], [])
    expect(orphans).toEqual([])
    expect(beats[0]).toMatchObject({ beat_id: 'b1', status: 'pendente', retake_note: null, stale: false })
  })

  it('treats rows whose beat_id is gone as orphans (never auto-deleted)', () => {
    const b = falaBeat('b1', 'HOOK', 'Olha isso')
    const orphanRow = row({ beat_id: 'ghost', status: 'gravada' })
    const { beats, orphans } = reconcileRecording([b], [orphanRow])
    expect(beats.map((x) => x.beat_id)).toEqual(['b1'])
    expect(orphans).toEqual([orphanRow])
  })

  it('only reconciles fala beats — acao/prep/editor are skipped', () => {
    const fala = falaBeat('b1', 'HOOK', 'Olha isso')
    const acao = beat('Entrevista perguntas', [{ type: 'action', text: 'pergunta' }], { id: 'b2', kind: 'acao' })
    const prep = beat('Kit', [], { id: 'b3', kind: 'prep' })
    const { beats } = reconcileRecording([fala, acao, prep], [])
    expect(beats.map((x) => x.beat_id)).toEqual(['b1'])
  })

  it('keeps roteiro order and never marks stale when stored hash is null (legacy row)', () => {
    const b = falaBeat('b1', 'HOOK', 'Olha isso')
    const { beats } = reconcileRecording([b], [row({ beat_id: 'b1', status: 'gravada', content_hash: null })])
    expect(beats[0]!.stale).toBe(false)
  })

  it('a beat missing an id is fresh pendente (no match, no orphan)', () => {
    const noId = beat('HOOK', [{ type: 'line', text: 'fala' }]) // no id
    const { beats, orphans } = reconcileRecording([noId], [row({ beat_id: 'x', status: 'gravada' })])
    expect(beats).toHaveLength(1)
    expect(beats[0]).toMatchObject({ status: 'pendente', stale: false })
    // the unrelated row becomes an orphan
    expect(orphans.map((o) => o.beat_id)).toEqual(['x'])
  })
})

describe('MarkGran — marking granularity (default off)', () => {
  it('defaults to off — zero checkboxes anywhere', () => {
    expect(DEFAULT_MARK_GRAN).toBe('off')
  })
  it('MARK_GRANS lists the four granularities in display order', () => {
    expect(MARK_GRANS).toEqual<MarkGran[]>(['off', 'beat', 'secao', 'linha'])
  })
  it('labels every granularity', () => {
    expect(MARK_GRAN_LABEL).toEqual({ off: 'Off', beat: 'Beat', secao: 'Seção', linha: 'Linha' })
  })
  it('markGranClass maps to mark-<gran>', () => {
    expect(markGranClass('off')).toBe('mark-off')
    expect(markGranClass('beat')).toBe('mark-beat')
    expect(markGranClass('secao')).toBe('mark-secao')
    expect(markGranClass('linha')).toBe('mark-linha')
  })
  it('asMarkGran passes through valid values', () => {
    for (const g of MARK_GRANS) expect(asMarkGran(g)).toBe(g)
  })
  it('asMarkGran falls back to off for junk / null / legacy values', () => {
    expect(asMarkGran('bogus')).toBe('off')
    expect(asMarkGran(null)).toBe('off')
    expect(asMarkGran(undefined)).toBe('off')
    expect(asMarkGran(42)).toBe('off')
    expect(asMarkGran('')).toBe('off')
  })
})
