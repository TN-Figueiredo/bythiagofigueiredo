// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { TrailChrome } from '@/app/cms/(authed)/youtube/competitors/_chrome/trail-chrome'

afterEach(cleanup)
const crumbs = [{ text: 'Canais', href: '/cms/youtube/competitors' }, { text: 'Leo Khev' }]

describe('TrailChrome', () => {
  it('a raiz tem data-obs; o conteúdo vai dentro da tela', () => {
    const { container } = render(<TrailChrome crumbs={crumbs}><p>miolo</p></TrailChrome>)
    const root = container.firstElementChild!
    expect(root.hasAttribute('data-obs')).toBe(true)
    expect(root.querySelector('.obs-ch-screen')!.textContent).toBe('miolo')
  })
  it('nav "Caminho": o último item sem link e com aria-current="page"; o primeiro é link', () => {
    render(<TrailChrome crumbs={crumbs}><p>x</p></TrailChrome>)
    const nav = screen.getByRole('navigation', { name: 'Caminho' })
    const items = nav.querySelectorAll('li')
    expect(items).toHaveLength(2)
    const first = items[0]!.querySelector('a')!
    expect(first.getAttribute('href')).toBe('/cms/youtube/competitors')
    expect(first.textContent).toBe('Canais')
    expect(items[1]!.querySelector('a')).toBeNull()
    expect(items[1]!.getAttribute('aria-current')).toBe('page')
    expect(items[1]!.textContent).toBe('Leo Khev')
  })
  it('moldura só com a trilha: nenhuma aba de seção nem barra de nicho', () => {
    const { container } = render(<TrailChrome crumbs={crumbs}><p>x</p></TrailChrome>)
    expect(container.querySelector('[data-obs-tabs]')).toBeNull()
    expect(container.querySelector('[data-obs-chrome]')).toBeNull()
    expect(container.querySelector('.obs-ch-niche-bar, [data-obs-niche-bar]')).toBeNull()
    expect(screen.queryByRole('tablist')).toBeNull()
  })
  it('diz que os horários são de São Paulo', () => {
    render(<TrailChrome crumbs={crumbs}><p>x</p></TrailChrome>)
    expect(screen.getByText('Horários em São Paulo')).toBeTruthy()
  })
  it('um item sem href que não é o último continua sem link (sem aria-current)', () => {
    render(<TrailChrome crumbs={[{ text: 'A' }, { text: 'B' }]}><p>x</p></TrailChrome>)
    const items = screen.getByRole('navigation', { name: 'Caminho' }).querySelectorAll('li')
    expect(items[0]!.querySelector('a')).toBeNull()
    expect(items[0]!.hasAttribute('aria-current')).toBe(false)
    expect(items[1]!.getAttribute('aria-current')).toBe('page')
  })
})
