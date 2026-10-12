// @vitest-environment jsdom
// A4 Tarefa 14: a comparação está em PRODUÇÃO (A3). O cartão "Só o seu canal mede" não pode mudar nada do que já existe nela. Os hashes abaixo
// foram tirados do código ANTES da Tarefa 14 (HEAD ed09733c / f0558e15: nenhum arquivo da comparação mudou entre os dois), com um pacote de mentira e relógio fixo; o HTML dos blocos existentes tem de
// continuar byte a byte igual:
//  - dois concorrentes: a tela inteira igual (o cartão não aparece e o aviso das janelas de tempo também não);
//  - canal seu × concorrente: a tela igual DEPOIS de tirar o que a Tarefa 14 acrescenta (o cartão e o aviso das duas janelas).
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { render, cleanup } from '@testing-library/react'
import { canalDe, pacoteDe, type OpcoesCanal } from './par-helpers'
import { NUMEROS } from '@/app/cms/(authed)/youtube/competitors/_comparar/numeros-model'
import { CompararScreen } from '@/app/cms/(authed)/youtube/competitors/_comparar/comparar-screen'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => { throw new Error('a tela não usa o router') } }))

const ALL = (v: number): OpcoesCanal['n'] => Object.fromEntries(NUMEROS.map(k => [k, v])) as OpcoesCanal['n']
const mk = (id: string, subs: number | null, o: OpcoesCanal = {}) => canalDe(id, { subs, ...o })
const PACK = pacoteDe([
  mk('eu', 1000, { own: true, name: 'tnFigueiredo', n: { ...ALL(10), inscritos: 1000, vpd: 2.4, vpdPorMil: 2.4, inscritos30: null, trocas30: null }, motivos: { inscritos30: 'sem contagem de 30 dias atrás', trocas30: 'as trocas do seu canal ficam no A/B Lab' } }),
  mk('c1', 5000, { name: 'Leo Khev', n: { ...ALL(20), inscritos: 5000 } }),
  mk('c2', 3000, { name: 'Ana Viaja', n: { ...ALL(10), inscritos: 3000 } }),
  mk('c3', 120, { name: 'Beto Rota', n: { ...ALL(12), inscritos: 120 } }),
  mk('ia1', 2000, { name: 'Edu IA', niche: 'ia', nicheLabel: 'IA', n: { ...ALL(30), inscritos: 2000 } }),
])

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
function htmlDaTela(a: string, b: string): string {
  window.history.replaceState(null, '', `/cms/youtube/competitors/comparar?a=${a}&b=${b}`)
  const { container } = render(<div data-obs=""><CompararScreen pack={PACK} inicial={{ a, b }} /></div>)
  // o que a Tarefa 14 acrescenta: o cartão e o aviso das duas janelas de tempo
  container.querySelectorAll('[data-so-seu-canal], [data-janelas-aviso]').forEach(e => e.remove())
  return container.innerHTML
}
/** Os ids do `useId` (`_r_2_`) dependem de quantos componentes montaram antes: o cartão (que tem ⓘ) desloca a contagem. Cada um vira o número da ordem em que aparece. */
function semIdsDoReact(html: string): string {
  const ordem = new Map<string, number>()
  return html.replace(/_r_[0-9a-z]+_/g, t => { if (!ordem.has(t)) ordem.set(t, ordem.size); return `_r_${ordem.get(t)}_` })
}

// hashes do HTML do código de antes da Tarefa 14 (f0558e15)
// (as de dois concorrentes: o HTML cru; as com canal seu: o HTML com os ids do `useId` renumerados, porque o cartão, que tem ⓘ, desloca a contagem)
const ESPERADO = {
  'c1×c2': '79208876e1e7aef6b04173a80fb2593248e8bbe4ac0cc193cec10bcc7a8da093',
  'c3×ia1': 'a555f3c4208c3e5136ba8adacf137a17dfdd102fe067af6a47a3737040d382dc',
  'eu×c1': '7d644163ef988351f3040a41738da4356e72c8deb173ad870ed68fa4d788b562',
  'c1×eu': '54a5f11614f028f999905baa9a0ff362dc62884069111921f13558a6ee7291fd',
} as const

beforeEach(() => { window.history.replaceState(null, '', '/cms/youtube/competitors/comparar') })
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.getElementById('flut')?.remove() })

describe('14 compatibilidade: o que já existe na comparação não muda', () => {
  for (const [par, hash] of Object.entries(ESPERADO)) {
    const [a, b] = par.split('×') as [string, string]
    const proprio = par.includes('eu')
    it(`${par}: o HTML dos blocos existentes tem o mesmo hash de antes da Tarefa 14`, () => {
      const html = htmlDaTela(a, b)
      expect(html.length).toBeGreaterThan(2000) // a tela montou de verdade
      expect(sha(proprio ? semIdsDoReact(html) : html)).toBe(hash)
    })
  }
  it('dois concorrentes: o cartão não existe no DOM e o aviso das janelas de tempo também não (nada foi removido pelo teste)', () => {
    window.history.replaceState(null, '', '/cms/youtube/competitors/comparar?a=c1&b=c2')
    const { container } = render(<div data-obs=""><CompararScreen pack={PACK} inicial={{ a: 'c1', b: 'c2' }} /></div>)
    expect(container.querySelector('[data-so-seu-canal]')).toBeNull()
    expect(container.querySelector('[data-janelas-aviso]')).toBeNull()
    expect(container.textContent).not.toMatch(/Só o seu canal mede|As duas janelas de tempo/)
  })
})
