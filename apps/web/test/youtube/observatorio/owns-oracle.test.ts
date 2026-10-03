// @vitest-environment node
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { loadOracle, loadOracleOwns, datasetFromOracle } from './oracle'
import { OWN_PRESETS } from '../../fixtures/observatorio/own-presets'
import { createObservatory } from '@/lib/youtube/observatorio'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FIX = path.resolve(HERE, '../../fixtures/observatorio')
const MOCK = path.resolve(HERE, '../../../../../docs/superpowers/mockups/2026-10-03-observatorio-seus-canais')

describe('oráculo com N canais próprios', () => {
  it('segundo-canal.cjs: sha256 e cópia byte a byte do mockup', () => {
    const a = fs.readFileSync(path.join(FIX, 'segundo-canal.cjs'))
    expect(crypto.createHash('sha256').update(a).digest('hex')).toBe('2a6872e7af79e31319659c3cfc2ae92d2ae0e89a06876879351f06f4b29d2824')
    expect(a.equals(fs.readFileSync(path.join(MOCK, 'segundo-canal.js')))).toBe(true)
  })
  it('OWN_PRESETS é igual ao PRESETS do mockup.js', () => {
    const m = fs.readFileSync(path.join(MOCK, 'mockup.js'), 'utf8').match(/var PRESETS = (\{[\s\S]*?\n {2}\});/)
    expect(m).not.toBeNull()
    expect(OWN_PRESETS).toEqual(vm.runInNewContext('(' + m![1] + ')'))
  })
  it("preset '5': cinco próprios e nenhum vídeo órfão", () => {
    const o = loadOracleOwns('5')
    expect(o.channels.filter((c: { own?: boolean }) => c.own).map((c: { id: string }) => c.id).sort()).toEqual([...OWN_PRESETS['5'].ids].sort())
    const ids = new Set(o.channels.map((c: { id: string }) => c.id))
    expect(o.videos.every((v: { ch: string }) => ids.has(v.ch))).toBe(true)
  })
  it('concorrentes idênticos aos de loadOracle()', () => {
    const a = loadOracle(), b = loadOracleOwns('5')
    const comp = (o: typeof a) => JSON.stringify(o.channels.filter((c: { own?: boolean }) => !c.own).map((c: { id: string; subs: number }) => [c.id, c.subs]))
    expect(comp(b)).toBe(comp(a))
    expect(JSON.stringify(b.forja.readings)).toBe(JSON.stringify(a.forja.readings))
  })
  it('mix: mochila-leve sem nicho, e os vídeos dele também; zero: nenhum de viagem', () => {
    const mix = loadOracleOwns('mix')
    expect(mix.channels.find((c: { id: string }) => c.id === 'mochila-leve').niche).toBeNull()
    const vs = mix.videos.filter((v: { ch: string }) => v.ch === 'mochila-leve')
    expect(vs.every((v: { niche: string | null }) => v.niche === null)).toBe(true)
    const zero = loadOracleOwns('zero')
    const own = zero.channels.filter((c: { own?: boolean }) => c.own)
    expect(own).toHaveLength(2)
    expect(own.some((c: { niche: string | null }) => c.niche === 'viagem')).toBe(false)
  })
  it("preset '5': integridade ok e tabCounts", () => {
    const obs = createObservatory(datasetFromOracle(loadOracleOwns('5')))
    expect(obs.integrity.ok).toBe(true)
    expect(obs.tabCounts('todos')).toEqual({ canais: 14, mud: 18, out: 11 })
  })
  it("preset '1': mesmos canais de loadOracle()", () => {
    const ids = (o: ReturnType<typeof loadOracle>) => o.channels.map((c: { id: string }) => c.id).sort()
    expect(ids(loadOracleOwns('1'))).toEqual(ids(loadOracle()))
  })
})
