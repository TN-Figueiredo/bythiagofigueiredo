// apps/web/test/youtube/observatorio/arquivo-montar.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { paginaVazia } from './fixtures/arquivo-pagina'

const servico = { rpc: vi.fn() }
const getSupabaseServiceClient = vi.fn(() => servico)
const permissoes = vi.fn()
const abrir = vi.fn()
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => getSupabaseServiceClient() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/permissoes', () => ({ permissoesDoSite: (s: string) => permissoes(s) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({ openObservatoryPage: (f: (s: string) => unknown) => abrir(f) }))
const requireSiteScope = vi.fn()
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: (a: unknown) => requireSiteScope(a) }))
const encaixarSaida = vi.fn()
vi.mock('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/encaixar', () => ({ encaixarSaida: (m: unknown, c: unknown) => encaixarSaida(m, c) }))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

const pagina = (perm: { canUnlock: boolean; podeEditar: boolean }) => ({ siteId: 's', now: Date.parse('2025-05-03T15:00:00Z'), obs: {}, meuCanalLembrado: null, savedNiche: 'todos', rows: {}, extra: perm })
const importar = async () => (await import('@/app/cms/(authed)/youtube/competitors/_arquivo/montar')).montarArquivo

describe('montarArquivo', () => {
  beforeEach(() => { vi.resetModules(); servico.rpc.mockReset(); getSupabaseServiceClient.mockClear(); delete process.env.OBS_ARQUIVO })
  it('Review Focus 5: só lê pela URL não cria o cliente de serviço nem chama rpc', async () => {
    abrir.mockResolvedValue(pagina({ canUnlock: false, podeEditar: false }))
    process.env.OBS_ARQUIVO = 'on'
    expect(await (await importar())()).toEqual({ acesso: 'so_le' })
    expect(getSupabaseServiceClient).not.toHaveBeenCalled(); expect(servico.rpc).not.toHaveBeenCalled()
  })
  it('OBS_ARQUIVO apagada: frase do arquivo desligado e nenhuma leitura do arquivo', async () => {
    abrir.mockResolvedValue(pagina({ canUnlock: false, podeEditar: true }))
    const r = await (await importar())()
    if (r.acesso === 'so_le') throw new Error('não devia ser só lê')
    expect(r.modelo.resumo.texto).toBe('O arquivo está desligado neste site: nada está sendo copiado nem tirado')
    expect(servico.rpc).not.toHaveBeenCalled()
  })
  it.each([[false, 'edita', null], [true, 'administra', 'objeto']] as const)('canUnlock=%s: acesso %s, grupo de teste %s', async (admin, acesso, esperado) => {
    abrir.mockResolvedValue(pagina({ canUnlock: admin, podeEditar: true }))
    servico.rpc.mockImplementation(async (nome: string) => nome === 'obs_archive_pagina'
      ? { data: paginaVazia({ teste: { aberto: true, meses: [], encerrado_em: null } }), error: null } : { data: [], error: null })
    process.env.OBS_ARQUIVO = 'on'
    const r = await (await importar())()
    if (r.acesso === 'so_le') throw new Error('não devia ser só lê')
    expect(r.acesso).toBe(acesso)
    expect(r.modelo.teste === null ? null : 'objeto').toBe(esperado)
  })
  it('leitura da página falhou: modelo "não foi possível ler", bloco lido à parte', async () => {
    abrir.mockResolvedValue(pagina({ canUnlock: false, podeEditar: true }))
    servico.rpc.mockImplementation(async (nome: string) => nome === 'obs_archive_pagina' ? { data: null, error: { code: '57014' } } : { data: [], error: null })
    process.env.OBS_ARQUIVO = 'on'
    const r = await (await importar())()
    if (r.acesso === 'so_le') throw new Error('não devia ser só lê')
    expect(r.modelo.resumo.texto).toBe('Não foi possível ler o estado do arquivo')
    expect(r.bloco).toMatchObject({ ok: true })
  })
  describe('D-M5-14: o encaixe das peças de saída', () => {
    const ligar = (admin: boolean) => {
      abrir.mockResolvedValue(pagina({ canUnlock: admin, podeEditar: true }))
      servico.rpc.mockImplementation(async (nome: string) => nome === 'obs_archive_pagina' ? { data: paginaVazia(), error: null } : { data: [], error: null })
      process.env.OBS_ARQUIVO = 'on'
    }
    it('passa site, quem age (da sessão) e se administra; devolve o modelo encaixado', async () => {
      ligar(true); requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
      encaixarSaida.mockImplementation(async (m: object) => ({ ...m, marca: 'encaixado' }))
      const r = await (await importar())()
      if (r.acesso === 'so_le') throw new Error('x')
      expect(encaixarSaida).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ site: 's', por: 'u1', ehAdmin: true }))
      expect((r.modelo as unknown as { marca: string }).marca).toBe('encaixado')
    })
    it('exceção no encaixe: volta o modelo da M5, sem derrubar a página', async () => {
      ligar(false); requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
      encaixarSaida.mockRejectedValue(new Error('boom'))
      const r = await (await importar())()
      if (r.acesso === 'so_le') throw new Error('x')
      expect(r.acesso).toBe('edita'); expect(r.modelo.ligado).toBe(true)
    })
    it('sem sessão na segunda checagem: nem tenta encaixar', async () => {
      ligar(true); requireSiteScope.mockResolvedValue({ ok: false, reason: 'unauthenticated' }); encaixarSaida.mockClear()
      await (await importar())()
      expect(encaixarSaida).not.toHaveBeenCalled()
    })
  })
})
