// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

type Res = { data: unknown; error: unknown }
let testeRes: Res
let varRes: Res
let requireOk = true
const eqTeste = vi.fn()
const eqVar = vi.fn()
const limitVar = vi.fn()

function builderTeste() {
  const b: Record<string, unknown> = {}
  b.select = vi.fn(() => b)
  b.eq = vi.fn((...a: unknown[]) => { eqTeste(...a); return b })
  b.maybeSingle = vi.fn(async () => testeRes)
  return b
}
function builderVar() {
  const b: Record<string, unknown> = {}
  b.select = vi.fn(() => b)
  b.eq = vi.fn((...a: unknown[]) => { eqVar(...a); return b })
  b.limit = vi.fn(async (n: number) => { limitVar(n); return varRes })
  return b
}
const mockSupabase = { from: vi.fn((t: string) => (t === 'ab_tests' ? builderTeste() : builderVar())) }

vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn(),
  requireSiteScope: vi.fn(async () => (requireOk ? { ok: true } : { ok: false, reason: 'forbidden' })),
}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => mockSupabase }))
vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidateTag: vi.fn(), revalidatePath: vi.fn() }))

import { lerDimensoesDaOriginal } from '../../src/app/cms/(authed)/youtube/ab-lab/actions'

describe('lerDimensoesDaOriginal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireOk = true
    testeRes = { data: { id: 't1' }, error: null }
    varRes = { data: [], error: null }
  })

  it('(a) sem permissão: ok false', async () => {
    requireOk = false
    expect(await lerDimensoesDaOriginal('t1')).toEqual({ ok: false })
  })
  it('(b) teste de outro site: ok false, e filtra por site_id', async () => {
    testeRes = { data: null, error: null }
    expect(await lerDimensoesDaOriginal('t1')).toEqual({ ok: false })
    expect(eqTeste).toHaveBeenCalledWith('site_id', 'site-1')
  })
  it('(c) original 480x360 com dhash: medida', async () => {
    varRes = { data: [{ dimensions: '480x360', thumbnail_dhash: 'abc' }], error: null }
    expect(await lerDimensoesDaOriginal('t1')).toEqual({ ok: true, dimensions: '480x360', medida: true })
  })
  it('(d1) sem dimensions e sem dhash: não medida', async () => {
    varRes = { data: [{ dimensions: null, thumbnail_dhash: null }], error: null }
    expect(await lerDimensoesDaOriginal('t1')).toEqual({ ok: true, dimensions: null, medida: false })
  })
  it('(d2) 0x0 com dhash: medida', async () => {
    varRes = { data: [{ dimensions: '0x0', thumbnail_dhash: 'abc' }], error: null }
    expect(await lerDimensoesDaOriginal('t1')).toEqual({ ok: true, dimensions: '0x0', medida: true })
  })
  it('(d3) nenhuma linha is_original: não medida', async () => {
    varRes = { data: [], error: null }
    expect(await lerDimensoesDaOriginal('t1')).toEqual({ ok: true, dimensions: null, medida: false })
  })
  it('(e) filtra is_original = true e limita a 2', async () => {
    await lerDimensoesDaOriginal('t1')
    expect(eqVar).toHaveBeenCalledWith('is_original', true)
    expect(limitVar).toHaveBeenCalledWith(2)
  })
  it('(f) erro na consulta de variantes: ok false', async () => {
    varRes = { data: null, error: { message: 'x' } }
    expect(await lerDimensoesDaOriginal('t1')).toEqual({ ok: false })
  })
  it('(g) duas originais: ambíguo, ok false', async () => {
    varRes = { data: [{ dimensions: '480x360', thumbnail_dhash: 'a' }, { dimensions: '1920x1080', thumbnail_dhash: 'b' }], error: null }
    expect(await lerDimensoesDaOriginal('t1')).toEqual({ ok: false })
  })
  it('(h) erro na consulta de ab_tests: ok false', async () => {
    testeRes = { data: null, error: { message: 'x' } }
    expect(await lerDimensoesDaOriginal('t1')).toEqual({ ok: false })
  })
})
