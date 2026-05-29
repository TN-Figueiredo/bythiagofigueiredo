// @vitest-environment happy-dom
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AiBadge } from '../../src/components/cms/ai-badge'

describe('AiBadge', () => {
  it('renders "via Cowork" when source is cowork and edited is false', () => {
    render(<AiBadge source="cowork" edited={false} />)
    expect(screen.getByText('via Cowork')).toBeTruthy()
  })

  it('renders "via Cowork" when source starts with cowork (cowork-claude)', () => {
    render(<AiBadge source="cowork-claude" />)
    expect(screen.getByText('via Cowork')).toBeTruthy()
  })

  it('renders "editado" when source is cowork and edited is true', () => {
    render(<AiBadge source="cowork" edited={true} />)
    expect(screen.getByText('editado')).toBeTruthy()
  })

  it('returns null when source is null', () => {
    const { container } = render(<AiBadge source={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when source is undefined', () => {
    const { container } = render(<AiBadge />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when source is manual', () => {
    const { container } = render(<AiBadge source="manual" />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when source is empty string', () => {
    const { container } = render(<AiBadge source="" />)
    expect(container.innerHTML).toBe('')
  })

  it('applies custom className', () => {
    const { container } = render(<AiBadge source="cowork" className="ml-2" />)
    const badge = container.querySelector('span')!
    expect(badge.classList.contains('ml-2')).toBe(true)
  })

  it('has indigo color classes for AI untouched state', () => {
    const { container } = render(<AiBadge source="cowork" />)
    const badge = container.querySelector('span')!
    expect(badge.className).toContain('bg-indigo-500/15')
    expect(badge.className).toContain('text-indigo-400')
  })

  it('has amber color classes for AI edited state', () => {
    const { container } = render(<AiBadge source="cowork" edited={true} />)
    const badge = container.querySelector('span')!
    expect(badge.className).toContain('bg-amber-500/15')
    expect(badge.className).toContain('text-amber-400')
  })
})
