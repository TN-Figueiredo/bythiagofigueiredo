import { DEFAULT_SECTIONS, type SidebarSection } from '@tn-figueiredo/cms-ui'

export function buildCmsSections(): SidebarSection[] {
  const sections = DEFAULT_SECTIONS.map(section => {
    if (section.label === 'Content') {
      const items = [
        ...section.items,
        { icon: '🎬', label: 'YouTube', href: '/cms/youtube', minRole: 'editor' as const },
        { icon: '🖼️', label: 'Media', href: '/cms/media', minRole: 'editor' as const },
        { icon: '🔗', label: 'Links', href: '/cms/links', minRole: 'editor' as const },
      ]

      return { ...section, items }
    }
    return section
  })

  const pipelineSection: SidebarSection = {
    label: 'Pipeline',
    items: [
      { icon: '📊', label: 'Overview', href: '/cms/pipeline', minRole: 'editor' as const },
      { icon: '🎬', label: 'Video', href: '/cms/pipeline/video', minRole: 'editor' as const },
      { icon: '✍️', label: 'Blog', href: '/cms/pipeline/blog_post', minRole: 'editor' as const },
      { icon: '📧', label: 'Newsletter', href: '/cms/pipeline/newsletter', minRole: 'editor' as const },
      { icon: '🎓', label: 'Course', href: '/cms/pipeline/course', minRole: 'editor' as const },
      { icon: '📣', label: 'Campaign', href: '/cms/pipeline/campaign', minRole: 'editor' as const },
      { icon: '📁', label: 'Collections', href: '/cms/pipeline/collections', minRole: 'editor' as const },
      { icon: '🔍', label: 'Search', href: '/cms/pipeline/search', minRole: 'editor' as const },
      { icon: '📝', label: 'Reference', href: '/cms/pipeline/reference', minRole: 'editor' as const },
    ],
  }

  const contentIdx = sections.findIndex(s => s.label === 'Content')
  sections.splice(contentIdx + 1, 0, pipelineSection)
  return sections
}
