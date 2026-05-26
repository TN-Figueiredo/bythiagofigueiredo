// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

describe('UpNextSuggestion', () => {
  it('returns null when text is empty', async () => {
    const { UpNextSuggestion } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/up-next-suggestion'
    )
    const { container } = render(
      <UpNextSuggestion text="" linkHref={null} linkLabel={null} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders the suggestion text', async () => {
    const { UpNextSuggestion } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/up-next-suggestion'
    )
    render(
      <UpNextSuggestion
        text="CSS Mastery está a 1 item de ser concluída."
        linkHref={null}
        linkLabel={null}
      />,
    )
    expect(
      screen.getByText('CSS Mastery está a 1 item de ser concluída.'),
    ).toBeTruthy()
  })

  it('renders link when linkHref is provided', async () => {
    const { UpNextSuggestion } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/up-next-suggestion'
    )
    render(
      <UpNextSuggestion
        text="Você tem 3 ideias paradas."
        linkHref="/cms/pipeline"
        linkLabel="ver mais sugestões"
      />,
    )
    const link = screen.getByText('ver mais sugestões')
    expect(link).toBeTruthy()
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('/cms/pipeline')
  })

  it('does not render link when linkHref is null', async () => {
    const { UpNextSuggestion } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/up-next-suggestion'
    )
    render(
      <UpNextSuggestion
        text="Tudo em dia."
        linkHref={null}
        linkLabel={null}
      />,
    )
    expect(screen.getByText('Tudo em dia.')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('renders with background container', async () => {
    const { UpNextSuggestion } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/up-next-suggestion'
    )
    render(
      <UpNextSuggestion text="Test" linkHref="/test" linkLabel="Go" />,
    )
    expect(screen.getByTestId('suggestion-container')).toBeTruthy()
  })

  it('link has 44px minimum touch target', async () => {
    const { UpNextSuggestion } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/up-next-suggestion'
    )
    render(
      <UpNextSuggestion text="Test" linkHref="/test" linkLabel="Go" />,
    )
    const link = screen.getByText('Go')
    expect(link.className).toContain('min-h-[44px]')
  })
})
