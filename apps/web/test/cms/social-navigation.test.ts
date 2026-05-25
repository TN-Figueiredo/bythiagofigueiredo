import { describe, it, expect } from 'vitest'
import { buildCmsSections } from '@/app/cms/(authed)/_shared/cms-sections'

describe('buildCmsSections — Social section (v3 redesign)', () => {
  const sections = buildCmsSections()
  const social = sections.find(s => s.label === 'Social')!
  const content = sections.find(s => s.label === 'Content')!

  it('has a Social section with 4 items', () => {
    expect(social).toBeDefined()
    expect(social.items.length).toBe(4)
  })

  it('includes YouTube in Social section, not Content', () => {
    const socialHrefs = social.items.map(i => i.href)
    expect(socialHrefs).toContain('/cms/youtube')
    const contentHrefs = content.items.map(i => i.href)
    expect(contentHrefs).not.toContain('/cms/youtube')
  })

  it('has correct nav items in order', () => {
    const labels = social.items.map(i => i.label)
    expect(labels).toEqual(['YouTube', 'Posts', 'Links', 'Link in Bio'])
  })

  it('has correct routes', () => {
    const hrefs = social.items.map(i => i.href)
    expect(hrefs).toEqual([
      '/cms/youtube',
      '/cms/social',
      '/cms/links',
      '/cms/link-in-bio',
    ])
  })

  it('sets reporter minRole for read-only items', () => {
    const postsItem = social.items.find(i => i.label === 'Posts')!
    expect(postsItem.minRole).toBe('reporter')
  })

  it('does not include removed items (Queue, Composer, Insights, Stories, Templates, Accounts)', () => {
    const labels = social.items.map(i => i.label)
    for (const removed of ['Queue', 'Composer', 'Insights', 'Stories', 'Templates', 'Accounts']) {
      expect(labels).not.toContain(removed)
    }
  })
})
