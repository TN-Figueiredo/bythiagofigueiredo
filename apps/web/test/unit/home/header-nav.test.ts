import { describe, it, expect } from 'vitest'
import { buildNavItems, type HeaderCurrent } from '../../../src/components/layout/header-types'

const mockT: Record<string, string> = {
  'nav.home': 'Home', 'nav.blog': 'Blog', 'nav.videos': 'Videos',
  'nav.newsletter': 'Newsletter', 'nav.about': 'About', 'nav.contact': 'Contact',
}

describe('buildNavItems', () => {
  it('includes blog key, not writing', () => {
    const items = buildNavItems('en', 'full', mockT)
    expect(items.find(i => i.key === 'blog')).toBeDefined()
    expect(items.find(i => i.key === 'writing')).toBeUndefined()
  })

  it('does not include devSite', () => {
    const items = buildNavItems('en', 'full', mockT)
    expect(items.find(i => i.key === 'devSite')).toBeUndefined()
  })

  it('HeaderCurrent type includes blog', () => {
    const current: HeaderCurrent = 'blog'
    expect(current).toBe('blog')
  })
})
