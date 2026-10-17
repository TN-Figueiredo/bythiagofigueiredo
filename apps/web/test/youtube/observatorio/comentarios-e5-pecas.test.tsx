// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Abas } from '@/app/cms/(authed)/youtube/competitors/_chrome/comentarios/abas'
import { SecaoDeComentarios } from '@/app/cms/(authed)/youtube/competitors/_chrome/comentarios/secao'
import { Cartao } from '@/app/cms/(authed)/youtube/competitors/_chrome/comentarios/cartao'
import { EstadoDoPainel, Carregando } from '@/app/cms/(authed)/youtube/competitors/_chrome/comentarios/estados'
import { ListaDoPainel } from '@/app/cms/(authed)/youtube/competitors/_chrome/comentarios/lista'
import { estadoDeErro, secaoDeComentarios, type CartaoView, type ListaView } from '@/app/cms/(authed)/youtube/competitors/_chrome/comentarios/model'
import type { CriadorDoFio } from '@/app/cms/(authed)/youtube/competitors/_chrome/comentarios/fio-model'
import { OPCOES, cartao, dados, doze } from './comentarios-e5-secao-fixture'
import type { Marco } from '@/lib/youtube/observatorio/comentarios/tipos'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
afterEach(cleanup)

const lista = (): ListaView => {
  const p = secaoDeComentarios(dados(), OPCOES).paineis[7]
  if (p.kind !== 'lista') throw new Error('lista')
  return p
}
const cartaoComTexto = (texto: string, o = {}): CartaoView => {
  const p = secaoDeComentarios(dados({ comentarios: [{ ...cartao(1, 'curtidos', { texto, ...o }), nosMarcos: [7] as Marco[] }] }), OPCOES).paineis[7]
  if (p.kind !== 'lista') throw new Error('lista')
  return p.cartoes[0]!
}
const CRIADOR: CriadorDoFio = { nome: 'Leo', avatar: 'https://yt3.ggpht.com/leo=s88', ini: 'L', color: '#336699' }
const renderCartao = (v: CartaoView) => render(<ol><Cartao v={v} criador={CRIADOR} /></ol>)

