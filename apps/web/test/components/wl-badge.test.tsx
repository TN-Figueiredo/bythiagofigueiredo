import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { WlBadge } from '../../src/app/cms/(authed)/waitlists/_components/wl-badge'

const CASES = [
  ['draft', 'Draft'],
  ['open', 'Open'],
  ['closed', 'Closed'],
  ['launching', 'Launching'],
  ['launched', 'Launched'],
  ['failed', 'Failed'],
] as const

describe('WlBadge', () => {
  it.each(CASES)('renders %s → label "%s" + dot (selectable via data-status)', (status, label) => {
    const { container } = render(<WlBadge status={status} />)
    const badge = container.querySelector(`[data-status="${status}"]`)
    expect(badge).not.toBeNull()
    expect(badge?.textContent).toContain(label)
    expect(badge?.querySelector('span[aria-hidden="true"]')).not.toBeNull()
  })

  it('pulses the dot only for launching (motion-reduce disables the animation)', () => {
    const { container: launching } = render(<WlBadge status="launching" />)
    const ldot = launching.querySelector('span[aria-hidden="true"]')
    expect(ldot).toHaveClass('animate-pulse')
    expect(ldot).toHaveClass('motion-reduce:animate-none')

    const { container: open } = render(<WlBadge status="open" />)
    expect(open.querySelector('span[aria-hidden="true"]')).not.toHaveClass('animate-pulse')
  })

  it('applies the lg modifier when requested', () => {
    const { container } = render(<WlBadge status="open" lg />)
    expect(container.querySelector('[data-status="open"]')?.className).toContain('text-[13px]')
  })
})
