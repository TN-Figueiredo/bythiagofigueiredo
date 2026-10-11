// @vitest-environment jsdom
/**
 * A2, Tarefa 8: o cartão novo "Leitura da forja" na tela do Histórico e o botão do cabeçalho que rola e pede (spec 6.5, 7.1, 7.2, 7.4, 11 linhas 13 e 14).
 * O modelo (situações, frases, etapas) já tem os seus testes (historico-a2-forja-model); aqui se afirma o que a pessoa vê e faz. A ação de pedir é um dublê:
 * nada é escrito em fila nenhuma. O conjunto base é lido UMA vez por arquivo (o CI tem limite de 60 s por executor).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup, fireEvent, act } from '@testing-library/react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { loadOracle, loadOracleOwns, datasetFromOracle, createTestObservatory } from './oracle'
import { plain } from './fase4-world'
import { SHOWCASE } from './forja-scenarios'
import { createObservatory, type Observatory } from '@/lib/youtube/observatorio'
import type { Dataset, ForjaRequest } from '@/lib/youtube/observatorio/types'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { HistoricoScreen } from '@/app/cms/(authed)/youtube/competitors/_historico/historico-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { HeaderAskButton } from '@/app/cms/(authed)/youtube/competitors/_historico/forja-card'
import { limparPagerUsado } from '@/app/cms/(authed)/youtube/competitors/_historico/pager-usado'
import { AVISO_JA_TEM_SITUACAO, FORJA_EXPLICACAO, SELO_INFO, VAZIO } from '@/app/cms/(authed)/youtube/competitors/_historico/forja-card-model'

const nav = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, refresh: nav.refresh, push: nav.push, back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/video/x',
  useSearchParams: () => new URLSearchParams(''),
}))
vi.mock('next/link', () => ({
  default: ({ href, replace: _replace, prefetch: _prefetch, onClick, children, ...rest }: { href: string; replace?: boolean; prefetch?: boolean; onClick?: (e: ReactMouseEvent<HTMLAnchorElement>) => void; children?: ReactNode } & Record<string, unknown>) => (
    <a href={href} onClick={e => { e.preventDefault(); onClick?.(e) }} {...rest}>{children}</a>
  ),
}))

const ID = SHOWCASE
const MIN = 6e4
const READING_ID = 'leitura-video-matt-opus55-20-10'

let base: Dataset | null = null
const baseDataset = (): Dataset => (base ??= plain(datasetFromOracle(loadOracle())))
/** Com os cenários do gerador a sessão começa vazia; `state` põe um cenário (null = sem pedido). */
function world(mut?: (ds: Dataset) => void): Observatory {
  const ds = plain(baseDataset())
  mut?.(ds)
  return createTestObservatory(ds)
}
/** O motor de produção: os pedidos vêm do conjunto, no formato do banco. */
function worldDb(mut: (ds: Dataset) => void): Observatory {
  const ds = plain(baseDataset())
  mut(ds)
  return createObservatory(ds)
}
const semLeitura = (ds: Dataset) => { ds.readings = ds.readings.filter(r => r.id !== READING_ID) }
const dbReq = (ds: Dataset, o: Partial<ForjaRequest> & { state: ForjaRequest['state'] }): ForjaRequest => ({
  id: 'db-lv-' + o.state, type: 'leitura-video', niche: 'ia', status: 'pending', video: ID, target: { kind: 'video', niche: 'ia', video: ID },
  createdAt: ds.now - 4 * MIN, claimedAt: null, startedAt: null, publishedAt: null, failedAt: null, attempt: 1, refusedReason: null, readingId: null, ...o,
})
const COM_LEITURA = world()            // pronta; o estado do pedido é posto por teste
const SEM_LEITURA = world(semLeitura)  // nunca pedida

function viewOf(o: Observatory, state: string | null | undefined, id = ID, p: Record<string, string> = {}) {
  if (state !== undefined) { o.forja.session.reset(); if (state) o.forja.session.setBase(state, { type: 'leitura-video', video: id }) }
  return buildHistoricoView(o, id, p)
}

type Ask = ReturnType<typeof vi.fn>
const ask: Ask = vi.fn()
const cancel: Ask = vi.fn()
const sync: Ask = vi.fn()
let main: HTMLElement
const scrollTo = vi.fn()
function Tela({ view, children }: { view: ReturnType<typeof buildHistoricoView>; children?: ReactNode }) {
  return <ToastProvider><main style={{ overflowY: 'auto' }} ref={el => { if (el) { main = el; el.scrollTo = scrollTo as unknown as typeof el.scrollTo } }}>{children}<HistoricoScreen view={view} onAskForja={ask as never} onCancelForja={cancel as never} onSyncChannel={sync as never} /></main></ToastProvider>
}
function mount(o: Observatory, state: string | null | undefined, id = ID, p: Record<string, string> = {}) {
  const view = viewOf(o, state, id, p)
  const r = render(<Tela view={view} />)
  const root = () => r.container.querySelector<HTMLElement>('[data-obs-screen="historico"]')!
  const again = (o2: Observatory, st: string | null | undefined, id2 = id) => r.rerender(<Tela view={viewOf(o2, st, id2, p)} />)
  return { ...r, view, root: root(), card: () => r.container.querySelector<HTMLElement>('.obs-fj'), again }
}
const header = (c: HTMLElement) => c.querySelector<HTMLButtonElement>('#askForja')!
const live = (c: HTMLElement) => c.querySelector('#hv-live')!.textContent
const motionReduce = (reduce: boolean) => vi.spyOn(window, 'matchMedia').mockImplementation((q: string) => ({ matches: reduce && /reduce/.test(q), media: q, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false }) as MediaQueryList)
const deferred = <T,>() => { let ok!: (v: T) => void; const p = new Promise<T>(r => { ok = r }); return { p, ok } }
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve() }) }

