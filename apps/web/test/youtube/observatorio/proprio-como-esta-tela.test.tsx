// @vitest-environment jsdom
// A4 Tarefa 10: a TELA da seção "Como o canal está" (spec 16.5, mockup canal.js `painel()`). O modelo tem os seus testes; aqui se prova o que o
// navegador faz: recolhida por padrão, `?painel=` abre e fecha, a escolha lembrada em localStorage (com try/catch), o formulário "Comparar com…"
// (GET, duas paradas de Tab, mudar o select NÃO navega), o gráfico montado de verdade dentro da seção e a ressincronização quando só a query muda
// (Next 16 não remonta). Estados com dado vêm da fixture do canal próprio.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup, fireEvent, act } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import userEvent from '@testing-library/user-event'
import { renderToString } from 'react-dom/server'
import { link } from '@/lib/youtube/observatorio/links'
import { ComoEsta } from '@/app/cms/(authed)/youtube/competitors/_proprio/como-esta'
import { montarComoEsta } from '@/app/cms/(authed)/youtube/competitors/_proprio/como-esta-model'
import { buildProprioHeader } from '@/app/cms/(authed)/youtube/competitors/_proprio/header-model'
import { concorrentesDoSite, posicaoDoSite } from '@/app/cms/(authed)/youtube/competitors/_proprio/posicao-do-site'
import type { DadosDoCanal } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'
import { alcanceVazio, proprioWorld } from './proprio-fixture'

const W = proprioWorld()
const { posicao } = posicaoDoSite(W.obs, W.canalId)
const HEADER = buildProprioHeader(W.obs, W.canalId, W.dados, { hoje: W.hoje, dm: W.dm, posicao, muitosProprios: false })!
const VIDEOS = W.obs.videos.filter(x => x.ch === W.canalId).map(x => ({ id: x.id, ytId: x.ytId, title: x.title, thumb: null }))
const CHAVE = 'obs:como-esta:' + W.canalId

function secao(dados: DadosDoCanal = W.dados, o: { semConcorrente?: boolean; hoje?: string } = {}) {
  return montarComoEsta({
    dados, hoje: o.hoje ?? W.hoje, dm: W.dm, posicao, posicaoItens: HEADER.posicaoItens, videos: VIDEOS,
    concorrentes: o.semConcorrente ? [] : concorrentesDoSite(W.obs, W.canalId), canalId: W.canalId,
  })
}
type Props = Parameters<typeof ComoEsta>[0]
function montar(o: { painel?: Props['painel']; dados?: DadosDoCanal; semConcorrente?: boolean; hoje?: string } = {}) {
  const s = secao(o.dados, o)
  const props = (painel: Props['painel']): Props => ({ view: s.view, grafico: s.grafico, painel, canalId: W.canalId })
  const r = render(<ComoEsta {...props(o.painel ?? null)} />)
  return { ...r, ...s, props, rerenderCom: (painel: Props['painel']) => r.rerender(<ComoEsta {...props(painel)} />) }
}
const botao = () => screen.getByRole('button', { name: /Como o canal está/ })
const corpo = () => document.querySelector<HTMLElement>('.pn-b')!
const aberto = () => botao().getAttribute('aria-expanded') === 'true'

// O jsdom desta suíte não traz um localStorage inteiro (o do Node vem sem arquivo): um armazenamento de mentira, que também sabe falhar
let store = new Map<string, string>()
const falha = { ler: false, gravar: false }
const armazenamento = {
  getItem: (k: string) => { if (falha.ler) throw new Error('bloqueado'); return store.get(k) ?? null },
  setItem: (k: string, v: string) => { if (falha.gravar) throw new Error('cheio'); store.set(k, v) },
  removeItem: (k: string) => { store.delete(k) },
  clear: () => store.clear(),
}
beforeEach(() => { store = new Map(); falha.ler = false; falha.gravar = false; vi.stubGlobal('localStorage', armazenamento); window.history.replaceState(null, '', '/') })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.getElementById('flut')?.remove() })

