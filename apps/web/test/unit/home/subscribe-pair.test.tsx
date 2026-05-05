import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SubscribePair } from '../../../src/app/(public)/components/SubscribePair'
import type { HomeChannel } from '../../../lib/home/types'

const mockT: Record<string, string> = {
  'home.subscribe.headline': 'two ways to follow',
  'home.subscribe.subheadline': 'Pick your channel',
  'home.subscribe.nlKicker': '✉ NEWSLETTER',
  'home.subscribe.nlTitle': 'Field Notes',
  'home.subscribe.nlSubtitle': 'Stories from the trenches.',
  'home.subscribe.ytKicker': '▶ YouTube',
  'home.subscribe.ytTitle': 'On the channel',
  'home.subscribe.ytSubtitle': 'Live-coding in two languages.',
  'home.subscribe.ytSubtitle2': 'Videos in two languages.',
  'home.subscribe.readers': 'readers',
  'home.subscribe.openRate': 'open rate',
  'home.subscribe.subscribersSuffix': 'subscribers',
  'home.subscribe.scheduleNote': 'new videos weekly',
  'home.channels.youtubeSchedule': 'new every Thursday',
  'newsletter.emailPlaceholder': 'your@email.com',
  'newsletter.submit': 'Subscribe',
  'newsletter.consent': 'By subscribing you agree.',
  'channels.subscribe': 'Subscribe',
}

const newsletter = { id: 'nl-1', slug: 'field-notes', name: 'Field Notes', tagline: 'Stories', cadence: 'biweekly', color: '#FF8240', locale: 'en' }

const mockChannels: HomeChannel[] = [
  { id: 'ch1', locale: 'en', handle: '@test', url: 'https://youtube.com/@test', flag: '🌎', name: 'Test Channel', subscriberCount: 100, thumbnailUrl: null },
]

describe('SubscribePair', () => {
  it('renders newsletter card', () => {
    const { getByText } = render(<SubscribePair newsletter={newsletter} channels={mockChannels} locale="en" t={mockT} />)
    expect(getByText('Field Notes')).toBeDefined()
  })

  it('renders YouTube card when channels exist', () => {
    const { getByText } = render(<SubscribePair newsletter={newsletter} channels={mockChannels} locale="en" t={mockT} />)
    expect(getByText('On the channel')).toBeDefined()
  })

  it('hides YouTube card when no channels', () => {
    const { queryByText, getByText } = render(<SubscribePair newsletter={newsletter} channels={[]} locale="en" t={mockT} />)
    expect(getByText('Field Notes')).toBeDefined()
    expect(queryByText('On the channel')).toBeNull()
  })

  it('renders headline', () => {
    const { getByText } = render(<SubscribePair newsletter={newsletter} channels={mockChannels} locale="en" t={mockT} />)
    expect(getByText('two ways to follow')).toBeDefined()
    expect(getByText('Pick your channel')).toBeDefined()
  })
})
