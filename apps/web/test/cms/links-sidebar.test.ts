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
    delete process.env.NEXT_PUBLIC_LINKS_ENABLED
  })

  it('adds YouTube item to Content section', async () => {
    const { buildCmsSections } = await import(
      '../../src/app/cms/(authed)/_shared/cms-sections'
    )
    const sections = buildCmsSections()
    const contentSection = sections.find((s) => s.label === 'Content')
    expect(contentSection).toBeDefined()
    const yt = contentSection!.items.find((i) => i.label === 'YouTube')
    expect(yt).toBeDefined()
    expect(yt!.href).toBe('/cms/youtube')
  })

  it('does NOT add Links item when NEXT_PUBLIC_LINKS_ENABLED is not set', async () => {
    const { buildCmsSections } = await import(
      '../../src/app/cms/(authed)/_shared/cms-sections'
    )
    const sections = buildCmsSections()
    const contentSection = sections.find((s) => s.label === 'Content')
    const linksItem = contentSection!.items.find((i) => i.label === 'Links')
    expect(linksItem).toBeUndefined()
  })

  it('adds Links item when NEXT_PUBLIC_LINKS_ENABLED=true', async () => {
    process.env.NEXT_PUBLIC_LINKS_ENABLED = 'true'
    const { buildCmsSections } = await import(
      '../../src/app/cms/(authed)/_shared/cms-sections'
    )
    const sections = buildCmsSections()
    const contentSection = sections.find((s) => s.label === 'Content')
    const linksItem = contentSection!.items.find((i) => i.label === 'Links')
    expect(linksItem).toBeDefined()
    expect(linksItem!.href).toBe('/cms/links')
    expect(linksItem!.minRole).toBe('editor')
  })

  it('does NOT add Links item when NEXT_PUBLIC_LINKS_ENABLED=false', async () => {
    process.env.NEXT_PUBLIC_LINKS_ENABLED = 'false'
    const { buildCmsSections } = await import(
      '../../src/app/cms/(authed)/_shared/cms-sections'
    )
    const sections = buildCmsSections()
    const contentSection = sections.find((s) => s.label === 'Content')
    const linksItem = contentSection!.items.find((i) => i.label === 'Links')
    expect(linksItem).toBeUndefined()
  })

  it('does not modify non-Content sections', async () => {
    process.env.NEXT_PUBLIC_LINKS_ENABLED = 'true'
    const { buildCmsSections } = await import(
      '../../src/app/cms/(authed)/_shared/cms-sections'
    )
    const sections = buildCmsSections()
    const settingsSection = sections.find((s) => s.label === 'Settings')
    expect(settingsSection).toBeDefined()
    expect(settingsSection!.items).toHaveLength(1)
    expect(settingsSection!.items[0]!.label).toBe('Settings')
  })

  it('preserves original Content items', async () => {
    process.env.NEXT_PUBLIC_LINKS_ENABLED = 'true'
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
