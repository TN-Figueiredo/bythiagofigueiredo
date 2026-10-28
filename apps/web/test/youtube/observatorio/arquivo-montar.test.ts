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
const captureException = vi.fn()
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: (e: unknown) => captureException(e) }))
// a constante de capacidades nas duas posições (M6a T12 r1, Yannis I-2)
const saidaDeMes = vi.hoisted(() => ({ existe: true }))
vi.mock('@/lib/youtube/observatorio/arquivo-mensal/capacidades', async orig => ({
  ...(await orig<typeof import('@/lib/youtube/observatorio/arquivo-mensal/capacidades')>()),
  get SAIDA_DE_MES_EXISTE() { return saidaDeMes.existe },
}))

const pagina = (perm: { canUnlock: boolean; podeEditar: boolean }) => ({ userId: 'u1', siteId: 's', now: Date.parse('2025-05-03T15:00:00Z'), obs: {}, meuCanalLembrado: null, savedNiche: 'todos', rows: {}, extra: perm })
const importar = async () => (await import('@/app/cms/(authed)/youtube/competitors/_arquivo/montar')).montarArquivo

describe('montarArquivo', () => {
  beforeEach(() => { saidaDeMes.existe = true; captureException.mockReset(); requireSiteScope.mockReset(); encaixarSaida.mockReset(); encaixarSaida.mockImplementation(async (m: unknown) => m); vi.resetModules(); servico.rpc.mockReset(); getSupabaseServiceClient.mockClear(); delete process.env.OBS_ARQUIVO })
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
    it('passa site, quem age (a pessoa que a página já resolveu) e se administra; devolve o modelo encaixado; a sessão é checada uma vez só', async () => {
      ligar(true)
      encaixarSaida.mockImplementation(async (m: object) => ({ ...m, marca: 'encaixado' }))
      const r = await (await importar())()
      if (r.acesso === 'so_le') throw new Error('x')
      expect(encaixarSaida).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ site: 's', por: 'u1', ehAdmin: true }))
      expect((r.modelo as unknown as { marca: string }).marca).toBe('encaixado')
      expect(requireSiteScope).not.toHaveBeenCalled()   // Yannis M-2: a sessão vem de openObservatoryPage
    })
    it('exceção no encaixe: volta o modelo da M5 (sem acoes), vai ao Sentry uma vez, sem derrubar a página', async () => {
      ligar(false)
      const erro = new Error('boom'); encaixarSaida.mockRejectedValue(erro)
      const r = await (await importar())()
      if (r.acesso === 'so_le') throw new Error('x')
      expect(r.acesso).toBe('edita'); expect(r.modelo.ligado).toBe(true)
      expect(captureException).toHaveBeenCalledTimes(1); expect(captureException).toHaveBeenCalledWith(erro)
      expect(r.modelo.tipos.flatMap(t => t.linhas).every(l => l.acoes === undefined)).toBe(true)
    })
    it('sem a pessoa na página: nem tenta encaixar', async () => {
      ligar(true); abrir.mockResolvedValue({ ...pagina({ canUnlock: true, podeEditar: true }), userId: undefined }); encaixarSaida.mockClear()
      await (await importar())()
      expect(encaixarSaida).not.toHaveBeenCalled()
    })
    it('SAIDA_DE_MES_EXISTE=false: o encaixe não é chamado e a página da M5 volta idêntica (Yannis I-2)', async () => {
      ligar(true); saidaDeMes.existe = false; encaixarSaida.mockReset(); encaixarSaida.mockImplementation(async (m: object) => m); requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } }); servico.rpc.mockClear()
      const r = await (await importar())()
      if (r.acesso === 'so_le') throw new Error('x')
      expect(encaixarSaida).not.toHaveBeenCalled()
      expect(servico.rpc.mock.calls.map(c => c[0])).not.toContain('obs_archive_exit_check')
    })
    it('SAIDA_DE_MES_EXISTE=true: o encaixe é chamado', async () => {
      ligar(true); saidaDeMes.existe = true; encaixarSaida.mockClear(); encaixarSaida.mockImplementation(async (m: object) => m)
      await (await importar())()
      expect(encaixarSaida).toHaveBeenCalledTimes(1)
    })
  })
})
