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
const renderCartao = (v: CartaoView) => render(<ol><Cartao v={v} /></ol>)

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
  it('cinco cartões por vez; o botão leva o foco ao primeiro revelado e volta', () => {
    const v = lista()
    const { container } = render(<ListaDoPainel v={v} />)
    const visiveis = () => [...container.querySelectorAll('li.cd-cartao')].filter(e => !e.hasAttribute('hidden'))
    expect(visiveis()).toHaveLength(5)
    const mais = screen.getByRole('button', { name: 'Mostrar os outros 7' })
    expect(mais.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(mais)
    expect(visiveis()).toHaveLength(12)
    expect(document.activeElement?.id).toBe(v.cartoes[5]!.id)
    const menos = screen.getByRole('button', { name: 'Mostrar só os 5 primeiros' })
    expect(menos.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(menos)
    expect(visiveis()).toHaveLength(5)
  })
  it('a casa da fileira leva ao cartão, mesmo escondido (e o foco vai nele)', () => {
    const v = lista()
    const { container } = render(<ListaDoPainel v={v} />)
    const alvo = v.cartoes[9]!
    expect(container.querySelector(`#${alvo.id}`)!.hasAttribute('hidden')).toBe(true)
    fireEvent.click(container.querySelector(`a[href="#${alvo.id}"]`)!)
    expect(container.querySelector(`#${alvo.id}`)!.hasAttribute('hidden')).toBe(false)
    expect(document.activeElement?.id).toBe(alvo.id)
    expect(container.querySelector(`#${alvo.id}`)!.getAttribute('tabindex')).toBe('-1')
  })
  it('doze casas, cada uma com rótulo; as vazias são role=presentation', () => {
    const pouco = secaoDeComentarios(dados({ comentarios: doze().slice(0, 9).map(c => ({ ...c, nosMarcos: [7] as Marco[] })) }), OPCOES).paineis[7]
    if (pouco.kind !== 'lista') throw new Error('lista')
    const { container } = render(<ListaDoPainel v={pouco} />)
    const ol = container.querySelector('ol.cd-fileira')!
    expect(ol.querySelectorAll('a')).toHaveLength(9)
    expect(ol.querySelectorAll('li[role="presentation"]')).toHaveLength(3)
    expect(ol.querySelector('a')!.getAttribute('aria-label')).toMatch(/^Comentário 1 de 9, /)
  })
  it('a frase-resumo, a barra e a legenda estão no DOM', () => {
    render(<ListaDoPainel v={lista()} />)
    expect(screen.getByText(/guardamos 12 dos 100 primeiros/)).toBeTruthy()
    expect(screen.getAllByText('12 de 100').length).toBeGreaterThan(0)
    expect(screen.getByText('nenhum canal que você acompanha comentou')).toBeTruthy()
  })
  it('"Ver os N que saíram" abre os cartões dos que saíram', () => {
    const cs = doze().map((c, i) => ({ ...c, nosMarcos: (i < 10 ? [1, 7] : [1]) as Marco[] }))
    const p = secaoDeComentarios(dados({ comentarios: cs }), OPCOES).paineis[7]
    if (p.kind !== 'lista') throw new Error('lista')
    const { container } = render(<ListaDoPainel v={p} />)
    expect(container.querySelector('.cd-cartoes-saidos')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver os 2 que saíram dos 12' }))
    expect(container.querySelectorAll('.cd-cartoes-saidos li.cd-cartao')).toHaveLength(2)
  })
})

describe('C2 · texto de terceiros no DOM', () => {
  it('script e HTML aparecem como texto; nenhum script, nenhum a com href no bloco de texto', () => {
    const t = '<script>alert(1)</script> <b>negrito</b> <a href="https://x.example">clique</a> https://exemplo.example/tudo'
    const { container } = renderCartao(cartaoComTexto(t))
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('.cd-texto a')).toBeNull()
    expect(container.querySelector('.cd-texto b')).toBeNull()
    expect(container.querySelector('.cd-texto')!.textContent).toBe(t)
    expect(container.querySelector('a[href^="http"]')).toBeNull()
    expect(screen.getByText('Este comentário tem um endereço. Aqui ele é só texto, não abre.')).toBeTruthy()
  })
  it('texto em árabe: dir="auto" no bloco', () => {
    const { container } = renderCartao(cartaoComTexto('فيديو رائع، شكراً'))
    expect(container.querySelector('.cd-texto')!.getAttribute('dir')).toBe('auto')
  })
  it('endereço longo: o bloco quebra em qualquer ponto (overflow-wrap) em vez de rolar', () => {
    const css = readFileSync(path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_chrome/comentarios/comentarios.css'), 'utf8')
    expect(css).toMatch(/\.cd-texto\{[^}]*overflow-wrap:anywhere/)
    const { container } = renderCartao(cartaoComTexto('https://exemplo.example/' + 'a'.repeat(200)))
    expect(container.querySelector('.cd-texto')!.textContent!.length).toBeGreaterThan(200)
  })
  it('2.000 caracteres: "cortado aos 2.000 caracteres" só com a marca do dado', () => {
    const longo = 'x'.repeat(2000)
    const a = renderCartao(cartaoComTexto(longo, { cortado: true }))
    expect(a.container.querySelector('.cd-texto')!.textContent).toHaveLength(2000)
    expect(screen.getByText('cortado aos 2.000 caracteres')).toBeTruthy()
    cleanup()
    renderCartao(cartaoComTexto(longo, { cortado: false }))
    expect(screen.queryByText('cortado aos 2.000 caracteres')).toBeNull()
  })
  it('emoji e quebras de linha chegam inteiros', () => {
    const t = '🔥🇻🇳❤️\nsegunda linha\n\nterceira 👏🏽'
    const { container } = renderCartao(cartaoComTexto(t))
    expect(container.querySelector('.cd-texto')!.textContent).toBe(t)
  })
  it('"Ver tudo" só aparece se o texto passar de 4 linhas', () => {
    const alto = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(200)
    const bx = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(80)
    renderCartao(cartaoComTexto('longo'))
    const ver = screen.getByRole('button', { name: 'Ver tudo' })
    expect(ver.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(ver)
    expect(screen.getByRole('button', { name: 'Mostrar menos' })).toBeTruthy()
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
    expect(screen.getByText('Autor reservado')).toBeTruthy()
    expect(screen.getByText('O criador respondeu. O texto da resposta é reservado.')).toBeTruthy()
    expect(container.querySelector('.cd-texto')).toBeNull()
  })
  it('curtidas nas três idades; "fora dos 12" e "fecha em" nunca como 0', () => {
    const { container } = renderCartao(cartaoComTexto('x', { curtidas: { 1: 'fora_dos_12', 7: 9, 30: 'ainda_nao' } }))
    const t = [...container.querySelectorAll('.cd-cur')].map(e => e.textContent)
    expect(t[0]).toContain('fora dos 12')
    expect(t[2]).toContain('fecha em 05/11')
    expect(t.join(' ')).not.toMatch(/\b0\b/)
  })
  it('0 respostas escreve o zero medido; 62 respostas escreve o número', () => {
    const z = renderCartao(cartaoComTexto('x', { respostas: 0 }))
    expect(z.container.querySelector('.cd-rodape .obs-ch-zero')!.textContent).toBe('0')
    cleanup()
    const n = renderCartao(cartaoComTexto('x', { respostas: 62 }))
    expect(n.container.querySelector('.cd-rodape')!.textContent).toBe('Publicado em 07/10 · 62 respostas')
  })
  it('saiu do YouTube: pastilha e o botão só com destino', () => {
    const v = cartaoComTexto('x', { saiuDoYouTubeDesde: '2026-10-13' })
    renderCartao(v)
    expect(screen.getByText(/Não veio mais do YouTube desde hoje \(13\/10\)/)).toBeTruthy()
    expect(screen.queryByText('Ver na fila “Saíram do YouTube”')).toBeNull()
    cleanup()
    render(<ol><Cartao v={v} hrefFilaSaiu="/cms/x" /></ol>)
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
    render(<SecaoDeComentarios v={secaoDeComentarios(dados(), OPCOES)} />)
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
    const img = container.querySelector('img.cd-foto')
    expect(img?.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(img?.getAttribute('loading')).toBe('lazy')
    fireEvent.error(img as Element)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.cd-foto-inicial')?.textContent).toBe('A')
  })
})
