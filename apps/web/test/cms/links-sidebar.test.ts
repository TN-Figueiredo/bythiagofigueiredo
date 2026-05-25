import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tn-figueiredo/cms-ui', () => ({
  DEFAULT_SECTIONS: [
    {
      label: 'Content',
      items: [
        { icon: 'blog', label: 'Blog', href: '/cms/blog', minRole: 'editor' as const },
      ],
    },
    {
      label: 'Settings',
      items: [
        { icon: 'gear', label: 'Settings', href: '/cms/settings', minRole: 'editor' as const },
      ],
    },
  ],
}))

describe('buildCmsSections', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('adds YouTube item to Social section (not Content)', async () => {
    const { buildCmsSections } = await import(
      '../../src/app/cms/(authed)/_shared/cms-sections'
    )
    const sections = buildCmsSections()
    const contentSection = sections.find((s) => s.label === 'Content')
    expect(contentSection).toBeDefined()
    const ytInContent = contentSection!.items.find((i) => i.label === 'YouTube')
    expect(ytInContent).toBeUndefined()
    const socialSection = sections.find((s) => s.label === 'Social')
    expect(socialSection).toBeDefined()
    const yt = socialSection!.items.find((i) => i.label === 'YouTube')
    expect(yt).toBeDefined()
    expect(yt!.href).toBe('/cms/youtube')
  })

  it('always includes Links item in Social section', async () => {
    const { buildCmsSections } = await import(
      '../../src/app/cms/(authed)/_shared/cms-sections'
    )
    const sections = buildCmsSections()
    const socialSection = sections.find((s) => s.label === 'Social')
    const linksItem = socialSection!.items.find((i) => i.label === 'Links')
    expect(linksItem).toBeDefined()
    expect(linksItem!.href).toBe('/cms/links')
    expect(linksItem!.minRole).toBe('editor')
  })

  it('does not modify non-Content sections', async () => {
    const { buildCmsSections } = await import(
      '../../src/app/cms/(authed)/_shared/cms-sections'
    )
    const sections = buildCmsSections()
    const socialSection = sections.find((s) => s.label === 'Social')
    expect(socialSection).toBeDefined()
    expect(socialSection!.items.length).toBeGreaterThan(0)
    const peopleSection = sections.find((s) => s.label === 'People')
    expect(peopleSection).toBeDefined()
  })

  it('preserves original Content items', async () => {
    const { buildCmsSections } = await import(
      '../../src/app/cms/(authed)/_shared/cms-sections'
    )
    const sections = buildCmsSections()
    const contentSection = sections.find((s) => s.label === 'Content')
    const blogItem = contentSection!.items.find((i) => i.label === 'Blog')
    expect(blogItem).toBeDefined()
    expect(blogItem!.href).toBe('/cms/blog')
  })
})
