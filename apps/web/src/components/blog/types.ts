import type { PostExtras } from './post-extras-schema'

export type { PostExtras }

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

export type MockComment = {
  id: string
  authorName: string
  authorInitials: string
  avatarColor: string
  text: string
  timeAgo: string
  likes: number
  isAuthorReply: boolean
  parentId: string | null
}

export type Highlight = {
  id: string
  text: string
  createdAt: string
}
