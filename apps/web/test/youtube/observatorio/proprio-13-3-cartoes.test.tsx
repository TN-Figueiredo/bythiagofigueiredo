// @vitest-environment jsdom
// A4 Tarefa 13.3: os cartões da aba Vídeos (mockup `cartao`): "N views por dia" quando o diário dá o número, e UMA frase no topo da grade (linha das abas)
// com a base ou com o motivo. Sem o número a linha não existe (nunca "0 views por dia" no lugar de não medido).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { proprioWorld, type CenarioDados } from './proprio-fixture'
import { mountProprio, cartoes } from './proprio-mount'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/canal/x',
  useSearchParams: () => new URLSearchParams(''),
}))
beforeEach(() => { window.history.replaceState(null, '', '/') })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove() })

const frase = () => document.querySelector('nav.ctabs p.res')!.textContent
const mundo = (cenario: CenarioDados) => proprioWorld({ cenario })

describe('13.3 cartões: views por dia', () => {
  it('com o diário cheio: o cartão dos longos leva "N views por dia" (o número do modelo), os outros não, e a frase do topo é a base', () => {
    const r = mountProprio({ world: mundo('cheio') })
    const renderizados = cartoes().map(c => ({ c, v: r.view.videos.videos.find(x => x.id === c.getAttribute('data-id'))! }))
    expect(renderizados.length).toBeGreaterThan(0)
    // todo cartão desenhado tem o seu modelo; a linha existe exatamente quando o modelo tem o número (incondicional: nenhum cartão fica de fora da conta)
    for (const { c, v } of renderizados) {
      expect(v, c.getAttribute('data-id') ?? '').toBeDefined()
      expect(c.querySelector('.cv-vpd')?.textContent ?? null).toBe(v.vpdDiarioText == null ? null : `${v.vpdDiarioText} views por dia`)
    }
    expect(renderizados.filter(x => x.v.vpdDiarioText != null).length).toBeGreaterThan(0)
    expect(frase()).toBe('Views por dia: média dos últimos 28 dias com medida.')
  })
  it('um Short não tem views por dia (só os longos são medidos): o cartão desenhado não leva a linha', () => {
    const r = mountProprio({ world: mundo('cheio') })
    const curtos = cartoes().filter(c => r.view.videos.videos.find(x => x.id === c.getAttribute('data-id'))?.isShort === true)
    expect(curtos.length).toBeGreaterThan(0)
    for (const c of curtos) expect(c.querySelector('.cv-vpd'), c.getAttribute('data-id') ?? '').toBeNull()
  })
  it('a ordem do cartão é a do mockup: views, LOGO DEPOIS "N views por dia", e só então a linha das impressões e cliques', () => {
    mountProprio({ world: mundo('cheio') })
    const completos = cartoes().filter(c => c.querySelector('.cv-vpd') && c.querySelector('.cv-n3'))
    expect(completos.length).toBeGreaterThan(0)
    for (const c of completos) {
      const filhos = [...c.children].map(x => x.className.split(' ')[0])
      const nums = filhos.indexOf('cv-nums')
      expect(nums, c.getAttribute('data-id') ?? '').toBeGreaterThanOrEqual(0)
      expect(filhos[nums + 1], 'a linha das views por dia vem colada nos números').toBe('cv-vpd')
      expect(filhos[nums + 2], 'e a das impressões e cliques depois dela').toBe('cv-n3')
    }
  })
  it.each([
    ['vazio', 'Views por dia: a coleta diária ainda não gravou este canal.'],
    ['negado', 'Views por dia: só quem edita o site vê.'],
    ['erro', 'Views por dia: a leitura falhou agora; recarregue a página.'],
    ['curto', 'Views por dia: menos de 7 dias medidos nos últimos 28.'],
  ] as const)('%s: nenhum cartão leva a linha e UMA frase no topo diz o motivo', (c, esperado) => {
    mountProprio({ world: mundo(c) })
    expect(cartoes().length).toBeGreaterThan(0)
    for (const x of cartoes()) expect(x.querySelector('.cv-vpd')).toBeNull()
    expect(frase()).toBe(esperado)
  })
  it('usuário só de leitura: o HTML dos cartões não leva nenhum "views por dia"', () => {
    const r = mountProprio({ world: mundo('negado') })
    expect(r.container.innerHTML).not.toMatch(/views por dia</)
  })
})
