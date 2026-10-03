/* eslint-disable @typescript-eslint/no-explicit-any -- untyped mockup engine used only as a test oracle */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { PENDING_SECTIONS, NOT_PORTED, NOT_PORTED_TESTS } from './suite-pending'
import type { Dataset, ObsChannel, ObsVideo } from '@/lib/youtube/observatorio/types'
import { createObservatory, type Observatory } from '@/lib/youtube/observatorio'
import { forjaScenarios } from './forja-scenarios'

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/observatorio')
export type Oracle = Record<string, any>

export function loadOracle(): Oracle {
  const ctx: Record<string, unknown> = { console: { log() {}, error() {} } }
  vm.createContext(ctx)
  vm.runInContext(fs.readFileSync(path.join(DIR, 'dados.cjs'), 'utf8'), ctx)
  return ctx.OBS as Oracle
}

const VIDEO_INPUT: (keyof ObsVideo)[] = ['id', 'ch', 'niche', 'fmt', 'pub', 'ageDays', 'tracked', 'title', 'theme', 'formulas', 'url', 'ytId', 'dur', 'views', 'viewsAt', 'likes', 'comments', 'series', 'firstIdx', 'titles', 'thumbs', 'descs']
const pick = <T extends object>(o: any, keys: (keyof T)[]): T => Object.fromEntries(keys.map(k => [k, structuredClone(o[k as string] ?? null)])) as T

/** INPUT fields only — the engine must derive vpd/vpd7/mult/changes/effects itself. */
export function datasetFromOracle(o: Oracle): Dataset {
  const channels: ObsChannel[] = o.channels.map((c: any) => ({
    id: c.id, name: c.name, fullName: c.fullName ?? c.name, niche: c.niche, own: !!c.own, lang: c.lang, subs: c.subs,
    video_limit: c.video_limit, url: c.url, handle: c.handle, gender: c.gender ?? 'n', color: c.color, ini: c.ini,
    sync: { state: c.sync.state, last: c.sync.last, next: c.sync.next ?? null, added: c.sync.added, errorSince: c.sync.errorSince ?? null, msg: c.sync.msg ?? null, backfill: c.sync.backfill ?? null },
    activity: structuredClone(c.activity), lastIdx: c.lastIdx, snapshots: structuredClone(c.snapshots),
  }))
  const videos: ObsVideo[] = o.videos.map((v: any) => pick<ObsVideo>(v, VIDEO_INPUT))
  return {
    now: o.NOW, seriesStart: o.SERIES_START, snap0: o.date.snapTime(0), obsStart: o.OBS_START, dailyCappedFrom: null, channels, videos,
    sync: { last: o.SYNC.last, next: o.SYNC.next },
    readings: structuredClone(o.forja.readings), requests: structuredClone(o.forja.requests.filter((r: any) => !r.scenario)),
    queue: { lastPollAt: o.forja.queue.lastPollAt, tickMinutes: o.forja.queue.tickMinutes, capabilities: ['padroes-titulo', 'padroes-titulo-shorts', 'temas', 'resumo-trocas', 'leitura-video'] },
  }
}

/** The production engine with the mockup's request generator injected (TEST ONLY): forja.requestScenario, session.setBase. */
export function createTestObservatory(ds: Dataset): Observatory {
  return createObservatory(ds, { testScenarios: forjaScenarios })
}

/**
 * The suite runs some setup code eagerly (outside test()), e.g. READ_TEXTS calls O.forja.requestScenario.
 * Until the facade is fully ported, a member missing from the facade resolves to an inert "pending" stand-in
 * (callable, chainable, enumerates empty) so registration does not abort. On coercion it yields a MARK string, and
 * runMockupSuite also counts touches per result and forces ok=false on any non-exempt (ported) result that
 * touched a stand-in, however it used it (truthiness, iteration, ...).
 */
const MARK = '\u0000NOT-PORTED:'
/** Touch counter: every creation of a stand-in (a missing member read, or a call on a stand-in) increments it. */
let touches = 0
function pending(label: string): any {
  touches++
  const fn = () => pending(label + '()')
  return new Proxy(fn, {
    get: (_t, k) => {
      if (k === Symbol.toPrimitive || k === 'toString' || k === 'valueOf' || k === 'toJSON') {
        return () => MARK + label
      }
      if (typeof k === 'symbol') return undefined
      return pending(label + '.' + k)
    },
    apply: () => pending(label + '()'),
    ownKeys: () => ['length', 'name'],
  })
}
function lenient(target: any, label = 'OBS'): any {
  return new Proxy(target, {
    get: (t, k, r) => {
      if (typeof k === 'symbol' || k === 'toJSON') return Reflect.get(t, k, r) // JSON.stringify probes toJSON: not a facade touch
      if (!(k in t)) return pending(label + '.' + k)
      const v = Reflect.get(t, k, r)
      return v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype ? lenient(v, label + '.' + k) : v
    },
  })
}

export interface SuiteResult { name: string; section: string; ok: boolean; detail: string }
/** Runs dados-teste.html's <script id="tests"> VERBATIM with root.OBS = facade. */
export function runMockupSuite(facade: unknown, htmlOverride?: string): SuiteResult[] {
  const html = htmlOverride ?? fs.readFileSync(path.join(DIR, 'dados-teste.html'), 'utf8')
  let src = html.match(/<script id="tests">([\s\S]*?)<\/script>/)![1]!
  const before = src
  src = src.replace(/\/\* ---------- (.+?) ---------- \*\//g, (_m, s: string) => `root.__SEC = ${JSON.stringify(s)};`)
  src = src.replace('R.push({ name, ok, detail });', 'R.push({ name, ok, detail, section: root.__SEC, touchAt: root.__TOUCH() });')
  if (src === before || !src.includes('section: root.__SEC')) throw new Error('mockup suite instrumentation failed — dados-teste.html changed shape')
  touches = 0
  const ctx: Record<string, unknown> = { OBS: lenient(facade as object), __TOUCH: () => touches, console: { log() {}, error() {} } }
  vm.createContext(ctx)
  vm.runInContext(src, ctx)
  const raw = (ctx.__OBS_TEST as { results: (SuiteResult & { touchAt: number })[] }).results
  let prev = 0
  return raw.map(({ touchAt, ...r }) => {
    const touched = touchAt - prev
    prev = touchAt
    const exempt = PENDING_SECTIONS.has(r.section) || NOT_PORTED.has(r.section) || NOT_PORTED_TESTS.has(r.name)
    if (!exempt && touched > 0) return { ...r, ok: false, detail: 'touched missing facade member' }
    return String(r.detail).includes(MARK) ? { ...r, ok: false } : r
  })
}
