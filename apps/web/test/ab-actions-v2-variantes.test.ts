// @vitest-environment node
// S8-F4 T11: em v2 a 3ª variante não original recusa (N-1) e o aviso de volume nunca bloqueia.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { sb, aviso } = vi.hoisted(() => ({ sb: { regra: 'v2', existentes: 2 as number }, aviso: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from(t: string) {
      const q: Record<string, unknown> = {}
      const resolver = (): unknown => {
        if (t === 'ab_tests') return { data: { id: 't1', status: 'draft', site_id: 'site-1', test_type: 'title', regra_duracao: sb.regra }, error: null }
        if (t === 'ab_test_variants') return { data: Array.from({ length: sb.existentes }, (_, i) => ({ id: `v${i}`, label: ['B', 'C', 'D'][i] })), error: null, count: sb.existentes + 1 }
        if (t === 'content_pipeline') return { data: { id: 'p1', social_config: { thumbnail_alternatives: ['https://x/y.jpg'] } }, error: null }
        return { data: null, error: null }
      }
      const p: unknown = new Proxy(q, {
        get: (_o, k) => k === 'then' ? (ok: (v: unknown) => unknown) => Promise.resolve(resolver()).then(ok)
          : k === 'single' || k === 'maybeSingle' ? () => Promise.resolve(resolver()) : () => p,
      })
      return p
    },
  }),
}))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'a@b.c' } } }) } }),
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))
vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@vercel/blob', () => ({ put: vi.fn() }))
vi.mock('@/lib/youtube/ab-gravacao/aviso-volume', () => ({ avisoDeVolume: aviso, comEstatistica: vi.fn() }))

import { createTextVariant, uploadVariant, pullPipelineThumbnails, avisoDeVolumeDoTeste } from '@/app/cms/(authed)/youtube/ab-lab/actions'

const FRASE = 'a regra nova aceita até 2 variantes além da original'
beforeEach(() => { vi.clearAllMocks(); sb.regra = 'v2'; sb.existentes = 2 })

describe('N-1: 3ª variante não original em v2', () => {
  it('createTextVariant recusa com a frase', async () => {
    const r = await createTextVariant({ test_id: 't1', title_text: 'x' })
    expect(r).toEqual({ ok: false, error: FRASE })
  })
  it('uploadVariant recusa com a frase', async () => {
    const fd = new FormData(); fd.set('file', new File([new Uint8Array(10)], 'a.jpg', { type: 'image/jpeg' }))
    expect(await uploadVariant('t1', fd)).toEqual({ ok: false, error: FRASE })
  })
  it('pullPipelineThumbnails recusa com a frase', async () => {
    expect(await pullPipelineThumbnails('t1', 'p1')).toEqual({ ok: false, error: FRASE })
  })
  it('em v1 a regra velha segue (createTextVariant com 2 existentes não recusa pela frase)', async () => {
    sb.regra = 'v1'
    const r = await createTextVariant({ test_id: 't1', title_text: 'x' })
    expect(r.error).not.toBe(FRASE)
  })
})

describe('avisoDeVolumeDoTeste', () => {
  it('repassa o aviso (sem_medicao é ok: nunca bloqueia)', async () => {
    aviso.mockResolvedValue({ ok: true, aviso: { estado: 'sem_medicao', texto: 't' } })
    expect(await avisoDeVolumeDoTeste('t1')).toEqual({ ok: true, aviso: { estado: 'sem_medicao', texto: 't' } })
    expect(aviso).toHaveBeenCalledWith(expect.anything(), 'site-1', 't1', expect.any(Date), undefined)
  })
  it('D1: o pedido válido chega ao cálculo; inválido é recusado sem calcular', async () => {
    aviso.mockResolvedValue({ ok: true, aviso: { estado: 'sem_medicao', texto: 't' } })
    await avisoDeVolumeDoTeste('t1', { V: 2 })
    expect(aviso).toHaveBeenCalledWith(expect.anything(), 'site-1', 't1', expect.any(Date), { V: 2 })
    aviso.mockClear()
    expect(await avisoDeVolumeDoTeste('t1', { V: 9 })).toEqual({ ok: false, error: 'pedido inválido' })
    expect(aviso).not.toHaveBeenCalled()
  })
  it('erro do cálculo vira { ok:false, error }', async () => {
    aviso.mockResolvedValue({ ok: false, erro: 'x' })
    expect(await avisoDeVolumeDoTeste('t1')).toEqual({ ok: false, error: 'x' })
  })
})

describe('teto_explicito no schema e no reducer', () => {
  it('AbTestConfigSchema.parse preserva teto_explicito (Phil m-A)', async () => {
    const { AbTestConfigSchema } = await import('@/lib/youtube/ab-schemas')
    const r = AbTestConfigSchema.parse({ max_duration_days: 12, confidence_threshold: 0.9, burn_in_days: 1, rotation_pattern: 'abba', stability_threshold: 3, teto_explicito: true })
    expect(r.teto_explicito).toBe(true)
  })
  it('UPDATE_CONFIG de duration marca durationTouched; outras chaves não', async () => {
    const { wizardReducer } = await import('@/lib/youtube/ab-wizard-reducer')
    const base = { step: 3, type: 'title', variants: [], config: { confidence: 95, duration: 14, burnIn: 2, rotation: 'abba' }, videoId: 'v', videoTitle: 't', originalThumbUrl: null, draftTestId: null, isLaunching: false, error: null, hypothesis: '' } as Parameters<typeof wizardReducer>[0]
    expect(wizardReducer(base, { type: 'UPDATE_CONFIG', key: 'duration', value: 16 }).config.durationTouched).toBe(true)
    expect(wizardReducer(base, { type: 'UPDATE_CONFIG', key: 'burnIn', value: 1 }).config.durationTouched).toBeUndefined()
  })
})
