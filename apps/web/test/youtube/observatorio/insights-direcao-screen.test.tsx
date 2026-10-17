// @vitest-environment jsdom
// E5a T9 (mockup 17c): o cartão "Quem sobe e quem desce no nicho" na tela. O texto vem todo do modelo; aqui se prova o nó da frase, a lista de 10, o painel e a URL.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { medido, naoMedido } from '@/lib/youtube/observatorio/medidas/tipos'
import type { MedidasDoSite } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-site'
import { DirecaoNicho } from '@/app/cms/(authed)/youtube/competitors/_insights/direcao-nicho'
import { direcaoDoNicho, type CanalDoNicho } from '@/app/cms/(authed)/youtube/competitors/_insights/direcao-nicho-model'

const replace = vi.fn(), refresh = vi.fn()
let busca = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh, back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/insights',
  useSearchParams: () => new URLSearchParams(busca),
}))
beforeEach(() => { replace.mockReset(); refresh.mockReset(); busca = '' })

const HOJE = '2026-10-13'
const canais = (n: number): CanalDoNicho[] => Array.from({ length: n }, (_, i) => ({ id: 'c' + i, name: 'Canal ' + String(i).padStart(2, '0'), href: '/c/' + i }))
function site(ids: string[], v: (i: number) => number | null): MedidasDoSite {
  const porCanal = new Map<string, unknown>(ids.map((id, i) => {
    const x = v(i)
    return [id, {
      m3a: x === null ? naoMedido('pouco_registro', { n: 11, fechaEm: '2026-11-27' })
        : medido({ variacao: x, direcao: 'subindo', ganhoRecente: Math.round(1000 * (1 + x)), ganhoAnterior: 1000 }, 3, { de: '2026-08-18', ate: HOJE, dias: 56 }),
      porFormato: { long: { m3b: naoMedido('poucos_videos', { n: 1, minimo: 3 }), m3c: naoMedido('poucos_videos', { n: 0, minimo: 3 }) } },
    }]
  }))
  return { porCanal, extras: { lido: false, causa: 'tempo_esgotado' }, falhas: [], esgotou: 0 } as unknown as MedidasDoSite
}
const view = (n: number, f: (i: number) => number | null, leitura: 'a' | 'b' | 'c' = 'a', seus: string[] = []) => {
  const cs = canais(n)
  return direcaoDoNicho(site(cs.map(c => c.id), f), cs, { leitura, hojeSP: HOJE, nicho: 'Viagem', seusCanais: seus })
}
const CSS = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src/app/cms/(authed)/youtube/competitors/_insights/direcao-nicho.css'), 'utf8')

