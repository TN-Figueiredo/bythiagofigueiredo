/* eslint-disable @typescript-eslint/no-explicit-any -- untyped mockup engine used only as a test generator */
/**
 * TEST fixture — the readings the mockup's generator "publishes" for 'publicado' request scenarios (dados.js:1467-1484,
 * scenarioReading). In production the forja writes readings and the site stores them; the bodies here come from a
 * private copy of the mockup engine (the generator), frozen like ds.readings. Only the registry and the id rule
 * (same target at another time → the id gains HHMM) are ported here, so the ids follow the order of the calls made on
 * the production facade. Everything computed FROM a reading (since, readingScope, outliers({reading})) is production code.
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import type { Clock } from '@/lib/youtube/observatorio/time'
import type { FrozenReading, Niche } from '@/lib/youtube/observatorio/types'

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/observatorio')
let GEN: Record<string, any> | null = null
function generator(): Record<string, any> {
  if (!GEN) {
    const c: Record<string, unknown> = { console: { log() {}, error() {} } }
    vm.createContext(c)
    vm.runInContext(fs.readFileSync(path.join(DIR, 'dados.cjs'), 'utf8'), c)
    GEN = c.OBS as Record<string, any>
  }
  return GEN
}
/** The 'publicado' scenario publishes 19 min after its creation, with the claim on a xx:x5 poll (dados.js:1452). */
const PUBLISHED_AFTER_MS = 19 * 6e4

export interface ScenarioReadings {
  readings: Record<string, FrozenReading>
  readingFor(type: string, niche: Niche, at: number, video: string | null): FrozenReading
}
export function scenarioReadings(clock: Clock, register?: (r: FrozenReading) => void): ScenarioReadings {
  const readings: Record<string, FrozenReading> = {}
  const byKey = new Map<string, FrozenReading>()
  function readingFor(type: string, niche: Niche, at: number, video: string | null): FrozenReading {
    const base = [type, niche, video || '', ''].join('|'), key = base + '|' + at
    const hit = byKey.get(key)
    if (hit) return hit
    const sameDay = [...byKey.keys()].some(k => k.startsWith(base + '|'))   // another time of the same target: id gains HHMM
    const G = generator()
    const sc = G.forja.requestScenario('publicado', { type, niche, video: video ?? undefined, createdAt: at - PUBLISHED_AFTER_MS })
    const gen = sc && G.forja.byId[sc.request.readingId]
    if (!gen || gen.generatedAt !== at) throw new Error('scenario reading generator: no reading at ' + clock.dmhm(at) + ' for ' + key)
    const r = structuredClone(gen) as FrozenReading
    r.id = r.id.replace(/(-\d{4})?-cenario$/, '') + (sameDay ? '-' + clock.hm(at).replace(':', '') : '') + '-cenario'
    r.scenario = true
    byKey.set(key, r); readings[r.id] = r; register?.(r)
    return r
  }
  return { readings, readingFor }
}
