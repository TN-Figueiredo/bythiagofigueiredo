import { z } from 'zod'

// ---------------------------------------------------------------------------
// 1. STATUS enum — fresca | analise | aplicada | arquivada
// ---------------------------------------------------------------------------

export const RESEARCH_STATUS = ['fresca', 'analise', 'aplicada', 'arquivada'] as const
export type ResearchStatus = (typeof RESEARCH_STATUS)[number]

// ---------------------------------------------------------------------------
// 2. SOURCE / AUTHORSHIP enum
// ---------------------------------------------------------------------------

export const RESEARCH_SOURCE = ['cowork', 'thiago', 'dupla'] as const
export type ResearchSource = (typeof RESEARCH_SOURCE)[number]

// ---------------------------------------------------------------------------
// 3. DECISION enums
// ---------------------------------------------------------------------------

export const DECISION_HORIZON = ['agora', 'proximo', 'explorar'] as const
export type DecisionHorizon = (typeof DECISION_HORIZON)[number]

export const DECISION_STATUS = ['decidido', 'testando', 'revisar', 'arquivado'] as const
export type DecisionStatus = (typeof DECISION_STATUS)[number]

// ---------------------------------------------------------------------------
// 4. FOCO enum
// ---------------------------------------------------------------------------

export const FOCO_STATE = ['ativo', 'proposto', 'rascunho', 'arquivado'] as const
export type FocoState = (typeof FOCO_STATE)[number]

// ---------------------------------------------------------------------------
// 5. THEME ids (matches THEME_META keys in research-types.ts)
// ---------------------------------------------------------------------------

export const THEME_IDS = ['asia', 'ia', 'dev', 'games', 'grana', 'canal'] as const
export type ThemeId = (typeof THEME_IDS)[number]

// ---------------------------------------------------------------------------
// 6. RESEARCH ITEM schemas
// ---------------------------------------------------------------------------

const SourceSchema = z.object({
  url: z.string().url().max(2000),
  title: z.string().max(200),
  accessed_at: z.string().datetime().optional(),
})

export const TOPIC_SLUG_REGEX = /^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/

export const ResearchItemCreateSchema = z.object({
  title: z.string().min(1).max(500),
  topic_slug: z
    .string()
    .min(1)
    .max(200)
    .regex(TOPIC_SLUG_REGEX, 'topic_slug must be lowercase kebab-case segments separated by /'),
  content_md: z.string().min(1).max(500_000),
  summary: z.string().max(2000).optional(),
  sources: z.array(SourceSchema).max(50).default([]),
  // New fields — optional on create so existing callers keep working
  theme_id: z.enum(THEME_IDS).optional(),
  source: z.enum(RESEARCH_SOURCE).default('thiago'),
  read_min: z.number().int().min(0).max(180).optional(),
  pinned: z.boolean().default(false),
  takeaways: z.array(z.string().max(500)).max(10).default([]),
})

export type ResearchItemCreateInput = z.infer<typeof ResearchItemCreateSchema>

export const ResearchItemUpdateSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    content_json: z.record(z.unknown()).optional(),
    content_md: z.string().max(500_000).optional(),
    content_html: z.string().max(2_000_000).optional(),
    summary: z.string().max(2000).nullable().optional(),
    sources: z.array(SourceSchema).max(50).optional(),
    status: z.enum(RESEARCH_STATUS).optional(),
    topic_id: z.string().uuid().optional(),
    // New fields
    theme_id: z.enum(THEME_IDS).nullable().optional(),
    source: z.enum(RESEARCH_SOURCE).optional(),
    read_min: z.number().int().min(0).max(180).optional(),
    pinned: z.boolean().optional(),
    takeaways: z.array(z.string().max(500)).max(10).optional(),
  })
  .refine((d) => !(d.content_json && d.content_md), {
    message: 'content_json and content_md are mutually exclusive',
  })

export type ResearchItemUpdateInput = z.infer<typeof ResearchItemUpdateSchema>

export const ResearchImportSchema = z.object({
  items: z.array(ResearchItemCreateSchema).min(1).max(50),
})

// ---------------------------------------------------------------------------
// 7. TOPIC schemas — kept for backward compat with research-picker + topic CRUD
// ---------------------------------------------------------------------------

export const ResearchTopicCreateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  parent_id: z.string().uuid().optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).default('#a78bfa'),
  icon: z.string().max(10).default('📁'),
})

export type ResearchTopicCreateInput = z.infer<typeof ResearchTopicCreateSchema>

export const ResearchTopicUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
  icon: z.string().max(10).optional(),
  sort_order: z.number().int().optional(),
})

