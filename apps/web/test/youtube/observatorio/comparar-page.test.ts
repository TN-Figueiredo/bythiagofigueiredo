// @vitest-environment node
/** A3 Tarefa 8: o módulo da rota `comparar` (carregadores simulados): guarda de acesso, moldura de trilha, a/b inválidos e props simples. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { a3World } from './a3-fixture'
import { link } from '@/lib/youtube/observatorio/links'
import type { ReactElement } from 'react'

const W = a3World()
const ordem: string[] = []
const abrir = vi.hoisted(() => vi.fn())
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({ openObservatoryPage: abrir }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_comparar/pack', async orig => {
  const m = await orig<typeof import('@/app/cms/(authed)/youtube/competitors/_comparar/pack')>()
  return { ...m, buildCompararPack: (...a: Parameters<typeof m.buildCompararPack>) => { ordem.push('pack'); return m.buildCompararPack(...a) } }
})

const OWN = 'tnfigueiredo', CH = 'leo-khev'
async function pagina(sp: Record<string, string | string[] | undefined>) {
  const { default: Page } = await import('@/app/cms/(authed)/youtube/competitors/comparar/page')
  return (await Page({ searchParams: Promise.resolve(sp) })) as ReactElement<{ crumbs: Array<{ text: string; href?: string }>; children: ReactElement<{ pack: { canais: Array<{ id: string }> }; inicial: { a: string; b: string } | null }> }>
}
const tela = (e: Awaited<ReturnType<typeof pagina>>) => e.props.children.props

beforeEach(() => {
  ordem.length = 0
  abrir.mockReset()
  abrir.mockImplementation(async () => { ordem.push('guarda'); return { siteId: 's', now: W.obs.NOW, rows: {}, obs: W.obs, savedNiche: 'todos', extra: undefined } })
})

describe('a rota comparar', () => {
  it('exporta as configurações da página: dinâmica, 60 s, título', async () => {
    const m = await import('@/app/cms/(authed)/youtube/competitors/comparar/page')
    expect(m.dynamic).toBe('force-dynamic'); expect(m.maxDuration).toBe(60)
    expect(m.metadata).toEqual({ title: 'Comparar canais · Competidores' })
  })
  it('a página chama openObservatoryPage, e a guarda de acesso vem antes da leitura do pacote', async () => {
    await pagina({})
    expect(abrir).toHaveBeenCalledTimes(1)
    expect(ordem).toEqual(['guarda', 'pack'])
  })
  it('a guarda que recusa (redirect) interrompe a página: nenhum pacote é montado', async () => {
    abrir.mockImplementation(async () => { throw new Error('REDIRECT /cms/login') })
    await expect(pagina({ a: OWN, b: CH })).rejects.toThrow('REDIRECT')
    expect(ordem).toEqual([])
  })
  it('a moldura é TrailChrome com a trilha "Canais › Comparar"', async () => {
    const e = await pagina({})
    const { TrailChrome } = await import('@/app/cms/(authed)/youtube/competitors/_chrome/trail-chrome')
    expect(e.type).toBe(TrailChrome)
    expect(e.props.crumbs).toEqual([{ text: 'Canais', href: link.canais() }, { text: 'Comparar' }])
  })
  it('a e b válidos do site: o par pedido', async () => {
    expect(tela(await pagina({ a: OWN, b: CH })).inicial).toEqual({ a: OWN, b: CH })
    expect(tela(await pagina({ a: CH, b: OWN })).inicial).toEqual({ a: CH, b: OWN })
  })
  it('a e b inválidos não lançam e dão o par padrão (o canal próprio × o concorrente logo acima), sem 500', async () => {
    const padrao = tela(await pagina({})).inicial!
    expect(padrao.a).toBe(OWN)
    const casos: Array<[string, Record<string, string | string[] | undefined>]> = [
      ['a e b ausentes', {}],
      ['id inventado', { a: 'nao-existe', b: 'tambem-nao' }],
      ['id de outro site (um uuid que este site não tem)', { a: '7c9e6679-7425-40de-944b-e07fc1f90ae7', b: '0b8f4a5e-7425-40de-944b-e07fc1f90ae7' }],
      ['ids em maiúsculas', { a: OWN.toUpperCase(), b: CH.toUpperCase() }],
      ['a === b', { a: CH, b: CH }],
      ['vazios', { a: '', b: '' }],
      ['lista repetida', { a: [CH, OWN], b: [OWN] }],
    ]
    for (const [nome, sp] of casos) {
      const ini = tela(await pagina(sp)).inicial
      expect(ini, nome).not.toBeNull()
      expect(ini!.a, nome).not.toBe(ini!.b)
      const ids = tela(await pagina(sp)).pack.canais.map(c => c.id)
      expect(ids, nome).toContain(ini!.a); expect(ids, nome).toContain(ini!.b)
      if (['a e b ausentes', 'id inventado', 'id de outro site (um uuid que este site não tem)', 'ids em maiúsculas', 'vazios'].includes(nome)) expect(ini, nome).toEqual(padrao)
    }
    // a ausente com b válido: a vira o canal próprio; b ausente com a válido: o concorrente logo acima
    expect(tela(await pagina({ b: CH })).inicial).toEqual({ a: OWN, b: CH })
    expect(tela(await pagina({ a: CH })).inicial!.a).toBe(CH)
    // a === b: o lado A vale e o B vai para o padrão
    const igual = tela(await pagina({ a: CH, b: CH })).inicial!
    expect(igual.a).toBe(CH); expect(igual.b).not.toBe(CH)
  })
  it('nunca entrega dado de outro site: o pacote só tem canais do conjunto lido', async () => {
    const t = tela(await pagina({ a: '7c9e6679-7425-40de-944b-e07fc1f90ae7' }))
    expect(t.pack.canais.map(c => c.id).sort()).toEqual(W.obs.channels.map(c => c.id).sort())
  })
  it('menos de dois canais: inicial null, sem lançar', async () => {
    // buildCompararPack lê o motor inteiro: o pacote de um canal só é montado de verdade
    const { createTestObservatory } = await import('./oracle')
    const w = a3World(ds => { ds.channels = ds.channels.filter(c => c.id === OWN); ds.videos = ds.videos.filter(v => v.ch === OWN) })
    abrir.mockImplementation(async () => ({ siteId: 's', now: 0, rows: {}, obs: createTestObservatory(w.ds), savedNiche: 'todos', extra: undefined }))
    expect(tela(await pagina({ a: OWN })).inicial).toBeNull()
  })
  it('nenhuma server action nem função é passada à tela: só o pacote e o par, dados simples', async () => {
    const e = await pagina({ a: OWN, b: CH })
    const filho = e.props.children
    expect(Object.keys(filho.props).sort()).toEqual(['inicial', 'pack'])
    const temFuncao = (x: unknown): boolean => typeof x === 'function' || (x !== null && typeof x === 'object' && Object.values(x as object).some(temFuncao))
    expect(temFuncao(filho.props)).toBe(false)
    expect(JSON.parse(JSON.stringify(filho.props))).toEqual(filho.props)
  })
})
