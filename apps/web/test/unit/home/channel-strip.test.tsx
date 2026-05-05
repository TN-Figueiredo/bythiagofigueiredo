import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ChannelStrip } from '../../../src/app/(public)/components/ChannelStrip'
import type { HomeChannel } from '../../../lib/home/types'

const mockT: Record<string, string> = {
  'channels.title': 'Watch on YouTube',
  'channels.subscribe': 'Subscribe',
  'channels.primary': 'Main',
  'channels.subscribersSuffix': 'subscribers',
  'home.channels.headline': 'two channels, two languages',
  'home.channels.headlineSingle': 'one channel',
  'home.channels.subline': 'SUBSCRIBE TO ONE OR BOTH',
  'home.channels.sublineSingle': 'SUBSCRIBE',
  'home.channels.subscribe': 'Subscribe →',
  'home.channels.noSpam': 'free, no spam — cancel anytime',
  'home.channels.channelPtBr': 'PT-BR Channel',
  'home.channels.channelEn': 'EN Channel',
  'home.channels.thisLocale': 'this locale',
  'home.channels.youtubeSchedule': 'new every Thursday',
}

const mockChannels: HomeChannel[] = [
  { id: 'ch1', locale: 'pt-BR', handle: '@ptChannel', url: 'https://youtube.com/@ptChannel', flag: '🇧🇷', name: 'Canal PT', subscriberCount: 500, thumbnailUrl: null },
  { id: 'ch2', locale: 'en', handle: '@enChannel', url: 'https://youtube.com/@enChannel', flag: '🌎', name: 'EN Channel', subscriberCount: 300, thumbnailUrl: null },
]

describe('ChannelStrip', () => {
  it('returns null when no channels', () => {
    const { container } = render(<ChannelStrip channels={[]} locale="en" t={mockT} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders both channel cards', () => {
    const { container } = render(<ChannelStrip channels={mockChannels} locale="en" t={mockT} />)
    expect(container.querySelectorAll('[data-testid="channel-card"]').length).toBe(2)
  })

  it('renders subscribe buttons', () => {
    const { getAllByText } = render(<ChannelStrip channels={mockChannels} locale="en" t={mockT} />)
    expect(getAllByText(/Subscribe/i).length).toBeGreaterThanOrEqual(2)
  })
})
