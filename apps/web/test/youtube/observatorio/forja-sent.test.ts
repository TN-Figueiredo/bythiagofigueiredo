// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildSent, normalizeNumberToken, canonicalNumberTokens, type SentPack } from '@/lib/youtube/observatorio/forja/sent'
import { RULES } from '@/lib/youtube/observatorio/rules'
import type { Dataset } from '@/lib/youtube/observatorio/types'

const ds = datasetFromOracle(loadOracle())
const obs = createObservatory(ds)
const ID_KEYS = new Set(['id', 'video', 'change'])

/** R30/R38: the one citation rule — every cell preformatted, every canonical number of text and cells in `numbers`. */
function citationGaps(p: SentPack): string[] {
  const nums = new Set(p.numbers), gaps: string[] = []
  for (const n of p.numbers) if (canonicalNumberTokens(n).join('|') !== n) gaps.push('not canonical: ' + n)
  for (const t of canonicalNumberTokens(p.text)) if (!nums.has(t)) gaps.push('text: ' + t)
  for (const it of p.items) for (const [k, v] of Object.entries(it)) {
    if (!(v === null || typeof v === 'string')) gaps.push(k + ' is not preformatted')
    if (!ID_KEYS.has(k)) for (const t of canonicalNumberTokens(v)) if (!nums.has(t)) gaps.push(k + ': ' + v + ' → ' + t)
  }
  for (const n of [p.nVideos, p.nOutliers]) if (!nums.has(canonicalNumberTokens(String(n))[0]!)) gaps.push('count ' + n)
  return gaps
}
const expectCitable = (p: SentPack) => expect(citationGaps(p)).toEqual([])

describe('canonical number tokens — the forja worker\'s canonicaliser (R38)', () => {
  // Literal cases from leituras_obs.py (FORMA CANONICA docstring + "Exemplos" line + the "de propósito" notes).
  it.each([
    ['8,2×', ['8,2×']], ['1,5 mil', ['1,5 mil']], ['207,6 mil', ['207,6 mil']], ['1,9 mi', ['1,9 mi']], ['−41%', ['−41%']], ['12 pp', ['12 pp']], ['1.230', ['1.230']], ['3', ['3']],
    ['+12 pp', ['12 pp']], ['1230', ['1.230']], ['8,2x', ['8,2×']], ['8,2 ×', ['8,2×']], ['−41 %', ['−41%']], ['12pp', ['12 pp']],
    ['3h', ['3 h']], ['3 h', ['3 h']], ['2º', ['2º']], ['2o', ['2º']], ['2ª', ['2ª']], ['2a', ['2ª']], ['60s', ['60s']],
    ['8,20', ['8,20']], ['1,5', ['1,5']], ['41%', ['41%']], ['-41%', ['−41%']], ['1,5\u00a0mil', ['1,5 mil']], ['1,5mil', ['1,5 mil']],
    ['1,9 milhoes', ['1,9']], ['2025-2026', ['2.025', '2.026']], ['top-10', ['10']], ['id dqw4w9', []], ['200k', []], ['8.2×', ['8']], ['0041', ['0041']],
  ] as const)('%j → %j', (a, b) => expect(canonicalNumberTokens(a)).toEqual([...b]))
  it('dates, times and the hours of a window: each part, "N h" for hours', () => {
    expect(canonicalNumberTokens('vista entre 24/10 06h e 12h, há 11 h, às 12:00')).toEqual(['24', '10', '06 h', '12 h', '11 h', '12', '00'])
  })
  it.each([['8,2x', '8,2×'], ['1,5\u00a0mil', '1,5 mil'], ['-41%', '−41%'], ['+5 pp', '5 pp'], ['3h', '3 h'], ['  12 ', '12'], ['1230', '1.230'], ['sem número', '']] as const)(
    'normalizeNumberToken(%j) = %j', (a, b) => expect(normalizeNumberToken(a)).toBe(b))
})

