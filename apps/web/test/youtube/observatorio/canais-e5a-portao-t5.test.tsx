// @vitest-environment jsdom
// A5 · E5a, Tarefa 5: os consertos do portão de Phil e Yannis (14/10): dado que não carregou não vira zero, nem "não medido", nem data errada.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => true,
}))
import { render } from '@testing-library/react'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildCanaisView, type CanaisParams } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CanaisScreen } from '@/app/cms/(authed)/youtube/competitors/_canais/canais-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { ChromeSyncContext } from '@/app/cms/(authed)/youtube/competitors/_chrome/sync-context'
import { contagemDosFiltros, estadoDaLinha } from '@/app/cms/(authed)/youtube/competitors/_canais/estado-model'
import { fraseDoResumo } from '@/app/cms/(authed)/youtube/competitors/_canais/resumo-model'
import { resumoDeDirecao, FRASE_SEM_VIEWS } from '@/app/cms/(authed)/youtube/competitors/_canais/direcao-model'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { spDateOf } from '@/lib/youtube/observatorio/time'
import { m8De, medidasDoMotor, EXTRAS_OK, type PorCanal } from './canais-e5a-fixture'

const replace = vi.fn(), push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh: vi.fn(), push, prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(''),
}))
beforeEach(() => { replace.mockReset(); push.mockReset() })

const obs = createObservatory(datasetFromOracle(loadOracle()))
const concorrentes = obs.channels.filter(c => !c.own).map(c => c.id)
const rowsOf = (v: ReturnType<typeof buildCanaisView>) => [...v.list.ranked, ...v.list.unranked]
const vw = (p: Partial<CanaisParams> = {}) => buildCanaisView(obs, { niche: 'todos', limit: 75, fmt: 'longos', ...p })
const ok = async () => ({ ok: true })
const mount = (p: Partial<CanaisParams> = {}) => render(<ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs=""><CanaisScreen view={vw(p)} canUnlock={false} onAdd={ok} onPedir={ok} onApagar={ok} onDesfazer={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} /></div></ChromeSyncContext.Provider></ToastProvider>)
const HOJE = spDateOf(obs.NOW)
const DEPOIS = '2026-12-20'
const EX = EXTRAS_OK
const linhaDe = (m8: Parameters<typeof estadoDaLinha>[0], o: Partial<Parameters<typeof estadoDaLinha>[3]> = {}) => ({ proprio: false, emErro: false, estado: estadoDaLinha(m8, EX, 5, { hojeSP: HOJE, ...o }) })

describe('portão T5: Phil I1, a data de "parado" é a da última publicação', () => {
  it('publicou 01/10 às 20:00 (SP) e a página abre 14/10: a tela escreve 01/10, nunca 02/10', () => {
    const ultimaEm = Date.UTC(2026, 9, 1, 23, 0) // 20:00 em São Paulo
    const v = vw({ medidas: medidasDoMotor(obs, { 'bald-and-bankrupt': { m8: m8De('parado', { dias: 12, ultimaEm }) } }) })
    const r = rowsOf(v).find(x => x.id === 'bald-and-bankrupt')!
    expect(r.estado.ultimaEm).toBe(ultimaEm)
    const paused = (r.cells.cadence as { paused: string | null }).paused
    expect(paused).toContain('01/10')
    expect(paused).not.toContain('02/10')
    expect(paused).toMatch(/12\sdias/)
  })
})

describe('portão T5: Phil I2, primeira busca não é "sem vídeos"', () => {
  it('0 vídeos com a busca em andamento: não medido, "ainda buscando os vídeos"', () => {
    const e = estadoDaLinha(m8De('ativo'), EX, 0, { hojeSP: HOJE, buscando: true })
    expect(e.pastilha).toBe('nao_medido')
    expect(e.linha).toContain('ainda buscando os vídeos')
    expect(linhaDe(m8De('ativo'), { buscando: true }).estado.pastilha).not.toBe('sem_videos')
  })
  it('busca concluída e 0 vídeos: sem vídeos', () => {
    expect(estadoDaLinha(m8De('ativo'), EX, 0, { hojeSP: HOJE, buscando: false }).pastilha).toBe('sem_videos')
  })
  it('na lista: canal em backfill com 0 vídeos datados não entra em "sem vídeos"', () => {
    const ds = datasetFromOracle(loadOracle())
    const alvo = ds.channels.find(x => !x.own)!
    ds.videos = ds.videos.filter(v => v.ch !== alvo.id)
    alvo.sync.state = 'backfill'
    const o2 = createObservatory(ds)
    const v = buildCanaisView(o2, { niche: 'todos', limit: 75, fmt: 'longos', medidas: medidasDoMotor(o2) })
    const r = rowsOf(v).find(x => x.id === alvo.id)!
    expect(r.estado.pastilha).toBe('nao_medido')
    expect(v.resumo.contagem.todos).toBeGreaterThan(0)
    expect(rowsOf(buildCanaisView(o2, { niche: 'todos', limit: 75, fmt: 'longos', medidas: medidasDoMotor(o2), filter: 'sem-videos' })).filter(x => !x.own)).toEqual([])
  })
})

