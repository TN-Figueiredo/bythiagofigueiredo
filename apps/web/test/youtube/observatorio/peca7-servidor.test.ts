// apps/web/test/youtube/observatorio/peca7-servidor.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LINHA_DO_DONO } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'

const rpc = vi.fn(); const criar = vi.fn(() => ({ rpc })); const captureMessage = vi.fn(); const captureException = vi.fn()
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => criar() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => captureMessage(...a), captureException: (...a: unknown[]) => captureException(...a) }))
vi.mock('server-only', () => ({}))

const SITE = '00000000-0000-0000-0000-00000000a3b0', AGORA = new Date('2028-05-03T15:00:00Z')
const ITEM = { item_id: 'canal:aaaaaaaa-1111-2222-3333-444444444444', kind: 'canal', tempo: 'apagar_antigas', desde: '2028-03-01T12:00:00Z', mes: null,
  channel_ref: 'aaaaaaaa-1111-2222-3333-444444444444', youtube_id: null, marcado_rodado_em: null,
  apagar: [{ filho: 'numerico', caminho: 'canal/x.csv', sha256: 'a'.repeat(64), nova: null }], b2_nomes: ['canal/b2-secreto.csv'] }
// O Zod é estrito: `total` obrigatório e igual a itens.length; `apagar`/`b2_nomes` só existem (e não vazios) em 'apagar_antigas'.
const CORPO = { versao: 1, lido_em: '2028-05-03T15:00:00Z', total: 1, itens: [ITEM] }
const chamar = async (perm: { podeEditar: boolean; canUnlock: boolean }) => (await import('@/app/cms/(authed)/youtube/competitors/_canais/pendencias-da-fila')).lerPendenciasDaFila(SITE, perm, AGORA)

describe('lerPendenciasDaFila', () => {
  beforeEach(() => { vi.resetModules(); rpc.mockReset(); criar.mockClear(); captureMessage.mockClear(); process.env.OBS_ARQUIVO = 'on' })
  it('sem edição: o cliente de serviço não é criado e a resposta é nula', async () => {
    expect(await chamar({ podeEditar: false, canUnlock: false })).toBeNull()
    expect(criar).not.toHaveBeenCalled()
  })
  it('só edita: serializado sem linha, sem apagar, sem b2_nomes', async () => {
    rpc.mockResolvedValue({ data: CORPO, error: null })
    const r = await chamar({ podeEditar: true, canUnlock: false })
    expect(r).toMatchObject({ estado: 'com_itens', linha: null })
    expect(JSON.stringify(r)).not.toMatch(/"apagar"|b2_nomes|b2Nomes|b2-secreto|canal\/x\.csv/)
  })
  it('administra: a linha é exatamente a linha do dono', async () => {
    rpc.mockResolvedValue({ data: CORPO, error: null })
    expect(await chamar({ podeEditar: true, canUnlock: true })).toMatchObject({ linha: LINHA_DO_DONO })
  })
  it('OBS_ARQUIVO apagada: nulo e rpc não chamada', async () => {
    delete process.env.OBS_ARQUIVO
    expect(await chamar({ podeEditar: true, canUnlock: true })).toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rpc com erro: não medido e Sentry', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '57014' } })
    expect(await chamar({ podeEditar: true, canUnlock: true })).toEqual({ estado: 'nao_medido' })
    expect(captureMessage).toHaveBeenCalledWith('obs_archive_owner_pending: 57014', 'error')
  })
  it('função ausente (42883): não medido, aviso e não erro', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42883' } })
    expect(await chamar({ podeEditar: true, canUnlock: true })).toEqual({ estado: 'nao_medido' })
    expect(captureMessage).toHaveBeenCalledWith('obs_archive_owner_pending: 42883', 'warning')
  })
  it('resposta fora da forma: não medido, nunca lista vazia', async () => {
    rpc.mockResolvedValue({ data: { versao: 2, itens: [] }, error: null })
    expect(await chamar({ podeEditar: true, canUnlock: true })).toEqual({ estado: 'nao_medido' })
  })
  it('rpc lança: não medido', async () => {
    rpc.mockRejectedValue(new Error('rede'))
    expect(await chamar({ podeEditar: true, canUnlock: true })).toEqual({ estado: 'nao_medido' })
    expect(captureException).toHaveBeenCalled()
  })
})
