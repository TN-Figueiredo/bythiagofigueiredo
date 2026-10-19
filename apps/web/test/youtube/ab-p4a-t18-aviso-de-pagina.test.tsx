// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'

vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/ab-end-test-dialog', () => ({ cancelarFocoDaFaixa: () => {}, AbEndTestDialog: () => null }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/ab-pause-dialog', () => ({ AbPauseDialog: () => null }))

import { AvisoDePagina, definirAviso, useAvisoDePagina } from '@/app/cms/(authed)/youtube/ab-lab/_components/acoes-de-saida'

function Ativo({ id }: { id: string }) {
  const { setAviso } = useAvisoDePagina(id)
  return <button onClick={() => setAviso('Pausado por outro')}>dispara</button>
}
function Pagina({ id, ativo }: { id: string; ativo: boolean }) {
  return <><AvisoDePagina testId={id} />{ativo ? <Ativo id={id} /> : <p>Encerrado</p>}</>
}

afterEach(() => { act(() => definirAviso('t1', null)); cleanup(); vi.useRealTimers() })

describe('AvisoDePagina', () => {
  it('permanece quando o detalhe troca de ativo para encerrado', () => {
    const { rerender } = render(<Pagina id="t1" ativo />)
    act(() => { screen.getByText('dispara').click() })
    expect(screen.getByText('Pausado por outro')).toBeTruthy()
    rerender(<Pagina id="t1" ativo={false} />)
    expect(screen.getByText('Encerrado')).toBeTruthy()
    expect(screen.getByText('Pausado por outro').closest('[role="status"]')).toBeTruthy()
  })
  it('some em 6 s', () => {
    vi.useFakeTimers()
    render(<Pagina id="t1" ativo />)
    act(() => { screen.getByText('dispara').click() })
    act(() => { vi.advanceTimersByTime(6_100) })
    expect(screen.queryByText('Pausado por outro')).toBeNull()
  })
  it('aviso fixo não some em 6 s e fecha no botão', () => {
    vi.useFakeTimers()
    render(<AvisoDePagina testId="t1" />)
    act(() => { definirAviso('t1', 'Recarregue a página', { fixo: true }) })
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(screen.getByText('Recarregue a página')).toBeTruthy()
    act(() => { screen.getByLabelText('Fechar aviso').click() })
    expect(screen.queryByText('Recarregue a página')).toBeNull()
  })
  it('não aparece em outro teste', () => {
    const { rerender } = render(<Pagina id="t1" ativo />)
    act(() => { screen.getByText('dispara').click() })
    rerender(<Pagina id="t2" ativo={false} />)
    expect(screen.queryByText('Pausado por outro')).toBeNull()
    rerender(<Pagina id="t1" ativo={false} />)
    expect(screen.queryByText('Pausado por outro')).toBeNull()
  })
})
