// @vitest-environment jsdom
// Decisão 75, Task 7: o Comparar e a lista de Canais desenham a forma do SEU estado. A célula escolhe a forma por `ausencia`, nunca pelo texto do motivo.
// Cadeado só no lado próprio com a prova `sem_direito`; o lado do concorrente nunca tem `.obs-au-restrito`; zero `role=alert` nas pastilhas.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { canalDe, pacoteDe, numero, type OpcoesCanal } from './par-helpers'
import { NUMEROS, type NumeroId } from '@/app/cms/(authed)/youtube/competitors/_comparar/numeros-model'
import { CompararScreen } from '@/app/cms/(authed)/youtube/competitors/_comparar/comparar-screen'
import type { CompararPack, CanalPack } from '@/app/cms/(authed)/youtube/competitors/_comparar/pack'
import { SoSeuCanal } from '@/app/cms/(authed)/youtube/competitors/_comparar/so-seu-canal'
import { Sem } from '@/app/cms/(authed)/youtube/competitors/_comparar/celulas-novas'
import { LeituraRapida } from '@/app/cms/(authed)/youtube/competitors/_comparar/leitura-rapida'
import { FRASE_ERRO_CARTAO, FRASE_NEGADO_CARTAO, type SoSeuCanalDado } from '@/app/cms/(authed)/youtube/competitors/_comparar/so-seu-canal-model'
import { VpdView } from '@/app/cms/(authed)/youtube/competitors/_canais/cells'
import type { Numero } from '@/app/cms/(authed)/youtube/competitors/_comparar/numeros-model'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => { throw new Error('a tela não usa o router') } }))
beforeEach(() => { window.history.replaceState(null, '', '/cms/youtube/competitors/comparar') })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove() })

const ALL = (v: number): OpcoesCanal['n'] => Object.fromEntries(NUMEROS.map(k => [k, v])) as OpcoesCanal['n']
const mk = (id: string, subs: number, o: OpcoesCanal = {}) => canalDe(id, { subs, ...o })

/** O pacote: `eu` (próprio) com o `vpdPorMil` na forma dada, `c1` concorrente com ele não medido. */
function pacote(vpdProprio: Numero, soSeuCanal: Record<string, SoSeuCanalDado> = {}, vpdConcorrente: Numero = numero(5)): CompararPack {
  const eu = mk('eu', 1000, { own: true, name: 'tnFigueiredo', n: { ...ALL(10), inscritos: 1000 } })
  const c1 = mk('c1', 5000, { name: 'Leo Khev', n: { ...ALL(20), inscritos: 5000 } })
  const comVpd = (c: CanalPack, v: Numero): CanalPack => ({ ...c, numeros: { ...c.numeros, vpdPorMil: v } as Record<NumeroId, Numero> })
  return { ...pacoteDe([comVpd(eu, vpdProprio), comVpd(c1, vpdConcorrente)]), soSeuCanal }
}
const nm = (ausencia: Numero['ausencia'], motivo = 'motivo do teste'): Numero => ({ ...numero(null, motivo), ausencia })
const tela = (p: CompararPack) => render(<div data-obs=""><CompararScreen pack={p} inicial={{ a: 'eu', b: 'c1' }} /></div>)
const celulaVpd = (container: HTMLElement, lado: 'cA' | 'cB') => {
  const linha = [...container.querySelectorAll('tr')].find(tr => (tr.querySelector('th')?.textContent ?? '').startsWith('Views por dia por mil inscritos'))
  return linha?.querySelector('td.' + lado) ?? null
}

describe('número a número', () => {
  it('vpd próprio com ausencia restrito: o cadeado no lado próprio, a hachura no concorrente (nunca cadeado de concorrente)', () => {
    const { container } = tela(pacote(nm('restrito')))
    const proprio = celulaVpd(container, 'cA')!
    expect(proprio.querySelector('.obs-au-restrito')).not.toBeNull()
    expect(proprio.querySelector('.obs-ch-nm')).toBeNull()
    cleanup()
    // o concorrente sem número (nao_medido): hachura, nunca cadeado
    const r = tela(pacote(numero(7), {}, nm('nao_medido'))).container
    const fora = celulaVpd(r, 'cB')!
    expect(fora.querySelector('.obs-au-restrito')).toBeNull()
    expect(fora.querySelector('.obs-ch-nm')).not.toBeNull()
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(0)
  })
  it('vpd próprio com ausencia falhou: o triângulo; sem relatório (nao_medido): a hachura de sempre', () => {
    expect(celulaVpd(tela(pacote(nm('falhou'))).container, 'cA')!.querySelector('.obs-au-falhou')).not.toBeNull()
    cleanup()
    const h = celulaVpd(tela(pacote(nm('nao_medido'))).container, 'cA')!
    expect(h.querySelector('.obs-ch-nm')).not.toBeNull()
    expect(h.querySelector('.obs-au-restrito, .obs-au-falhou')).toBeNull()
  })
  it('a leitura rápida usa o quadradinho da forma certa no item "Sem como comparar"', () => {
    const { container } = render(<LeituraRapida cores={['a', 'b'] as never} itens={[
      { simbolo: 'sem', lado: null, texto: 'x', ausencia: 'restrito' },
    ]} />)
    expect(container.querySelector('.lr-s .obs-au-q.obs-au-restrito')).not.toBeNull()
    expect(container.querySelector('.lr-s .obs-ch-nm')).toBeNull()
    cleanup()
    const r2 = render(<LeituraRapida cores={['a', 'b'] as never} itens={[{ simbolo: 'sem', lado: null, texto: 'x', ausencia: 'nao_medido' }]} />)
    expect(r2.container.querySelector('.lr-s .obs-ch-nm')).not.toBeNull()
  })
})