describe('buildSent — padrões de título / temas', () => {
  const p = buildSent(obs, 'padroes-titulo', { niche: 'ia' })
  it('the frozen data: text, asOf, ids, counts agree with the preview of the same request', () => {
    const pv = obs.forja.preview('padroes-titulo', 'ia')
    expect(p.text).toMatch(/^dados enviados à forja: \d+ longos até \d\d\/\d\d \d\d:\d\d \(\d+ canais(?: com vídeos longos)?, 6 meses; \d+ outliers? de 2,0× ou mais\)$/)
    expect(p.asOf).toBe(obs.date.snapTime(obs.LAST_IDX))
    expect(p.capped).toBe(false)
    expect(p.ids.length).toBe(p.nVideos)
    expect(p.nVideos).toBeLessThanOrEqual(pv.nVideos!)
    expect(p.items.filter(i => i.kind === 'vídeo').map(i => i.id)).toEqual(p.ids)
  })
  it('a channel with no sync for more than 24 h is in channelsOut with its reason, and none of its videos is sent', () => {
    expect(p.channelsOut).toContainEqual({ id: 'esq-unltd-daily', reason: 'Esq Unltd Daily fica fora: sem sincronização há 3 dias' })
    expect(p.channels).not.toContain('esq-unltd-daily')
    expect(p.ids.some(id => obs.video(id)!.ch === 'esq-unltd-daily')).toBe(false)
    const v = buildSent(obs, 'padroes-titulo', { niche: 'viagem' })
    expect(v.channelsOut.find(o => o.id === 'paddy-doyle')?.reason).toBe('Paddy Doyle fica fora: sem sincronização há 39 h')
  })
  it('numbers contains every fmt.mult of the outliers sent', () => {
    const outs = p.ids.map(id => obs.video(id)!).filter(v => v.mult && v.mult.value != null && !v.mult.weak && v.mult.value >= 2)
    expect(outs.length).toBe(p.nOutliers)
    expect(outs.length).toBeGreaterThan(0)
    for (const v of outs) expect(p.numbers).toContain(obs.fmt.mult(v.mult!.value))
  })
  it.each([['padroes-titulo', 'ia'], ['padroes-titulo', 'viagem'], ['padroes-titulo-shorts', 'ia'], ['padroes-titulo-shorts', 'viagem'], ['temas', 'ia'], ['temas', 'viagem'], ['resumo-trocas', 'ia'], ['resumo-trocas', 'viagem']] as const)(
    'R30 citation rule holds: %s × %s', (type, niche) => expectCitable(buildSent(obs, type, { niche })))
  it('every pack the facade builds (all types × niches, leitura-video of every tracked video): every canonical token of text and cells is in numbers', () => {
    const gaps: string[] = []
    for (const t of ['padroes-titulo', 'padroes-titulo-shorts', 'temas', 'resumo-trocas']) for (const n of ['ia', 'viagem'] as const) gaps.push(...citationGaps(buildSent(obs, t, { niche: n })).map(g => t + '/' + n + ' ' + g))
    for (const v of obs.videos.filter(x => x.tracked)) gaps.push(...citationGaps(buildSent(obs, 'leitura-video', { videoId: v.id })).map(g => v.id + ' ' + g))
    expect(gaps).toEqual([])
  })
  it('cells are pt-BR forms, never raw numbers (views "207,6 mil", mult "8,2×")', () => {
    const v = p.items.find(i => i.kind === 'vídeo')!
    expect(v.mult).toMatch(/^\d+,\d×$/)
    expect(v.views).toMatch(/^\d+(,\d)?( mil| mi)?$/)
  })
  it('Shorts: "N Shorts" and "canais com Shorts"', () => {
    const s = buildSent(obs, 'padroes-titulo-shorts', { niche: 'ia' })
    expect(s.text).toMatch(/^dados enviados à forja: \d+ Shorts? até .* canais? com Shorts, 6 meses;/)
    expect(s.ids.every(id => obs.video(id)!.fmt === 'short')).toBe(true)
  })
})

describe('buildSent — the 400 cap', () => {
  // the IA niche twice over: every IA video gets a twin, so the niche has more than RULES.forja.maxVideos videos
  const d: Dataset = (() => {
    const base = datasetFromOracle(loadOracle())
    const twins = base.videos.filter(v => v.niche === 'ia').map(v => ({ ...structuredClone(v), id: v.id + '-gemeo' }))
    return { ...base, videos: [...base.videos, ...twins] }
  })()
  const o = createObservatory(d)
  const p = buildSent(o, 'padroes-titulo', { niche: 'ia' })
  const total = o.forja.preview('padroes-titulo', 'ia')
  it('caps at RULES.forja.maxVideos = 400, most recent first, and says so', () => {
    expect(RULES.forja.maxVideos).toBe(400)
    expect(p.capped).toBe(true)
    expect(p.nVideos).toBe(400)
    expect(p.ids.length).toBe(400)
    const pubs = p.ids.map(id => o.video(id)!.pub)
    expect(pubs).toEqual([...pubs].sort((a, b) => b - a))
    const all = Number(/mais recentes de ([\d.]+)/.exec(p.text)![1]!.replace('.', ''))
    expect(all).toBeGreaterThan(400)
    expect(all).toBeLessThanOrEqual(total.nVideos!)
    expect(p.text).toMatch(/^dados enviados à forja: os 400 longos mais recentes de [\d.]+ até /)
    expect(p.numbers).toContain('400')
    expectCitable(p)
  })
})

