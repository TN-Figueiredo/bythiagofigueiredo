// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import {
  classifyShort, probeShort, probeShortsBatch, newProbeBudget, needsShortProbe, isCertainShort,
  SHORT_PROBE_CONCURRENCY,
} from '@/lib/youtube/short-classifier'

const ID = 'AAAAAAAAAA1'
const res = (status: number, location?: string) =>
  ({ status, headers: new Headers(location ? { location } : {}), body: null }) as unknown as Response

describe('classifyShort (R109)', () => {
  const table: Array<[string, Parameters<typeof classifyShort>[0], { isShort: boolean; confirmed: boolean }]> = [
    ['45 s', { durationSeconds: 45 }, { isShort: true, confirmed: true }],
    ['60 s', { durationSeconds: 60 }, { isShort: true, confirmed: true }],
    ['61 s sonda 200', { durationSeconds: 61, probe: 'short' }, { isShort: true, confirmed: true }],
    ['61 s sonda 303', { durationSeconds: 61, probe: 'normal' }, { isShort: false, confirmed: true }],
    ['61 s timeout (R114: grava como não Short)', { durationSeconds: 61, probe: 'inconclusive' }, { isShort: false, confirmed: false }],
    ['61 s sem sonda', { durationSeconds: 61 }, { isShort: false, confirmed: false }],
    ['180 s sonda normal', { durationSeconds: 180, probe: 'normal' }, { isShort: false, confirmed: true }],
    ['181 s nunca', { durationSeconds: 181, probe: 'short' }, { isShort: false, confirmed: true }],
    ['181 s com #Shorts nunca', { durationSeconds: 181, title: 'x #Shorts' }, { isShort: false, confirmed: true }],
    ['nula sem tag', { durationSeconds: null }, { isShort: false, confirmed: true }],
    ['nula com #Shorts (comportamento antigo)', { durationSeconds: null, title: 'a #Shorts' }, { isShort: true, confirmed: true }],
    ['90 s com #Shorts', { durationSeconds: 90, title: 'a #Shorts' }, { isShort: true, confirmed: true }],
  ]
  it.each(table)('%s', (_n, input, want) => { expect(classifyShort(input)).toEqual(want) })
  it('helpers', () => {
    expect(needsShortProbe(61)).toBe(true); expect(needsShortProbe(60)).toBe(false); expect(needsShortProbe(181)).toBe(false); expect(needsShortProbe(null)).toBe(false)
    expect(isCertainShort(60)).toBe(true); expect(isCertainShort(61)).toBe(false); expect(isCertainShort(null)).toBe(false)
  })
})

describe('probeShort', () => {
  it('200 = short, com redirect manual e sem cookies', async () => {
    const f = vi.fn(async () => res(200))
    expect(await probeShort(ID, f as unknown as typeof fetch)).toBe('short')
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`https://www.youtube.com/shorts/${ID}`)
    expect(init.redirect).toBe('manual'); expect(init.credentials).toBe('omit')
    expect(String((init.headers as Record<string, string>)['user-agent'])).toContain('Mozilla')
  })
  it('303 para /watch = normal', async () => {
    expect(await probeShort(ID, (async () => res(303, `/watch?v=${ID}`)) as unknown as typeof fetch)).toBe('normal')
  })
  it('302 para consent, 429, 500 e 200-like estranhos = inconclusivo', async () => {
    expect(await probeShort(ID, (async () => res(302, 'https://consent.youtube.com/m?continue=x')) as unknown as typeof fetch)).toBe('inconclusive')
    expect(await probeShort(ID, (async () => res(429)) as unknown as typeof fetch)).toBe('inconclusive')
    expect(await probeShort(ID, (async () => res(503)) as unknown as typeof fetch)).toBe('inconclusive')
  })
  it('timeout/erro = inconclusivo, nunca lança', async () => {
    expect(await probeShort(ID, (async () => { throw new DOMException('t', 'TimeoutError') }) as unknown as typeof fetch)).toBe('inconclusive')
  })
  it('id inválido não gera requisição', async () => {
    const f = vi.fn()
    expect(await probeShort('../evil?x=1', f as unknown as typeof fetch)).toBe('inconclusive')
    expect(await probeShort('curto', f as unknown as typeof fetch)).toBe('inconclusive')
    expect(f).not.toHaveBeenCalled()
  })
})

describe('probeShortsBatch', () => {
  it('respeita o teto, a concorrência e deixa o excedente sem entrada', async () => {
    let inflight = 0, peak = 0
    const f = vi.fn(async () => { inflight++; peak = Math.max(peak, inflight); await new Promise(r => setTimeout(r, 2)); inflight--; return res(200) })
    const ids = Array.from({ length: 10 }, (_, i) => `AAAAAAAAA${String(i).padStart(2, '0')}`)
    const budget = newProbeBudget(6)
    const out = await probeShortsBatch(ids, budget, f as unknown as typeof fetch)
    expect(f).toHaveBeenCalledTimes(6)
    expect(out.size).toBe(6)
    expect(budget.remaining).toBe(0)
    expect(peak).toBeLessThanOrEqual(SHORT_PROBE_CONCURRENCY)
    expect(await probeShortsBatch(ids, budget, f as unknown as typeof fetch)).toEqual(new Map())
    expect(budget.stats).toMatchObject({ attempted: 6, shorts: 6, regular: 0, inconclusive: 0 })
  })
})
