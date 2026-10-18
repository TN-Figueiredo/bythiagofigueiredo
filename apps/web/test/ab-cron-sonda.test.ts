// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { criarFakeSb } from './helpers/fake-sb-gravacao'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/cron-health', () => ({ recordCronSuccess: vi.fn(), recordCronFailure: vi.fn() }))

import { GET } from '@/app/api/cron/ab-sonda-miniatura/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'

const pedido = (auth?: string) => new Request('http://localhost:3000/api/cron/ab-sonda-miniatura', { headers: auth ? { authorization: auth } : {} })

beforeEach(() => { vi.stubEnv('CRON_SECRET', 'test-secret'); vi.clearAllMocks() })
afterEach(() => { vi.unstubAllEnvs() })

describe('GET /api/cron/ab-sonda-miniatura', () => {
  it('401 sem o segredo e sem tocar no banco', async () => {
    const res = await GET(pedido())
    expect(res.status).toBe(401)
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })

  it('zero teste ativo: 200, recordCronSuccess e nenhum fetch', async () => {
    const espiaoFetch = vi.spyOn(globalThis, 'fetch')
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(criarFakeSb({}).sb)
    const res = await GET(pedido('Bearer test-secret'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ok', testes: 0 })
    expect(recordCronSuccess).toHaveBeenCalledWith('ab-sonda-miniatura')
    expect(recordCronFailure).not.toHaveBeenCalled()
    expect(espiaoFetch).not.toHaveBeenCalled()
    espiaoFetch.mockRestore()
  })
})
