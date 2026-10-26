// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { LabErro } from '@/app/cms/(authed)/youtube/ab-lab/_components/pagina/lab-erro'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

function Filho({ quebra }: { quebra: boolean }) {
  if (quebra) throw new Error('leitura falhou')
  return <p>página ok</p>
}
const arvore = (quebra: boolean) => <LabErro><Filho quebra={quebra} /></LabErro>

afterEach(() => { cleanup(); refresh.mockClear(); vi.restoreAllMocks() })

describe('LabErro: Tentar de novo', () => {
  it('depois do refresh a carga nova chega e a página volta (sem F5)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = render(arvore(true))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' })) })
    expect(refresh).toHaveBeenCalledTimes(1)
    r.rerender(arvore(false))
    expect(screen.getByText('página ok')).toBeTruthy()
  })
  it('se a leitura segue falhando, a tela de erro continua e o refresh foi pedido 1 vez', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(arvore(true))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' })) })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
  })
})
