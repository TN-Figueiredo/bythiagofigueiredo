import { describe, it, expect } from 'vitest'
import { buildCmsSections } from '@/app/cms/(authed)/_shared/cms-sections'

describe('buildCmsSections — Social section (v3 redesign)', () => {
  const sections = buildCmsSections()
  const social = sections.find(s => s.label === 'Social')!
  const youtube = sections.find(s => s.label === 'YouTube')!
  const content = sections.find(s => s.label === 'Content')!

  it('has a Social section with 2 items', () => {
    expect(social).toBeDefined()
    expect(social.items.length).toBe(2)
  })

  it('YouTube has its own section, not in Content', () => {
    expect(youtube).toBeDefined()
    expect(youtube.items.length).toBe(5)
    const contentHrefs = content.items.map(i => i.href)
    expect(contentHrefs).not.toContain('/cms/youtube')
  })

  it('has correct nav items in order', () => {
    const labels = social.items.map(i => i.label)
    expect(labels).toEqual(['Posts', 'Links'])
  })

  it('has correct routes', () => {
    const hrefs = social.items.map(i => i.href)
    expect(hrefs).toEqual([
      '/cms/social',
      '/cms/links',
    ])
  })

  it('sets reporter minRole for read-only items', () => {
    const postsItem = social.items.find(i => i.label === 'Posts')!
    expect(postsItem.minRole).toBe('reporter')
  })

  it('does not include removed items (Queue, Composer, Insights, Stories, Templates, Accounts, Link in Bio)', () => {
    const labels = social.items.map(i => i.label)
    for (const removed of ['Queue', 'Composer', 'Insights', 'Stories', 'Templates', 'Accounts', 'Link in Bio']) {
      expect(labels).not.toContain(removed)
    }
  })
})
