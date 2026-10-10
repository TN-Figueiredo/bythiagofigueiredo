// @vitest-environment jsdom
// O Voltar do navegador devolve a rolagem do contêiner da casca (A1.6, achado da prova no navegador: caía no alto da grade).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'

function Harness({ useIt }: { useIt: () => void }) {
  useIt()
  return <main style={{ overflowY: 'auto' }} data-testid="rola"><div data-obs-screen="canal"><a href="/x/video/1" onClick={e => e.preventDefault()}>abrir</a></div></main>
}
async function carregar() {
  vi.resetModules()
  return (await import('@/app/cms/(authed)/youtube/competitors/_canal/use-rolagem-ao-voltar')).useRolagemAoVoltar
}
const ir = (search: string) => window.history.replaceState(null, '', '/cms/youtube/competitors/canal/abc' + search)

describe('useRolagemAoVoltar', () => {
  beforeEach(() => { cleanup(); window.sessionStorage.clear(); ir('') })

  it('guarda a rolagem ao sair por um link e a devolve quando a página volta (popstate)', async () => {
    ir('?n=40')
    const hook = await carregar()
    const a = render(<Harness useIt={hook} />)
    const rola = a.getByTestId('rola')
    rola.scrollTop = 3785
    fireEvent.click(a.getByText('abrir'))
    a.unmount()
    window.dispatchEvent(new PopStateEvent('popstate'))
    const b = render(<Harness useIt={hook} />)
    expect(b.getByTestId('rola').scrollTop).toBe(3785)
    // usada uma vez: a chave sai
    expect(window.sessionStorage.length).toBe(0)
  })

  it('uma visita nova à mesma URL (sem Voltar) abre no alto', async () => {
    ir('?n=40')
    const hook = await carregar()
    const a = render(<Harness useIt={hook} />)
    a.getByTestId('rola').scrollTop = 900
    fireEvent.click(a.getByText('abrir'))
    a.unmount()
    const b = render(<Harness useIt={hook} />)
    expect(b.getByTestId('rola').scrollTop).toBe(0)
  })

  it('outra URL (outro filtro, outro n) não herda a rolagem', async () => {
    ir('?n=40')
    const hook = await carregar()
    const a = render(<Harness useIt={hook} />)
    a.getByTestId('rola').scrollTop = 900
    fireEvent.click(a.getByText('abrir'))
    a.unmount()
    ir('?n=80')
    window.dispatchEvent(new PopStateEvent('popstate'))
    const b = render(<Harness useIt={hook} />)
    expect(b.getByTestId('rola').scrollTop).toBe(0)
  })

  it('sem sessionStorage a tela segue sem erro', async () => {
    const hook = await carregar()
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado') })
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(() => render(<Harness useIt={hook} />)).not.toThrow()
    spy.mockRestore()
  })
})
