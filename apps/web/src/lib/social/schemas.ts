// apps/web/src/lib/social/schemas.ts
//
// Zod schemas for social config validation.
// Extracted to a shared module so types.ts, actions, and cron routes
// can all import the same schema without circular dependencies.

import { z } from 'zod'

export const providerSchema = z.enum(['youtube', 'facebook', 'instagram', 'bluesky'])

export const deliveryFormatSchema = z.enum([
  'link_share', 'image_post', 'story', 'reel', 'link_card', 'video_share',
])

export const socialConfigSchema = z.object({
  enabled: z.boolean(),
  platforms: z.array(providerSchema),
  captions: z.record(z.string(), z.record(z.string(), z.string())).default({}),
  hashtags: z.array(z.string()).default([]),
  image_source: z.enum(['og_image', 'cover_image', 'custom']).default('cover_image'),
  ig_template: z.enum(['minimal', 'card', 'bold']).default('card'),
  formats: z.record(z.string(), deliveryFormatSchema).default({}),
})