describe('T10 recolhida por padrão, ?painel= e a escolha lembrada', () => {
  it('recolhida por padrão: o botão diz aria-expanded=false, o corpo está escondido e só a linha de uma frase aparece', () => {
    const { view } = montar()
    expect(aberto()).toBe(false)
    expect(corpo().hasAttribute('hidden')).toBe(true)
    expect(botao().getAttribute('aria-controls')).toBe(corpo().id)
    expect(corpo().id).not.toBe('')
    expect(screen.getByText(view.recolhida)).toBeTruthy()
    // o gráfico nem é montado enquanto a seção está fechada
    expect(document.querySelector('svg.ic-svg')).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: /Como o canal está/ })).toBeTruthy()
  })

  it('?painel=1 abre: o corpo aparece com a frase do topo, o gráfico e as quatro partes', () => {
    const { view } = montar({ painel: '1' })
    expect(aberto()).toBe(true)
    expect(corpo().hasAttribute('hidden')).toBe(false)
    expect(within(corpo()).getByText(view.frase)).toBeTruthy()
    expect(document.querySelector('svg.ic-svg')).not.toBeNull()
    for (const h of ['Vídeos que mais apareceram', 'No nicho', 'O que ainda não é medido']) expect(within(corpo()).getByRole('heading', { level: 3, name: h })).toBeTruthy()
  })

  it('?painel=0 fecha MESMO com "aberta" lembrada; ?painel=1 abre mesmo com "fechada" lembrada', () => {
    store.set(CHAVE, '1')
    montar({ painel: '0' })
    expect(aberto()).toBe(false)
    cleanup()
    store.set(CHAVE, '0')
    montar({ painel: '1' })
    expect(aberto()).toBe(true)
  })

  it('sem ?painel=: vale o que a pessoa deixou; sem nada lembrado, recolhida', () => {
    store.set(CHAVE, '1')
    montar()
    expect(aberto()).toBe(true)
    cleanup()
    store.set(CHAVE, '0')
    montar()
    expect(aberto()).toBe(false)
    cleanup()
    store.set(CHAVE, 'lixo')
    montar()
    expect(aberto()).toBe(false)
  })

  it('lembra a escolha em localStorage por canal (obs:como-esta:<canalId>) e a próxima abertura a respeita', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(botao())
    expect(aberto()).toBe(true)
    expect(store.get(CHAVE)).toBe('1')
    expect(store.has('obs:como-esta:outro-canal')).toBe(false)
    await user.click(botao())
    expect(aberto()).toBe(false)
    expect(store.get(CHAVE)).toBe('0')
    await user.click(botao())
    cleanup()
    montar()
    expect(aberto()).toBe(true)
  })

  it('o clique também escreve ?painel= na URL (sem navegar) e a URL de partida vence a lembrança só em quem a trouxe', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', '/cms/youtube/competitors/canal/x?sort=imp')
    montar()
    await user.click(botao())
    const q = new URLSearchParams(window.location.search)
    expect(q.get('painel')).toBe('1')
    expect(q.get('sort')).toBe('imp')        // o resto da URL passa intacto
    await user.click(botao())
    expect(new URLSearchParams(window.location.search).get('painel')).toBe('0')
    expect(new URLSearchParams(window.location.search).get('sort')).toBe('imp')
  })

  it('com localStorage que lança (leitura e escrita): a tela funciona e fica no padrão; o clique ainda abre e fecha', async () => {
    falha.ler = true; falha.gravar = true
    const user = userEvent.setup()
    montar()
    expect(aberto()).toBe(false)
    await user.click(botao())
    expect(aberto()).toBe(true)
    await user.click(botao())
    expect(aberto()).toBe(false)
    cleanup()
    montar({ painel: '1' })
    expect(aberto()).toBe(true)
  })

  it('rerender com outro painel= (só a query mudou) atualiza o estado SEM remontar a seção', () => {
    const r = montar()
    const secao0 = document.querySelector('section.pn')!
    const btn0 = botao()
    expect(aberto()).toBe(false)
    r.rerenderCom('1')
    expect(aberto()).toBe(true)
    r.rerenderCom('0')
    expect(aberto()).toBe(false)
    r.rerenderCom('1')
    expect(aberto()).toBe(true)
    expect(document.querySelector('section.pn')).toBe(secao0)
    expect(botao()).toBe(btn0)
  })

  it('a pessoa abriu com o clique e o servidor manda a mesma query: nada muda (comparação por valor)', async () => {
    const user = userEvent.setup()
    const r = montar({ painel: '0' })
    await user.click(botao())
    expect(aberto()).toBe(true)
    r.rerenderCom('0')   // mesmo valor de antes: não é uma navegação
    expect(aberto()).toBe(true)
  })

  it('rerender sem painel= depois de ?painel=1 volta ao que a pessoa deixou', () => {
    store.set(CHAVE, '0')
    const r = montar({ painel: '1' })
    expect(aberto()).toBe(true)
    r.rerenderCom(null)
    expect(aberto()).toBe(false)
  })

  it('no servidor (sem window) nasce recolhida e não lança', () => {
    const html = renderToString(<ComoEsta view={secao().view} grafico={secao().grafico} painel={null} canalId={W.canalId} />)
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('ic-svg')
  })

  it('duas seções na página (a árvore antiga fica escondida depois do Voltar) não dividem o id de aria-controls', () => {
    const a = secao(), b = secao()
    render(<><ComoEsta view={a.view} grafico={a.grafico} painel="1" canalId="c1" /><ComoEsta view={b.view} grafico={b.grafico} painel="1" canalId="c2" /></>)
    const ids = [...document.querySelectorAll('.pn-b')].map(e => e.id)
    expect(new Set(ids).size).toBe(2)
    for (const btn of screen.getAllByRole('button', { name: /Como o canal está/ })) expect(document.getElementById(btn.getAttribute('aria-controls')!)).not.toBeNull()
  })
})

