// @vitest-environment node
// A5 (E2, item 21): o pacote do maior canal com um ano de série cabe com a semanal; no teto, a semanal fica de fora e o pacote diz.
import { describe, it, expect } from 'vitest'
import { gzipSync } from 'node:zlib'
import { packChannel, unpackChannel, packWithinBudget, PACK_BUDGET, PACK_VERSION, type ChannelRows } from '@/lib/youtube/observatorio/pack'

const DAY = 864e5, NOW = Date.now()
const spDate = (ms: number) => new Date(ms - 3 * 36e5).toISOString().slice(0, 10)
/** Gerador determinístico (o tamanho do pacote depende de quão aleatório é o dado: com Math.random o teste variaria). */
function rng(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32 } }
const hex = (r: () => number, n: number) => Array.from({ length: n }, () => Math.floor(r() * 16).toString(16)).join('')
const uuid = (r: () => number) => [hex(r, 8), hex(r, 4), hex(r, 4), hex(r, 4), hex(r, 12)].join('-')

/** Um canal com `nDaily` vídeos em faixa diária (um ponto por dia por 365 dias) e o resto em semanal (um ponto por semana). */
function year(nVideos: number, nDaily: number): { rows: ChannelRows; observed: Set<string> } {
  const r = rng(nVideos * 1000 + nDaily), rows: ChannelRows = { videos: [], versions: [], daily: [], snapshots: [], spans: [] }, observed = new Set<string>()
  for (let i = 0; i < nVideos; i++) {
    const id = uuid(r), isDaily = i < nDaily
    if (isDaily) observed.add(id)
    rows.videos.push({ id, competitor_channel_id: 'c', video_id: hex(r, 11), title: 'Um título de vídeo com tamanho médio de sessenta caracteres ' + i, view_count: 100_000 + i, like_count: 3000, comment_count: 120, duration_seconds: 900,
      published_at: new Date(NOW - i * 3 * DAY).toISOString(), is_short: i % 3 === 0, last_checked_at: new Date(NOW).toISOString(), tags: ['viagem', 'asia', 'vlog', 'tag' + i], thumbnail_url: 'https://i.ytimg.com/vi/' + hex(r, 11) + '/maxresdefault.jpg', pinned_at: null, series_tier: isDaily ? 'diaria' : 'semanal' })
    for (const field of ['title', 'thumb', 'desc']) rows.versions.push({ id: uuid(r), video_id: id, field, value_text: field === 'title' ? 'Um título de vídeo ' + i : null, value_hash: hex(r, 16), has_text: field !== 'thumb', thumb_blob_url: field === 'thumb' ? 'https://x.public.blob.vercel-storage.com/observatorio/thumbs/' + id + '/' + hex(r, 16) + '.jpg' : null,
      first_seen_at: new Date(NOW - 300 * DAY).toISOString(), last_seen_at: new Date(NOW).toISOString(), window_start: null, precision: 'first', is_current: true })
    let views = Math.floor(r() * 500_000)
    for (let d = 365; d >= 0; d -= isDaily ? 1 : 7) {
      views += Math.floor(r() * (isDaily ? 3000 : 400))
      const t = NOW - d * DAY + Math.floor(r() * 1200) * 1000
      rows.daily.push({ video_id: id, snap_date: spDate(t), views, taken_at: new Date(t).toISOString() })
    }
    rows.spans.push({ video_id: id, from_date: spDate(NOW - 365 * DAY), to_date: null, tier: isDaily ? 'diaria' : 'semanal' })
  }
  return { rows, observed }
}

describe('pacote com a série semanal (item 21)', () => {
  it('PACK_VERSION subiu, e o pacote leva e devolve as faixas', () => {
    expect(PACK_VERSION).toBe(2)
    const { rows } = year(4, 2)
    expect(unpackChannel(packChannel(rows))).toEqual(rows)
  })
  it('um pacote da versão 1 (sem `spans`) não é aceito: a tela lê o banco', () => {
    const { rows } = year(2, 1)
    const v1 = gzipSync(JSON.stringify({ v: 1, videos: rows.videos, versions: rows.versions, daily: rows.daily, snapshots: [] })).toString('base64')
    expect(unpackChannel(v1)).toBeNull()
  })
  it('o maior canal de hoje (285 vídeos, 50 diários) com um ano de série, diária E semanal, cabe com folga', () => {
    const { rows, observed } = year(285, 50)
    const out = packWithinBudget(rows, observed)
    console.info('[medicao] pacote 285/50 com semanal:', out.packed.length, 'caracteres de', PACK_BUDGET)
    expect(out.weeklyOmitted).toBe(false)
    expect(out.packed.length).toBeLessThan(PACK_BUDGET * 0.6)
    expect(unpackChannel(out.packed)!.daily).toHaveLength(rows.daily.length)
  })
  it('no teto (200 diários e 800 semanais, um ano) não cabe com a semanal: ela fica de fora, o pacote diz, e cabe', () => {
    const { rows, observed } = year(1000, 200)
    expect(packChannel(rows).length).toBeGreaterThan(PACK_BUDGET) // a premissa do teste: com tudo, passa
    const out = packWithinBudget(rows, observed)
    console.info('[medicao] pacote 1000/200 sem semanal:', out.packed.length, 'caracteres de', PACK_BUDGET)
    expect(out.weeklyOmitted).toBe(true)
    expect(out.packed.length).toBeLessThanOrEqual(PACK_BUDGET)
    const back = unpackChannel(out.packed)!
    expect(back.weeklyOmitted).toBe(true)
    expect(back.spans).toEqual([])
    expect(back.daily.every(d => observed.has(d.video_id))).toBe(true)
    expect(back.daily).toHaveLength(200 * 366)
    expect(back.videos).toHaveLength(1000) // os vídeos ficam todos: só a série dos não observados sai
  })
})
