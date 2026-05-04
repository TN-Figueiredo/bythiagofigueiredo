import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ChannelStrip } from '../../../src/app/(public)/components/ChannelStrip'

const mockT: Record<string, string> = {
  'channels.title': 'Watch on YouTube',
  'channels.subscribe': 'Subscribe',
  'channels.primary': 'Main',
  'channels.subscribersSuffix': 'subscribers',
}

describe('ChannelStrip', () => {
  it('renders handwriting header', () => {
    const { getByText } = render(<ChannelStrip locale="en" t={mockT} />)
    expect(getByText(/two channels/i)).toBeDefined()
  })

  it('renders both channel cards', () => {
    const { container } = render(<ChannelStrip locale="en" t={mockT} />)
    expect(container.querySelectorAll('[data-testid="channel-card"]').length).toBe(2)
  })

  it('renders subscribe buttons', () => {
    const { getAllByText } = render(<ChannelStrip locale="en" t={mockT} />)
    expect(getAllByText(/Subscribe/i).length).toBeGreaterThanOrEqual(2)
  })
})
