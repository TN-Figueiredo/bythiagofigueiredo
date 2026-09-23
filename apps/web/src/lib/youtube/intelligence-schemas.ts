import { z } from 'zod'

export const RecommendationSchema = z.object({
  video_id: z.string().uuid(),
  action_type: z.enum([
    'thumbnail_test', 'title_test', 'description_test', 'combo_test',
    'retention_fix', 'seo_optimization', 'engagement_boost', 'distribution_expand',
    'content_series', 'publish_timing', 'community_post', 'end_screen_optimize',
  ]),
  priority: z.enum(['high', 'medium', 'low']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(500),
  suggested_variant_description: z.string().max(200).optional(),
})

export const CoachingSchema = z.object({
  summary: z.string().max(500),
  /** Who wrote `summary`: the model, or the fixed template it falls back to when both of its
   *  attempts fail validation. The history shows "texto do template" from this. Optional:
   *  Cowork never sends it, and a row without it simply shows no origin. */
  summary_source: z.enum(['model', 'template']).optional(),
  priorities: z.array(z.object({
    axis: z.enum(['ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact']),
    score: z.number().min(0).max(10),
    diagnosis: z.string().max(300),
    action: z.string().max(300),
  })).max(6),
})

export const NotificationSchema = z.object({
  type: z.enum([
    'grade_drop', 'ctr_drop', 'monitoring_alert', 'ab_test_completed',
    'retest_suggested', 'optimization_available', 'trending_viral', 'optimization_resolved',
  ]),
  video_id: z.string().uuid().optional(),
  priority: z.number().int().min(1).max(5),
  title: z.string().max(100),
  message: z.string().max(500),
})

// ── Per-series evidence (forja, 2026-09-22) ─────────────────────────────────────────────
//
// Until now a pattern carried only its sentence (`finding`), so the numbers behind it — the 91
// and the 143,5 of "91 views against a cohort of 143,5" — lived only in the forja's local jsonl.
// Reconstructing them from the rounded "0,63×" in the text gives 144,4: wrong. Every field
// below is OPTIONAL: the rows already written don't have them, and Cowork never sends them.
//
// `patterns_detected` is a DISCRIMINATED list on `tipo`:
//   - `tipo` absent or 'padrao'  → a pattern WITH a verdict (the old shape, plus the numbers);
//   - `tipo: 'examinada'`        → a series the forja examined and did NOT turn into a pattern
//                                  (no cohort, or an effect under the threshold), with why.
// The examined series live HERE, not in a new key elsewhere, because they are the same kind of
// fact (one series of this channel, same numbers) produced by the same run: one row, one
// `generated_at`, one array for the screen to walk. A reader that only wants patterns filters
// with `isPadraoDetectado`; old rows (no `tipo`) read as patterns, which is what they are.

const IntervaloAnosSchema = z.object({
  de: z.number().int().min(2005).max(2100),
  ate: z.number().int().min(2005).max(2100),
})

const DiaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** Fields both variants may carry. The year of a series is the MEDIAN episode's year, so a
 *  "2017" series can span 2017–2019: `anos`/`periodo` are the real range, never inferred from
 *  `ano`. `razao` is exact (mediana / mediana_coorte, unrounded) — the screen rounds. */
const SerieNumerosSchema = {
  serie: z.string().max(80).optional(),
  nome: z.string().max(120).optional(),
  n: z.number().int().min(0).optional(),
  ano: z.number().int().min(2005).max(2100).optional(),
  anos: IntervaloAnosSchema.optional(),
  periodo: z.object({ de: DiaSchema, ate: DiaSchema }).optional(),
  mediana: z.number().min(0).optional(),
  mediana_coorte: z.number().min(0).optional(),
  n_coorte: z.number().int().min(0).optional(),
  razao: z.number().min(0).optional(),
  episodios: z.array(z.string().uuid()).max(200).optional(),
}

export const PadraoDetectadoSchema = z.object({
  tipo: z.literal('padrao').optional(),
  pattern_id: z.string().max(80),
  category: z.string().max(40),
  finding: z.string().max(300),
  confidence: z.number().min(0).max(1),
  sample_size: z.number().int().min(0),
  ...SerieNumerosSchema,
  leitura: z.enum(['abaixo', 'acima']).optional(),
})

export const SerieExaminadaSchema = z.object({
  tipo: z.literal('examinada'),
  ...SerieNumerosSchema,
  serie: z.string().max(80),
  leitura: z.enum(['neutra', 'sem_coorte']),
  /** The forja's own symbol for WHY there's no verdict (padrao_neutro, coorte_fina,
   *  coorte_sem_views, serie_sem_views, mediana_zero). A string, not an enum: a new symbol on
   *  the forja must not 400 the whole analysis. */
  motivo: z.string().max(40),
})

// Examinada first: it is the only one with a REQUIRED `tipo`, so an old-shape item (no `tipo`)
// never matches it by accident and falls through to the pattern.
export const PatternItemSchema = z.union([SerieExaminadaSchema, PadraoDetectadoSchema])

export type PadraoDetectado = z.infer<typeof PadraoDetectadoSchema>
export type SerieExaminada = z.infer<typeof SerieExaminadaSchema>
export type PatternItem = z.infer<typeof PatternItemSchema>

export function isPadraoDetectado(item: PatternItem): item is PadraoDetectado {
  return item.tipo !== 'examinada'
}

export const PatchPayloadSchema = z.object({
  task_id: z.string().uuid(),
  video_recommendations: z.array(RecommendationSchema).max(25).optional(),
  coaching: CoachingSchema.optional(),
  notifications: z.array(NotificationSchema).max(20).optional(),
  channel_insights: z.object({
    patterns_detected: z.array(PatternItemSchema).max(30).optional(),
    analysis_text: z.string().max(2000).optional(),
  }).optional(),
})
