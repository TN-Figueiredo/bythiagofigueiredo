// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const lerSinal = vi.fn(); const captureException = vi.fn(); const rpc = vi.fn(); const criar = vi.fn(() => ({ rpc })); const captureMessage = vi.fn(); const podeEditar = vi.fn(); const cacheado = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => criar() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => captureMessage(...a), captureException: (...a: unknown[]) => captureException(...a) }))
vi.mock('@/lib/youtube/observatorio/arquivo/ler-sinal', () => ({ lerSinalDoBanco: (...a: unknown[]) => lerSinal(...a) }))
// o chrome decide pela guarda leve `podeEditarSite` (não por `permissoesDoSite`, que paga canAdminSiteUsers em toda navegação)
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/permissoes', () => ({ podeEditarSite: (s: string) => podeEditar(s) }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown, chave: unknown, opcoes: unknown) => { cacheado(chave, opcoes); return fn } }))

const SITE = '00000000-0000-0000-0000-00000000a3b0'
const LEVE = { versao: 1, lido_em: '2025-05-03T15:00:00Z', hoje: '2025-05-03', proximo_mes: null, primeira_devida_em: '2026-11-28', primeira_devida_mes: '2026-10-01', atraso_mes: null, ultima_copia: null, casa: [], vermelhos_n: 0, atraso: { amarelos: 0, vermelhos: 0, mais_antiga: null, meses_sem_selo: 0 } }
const chamar = async () => (await import('@/app/cms/(authed)/youtube/competitors/_chrome/arquivo-do-chrome')).arquivoNoChrome(SITE)

describe('o chrome e o aviso leve', () => {
  beforeEach(() => { vi.resetModules(); for (const f of [rpc, criar, captureMessage, captureException, lerSinal, podeEditar, cacheado]) f.mockReset(); lerSinal.mockResolvedValue({ valor: 1 }); criar.mockImplementation(() => ({ rpc })); process.env.OBS_ARQUIVO = 'on'; podeEditar.mockResolvedValue(true) })
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
  it('obs_archive_aviso ausente (42883 e PGRST202) com OBS_ARQUIVO=on: aba e pastilha nova somem, mas com aviso ao Sentry (Phil I5)', async () => {
    for (const code of ['42883', 'PGRST202']) {
      vi.resetModules(); rpc.mockResolvedValue({ data: null, error: { code } })
      expect(await chamar()).toEqual({ arquivoVisivel: false, aviso: { ok: false, porque: 'funcao_ausente' } })
    }
    expect(captureMessage).toHaveBeenCalledTimes(2)
    expect(captureMessage).toHaveBeenCalledWith('obs_archive_aviso ausente com OBS_ARQUIVO=on', 'warning')
  })
  it('sem a variável nem a leitura nem o aviso acontecem (variável apagada)', async () => {
    delete process.env.OBS_ARQUIVO
    await chamar()
    expect(captureMessage).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled(); expect(lerSinal).not.toHaveBeenCalled()
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
  it('Phil M1: o aviso tem etiqueta própria e 300 s; o tamanho do banco, etiqueta própria e 3600 s (a coleta de 20 min não derruba os dois)', async () => {
    rpc.mockResolvedValue({ data: LEVE, error: null })
    await chamar()
    const todos = cacheado.mock.calls
    expect(todos).toContainEqual([expect.arrayContaining([SITE]), expect.objectContaining({ revalidate: 300, tags: ['arquivo:' + SITE] })])
    expect(todos).toContainEqual([expect.arrayContaining([SITE]), expect.objectContaining({ revalidate: 3600, tags: ['arquivo-banco:' + SITE] })])
    expect(JSON.stringify(todos)).not.toContain('observatorio:')
  })
  it('o tamanho do banco é lido em paralelo ao aviso, só depois da guarda, e vem no resultado', async () => {
    rpc.mockResolvedValue({ data: LEVE, error: null })
    const r = await chamar()
    expect(lerSinal).toHaveBeenCalledTimes(1)
    expect(r).toMatchObject({ arquivoVisivel: true, aviso: { ok: true }, banco: { valor: 1 } })
    vi.resetModules(); lerSinal.mockClear(); podeEditar.mockResolvedValue(false)
    await chamar()
    expect(lerSinal).not.toHaveBeenCalled()
  })
  it('Yannis M-4: o tamanho do banco que lança vira "excecao" COM Sentry', async () => {
    rpc.mockResolvedValue({ data: LEVE, error: null }); lerSinal.mockRejectedValue(new Error('boom'))
    const r = await chamar()
    expect(r).toMatchObject({ banco: { porque: 'excecao' } })
    expect(captureException).toHaveBeenCalledWith(expect.any(Error), { tags: { step: 'aviso-banco-sinal' } })
  })
  it('uma falha lida do banco volta com a causa e fora do cache (o corpo lança)', async () => {
    rpc.mockResolvedValue({ data: LEVE, error: null }); lerSinal.mockResolvedValue({ porque: 'prazo' })
    expect(await chamar()).toMatchObject({ banco: { porque: 'prazo' } })
    expect(captureException).not.toHaveBeenCalled()
  })
})
