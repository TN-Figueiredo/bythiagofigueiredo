import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LegalShell } from '../../../src/components/legal/legal-shell'

describe('LegalShell', () => {
  it('renders children inside a <main> element', () => {
    render(
      <LegalShell locale="pt-BR" lastUpdated="2026-04-16">
        <h1>Título</h1>
        <h2>Seção</h2>
      </LegalShell>,
    )
    const main = document.querySelector('main')
    expect(main?.textContent).toContain('Título')
  })

  it('shows the last-updated footer', () => {
    render(
      <LegalShell locale="pt-BR" lastUpdated="2026-04-16">
        <h1>Doc</h1>
      </LegalShell>,
    )
    expect(screen.getByText(/2026-04-16/)).toBeTruthy()
  })

  it('renders a TOC nav when the document has h2 elements', () => {
    render(
      <LegalShell locale="pt-BR" lastUpdated="2026-04-16">
        <h1>Doc</h1>
        <h2 id="first">Seção 1</h2>
        <h2 id="second">Seção 2</h2>
      </LegalShell>,
    )
    const nav = screen.getByRole('navigation', { name: /[ií]ndice|contents/i })
    expect(nav).toBeTruthy()
  })

  it('renders a locale switcher when multiple locales are present', () => {
    render(
      <LegalShell
        locale="pt-BR"
        lastUpdated="2026-04-16"
        availableLocales={['pt-BR', 'en']}
        hrefFor={(l) => `/privacy?lang=${l}`}
      >
        <h1>Doc</h1>
      </LegalShell>,
    )
    expect(screen.getByTestId('locale-switcher')).toBeTruthy()
  })

  it('renders English footer label when locale is en', () => {
    render(
      <LegalShell locale="en" lastUpdated="2026-04-16">
        <h1>Doc</h1>
      </LegalShell>,
    )
    expect(screen.getByText(/last updated/i)).toBeTruthy()
  })
})
