import { describe, it, expect } from 'vitest'
import {
  RoteiroContentSchema,
  RoteiroBeatSchema,
  ScriptLineSchema,
  migrateV1toV2,
  legacyBeatToNew,
  createEmptyBeat,
} from '@/lib/pipeline/roteiro-schemas'

describe('ScriptLineSchema', () => {
  it('validates a line', () => {
    const result = ScriptLineSchema.safeParse({ type: 'line', text: 'Hello world' })
    expect(result.success).toBe(true)
  })

  it('validates a pause', () => {
    const result = ScriptLineSchema.safeParse({ type: 'pause', duration: 0.5 })
    expect(result.success).toBe(true)
  })

  it('validates a note with VISUAL tag', () => {
    const result = ScriptLineSchema.safeParse({ type: 'note', tag: 'VISUAL', text: 'talking head' })
    expect(result.success).toBe(true)
  })

  it('validates a ref', () => {
    const result = ScriptLineSchema.safeParse({ type: 'ref', text: 'see doc X' })
    expect(result.success).toBe(true)
  })

  it('rejects unknown type', () => {
    const result = ScriptLineSchema.safeParse({ type: 'unknown', text: 'nope' })
    expect(result.success).toBe(false)
  })

  it('rejects note with invalid tag', () => {
    const result = ScriptLineSchema.safeParse({ type: 'note', tag: 'INVALID', text: 'x' })
    expect(result.success).toBe(false)
  })
})

describe('RoteiroBeatSchema', () => {
  it('applies defaults for status and script', () => {
    const result = RoteiroBeatSchema.parse({ idx: 0, name: 'Hook' })
    expect(result.status).toBe('PENDING')
    expect(result.script).toEqual([])
  })

  it('rejects negative idx', () => {
    const result = RoteiroBeatSchema.safeParse({ idx: -1, name: 'X' })
    expect(result.success).toBe(false)
  })
})

describe('RoteiroContentSchema', () => {
  it('validates a minimal v2 roteiro', () => {
    const result = RoteiroContentSchema.safeParse({ version: 2 })
    expect(result.success).toBe(true)
    expect(result.data!.meta).toEqual({})
    expect(result.data!.beats).toEqual([])
  })

  it('rejects version 1', () => {
    const result = RoteiroContentSchema.safeParse({ version: 1, beats: [] })
    expect(result.success).toBe(false)
  })
})

describe('migrateV1toV2', () => {
  it('migrates a v1 script with meta and beats', () => {
    const v1 = {
      meta: { canal: 'EN', formato: 'Storytelling' },
      beats: [
        {
          number: 0,
          label: 'HOOK',
          text: '[VISUAL: talking head] "I lived in Canada." [PAUSE 0.5s] "I moved back."',
          status: 'GRAVADO',
        },
      ],
    }
    const v2 = migrateV1toV2(v1)
    expect(v2.version).toBe(2)
    expect(v2.meta.canal).toBe('EN')
    expect(v2.beats).toHaveLength(1)
    expect(v2.beats[0]!.idx).toBe(0)
    expect(v2.beats[0]!.name).toBe('HOOK')
    expect(v2.beats[0]!.status).toBe('DONE')
    expect(v2.beats[0]!.script.length).toBeGreaterThan(0)
    expect(v2.beats[0]!.script.some(l => l.type === 'note')).toBe(true)
    expect(v2.beats[0]!.script.some(l => l.type === 'pause')).toBe(true)
    expect(v2.beats[0]!.script.some(l => l.type === 'line')).toBe(true)
  })

  it('is idempotent on v2 content', () => {
    const v2 = { version: 2, meta: {}, beats: [] }
    expect(migrateV1toV2(v2)).toEqual(v2)
  })

  it('handles plain string content', () => {
    const v2 = migrateV1toV2('Hello world')
    expect(v2.version).toBe(2)
    expect(v2.beats).toHaveLength(1)
    expect(v2.beats[0]!.script[0]).toEqual({ type: 'line', text: 'Hello world' })
  })

  it('handles null/undefined content', () => {
    const v2 = migrateV1toV2(null)
    expect(v2.version).toBe(2)
    expect(v2.beats).toEqual([])
  })
})

describe('legacyBeatToNew', () => {
  it('converts beat number to idx and label to name', () => {
    const beat = legacyBeatToNew({ number: 3, label: 'Climax', text: '"The big moment."' })
    expect(beat.idx).toBe(3)
    expect(beat.name).toBe('Climax')
  })

  it('maps GRAVADO status to DONE', () => {
    const beat = legacyBeatToNew({ number: 0, label: 'X', text: '"hi"', status: 'GRAVADO' })
    expect(beat.status).toBe('DONE')
  })

  it('maps unknown status to PENDING', () => {
    const beat = legacyBeatToNew({ number: 0, label: 'X', text: '"hi"', status: 'IMPROVISED' })
    expect(beat.status).toBe('PENDING')
  })
})

describe('createEmptyBeat', () => {
  it('creates a beat with correct defaults', () => {
    const beat = createEmptyBeat(5)
    expect(beat).toEqual({ idx: 5, name: 'Beat 6', status: 'PENDING', script: [] })
  })
})
