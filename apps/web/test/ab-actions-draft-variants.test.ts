// @vitest-environment node
// T4b (M6): rascunho reaberto sem duplicar nem apagar — cleanupDraftVariants com `manter`, rótulo pedido em uploadVariant
// e getAbDraftById com as variantes no mesmo pedido.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const m = vi.hoisted(() => ({
  del: vi.fn(async () => undefined),
  put: vi.fn(),
  froms: [] as Array<{ table: string; select?: string; deleteIn?: string[]; deleteAll: boolean; insert?: Record<string, unknown> }>,
  respostas: {} as Record<string, unknown>,
}))

vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidateTag: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1', email: 'a@b.c' } } }) } }),
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))
vi.mock('@vercel/blob', () => ({ put: m.put, del: m.del }))
vi.mock('@/lib/youtube/ab-youtube', () => ({ setThumbnail: vi.fn(), fetchVariantImageBuffer: vi.fn() }))
vi.mock('@/lib/youtube/ab-rotation', () => ({ getVariantForCycle: vi.fn(), getNextVariantIndex: vi.fn() }))
vi.mock('@/lib/youtube/ab-statistics', () => ({ calculateBayesianConfidence: vi.fn() }))
vi.mock('@/lib/youtube/ab-metadata', () => ({ captureOriginalMetadata: vi.fn(), updateVideoMetadata: vi.fn() }))
vi.mock('@/lib/links/auto-link', () => ({ ensureTrackedLink: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      const reg: (typeof m.froms)[number] = { table, deleteAll: false }
      m.froms.push(reg)
      const resp = () => m.respostas[table] ?? { data: null, error: null }
      const cadeia: Record<string, unknown> = {}
      cadeia.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(resp()).then(res, rej)
      for (const k of ['eq', 'order', 'limit']) cadeia[k] = () => cadeia
      cadeia.select = (s: string) => { reg.select = s; return cadeia }
      cadeia.delete = () => { reg.deleteAll = true; return cadeia }
      cadeia.in = (_c: string, ids: string[]) => { reg.deleteIn = ids; reg.deleteAll = false; return cadeia }
      cadeia.insert = (row: Record<string, unknown>) => { reg.insert = row; return cadeia }
      cadeia.single = () => Promise.resolve(resp())
      cadeia.maybeSingle = () => Promise.resolve(resp())
      return cadeia
    },
  }),
}))

import { cleanupDraftVariants, uploadVariant } from '@/app/cms/(authed)/youtube/ab-lab/actions'
import { getAbDraftById } from '@/app/cms/(authed)/youtube/ab-lab/queries'

beforeEach(() => {
  m.del.mockClear(); m.put.mockReset(); m.froms.length = 0
  for (const k of Object.keys(m.respostas)) delete m.respostas[k]
})

/** O banco falso devolve a mesma resposta por tabela; ab_tests e ab_test_variants usam chaves diferentes. */
function bancoDeVariantes(linhas: Array<{ id: string; label: string; blob_url: string | null }>) {
  m.respostas.ab_tests = { data: { id: 't1', status: 'draft' }, error: null }
  m.respostas.ab_test_variants = { data: linhas, error: null }
}

describe('cleanupDraftVariants com `manter`', () => {
  const linhas = [
    { id: 'vb', label: 'B', blob_url: 'https://blob/B.jpg' },
    { id: 'vc', label: 'C', blob_url: 'https://blob/C.jpg' },
    { id: 'vd', label: 'D', blob_url: null },
  ]

  it('apaga só os rótulos fora de `manter`, e o `del` só atinge os blobs deles', async () => {
    bancoDeVariantes(linhas)
    expect(await cleanupDraftVariants('t1', { manter: ['B'] })).toEqual({ ok: true })
    expect(m.del.mock.calls.map(c => (c as unknown[])[0])).toEqual(['https://blob/C.jpg'])
    const apagou = m.froms.find(f => f.table === 'ab_test_variants' && f.deleteIn)
    expect(apagou?.deleteIn).toEqual(['vc', 'vd'])
  })

  it('manter todos: nada é apagado', async () => {
    bancoDeVariantes(linhas)
    await cleanupDraftVariants('t1', { manter: ['B', 'C', 'D'] })
    expect(m.del).not.toHaveBeenCalled()
    expect(m.froms.some(f => f.deleteIn || f.deleteAll)).toBe(false)
  })

  it('sem `opts` apaga todos os não originais (compatível com os outros chamadores)', async () => {
    bancoDeVariantes(linhas)
    await cleanupDraftVariants('t1')
    expect(m.del).toHaveBeenCalledTimes(2)
    expect(m.froms.some(f => f.table === 'ab_test_variants' && f.deleteAll)).toBe(true)
  })
})

describe('uploadVariant: rótulo pedido (N1)', () => {
  function enviar(label: string | null, usados: string[]) {
    m.respostas.ab_tests = { data: { id: 't1', status: 'draft', regra_duracao: null }, error: null }
    m.respostas.ab_test_variants = { data: usados.map(l => ({ id: `x${l}`, label: l })), error: null }
    m.put.mockResolvedValue({ url: 'https://blob/x.png', pathname: 'ab-test/t1/x.png' })
    const fd = new FormData()
    fd.append('file', new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' }))
    if (label) fd.append('label', label)
    return uploadVariant('t1', fd)
  }
  const rotuloGravado = () => m.froms.find(f => f.table === 'ab_test_variants' && f.insert)?.insert?.label

  it('usa o rótulo pedido quando é válido e está livre', async () => {
    m.respostas.ab_test_variants = undefined
    await enviar('C', [])
    expect(rotuloGravado()).toBe('C')
  })

  it('rótulo ocupado: usa o primeiro livre', async () => {
    await enviar('B', ['B'])
    expect(rotuloGravado()).toBe('C')
  })

  it('rótulo inválido ("Z") ou ausente: primeiro livre', async () => {
    await enviar('Z', [])
    expect(rotuloGravado()).toBe('B')
    m.froms.length = 0
    await enviar(null, [])
    expect(rotuloGravado()).toBe('B')
  })
})

describe('getAbDraftById traz as variantes no mesmo pedido (C1)', () => {
  it('um único from(ab_tests) com ab_test_variants no select, e variants em ordem', async () => {
    m.respostas.ab_tests = {
      data: {
        id: 'd1', youtube_video_id: 'yt1', name: 'Test: Meu vídeo', original_thumbnail_url: null, test_type: 'title', source_pipeline_id: null,
        ab_test_variants: [
          { id: 'vb', label: 'B', is_original: false, blob_url: null, title_text: 'Fila de 3 h', sort_order: 1 },
          { id: 'va', label: 'A', is_original: true, blob_url: 'https://blob/A.jpg', title_text: null, sort_order: 0 },
        ],
      },
      error: null,
    }
    const r = await getAbDraftById('d1')
    expect(m.froms).toHaveLength(1)
    expect(m.froms[0]?.table).toBe('ab_tests')
    expect(m.froms[0]?.select).toContain('ab_test_variants(id, label, is_original, blob_url, title_text, sort_order)')
    expect(r?.variants).toEqual([
      { id: 'va', label: 'A', isOriginal: true, thumbUrl: 'https://blob/A.jpg', titleText: '' },
      { id: 'vb', label: 'B', isOriginal: false, thumbUrl: null, titleText: 'Fila de 3 h' },
    ])
  })
})
