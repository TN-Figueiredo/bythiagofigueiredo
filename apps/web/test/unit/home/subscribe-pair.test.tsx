import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SubscribePair } from '../../../src/app/(public)/components/SubscribePair'

const mockT: Record<string, string> = {
  'home.subscribe.headline': 'two ways to follow',
  'home.subscribe.subheadline': 'Pick your channel',
  'home.subscribe.nlKicker': '✉ NEWSLETTER',
  'home.subscribe.nlTitle': 'Field Notes',
  'home.subscribe.nlSubtitle': 'Stories from the trenches.',
  'home.subscribe.ytKicker': '▶ YouTube',
  'home.subscribe.ytTitle': 'On the channel',
  'home.subscribe.ytSubtitle': 'Live-coding in two languages.',
  'home.subscribe.readers': 'readers',
  'home.subscribe.openRate': 'open rate',
  'newsletter.emailPlaceholder': 'your@email.com',
  'newsletter.submit': 'Subscribe',
  'newsletter.consent': 'By subscribing you agree.',
  'channels.subscribe': 'Subscribe',
  'channels.subscribersSuffix': 'subscribers',
}

const newsletter = { id: 'nl-1', name: 'Field Notes', tagline: 'Stories', cadence: 'biweekly', color: '#FF8240', locale: 'en' }

describe('SubscribePair', () => {
  it('renders both cards when newsletter exists', () => {
    const { getByText } = render(<SubscribePair newsletter={newsletter} locale="en" t={mockT} />)
    expect(getByText('Field Notes')).toBeDefined()
    expect(getByText('On the channel')).toBeDefined()
  })

  it('renders both cards even when newsletter is null (uses translation strings)', () => {
    const { getByText } = render(<SubscribePair newsletter={null} locale="en" t={mockT} />)
    expect(getByText('Field Notes')).toBeDefined()
    expect(getByText('On the channel')).toBeDefined()
  })

  it('renders headline', () => {
    const { getByText } = render(<SubscribePair newsletter={newsletter} locale="en" t={mockT} />)
    expect(getByText('two ways to follow')).toBeDefined()
    expect(getByText('Pick your channel')).toBeDefined()
  })
})
