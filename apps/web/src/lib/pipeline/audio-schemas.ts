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

export const ImportItemSchema = z.object({
  asset_id: z.string().min(1).max(100),
  original_filename: z.string().optional(),
  rename_to: z.string().optional(),
  renamed_to: z.string().optional(),
  sha256: z.string().length(64).optional(),
  source: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  genre: z.string().optional(),
  artist: z.string().optional(),
  track_name: z.string().optional(),
  artlist_url: z.string().url().optional(),
  duration_seconds: z.number().positive().optional(),
  bpm: z.number().int().positive().optional(),
  key: z.string().optional(),
  music_key: z.string().optional(),
  energy: z.number().int().min(1).max(5).optional(),
  tempo_feel: z.string().optional(),
  status: z.enum(AUDIO_STATUSES).optional(),
  priority: z.enum(AUDIO_PRIORITIES).optional(),
  reusable: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  mood: z.array(z.string()).optional(),
  instruments: z.array(z.string()).optional(),
  use_cases: z.array(z.string()).optional(),
  reuse_scenarios: z.array(z.string()).optional(),
  audio: z.record(z.unknown()).optional(),
}).passthrough()

export type ImportItem = z.infer<typeof ImportItemSchema>

export const ImportSchema = z.object({
  dry_run: z.boolean().default(false),
  schema_version: z.string(),
  music: z.array(ImportItemSchema).max(500).default([]),
  sfx: z.array(ImportItemSchema).max(500).default([]),
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

export interface AudioAssetRow {
  id: string
  site_id: string
  asset_id: string
  original_filename: string
  renamed_to: string | null
  sha256: string | null
  type: AudioType
  source: string
  category: string | null
  subcategory: string | null
  genre: string | null
  artist: string | null
  track_name: string | null
  artlist_url: string | null
  duration_seconds: number | null
  bpm: number | null
  music_key: string | null
  time_signature: string
  energy: number | null
  tempo_feel: string | null
  tags: string[]
  mood: string[]
  instruments: string[]
  use_cases: string[]
  reuse_scenarios: string[]
  reusable: boolean
  status: AudioStatus
  priority: string | null
  metadata: Record<string, unknown>
  version: number
  created_at: string
  updated_at: string
}

export interface AudioAssetUsageRow {
  id: string
  audio_asset_id: string
  pipeline_item_id: string
  scene_number: number | null
  usage_type: string
  notes: string | null
  content_pipeline?: { code: string; title_pt: string; format: string }
}
