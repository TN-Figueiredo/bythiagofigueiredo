export interface SidebarItem {
  label: string
  href: string
  badgeKey?: string
}

export interface SidebarSection {
  label: string
  items: SidebarItem[]
}

export const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    label: 'OVERVIEW',
    items: [
      { label: 'Dashboard', href: '/cms' },
      { label: 'Schedule', href: '/cms/schedule' },
    ],
  },
  {
    label: 'CONTENT',
    items: [
      { label: 'Posts', href: '/cms/blog', badgeKey: '/cms/blog' },
      { label: 'Newsletters', href: '/cms/newsletters' },
      { label: 'Campaigns', href: '/cms/campaigns' },
    ],
  },
  {
    label: 'PEOPLE',
    items: [
      { label: 'Authors', href: '/cms/authors' },
      { label: 'Subscribers', href: '/cms/subscribers' },
      { label: 'Contatos', href: '/cms/contacts', badgeKey: '/cms/contacts' },
    ],
  },
  {
    label: 'INSIGHTS',
    items: [
      { label: 'Analytics', href: '/cms/analytics' },
    ],
  },
  {
    label: '',
    items: [
      { label: 'Settings', href: '/cms/settings' },
    ],
  },
]
