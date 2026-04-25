import { z } from 'zod'

export interface OverviewStats {
  postsPublished: number
  totalViews: number
  subscribers: number
  openRate: number
  prevPostsPublished: number | null
  prevTotalViews: number | null
  prevSubscribers: number | null
  prevOpenRate: number | null
}

export interface NewsletterEditionStat {
  id: string
  subject: string
  sent_at: string | null
  stats_delivered: number
  stats_opens: number
  stats_clicks: number
  stats_bounces: number
}

export interface CampaignStat {
  id: string
  title: string
  status: string
  submissions_count: number
  published_at: string | null
}

export interface ContentStat {
  id: string
  title: string
  locale: string
  status: string
  published_at: string | null
  owner_user_id: string | null
}

export const periodSchema = z.enum(['7d', '30d', '90d', 'custom'])

export const periodInputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('preset'), value: z.enum(['7d', '30d', '90d']) }),
  z.object({ type: z.literal('custom'), start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
])

export const exportFormatSchema = z.enum(['csv', 'json'])

export const exportSectionsSchema = z.array(
  z.enum(['overview', 'newsletters', 'campaigns', 'content']),
).min(1)

export type PeriodInput = z.infer<typeof periodInputSchema>
export type ExportFormat = z.infer<typeof exportFormatSchema>
