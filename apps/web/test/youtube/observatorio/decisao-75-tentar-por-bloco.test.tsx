// @vitest-environment jsdom
// Decisão 75, Task 8b: "Tentar de novo" por bloco no canal de fora. Prova no degrau da página (BlocosDoCanal/TopoDoCanal reais), sem gancho no produto:
// o BlocoComTentativa fica no mesmo lugar da árvore nos dois ramos, então o estado do cliente sobrevive ao router.refresh().
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { canalWorld } from './canal-fixture'
import { buildCanalView } from '@/app/cms/(authed)/youtube/competitors/_canal/view-model'
import { canalNaoCarregou } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/canal-derivado-async'
import { BlocosDoCanal, TopoDoCanal } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/blocos-do-canal'
import type { ContextoDoCanal } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/canal-derivado'
import type { CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import { medidasFalsas } from './medidas-canal-fixture'

let resolvedor: (() => void) | null = null
const refresh = vi.fn(() => new Promise<void>(res => { resolvedor = res }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }), usePathname: () => '/x', useSearchParams: () => new URLSearchParams('') }))
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children?: ReactNode }) => <a href={href}>{children}</a> }))
beforeEach(() => { cleanup(); refresh.mockClear(); resolvedor = null })
afterEach(() => cleanup())

const AGORA = Date.UTC(2026, 9, 24, 18, 0, 0)
const ctx = (): ContextoDoCanal => {
  const { obs, chId } = canalWorld()
  const view = buildCanalView(obs, chId, {})!
  return {
    F: obs.fmt, subs: 84_000, sync: { state: 'ok', last: AGORA - 3_600_000, errorSince: null }, hojeSP: '2026-10-24', agoraMs: AGORA,
    primeiraBusca: false, semVideos: false, titulos: view.videos.videos.map(v => [v.id, v.title] as const), trocas: [],
  }
}
/** Medidas lidas por inteiro, menos as mudanças de campo: só a linha do tempo falha (falha parcial). */
const lidoComMudancas = (lido: boolean): CanalInteiro => ({
  medidas: medidasFalsas({}), videos: { lido: true, dados: [] }, retratos: { lido: true, dados: [] },
  marcas: { lido: false, causa: 'erro_do_banco' }, serie: 'nao_pedida',
  mudancas: lido ? { lido: true, dados: new Map() } : { lido: false, causa: 'erro_do_banco' }, horas: 'nao_pedida', falhas: [], esgotou: [],
} as unknown as CanalInteiro)
const terminar = async () => { await act(async () => { resolvedor?.(); await Promise.resolve() }) }

describe('Tentar de novo por bloco (decisão 75, 8b)', () => {
  it('falha total: o topo leva o botão e um role=status; os blocos ficam só com a pastilha', async () => {
    const contexto = ctx()
    const medidas = Promise.resolve(canalNaoCarregou())
    const topo = render(await TopoDoCanal({ medidas, contexto }))
    expect(topo.container.textContent).not.toMatch(/recarregue|Não carregou/i)
    expect(within(topo.container).getAllByRole('button', { name: 'Tentar de novo' })).toHaveLength(1)
    expect(topo.container.querySelectorAll('[role="status"]')).toHaveLength(1)
    expect(topo.container.textContent).toContain('A leitura falhou:')
    cleanup()
    const blocos = render(await BlocosDoCanal({ medidas, contexto }))
    expect(blocos.container.querySelectorAll('#direcao .obs-au-falhou, #lancamentos .obs-au-falhou, #tempo .obs-au-falhou, #ritmo .obs-au-falhou, #criador .obs-au-falhou').length).toBeGreaterThanOrEqual(4)
    expect(screen.queryAllByRole('button', { name: 'Tentar de novo' })).toHaveLength(0)
    expect(blocos.container.querySelectorAll('[role="status"], [role="alert"]')).toHaveLength(0)
    expect(blocos.container.textContent).not.toMatch(/recarregue|Não carregou/i)
  })

  const blocoDe = (c: HTMLElement, id: string): HTMLElement => c.querySelector(`#${id}`)!.closest('.obs-au-bloco') as HTMLElement

  it('falha parcial: a linha do tempo falha e tem o botão dela; ao ler de novo vem "Medidas lidas agora." e o foco vai ao título', async () => {
    const contexto = ctx()
    const { rerender, container } = render(await BlocosDoCanal({ medidas: Promise.resolve(lidoComMudancas(false)), contexto }))
    const tempo = within(blocoDe(container, 'tempo'))
    expect(tempo.getAllByRole('button', { name: 'Tentar de novo' })).toHaveLength(1)
    expect(blocoDe(container, 'tempo').querySelectorAll('[role="status"]')).toHaveLength(1)
    // um bloco que leu bem não ganha botão nem aviso
    expect(blocoDe(container, 'direcao').querySelector('.obs-au-retry, [role="status"]')).toBeNull()
    fireEvent.click(tempo.getByRole('button', { name: 'Tentar de novo' }))
    expect(blocoDe(container, 'tempo').querySelector('[role="status"]')!.textContent).toBe('Lendo as medidas de novo…')
    // o servidor devolve a página relida enquanto a transição ainda corre
    rerender(await BlocosDoCanal({ medidas: Promise.resolve(lidoComMudancas(true)), contexto }))
    await terminar()
    expect(blocoDe(container, 'tempo').querySelector('[role="status"]')!.textContent).toBe('Medidas lidas agora.')
    expect(document.activeElement).toBe(container.querySelector('#hTem'))
    expect(blocoDe(container, 'tempo').querySelector('.obs-au-retry')).toBeNull()
  })

  it('tentar de novo e falhar de novo: a frase muda e o botão volta, nunca fica preso em "Tentando…"', async () => {
    const contexto = ctx()
    const { rerender, container } = render(await BlocosDoCanal({ medidas: Promise.resolve(lidoComMudancas(false)), contexto }))
    fireEvent.click(within(blocoDe(container, 'tempo')).getByRole('button', { name: 'Tentar de novo' }))
    rerender(await BlocosDoCanal({ medidas: Promise.resolve(lidoComMudancas(false)), contexto }))
    await terminar()
    const tempo = blocoDe(container, 'tempo')
    expect(tempo.querySelector('[role="status"]')!.textContent).toBe('A leitura falhou de novo. Tente mais uma vez.')
    expect(within(tempo).getByRole('button', { name: 'Tentar de novo' }).getAttribute('aria-disabled')).toBeNull()
  })
})
