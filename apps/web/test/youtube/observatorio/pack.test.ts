// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { gzipSync } from 'node:zlib'
import { packChannel, unpackChannel, PACK_BUDGET, PACK_VERSION, type ChannelRows } from '@/lib/youtube/observatorio/pack'

const NOW = Date.now(), DAY = 864e5
let seed = 42
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32
const uuid = () => 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(rnd() * 16).toString(16))

/** A channel with realistic row shapes: `nVideos` videos, the first `tracked` with one daily record per day. */
function channel(nVideos: number, tracked: number, days: number): ChannelRows {
  const rows: ChannelRows = { videos: [], versions: [], daily: [], snapshots: [] }
  for (let i = 0; i < nVideos; i++) {
    const id = uuid(), seen = new Date(NOW - i * DAY).toISOString()
    rows.videos.push({ id, competitor_channel_id: 'c', video_id: 'yt' + i + 'abcdefg', title: 'Um título de vídeo razoavelmente longo número ' + i, view_count: Math.floor(rnd() * 1e6), like_count: 1234, comment_count: 56, duration_seconds: 600, published_at: seen, is_short: false, last_checked_at: seen, tags: ['viagem', 'brasil', 'mochilão', 'vlog', 'tag' + i], thumbnail_url: 'https://i.ytimg.com/vi/yt' + i + 'abcdefg/maxresdefault.jpg', pinned_at: i % 40 === 39 ? seen : null })
    for (const field of ['title', 'thumb', 'desc']) rows.versions.push({ id: uuid(), video_id: id, field, value_text: field === 'title' ? 'Um título de vídeo razoavelmente longo número ' + i : null, value_hash: uuid().slice(0, 16), has_text: field !== 'thumb', thumb_blob_url: field === 'thumb' ? 'https://x.public.blob.vercel-storage.com/obs/' + uuid() + '.jpg' : null, first_seen_at: seen, last_seen_at: seen, window_start: null, precision: 'first', is_current: true, ...(field === 'desc' ? { text_omitted: true } : {}) })
    if (i < tracked) { let views = Math.floor(rnd() * 5e4); for (let d = days; d >= 0; d--) { views += Math.floor(rnd() * 3000); const t = NOW - d * DAY; rows.daily.push({ video_id: id, snap_date: new Date(t - 3 * 36e5).toISOString().slice(0, 10), views, taken_at: new Date(t + Math.floor(rnd() * 6e5)).toISOString() }) } }
  }
  return rows
}

describe('pacote de um canal', () => {
  it('ida e volta devolve as mesmas linhas', () => {
    const rows = channel(20, 5, 10)
    expect(unpackChannel(packChannel(rows))).toEqual(rows)
  })
  it('canal sem vídeo: pacote vazio válido, nunca nulo', () => {
    expect(unpackChannel(packChannel({ videos: [], versions: [], daily: [], snapshots: [] }))).toEqual({ videos: [], versions: [], daily: [], snapshots: [] })
  })
  it('entrada que não é um pacote devolve nulo', () => {
    for (const bad of [null, undefined, 42, '', 'lixo', '{}', Buffer.from('não é gzip').toString('base64')]) expect(unpackChannel(bad)).toBeNull()
  })
  it('pacote de outra versão ou sem uma das listas devolve nulo', () => {
    const z = (o: unknown) => gzipSync(JSON.stringify(o)).toString('base64')
    expect(unpackChannel(z({ v: PACK_VERSION + 1, videos: [], versions: [], daily: [], snapshots: [] }))).toBeNull()
    expect(unpackChannel(z({ v: PACK_VERSION, videos: [], versions: [], daily: [] }))).toBeNull()
    expect(unpackChannel(z([1, 2, 3]))).toBeNull()
  })
  it('o orçamento fica abaixo do limite de 2 MB do cache do Next', () => {
    expect(PACK_BUDGET).toBeLessThan(2 * 1024 * 1024 - 1000)
  })
  it('pior caso de hoje (limite 50, 365 dias de diário) cabe com folga', () => {
    const size = packChannel(channel(400, 50, 365)).length
    console.info('[medicao] pacote | 400 vídeos, 50 acompanhados, 365 dias |', size, 'caracteres')
    expect(size).toBeLessThan(PACK_BUDGET / 2)
  })
  it('pior caso possível (limite 200, 365 dias) cabe no orçamento', () => {
    const size = packChannel(channel(900, 200, 365)).length
    console.info('[medicao] pacote | 900 vídeos, 200 acompanhados, 365 dias |', size, 'caracteres')
    expect(size).toBeLessThan(PACK_BUDGET)
  }, 30_000)
})