describe('DirecaoNicho', () => {
  it('trocar a leitura reescreve a frase no mesmo nó aria-live (o nó não é recriado)', () => {
    const { rerender } = render(<DirecaoNicho v={view(4, i => 0.3 - i * 0.2)} />)
    const antes = document.querySelector('p[aria-live="polite"]')!
    expect(antes.getAttribute('aria-live')).toBe('polite')
    const span = antes.querySelector('span[data-frase]')!
    rerender(<DirecaoNicho v={view(4, i => 0.3 - i * 0.2, 'b')} />)
    const depois = document.querySelector('p[aria-live="polite"]')!
    expect(depois).toBe(antes)
    expect(depois.querySelector('span[data-frase]')).toBe(span)
    expect(span.textContent).toMatch(/Nenhum canal do nicho Viagem tem medida nas views do vídeo típico/)
  })
  it('o seletor é um grupo com aria-pressed, e clicar escreve ?leitura= na URL (a leitura "a" tira o parâmetro)', () => {
    busca = 'niche=viagem&leitura=b'
    render(<DirecaoNicho v={view(3, i => i * 0.2, 'b')} />)
    const grupo = screen.getByRole('group', { name: 'Leitura da direção' })
    const botoes = within(grupo).getAllByRole('button')
    expect(botoes.map(b => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false'])
    fireEvent.click(botoes[2]!)
    expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors/insights?niche=viagem&leitura=c', { scroll: false })
    fireEvent.click(botoes[0]!)
    expect(replace).toHaveBeenLastCalledWith('/cms/youtube/competitors/insights?niche=viagem', { scroll: false })
  })
  it('mostra 10 linhas e "Mostrar mais N"', () => {
    render(<DirecaoNicho v={view(14, i => 1 - i * 0.05)} />)
    expect(document.querySelectorAll('li.q-li').length).toBe(10)
    fireEvent.click(screen.getByText('Mostrar mais 4'))
    expect(document.querySelectorAll('li.q-li').length).toBe(14)
    expect(screen.queryByText(/Mostrar mais/)).toBeNull()
  })
  it('"As 3 leituras" abre o painel com a principal marcada e as outras em contorno', () => {
    render(<DirecaoNicho v={view(2, i => 0.3 - i * 0.6)} />)
    const botao = document.querySelectorAll('button.q-mais')[0]!
    expect(botao.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(botao)
    expect(botao.getAttribute('aria-expanded')).toBe('true')
    const painel = document.getElementById(botao.getAttribute('aria-controls')!)!
    expect(painel.querySelectorAll('li').length).toBe(3)
    expect(painel.querySelector('li.pr')!.textContent).toContain('a que ordena a régua')
    expect(painel.querySelectorAll('.q-sy.vz').length + painel.querySelectorAll('li:not(.pr) .q-mot').length).toBe(2)
  })
  it('a trilha de cada canal é uma imagem com o nome acessível por extenso; a posição de quem não tem medida é "sem posição"', () => {
    render(<DirecaoNicho v={view(3, i => (i === 2 ? null : 0.3 - i * 0.6))} />)
    expect(screen.getByRole('img', { name: 'Canal 00: subindo +30%. 1º de 2 medidos.' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Canal 02: não medido, fecha em 27/11. Sem posição.' })).toBeTruthy()
    expect(screen.getByText('sem posição')).toBeTruthy()
  })
  it('o seu canal é uma linha final "fora desta régua" com o ⓘ', () => {
    render(<DirecaoNicho v={view(3, i => 0.3 - i * 0.2, 'a', ['tnFigueiredo'])} />)
    const seu = document.querySelector('[data-seu-canal]')!
    expect(seu.textContent).toContain('seu canal · tnFigueiredo · fora desta régua')
    expect(within(seu as HTMLElement).getByLabelText('Por que o seu canal não aparece')).toBeTruthy()
  })
  it('erro: aviso com "Tentar de novo" que recarrega, sem barra, sem eixo e sem ⓘ no título', () => {
    render(<DirecaoNicho v={direcaoDoNicho('erro', canais(3), { leitura: 'a', hojeSP: HOJE, nicho: 'Viagem', seusCanais: [] })} />)
    expect(screen.getByRole('alert').textContent).toContain('Não deu para carregar as views dos canais deste nicho.')
    fireEvent.click(screen.getByText('Tentar de novo'))
    expect(refresh).toHaveBeenCalled()
    expect(document.querySelector('.q-cont, .q-eixo, .q-info')).toBeNull()
  })
  it('sem dado: o texto do mockup e nenhum ⓘ', () => {
    render(<DirecaoNicho v={direcaoDoNicho(site([], () => 0), [], { leitura: 'a', hojeSP: HOJE, nicho: 'Viagem', seusCanais: [] })} />)
    expect(screen.getByText('Adicione um canal de Viagem para ver quem sobe e quem desce.')).toBeTruthy()
    expect(document.querySelector('.q-info')).toBeNull()
  })
  it('o aviso do dia 18/10 aparece como parágrafo próprio, e a barra e o eixo só existem com mais de um canal', () => {
    render(<DirecaoNicho v={direcaoDoNicho(site(['c0', 'c1'], () => 0.3), canais(2), { leitura: 'a', hojeSP: '2026-10-18', nicho: 'Viagem', seusCanais: [] })} />)
    expect(document.querySelector('[data-aviso="contagem"]')!.textContent).toBe('Até 18/10, os 28 dias anteriores incluem a mudança de contagem do YouTube (24/08).')
    expect(document.querySelector('ul.q-cont')).not.toBeNull()
  })
  it('o CSS usa só tokens existentes: sem color-mix, sem z-index numérico e sem token inventado', () => {
    expect(CSS).not.toMatch(/color-mix\(/)
    expect(CSS).not.toMatch(/z-index\s*:\s*\d/)
    expect(CSS).not.toMatch(/--nm-fio/)
  })
})

describe('DirecaoNicho: HTML válido (G-1 do Gio, 17/10)', () => {
  it('renderizar o cartão não emite aviso de aninhamento (<details> dentro de <p>)', () => {
    const erros: string[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => { erros.push(a.map(String).join(' ')) })
    try {
      render(<DirecaoNicho v={view(4, i => 0.3 - i * 0.2, 'a', ['Meu'])} />)
    } finally { spy.mockRestore() }
    expect(erros.filter(e => /cannot be a descendant|hydration/i.test(e))).toEqual([])
    expect(document.querySelector('p details')).toBeNull()
  })
})

describe('DirecaoNicho: painel do ⓘ como popover ancorado (Naksu 17/10, por regra de largura: 390, 1000 e 1210 px)', () => {
  const regra = (seletor: string): string => {
    const i = CSS.indexOf(seletor + '{')
    expect(i, seletor).toBeGreaterThanOrEqual(0)
    return CSS.slice(i, CSS.indexOf('}', i))
  }
  it('o painel é absoluto, não passa da largura do cartão e fica acima das linhas posicionadas', () => {
    const r = regra('.q-info>ul')
    expect(r).toMatch(/position:absolute/)
    expect(r).toMatch(/width:min\(70ch,100%\)/) // 390 px: 100% do cartão; 1000 e 1210 px: 70ch cabe
    expect(r).toMatch(/box-sizing:border-box/)
    expect(r).toMatch(/z-index:var\(--z-conteudo\)/)
    expect(r).toMatch(/border:1px solid var\(--dim\)/)
  })
  it('o ⓘ não muda de lugar aberto ou fechado: sem quebra de linha no flex, âncora no cartão', () => {
    expect(CSS).not.toMatch(/\.q-info\[open\]\{[^}]*flex-basis/)
    expect(CSS).not.toMatch(/\.q-cap\{flex-wrap/)
    expect(regra('.q-info')).toMatch(/position:static/)
    expect(regra('.q-cap,.q-seu')).toMatch(/position:relative/)
  })
  it('alvo de 44 px a 390 px (tela estreita ou toque) e foco visível no summary', () => {
    const media = CSS.slice(CSS.indexOf('@media (max-width:640px),(pointer:coarse){', CSS.indexOf('.q-ocw')))
    expect(media).toMatch(/\.q-info>summary\{min-width:44px;min-height:44px/)
    expect(regra('.q-info>summary:focus-visible')).toMatch(/outline:2px solid/)
  })
  it('a barra "estável" a 0% continua visível, e o texto só para leitor de tela tem uma definição por faixa de largura', () => {
    expect(regra('.q-bar-0')).toMatch(/min-width:3px/)
    expect((CSS.match(/clip:rect\(0 0 0 0\)/g) ?? []).length).toBe(2)
  })
})