describe('C2 · abas', () => {
  const abas = secaoDeComentarios(dados(), OPCOES).abas
  const montar = () => render(<Abas abas={abas} abertaInicial={7}><p>um</p><p>sete</p><p>trinta</p></Abas>)
  it('papéis, aba aberta e painel aria-live', () => {
    const { container } = montar()
    expect(screen.getByRole('tablist')).toBeTruthy()
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    expect(screen.getByRole('tab', { selected: true }).textContent).toContain('7 dias')
    expect(container.querySelector('[aria-live="polite"]')).toBeTruthy()
    expect(screen.getByText('sete').closest('[role="tabpanel"]')!.hasAttribute('hidden')).toBe(false)
    expect(screen.getByText('um').closest('[role="tabpanel"]')!.hasAttribute('hidden')).toBe(true)
  })
  it('a segunda linha da aba diz o estado', () => {
    montar()
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['1 dia12 guardados', '7 dias12 guardados', '30 diasfecha em 05/11'])
  })
  it('setas, Início e Fim movem a seleção e o foco', () => {
    montar()
    const tabs = screen.getAllByRole('tab')
    fireEvent.keyDown(tabs[1]!, { key: 'ArrowRight' })
    expect(tabs[2]!.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(tabs[2])
    fireEvent.keyDown(tabs[2]!, { key: 'ArrowRight' })
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(tabs[0]!, { key: 'End' })
    expect(tabs[2]!.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(tabs[2]!, { key: 'Home' })
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(tabs[0]!, { key: 'ArrowLeft' })
    expect(tabs[2]!.getAttribute('aria-selected')).toBe('true')
  })
  it('só a aba ativa entra na ordem do Tab', () => {
    montar()
    expect(screen.getAllByRole('tab').map(t => t.tabIndex)).toEqual([-1, 0, -1])
  })
})

describe('C2 · lista', () => {
  it('cinco fios por vez; o botão "Ver as outras 7" alterna para "Recolher" e o foco vai para o 6º fio', () => {
    const v = lista()
    const { container } = render(<ListaDoPainel v={v} criador={CRIADOR} />)
    expect(container.querySelector('.cd-fileira')).toBeNull()
    expect(container.querySelector('.cd-casa')).toBeNull()
    expect(container.querySelectorAll('li.cf')).toHaveLength(12)
    const visiveis = () => [...container.querySelectorAll('li.cf')].filter(e => !e.hasAttribute('hidden'))
    expect(visiveis()).toHaveLength(5)
    const mais = screen.getByRole('button', { name: 'Ver as outras 7' })
    expect(mais.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(mais)
    expect(visiveis()).toHaveLength(12)
    expect(document.activeElement?.id).toBe(v.cartoes[5]!.id)
    const menos = screen.getByRole('button', { name: 'Recolher' })
    expect(menos.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(menos)
    expect(visiveis()).toHaveLength(5)
  })
  it('o fio escondido ainda é alvo de foco (tabindex -1)', () => {
    const v = lista()
    const { container } = render(<ListaDoPainel v={v} criador={CRIADOR} />)
    const alvo = v.cartoes[9]!
    expect(container.querySelector(`#${alvo.id}`)!.hasAttribute('hidden')).toBe(true)
    expect(container.querySelector(`#${alvo.id}`)!.getAttribute('tabindex')).toBe('-1')
  })
  it('a legenda só tem os motivos que existem e os zeros vão numa frase apagada', () => {
    const { container } = render(<ListaDoPainel v={lista()} criador={CRIADOR} />)
    expect([...container.querySelectorAll('.cd-leg')].map(e => e.textContent)).toEqual(['8 mais curtidos', '4 com o criador na conversa'])
    expect(container.querySelector('.cd-zeros')!.textContent).toBe('Nenhum de canal que você acompanha nem de canal grande.')
  })
  it('o selo "Criador" aparece uma vez por resposta do criador vista (3 no fixture)', () => {
    const { container } = render(<ListaDoPainel v={lista()} criador={CRIADOR} />)
    expect(container.querySelectorAll('.cf-selo')).toHaveLength(3)
  })
  it('"Ver os N que saíram" abre os fios dos que saíram, com cf-saiu', () => {
    const cs = doze().map((c, i) => ({ ...c, nosMarcos: (i < 10 ? [1, 7] : [1]) as Marco[] }))
    const p = secaoDeComentarios(dados({ comentarios: cs }), OPCOES).paineis[7]
    if (p.kind !== 'lista') throw new Error('lista')
    const { container } = render(<ListaDoPainel v={p} criador={CRIADOR} />)
    expect(container.querySelector('.cd-cartoes-saidos')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver os 2 que saíram dos 12' }))
    const saidos = container.querySelectorAll('.cd-cartoes-saidos li.cf')
    expect(saidos).toHaveLength(2)
    for (const e of saidos) expect(e.className).toContain('cf-saiu')
  })
  it('"entrou no dia 7" aparece no fio que entrou', () => {
    const cs = doze().map((c, i) => ({ ...c, nosMarcos: (i < 11 ? [1, 7] : [7]) as Marco[] }))
    const p = secaoDeComentarios(dados({ comentarios: cs }), OPCOES).paineis[7]
    if (p.kind !== 'lista') throw new Error('lista')
    const { container } = render(<ListaDoPainel v={p} criador={CRIADOR} />)
    expect(container.querySelector('.cf-entrou')!.textContent).toBe('entrou no dia 7')
  })
})

describe('C2 · seção: a frase-resumo vem antes das abas', () => {
  it('no DOM, a frase e a barra precedem o tablist; aba aberta mostra a frase da sua idade', () => {
    const { container } = render(<SecaoDeComentarios v={secaoDeComentarios(dados(), OPCOES)} criador={CRIADOR} />)
    const frase = container.querySelector('[data-frase-resumo]')!
    const abas = container.querySelector('[role="tablist"]')!
    expect(frase.compareDocumentPosition(abas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(frase.textContent).toMatch(/^Não vimos resposta|^O criador respondeu/)
    const visiveis = () => [...container.querySelectorAll('[data-frase-resumo]')].filter((f) => !f.closest('[hidden]'))
    expect(visiveis()).toHaveLength(1)
    fireEvent.click(screen.getAllByRole('tab')[0]!)
    expect(visiveis()).toHaveLength(1)
    expect(visiveis()[0]!.textContent).toContain('com 1 dia')
  })
})

describe('C2 · texto de terceiros no DOM', () => {
  it('script e HTML aparecem como texto; nenhum script, nenhum a com href no bloco de texto', () => {
    const t = '<script>alert(1)</script> <b>negrito</b> <a href="https://x.example">clique</a> https://exemplo.example/tudo'
    const { container } = renderCartao(cartaoComTexto(t))
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('.cf-txt a')).toBeNull()
    expect(container.querySelector('.cf-txt b')).toBeNull()
    expect(container.querySelector('.cf-txt')!.textContent).toBe(t)
    expect(container.querySelector('a[href^="http"]')).toBeNull()
    expect(screen.getByText('Este comentário tem um endereço. Aqui ele é só texto, não abre.')).toBeTruthy()
  })
  it('texto em árabe: dir="auto" no bloco', () => {
    const { container } = renderCartao(cartaoComTexto('فيديو رائع، شكراً'))
    expect(container.querySelector('.cf-txt')!.getAttribute('dir')).toBe('auto')
  })
  it('endereço longo: o bloco quebra em qualquer ponto (overflow-wrap) em vez de rolar', () => {
    const css = readFileSync(path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_chrome/comentarios/fio.css'), 'utf8')
    expect(css).toMatch(/\.cf-txt\{[^}]*overflow-wrap:anywhere/)
    const { container } = renderCartao(cartaoComTexto('https://exemplo.example/' + 'a'.repeat(200)))
    expect(container.querySelector('.cf-txt')!.textContent!.length).toBeGreaterThan(200)
  })
  it('2.000 caracteres: "cortado aos 2.000 caracteres" só com a marca do dado', () => {
    const longo = 'x'.repeat(2000)
    const a = renderCartao(cartaoComTexto(longo, { cortado: true }))
    expect(a.container.querySelector('.cf-txt')!.textContent).toHaveLength(2000)
    expect(screen.getByText('cortado aos 2.000 caracteres')).toBeTruthy()
    cleanup()
    renderCartao(cartaoComTexto(longo, { cortado: false }))
    expect(screen.queryByText('cortado aos 2.000 caracteres')).toBeNull()
  })
  it('emoji e quebras de linha chegam inteiros', () => {
    const t = '🔥🇻🇳❤️\nsegunda linha\n\nterceira 👏🏽'
    const { container } = renderCartao(cartaoComTexto(t))
    expect(container.querySelector('.cf-txt')!.textContent).toBe(t)
  })
  it('"Ver tudo" só aparece se o texto passar de 4 linhas', () => {
    const alto = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(200)
    const bx = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(80)
    renderCartao(cartaoComTexto('longo'))
    const ver = screen.getByRole('button', { name: 'Ver tudo' })
    expect(ver.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(ver)
    expect(screen.getByRole('button', { name: 'Recolher' })).toBeTruthy()
    alto.mockRestore(); bx.mockRestore()
    cleanup()
    renderCartao(cartaoComTexto('curto'))
    expect(screen.queryByRole('button', { name: 'Ver tudo' })).toBeNull()
  })
})

describe('C2 · cartão', () => {
  it('nível contagem: "Texto reservado" e "Autor reservado" e nada do texto no DOM', () => {
    const base = secaoDeComentarios({ nivel: 'contagem', marcos: dados().marcos, comentarios: [{ ordem: 1, motivo: 'curtidos', curtidas: { 1: 'ainda_nao', 7: 3, 30: 'ainda_nao' }, respostas: 2, criador: 'respondeu', criadorNome: 'Leo', doCriador: false, entrouNoMarco: 7, nosMarcos: [7], saiuDoYouTubeDesde: null, faixas: { tamanho: null, razao: null } }] }, OPCOES).paineis[7]
    if (base.kind !== 'lista') throw new Error('lista')
    const { container } = renderCartao(base.cartoes[0]!)
    expect(screen.getByText('Texto reservado.')).toBeTruthy()
    expect(container.querySelector('.cf-nome')).toBeNull()
    expect(screen.getByText('O criador respondeu. O texto da resposta é reservado.')).toBeTruthy()
    expect(container.querySelector('.cf-txt')).toBeNull()
  })
  it('curtidas do marco do painel; "fora dos 12" nunca como 0', () => {
    const fora = renderCartao(cartaoComTexto('x', { curtidas: { 1: 'ainda_nao', 7: 'fora_dos_12', 30: 'ainda_nao' } }))
    expect(fora.container.querySelector('.cf-likes')!.textContent).toContain('fora dos 12')
    cleanup()
    const n = renderCartao(cartaoComTexto('x', { curtidas: { 1: 'fora_dos_12', 7: 9, 30: 'ainda_nao' } }))
    expect(n.container.querySelector('.cf-likes')!.textContent).toContain('9 com 7 dias')
  })
  it('0 respostas escreve o zero medido; 62 respostas escreve o número', () => {
    const z = renderCartao(cartaoComTexto('x', { respostas: 0 }))
    expect(z.container.querySelector('.cf-meta .obs-ch-zero')!.textContent).toBe('0')
    cleanup()
    const n = renderCartao(cartaoComTexto('x', { respostas: 62 }))
    expect(n.container.querySelector('.cf-meta')!.textContent).toContain('62 respostas')
  })
  it('saiu do YouTube: pastilha e o botão só com destino', () => {
    const v = cartaoComTexto('x', { saiuDoYouTubeDesde: '2026-10-13' })
    renderCartao(v)
    expect(screen.getByText(/Não veio mais do YouTube desde hoje \(13\/10\)/)).toBeTruthy()
    expect(screen.queryByText('Ver na fila “Saíram do YouTube”')).toBeNull()
    cleanup()
    render(<ol><Cartao v={v} criador={CRIADOR} hrefFilaSaiu="/cms/x" /></ol>)
    expect(screen.getByText('Ver na fila “Saíram do YouTube”').getAttribute('href')).toBe('/cms/x')
  })
  it('as três formas da resposta do criador', () => {
    renderCartao(cartaoComTexto('x', { criador: 'nao_vimos', respostas: 4 }))
    expect(screen.getByText(/Conferimos as 4 respostas/)).toBeTruthy()
  })
})

describe('C2 · estados', () => {
  it('erro de leitura: role alert e "Tentar de novo" que pede nova leitura', () => {
    render(<EstadoDoPainel v={estadoDeErro()} />)
    const a = screen.getByRole('alert')
    expect(a.textContent).toContain('Não deu para abrir os comentários agora.')
    expect(a.textContent).not.toContain('Nada foi apagado')
    fireEvent.click(within(a).getByRole('button', { name: 'Tentar de novo' }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })
  it('carregando: role status e aria-busy', () => {
    render(<Carregando />)
    const s = screen.getByRole('status')
    expect(s.getAttribute('aria-busy')).toBe('true')
    expect(s.textContent).toBe('Carregando os comentários guardados…')
  })
  it('coleta parada é alerta; a caminho e fecha em não são', () => {
    const s = secaoDeComentarios({ nivel: 'identidade', comentarios: [], marcos: { 1: { estado: 'coleta_parada', desdeMs: 1, semOk: true }, 7: { estado: 'a_caminho', fezEmMs: 1, ateMs: 2 }, 30: { estado: 'fecha_em', fechaEmMs: 3 } } }, OPCOES)
    const a = render(<EstadoDoPainel v={s.paineis[1] as never} />)
    expect(a.container.querySelector('[role="alert"]')).toBeTruthy()
    cleanup()
    const b = render(<EstadoDoPainel v={s.paineis[7] as never} />)
    expect(b.container.querySelector('[role="alert"]')).toBeNull()
    expect(b.container.querySelector('.cd-tom-pontilhado')).toBeTruthy()
  })
})

describe('C2 · seção montada', () => {
  it('título, ⓘ, abas e o painel aberto; sem texto de comentário no nível contagem', () => {
    render(<SecaoDeComentarios v={secaoDeComentarios(dados(), OPCOES)} criador={CRIADOR} />)
    expect(screen.getByRole('heading', { name: 'Comentários de destaque' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Como escolhemos os comentários' })).toBeTruthy()
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(3)
    expect(screen.getByText('Cálculo do Observatório sobre dados públicos do YouTube.')).toBeTruthy()
  })
})

describe('N10b · foto do autor', () => {
  it('a foto vem sem Referer, preguiçosa, e se quebrar cai na inicial do nome', () => {
    const v = cartaoComTexto('x', { autor: { tipo: 'com_identidade', nome: 'Ana', fotoUrl: 'https://exemplo.example/f.png', guardadaAte: '2026-11-01' } })
    const { container } = renderCartao(v)
    const img = container.querySelector('.cf-av img')
    expect(img?.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(img?.getAttribute('loading')).toBe('lazy')
    fireEvent.error(img as Element)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.cf-av[data-avatar="ini"] .ini')?.textContent).toBe('A')
  })
})
