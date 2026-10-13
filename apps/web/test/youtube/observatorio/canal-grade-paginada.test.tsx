// @vitest-environment jsdom
// A4, ajuste final de UX (13/10): a grade de Capas marca os cartões além da primeira página de 24 (o CSS os esconde só a 480 px ou menos) e
// mostra o botão "Mostrar mais"; o clique revela o próximo lote, anuncia, põe o foco no primeiro cartão novo e não rola a página.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, cleanup, fireEvent } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import { mountCanal, cartoes } from './canal-mount'

const push = vi.fn(), replace = vi.fn(), refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh, back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/canal/matt-wolfe',
  useSearchParams: () => new URLSearchParams(''),
}))

beforeEach(() => { push.mockReset(); replace.mockReset(); refresh.mockReset(); window.history.replaceState(null, '', '/cms/youtube/competitors/canal/matt-wolfe') })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

const ocultos = () => cartoes().filter(c => c.hasAttribute('data-pag-oculto'))
const botao = () => screen.queryByRole('button', { name: /^Mostrar / })
const css = fs.readFileSync(path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_canal/canal.css'), 'utf8')

describe('grade de Capas paginada de 24 em 24', () => {
  it('os 24 primeiros cartões ficam sem marca e os demais levam data-pag-oculto; o botão diz quantos vêm', () => {
    mountCanal()
    const todos = cartoes()
    expect(todos.length).toBeGreaterThan(48)
    expect(ocultos().length).toBe(todos.length - 24)
    expect(todos.slice(0, 24).every(c => !c.hasAttribute('data-pag-oculto'))).toBe(true)
    expect(botao()?.textContent).toBe('Mostrar mais 24 vídeos')
  })

  it('o bloco tem o grupo "Mostrar mais vídeos", a barra de progresso e "Mostrando 24 de N vídeos"', () => {
    mountCanal()
    const grupo = document.querySelector('.cv-more.cv-pag')!
    expect(grupo.getAttribute('role')).toBe('group')
    expect(grupo.getAttribute('aria-label')).toBe('Mostrar mais vídeos')
    const barra = grupo.querySelector('[role="progressbar"]')!
    expect(barra.getAttribute('aria-valuenow')).toBe('24')
    expect(grupo.textContent).toMatch(/Mostrando 24 de \d+ vídeos/)
  })

  it('clicar revela o próximo lote, anuncia no status e leva o foco ao primeiro cartão novo sem rolar', () => {
    mountCanal()
    const antes = ocultos().length
    const primeiroNovo = cartoes()[24]!.dataset.id!
    const scroll = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, writable: true, value: scroll })
    fireEvent.click(botao()!)
    expect(ocultos().length).toBe(antes - 24)
    expect((document.activeElement as HTMLElement).id).toBe('cv-lnk-' + primeiroNovo)
    expect(document.querySelector('p.cv-status')!.textContent).toMatch(/Mostrando 48 de \d+ vídeos\. 24 vídeos novos\./)
    expect(scroll).not.toHaveBeenCalled()
    delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView
  })

  it('o botão some no último lote e o foco continua num cartão (nunca no body)', () => {
    mountCanal()
    let guarda = 0
    while (botao() && guarda++ < 20) fireEvent.click(botao()!)
    expect(ocultos().length).toBe(0)
    expect(botao()).toBeNull()
    expect((document.activeElement as HTMLElement).id).toMatch(/^cv-lnk-/)
  })

  it('trocar o filtro volta para a primeira página', () => {
    mountCanal()
    fireEvent.click(botao()!)
    expect(ocultos().length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /^Shorts, / }))
    fireEvent.click(screen.getByRole('button', { name: /^Todos, / }))
    expect(cartoes().filter(c => !c.hasAttribute('data-pag-oculto')).length).toBe(24)
  })

  it('a marca só esconde a 480 px ou menos: o CSS tem a regra dentro da media query e o botão nasce escondido fora dela', () => {
    expect(css).toMatch(/\.cv-more\.cv-pag\{display:none\}/)
    expect(css).toMatch(/@media \(max-width:480px\)\{[^@]*\.cv-card,\.cv-div\)\[data-pag-oculto\][^@]*display:none/)
    expect(css).toMatch(/@media \(max-width:480px\)\{[^@]*\.cv-more\.cv-pag\{display:flex\}/)
  })
})
