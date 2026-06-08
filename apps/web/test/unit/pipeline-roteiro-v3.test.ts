import { describe, it, expect } from 'vitest'
import {
  readRoteiro,
  migrateV2toV3,
  RoteiroContentSchemaV3,
} from '@/lib/pipeline/roteiro-schemas'

describe('readRoteiro version-first dispatch', () => {
  it('passes an already-v3 object through untouched (no v1 mangling)', () => {
    const v3 = {
      version: 3,
      meta: {},
      beats: [
        { idx: 0, name: 'Hook', status: 'PENDING', duration: 24, tone: 'Calmo',
          script: [{ type: 'line', text: 'Olá', key: true }, { type: 'pause', duration: 0.5 }] },
        { idx: 1, name: 'Dois', status: 'DONE',
          script: [{ type: 'vis', text: 'b-roll' }, { type: 'ed', text: 'corte' }] },
      ],
    }
    const out = readRoteiro(v3)
    expect(out.version).toBe(3)
    expect(out.beats).toHaveLength(2)
    expect(out.beats[0]!.tone).toBe('Calmo')
    expect(out.beats[0]!.script[0]).toEqual({ type: 'line', text: 'Olá', key: true })
    expect(out.beats[1]!.script).toEqual([{ type: 'vis', text: 'b-roll' }, { type: 'ed', text: 'corte' }])
  })

  it('migrates a v2 object through the chain to v3', () => {
    const v2 = {
      version: 2, meta: {},
      beats: [{ idx: 0, name: 'B1', status: 'PENDING', script: [{ type: 'line', text: 'fala' }] }],
    }
    const out = readRoteiro(v2)
    expect(out.version).toBe(3)
    expect(out.beats[0]!.script[0]).toEqual({ type: 'line', text: 'fala' })
  })

  it('migrates a legacy string through v1→v2→v3', () => {
    const out = readRoteiro('roteiro inteiro como string')
    expect(out.version).toBe(3)
    expect(out.beats[0]!.script[0]).toEqual({ type: 'line', text: 'roteiro inteiro como string' })
  })
})

describe('migrateV2toV3 line mapping', () => {
  it('note(VISUAL)→vis, note(NARRACAO)→ed', () => {
    const v3 = migrateV2toV3({
      version: 2, meta: {},
      beats: [{ idx: 0, name: 'B', status: 'PENDING', script: [
        { type: 'note', tag: 'VISUAL', text: 'mostra mapa' },
        { type: 'note', tag: 'NARRACAO', text: 'narra aqui' },
      ] }],
    })
    expect(v3.beats[0]!.script).toEqual([
      { type: 'vis', text: 'mostra mapa' },
      { type: 'ed', text: 'narra aqui' },
    ])
  })

  it('note(DIRECTION) and ref coalesce into beat.tone (NOT an inline dir item)', () => {
    const v3 = migrateV2toV3({
      version: 2, meta: {},
      beats: [{ idx: 0, name: 'B', status: 'PENDING', script: [
        { type: 'line', text: 'fala' },
        { type: 'note', tag: 'DIRECTION', text: 'olho na câmera' },
        { type: 'ref', text: 'estudo X' },
      ] }],
    })
    const beat = v3.beats[0]!
    expect(beat.tone).toContain('olho na câmera')
    expect(beat.tone).toContain('estudo X')
    expect(beat.script.some(l => l.type === 'dir')).toBe(false)
    expect(beat.script).toEqual([{ type: 'line', text: 'fala' }])
  })

  it('appends migrated DIRECTION/ref to any existing tone', () => {
    const v3 = migrateV2toV3({
      version: 2, meta: {},
      beats: [{ idx: 0, name: 'B', status: 'PENDING', tone: 'Calmo', script: [
        { type: 'note', tag: 'DIRECTION', text: 'firme' },
      ] }],
    })
    expect(v3.beats[0]!.tone).toContain('Calmo')
    expect(v3.beats[0]!.tone).toContain('firme')
  })

  it("line{accent:'key'} → line{key:true}; other accent dropped", () => {
    const v3 = migrateV2toV3({
      version: 2, meta: {},
      beats: [{ idx: 0, name: 'B', status: 'PENDING', script: [
        { type: 'line', text: 'âncora', accent: 'key' },
        { type: 'line', text: 'normal', accent: 'yellow' },
      ] }],
    })
    expect(v3.beats[0]!.script[0]).toEqual({ type: 'line', text: 'âncora', key: true })
    expect(v3.beats[0]!.script[1]).toEqual({ type: 'line', text: 'normal' })
  })

  it('pause{duration} unchanged (v3 canonical field is duration)', () => {
    const v3 = migrateV2toV3({
      version: 2, meta: {},
      beats: [{ idx: 0, name: 'B', status: 'PENDING', script: [{ type: 'pause', duration: 0.5 }] }],
    })
    expect(v3.beats[0]!.script[0]).toEqual({ type: 'pause', duration: 0.5 })
  })

  it('is idempotent on a v3 object', () => {
    const v3a = readRoteiro({
      version: 2, meta: {},
      beats: [{ idx: 0, name: 'B', status: 'PENDING', script: [{ type: 'line', text: 'x' }] }],
    })
    const v3b = migrateV2toV3(v3a)
    expect(v3b).toEqual(v3a)
  })
})

describe('RoteiroContentSchemaV3', () => {
  it('parses the v3 discriminated union members', () => {
    const r = RoteiroContentSchemaV3.safeParse({
      version: 3, meta: {},
      beats: [{ idx: 0, name: 'B', status: 'PENDING',
        script: [
          { type: 'line', text: 'a', key: true },
          { type: 'pause', duration: 1 },
          { type: 'dir', text: 'd' },
          { type: 'vis', text: 'v' },
          { type: 'ed', text: 'e' },
        ] }],
    })
    expect(r.success).toBe(true)
  })
})
