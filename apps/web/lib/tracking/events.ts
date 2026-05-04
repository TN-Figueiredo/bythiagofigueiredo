import { z } from 'zod'

export const ResourceType = z.enum(['blog', 'campaign', 'newsletter_archive'])
export type ResourceType = z.infer<typeof ResourceType>

export const EventType = z.enum(['view', 'read_progress', 'read_complete'])
export type EventType = z.infer<typeof EventType>

export const ReferrerSrc = z.enum(['direct', 'google', 'newsletter', 'social', 'other'])
export type ReferrerSrc = z.infer<typeof ReferrerSrc>

export const TrackingEventSchema = z.object({
  sessionId: z.string().min(1),
  siteId: z.string().uuid(),
  resourceType: ResourceType,
  resourceId: z.string().uuid(),
  eventType: EventType,
  anonymousId: z.string().min(1),
  locale: z.string().optional(),
  referrerSrc: ReferrerSrc.optional(),
  readDepth: z.number().int().min(0).max(100).optional(),
  timeOnPage: z.number().int().min(0).max(3600).optional(),
  hasConsent: z.boolean(),
})

export const TrackingRequestSchema = z.object({
  events: z.array(TrackingEventSchema).min(1).max(5),
})

export type TrackingEvent = z.infer<typeof TrackingEventSchema>
export type TrackingRequest = z.infer<typeof TrackingRequestSchema>

export interface TrackingConfig {
  siteId: string
  resourceType: ResourceType
  resourceId: string
  locale: string
  isPreview?: boolean
}
