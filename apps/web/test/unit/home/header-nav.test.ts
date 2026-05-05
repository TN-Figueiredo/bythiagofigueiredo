import { describe, it, expect } from 'vitest'
import { buildNavItems, type HeaderCurrent } from '../../../src/components/layout/header-types'

const mockT: Record<string, string> = {
  'nav.home': 'Home', 'nav.blog': 'Blog', 'nav.youtube': 'YouTube',
  'nav.newsletters': 'Newsletters', 'nav.about': 'About', 'nav.contact': 'Contact',
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

  it('uses /pt prefix for all internal links in pt-BR locale', () => {
    const items = buildNavItems('pt-BR', 'full', mockT)
    const internal = items.filter(i => !i.external)
    for (const item of internal) {
      expect(item.href, `${item.key} should start with /pt`).toMatch(/^\/pt/)
    }
  })

  it('uses bare paths for en locale', () => {
    const items = buildNavItems('en', 'full', mockT)
    const internal = items.filter(i => !i.external)
    for (const item of internal) {
      expect(item.href, `${item.key} should not start with /pt`).not.toMatch(/^\/pt/)
    }
  })

  it('about and contact hrefs are locale-aware', () => {
    const ptItems = buildNavItems('pt-BR', 'full', mockT)
    expect(ptItems.find(i => i.key === 'about')!.href).toBe('/pt/about')
    expect(ptItems.find(i => i.key === 'contact')!.href).toBe('/pt/contact')

    const enItems = buildNavItems('en', 'full', mockT)
    expect(enItems.find(i => i.key === 'about')!.href).toBe('/about')
    expect(enItems.find(i => i.key === 'contact')!.href).toBe('/contact')
  })
})
