import { describe, it, expect } from 'vitest'
import { render, cleanup } from '@testing-library/react'
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

  it('keeps /privacy and /terms as the default related documents', () => {
    const { getByTestId } = render(
      <LegalShell locale="en" lastUpdated="2026-04-16"><p>content</p></LegalShell>
    )
    const toc = getByTestId('legal-shell-toc')
    expect(toc.querySelector('a[href="/privacy"]')?.textContent).toBe('Privacy Policy')
    expect(toc.querySelector('a[href="/terms"]')?.textContent).toBe('Terms of Service')
  })

  it('keeps the default locale switcher href at ?lang=<other>', () => {
    const { getByTestId } = render(
      <LegalShell locale="en" lastUpdated="2026-04-16"><p>content</p></LegalShell>
    )
    expect(getByTestId('legal-shell-locale-other-pt-BR').getAttribute('href')).toBe('?lang=pt-BR')
  })

  it('lets the caller rewrite the locale switcher href (preserving query params)', () => {
    const { getByTestId } = render(
      <LegalShell
        locale="en"
        lastUpdated="2026-04-16"
        localeSwitcherHref={(other) => `?code=abc&lang=${other}`}
      >
        <p>content</p>
      </LegalShell>
    )
    expect(getByTestId('legal-shell-locale-other-pt-BR').getAttribute('href')).toBe('?code=abc&lang=pt-BR')
  })

  it('hides the locale switcher when showLocaleSwitcher is false', () => {
    const { queryByTestId } = render(
      <LegalShell locale="en" lastUpdated="2026-04-16" showLocaleSwitcher={false}>
        <p>content</p>
      </LegalShell>
    )
    expect(queryByTestId('legal-shell-locale-switcher')).toBeNull()
  })

  // DESVIO do plano: as duas renderizações compartilham `document.body`, então
  // `empty.queryByTestId(...)` enxergava a `<aside>` da PRIMEIRA renderização e
  // a asserção "drops the aside" nunca podia falhar por si. `cleanup()` entre as
  // duas isola o caso vazio.
  it('renders a custom relatedDocs list and drops the aside entirely when it is empty', () => {
    const custom = render(
      <LegalShell
        locale="en"
        lastUpdated="2026-04-16"
        relatedDocs={[{ href: '/privacy', label: 'Privacy Policy' }]}
      >
        <p>content</p>
      </LegalShell>
    )
    expect(custom.getByTestId('legal-shell-toc').querySelectorAll('a')).toHaveLength(1)
    expect(custom.getByTestId('legal-shell-related-inline').querySelectorAll('a')).toHaveLength(1)

    cleanup()

    const empty = render(
      <LegalShell locale="en" lastUpdated="2026-04-16" relatedDocs={[]}><p>content</p></LegalShell>
    )
    expect(empty.queryByTestId('legal-shell-toc')).toBeNull()
    expect(empty.queryByTestId('legal-shell-related-inline')).toBeNull()
  })

  it('repeats the related documents below the article for small screens', () => {
    const { getByTestId } = render(
      <LegalShell locale="en" lastUpdated="2026-04-16"><p>content</p></LegalShell>
    )
    const inline = getByTestId('legal-shell-related-inline')
    expect(inline.className).toContain('lg:hidden')
    expect(inline.querySelectorAll('a')).toHaveLength(2)
  })
})
