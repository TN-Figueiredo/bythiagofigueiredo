import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { NewsletterCta } from '../../../src/components/blog/newsletter-cta'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('../../../../src/app/(public)/actions/newsletter-inline', () => ({
  subscribeNewsletterInline: vi.fn(),
}))

describe('NewsletterCta', () => {
  it('renders newsletter form with category label', () => {
    const { container } = render(<NewsletterCta category="Ensaios" locale="pt-BR" />)
    expect(container.textContent).toContain('Gostou?')
    expect(container.textContent).toContain('NEWSLETTER')
    expect(container.querySelector('input[type="email"]')).toBeTruthy()
  })

  it('renders tape decorations', () => {
    const { container } = render(<NewsletterCta category="Ensaios" locale="pt-BR" />)
    const tapes = container.querySelectorAll('[aria-hidden="true"]')
    expect(tapes.length).toBeGreaterThanOrEqual(2)
  })
})
