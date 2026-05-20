import { z } from 'zod'

export const HighlightSchema = z.object({
  active: z.boolean().default(false),
  badge_pt: z.string().max(30).default(''),
  badge_en: z.string().max(30).default(''),
  title_pt: z.string().max(80).default(''),
  title_en: z.string().max(80).default(''),
  desc_pt: z.string().max(200).default(''),
  desc_en: z.string().max(200).default(''),
  cta_pt: z.string().max(40).default(''),
  cta_en: z.string().max(40).default(''),
  url: z.string().max(2048).default(''),
})

export const SharedLinkSchema = z.object({
  id: z.string().uuid().default(() => crypto.randomUUID()),
  label_pt: z.string().max(100),
  label_en: z.string().max(100),
  url: z.string().max(2048),
  icon: z.string().max(50),
})

export const LinktreeConfigSchema = z.object({
  highlight: HighlightSchema.default({}),
  tagline_pt: z.string().max(120).default(''),
  tagline_en: z.string().max(120).default(''),
  blog_desc_pt: z.string().max(300).default(''),
  blog_desc_en: z.string().max(300).default(''),
  shared_links: z.array(SharedLinkSchema).max(10).default([]),
})

export type LinktreeConfig = z.infer<typeof LinktreeConfigSchema>
export type Highlight = z.infer<typeof HighlightSchema>
export type SharedLink = z.infer<typeof SharedLinkSchema>

export interface SiteInfo {
  id: string
  name: string
  primaryDomain: string
  logoUrl: string | null
  primaryColor: string
  supportedLocales: string[]
  defaultLocale: string
}

export interface AuthorInfo {
  displayName: string
  avatarUrl: string | null
  bio: string | null
}

export interface LatestPost {
  title: string
  slug: string
  readingTimeMin: number
  publishedAt: string
  tagName: string | null
  tagColor: string | null
  locale: string
}

export interface LatestVideo {
  title: string
  duration: string
  publishedAt: string
  viewCount: number
  channelHandle: string
  youtubeVideoId: string
}

export interface SocialProfile {
  platform: 'youtube' | 'instagram' | 'x' | 'github' | 'bluesky'
  url: string
  handle: string
}

export interface NewsletterTypeInfo {
  name: string
  slug: string
  locale: string
  cadenceLabel: string | null
}

export interface YouTubeChannelInfo {
  handle: string
  locale: string
  scheduleLabel: string | null
  subscriberCount: number
}

export interface LangSectionItem {
  id: string
  type: 'blog' | 'newsletter' | 'youtube'
  label: string
  desc: string
  url: string
  icon: string
  subscriberCount?: number
}

export interface LangSection {
  locale: string
  flag: string
  label: string
  hand: string
  items: LangSectionItem[]
}

export interface LinktreePageData {
  config: LinktreeConfig
  site: SiteInfo
  author: AuthorInfo
  latestPost: LatestPost | null
  latestVideo: LatestVideo | null
  socials: SocialProfile[]
  sections: LangSection[]
  sharedLinks: SharedLink[]
}