describe('portão T5: Yannis I1 e Phil M1, direção que não carregou não vira "0 canais"', () => {
  it('medidas nulas + filtro em-queda antes da data: o apoio não contém "0 canais" e não oferece "descendo"', () => {
    const v = vw({ medidas: null, filter: 'em-queda' })
    expect(v.resumo.vazio?.forma).toBe('ainda_nao_existe')
    expect(v.resumo.vazio?.apoio).not.toContain('0 canais')
    expect(v.resumo.vazio?.apoio).toContain('falhou agora')
    expect(v.resumo.vazio?.acaoDescendo).toBe(false)
  })
})

describe('portão T5: Yannis I2, falha total não vira "cálculo ainda não rodou"', () => {
  it('3 linhas não carregaram depois da data: queda é nao_carregou e a frase não diz "não medido"', () => {
    const ls = [1, 2, 3].map(() => linhaDe(null))
    const c = contagemDosFiltros(ls, DEPOIS)
    expect(c.queda.tipo).toBe('nao_carregou')
    const frase = fraseDoResumo(resumoDeDirecao([]), c)
    expect(frase).not.toContain('não medido')
    expect(frase).toContain('Em queda: a leitura falhou')
  })
  it('sem nenhuma linha elegível: zero canais, e nunca um motivo inventado', () => {
    expect(contagemDosFiltros([], DEPOIS).queda).toEqual({ tipo: 'numero', emQueda: 0, quedaMedidaEm: 0, canais: 0 })
  })
  it('na tela: medidas nulas + em-queda depois da data vira o vazio "nao_carregou", sem a hachura de não medido', () => {
    const v = vw({ medidas: null, filter: 'parados' })
    expect(v.resumo.vazio?.forma).toBe('nao_carregou')
    const { container } = mount({ medidas: null, filter: 'parados' })
    expect(container.querySelector('[data-vazio="nao_carregou"]')).not.toBeNull()
    expect(container.querySelector('[data-vazio="nao_medido"]')).toBeNull()
  })
})

describe('portão T5: Yannis I3, falha parcial mostra a base medida', () => {
  const sobre = (): PorCanal => Object.fromEntries(concorrentes.slice(0, 5).map(id => [id, 'nao_carregou' as const]))
  it('5 canais sem estado: Parados e Saíram não são "zero medido" e dizem "medido em N de M"', () => {
    const medidas = medidasDoMotor(obs, sobre())
    const v = vw({ medidas })
    const total = concorrentes.length, lidos = total - 5
    expect(v.resumo.contagem.estadoMedidoEm).toBe(lidos)
    const f = (ch: string) => v.resumo.filtros.find(x => x.chave === ch)!
    expect(f('parados').base).toEqual({ medidos: lidos, de: total })
    expect(f('parados').leitor).toContain(`medido em ${lidos} de ${total}`)
    expect(v.resumo.frase).toContain(`Estado medido em ${lidos} de ${total} canais.`)
    const { container } = mount({ medidas })
    expect(container.querySelectorAll('.obs-cn-filtro .obs-ch-zero').length).toBe(0)
  })
  it('estado lido em todos: sem base e sem frase de base', () => {
    const v = vw({ medidas: medidasDoMotor(obs) })
    expect(v.resumo.filtros.every(f => f.base === null)).toBe(true)
    expect(v.resumo.frase).not.toContain('Estado medido em')
  })
})

describe('portão T5: Phil M2, o rótulo bate com a regra do filtro', () => {
  it('o filtro conta o que o retrato antigo contava (tudo que não está ok) e não se chama "Em erro"', () => {
    const ds = datasetFromOracle(loadOracle())
    const [a, b, c] = ds.channels.filter(x => !x.own)
    a!.sync.state = 'atrasado'; b!.sync.state = 'backfill'; c!.sync.state = 'erro'
    const o2 = createObservatory(ds)
    const naoOk = o2.channels.filter(x => !x.own && x.sync.state !== 'ok').length
    const v = buildCanaisView(o2, { niche: 'todos', limit: 75, fmt: 'longos', medidas: medidasDoMotor(o2) })
    expect(v.resumo.contagem.emErro).toBe(naoOk)
    const f = v.resumo.filtros.find(x => x.chave === 'problemas')!
    expect(f.rotulo).toBe('Com problema')
    expect(v.resumo.frase).toContain(`${naoOk} canais com problema na coleta.`)
    expect(v.resumo.frase).not.toMatch(/em erro/)
  })
})

describe('portão T5: Phil M3, as janelas vêm de MEASURE_RULES', () => {
  it('a frase do canal sem views escreve o dobro da janela da direção', () => {
    expect(FRASE_SEM_VIEWS).toBe(`sem views nos ${MEASURE_RULES.direction.windowDays * 2} dias para comparar`)
  })
  it('o ⓘ e a faixa escrevem a janela da regra', () => {
    const { container } = mount({ medidas: medidasDoMotor(obs) })
    const n = MEASURE_RULES.direction.windowDays
    expect(container.querySelector('.obs-cn-faixa')?.textContent).toContain(`views dos últimos ${n} dias contra os ${n} anteriores`)
  })
})
