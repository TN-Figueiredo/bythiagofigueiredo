// @vitest-environment jsdom
// A5 · E5a · portão Yannis m5: uma exceção de render em RiSecoes não derruba a tela Canais inteira.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException }))
import { RiFronteira } from '@/app/cms/(authed)/youtube/competitors/_canais/ri-fronteira'

afterEach(() => { cleanup(); captureException.mockClear() })
function Explode(): never { throw new Error('boom de render') }

describe('RiFronteira', () => {
  it('filho que lança: a fronteira mostra o aviso de erro e o irmão segue de pé; o erro vai ao Sentry com fingerprint', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<div><p>lista de canais</p><RiFronteira><Explode /></RiFronteira></div>)
    expect(screen.getByText('lista de canais')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('Não foi possível carregar as referências e os inscritos')
    expect(captureException).toHaveBeenCalledTimes(1)
    expect(captureException.mock.calls[0]![1]).toMatchObject({ fingerprint: ['canais-ri', 'render'] })
  })
  it('filho que não lança: passa direto', () => {
    render(<RiFronteira><p>tudo certo</p></RiFronteira>)
    expect(screen.getByText('tudo certo')).toBeTruthy()
    expect(captureException).not.toHaveBeenCalled()
  })
})
