import { z } from 'zod'

export const AUDIO_TYPES = ['music', 'sfx'] as const
export const AUDIO_STATUSES = ['downloaded', 'pending', 'retired'] as const
export const AUDIO_PRIORITIES = ['essential', 'nice_to_have', 'optional'] as const
export const USAGE_TYPES = ['background', 'sfx', 'transition', 'intro', 'outro'] as const

export const AudioAssetCreateSchema = z.object({
  asset_id: z.string().min(1).max(100),
  original_filename: z.string().min(1),
  renamed_to: z.string().optional(),
  sha256: z.string().length(64).optional(),
  type: z.enum(AUDIO_TYPES),
  source: z.string().default('artlist'),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  genre: z.string().optional(),
  artist: z.string().optional(),
  track_name: z.string().optional(),
  artlist_url: z.string().url().optional(),
  duration_seconds: z.number().positive().optional(),
  bpm: z.number().int().positive().optional(),
  music_key: z.string().max(10).optional(),
  time_signature: z.string().default('4/4'),
  energy: z.number().int().min(1).max(5).optional(),
  tempo_feel: z.string().optional(),
  tags: z.array(z.string()).default([]),
  mood: z.array(z.string()).default([]),
  instruments: z.array(z.string()).default([]),
  use_cases: z.array(z.string()).default([]),
  reuse_scenarios: z.array(z.string()).default([]),
  reusable: z.boolean().default(true),
  status: z.enum(AUDIO_STATUSES).default('downloaded'),
  priority: z.enum(AUDIO_PRIORITIES).optional(),
  metadata: z.record(z.unknown()).default({}),
})

export const AudioAssetUpdateSchema = AudioAssetCreateSchema.partial().extend({
  version: z.number().int().positive(),
})

export const ResolveQuerySchema = z.object({
  type: z.enum(AUDIO_TYPES),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  tags: z.array(z.string()).optional(),
  mood: z.array(z.string()).optional(),
  energy: z.number().int().min(1).max(5).optional(),
  bpm_range: z.object({ min: z.number(), max: z.number() }).optional(),
  duration_range: z.object({ min: z.number(), max: z.number() }).optional(),
  instruments: z.array(z.string()).optional(),
  reuse_scenarios: z.array(z.string()).optional(),
  description: z.string().optional(),
  limit: z.number().int().min(1).max(20).default(5),
})

export const ImportSchema = z.object({
  dry_run: z.boolean().default(false),
  schema_version: z.string(),
  music: z.array(z.record(z.unknown())).default([]),
  sfx: z.array(z.record(z.unknown())).default([]),
})

export const AudioUsageCreateSchema = z.object({
  audio_asset_id: z.string().uuid(),
  pipeline_item_id: z.string().uuid(),
  scene_number: z.number().int().positive().optional(),
  usage_type: z.enum(USAGE_TYPES).default('background'),
  notes: z.string().optional(),
})

export type AudioAssetCreate = z.infer<typeof AudioAssetCreateSchema>
export type AudioAssetUpdate = z.infer<typeof AudioAssetUpdateSchema>
export type ResolveQuery = z.infer<typeof ResolveQuerySchema>
export type ImportPayload = z.infer<typeof ImportSchema>
export type AudioUsageCreate = z.infer<typeof AudioUsageCreateSchema>
export type AudioType = (typeof AUDIO_TYPES)[number]
export type AudioStatus = (typeof AUDIO_STATUSES)[number]
