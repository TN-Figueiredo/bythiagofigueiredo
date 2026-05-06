export type TocEntry = {
  slug: string
  text: string
  depth: 2 | 3
}

export type AuthorData = {
  name: string
  role: string
  avatarUrl: string | null
  initials: string
  bio: string
  links: Array<{ label: string; href: string }>
}

export type EngagementStats = {
  views: number
  likes: number
  bookmarked: boolean
}

export type Highlight = {
  id: string
  text: string
  createdAt: string
}

export function getHighlightStorageKey(slug: string, locale?: string) {
  return `btf-highlights:${locale ? `${locale}/` : ''}${slug}`
}
