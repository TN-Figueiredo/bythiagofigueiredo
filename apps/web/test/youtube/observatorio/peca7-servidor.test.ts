// apps/web/test/youtube/observatorio/peca7-servidor.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LINHA_DO_DONO } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'

const rpc = vi.fn(); const criar = vi.fn(() => ({ rpc })); const captureMessage = vi.fn(); const captureException = vi.fn()
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => criar() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => captureMessage(...a), captureException: (...a: unknown[]) => captureException(...a) }))
vi.mock('server-only', () => ({}))

const SITE = '00000000-0000-0000-0000-00000000a3b0', AGORA = new Date('2025-05-03T15:00:00Z')
const ITEM = { item_id: 'canal:aaaaaaaa-1111-2222-3333-444444444444', kind: 'canal', tempo: 'apagar_antigas', desde: '2025-03-01T12:00:00Z', mes: null,
  channel_ref: 'aaaaaaaa-1111-2222-3333-444444444444', youtube_id: null, marcado_rodado_em: null,
  apagar: [{ filho: 'numerico', caminho: 'serie/canais/aaaaaaaa-1111-2222-3333-444444444444/x.csv', sha256: 'a'.repeat(64), nova: { caminho: 'serie/canais/aaaaaaaa-1111-2222-3333-444444444444/y.csv', sha256: 'b'.repeat(64) } }], b2_nomes: [],
  falta: null, motivo: null, prefixos: [], bloqueados: 0, snapshot_mais_antigo: null }
const ITEM_B2 = { ...ITEM, item_id: 'canal:bbbbbbbb-1111-2222-3333-444444444444', channel_ref: 'bbbbbbbb-1111-2222-3333-444444444444', tempo: 'conferir_b2', apagar: [], b2_nomes: ['canal/b2-secreto.csv'] }
// O Zod é estrito: `total` obrigatório e igual a itens.length; `apagar` só existe (e não vazio) em 'apagar_antigas' e `b2_nomes` em 'conferir_b2' (versao 2).
const CORPO = { versao: 2, lido_em: '2025-05-03T15:00:00Z', total: 2, itens: [ITEM, ITEM_B2] }
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

  describe('nome do canal que já saiu (Yannis R-1 = Gio D4)', () => {
    const REF = ITEM.channel_ref
    const SEM_COMANDO = { ...ITEM, tempo: 'sem_comando', falta: 'snapshots', apagar: [], b2_nomes: [] }
    const linha = (nome: string | null) => ({ channel_ref: REF, versao: 2, estado: 'pedido', decided_at: null, nas_absent_at: null, b2_absent_at: null, snapshots_clear_on: null, reappeared_at: null,
      reappeared_count: 0, online_thumbs_known: null, thumbs_unknown_ack_at: null, blobs_pendentes: 0, youtube_channel_id: null, nome, removido_em: null, removido_via: 'botao',
      primeiro_mes: null, ultimo_mes: null, meses: null, registros: null, classes: [] })
    const servir = (lista: unknown) => rpc.mockImplementation(async (fn: string) => fn === 'obs_archive_owner_pending'
      ? { data: { ...CORPO, total: 1, itens: [SEM_COMANDO] }, error: null } : { data: lista, error: null })
    const tituloDe = (r: unknown): string | null => (r as { itens: Array<{ titulo: string | null }> }).itens[0]!.titulo
    const perm = { podeEditar: true, canUnlock: false }
    const chamarComNomes = async () => (await import('@/app/cms/(authed)/youtube/competitors/_canais/pendencias-da-fila')).lerPendenciasDaFila(SITE, perm, AGORA, { canais: new Map(), videos: new Map() })
    it('canal fora de obs.channels mas na lista de removidos: mostra o nome de name_at_removal', async () => {
      servir([linha('Rota Andina')])
      expect(tituloDe(await chamarComNomes())).toBe('Rota Andina')
    })
    it('removido sem nome: cai no código de 8 caracteres, nunca no vazio', async () => {
      servir([linha(null)])
      expect(tituloDe(await chamarComNomes())).toBe(REF.slice(0, 8))
    })
    it('lista de removidos ilegível: ainda o código, nunca o vazio', async () => {
      servir({ lixo: true })
      expect(tituloDe(await chamarComNomes())).toBe(REF.slice(0, 8))
    })
    it('nome vivo vence o do registro e a lista de removidos nem é lida', async () => {
      servir([linha('Nome velho')])
      const r = await (await import('@/app/cms/(authed)/youtube/competitors/_canais/pendencias-da-fila')).lerPendenciasDaFila(SITE, perm, AGORA, { canais: new Map([[REF, 'Nome vivo']]) })
      expect(tituloDe(r)).toBe('Nome vivo')
      expect(rpc).not.toHaveBeenCalledWith('obs_archive_removed_channel_list', expect.anything())
    })
  })
})