describe('medidas novas (Falta)', () => {
  it('nao_carregou desenha falhou (não "Não carregou" com role alert)', () => {
    const { container } = render(<Sem c={{ tipo: 'nao_carregou' }} />)
    expect(container.querySelector('.obs-au-falhou')).not.toBeNull()
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })
  it('nao_medido com ausencia restrito → cadeado; com nao_medido → hachura; a forma vem do campo, não do motivo', () => {
    const base = { tipo: 'nao_medido', motivo: 'sem_permissao', porque: 'só quem edita' } as const
    expect(render(<Sem c={{ ...base, ausencia: 'restrito' }} />).container.querySelector('.obs-au-restrito')).not.toBeNull()
    cleanup()
    const h = render(<Sem c={{ ...base, ausencia: 'nao_medido' }} />).container
    expect(h.querySelector('.obs-ch-nm')).not.toBeNull()
    expect(h.querySelector('.obs-au-restrito')).toBeNull()
  })
})

describe('cartão "Só o seu canal mede"', () => {
  const par = (p: CompararPack) => ({ a: p.canais[0]!, b: p.canais[1]! })
  const monta = (dado: SoSeuCanalDado) => {
    const p = pacote(nm('nao_medido'), { eu: dado })
    const eu = { id: 'eu', name: 'tnFigueiredo', own: true }, c1 = { id: 'c1', name: 'Leo Khev', own: false }
    return render(<div data-obs=""><SoSeuCanal pack={p} par={{ a: eu, b: c1 } as never} /></div>)
  }
  void par
  it('negado: a pastilha restrito + FRASE_NEGADO_CARTAO, sem o cadeado local (.so-cadeado) e sem role alert', () => {
    const { container } = monta({ acesso: 'negado', view: null })
    expect(container.querySelector('.so-lead .obs-au-restrito')).not.toBeNull()
    expect(container.querySelector('.so-lead')!.textContent).toContain(FRASE_NEGADO_CARTAO)
    expect(container.querySelector('.so-cadeado svg')).toBeNull()
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(0)
  })
  it('erro: a pastilha falhou + FRASE_ERRO_CARTAO, zero role alert', () => {
    const { container } = monta({ acesso: 'erro', view: null })
    expect(container.querySelector('.so-lead .obs-au-falhou')).not.toBeNull()
    expect(container.querySelector('.so-lead')!.textContent).toContain(FRASE_ERRO_CARTAO)
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(0)
  })
})

describe('lista de Canais: views por dia', () => {
  it('linha própria com vpd negado (sem_direito) → restrito; falhou → falhou; sem diário → só a frase', () => {
    const na = (ausencia?: 'restrito' | 'falhou' | 'nao_medido') => ({ kind: 'na', text: 'Só quem edita o site vê.', title: 't', ...(ausencia ? { ausencia } : {}) }) as const
    expect(render(<VpdView c={na('restrito')} />).container.querySelector('.obs-au-restrito')).not.toBeNull()
    cleanup()
    expect(render(<VpdView c={na('falhou')} />).container.querySelector('.obs-au-falhou')).not.toBeNull()
    cleanup()
    const s = render(<VpdView c={na('nao_medido')} />).container
    expect(s.querySelector('.obs-au-restrito, .obs-au-falhou')).toBeNull()
    expect(s.textContent).toContain('Só quem edita o site vê.')
  })
  it('linha de concorrente (célula sem ausencia): nunca tem pastilha de restrito', () => {
    const { container } = render(<VpdView c={{ kind: 'na', text: 'sem vídeos longos', title: 't' }} />)
    expect(container.querySelector('.obs-au-restrito, .obs-au-falhou')).toBeNull()
  })
})
