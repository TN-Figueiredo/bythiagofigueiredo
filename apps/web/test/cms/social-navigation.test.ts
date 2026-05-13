import { describe, it, expect } from 'vitest'
import { buildCmsSections } from '@/app/cms/(authed)/_shared/cms-sections'

describe('buildCmsSections — Social Hub nav', () => {
  const sections = buildCmsSections()
  const social = sections.find(s => s.label === 'Social')!
  const content = sections.find(s => s.label === 'Content')!

  it('has a Social section', () => {
    expect(social).toBeDefined()
    expect(social.items.length).toBe(5)
  })

  it('includes YouTube in Social section, not Content', () => {
    const socialHrefs = social.items.map(i => i.href)
    expect(socialHrefs).toContain('/cms/youtube')
    const contentHrefs = content.items.map(i => i.href)
    expect(contentHrefs).not.toContain('/cms/youtube')
  })

  it('has correct nav items in order', () => {
    const labels = social.items.map(i => i.label)
    expect(labels).toEqual(['YouTube', 'Posts', 'Composer', 'Insights', 'Accounts'])
  })

  it('has correct routes', () => {
    const hrefs = social.items.map(i => i.href)
    expect(hrefs).toEqual([
      '/cms/youtube',
      '/cms/social',
      '/cms/social/new',
      '/cms/social/insights',
      '/cms/social/accounts',
    ])
  })

  it('sets reporter minRole for read-only items', () => {
    const postsItem = social.items.find(i => i.label === 'Posts')!
    expect(postsItem.minRole).toBe('reporter')
  })

  it('sets editor minRole for Composer', () => {
    const composerItem = social.items.find(i => i.label === 'Composer')!
    expect(composerItem.minRole).toBe('editor')
  })

  it('sets org_admin minRole for Accounts', () => {
    const accountsItem = social.items.find(i => i.label === 'Accounts')!
    expect(accountsItem.minRole).toBe('org_admin')
  })
})
