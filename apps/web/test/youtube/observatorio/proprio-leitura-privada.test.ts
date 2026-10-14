// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const requireSiteScope = vi.fn()
const captureException = vi.fn()
const captureMessage = vi.fn()
const rpc = vi.fn()
const criarCliente = vi.fn()
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: (...a: unknown[]) => requireSiteScope(...a) }))
vi.mock('@sentry/nextjs', () => ({
  captureException: (...a: unknown[]) => captureException(...a),
  captureMessage: (...a: unknown[]) => captureMessage(...a),
}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: (...a: unknown[]) => { criarCliente(...a); return { rpc: (...b: unknown[]) => rpc(...b) } } }))

import { provarAcessoPrivado, provarAcessoPrivadoDaChave, provarLeituraPrivada, leituraValida, LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { provarEdicao, EdicaoDoSite } from '@/lib/youtube/observatorio/proprio/edicao'
import { fabricarProva } from '@/lib/youtube/observatorio/acesso-ia/prova'

const SITE = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10'
const USUARIA = '9a1b2c3d-0000-4000-8000-00000000aaaa'
const TAGS = { component: 'observatorio-proprio', step: 'provar-leitura-privada' }

/** A guarda de edição nega; a de leitura (mode 'view') aceita com o usuário dado. */
const soLe = (user = USUARIA) =>
  requireSiteScope.mockImplementation(async (o: { mode: string }) =>
    o.mode === 'edit' ? { ok: false, reason: 'insufficient_access' } : { ok: true, user: { id: user } })
const modosPedidos = () => requireSiteScope.mock.calls.map(c => (c[0] as { mode: string }).mode)

beforeEach(() => {
  for (const m of [requireSiteScope, captureException, captureMessage, rpc, criarCliente]) m.mockReset()
})

describe('provarAcessoPrivado: o token de leitura do desempenho privado', () => {
  it('quem edita recebe a leitura e edita = true, sem chamar a função do banco nem a guarda de leitura', async () => {
    requireSiteScope.mockResolvedValue({ ok: true, user: { id: USUARIA } })
    const a = await provarAcessoPrivado(SITE)
    expect(a.leitura).toBeInstanceOf(LeituraPrivadaDoSite)
    expect(a.leitura!.siteId).toBe(SITE)
    expect(a.edita).toBe(true)
    expect(a.negativa).toBeNull()
    expect(modosPedidos()).toEqual(['edit'])
    expect(criarCliente).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
  it('quem não edita, tem vínculo e a função responde true: recebe a leitura e edita = false', async () => {
    soLe(); rpc.mockResolvedValue({ data: true, error: null })
    const a = await provarAcessoPrivado(SITE)
    expect(a.leitura!.siteId).toBe(SITE)
    expect(a.edita).toBe(false)
    expect(a.negativa).toBeNull()
    expect(modosPedidos()).toEqual(['edit', 'view'])
  })
  it('a função responde false: sem token, negativa sem_direito', async () => {
    soLe(); rpc.mockResolvedValue({ data: false, error: null })
    expect(await provarAcessoPrivado(SITE)).toEqual({ leitura: null, edita: false, negativa: 'sem_direito' })
    expect(captureException).not.toHaveBeenCalled()
    expect(captureMessage).not.toHaveBeenCalled()
  })
  it("a função responde null, 'true', 1, {}, []: sem token, nao_foi_possivel_conferir e um aviso de resposta inesperada para cada", async () => {
    for (const data of [null, 'true', 1, {}, []]) {
      captureMessage.mockReset(); captureException.mockReset()
      soLe(); rpc.mockResolvedValue({ data, error: null })
      expect(await provarAcessoPrivado(SITE), JSON.stringify(data)).toEqual({ leitura: null, edita: false, negativa: 'nao_foi_possivel_conferir' })
      const eventos = [...captureMessage.mock.calls, ...captureException.mock.calls]
      expect(eventos, JSON.stringify(data)).toHaveLength(1)
      expect(eventos[0]![1]).toMatchObject({ tags: TAGS, extra: { siteId: SITE, motivo: 'resposta_inesperada' } })
    }
  })
  it('a função dá erro PGRST202 (função ausente): sem token e uma exceção no Sentry com motivo funcao_ausente_ou_erro, sem a mensagem crua nem o id da usuária', async () => {
    soLe(); rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: `Could not find the function ${USUARIA}` } })
    expect(await provarAcessoPrivado(SITE)).toEqual({ leitura: null, edita: false, negativa: 'nao_foi_possivel_conferir' })
    expect(captureException).toHaveBeenCalledTimes(1)
    const [, ctx] = captureException.mock.calls[0]!
    expect(ctx).toMatchObject({ tags: TAGS, extra: { siteId: SITE, motivo: 'funcao_ausente_ou_erro', code: 'PGRST202' } })
    expect(JSON.stringify(ctx)).not.toContain(USUARIA)
    expect(JSON.stringify(ctx)).not.toContain('Could not find')
  })
  it('a função dá erro de rede (o rpc lança): sem token, nada escapa, uma exceção no Sentry', async () => {
    soLe(); rpc.mockRejectedValue(new Error('rede'))
    expect(await provarAcessoPrivado(SITE)).toEqual({ leitura: null, edita: false, negativa: 'nao_foi_possivel_conferir' })
    expect(captureException).toHaveBeenCalledTimes(1)
    expect(captureException.mock.calls[0]![1]).toMatchObject({ tags: TAGS, extra: { siteId: SITE, motivo: 'funcao_ausente_ou_erro' } })
  })
  it('sem sessão: sem token, sem criar o cliente de serviço', async () => {
    requireSiteScope.mockResolvedValue({ ok: false, reason: 'unauthenticated' })
    expect(await provarAcessoPrivado(SITE)).toEqual({ leitura: null, edita: false, negativa: 'sem_direito' })
    expect(criarCliente).not.toHaveBeenCalled()
    expect(captureException).not.toHaveBeenCalled()
  })
  it('sessão sem vínculo: idem', async () => {
    requireSiteScope.mockResolvedValue({ ok: false, reason: 'insufficient_access' })
    expect(await provarAcessoPrivado(SITE)).toEqual({ leitura: null, edita: false, negativa: 'sem_direito' })
    expect(criarCliente).not.toHaveBeenCalled()
  })
  it('a guarda lança: sem token, motivo guarda_falhou', async () => {
    requireSiteScope.mockImplementation(async (o: { mode: string }) => { if (o.mode === 'view') throw new Error('boom'); return { ok: false, reason: 'insufficient_access' } })
    expect(await provarAcessoPrivado(SITE)).toEqual({ leitura: null, edita: false, negativa: 'nao_foi_possivel_conferir' })
    expect(criarCliente).not.toHaveBeenCalled()
    const eventos = captureException.mock.calls.filter(c => (c[1] as { extra?: { motivo?: string } }).extra?.motivo === 'guarda_falhou')
    expect(eventos).toHaveLength(1)
    expect(eventos[0]![1]).toMatchObject({ tags: TAGS, extra: { siteId: SITE, motivo: 'guarda_falhou' } })
  })
  it('siteId que não é uuid: sem token, sem chamar a guarda de leitura nem o banco', async () => {
    soLe()
    expect(await provarAcessoPrivado('site-1')).toEqual({ leitura: null, edita: false, negativa: 'sem_direito' })
    expect(modosPedidos()).not.toContain('view')
    expect(criarCliente).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
  it('a função é chamada com o id que a GUARDA devolveu e o site pedido, e com mais nada', async () => {
    soLe('id-da-guarda'); rpc.mockResolvedValue({ data: true, error: null })
    await provarAcessoPrivado(SITE)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('can_view_private_site_as', { p_user: 'id-da-guarda', p_site: SITE })
    expect(requireSiteScope).toHaveBeenCalledWith({ area: 'cms', siteId: SITE, mode: 'view' })
  })
  it('o token carrega o site pedido e é congelado; JSON.stringify não mostra o site; structuredClone não passa em leituraValida', async () => {
    requireSiteScope.mockResolvedValue({ ok: true, user: { id: USUARIA } })
    const l = (await provarLeituraPrivada(SITE))!
    expect(l.siteId).toBe(SITE)
    expect(Object.isFrozen(l)).toBe(true)
    expect(() => Object.defineProperty(l, 'siteId', { value: 'outro' })).toThrow()
    expect(JSON.stringify(l)).toBe('{}')
    expect(leituraValida(l)).toBe(true)
    expect(leituraValida(structuredClone(l))).toBe(false)
  })
  it('forjados não passam em leituraValida: objeto literal, Object.create(prototype), Reflect.construct, subclasse, e um EdicaoDoSite de verdade', async () => {
    expect(leituraValida({ siteId: SITE })).toBe(false)
    expect(leituraValida(Object.create(LeituraPrivadaDoSite.prototype, { siteId: { value: SITE } }))).toBe(false)
    expect(leituraValida(Object.create(LeituraPrivadaDoSite.prototype))).toBe(false)
    expect(() => Reflect.construct(LeituraPrivadaDoSite, [SITE])).toThrow(TypeError)
    expect(() => Reflect.construct(LeituraPrivadaDoSite, [SITE, Symbol('chave')])).toThrow(/LeituraPrivadaDoSite só nasce em provarAcessoPrivado/)
    expect(() => {
      // @ts-expect-error construtor privado: o tsc barra, e esta linha prova que a execução também recusa
      class F extends LeituraPrivadaDoSite { constructor() { super(SITE) } }
      return new F()
    }).toThrow(TypeError)
    for (const v of [null, undefined, 'x', SITE, 1]) expect(leituraValida(v)).toBe(false)
    requireSiteScope.mockResolvedValue({ ok: true, user: { id: USUARIA } })
    const edicao = await provarEdicao(SITE)
    expect(edicao).toBeInstanceOf(EdicaoDoSite)
    expect(leituraValida(edicao)).toBe(false)
  })
  it('a classe é congelada: provarAcessoPrivado não se troca por fora', async () => {
    expect(Object.isFrozen(LeituraPrivadaDoSite)).toBe(true)
    expect(Reflect.set(LeituraPrivadaDoSite, 'provar', async () => null)).toBe(false)
    expect(Reflect.defineProperty(LeituraPrivadaDoSite, 'ehLeitura', { value: () => true })).toBe(false)
    expect(leituraValida(Object.create(LeituraPrivadaDoSite.prototype))).toBe(false)
  })
  it('provarLeituraPrivada devolve exatamente a leitura de provarAcessoPrivado', async () => {
    requireSiteScope.mockResolvedValue({ ok: true, user: { id: USUARIA } })
    expect(leituraValida(await provarLeituraPrivada(SITE))).toBe(true)
    soLe(); rpc.mockResolvedValue({ data: false, error: null })
    expect(await provarLeituraPrivada(SITE)).toBeNull()
  })
})

// Tarefa 7 do degrau 2: a segunda porta, pela prova da chave do perfil (sem sessão).
describe('provarAcessoPrivadoDaChave: a leitura privada por chave do perfil', () => {
  const KEY = '7c1d2e3f-0000-4000-8000-00000000bbbb'
  const prova = () => fabricarProva(SITE, USUARIA, KEY, '2999-01-01T00:00:00Z')
  /** O rpc devolve um construtor que aceita sinal de cancelamento e então resolve com `resposta`. */
  const responde = (resposta: unknown) => {
    const sinais: AbortSignal[] = []
    rpc.mockImplementation(() => ({ abortSignal: (s: AbortSignal) => { sinais.push(s); return Promise.resolve(resposta) } }))
    return sinais
  }
  const naoResponde = () => {
    const sinais: AbortSignal[] = []
    rpc.mockImplementation(() => ({
      abortSignal: (s: AbortSignal) => { sinais.push(s); return new Promise((_, rej) => s.addEventListener('abort', () => rej(new Error('abortado')))) },
    }))
    return sinais
  }
  const SEM_CONFERIR = { leitura: null, edita: false, negativa: 'nao_foi_possivel_conferir' }

  beforeEach(() => {
    requireSiteScope.mockImplementation(async () => { throw new Error('a guarda de sessão não pode ser chamada por este caminho') })
  })

  it('prova legítima e a função responde true: leitura, edita false, negativa null', async () => {
    responde({ data: true, error: null })
    const a = await provarAcessoPrivadoDaChave(prova())
    expect(leituraValida(a.leitura)).toBe(true)
    expect(a.leitura!.siteId).toBe(SITE)
    expect(a.edita).toBe(false)
    expect(a.negativa).toBeNull()
  })
  it('a função responde false: sem token, negativa sem_direito', async () => {
    responde({ data: false, error: null })
    expect(await provarAcessoPrivadoDaChave(prova())).toEqual({ leitura: null, edita: false, negativa: 'sem_direito' })
  })
  it("responde null, 'true', 1, erro PGRST202 ou lança: sem token, nao_foi_possivel_conferir", async () => {
    for (const r of [{ data: null, error: null }, { data: 'true', error: null }, { data: 1, error: null }, { data: null, error: { code: 'PGRST202', message: 'x' } }]) {
      responde(r)
      expect(await provarAcessoPrivadoDaChave(prova()), JSON.stringify(r)).toEqual(SEM_CONFERIR)
    }
    rpc.mockImplementation(() => ({ abortSignal: () => Promise.reject(new Error('rede')) }))
    expect(await provarAcessoPrivadoDaChave(prova())).toEqual(SEM_CONFERIR)
    rpc.mockImplementation(() => { throw new Error('síncrono') })
    expect(await provarAcessoPrivadoDaChave(prova())).toEqual(SEM_CONFERIR)
  })
  it('objeto literal com siteId e userId no lugar da prova: sem token, e o banco não é chamado', async () => {
    const falsa = { siteId: SITE, userId: USUARIA, keyId: KEY, venceEm: '2999-01-01T00:00:00Z' } as unknown as Parameters<typeof provarAcessoPrivadoDaChave>[0]
    expect(await provarAcessoPrivadoDaChave(falsa)).toEqual({ leitura: null, edita: false, negativa: 'sem_direito' })
    expect(criarCliente).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
  it('a função é chamada com o userId e o siteId DA PROVA, e com mais nada', async () => {
    responde({ data: true, error: null })
    await provarAcessoPrivadoDaChave(prova())
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('can_view_private_site_as', { p_user: USUARIA, p_site: SITE })
  })
  it('a guarda de sessão e a prova de edição não são chamadas por este caminho', async () => {
    responde({ data: true, error: null })
    await provarAcessoPrivadoDaChave(prova())
    expect(requireSiteScope).not.toHaveBeenCalled()
  })
  it('a função do banco não responde em 20 ms (prazo curto, relógio de verdade): sem token, nao_foi_possivel_conferir e a chamada recebeu sinal de cancelamento', async () => {
    const sinais = naoResponde()
    const t0 = Date.now()
    expect(await provarAcessoPrivadoDaChave(prova(), { prazoMs: 20 })).toEqual(SEM_CONFERIR)
    expect(Date.now() - t0).toBeLessThan(2000)
    expect(sinais).toHaveLength(1)
    expect(sinais[0]!.aborted).toBe(true)
  })
  it('sem opcoes o prazo é 5.000', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    try {
      responde({ data: true, error: null })
      await provarAcessoPrivadoDaChave(prova())
      expect(setTimeoutSpy.mock.calls.some(c => c[1] === 5000)).toBe(true)
    } finally { setTimeoutSpy.mockRestore() }
  })
  it('o aviso ao Sentry não leva a mensagem crua nem o id da pessoa', async () => {
    responde({ data: null, error: { code: 'PGRST202', message: `x ${USUARIA}` } })
    await provarAcessoPrivadoDaChave(prova())
    expect(captureException).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(captureException.mock.calls[0]![1])).not.toContain(USUARIA)
    expect(JSON.stringify(captureException.mock.calls[0]![1])).not.toContain('x ')
  })
})
