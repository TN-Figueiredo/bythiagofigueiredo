import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '@/components/cms/ui/status-badge'

describe('StatusBadge', () => {
  it('renders variant label by default', () => {
    render(<StatusBadge variant="draft" />)
    expect(screen.getByText('draft')).toBeDefined()
  })

  it('renders custom label', () => {
    render(<StatusBadge variant="published" label="Live" />)
    expect(screen.getByText('Live')).toBeDefined()
  })

  it('applies correct color classes for each variant', () => {
    const { container } = render(<StatusBadge variant="failed" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('text-cms-red')
    expect(el.className).toContain('bg-cms-red-subtle')
  })
})
