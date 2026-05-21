import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TemplateSelector } from '@/app/cms/(authed)/newsletters/_tabs/test-center/template-selector'
import { en } from '@/app/cms/(authed)/newsletters/_i18n/en'

const tc = en.testCenter

describe('TemplateSelector', () => {
  it('renders 3 radio buttons with i18n labels', () => {
    render(<TemplateSelector selected="confirm" onChange={() => {}} strings={tc} hasEditions />)

    expect(screen.getByText(tc.templateConfirm)).toBeTruthy()
    expect(screen.getByText(tc.templateWelcome)).toBeTruthy()
    expect(screen.getByText(tc.templateEdition)).toBeTruthy()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('radiogroup has aria-label "Email template"', () => {
    render(<TemplateSelector selected="confirm" onChange={() => {}} strings={tc} hasEditions />)

    expect(screen.getByRole('radiogroup', { name: 'Email template' })).toBeTruthy()
  })

  it('selected radio has aria-checked="true", others "false"', () => {
    render(<TemplateSelector selected="welcome" onChange={() => {}} strings={tc} hasEditions />)

    const radios = screen.getAllByRole('radio')
    const confirm = radios.find(r => r.textContent === tc.templateConfirm)!
    const welcome = radios.find(r => r.textContent === tc.templateWelcome)!
    const edition = radios.find(r => r.textContent === tc.templateEdition)!

    expect(confirm.getAttribute('aria-checked')).toBe('false')
    expect(welcome.getAttribute('aria-checked')).toBe('true')
    expect(edition.getAttribute('aria-checked')).toBe('false')
  })

  it('clicking a radio calls onChange with template name', () => {
    const onChange = vi.fn()
    render(<TemplateSelector selected="confirm" onChange={onChange} strings={tc} hasEditions />)

    fireEvent.click(screen.getByText(tc.templateWelcome))
    expect(onChange).toHaveBeenCalledWith('welcome')
  })

  it('edition radio has aria-disabled="true" when hasEditions=false', () => {
    render(<TemplateSelector selected="confirm" onChange={() => {}} strings={tc} hasEditions={false} />)

    const edition = screen.getAllByRole('radio').find(r => r.textContent === tc.templateEdition)!
    expect(edition.getAttribute('aria-disabled')).toBe('true')
  })

  it('clicking disabled edition does NOT call onChange', () => {
    const onChange = vi.fn()
    render(<TemplateSelector selected="confirm" onChange={onChange} strings={tc} hasEditions={false} />)

    const edition = screen.getAllByRole('radio').find(r => r.textContent === tc.templateEdition)!
    fireEvent.click(edition)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disabled edition has title with noEditions text', () => {
    render(<TemplateSelector selected="confirm" onChange={() => {}} strings={tc} hasEditions={false} />)

    const edition = screen.getAllByRole('radio').find(r => r.textContent === tc.templateEdition)!
    expect(edition.getAttribute('title')).toBe(tc.noEditions)
  })
})