describe('T10 o React não reclama de nada (aninhamento inválido de HTML, chave faltando) ao hidratar a seção aberta', () => {
  it('?painel=1: renderToString + hydrateRoot sem console.error (um <form> dentro de <p> derrubava a hidratação no navegador)', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = secao()
    const el = <ComoEsta view={s.view} grafico={s.grafico} painel="1" canalId={W.canalId} />
    const alvo = document.createElement('div')
    document.body.appendChild(alvo)
    alvo.innerHTML = renderToString(el)
    expect(alvo.querySelector('form')).not.toBeNull()
    let raiz: ReturnType<typeof hydrateRoot> | null = null
    await act(async () => { raiz = hydrateRoot(alvo, el) })
    await act(async () => { await Promise.resolve() })
    const avisos = erro.mock.calls.map(c => String(c[0]).slice(0, 160))
    await act(async () => { raiz?.unmount() })
    alvo.remove()
    expect(avisos).toEqual([])
  })
})

describe('T10 o corpo aberto', () => {
  it('"Vídeos que mais apareceram": cada vídeo é um link para a tela do vídeo, com impressões, cliques e dias', () => {
    const { view } = montar({ painel: '1' })
    expect(view.top.length).toBeGreaterThan(0)
    const lista = within(corpo()).getByRole('list', { name: 'Vídeos que mais apareceram' })
    const itens = within(lista).getAllByRole('listitem')
    expect(itens).toHaveLength(view.top.length)
    view.top.forEach((t, i) => {
      const a = within(itens[i]!).getByRole('link')
      expect(a.getAttribute('href')).toBe(t.href)
      expect(a.textContent).toContain(t.titulo)
      expect(a.textContent).toContain(t.imp)
      expect(a.textContent).toContain(t.cliques)
      expect(a.textContent).toContain(t.dias)
    })
  })

  it('"No nicho": só o item com lista ordenada é link; os outros são texto; "Ver a lista de Canais" leva à lista', () => {
    const { view } = montar({ painel: '1' })
    const n = view.noNicho!
    const bloco = within(corpo()).getByRole('heading', { level: 3, name: 'No nicho' }).parentElement!
    expect(bloco.textContent).toContain(n.intro)
    for (const l of n.linhas) {
      expect(bloco.textContent).toContain(l.texto)
      const a = [...bloco.querySelectorAll('a')].find(x => x.textContent === l.texto)
      if (l.href) expect(a?.getAttribute('href')).toBe(l.href)
      else expect(a).toBeUndefined()
    }
    expect(within(bloco).getByRole('link', { name: 'Ver a lista de Canais' }).getAttribute('href')).toBe(n.listaHref)
  })

  it('"O que ainda não é medido": as três linhas do modelo, em lista de definições', () => {
    const { view } = montar({ painel: '1' })
    const dts = [...corpo().querySelectorAll('dl.pn-nm dt')].map(e => e.textContent)
    const dds = [...corpo().querySelectorAll('dl.pn-nm dd')].map(e => e.textContent)
    expect(dts).toEqual(view.naoMedido.map(x => x.rotulo))
    expect(dds).toEqual(view.naoMedido.map(x => x.texto))
  })

  it('o gráfico é o da Tarefa 9, montado com a view que chegou: título, resumo, tabela e as colunas', () => {
    const { grafico } = montar({ painel: '1' })
    expect(corpo().querySelector('.ic-t')!.textContent).toBe('Impressões por dia do canal')
    expect(within(corpo()).getByText(grafico.resumo!)).toBeTruthy()
    expect(document.querySelectorAll('svg.ic-svg g[data-situacao]')).toHaveLength(grafico.colunas.length)
    expect(screen.getByText('Ver como tabela')).toBeTruthy()
    expect(document.querySelectorAll('.ic-tab tbody tr')).toHaveLength(grafico.colunas.length)
  })

  it('o gráfico ganha UMA parada de Tab (role=group) e a seção não esconde o foco: botão, gráfico, links, ... na ordem do documento', async () => {
    const user = userEvent.setup()
    montar({ painel: '1' })
    await user.tab()
    expect(document.activeElement).toBe(botao())
    const grupo = document.querySelector<HTMLElement>('[role="group"]')!
    expect(grupo.getAttribute('tabindex')).toBe('0')
    expect(document.querySelectorAll('[role="group"][tabindex="0"]')).toHaveLength(1)
  })

  it('o ⓘ do gráfico traz o método e a seção diz "dia do YouTube" uma vez só (no período do gráfico)', () => {
    montar({ painel: '1' })
    const todo = corpo().textContent ?? ''
    expect(todo.match(/dia do YouTube/g)).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Como ler este gráfico' })).toBeTruthy()
  })
})

