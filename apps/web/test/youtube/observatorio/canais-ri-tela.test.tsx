// @vitest-environment jsdom
// A5 · E5a · R5. Referências e Inscritos dentro da tela Canais: a página monta o modelo, a tela desenha as seções depois da lista.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@testing-library/react'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CanaisScreen, type CanaisScreenProps } from '@/app/cms/(authed)/youtube/competitors/_canais/canais-screen'
import { RiSecoes } from '@/app/cms/(authed)/youtube/competitors/_canais/ri-secoes'
import { buildRiView } from '@/app/cms/(authed)/youtube/competitors/_canais/ri-model'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { ChromeSyncContext } from '@/app/cms/(authed)/youtube/competitors/_chrome/sync-context'
import type { RiView } from '@/app/cms/(authed)/youtube/competitors/_canais/ri-tipos'

const siteAdmin = vi.hoisted(() => ({ value: true }))
vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => siteAdmin.value,
}))
const nav = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: nav.refresh, push: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(''),
  redirect: (u: string) => { throw new Error('REDIRECT ' + u) },
}))
// ---- a página
const sentry = vi.hoisted(() => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@sentry/nextjs', () => sentry)
vi.mock('server-only', () => ({}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true }) }))
vi.mock('@/lib/youtube/competitor-admin', () => ({ canAdminSiteUsers: async () => false }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({}) }))
vi.mock('@/lib/youtube/observatorio/medidas-telas/carregar-do-site', () => ({ carregarMedidasDoSite: async () => null }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/chrome-server', () => ({ ObservatoryChromeServer: () => null }))
vi.mock('@/app/cms/(authed)/youtube/competitors/actions', () => ({
  addChannelFromCanais: vi.fn(), removeCompetitorChannel: vi.fn(), syncCompetitorNow: vi.fn(), unlockMoreChannels: vi.fn(),
  pinVideo: vi.fn(), unpinVideo: vi.fn(), getCompetitorRemovalImpactAction: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/niche-actions', () => ({ setChannelNiche: vi.fn(), setOwnChannelNiche: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/forja-actions', () => ({ askForjaReading: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/carregar-extras', () => ({ carregarExtrasProprio: async () => undefined }))

const obsCheio = createObservatory(datasetFromOracle(loadOracle()))
let obs = obsCheio
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({
  openObservatoryPage: async () => ({ siteId: 's', now: obs.NOW, rows: { settings: null }, obs, savedNiche: 'todos', meuCanalLembrado: null, extra: { canUnlock: false, podeEditar: true } }),
}))
const leitor = vi.hoisted(() => ({ lerRetratosProprios: vi.fn() }))
vi.mock('@/lib/youtube/observatorio/retratos-proprios', () => leitor)
const modelo = vi.hoisted(() => ({ buildRiView: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_canais/ri-model', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/app/cms/(authed)/youtube/competitors/_canais/ri-model')>()
  modelo.buildRiView.mockImplementation(real.buildRiView)
  return { ...real, buildRiView: modelo.buildRiView }
})

type Elemento = { props: { children: { props: CanaisScreenProps } } }
async function pagina(sp: Record<string, string | undefined> = {}): Promise<CanaisScreenProps> {
  const { default: Page } = await import('@/app/cms/(authed)/youtube/competitors/page')
  const el = (await Page({ searchParams: Promise.resolve(sp) })) as unknown as Elemento
  return el.props.children.props
}
beforeEach(() => {
  vi.clearAllMocks(); obs = obsCheio
  leitor.lerRetratosProprios.mockResolvedValue(new Map())
  if (typeof window.localStorage.clear !== 'function') {
    const mem = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', { configurable: true, value: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear() } })
  }
})

describe('R5: a página', () => {
  it('monta o modelo com o formato da lista, a ordem e a aba da URL, e passa ri à tela', async () => {
    const props = await pagina({ fmt: 'shorts', ordr: 'faixa', ordi: 'abs', aba: 'ins' })
    expect(modelo.buildRiView).toHaveBeenCalledTimes(1)
    expect(modelo.buildRiView.mock.calls[0]![1]).toMatchObject({ fmt: 'short', ordr: 'faixa', ordi: 'abs', aba: 'ins', niche: 'todos', agoraMs: obs.NOW })
    expect(props.ri).toBeDefined()
    expect(props.ri!.ordem).toEqual({ ref: 'faixa', ins: 'abs' })
    expect(props.ri!.aba).toBe('ins')
  })
  it('sem ?fmt= usa o padrão (longos): fmt "long"', async () => {
    await pagina({})
    expect(modelo.buildRiView.mock.calls[0]![1]).toMatchObject({ fmt: 'long' })
  })
  it('trocar o formato da lista para Shorts troca Referências e não Inscritos', async () => {
    const longos = (await pagina({ fmt: 'longos' })).ri!
    const shorts = (await pagina({ fmt: 'shorts' })).ri!
    expect(shorts.inscritos).toEqual(longos.inscritos)
    expect(shorts.referencias).not.toEqual(longos.referencias)
  })
  it('falhas com um item: um captureException com fingerprint [canais-ri, secao]', async () => {
    const real = buildRiView(obs, { agoraMs: obs.NOW, niche: 'todos', fmt: 'long', meuCanalLembrado: null, retratosProprios: new Map() }).view
    const erro = new Error('conta')
    modelo.buildRiView.mockImplementationOnce(() => ({ view: real, falhas: [{ secao: 'inscritos' as const, erro }] }))
    await pagina({})
    expect(sentry.captureException).toHaveBeenCalledTimes(1)
    expect(sentry.captureException).toHaveBeenCalledWith(erro, expect.objectContaining({ fingerprint: ['canais-ri', 'inscritos'] }))
  })
  it('buildRiView lança por inteiro: a tela recebe a lista normal e as duas seções em erro, e um captureException', async () => {
    const erro = new Error('tudo')
    modelo.buildRiView.mockImplementationOnce(() => { throw erro })
    const props = await pagina({})
    expect(props.view.list).toBeDefined()
    expect(props.ri!.referencias.estado).toBe('erro')
    expect(props.ri!.inscritos.estado).toBe('erro')
    expect(sentry.captureException).toHaveBeenCalledWith(erro, expect.objectContaining({ fingerprint: ['canais-ri', 'tudo'] }))
  })
  it('R9b: o leitor recebe os ids dos canais próprios e o relógio da página; o canal próprio sem retrato abre "ainda não coletado" sem número', async () => {
    const donos = obs.ownChannels().map(c => c.id)
    expect(donos.length).toBeGreaterThan(0)
    const props = await pagina({})
    expect(leitor.lerRetratosProprios).toHaveBeenCalledTimes(1)
    expect(leitor.lerRetratosProprios.mock.calls[0]![1]).toEqual(donos)
    expect(leitor.lerRetratosProprios.mock.calls[0]![2]).toBe(obs.NOW)
    const ins = props.ri!.inscritos
    if (ins.estado !== 'ok') throw new Error('esperava ok')
    const meu = ins.linhas.find(l => l.id === donos[0])!
    expect(meu.pilula).toEqual({ tipo: 'nm', texto: 'sem medida · ainda não coletado' })
    expect(meu.classe == null && meu.barra == null).toBe(true)
  })
  it('R9b: o leitor lança: pílula do motivo, os concorrentes medidos, um captureException com fingerprint [canais-ri, retratos-proprios]', async () => {
    const erro = new Error('banco')
    leitor.lerRetratosProprios.mockRejectedValueOnce(erro)
    const props = await pagina({})
    const dono = obs.ownChannels()[0]!.id
    const ins = props.ri!.inscritos
    if (ins.estado !== 'ok') throw new Error('esperava ok, veio ' + ins.estado)
    expect(ins.linhas.find(l => l.id === dono)!.pilula).toEqual({ tipo: 'nm', texto: 'sem medida · histórico não carregou' })
    expect(ins.linhas.some(l => l.id !== dono && l.classe != null)).toBe(true)
    expect(sentry.captureException).toHaveBeenCalledTimes(1)
    expect(sentry.captureException).toHaveBeenCalledWith(erro, expect.objectContaining({ fingerprint: ['canais-ri', 'retratos-proprios'] }))
  })
  it('R9b: sem canal próprio no obs, o leitor é chamado com lista vazia (ele mesmo não consulta) e nada vai ao Sentry', async () => {
    const ds = datasetFromOracle(loadOracle())
    for (const c of ds.channels) c.own = false
    obs = createObservatory(ds)
    await pagina({})
    expect(leitor.lerRetratosProprios.mock.calls[0]![1]).toEqual([])
    expect(sentry.captureException).not.toHaveBeenCalled()
  })
  it('R9b: sessão só de leitura vê a mesma linha do canal próprio (dado público) e nenhum fetch do Analytics roda', async () => {
    const fetchEspiao = vi.spyOn(globalThis, 'fetch')
    const props = await pagina({})
    expect(JSON.stringify(props.ri)).not.toMatch(/subscribersGained/)
    expect(fetchEspiao).not.toHaveBeenCalled()
    fetchEspiao.mockRestore()
  })
  it('quem só lê vê as mesmas seções do editor', async () => {
    const ed = await pagina({})
    expect(ed.somenteLeitura).toBe(false)
    const lido = buildRiView(obs, { agoraMs: obs.NOW, niche: 'todos', fmt: 'long', meuCanalLembrado: null, retratosProprios: new Map() }).view
    expect(ed.ri).toEqual(lido)
  })
  it('obs sem retratos e sem vídeos na janela: as duas seções abrem com "Nenhum canal pôde ser medido…" e a lista de canais é a mesma', async () => {
    const ds = datasetFromOracle(loadOracle())
    ds.videos = []
    for (const c of ds.channels) { c.snapshots = []; c.undated = [] }
    obs = createObservatory(ds)
    const props = await pagina({})
    const f = (s: RiView['referencias']) => (s.estado === 'ok' ? s.frase.map(x => x.t).join('') : s.estado)
    expect(f(props.ri!.referencias)).toBe('Nenhum canal pôde ser medido nos últimos 90 dias.')
    expect(f(props.ri!.inscritos)).toBe('Nenhum canal pôde ser medido nos últimos 28 dias.')
    expect(props.view.list.ranked.length + props.view.list.unranked.length).toBeGreaterThan(0)
  })
})

const ok = async () => ({ ok: true })
function mount(ri: RiView | undefined, props: Partial<CanaisScreenProps> = {}) {
  const view = buildCanaisView(obsCheio, { niche: 'todos', limit: 75, fmt: 'longos' })
  return render(<ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs=""><CanaisScreen view={view} ri={ri} canUnlock={false} onAdd={ok} onRemove={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} {...props} /></div></ChromeSyncContext.Provider></ToastProvider>)
}
const riDe = () => buildRiView(obsCheio, { agoraMs: obsCheio.NOW, niche: 'todos', fmt: 'long', meuCanalLembrado: null, retratosProprios: new Map() }).view

describe('R5: a tela', () => {
  it('a tela Canais tem as duas seções depois da lista, com as âncoras, e os atalhos acima da lista', () => {
    const { container } = mount(riDe())
    const ref = container.querySelector('#referencias'), ins = container.querySelector('#inscritos'), atalhos = container.querySelector('.ri-atalhos')
    expect(ref).not.toBeNull(); expect(ins).not.toBeNull(); expect(atalhos).not.toBeNull()
    const lista = container.querySelector('.legend')!
    const depois = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(depois(lista, ref!)).toBe(true)
    expect(depois(ref!, ins!)).toBe(true)
    expect(depois(atalhos!, lista)).toBe(true)
    expect(atalhos!.querySelector('a[href="#referencias"]')).not.toBeNull()
    expect(atalhos!.querySelector('a[href="#inscritos"]')).not.toBeNull()
    expect(ref!.closest('.wrap')).not.toBeNull()
  })
  it('só leitura: as duas seções iguais às do editor', () => {
    const secoes = (c: HTMLElement) => (c.querySelector('#referencias')!.outerHTML + c.querySelector('#inscritos')!.outerHTML).replace(/(:r[0-9a-z]+:|_r_[0-9a-z]+_)/g, ':r:') // useId muda a cada montagem
    const ed = secoes(mount(riDe()).container)
    const lido = mount(riDe(), { somenteLeitura: true })
    expect(secoes(lido.container)).toBe(ed)
    expect(lido.container.querySelectorAll('#referencias button, #inscritos button').length).toBeGreaterThan(0) // ordenar continua funcionando
  })
  it('sem ri a tela é a de antes: nenhuma seção', () => {
    const { container } = mount(undefined)
    expect(container.querySelector('#referencias')).toBeNull()
    expect(container.querySelector('.ri-atalhos')).toBeNull()
  })
  it('navegação pendente: aria-busy nas duas seções', () => {
    const { container } = render(<RiSecoes ri={riDe()} ocupada />)
    expect(container.querySelector('#referencias')!.getAttribute('aria-busy')).toBe('true')
    expect(container.querySelector('#inscritos')!.getAttribute('aria-busy')).toBe('true')
  })
  it('seções vazias de dado: nenhuma régua e a frase de "Nenhum canal pôde ser medido"', () => {
    const vazio = buildRiView({ channels: obsCheio.channels, videos: [], SYNC: obsCheio.SYNC }, { agoraMs: obsCheio.NOW, niche: 'todos', fmt: 'long', meuCanalLembrado: null, retratosProprios: new Map() }).view
    const { container } = render(<RiSecoes ri={vazio} ocupada={false} />)
    expect(container.textContent).toContain('Nenhum canal pôde ser medido nos últimos 90 dias.')
    expect(container.querySelectorAll('.reg').length).toBe(0)
  })
  it('canais-screen.tsx não importa ri-model.ts (puxaria stats e o modelo para o cliente)', () => {
    const src = readFileSync(join(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_canais/canais-screen.tsx'), 'utf8')
    expect(src).not.toMatch(/ri-model/)
    expect(src).toMatch(/import type \{ RiView \} from '\.\/ri-tipos'/)
  })
})
