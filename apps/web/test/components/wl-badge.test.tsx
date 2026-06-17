import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { WlBadge } from '../../src/app/cms/(authed)/waitlists/_components/wl-badge'

const CASES = [
  ['draft', 'Draft', 'wl-draft'],
  ['open', 'Open', 'wl-open'],
  ['closed', 'Closed', 'wl-closed'],
  ['launching', 'Launching', 'wl-launching'],
  ['launched', 'Launched', 'wl-launched'],
  ['failed', 'Failed', 'wl-failed'],
] as const

describe('WlBadge', () => {
  it.each(CASES)('renders %s → label "%s" + class %s + dot', (status, label, cls) => {
    const { container } = render(<WlBadge status={status} />)
    const badge = container.querySelector('.wl-badge')
    expect(badge).not.toBeNull()
    expect(badge).toHaveClass(cls)
    expect(badge?.textContent).toContain(label)
    expect(badge?.querySelector('.wl-dot')).not.toBeNull()
  })

  it('pulses the dot only for launching (reduced-motion handled in CSS)', () => {
    const { container: launching } = render(<WlBadge status="launching" />)
    expect(launching.querySelector('.wl-dot')).toHaveClass('wl-pulse')

    const { container: open } = render(<WlBadge status="open" />)
    expect(open.querySelector('.wl-dot')).not.toHaveClass('wl-pulse')
  })

  it('applies the lg modifier when requested', () => {
    const { container } = render(<WlBadge status="open" lg />)
    expect(container.querySelector('.wl-badge')).toHaveClass('lg')
  })
})
