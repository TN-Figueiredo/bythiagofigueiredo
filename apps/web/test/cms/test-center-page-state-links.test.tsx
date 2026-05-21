import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageStateLinks } from '@/app/cms/(authed)/newsletters/_tabs/test-center/page-state-links'
import { en } from '@/app/cms/(authed)/newsletters/_i18n/en'

vi.mock('lucide-react', () => ({
  ExternalLink: (p: Record<string, unknown>) => <span data-testid="icon-external" {...p} />,
}))

const tc = en.testCenter

describe('PageStateLinks', () => {
  it('renders 8 confirm state links', () => {
    render(<PageStateLinks strings={tc} />)

    const confirmSection = screen.getByText(tc.confirmStates).closest('div')!
    const links = confirmSection.querySelectorAll('a')
    expect(links).toHaveLength(8)
  })

  it('renders 8 unsubscribe state links', () => {
    render(<PageStateLinks strings={tc} />)

    const unsubSection = screen.getByText(tc.unsubscribeStates).closest('div')!
    const links = unsubSection.querySelectorAll('a')
    expect(links).toHaveLength(8)
  })

  it('confirm links have correct href pattern', () => {
    render(<PageStateLinks strings={tc} />)

    const expected = ['success', 'already', 'expired', 'not_found', 'error', 'invalid', 'loading', 'error-boundary']
    for (const state of expected) {
      const link = screen.getAllByRole('link').find(a => a.getAttribute('href') === `/cms/newsletters/preview/confirm/${state}`)
      expect(link, `missing confirm link for state: ${state}`).toBeTruthy()
    }
  })

  it('unsubscribe links have correct href pattern', () => {
    render(<PageStateLinks strings={tc} />)

    const expected = ['initial', 'ok', 'already', 'not_found', 'error', 'invalid', 'loading', 'error-boundary']
    for (const state of expected) {
      const link = screen.getAllByRole('link').find(a => a.getAttribute('href') === `/cms/newsletters/preview/unsubscribe/${state}`)
      expect(link, `missing unsubscribe link for state: ${state}`).toBeTruthy()
    }
  })

  it('all 16 links have target="_blank" and rel="noopener noreferrer"', () => {
    render(<PageStateLinks strings={tc} />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(16)
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    }
  })

  it('each link has sr-only text for opensNewTab', () => {
    render(<PageStateLinks strings={tc} />)

    const srTexts = screen.getAllByText(tc.opensNewTab)
    expect(srTexts).toHaveLength(16)
    for (const el of srTexts) {
      expect(el.className).toContain('sr-only')
    }
  })
})
