import { z } from 'zod'
import { SLUG_PATTERN } from './slug'

// -- Enums --

export const PLAYLIST_STATUSES = ['draft', 'published', 'archived'] as const
export type PlaylistStatus = (typeof PLAYLIST_STATUSES)[number]

export const EDGE_TYPES = ['sequence', 'related', 'prerequisite', 'continuation'] as const
export type EdgeType = (typeof EDGE_TYPES)[number]

export const CONTENT_TYPES = ['blog_post', 'newsletter', 'pipeline'] as const
export type ContentType = (typeof CONTENT_TYPES)[number]

// -- Schemas --

export const CreatePlaylistSchema = z.object({
  name_pt: z.string().min(1, 'Name (PT) is required').max(200),
  name_en: z.string().max(200).default(''),
  slug: z.string().min(1).max(200).regex(SLUG_PATTERN, 'Invalid slug'),
  description_pt: z.string().max(1000).optional(),
  description_en: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  status: z.enum(PLAYLIST_STATUSES).default('draft'),
})

export const UpdatePlaylistSchema = z.object({
  name_pt: z.string().min(1).max(200).optional(),
  name_en: z.string().max(200).optional(),
  slug: z.string().min(1).max(200).regex(SLUG_PATTERN).optional(),
  description_pt: z.string().max(1000).nullable().optional(),
  description_en: z.string().max(1000).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  status: z.enum(PLAYLIST_STATUSES).optional(),
  cover_image_url: z.string().url().nullable().optional(),
  viewport_state: z.object({
    zoom: z.number().min(0.25).max(2),
    x: z.number(),
    y: z.number(),
  }).optional(),
})

export const AddItemSchema = z.object({
  playlistId: z.string().uuid(),
  blogPostId: z.string().uuid().optional(),
  newsletterEditionId: z.string().uuid().optional(),
  pipelineId: z.string().uuid().optional(),
  sortOrder: z.number().int().optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
}).refine(
  d => d.blogPostId || d.newsletterEditionId || d.pipelineId,
  { message: 'At least one content reference is required' },
)

export const CreateEdgeSchema = z.object({
  playlistId: z.string().uuid(),
  sourceItemId: z.string().uuid(),
  targetItemId: z.string().uuid(),
  edgeType: z.enum(EDGE_TYPES),
  label: z.string().max(100).optional(),
})

export const SaveDeltaSchema = z.object({
  playlistId: z.string().uuid(),
  itemsUpserted: z.array(z.object({
    id: z.string().uuid(),
    position_x: z.number(),
    position_y: z.number(),
    sort_order: z.number().int(),
  })),
  itemsRemoved: z.array(z.string().uuid()),
  edgesCreated: z.array(z.object({
    source_item_id: z.string().uuid(),
    target_item_id: z.string().uuid(),
    edge_type: z.enum(EDGE_TYPES),
    label: z.string().max(100).optional(),
  })),
  edgesRemoved: z.array(z.string().uuid()),
})

// -- Row types (from DB) --

export interface PlaylistRow {
  id: string
  site_id: string
  name_pt: string
  name_en: string
  slug: string
  description_pt: string | null
  description_en: string | null
  cover_image_url: string | null
  status: PlaylistStatus
  category: string | null
  viewport_state: { zoom: number; x: number; y: number } | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PlaylistItemRow {
  id: string
  playlist_id: string
  blog_post_id: string | null
  newsletter_edition_id: string | null
  pipeline_id: string | null
  sort_order: number
  position_x: number
  position_y: number
  created_at: string
}

export interface PlaylistEdgeRow {
  id: string
  playlist_id: string
  source_item_id: string
  target_item_id: string
  edge_type: EdgeType
  label: string | null
  created_at: string
}

// -- Enriched types (for UI) --

export interface PlaylistItemEnriched extends PlaylistItemRow {
  content_type: ContentType | null
  title: string
  status: string | null
  category: string | null
  metadata: string | null
  is_ghost: boolean
  other_playlist_count: number
}

export interface PlaylistGraph {
  playlist: PlaylistRow
  items: PlaylistItemEnriched[]
  edges: PlaylistEdgeRow[]
}

// -- Action result --

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }
