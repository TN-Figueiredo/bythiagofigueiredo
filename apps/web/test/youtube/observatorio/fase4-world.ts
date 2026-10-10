/* eslint-disable @typescript-eslint/no-explicit-any -- untyped mockup engine used only as a test oracle */
// The world of the Fase 4 mockup (docs/superpowers/mockups/2026-10-07-historico-muitas-versoes/dados.js, copied byte by
// byte to test/fixtures/observatorio/fase4-dados.cjs) as a production Dataset: five videos, one with 24 thumbnail periods
// and 60 days of series. HM is the mockup's own engine: the tests compare the production engine against it.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import type { Dataset, ObsChannel, ObsVideo } from '@/lib/youtube/observatorio/types'

const FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/observatorio/fase4-dados.cjs')
export type HM = Record<string, any>
export const H = 36e5, DAY = 864e5
/** The mockup's states: one video each. */
export const VID = { few: 'mm-lisboa', many: 'rb-passagem', dense: 'pd-agentes', open: 'lo-roteiro', closed: 'rb-mala' } as const

/** A fresh copy on every call: the tests mutate it. A console.error of the mockup's selfCheck() fails the load. */
export function loadFase4(): { HM: HM; ds: Dataset } {
  const ctx: Record<string, unknown> = { console: { log() {}, error(m: string) { throw new Error(m) } }, URLSearchParams }
  ctx.window = ctx
  vm.createContext(ctx)
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), ctx)
  const HM = ctx.HM as HM, OBS = ctx.OBS as HM
  const snap0 = HM.date.snap(0) as number, seriesStart = snap0 - 12 * H, lastIdx = HM.date.gi(HM.LAST_SYNC) as number
  const channels: ObsChannel[] = (OBS.channels as any[]).map(c => ({
    id: c.id, name: c.name, fullName: c.name, niche: c.niche, own: false, lang: 'pt', subs: 1000, video_limit: c.video_limit,
    url: 'https://www.youtube.com/@' + c.id, handle: c.id, gender: 'n' as const, color: c.color, ini: c.ini,
    sync: { state: 'ok' as const, last: HM.LAST_SYNC, next: HM.LAST_SYNC + 6 * H, added: seriesStart, errorSince: null, msg: null, backfill: null },
    activity: { state: 'ativo' as const }, lastIdx, snapshots: [], undated: [],
  }))
  const ver = (x: any) => ({ id: x.id as string, first_seen: x.first_seen as number, last_seen: x.last_seen as number, current: x.current as boolean, prec: x.prec, window: x.window })
  const videos: ObsVideo[] = (HM.videos as any[]).map(v => ({
    id: v.id, ch: v.ch, niche: v.niche, fmt: 'long' as const, isShort: false, pub: v.pub, ageDays: v.ageDays, tracked: true, title: v.title, theme: null, formulas: [],
    url: v.url, ytId: 'mock-' + v.id, dur: 600, views: v.views, viewsAt: v.series[v.series.length - 1].t, likes: null, comments: 0,
    series: v.series.map((p: any) => ({ idx: p.i, t: p.t, views: p.views })), firstIdx: v.firstIdx,
    titles: v.titles.map((x: any) => ({ ...ver(x), text: x.text })),
    thumbs: v.thumbs.map((x: any) => ({ ...ver(x), key: x.key, art: null, blobUrl: 'https://blob.example/' + v.id + '/' + x.key + '.jpg' })),
    descs: v.descs.map((x: any) => ({ ...ver(x), lines: x.lines, hasText: true })),
  }))
  const ds: Dataset = { now: HM.NOW, seriesStart, snap0, obsStart: seriesStart, dailyCappedFrom: null, channels, videos, sync: { last: HM.LAST_SYNC, next: HM.LAST_SYNC + 6 * H },
    readings: [], requests: [], queue: { lastPollAt: HM.NOW - 4 * 6e4, tickMinutes: 10, capabilities: [] } }
  return { HM, ds }
}

/** Replaces the thumbnails of a video: the first key stands from publication, each next one starts at its instant (minute known). */
export function setThumbs(ds: Dataset, videoId: string, seq: Array<[key: string, at?: number]>): void {
  const v = ds.videos.find(x => x.id === videoId)!
  v.thumbs = seq.map(([key, at], i) => {
    const first = i === 0 ? v.pub : at!, nx = seq[i + 1]
    return { id: v.id + '/thumb/v' + i, first_seen: first, last_seen: nx ? nx[1]! : ds.now, current: !nx, prec: i === 0 ? ('publicacao' as never) : 'min', window: null, key, art: null, blobUrl: 'https://blob.example/' + v.id + '/' + key + '.jpg' }
  })
}
/** Replaces the titles of a video: the first stands from publication, each next one is first seen at its instant (6 h window). */
export function setTitles(ds: Dataset, videoId: string, ats: number[]): void {
  const v = ds.videos.find(x => x.id === videoId)!, all = [v.pub, ...ats]
  v.titles = all.map((at, i) => ({ id: v.id + '/title/v' + i, first_seen: at, last_seen: i + 1 < all.length ? all[i + 1]! - 6 * H : ds.now, current: i + 1 === all.length,
    prec: i === 0 ? ('publicacao' as never) : '6h', window: i === 0 ? null : [at - 6 * H, at] as [number, number], text: 'Título de teste ' + (i + 1) }))
}
/** JSON round trip: objects created inside the vm have another realm's prototypes and fail toEqual. */
export const plain = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T
