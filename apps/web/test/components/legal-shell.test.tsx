import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LegalShell } from '../../src/components/legal/legal-shell'

describe('<LegalShell>', () => {
  it('renders the compiled MDX children inside an <article>', () => {
    const { getByTestId, container } = render(
      <LegalShell locale="pt-BR" lastUpdated="2026-04-16">
        <h1>Política de Privacidade</h1>
        <p>Conteúdo renderizado aqui.</p>
      </LegalShell>
    )
    const article = getByTestId('legal-shell-article')
    expect(article.tagName.toLowerCase()).toBe('article')
    expect(article.textContent).toContain('Política de Privacidade')
    expect(container.querySelector('h1')?.textContent).toBe('Política de Privacidade')
  })

  it('marks the current locale with aria-current and links to the other locale', () => {
    const { getByTestId } = render(
      <LegalShell locale="pt-BR" lastUpdated="2026-04-16">
        <p>content</p>
      </LegalShell>
    )
    const current = getByTestId('legal-shell-locale-current-pt-BR')
    expect(current.getAttribute('aria-current')).toBe('true')
    const other = getByTestId('legal-shell-locale-other-en')
    expect(other.tagName.toLowerCase()).toBe('a')
    expect(other.getAttribute('href')).toBe('?lang=en')
    expect(other.getAttribute('hreflang')).toBe('en')
  })

  it('renders English labels when locale is en', () => {
    const { getByTestId } = render(
      <LegalShell locale="en" lastUpdated="2026-04-16">
        <p>content</p>
      </LegalShell>
    )
    const lastUpdated = getByTestId('legal-shell-last-updated')
    expect(lastUpdated.textContent).toContain('Last updated')
    const home = getByTestId('legal-shell-home-link')
    expect(home.textContent).toContain('Back to home')
  })

  it('exposes lastUpdated via a <time> element for machine-readability', () => {
    const { container } = render(
      <LegalShell locale="pt-BR" lastUpdated="2026-04-16">
        <p>content</p>
      </LegalShell>
    )
    const timeEl = container.querySelector('time')
    expect(timeEl?.getAttribute('datetime')).toBe('2026-04-16')
  })

  it('sets lang attribute on the root wrapper for a11y', () => {
    const { getByTestId } = render(
      <LegalShell locale="en" lastUpdated="2026-04-16">
        <p>content</p>
      </LegalShell>
    )
    const shell = getByTestId('legal-shell')
    expect(shell.getAttribute('lang')).toBe('en')
  })
})