export type ResearchTopicUpdateInput = z.infer<typeof ResearchTopicUpdateSchema>

export const ResearchLinkSchema = z.object({
  pipeline_item_id: z.string().uuid(),
  note: z.string().max(500).optional(),
})

export type ResearchLinkInput = z.infer<typeof ResearchLinkSchema>

// ---------------------------------------------------------------------------
// 8. DECISION schemas
// ---------------------------------------------------------------------------

const DecisionHistoryEntrySchema = z.object({
  label: z.string().max(100),
  date: z.string().max(50),
  note: z.string().max(1000).nullable().optional(),
})

export const ResearchDecisionCreateSchema = z.object({
  title: z.string().min(1).max(500),
  rationale: z.string().max(5000).nullable().optional(),
  horizon: z.enum(DECISION_HORIZON),
  status: z.enum(DECISION_STATUS).default('decidido'),
  theme_id: z.enum(THEME_IDS).nullable().optional(),
  date_label: z.string().max(50).nullable().optional(),
  drives: z.array(z.string().max(100)).max(10).default([]),
  // Decision fullscreen fields
  context: z.string().max(5000).nullable().optional(),
  consequences: z.array(z.string().max(500)).max(20).optional(),
  metric: z.string().max(500).nullable().optional(),
  revisit: z.string().max(100).nullable().optional(),
  history: z.array(DecisionHistoryEntrySchema).max(50).optional(),
  /** UUIDs of research_items to link as sources */
  source_research_ids: z.array(z.string().uuid()).max(20).default([]),
  /** Optional notes keyed by research_id */
  source_notes: z.record(z.string().uuid(), z.string().max(500)).optional(),
})

export type ResearchDecisionCreateInput = z.infer<typeof ResearchDecisionCreateSchema>

export const ResearchDecisionUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  rationale: z.string().max(5000).nullable().optional(),
  horizon: z.enum(DECISION_HORIZON).optional(),
  status: z.enum(DECISION_STATUS).optional(),
  theme_id: z.enum(THEME_IDS).nullable().optional(),
  date_label: z.string().max(50).nullable().optional(),
  drives: z.array(z.string().max(100)).max(10).optional(),
  // Decision fullscreen fields
  context: z.string().max(5000).nullable().optional(),
  consequences: z.array(z.string().max(500)).max(20).optional(),
  metric: z.string().max(500).nullable().optional(),
  revisit: z.string().max(100).nullable().optional(),
  history: z.array(DecisionHistoryEntrySchema).max(50).optional(),
  /** Full replacement list of linked research UUIDs (diff-sync in action) */
  source_research_ids: z.array(z.string().uuid()).max(20).optional(),
  source_notes: z.record(z.string().uuid(), z.string().max(500)).optional(),
})

export type ResearchDecisionUpdateInput = z.infer<typeof ResearchDecisionUpdateSchema>

// ---------------------------------------------------------------------------
// 9. FOCO schemas
// ---------------------------------------------------------------------------

export const ResearchFocoCreateSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(3000).nullable().optional(),
  rationale: z.string().max(3000).nullable().optional(),
  metric: z.string().max(500).nullable().optional(),
  window_label: z.string().max(100).nullable().optional(),
  state: z.enum(FOCO_STATE).default('rascunho'),
  horizon: z.enum(DECISION_HORIZON).default('agora'),
  theme_ids: z.array(z.enum(THEME_IDS)).max(6).default([]),
  pinned_research_ids: z.array(z.string().uuid()).max(30).default([]),
  pinned_notes: z.record(z.string().uuid(), z.string().max(500)).optional(),
})

export type ResearchFocoCreateInput = z.infer<typeof ResearchFocoCreateSchema>

export const ResearchFocoUpdateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(3000).nullable().optional(),
  rationale: z.string().max(3000).nullable().optional(),
  metric: z.string().max(500).nullable().optional(),
  window_label: z.string().max(100).nullable().optional(),
  state: z.enum(FOCO_STATE).optional(),
  horizon: z.enum(DECISION_HORIZON).optional(),
  theme_ids: z.array(z.enum(THEME_IDS)).max(6).optional(),
  pinned_research_ids: z.array(z.string().uuid()).max(30).optional(),
  pinned_notes: z.record(z.string().uuid(), z.string().max(500)).optional(),
})

export type ResearchFocoUpdateInput = z.infer<typeof ResearchFocoUpdateSchema>

export const ResearchFocoFullSchema = ResearchFocoUpdateSchema.extend({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
})

export type ResearchFocoFullInput = z.infer<typeof ResearchFocoFullSchema>
