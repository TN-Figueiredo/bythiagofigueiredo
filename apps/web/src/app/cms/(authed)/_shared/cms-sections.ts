import { DEFAULT_SECTIONS, type SidebarSection } from '@tn-figueiredo/cms-ui'

export function buildCmsSections(): SidebarSection[] {
  const sections = DEFAULT_SECTIONS.map(section => {
    if (section.label === 'Content') {
      const items = [
        ...section.items,
        { icon: '🖼️', label: 'Media', href: '/cms/media', minRole: 'editor' as const },
        { icon: '🔗', label: 'Links', href: '/cms/links', minRole: 'editor' as const },
        { icon: '🎵', label: 'Playlists', href: '/cms/playlists', minRole: 'editor' as const },
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
      { icon: '📝', label: 'Reference', href: '/cms/pipeline/reference', minRole: 'editor' as const },
      { icon: '🔬', label: 'Research', href: '/cms/pipeline/research', minRole: 'editor' as const },
    ],
  }

  const socialSection: SidebarSection = {
    label: 'Social',
    items: [
      { icon: '🎬', label: 'YouTube', href: '/cms/youtube', minRole: 'editor' as const },
      { icon: '📡', label: 'Posts', href: '/cms/social', minRole: 'reporter' as const },
      { icon: '✏️', label: 'Composer', href: '/cms/social/new', minRole: 'editor' as const },
      { icon: '📊', label: 'Insights', href: '/cms/social/insights', minRole: 'reporter' as const },
      { icon: '🔗', label: 'Accounts', href: '/cms/social/accounts', minRole: 'org_admin' as const },
    ],
  }

  const contentIdx = sections.findIndex(s => s.label === 'Content')
  sections.splice(contentIdx + 1, 0, pipelineSection, socialSection)
  return sections
}
