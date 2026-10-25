import { z } from 'zod'
import { VARIANT_LABELS } from './ab-types'

/** Os tipos de teste que existem desde a P3 (10/2026). */
export const TIPOS_DE_TESTE = ['thumbnail', 'title', 'combo'] as const
export const TestTypeSchema = z.enum(TIPOS_DE_TESTE)

/** A descrição saiu do A/B Lab (P3). Única recusa com 422 do A/B. */
export const DESCRICAO_FORA_DO_TESTE = {
  code: 'DESCRICAO_FORA_DO_TESTE',
  message: 'A descrição não participa mais do teste A/B',
  status: 422,
} as const

const TIPO_DESCRICAO = 'description'

/** true se o pedido põe descrição num teste: tipo 'description', ou `description_text` não nulo
 *  (inclusive "") em alguma variante. Recebe sempre o vetor: o desembrulho do corpo `{ variants: [...] }`
 *  é da rota REST (D5), não desta função. */
export function pedeDescricao(input: { test_type?: unknown; variants?: unknown[] }): boolean {
  if (input.test_type === TIPO_DESCRICAO) return true
  // L2 (Gio): a chave legada `description` também conta; o Zod a descartaria em silêncio (sucesso falso, proibido pelo spec)
  if (!Array.isArray(input.variants)) return false
  return input.variants.some(v => typeof v === 'object' && v !== null
    && ((v as Record<string, unknown>).description_text != null || (v as Record<string, unknown>).description != null))
}

/** Texto do `describe` da descrição nas variantes (Zod do serviço e shape do MCP). */
export const DESCRICAO_DESCRIBE = 'Fora do teste desde 10/2026: só null é aceito; texto devolve 422 DESCRICAO_FORA_DO_TESTE'

export const VariantMetadataSchema = z.object({
  thumbnail_tags: z.array(z.string().max(50)).max(10).optional(),
  title_pattern: z.string().max(200).optional(),
  emotional_triggers: z.array(z.string().max(50)).max(10).optional(),
  visual_description: z.string().max(2000).optional(),
  ai_image_prompt: z.string().max(1000).optional(),
  creative_direction: z.string().max(2000).optional(),
  rationale: z.string().max(1000).optional(),
}).passthrough()

export const VariantPayloadSchema = z.object({
  label: z.enum(VARIANT_LABELS),
  title_text: z.string().max(200).nullable().optional(),
  description_text: z.string().nullable().optional().describe(DESCRICAO_DESCRIBE),
  metadata: VariantMetadataSchema.nullable().optional(),
})

export const BatchVariantUpsertSchema = z.object({
  variants: z.array(VariantPayloadSchema).min(1).max(3),
})

export const AbTestConfigSchema = z.object({
  max_duration_days: z.number().int().min(7).max(28),
  confidence_threshold: z.number().min(0.80).max(0.99),
  burn_in_days: z.number().int().min(0).max(3),
  /** @deprecated ignorada desde 10/2026 (A/B Lab P2) */
  auto_apply_winner: z.boolean().optional(),
  rotation_pattern: z.enum(['abba', 'round_robin', 'random']),
  stability_threshold: z.number().int().min(1).max(10),
  teto_explicito: z.boolean().optional(),
})

export const AbTestSiteSettingsSchema = z.object({
  default_duration_days: z.number().int().min(7).max(28),
  default_confidence: z.number().min(0.80).max(0.99),
  /** @deprecated ignorada desde 10/2026 (A/B Lab P2) */
  default_auto_apply: z.boolean().optional(),
  default_burn_in_days: z.number().int().min(0).max(3),
  ctr_drop_trigger: z.object({
    enabled: z.boolean(),
    threshold_percent: z.number().min(1).max(100),
    min_days_below: z.number().int().min(1).max(30),
  }),
  post_publish_trigger: z.object({
    enabled: z.boolean(),
    delay_hours: z.number().min(1).max(168),
    requires_pipeline_thumbs: z.boolean(),
  }),
  notifications: z.object({
    test_completed: z.boolean(),
    test_auto_paused: z.boolean(),
    ctr_drop_alert: z.boolean(),
    daily_digest: z.boolean(),
  }),
})

export const createAbTestSchema = z.object({
  site_id: z.string().uuid(),
  youtube_video_id: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  test_type: TestTypeSchema.optional(),
  config: AbTestConfigSchema.partial().optional(),
})

export const updateSettingsSchema = AbTestSiteSettingsSchema.partial()
