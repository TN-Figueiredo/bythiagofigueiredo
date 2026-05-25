import { describe, it, expect } from 'vitest'
import { buildCmsSections } from '../../src/app/cms/(authed)/_shared/cms-sections'

describe('buildCmsSections — Links & YouTube placement', () => {
  const sections = buildCmsSections()

  it('YouTube is in Social, not Content', () => {
    const content = sections.find(s => s.label === 'Content')!
    const social = sections.find(s => s.label === 'Social')!
    expect(content.items.find(i => i.label === 'YouTube')).toBeUndefined()
    const yt = social.items.find(i => i.label === 'YouTube')!
    expect(yt).toBeDefined()
    expect(yt.href).toBe('/cms/youtube')
  })

  it('Links is in Social with correct href and minRole', () => {
    const social = sections.find(s => s.label === 'Social')!
    const linksItem = social.items.find(i => i.label === 'Links')!
    expect(linksItem).toBeDefined()
    expect(linksItem.href).toBe('/cms/links')
    expect(linksItem.minRole).toBe('editor')
  })

  it('Blog is in Content with correct href', () => {
    const content = sections.find(s => s.label === 'Content')!
    const blogItem = content.items.find(i => i.label === 'Blog')!
    expect(blogItem).toBeDefined()
    expect(blogItem.href).toBe('/cms/blog')
  })
})
