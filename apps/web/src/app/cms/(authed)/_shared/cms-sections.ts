import { DEFAULT_SECTIONS, type SidebarSection } from '@tn-figueiredo/cms-ui'

export function buildCmsSections(): SidebarSection[] {
  return DEFAULT_SECTIONS.map(section => {
    if (section.label === 'Content') {
      const items = [
        ...section.items,
        { icon: '🎬', label: 'YouTube', href: '/cms/youtube', minRole: 'editor' as const },
      ]

      if (process.env.NEXT_PUBLIC_LINKS_ENABLED === 'true') {
        items.push({
          icon: '🔗',
          label: 'Links',
          href: '/cms/links',
          minRole: 'editor' as const,
        })
      }

      return { ...section, items }
    }
    return section
  })
}
