// A imagem da ficha mora em `ab-native-ficha/`; o cron de rascunhos e `deleteVariant` só olham `ab_test_variants`.
// Este teste trava isso: nenhum `del` recebe uma URL da ficha, e nenhum dos dois lê `ab_native_fichas`.
import { describe, it, expect, vi, beforeEach } from 'vitest'

process.env.CRON_SECRET = 'segredo'
const URL_FICHA = 'https://x.public.blob.vercel-storage.com/ab-native-ficha/s/f/' + 'a'.repeat(64) + '.jpg'
const URL_VARIANTE = 'https://x.public.blob.vercel-storage.com/ab-test/t1/B.jpg'

const mocks = vi.hoisted(() => ({ del: vi.fn(), get: vi.fn(), acesso: vi.fn() }))
vi.mock('@vercel/blob', () => ({ del: mocks.del, put: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: mocks.get }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/cron-health', () => ({ recordCronSuccess: vi.fn(), recordCronFailure: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/youtube/ab-lab-acesso', () => ({ requireEditUser: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: mocks.acesso }))

import { GET } from '@/app/api/cron/ab-draft-cleanup/route'
import { deleteVariant } from '@/app/cms/(authed)/youtube/ab-lab/actions'

function banco(status: 'archived' | 'draft') {
  const tabelasLidas: string[] = []
  const from = vi.fn((tabela: string) => {
    tabelasLidas.push(tabela)
    const q: Record<string, unknown> = {}
    const fim = async () => {
      if (tabela === 'ab_tests') return { data: [{ id: 't1', status }], error: null }
      if (tabela === 'ab_test_variants') return { data: [{ id: 'v1', test_id: 't1', is_original: false, blob_url: URL_VARIANTE }], error: null }
      return { data: [], error: null }
    }
    for (const m of ['select', 'eq', 'lt', 'in', 'not', 'limit', 'update', 'delete']) q[m] = () => q
    q.single = async () => { const r = await fim(); return { data: r.data[0] ?? null, error: null } }
    q.then = (res: (v: unknown) => unknown) => fim().then(res)
    return q
  })
  const rpc = vi.fn(async (nome: string) => ({ data: nome === 'cron_try_lock' ? true : null, error: null }))
  return { from, rpc, tabelasLidas }
}

beforeEach(() => { mocks.del.mockReset(); mocks.get.mockReset(); mocks.acesso.mockReset() })

describe('limpeza de rascunhos não toca a imagem da ficha', () => {
  it('cron ab-draft-cleanup: `del` só com URL de variante e nunca lê ab_native_fichas', async () => {
    const b = banco('archived')
    mocks.get.mockReturnValue(b)
    const r = await GET(new Request('http://x/api/cron/ab-draft-cleanup', { headers: { authorization: 'Bearer segredo' } }))
    expect(r.status).toBe(200)
    expect(mocks.del).toHaveBeenCalled()
    for (const chamada of mocks.del.mock.calls) {
      const urls = ([] as string[]).concat(chamada[0] as string | string[])
      expect(urls).not.toContain(URL_FICHA)
      expect(urls.every((u) => !u.includes('/ab-native-ficha/'))).toBe(true)
    }
    expect(b.tabelasLidas).not.toContain('ab_native_fichas')
  })

  it('deleteVariant: `del` só com a URL da variante e nunca lê ab_native_fichas', async () => {
    const b = banco('draft')
    mocks.get.mockReturnValue(b)
    mocks.acesso.mockResolvedValue({ ok: true })
    const r = await deleteVariant('v1')
    expect(r.ok).toBe(true)
    expect(mocks.del).toHaveBeenCalledWith(URL_VARIANTE)
    expect(mocks.del).not.toHaveBeenCalledWith(URL_FICHA)
    expect(b.tabelasLidas).not.toContain('ab_native_fichas')
  })
})
