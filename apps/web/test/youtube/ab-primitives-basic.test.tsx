import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VChip, Badge, InfoTip, TypeBadge } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-primitives'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return { Image: icon('Image'), Type: icon('Type'), FileText: icon('FileText'), Layers: icon('Layers') }
})

describe('VChip', () => {
  it('renders the label letter', () => { render(<VChip label="A" />); expect(screen.getByText('A')).toBeDefined() })
  it('has aria-label', () => { render(<VChip label="B" />); expect(screen.getByLabelText('Variant B')).toBeDefined() })
  it('renders as button when onClick provided', () => {
    const fn = vi.fn()
    render(<VChip label="C" onClick={fn} />)
    fireEvent.click(screen.getByRole('button'))
    expect(fn).toHaveBeenCalledOnce()
  })
  it('renders as span when no onClick', () => { const { container } = render(<VChip label="D" />); expect(container.querySelector('button')).toBeNull() })
  it('applies ring style', () => { const { container } = render(<VChip label="A" ring />); expect(container.firstElementChild?.getAttribute('style')).toContain('box-shadow') })
})

describe('Badge', () => {
  it('renders children', () => { render(<Badge>Active</Badge>); expect(screen.getByText('Active')).toBeDefined() })
  it('applies neutral tone by default', () => { const { container } = render(<Badge>X</Badge>); expect(container.firstElementChild?.className).toContain('bg-cms-surface') })
  it('applies accent tone', () => { const { container } = render(<Badge tone="accent">X</Badge>); expect(container.firstElementChild?.className).toContain('bg-cms-accent-subtle') })
  it('applies green tone', () => { const { container } = render(<Badge tone="green">X</Badge>); expect(container.firstElementChild?.className).toContain('bg-cms-green-subtle') })
  it('applies amber tone', () => { const { container } = render(<Badge tone="amber">X</Badge>); expect(container.firstElementChild?.className).toContain('bg-cms-amber-subtle') })
  it('applies live tone', () => { const { container } = render(<Badge tone="live">X</Badge>); expect(container.firstElementChild?.className).toContain('bg-cms-red-subtle') })
  it('renders dot with pulse class', () => { const { container } = render(<Badge dot>X</Badge>); expect(container.querySelector('.animate-ab-slot-pulse')).not.toBeNull() })
})

describe('InfoTip', () => {
  it('shows ? button', () => { render(<InfoTip text="Help" />); expect(screen.getByText('?')).toBeDefined() })
  it('shows tooltip on focus', () => {
    render(<InfoTip text="Explanation" />)
    fireEvent.focus(screen.getByText('?'))
    expect(screen.getByRole('tooltip')).toBeDefined()
    expect(screen.getByText('Explanation')).toBeDefined()
  })
  it('hides tooltip on Escape', () => {
    render(<InfoTip text="Help" />)
    fireEvent.focus(screen.getByText('?'))
    expect(screen.getByRole('tooltip')).toBeDefined()
    fireEvent.keyDown(screen.getByText('?').parentElement!, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
  it('has aria-describedby when open', () => {
    render(<InfoTip text="Help" />)
    fireEvent.focus(screen.getByText('?'))
    const btn = screen.getByText('?')
    expect(btn.getAttribute('aria-describedby')).toBeTruthy()
  })
  it('no aria-describedby when closed', () => {
    render(<InfoTip text="Help" />)
    expect(screen.getByText('?').getAttribute('aria-describedby')).toBeNull()
  })
  it('opens tooltip on focus', () => {
    render(<InfoTip text="Focus help" />)
    fireEvent.focus(screen.getByText('?'))
    expect(screen.getByRole('tooltip')).toBeDefined()
    expect(screen.getByText('Focus help')).toBeDefined()
  })
  it('has aria-expanded attribute', () => {
    render(<InfoTip text="Help" />)
    const btn = screen.getByText('?')
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    fireEvent.focus(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })
  it('has aria-label for screen readers', () => {
    render(<InfoTip text="Help" />)
    expect(screen.getByLabelText('More information')).toBeDefined()
  })
})

describe('Badge extras', () => {
  it('applies cowork tone', () => {
    const { container } = render(<Badge tone="cowork">X</Badge>)
    expect(container.firstElementChild?.className).toContain('bg-[var(--cms-cowork-subtle)]')
  })
})

describe('TypeBadge', () => {
  it('renders thumbnail label', () => { render(<TypeBadge type="thumbnail" />); expect(screen.getByText('Thumbnail')).toBeDefined() })
  it('renders title label', () => { render(<TypeBadge type="title" />); expect(screen.getByText('Title')).toBeDefined() })
  it('renders description label', () => { render(<TypeBadge type="description" />); expect(screen.getByText('Description')).toBeDefined() })
  it('renders combo label', () => { render(<TypeBadge type="combo" />); expect(screen.getByText('Combo')).toBeDefined() })
})