describe('T10 o formulário "Comparar com…"', () => {
  it('é GET para a comparação, com o canal em `a` (oculto) e o concorrente em `b`; select e botão são as DUAS paradas de Tab', () => {
    const { view } = montar({ painel: '1' })
    const form = corpo().querySelector('form')!
    expect(form.getAttribute('method')?.toLowerCase()).toBe('get')
    expect(form.getAttribute('action')).toBe(view.noNicho!.acao)
    expect(form.getAttribute('action')).toBe(link.comparar())
    const a = form.querySelector<HTMLInputElement>('input[type="hidden"][name="a"]')!
    expect(a.value).toBe(W.canalId)
    const select = form.querySelector('select')!
    expect(select.getAttribute('name')).toBe('b')
    expect([...select.options].map(o => ({ value: o.value, texto: o.textContent }))).toEqual(view.noNicho!.opcoes.map(o => ({ value: o.id, texto: o.name })))
    expect(select.value).toBe(view.noNicho!.opcoes[0]!.id)
    const btn = within(form).getByRole('button', { name: 'Comparar' })
    expect(btn.getAttribute('type')).toBe('submit')
    // o select tem rótulo (leitor de tela)
    expect(within(form).getByLabelText('Comparar o seu canal com um concorrente')).toBe(select)
    // exatamente dois alvos de teclado, fora o campo oculto
    expect(form.querySelectorAll('select, button, a[href], input:not([type="hidden"]), [tabindex]:not([tabindex="-1"])')).toHaveLength(2)
  })

  it('mudar o select NÃO envia o formulário nem navega (a seta num select fechado dispara change); só o botão envia', async () => {
    const user = userEvent.setup()
    montar({ painel: '1' })
    const form = corpo().querySelector('form')!
    const enviado = vi.fn((e: Event) => e.preventDefault())
    form.addEventListener('submit', enviado)
    const select = form.querySelector('select')!
    const outro = [...select.options].find(o => o.value !== select.value)!
    await user.selectOptions(select, outro.value)
    fireEvent.change(select, { target: { value: outro.value } })
    select.focus()
    await user.keyboard('{ArrowDown}')
    expect(enviado).not.toHaveBeenCalled()
    expect(window.location.pathname).not.toContain('/comparar')
    await user.click(within(form).getByRole('button', { name: 'Comparar' }))
    expect(enviado).toHaveBeenCalledTimes(1)
  })

  it('o concorrente logo acima vem escolhido e dito; sem concorrente o formulário não existe, mas as posições ficam', () => {
    const { view } = montar({ painel: '1' })
    expect(view.noNicho!.opcoes[0]!.name).toMatch(/logo acima de você/)
    cleanup()
    montar({ painel: '1', semConcorrente: true })
    expect(corpo().querySelector('form')).toBeNull()
    expect(within(corpo()).getByRole('heading', { level: 3, name: 'No nicho' })).toBeTruthy()
  })
})