describe('buildSent — empty niche, resumo-trocas, leitura-video, errors', () => {
  it('an empty niche → nVideos 0 and "nenhum vídeo …" (never "0 vídeos" posing as data)', () => {
    const d: Dataset = { ...datasetFromOracle(loadOracle()) }
    d.channels = d.channels.map(c => c.niche === 'ia' && !c.own ? { ...c, sync: { ...c.sync, last: d.now - 5 * 864e5 } } : c)
    const p = buildSent(createObservatory(d), 'padroes-titulo', { niche: 'ia' })
    expect(p.nVideos).toBe(0)
    expect(p.items).toEqual([])
    expect(p.text).toBe('nenhum vídeo para enviar à forja: nenhum canal do nicho entra no pedido')
    expect(p.text).not.toMatch(/\b0 (vídeos|longos)/)
    expect(p.channelsOut.length).toBeGreaterThan(0)
  })
  it('resumo-trocas: the changes of the last 30 days up to asOf, of the channels in', () => {
    const p = buildSent(obs, 'resumo-trocas', { niche: 'viagem' })
    expect(p.text).toMatch(/^dados enviados à forja: \d+ trocas? \(\d+ de título, \d+ de thumbnail, \d+ de descrição\) de \d\d\/\d\d a \d\d\/\d\d \d\d:\d\d$/)
    const cs = p.items.map(i => obs.change(i.change!)!)
    expect(cs.every(c => c.at <= p.asOf && p.channels.includes(c.ch))).toBe(true)
    expect(cs.some(c => c.ch === 'paddy-doyle')).toBe(false)
    expect(p.ids).toEqual(expect.arrayContaining(cs.map(c => c.id)))
  })
  it('leitura-video: history up to the video\'s last point (stalled channel), every cell citable', () => {
    const p = buildSent(obs, 'leitura-video', { videoId: 'paddy-bkk-hotel' })
    const v = obs.video('paddy-bkk-hotel')!, last = v.series[v.series.length - 1]!.t
    expect(p.asOf).toBe(last)
    expect(p.text.endsWith('de views, até ' + obs.date.dmhm(last))).toBe(true)
    expect(p.channelsOut.map(o => o.id)).toEqual(['paddy-doyle'])
    expectCitable(p)
    expectCitable(buildSent(obs, 'leitura-video', { videoId: 'matt-opus55' }))
  })
  it('leitura-video caps the daily records at the 400 most recent and says so', () => {
    const d = datasetFromOracle(loadOracle()), v = d.videos.find(x => x.id === 'dale-philip-l97')!
    const first = v.series[0]!
    const older = Array.from({ length: 480 }, (_, k) => { const idx = first.idx - 480 + k; return { idx, t: d.snap0 + idx * 864e5, views: Math.max(0, first.views - (480 - k) * 10) } })
    v.series = [...older, ...v.series]; v.firstIdx = older[0]!.idx
    const o = createObservatory(d), p = buildSent(o, 'leitura-video', { videoId: v.id })
    const recs = p.items.filter(i => i.kind === 'registro diário')
    expect(p.capped).toBe(true)
    expect(recs.length).toBe(400)
    expect(recs[recs.length - 1]!.at).toBe(o.date.dmhm(v.series[v.series.length - 1]!.t))
    expect(p.text).toMatch(/ e os 400 registros diários de views mais recentes de 502, até \d\d\/\d\d \d\d:\d\d$/)
    expectCitable(p)
    expect(buildSent(obs, 'leitura-video', { videoId: 'matt-opus55' }).capped).toBe(false)
  })
  it('one request = one type × one target', () => {
    expect(() => buildSent(obs, 'padroes-titulo', {})).toThrow(/needs a niche/)
    expect(() => buildSent(obs, 'leitura-video', { niche: 'ia' })).toThrow(/needs a videoId/)
    expect(() => buildSent(obs, 'outro', { niche: 'ia' })).toThrow(/unknown reading type/)
    expect(buildSent(obs, 'temas', { niche: 'ia' })).toEqual(obs.forja.buildSent('temas', { niche: 'ia' }))
  })
})
