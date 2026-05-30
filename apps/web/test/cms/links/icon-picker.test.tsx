// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Link2: icon('Link2'), Mail: icon('Mail'), BookOpen: icon('BookOpen'),
    Youtube: icon('Youtube'), Globe: icon('Globe'), Users: icon('Users'),
    Phone: icon('Phone'), Heart: icon('Heart'), Briefcase: icon('Briefcase'),
    GraduationCap: icon('GraduationCap'), Mic: icon('Mic'), Camera: icon('Camera'),
    Music: icon('Music'), ShoppingBag: icon('ShoppingBag'), Coffee: icon('Coffee'),
    Star: icon('Star'), ChevronDown: icon('ChevronDown'),
  }
})

import { IconPicker } from '@/app/cms/(authed)/links/_components/linktree/icon-picker-v2'

afterEach(() => cleanup())

describe('IconPicker', () => {
  it('renders trigger button with current icon', () => {
    const { container } = render(<IconPicker value="globe" onChange={() => {}} />)
    expect(container.querySelector('button')).toBeTruthy()
  })

  it('opens popover on click', () => {
    const { container } = render(<IconPicker value="globe" onChange={() => {}} />)
    fireEvent.click(container.querySelector('button')!)
    const grid = container.querySelector('[data-icon-grid]')
    expect(grid).toBeTruthy()
  })

  it('renders 16 icon options in grid', () => {
    const { container } = render(<IconPicker value="globe" onChange={() => {}} />)
    fireEvent.click(container.querySelector('button')!)
    const icons = container.querySelectorAll('[data-icon-option]')
    expect(icons.length).toBe(16)
  })

  it('calls onChange and closes on icon select', () => {
    const onChange = vi.fn()
    const { container } = render(<IconPicker value="globe" onChange={onChange} />)
    fireEvent.click(container.querySelector('button')!)
    const options = container.querySelectorAll('[data-icon-option]')
    fireEvent.click(options[0]!)
    expect(onChange).toHaveBeenCalled()
  })

  it('closes on Escape key', () => {
    const { container } = render(<IconPicker value="globe" onChange={() => {}} />)
    fireEvent.click(container.querySelector('button')!)
    expect(container.querySelector('[data-icon-grid]')).toBeTruthy()
    fireEvent.keyDown(container, { key: 'Escape' })
    expect(container.querySelector('[data-icon-grid]')).toBeFalsy()
  })

  it('has accessible trigger button', () => {
    const { container } = render(<IconPicker value="globe" onChange={() => {}} />)
    const btn = container.querySelector('button')
    expect(btn?.getAttribute('aria-label')).toContain('icone')
    expect(btn?.getAttribute('aria-expanded')).toBe('false')
  })

  it('sets aria-expanded=true when open', () => {
    const { container } = render(<IconPicker value="globe" onChange={() => {}} />)
    const btn = container.querySelector('button')!
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })
})
