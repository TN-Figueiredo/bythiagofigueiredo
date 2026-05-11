// @vitest-environment happy-dom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'

afterEach(cleanup)
import { LocaleToggle } from '../../../src/app/cms/(authed)/blog/_shared/locale-toggle'

const defaultProps = {
  currentLocale: 'pt-BR',
  existingLocales: ['pt-BR'],
  supportedLocales: ['pt-BR', 'en'],
  isPostPersisted: true,
  isSaving: false,
  onSwitchLocale: vi.fn(),
  onAddLocale: vi.fn(),
}

describe('LocaleToggle', () => {
  it('renders current locale flag', () => {
    const { container } = render(<LocaleToggle {...defaultProps} />)
    // The pt-BR flag emoji 🇧🇷 should be present
    expect(container.textContent).toContain('\u{1F1E7}\u{1F1F7}')
  })

  it('shows add button for missing locale when post is persisted', () => {
    const { getByRole } = render(<LocaleToggle {...defaultProps} />)
    // "en" is missing from existingLocales, post is persisted → add button should appear
    const addBtn = getByRole('button', { name: '+ EN' })
    expect(addBtn).toBeDefined()
  })

  it('hides add button when post is NOT persisted', () => {
    const { queryByRole } = render(
      <LocaleToggle {...defaultProps} isPostPersisted={false} />
    )
    expect(queryByRole('button', { name: '+ EN' })).toBeNull()
  })

  it('calls onAddLocale when + button clicked', () => {
    const onAddLocale = vi.fn()
    const { getByRole } = render(
      <LocaleToggle {...defaultProps} onAddLocale={onAddLocale} />
    )
    fireEvent.click(getByRole('button', { name: '+ EN' }))
    expect(onAddLocale).toHaveBeenCalledWith('en')
  })

  it('shows both flags when dual locale and calls onSwitchLocale on inactive click', () => {
    const onSwitchLocale = vi.fn()
    const { container, getByRole } = render(
      <LocaleToggle
        {...defaultProps}
        existingLocales={['pt-BR', 'en']}
        onSwitchLocale={onSwitchLocale}
      />
    )
    // Both flags should be present
    expect(container.textContent).toContain('\u{1F1E7}\u{1F1F7}') // PT
    expect(container.textContent).toContain('\u{1F1FA}\u{1F1F8}') // EN
    // Click the inactive (en) locale button
    const enBtn = getByRole('button', { name: /EN/ })
    fireEvent.click(enBtn)
    expect(onSwitchLocale).toHaveBeenCalledWith('en')
  })

  it('disables toggle when isSaving is true', () => {
    const { getAllByRole } = render(
      <LocaleToggle
        {...defaultProps}
        existingLocales={['pt-BR', 'en']}
        isSaving={true}
      />
    )
    const buttons = getAllByRole('button')
    buttons.forEach((btn) => {
      expect(btn.hasAttribute('disabled')).toBe(true)
    })
  })
})