beforeEach(() => {
  nav.replace.mockClear(); nav.refresh.mockClear(); scrollTo.mockClear(); window.sessionStorage.clear(); limparPagerUsado()
  ask.mockReset(); ask.mockResolvedValue({ ok: true, reason: null, results: [] })
  cancel.mockReset(); cancel.mockResolvedValue({ ok: true })
  sync.mockReset(); sync.mockResolvedValue({ ok: true })
  motionReduce(false)
})
afterEach(() => { cleanup(); document.getElementById('flut')?.remove(); vi.useRealTimers(); vi.restoreAllMocks() })

describe('o cartão na tela', () => {
  it('o cartão "Leitura da forja" fica depois de "Antes e depois" e antes das versões', () => {
    const { root, card } = mount(COM_LEITURA, null)
    const c = card()!
    expect(c.getAttribute('role')).toBe('region')
    expect(within(c).getByRole('heading', { level: 3, name: /^Leitura da forja/ })).toBeTruthy()
    const compare = root.querySelector('#hv-compare')!, versions = root.querySelector('section.versions')!
    expect(compare.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(c.compareDocumentPosition(versions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('um selo só, com "em treino"; o ⓘ abre a frase do spec', () => {
    const { card } = mount(COM_LEITURA, null)
    const selos = card()!.querySelectorAll('.obs-fj-stamp')
    expect(selos).toHaveLength(1)
    expect(selos[0]!.textContent).toBe('forja · Gemma 12B · em treino · gerada 20/10 06:10 (SP)')
    const i = within(card()!).getByRole('button', { name: 'Sobre o selo em treino' })
    expect(i.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(i)
    expect(i.getAttribute('aria-expanded')).toBe('true')
    expect(within(document.getElementById('flut')!).getByText(SELO_INFO)).toBeTruthy()
    expect(SELO_INFO).toBe('O modelo ainda não é especialista neste assunto. Leia como rascunho e confira as evidências.')
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(i.getAttribute('aria-expanded')).toBe('false')
  })

  it('"Leu N trocas, dados de dd/mm hh:mm" fica sob o selo, fora dele', () => {
    const { card } = mount(COM_LEITURA, null)
    const leu = card()!.querySelector('.obs-fj-leu')!
    expect(leu.textContent).toMatch(/^Leu este vídeo e \d+ trocas?, dados de \d\d\/\d\d \d\d:\d\d$/)
    expect(leu.closest('.obs-fj-stamp')).toBeNull()
  })

  it('três etapas na ordem Na fila, Escrevendo, Pronta; a atual tem "em andamento" e as feitas têm o visto (texto, não só cor)', () => {
    const { card } = mount(COM_LEITURA, 'trabalhando')
    const lis = [...card()!.querySelectorAll('ol[aria-label="Etapas do pedido"] > li')]
    expect(lis.map(l => l.querySelector('.obs-fj-sn')!.textContent)).toEqual(['Na fila', 'Escrevendo', 'Pronta'])
    expect(lis.map(l => [...l.classList].find(c => /^obs-fj-(done|now|late|fail|todo)$/.test(c)))).toEqual(['obs-fj-done', 'obs-fj-now', 'obs-fj-todo'])
    // feita: o visto desenhado E a palavra
    expect(lis[0]!.querySelector('.obs-fj-dot svg')).not.toBeNull()
    expect(lis[0]!.textContent).toContain('concluída')
    // atual: a palavra, marcada como a etapa atual
    expect(lis[1]!.textContent).toContain('em andamento')
    expect(lis[1]!.getAttribute('aria-current')).toBe('step')
    expect(lis[1]!.querySelector('.obs-fj-dot svg')).toBeNull()
    // a seguir: sem marca nenhuma, só para o leitor de tela
    expect(lis[2]!.textContent).toBe('Pronta, a seguir')
    expect(lis[2]!.querySelector('.sr')!.textContent).toMatch(/a seguir/)
  })

  it('atrasado: a etapa fica âmbar com o ícone de relógio com aviso; "Não deu" marca a etapa que parou com X e a palavra', () => {
    const a = mount(COM_LEITURA, 'atrasado')
    const late = a.card()!.querySelector('li.obs-fj-late')!
    expect(late.textContent).toContain('em andamento, com atraso')
    expect(a.card()!.querySelector('.obs-fj-sit.obs-fj-late [data-ico="clockw"]')).not.toBeNull()
    a.unmount()
    const f = mount(COM_LEITURA, 'falhou')
    const fail = f.card()!.querySelector('li.obs-fj-fail')!
    expect(fail.textContent).toMatch(/Escrevendo.*parou aqui/)
    expect(fail.querySelector('.obs-fj-dot svg')).not.toBeNull()
    expect(f.card()!.querySelector('.obs-fj-sit.obs-fj-bad [data-ico="warn"]')).not.toBeNull()
  })

  it('com pedido em andamento não há botão de pedir no cartão; há "Cancelar pedido" só na fila', () => {
    for (const s of ['na fila', 'trabalhando', 'atrasado', 'sem máquina', 'nova tentativa', 'liberado pelo vigia']) {
      const { card, unmount } = mount(COM_LEITURA, s)
      expect([s, card()!.querySelector('[data-fj="pedir"]')]).toEqual([s, null])
      const cancelar = within(card()!).queryByRole('button', { name: 'Cancelar pedido' })
      expect([s, !!cancelar]).toEqual([s, ['na fila', 'atrasado', 'sem máquina', 'liberado pelo vigia'].includes(s)])
      unmount()
    }
  })

  it('"Cancelar pedido": uma chamada só (clique duplo), com o vídeo; depois, aviso e atualização', async () => {
    const d = deferred<{ ok: boolean }>()
    cancel.mockReturnValue(d.p)
    const { card, view } = mount(COM_LEITURA, 'na fila')
    const b = within(card()!).getByRole('button', { name: 'Cancelar pedido' })
    fireEvent.click(b); fireEvent.click(b)
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(cancel).toHaveBeenCalledWith('leitura-video', view.forja!.niche, ID)
    await act(async () => { d.ok({ ok: true }) })
    expect(await screen.findByText('Pedido cancelado')).toBeTruthy()
    expect(nav.refresh).toHaveBeenCalledTimes(1)
  })

  it('"Cancelar pedido" que o servidor recusa mostra o motivo e atualiza', async () => {
    cancel.mockResolvedValue({ ok: false, reason: 'a forja já está escrevendo' })
    const { card } = mount(COM_LEITURA, 'na fila')
    fireEvent.click(within(card()!).getByRole('button', { name: 'Cancelar pedido' }))
    expect(await screen.findByText('Não deu para cancelar')).toBeTruthy()
    expect(screen.getByText('A forja já está escrevendo.')).toBeTruthy()
  })

  it('"Pausar atualização automática" suspende o refresh e vira "Retomar atualização automática"; "Tela atualizada há N min" é texto', () => {
    vi.useFakeTimers()
    const { card, root } = mount(COM_LEITURA, 'na fila')
    const tela = () => card()!.querySelector('.obs-fj-upd')!.textContent!
    expect(tela()).toMatch(/^Pedido feito há 4 min, às 14:58\. Tela atualizada agora\. Pode sair desta página: o pedido continua\.$/)
    const pausar = within(card()!).getByRole('button', { name: 'Pausar atualização automática' })
    expect(pausar.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(pausar)
    const retomar = within(card()!).getByRole('button', { name: 'Retomar atualização automática' })
    expect(retomar.getAttribute('aria-pressed')).toBe('true')
    expect(live(root)).toBe('Atualização automática pausada.')
    act(() => { vi.advanceTimersByTime(3 * 60_000) })
    expect(nav.refresh).not.toHaveBeenCalled()
    expect(tela()).toMatch(/Tela atualizada há 3 min \(atualização pausada\)\. Pode sair desta página/)
    expect(card()!.querySelector('.obs-fj-upd')!.closest('[role]:not([role="region"])')).toBeNull()   // texto, não uma região viva
    fireEvent.click(retomar)
    expect(live(root)).toBe('Atualização automática retomada.')
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(nav.refresh).toHaveBeenCalledTimes(1)
    expect(tela()).toMatch(/Tela atualizada agora/)
    // sem pedido em andamento não há o que pausar
    cleanup()
    const parado = mount(COM_LEITURA, null)
    expect(within(parado.card()!).queryByRole('button', { name: /atualização automática/ })).toBeNull()
  })

  it('a situação é anunciada (aria-live polite) só quando muda', () => {
    const { card, again } = mount(worldDb(ds => { ds.requests.push(dbReq(ds, { state: 'na fila', createdAt: ds.now - 4 * MIN })) }), undefined)
    const regiao = () => card()!.querySelector<HTMLElement>('[data-fj-live]')!
    expect(regiao().getAttribute('aria-live')).toBe('polite')
    expect(regiao().getAttribute('role')).toBe('status')
    expect(regiao().textContent).toBe('')                                    // o que já estava na tela ao abrir não é lido de novo
    // a mesma situação, outra frase (o pedido é de outra hora): nada novo a anunciar
    again(worldDb(ds => { ds.requests.push(dbReq(ds, { state: 'na fila', createdAt: ds.now - 9 * MIN })) }), undefined)
    expect(card()!.querySelector('.obs-fj-sit p')!.textContent).toBe('Aguardando: na fila desde 14:53.')
    expect(regiao().textContent).toBe('')
    // a situação muda: a frase nova é anunciada
    again(worldDb(ds => { ds.requests.push(dbReq(ds, { state: 'trabalhando', claimedAt: ds.now - 2 * MIN })) }), undefined)
    expect(regiao().textContent).toBe('Aguardando: a forja está escrevendo desde 15:00. Leva de 10 a 25 minutos.')
    // e o que é só a hora do pedido ("há N min") nunca está dentro da região
    expect(regiao().contains(card()!.querySelector('.obs-fj-upd'))).toBe(false)
  })

  it('"O que é a forja?" aberto antes da primeira leitura e recolhido depois', () => {
    const a = mount(SEM_LEITURA, null)
    const bt = within(a.card()!).getByRole('button', { name: 'O que é a forja?' })
    expect(bt.getAttribute('aria-expanded')).toBe('true')
    const texto = a.card()!.querySelector<HTMLElement>('#' + bt.getAttribute('aria-controls'))!
    expect(texto.hidden).toBe(false)
    expect(texto.textContent).toBe(FORJA_EXPLICACAO)
    fireEvent.click(bt)
    expect(bt.getAttribute('aria-expanded')).toBe('false')
    expect(texto.hidden).toBe(true)
    a.unmount()
    const b = mount(COM_LEITURA, null)
    const bt2 = within(b.card()!).getByRole('button', { name: 'O que é a forja?' })
    expect(bt2.getAttribute('aria-expanded')).toBe('false')
    expect(b.card()!.querySelector<HTMLElement>('#' + bt2.getAttribute('aria-controls'))!.hidden).toBe(true)
    fireEvent.click(bt2)
    expect(bt2.getAttribute('aria-expanded')).toBe('true')
  })

  it('evidências numeradas são links; "Do site" fica fora do selo', () => {
    const { card, view } = mount(COM_LEITURA, null)
    const c = card()!
    const fns = [...c.querySelectorAll<HTMLAnchorElement>('a.obs-fj-fn')]
    expect(fns).toHaveLength(6)
    expect(fns.map(a => a.textContent)).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(fns[0]!.getAttribute('href')).toBe(COM_LEITURA.link.historico(ID, { troca: 'matt-opus55/title/1' }))
    expect(fns[0]!.getAttribute('aria-label')).toBe('Evidência 1: Título (entre 11/10 06h e 12h)')
    // cada índice está no item que o cita, e a lista "Evidências" leva aos mesmos lugares
    const itens = [...c.querySelectorAll('.obs-fj-itens > li')]
    expect(itens).toHaveLength(6)
    expect(itens.every((li, i) => li.contains(fns[i]!))).toBe(true)
    expect(itens.map(li => li.textContent!.replace(/\d$/, ''))).toEqual(view.forjaCard!.leitura!.itens.map(i => i.texto))
    expect([...c.querySelectorAll<HTMLAnchorElement>('.obs-fj-evid a')].map(a => a.getAttribute('href'))).toEqual(fns.map(a => a.getAttribute('href')))
    const dosite = c.querySelector('.obs-fj-site')!
    expect(dosite.textContent).toMatch(/^Do site: desde então, /)
    expect(dosite.closest('.obs-fj-stamp')).toBeNull()
    expect(c.querySelector('.obs-fj-stamp')!.contains(dosite)).toBe(false)
  })

  it('sem evidência por item (o que a produção entrega hoje) o texto sai inteiro e sem índice nenhum', () => {
    const o = world(ds => { ds.readings.find(r => r.id === READING_ID)!.analysis = {} })
    const { card, view } = mount(o, null)
    const c = card()!
    expect(c.querySelectorAll('a.obs-fj-fn')).toHaveLength(0)
    expect(c.querySelector('.obs-fj-evid')).toBeNull()
    expect([...c.querySelectorAll('.obs-fj-itens > li')].map(li => li.textContent)).toEqual(view.forjaCard!.leitura!.itens.map(i => i.texto))
    expect(c.textContent).not.toMatch(/undefined|null|\[object/)
  })

  it('"Pronta, mas desatualizada": faixa âmbar com ícone próprio e as duas ações', () => {
    const o = world(ds => { ds.readings.find(r => r.id === READING_ID)!.generatedAt = createTestObservatory(plain(baseDataset())).changes.filter(c => c.video === ID).sort((a, b) => a.at - b.at).at(-3)!.at - 36e5 })
    const { card } = mount(o, null)
    const faixa = card()!.querySelector('.obs-fj-sit')!
    expect(faixa.classList.contains('obs-fj-late')).toBe(true)
    expect(faixa.querySelector('[data-ico="stale"]')).not.toBeNull()
    expect(faixa.querySelector('[data-ico="clockw"], [data-ico="ok"]')).toBeNull()
    expect(faixa.textContent).toContain('Pronta, mas desatualizada: depois que ela foi escrita, saíram 3 trocas.')
    const ver = within(card()!).getByRole('link', { name: 'Ver as 3 trocas' })
    expect(ver.getAttribute('href')).toBe(o.link.canal(o.video(ID)!.ch, { tab: 'trocas' }))
    expect(within(card()!).getByRole('button', { name: 'Pedir nova leitura deste vídeo à forja' }).getAttribute('aria-disabled')).not.toBe('true')
  })

  it('"Precisa de você": a ação "Sincronizar este canal" liga a ação do servidor com o canal, atualiza e diz "Pode pedir de novo."', async () => {
    const d = deferred<{ ok: boolean }>()
    sync.mockReturnValue(d.p)
    const { card, view } = mount(COM_LEITURA, 'recusado (dado velho)')
    const c = card()!
    expect(c.querySelector('.obs-fj-sit.obs-fj-bad [data-ico="warn"]')).not.toBeNull()
    expect(c.querySelector('.obs-fj-sit')!.textContent).toContain('Precisa de você: os dados deste canal são de 23/10, antigos demais para ler.')
    // o botão do cartão está apagado até o canal sincronizar, e diz por quê
    const pedir = c.querySelector('[data-fj="pedir"]')!
    expect(pedir.getAttribute('aria-disabled')).toBe('true')
    expect(c.querySelector('#' + pedir.getAttribute('aria-describedby'))!.textContent).toBe('Sincronize o canal primeiro. Depois, pode pedir de novo.')
    const bt = within(c).getByRole('button', { name: 'Sincronizar este canal' })
    fireEvent.click(bt); fireEvent.click(bt)
    expect(sync).toHaveBeenCalledTimes(1)
    expect(sync).toHaveBeenCalledWith(COM_LEITURA.video(ID)!.ch)
    expect(bt.getAttribute('aria-busy')).toBe('true')
    await act(async () => { d.ok({ ok: true }) })
    expect(nav.refresh).toHaveBeenCalledTimes(1)
    expect(c.querySelector('[data-fj-sync-status]')!.textContent).toBe('Canal sincronizado. Pode pedir de novo.')
    expect(view.forjaCard!.acoes[0]!.href).toBe('')   // a ação não é um link: o model deixou o href vazio de propósito
  })

  it('"Sincronizar este canal" que falha diz que não respondeu e deixa tentar de novo', async () => {
    sync.mockResolvedValue({ ok: false })
    const { card } = mount(COM_LEITURA, 'recusado (dado velho)')
    fireEvent.click(within(card()!).getByRole('button', { name: 'Sincronizar este canal' }))
    await flush()
    expect(card()!.querySelector('[data-fj-sync-status]')!.textContent).toBe('A sincronização não respondeu. Tente de novo em alguns minutos.')
    expect(within(card()!).getByRole('button', { name: 'Sincronizar este canal' }).getAttribute('aria-busy')).not.toBe('true')
    expect(nav.refresh).toHaveBeenCalledTimes(1)
  })

  it('"Não deu": a etapa que parou, a frase do spec e o botão "Pedir de novo" aceso', () => {
    const { card } = mount(COM_LEITURA, 'falhou')
    expect(card()!.querySelector('.obs-fj-sit')!.textContent).toMatch(/^Não deu: .*Pode pedir de novo\./)
    expect(within(card()!).getByRole('button', { name: 'Pedir de novo' }).getAttribute('aria-disabled')).not.toBe('true')
  })

  it('"Leitura anterior": com pedido andando, a leitura antiga leva o rótulo; recém-publicada, a anterior vem recolhida', () => {
    const a = mount(COM_LEITURA, 'na fila')
    expect(a.card()!.querySelector('.obs-fj-rotulo')!.textContent).toBe('Leitura anterior')
    expect(a.card()!.querySelectorAll('.obs-fj-stamp')).toHaveLength(1)
    a.unmount()
    const b = mount(COM_LEITURA, 'publicado')
    expect(b.card()!.querySelectorAll('.obs-fj-stamp').length).toBe(2)
    const ant = b.card()!.querySelector<HTMLDetailsElement>('details.obs-fj-prev')!
    expect(ant.open).toBe(false)
    expect(ant.querySelector('summary')!.textContent).toMatch(/^Leitura anterior/)
  })
})

describe('o botão do cabeçalho', () => {
  it('livre: UM clique faz UMA chamada de onAsk("leitura-video", nicho, vídeo), rola até o cartão e põe o foco no título do cartão', async () => {
    const { root, card, view } = mount(SEM_LEITURA, null)
    const b = header(root)
    expect(b.textContent).toBe('Pedir leitura à forja')
    expect(b.closest('.vhead .actions .frow')).not.toBeNull()
    expect(b.classList.contains('forja-solid')).toBe(true)
    fireEvent.click(b)
    expect(ask).toHaveBeenCalledTimes(1)
    expect(ask).toHaveBeenCalledWith('leitura-video', view.forja!.niche, ID)
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo.mock.calls[0]![0]).toMatchObject({ behavior: 'smooth' })
    const titulo = card()!.querySelector('h3')!
    expect(titulo.getAttribute('tabindex')).toBe('-1')
    expect(document.activeElement).toBe(titulo)
    await flush()
    expect(await screen.findByText('Pedido enviado à forja')).toBeTruthy()
    expect(nav.refresh).toHaveBeenCalledTimes(1)
  })

  it('com movimento reduzido a rolagem é seca (sem animação)', () => {
    motionReduce(true)
    const { root } = mount(SEM_LEITURA, null)
    fireEvent.click(header(root))
    expect(scrollTo.mock.calls[0]![0]).toMatchObject({ behavior: 'auto' })
  })

  it('a rolagem usa o contêiner que rola (não a janela) e deixa o cartão perto do topo dele', () => {
    const { root, card } = mount(SEM_LEITURA, null)
    const rect = (top: number) => ({ top, bottom: top + 400, left: 0, right: 800, width: 800, height: 400, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
    main.getBoundingClientRect = () => rect(100)
    main.scrollTop = 50
    card()!.getBoundingClientRect = () => rect(900)
    const janela = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    fireEvent.click(header(root))
    expect(janela).not.toHaveBeenCalled()
    // 900 - 100 (topo do contêiner) + 50 (já rolado) - 16 (folga) = 834
    expect(scrollTo.mock.calls[0]![0]).toMatchObject({ top: 834 })
  })

  it('clique duplo e clique durante "Pedindo…" (aria-busy): continua uma chamada só', async () => {
    const d = deferred<{ ok: boolean; reason: string | null; results: never[] }>()
    ask.mockReturnValue(d.p)
    const { root, card } = mount(SEM_LEITURA, null)
    const b = header(root)
    fireEvent.click(b); fireEvent.click(b)
    expect(ask).toHaveBeenCalledTimes(1)
    expect(b.textContent).toBe('Pedindo…')
    expect(b.getAttribute('aria-busy')).toBe('true')
    // o botão do cartão é o mesmo pedido: também está ocupado e também não envia outro
    const doCartao = card()!.querySelector<HTMLElement>('[data-fj="pedir"]')!
    expect(doCartao.getAttribute('aria-busy')).toBe('true')
    fireEvent.click(doCartao); fireEvent.click(b)
    expect(ask).toHaveBeenCalledTimes(1)
    await act(async () => { d.ok({ ok: true, reason: null, results: [] }) })
    expect(ask).toHaveBeenCalledTimes(1)
    expect(nav.refresh).toHaveBeenCalledTimes(1)
    expect(b.getAttribute('aria-busy')).not.toBe('true')
  })

  it('durante "Pedindo…" o botão não rouba o foco do título do cartão com um segundo clique (mousedown sem foco)', () => {
    ask.mockReturnValue(new Promise(() => {}))
    const { root } = mount(SEM_LEITURA, null)
    fireEvent.click(header(root))
    expect(header(root).getAttribute('aria-busy')).toBe('true')
    expect(fireEvent.mouseDown(header(root)), 'o mousedown é cancelado').toBe(false)
  })

  it('com pedido em andamento o botão do cabeçalho diz "Leitura em andamento: ver" e só rola (zero chamadas)', () => {
    const { root, card } = mount(COM_LEITURA, 'na fila')
    const b = header(root)
    expect(b.textContent).toBe('Leitura em andamento: ver')
    fireEvent.click(b)
    expect(ask).not.toHaveBeenCalled()
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(card()!.querySelector('h3'))
  })

  it('com leitura pronta diz "Ver a leitura" e só rola', () => {
    const { root, card } = mount(COM_LEITURA, null)
    const b = header(root)
    expect(b.textContent).toBe('Ver a leitura')
    fireEvent.click(b)
    expect(ask).not.toHaveBeenCalled()
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(card()!.querySelector('h3'))
  })

  it('o status lê "A leitura da forja já tem uma situação; ela está logo abaixo." quando já existe situação', () => {
    expect(AVISO_JA_TEM_SITUACAO).toBe('A leitura da forja já tem uma situação; ela está logo abaixo.')
    for (const s of ['na fila', null] as const) {
      const { root, unmount } = mount(COM_LEITURA, s)
      expect(live(root)).toBe('')
      fireEvent.click(header(root))
      expect([s, live(root)]).toEqual([s, AVISO_JA_TEM_SITUACAO])
      unmount()
    }
    // sem situação nenhuma, nada a dizer ao rolar (o pedido sai e o servidor responde)
    const { root } = mount(SEM_LEITURA, null)
    fireEvent.click(header(root))
    expect(live(root)).not.toContain('situação')
  })

  it('depois de "Não deu" diz "Pedir leitura à forja de novo" e pede', () => {
    const { root } = mount(COM_LEITURA, 'falhou')
    expect(header(root).textContent).toBe('Pedir leitura à forja de novo')
    fireEvent.click(header(root))
    expect(ask).toHaveBeenCalledTimes(1)
  })

  it('no limite do dia: "Ver a leitura" com a frase do spec ao lado, e só rola', () => {
    const FRASE = 'Já houve uma leitura deste vídeo hoje. Libera amanhã às 00:00.'
    const cardRef = { current: document.createElement('section') }
    cardRef.current.innerHTML = '<h3 tabindex="-1">Leitura da forja</h3>'
    document.body.appendChild(cardRef.current)
    const pedir = vi.fn(), say = vi.fn()
    const { container } = render(<HeaderAskButton ask={{ label: 'Ver a leitura', modo: 'so-rola', frase: FRASE, aviso: AVISO_JA_TEM_SITUACAO }} pedido={{ busy: false, recusa: null, pedir }} cardRef={cardRef} say={say} bloqueado={null} />)
    expect(container.querySelector('#askForja')!.textContent).toBe('Ver a leitura')
    expect(container.querySelector('#askStatus')!.textContent).toBe(FRASE)
    fireEvent.click(container.querySelector('#askForja')!)
    expect(pedir).not.toHaveBeenCalled()
    expect(say).toHaveBeenCalledWith(AVISO_JA_TEM_SITUACAO)
    cardRef.current.remove()
  })

  it('servidor recusa: o botão volta a "Pedir leitura à forja" e diz o motivo; nada de etapa inventada', async () => {
    ask.mockResolvedValue({ ok: false, reason: 'já há uma leitura de vídeo de IA na fila', results: [] })
    const { root, card } = mount(SEM_LEITURA, null)
    fireEvent.click(header(root))
    await flush()
    expect(header(root).textContent).toBe('Pedir leitura à forja')
    expect(header(root).getAttribute('aria-busy')).not.toBe('true')
    expect(root.querySelector('#askStatus')!.textContent).toBe('Já há uma leitura de vídeo de IA na fila.')
    expect(live(root)).toBe('Já há uma leitura de vídeo de IA na fila.')
    expect(card()!.querySelector('ol[aria-label="Etapas do pedido"]')).toBeNull()
    expect(card()!.querySelector('.obs-fj-sit')).toBeNull()
    expect(nav.refresh).not.toHaveBeenCalled()
    expect(screen.queryByText('Pedido enviado à forja')).toBeNull()
  })

  it('a ação lança: o mesmo, com a frase da fila fora do ar', async () => {
    ask.mockRejectedValue(new Error('boom'))
    const { root, card } = mount(SEM_LEITURA, null)
    fireEvent.click(header(root))
    await flush()
    expect(header(root).textContent).toBe('Pedir leitura à forja')
    expect(root.querySelector('#askStatus')!.textContent).toBe('A fila da forja não respondeu. Tente de novo em alguns minutos.')
    expect(card()!.querySelector('ol[aria-label="Etapas do pedido"]')).toBeNull()
    // e dá para tentar de novo
    ask.mockResolvedValue({ ok: true, reason: null, results: [] })
    fireEvent.click(header(root))
    await flush()
    expect(ask).toHaveBeenCalledTimes(2)
    expect(root.querySelector('#askStatus')?.textContent ?? '').toBe('')
  })

  it('o motivo da recusa e o "Pedindo…" sobrevivem ao refresh da mesma tela e zeram ao trocar de vídeo', async () => {
    ask.mockResolvedValue({ ok: false, reason: 'não foi possível pedir agora', results: [] })
    const { root, again } = mount(SEM_LEITURA, null)
    fireEvent.click(header(root))
    await flush()
    expect(root.querySelector('#askStatus')!.textContent).toBe('Não foi possível pedir agora.')
    // o refresh traz uma tela nova para o MESMO vídeo (o Next não remonta): o motivo continua
    again(SEM_LEITURA, null)
    expect(root.querySelector('#askStatus')!.textContent).toBe('Não foi possível pedir agora.')
    // outro vídeo: zera
    const outro = SEM_LEITURA.videos.find(v => v.id !== ID && v.tracked && !SEM_LEITURA.channel(v.ch)!.own)!
    again(SEM_LEITURA, null, outro.id)
    expect(root.querySelector('#askStatus')?.textContent ?? '').not.toContain('Não foi possível pedir agora')
  })

  it('um pedido que ainda não voltou não vaza para o vídeo seguinte', async () => {
    const d = deferred<{ ok: boolean; reason: string | null; results: never[] }>()
    ask.mockReturnValue(d.p)
    const { root, again } = mount(SEM_LEITURA, null)
    fireEvent.click(header(root))
    const outro = SEM_LEITURA.videos.find(v => v.id !== ID && v.tracked && !SEM_LEITURA.channel(v.ch)!.own)!
    again(SEM_LEITURA, null, outro.id)
    expect(header(root).getAttribute('aria-busy')).not.toBe('true')
    await act(async () => { d.ok({ ok: false, reason: 'recusado lá atrás', results: [] }) })
    expect(root.querySelector('#askStatus')?.textContent ?? '').not.toContain('recusado lá atrás')
  })

  it('o botão do cartão envia o mesmo pedido que o do cabeçalho', async () => {
    const { root, card } = mount(SEM_LEITURA, null)
    fireEvent.click(header(root))
    await flush()
    const doCabecalho = ask.mock.calls[0]
    ask.mockClear()
    const botao = card()!.querySelector<HTMLElement>('[data-fj="pedir"]')!
    expect(botao.textContent).toBe('Pedir leitura deste vídeo à forja')
    fireEvent.click(botao)
    expect(ask).toHaveBeenCalledTimes(1)
    expect(ask.mock.calls[0]).toEqual(doCabecalho)
    // o do cartão não rola: já está no cartão
    expect(scrollTo).toHaveBeenCalledTimes(1)   // só a do cabeçalho
    await flush()
  })

  const comBloqueio = (leitura: boolean) => worldDb(ds => {
      if (!leitura) semLeitura(ds)
      const outro = ds.videos.find(v => v.niche === 'ia' && v.id !== ID && v.tracked)!
      ds.requests.push({ ...dbReq(ds, { state: 'na fila' }), id: 'db-lv-outro', video: outro.id, target: { kind: 'video', niche: 'ia', video: outro.id } })
  })
  it('com leitura pronta e outro vídeo do nicho na fila: o cabeçalho diz "Ver a leitura" (só rola) e o cartão guarda a mensagem de bloqueio com o link', () => {
    const { root, card } = mount(comBloqueio(true), undefined)
    expect(header(root).textContent).toBe('Ver a leitura')
    expect(header(root).getAttribute('aria-disabled')).toBeNull()
    const doCartao = card()!.querySelector('[data-fj="pedir"]')!
    expect(doCartao.getAttribute('aria-disabled')).toBe('true')
    const nota = card()!.querySelector('#' + doCartao.getAttribute('aria-describedby'))!
    expect(nota.textContent).toMatch(/^Já há uma leitura de vídeo de IA na fila · pedido \d\d:\d\d, do vídeo “.+”\.$/)
    expect(within(nota as HTMLElement).getByRole('link').getAttribute('href')).toContain('/video/')
  })
  it('apagado (outro vídeo do nicho tem pedido, sem leitura deste): aria-disabled, o motivo com o link do outro vídeo, e o clique não faz nada', () => {
    const o = worldDb(ds => {
      semLeitura(ds)
      const outro = ds.videos.find(v => v.niche === 'ia' && v.id !== ID && v.tracked)!
      ds.requests.push({ ...dbReq(ds, { state: 'na fila' }), id: 'db-lv-outro', video: outro.id, target: { kind: 'video', niche: 'ia', video: outro.id } })
    })
    const { root, card } = mount(o, undefined)
    const b = header(root)
    expect(b.textContent).toBe('Pedir leitura à forja')
    expect(b.getAttribute('aria-disabled')).toBe('true')
    expect(b.getAttribute('aria-describedby')).toBe('askStatus')
    const why = root.querySelector('#askStatus')!
    expect(why.textContent).toMatch(/^Já há uma leitura de vídeo de IA na fila · pedido \d\d:\d\d, do vídeo “.+”\.$/)
    const link = within(why as HTMLElement).getByRole('link')
    expect(link.getAttribute('href')).toContain('/video/')
    fireEvent.click(b)
    expect(ask).not.toHaveBeenCalled()
    expect(scrollTo).not.toHaveBeenCalled()
    // o cartão também diz, com o mesmo link (a mensagem de bloqueio não se perde)
    const doCartao = card()!.querySelector('[data-fj="pedir"]')!
    expect(doCartao.getAttribute('aria-disabled')).toBe('true')
    const nota = card()!.querySelector('#' + doCartao.getAttribute('aria-describedby'))!
    expect(within(nota as HTMLElement).getByRole('link').getAttribute('href')).toBe(link.getAttribute('href'))
    fireEvent.click(doCartao)
    expect(ask).not.toHaveBeenCalled()
  })
})

describe('sem pedido, sem etapa; vazio; o que não se perde', () => {
  it('apaga o estado: view sem pedido → nenhuma etapa no DOM (e a faixa de situação só existe com situação)', () => {
    const a = mount(COM_LEITURA, 'trabalhando')
    expect(a.card()!.querySelector('ol[aria-label="Etapas do pedido"]')).not.toBeNull()
    a.again(COM_LEITURA, null)
    expect(a.card()!.querySelector('ol[aria-label="Etapas do pedido"]')).toBeNull()
    expect(a.card()!.querySelector('[data-fj="cancelar"], .obs-fj-run')).toBeNull()
    a.unmount()
    const b = mount(SEM_LEITURA, null)
    expect(b.card()!.querySelector('ol')).toBeNull()
    expect(b.card()!.querySelector('.obs-fj-sit')).toBeNull()
  })

  it('o cartão sem leitura mostra a frase de vazio sob o botão aceso', () => {
    const { card } = mount(SEM_LEITURA, null)
    const pedir = card()!.querySelector<HTMLElement>('[data-fj="pedir"]')!
    expect(pedir.getAttribute('aria-disabled')).not.toBe('true')
    expect(card()!.querySelector('.obs-fj-ask')!.textContent).toContain(VAZIO)
    expect(VAZIO).toBe('Ainda não há leitura deste vídeo. Ninguém pediu uma até hoje.')
  })

  it('o bloco "o que a leitura de padrões do nicho diz sobre este título" continua quando não há leitura do vídeo', () => {
    const { card } = mount(SEM_LEITURA, null)
    const nb = card()!.querySelector('.obs-fj-nicho')!
    expect(nb.textContent).toContain('Ainda não há leitura deste vídeo. O que a leitura de padrões do nicho de 20/10 diz sobre as fórmulas deste título:')
    expect(within(nb as HTMLElement).getByRole('link', { name: 'Ver os 4 outliers' }).getAttribute('href')).toBe('/cms/youtube/competitors/outliers?fmt=long&formula=reacao-hiperbole&reading=padroes-titulo-ia-20-10&min=2')
    expect(nb.textContent).toContain('Dados enviados à forja: 368 longos até 19/10 12:00')
    // com leitura do vídeo, como hoje, o bloco não aparece
    cleanup()
    expect(mount(COM_LEITURA, null).card()!.querySelector('.obs-fj-nicho')).toBeNull()
  })

  it('canal próprio e vídeo fora dos acompanhados: como hoje (sem cartão / botão apagado com o motivo)', () => {
    const own = createTestObservatory(datasetFromOracle(loadOracleOwns('2')))
    const v = own.videos.find(x => own.channel(x.ch)!.own && x.fmt === 'long')!
    const a = mount(own, undefined, v.id)
    expect(a.view.forjaCard).toBeNull()
    expect(a.card()).toBeNull()
    expect(a.root.querySelector('#askForja')).toBeNull()
    a.unmount()
    const o = world(ds => { semLeitura(ds); ds.videos.find(x => x.id === ID)!.tracked = false })
    const b = mount(o, null)
    expect(b.card()).toBeNull()
    const bt = header(b.root)
    expect(bt.getAttribute('aria-disabled')).toBe('true')
    expect(b.root.querySelector('#askStatus')!.textContent).toMatch(/Vídeo fora dos acompanhados/)
    fireEvent.click(bt)
    expect(ask).not.toHaveBeenCalled()
  })

  it('as palavras proibidas pelo spec não aparecem em nenhuma situação da tela', () => {
    const proibidas = /\b(cota|vigia|validador|confer[eê]ncia)\b/i
    for (const s of [null, 'na fila', 'trabalhando', 'atrasado', 'sem máquina', 'nova tentativa', 'liberado pelo vigia', 'publicado', 'falhou', 'recusado (dado velho)']) {
      const { card, unmount } = mount(COM_LEITURA, s)
      const texto = (card()!.textContent ?? '') + [...card()!.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label')).join(' ')
      expect([s, texto.match(proibidas)?.[0] ?? null]).toEqual([s, null])
      unmount()
    }
  })

  it('o corpo do texto tem no mínimo 12 px e a animação só existe fora do movimento reduzido (CSS)', () => {
    const css = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src/app/cms/(authed)/youtube/competitors/_historico/forja-card.css'), 'utf8')
    expect(css).not.toMatch(/color-mix\(/)
    expect(css).not.toMatch(/z-index\s*:\s*-?\d/)
    const tamanhos = [...css.matchAll(/font(?:-size)?\s*:\s*(?:[^;}]*?\s)?(\d+(?:\.\d+)?)px/g)].map(m => Number(m[1]))
    expect(tamanhos.length).toBeGreaterThan(0)
    expect(Math.min(...tamanhos)).toBeGreaterThanOrEqual(12)
    // toda animação mora dentro de `@media (prefers-reduced-motion: no-preference)`
    const semMovimento = css.replace(/@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
    expect(semMovimento).not.toMatch(/animation\s*:/)
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{[^@]*animation\s*:/)
  })
})
