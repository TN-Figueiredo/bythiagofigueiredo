import { z } from 'zod'

export const BROLL_TYPES = ['footage', 'photo', 'screen_recording', 'stock', 'graphic', 'animation'] as const
export const BROLL_STATUSES = ['available', 'pending', 'retired'] as const
export const BROLL_SOURCE_TYPES = ['pessoal', 'generico'] as const
export const BROLL_USAGE_TYPES = ['cutaway', 'overlay', 'background', 'transition', 'intro', 'outro'] as const

export const BRollAssetCreateSchema = z.object({
  asset_id: z.string().min(1).max(100),
  original_filename: z.string().min(1).max(500),
  renamed_to: z.string().max(500).optional(),
  sha256: z.string().length(64).optional(),
  file_size_bytes: z.number().int().nonnegative().optional(),
  type: z.enum(BROLL_TYPES).default('footage'),
  source: z.string().max(200).default('local'),
  source_type: z.enum(BROLL_SOURCE_TYPES).default('pessoal'),
  category: z.string().max(100).optional(),
  subcategory: z.string().max(100).optional(),
  location: z.string().max(300).optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(50).default([]),
  codec: z.string().max(50).optional(),
  fps: z.number().int().min(1).max(240).optional(),
  resolution: z.string().max(20).default('1080p'),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration_seconds: z.number().nonnegative().optional(),
  bitrate_kbps: z.number().int().positive().optional(),
  has_audio: z.boolean().default(false),
  color_profile: z.string().max(50).optional(),
  storage_url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional(),
  proxy_url: z.string().url().optional(),
  reusable: z.boolean().default(true),
  status: z.enum(BROLL_STATUSES).default('available'),
  captured_at: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).default({}).refine(
    (val) => JSON.stringify(val).length <= 65536,
    { message: 'metadata must be under 64KB when serialized' }
  ),
})

export const BRollAssetUpdateSchema = BRollAssetCreateSchema.partial().omit({ asset_id: true, type: true }).extend({
  version: z.number().int().positive(),
})

export const BRollSearchQuerySchema = z.object({
  type: z.enum(BROLL_TYPES).optional(),
  source_type: z.enum(BROLL_SOURCE_TYPES).optional(),
  category: z.string().max(100).optional(),
  subcategory: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  location: z.string().max(300).optional(),
  resolution: z.string().max(20).optional(),
  has_audio: z.boolean().optional(),
  reusable: z.boolean().optional(),
  duration_range: z.object({ min: z.number(), max: z.number() }).optional(),
  description: z.string().max(500).optional(),
  limit: z.number().int().min(1).max(50).default(10),
})

export const BRollImportItemSchema = z.object({
  asset_id: z.string().min(1).max(100),
  original_filename: z.string().max(500).optional(),
  renamed_to: z.string().max(500).optional(),
  sha256: z.string().length(64).optional(),
  file_size_bytes: z.number().int().nonnegative().optional(),
  type: z.enum(BROLL_TYPES).optional(),
  source: z.string().max(200).optional(),
  source_type: z.enum(BROLL_SOURCE_TYPES).optional(),
  category: z.string().max(100).optional(),
  subcategory: z.string().max(100).optional(),
  location: z.string().max(300).optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(50).optional(),
  codec: z.string().max(50).optional(),
  fps: z.number().int().min(1).max(240).optional(),
  resolution: z.string().max(20).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration_seconds: z.number().nonnegative().optional(),
  bitrate_kbps: z.number().int().positive().optional(),
  has_audio: z.boolean().optional(),
  color_profile: z.string().max(50).optional(),
  storage_url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional(),
  proxy_url: z.string().url().optional(),
  reusable: z.boolean().optional(),
  status: z.enum(BROLL_STATUSES).optional(),
  captured_at: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional().refine(
    (val) => !val || JSON.stringify(val).length <= 65536,
    { message: 'metadata must be under 64KB when serialized' }
  ),
})

export type BRollImportItem = z.infer<typeof BRollImportItemSchema>

export const BRollImportSchema = z.object({
  dry_run: z.boolean().default(false),
  schema_version: z.string(),
  items: z.array(BRollImportItemSchema).max(500).default([]),
})

export const BRollUsageCreateSchema = z.object({
  broll_asset_id: z.string().uuid(),
  pipeline_item_id: z.string().uuid(),
  beat_index: z.number().int().nonnegative().optional(),
  timecode_in: z.string().max(20).optional(),
  timecode_out: z.string().max(20).optional(),
  usage_type: z.enum(BROLL_USAGE_TYPES).default('cutaway'),
  notes: z.string().max(1000).optional(),
})

export type BRollAssetCreate = z.infer<typeof BRollAssetCreateSchema>
export type BRollAssetUpdate = z.infer<typeof BRollAssetUpdateSchema>
export type BRollSearchQuery = z.infer<typeof BRollSearchQuerySchema>
export type BRollImportPayload = z.infer<typeof BRollImportSchema>
export type BRollUsageCreate = z.infer<typeof BRollUsageCreateSchema>
export type BRollType = (typeof BROLL_TYPES)[number]
export type BRollStatus = (typeof BROLL_STATUSES)[number]
export type BRollSourceType = (typeof BROLL_SOURCE_TYPES)[number]

export interface BRollAssetRow {
  id: string
  site_id: string
  asset_id: string
  original_filename: string
  renamed_to: string | null
  sha256: string | null
  file_size_bytes: number | null
  type: BRollType
  source: string
  source_type: BRollSourceType
  category: string | null
  subcategory: string | null
  location: string | null
  description: string | null
  tags: string[]
  codec: string | null
  fps: number | null
  resolution: string
  width: number | null
  height: number | null
  duration_seconds: number | null
  bitrate_kbps: number | null
  has_audio: boolean
  color_profile: string | null
  storage_url: string | null
  thumbnail_url: string | null
  proxy_url: string | null
  reusable: boolean
  status: BRollStatus
  captured_at: string | null
  metadata: Record<string, unknown>
  version: number
  created_at: string
  updated_at: string
}

export interface BRollUsageRow {
  id: string
  broll_asset_id: string
  pipeline_item_id: string
  site_id: string
  beat_index: number | null
  timecode_in: string | null
  timecode_out: string | null
  usage_type: string
  notes: string | null
  content_pipeline?: { code: string; title_pt: string; format: string }
}