describe('T10 os estados sem dado dizem o motivo (nada de "0")', () => {
  it('sem relatório (banco local): a linha, a frase e o gráfico dizem "Ainda não há relatório de alcance deste canal."; nenhum número, nenhuma lista de vídeos', () => {
    const { view } = montar({ painel: '1', dados: { alcance: { acesso: 'ok', dado: alcanceVazio(W.canalId) }, diario: W.dados.diario } })
    // a frase aparece na linha recolhida e no gráfico; o topo não a repete (seria a terceira vez seguida)
    expect(screen.getAllByText(/Ainda não há relatório de alcance deste canal\./)).toHaveLength(2)
    expect(corpo().querySelector('.pn-lead')).toBeNull()
    expect(view.top).toEqual([])
    expect(within(corpo()).getByText(view.topVazio!)).toBeTruthy()
    expect(document.querySelector('svg.ic-svg')).toBeNull()
    expect(corpo().textContent).not.toMatch(/\b0 impress|nenhuma impress/i)
  })

  it('sem permissão: só a frase de permissão; nem número do gráfico nem título de vídeo na árvore', () => {
    montar({ painel: '1', dados: { alcance: { acesso: 'negado' }, diario: { acesso: 'negado' } } })
    expect(screen.getAllByText(/Só quem edita o site vê/).length).toBeGreaterThanOrEqual(2)
    expect(document.querySelector('svg.ic-svg')).toBeNull()
    for (const v of VIDEOS) expect(document.body.textContent).not.toContain(v.title)
    expect(document.body.textContent).not.toMatch(/\d+ impress/)
  })

  it('a leitura falhou: a seção diz que falhou (nunca "sem relatório")', () => {
    montar({ painel: '1', dados: { alcance: { acesso: 'erro' }, diario: { acesso: 'erro' } } })
    expect(screen.getAllByText(/A leitura do alcance falhou agora; recarregue a página\./).length).toBeGreaterThanOrEqual(2)
    expect(document.body.textContent).not.toContain('Ainda não há relatório')
  })

  it('coleta parada: a linha recolhida diz "A coleta parou em dd/mm." (visível sem abrir)', () => {
    const { view } = montar({ hoje: '2027-01-30' })
    expect(view.recolhida).toMatch(/A coleta parou em \d\d\/\d\d\./)
    expect(screen.getByText(view.recolhida)).toBeTruthy()
  })

  it('sem permissão, as props da seção não carregam série nem número privado (o que vai ao navegador)', () => {
    const cheio = secao()
    const negado = secao({ alcance: { acesso: 'negado' }, diario: { acesso: 'negado' } })
    const json = JSON.stringify(negado)
    expect(cheio.view.top.length).toBeGreaterThan(0)
    for (const t of cheio.view.top) { expect(json).not.toContain(t.titulo); expect(json).not.toContain(t.href) }
    for (const c of cheio.grafico.colunas) { expect(json).not.toContain(c.dica); expect(json).not.toContain(c.dia) }
    expect(json).not.toMatch(/\d+ impress/)
    expect(negado.grafico.colunas).toEqual([])
    expect(negado.view.top).toEqual([])
  })
})
