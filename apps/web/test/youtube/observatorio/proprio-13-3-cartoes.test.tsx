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
  it('com o diário cheio: o cartão dos longos leva "N views por dia" (o número do modelo) e a frase do topo é a base', () => {
    const r = mountProprio({ world: mundo('cheio') })
    const comNumero = r.view.videos.videos.filter(v => v.vpdDiarioText != null)
    expect(comNumero.length).toBeGreaterThan(0)
    for (const v of comNumero) {
      const c = cartoes().find(x => x.getAttribute('data-id') === v.id)
      if (!c) continue   // o cartão pode estar além do primeiro lote
      expect(c.querySelector('.cv-vpd')!.textContent).toBe(`${v.vpdDiarioText} views por dia`)
    }
    expect(cartoes().some(c => c.querySelector('.cv-vpd'))).toBe(true)
    expect(frase()).toBe('Views por dia: média dos últimos 28 dias com medida.')
  })
  it('um Short não tem views por dia (só os longos são medidos): o cartão não leva a linha', () => {
    const r = mountProprio({ world: mundo('cheio') })
    const curto = r.view.videos.videos.find(v => v.vpdDiarioText == null)
    if (!curto) return
    const c = cartoes().find(x => x.getAttribute('data-id') === curto.id)
    if (c) expect(c.querySelector('.cv-vpd')).toBeNull()
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
