// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getUser = vi.fn()
const rpc = vi.fn()
const captureException = vi.fn()
const captureMessage = vi.fn()
vi.mock('@/lib/cms/cliente-de-sessao', () => ({ criarClienteDeSessao: async () => ({ auth: { getUser }, rpc }) }))
vi.mock('@sentry/nextjs', () => ({ captureException, captureMessage }))

const { exigirLeituraDoObservatorio } = await vi.importActual<typeof import('@/lib/youtube/observatorio/guarda-leitura')>('@/lib/youtube/observatorio/guarda-leitura')

const SITE = '11111111-1111-4111-8111-111111111111'

describe('exigirLeituraDoObservatorio', () => {
  beforeEach(() => { vi.clearAllMocks(); getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) })

  it('true passa e pergunta can_view_observatorio com o site', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    expect(await exigirLeituraDoObservatorio(SITE)).toEqual({ ok: true, user: { id: 'u1' } })
    expect(rpc).toHaveBeenCalledWith('can_view_observatorio', { p_site_id: SITE })
  })
  it('false = insufficient_access', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    expect(await exigirLeituraDoObservatorio(SITE)).toEqual({ ok: false, reason: 'insufficient_access' })
  })
  it('erro da RPC = nao_foi_possivel_conferir (nunca insufficient_access) e vai ao Sentry', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '57014' } })
    expect(await exigirLeituraDoObservatorio(SITE)).toEqual({ ok: false, reason: 'nao_foi_possivel_conferir' })
    expect(captureException).toHaveBeenCalledTimes(1)
  })
  it('exceção = nao_foi_possivel_conferir', async () => {
    rpc.mockRejectedValue(new Error('rede'))
    expect(await exigirLeituraDoObservatorio(SITE)).toEqual({ ok: false, reason: 'nao_foi_possivel_conferir' })
  })
  it('sem sessão = unauthenticated, sem chamar a RPC', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'x' } })
    expect(await exigirLeituraDoObservatorio(SITE)).toEqual({ ok: false, reason: 'unauthenticated' })
    expect(rpc).not.toHaveBeenCalled()
  })
  it.each([['t'], [1], [null], [{}], ['true']])('forma inesperada %j = nao_foi_possivel_conferir', async (v) => {
    rpc.mockResolvedValue({ data: v, error: null })
    expect(await exigirLeituraDoObservatorio(SITE)).toEqual({ ok: false, reason: 'nao_foi_possivel_conferir' })
    expect(captureMessage).toHaveBeenCalledTimes(1)
  })
})
