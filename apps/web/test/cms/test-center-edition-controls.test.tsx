import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditionControls } from '@/app/cms/(authed)/newsletters/_tabs/test-center/edition-controls'
import { en } from '@/app/cms/(authed)/newsletters/_i18n/en'

const tc = en.testCenter

const TYPES = [
  { id: 't1', name: 'Weekly Digest', color: '#FF8240' },
  { id: 't2', name: 'Dev Notes', color: '#3b82f6' },
]

const EDITIONS = [
  { id: 'ed-1', subject: 'First Edition', status: 'draft' },
  { id: 'ed-2', subject: 'Second Edition', status: 'ready' },
]

function renderControls(overrides: Record<string, unknown> = {}) {
  const defaults = {
    types: TYPES,
    selectedTypeId: null as string | null,
    selectedEditionId: null as string | null,
    onTypeChange: vi.fn(),
    onEditionChange: vi.fn(),
    editions: EDITIONS,
    strings: tc,
    disabled: false,
  }
  const props = { ...defaults, ...overrides }
  return { ...render(<EditionControls {...props} />), props }
}

describe('EditionControls', () => {
  it('type dropdown has placeholder + all type names as options', () => {
    renderControls()

    const typeSelect = screen.getByLabelText(tc.selectType) as HTMLSelectElement
    const options = Array.from(typeSelect.options)
    expect(options[0].textContent).toBe(tc.selectType)
    expect(options[1].textContent).toBe('Weekly Digest')
    expect(options[2].textContent).toBe('Dev Notes')
  })

  it('edition dropdown shows i18n-mapped status labels', () => {
    renderControls()

    const editionSelect = screen.getByLabelText(tc.selectEdition) as HTMLSelectElement
    const options = Array.from(editionSelect.options)
    expect(options[1].textContent).toContain(tc.statusDraft)
    expect(options[2].textContent).toContain(tc.statusReady)
  })

  it('changing type calls onTypeChange AND onEditionChange(null)', () => {
    const { props } = renderControls()

    fireEvent.change(screen.getByLabelText(tc.selectType), { target: { value: 't1' } })
    expect(props.onTypeChange).toHaveBeenCalledWith('t1')
    expect(props.onEditionChange).toHaveBeenCalledWith(null)
  })

  it('resetting type to placeholder calls onTypeChange(null)', () => {
    const { props } = renderControls({ selectedTypeId: 't1' })

    fireEvent.change(screen.getByLabelText(tc.selectType), { target: { value: '' } })
    expect(props.onTypeChange).toHaveBeenCalledWith(null)
    expect(props.onEditionChange).toHaveBeenCalledWith(null)
  })

  it('changing edition calls onEditionChange with edition id', () => {
    const { props } = renderControls()

    fireEvent.change(screen.getByLabelText(tc.selectEdition), { target: { value: 'ed-1' } })
    expect(props.onEditionChange).toHaveBeenCalledWith('ed-1')
  })

  it('both selects have disabled attribute when disabled=true', () => {
    renderControls({ disabled: true })

    expect((screen.getByLabelText(tc.selectType) as HTMLSelectElement).disabled).toBe(true)
    expect((screen.getByLabelText(tc.selectEdition) as HTMLSelectElement).disabled).toBe(true)
  })

  it('edition select disabled + shows noEditions when editions empty', () => {
    renderControls({ editions: [] })

    const editionSelect = screen.getByLabelText(tc.selectEdition) as HTMLSelectElement
    expect(editionSelect.disabled).toBe(true)
    expect(editionSelect.options[0].textContent).toBe(tc.noEditions)
  })

  it('long subject (61 chars) truncated with Unicode ellipsis', () => {
    const longSubject = 'A'.repeat(61)
    renderControls({ editions: [{ id: 'ed-long', subject: longSubject, status: 'draft' }] })

    const editionSelect = screen.getByLabelText(tc.selectEdition) as HTMLSelectElement
    const option = editionSelect.options[1]
    expect(option.textContent).toContain('…')
    expect(option.textContent).not.toContain(longSubject)
  })

  it('unknown status falls back to raw status string', () => {
    renderControls({ editions: [{ id: 'ed-x', subject: 'Scheduled One', status: 'scheduled' }] })

    const editionSelect = screen.getByLabelText(tc.selectEdition) as HTMLSelectElement
    expect(editionSelect.options[1].textContent).toContain('scheduled')
  })
})
