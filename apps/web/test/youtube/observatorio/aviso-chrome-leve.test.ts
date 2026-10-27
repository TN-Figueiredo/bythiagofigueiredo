// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpc = vi.fn(); const criar = vi.fn(() => ({ rpc })); const captureMessage = vi.fn(); const podeEditar = vi.fn(); const cacheado = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => criar() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => captureMessage(...a) }))
// o chrome decide pela guarda leve `podeEditarSite` (não por `permissoesDoSite`, que paga canAdminSiteUsers em toda navegação)
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/permissoes', () => ({ podeEditarSite: (s: string) => podeEditar(s) }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown, chave: unknown, opcoes: unknown) => { cacheado(chave, opcoes); return fn } }))

const SITE = '00000000-0000-0000-0000-00000000a3b0'
const LEVE = { versao: 1, lido_em: '2028-05-03T15:00:00Z', hoje: '2028-05-03', proximo_mes: null, primeira_devida_em: '2026-11-28', ultima_copia: null, casa: [], vermelhos_n: 0, atraso: { amarelos: 0, vermelhos: 0, mais_antiga: null, meses_sem_selo: 0 } }
const chamar = async () => (await import('@/app/cms/(authed)/youtube/competitors/_chrome/arquivo-do-chrome')).arquivoNoChrome(SITE)

describe('o chrome e o aviso leve', () => {
  beforeEach(() => { vi.resetModules(); for (const f of [rpc, criar, captureMessage, podeEditar, cacheado]) f.mockReset(); criar.mockImplementation(() => ({ rpc })); process.env.OBS_ARQUIVO = 'on'; podeEditar.mockResolvedValue(true) })
  it('o chrome nunca chama obs_archive_pagina: só obs_archive_aviso', async () => {
    rpc.mockResolvedValue({ data: LEVE, error: null })
    await chamar()
    expect(rpc.mock.calls.map(c => c[0])).toEqual(['obs_archive_aviso'])
  })
  it('quem só lê: o cliente de serviço não é criado, nem aba, nem pastilha', async () => {
    podeEditar.mockResolvedValue(false)
    expect(await chamar()).toEqual({ arquivoVisivel: false, aviso: { ok: false, porque: 'sem_permissao' } })
    expect(criar).not.toHaveBeenCalled()
  })
  it('OBS_ARQUIVO apagada: aba visível para quem edita, rpc não chamada', async () => {
    delete process.env.OBS_ARQUIVO
    expect(await chamar()).toEqual({ arquivoVisivel: true, aviso: { ok: false, porque: 'desligado' } })
    expect(rpc).not.toHaveBeenCalled()
  })
  it('obs_archive_aviso ausente (42883 e PGRST202): aba e pastilha nova não aparecem, sem Sentry', async () => {
    for (const code of ['42883', 'PGRST202']) {
      vi.resetModules(); rpc.mockResolvedValue({ data: null, error: { code } })
      expect(await chamar()).toEqual({ arquivoVisivel: false, aviso: { ok: false, porque: 'funcao_ausente' } })
    }
    expect(captureMessage).not.toHaveBeenCalled()
  })
  it('erro do banco no aviso: aba visível, motivo erro_do_banco, Sentry', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '57014' } })
    expect(await chamar()).toEqual({ arquivoVisivel: true, aviso: { ok: false, porque: 'erro_do_banco' } })
    expect(captureMessage).toHaveBeenCalledWith('obs_archive_aviso: 57014', 'error')
  })
  it('resposta fora da forma: erro_do_banco, nunca "sem problema"', async () => {
    rpc.mockResolvedValue({ data: { versao: 2 }, error: null })
    expect((await chamar()).aviso).toEqual({ ok: false, porque: 'erro_do_banco' })
    expect(captureMessage).toHaveBeenCalledWith('obs_archive_aviso fora do esquema', 'error')
  })
  it('chave a mais na resposta: fora do esquema (strict)', async () => {
    rpc.mockResolvedValue({ data: { ...LEVE, nova: 1 }, error: null })
    expect((await chamar()).aviso).toEqual({ ok: false, porque: 'erro_do_banco' })
  })
  it('a leitura leve é embrulhada em cache de 60 s, com o site na chave', async () => {
    rpc.mockResolvedValue({ data: LEVE, error: null })
    await chamar()
    expect(cacheado).toHaveBeenCalledWith(expect.arrayContaining([SITE]), expect.objectContaining({ revalidate: 60, tags: ['observatorio:' + SITE] }))
  })
})
