// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react'

let resolvedor: (() => void) | null = null
const refresh = vi.fn(() => new Promise<void>(res => { resolvedor = res }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

import { BlocoComTentativa } from '@/app/cms/(authed)/youtube/competitors/_chrome/ausencia/tentar-de-novo'

const FRASE = 'A leitura falhou: as medidas do canal.'
const montar = (falhou: boolean, extra: { soPastilha?: boolean } = {}) => (
  <BlocoComTentativa falhou={falhou} fraseFalha={FRASE} {...extra}><span data-valor="1">42</span></BlocoComTentativa>
)
const terminar = async () => { await act(async () => { resolvedor?.(); await Promise.resolve() }) }

beforeEach(() => { cleanup(); refresh.mockClear(); resolvedor = null })

describe('BlocoComTentativa', () => {
  it('parado mostra botão e frase', () => {
    render(montar(true))
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe(FRASE)
  })
  it('pendente: Tentando…, aria-busy, aria-disabled, e clique repetido não chama refresh', async () => {
    render(montar(true))
    fireEvent.click(screen.getByRole('button'))
    const b = screen.getByRole('button')
    expect(b.textContent).toBe('Tentando…')
    expect(b.getAttribute('aria-busy')).toBe('true')
    expect(b.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByRole('status').textContent).toBe('Lendo as medidas de novo…')
    fireEvent.click(b)
    expect(refresh).toHaveBeenCalledTimes(1)
    await terminar()
  })
  it('terminou e falhou continua: "falhou de novo", botão volta; mesma frase na 3ª', async () => {
    const { rerender } = render(montar(true))
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('button'))
      await terminar()
      rerender(montar(true))
      expect(screen.getByRole('status').textContent).toBe('A leitura falhou de novo. Tente mais uma vez.')
      expect(screen.getByRole('button').textContent).toBe('Tentar de novo')
      expect(screen.getByRole('button').getAttribute('aria-disabled')).toBeNull()
    }
    expect(refresh).toHaveBeenCalledTimes(3)
  })
  it('terminou e falhou virou false: sem botão, "Medidas lidas agora." e foco no [data-valor]', async () => {
    const { rerender } = render(montar(true))
    fireEvent.click(screen.getByRole('button'))
    rerender(montar(false))
    await terminar()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Medidas lidas agora.')
    expect(document.activeElement?.getAttribute('data-valor')).toBe('1')
  })
  it('falhou=false sem tentativa: só children', () => {
    const { container } = render(montar(false))
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.textContent).toBe('42')
  })
  it('nunca role="alert"', () => {
    const { container } = render(montar(true))
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })
  it('soPastilha: falha total só o topo tem botão e há um único status', () => {
    render(<>
      <BlocoComTentativa falhou fraseFalha="Nada do canal carregou.">topo</BlocoComTentativa>
      <BlocoComTentativa falhou soPastilha fraseFalha="A leitura falhou: a">a</BlocoComTentativa>
      <BlocoComTentativa falhou soPastilha fraseFalha="A leitura falhou: b">b</BlocoComTentativa>
    </>)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })
  it('falha parcial / topo ok com bloco ainda falhou: cada bloco falho ganha o seu botão (soPastilha desligado)', () => {
    render(<>
      <BlocoComTentativa falhou={false} fraseFalha="">topo</BlocoComTentativa>
      <BlocoComTentativa falhou fraseFalha="A leitura falhou: a">a</BlocoComTentativa>
      <BlocoComTentativa falhou fraseFalha="A leitura falhou: b">b</BlocoComTentativa>
    </>)
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
})
