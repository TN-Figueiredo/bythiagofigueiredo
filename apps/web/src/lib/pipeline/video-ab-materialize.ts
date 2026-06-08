import type { ABDraft } from '@/lib/pipeline/video-schemas'

export interface AbMaterializationPlan {
  /** The single tag==='original' variant. */
  original: { title: string; brief: string }
  /** Payload for updateTextVariant on the is_original row (createAbTest does NOT set title_text). */
  originalUpdate: { title_text: string; metadata: { visual_description: string } }
  /** Inputs for the 3× createTextVariant calls (non-original variants). */
  challengers: { title_text: string; metadata: { visual_description: string } }[]
}

/**
 * Pure plan for §3.8 materialization. The caller executes, in order, all while status:'draft':
 *   1. createAbTest (seeds is_original row, no title_text)
 *   2. updateTextVariant(originalVariantId, plan.originalUpdate)
 *   3. createTextVariant ×3 from plan.challengers
 * Schema (.refine) guarantees exactly one original + 3 challengers = 4 rows.
 */
export function planAbMaterialization(draft: ABDraft): AbMaterializationPlan {
  const original = draft.variants.find(v => v.tag === 'original')!
  const challengers = draft.variants.filter(v => v.tag !== 'original')
  return {
    original: { title: original.title, brief: original.brief },
    originalUpdate: { title_text: original.title, metadata: { visual_description: original.brief } },
    challengers: challengers.map(v => ({ title_text: v.title, metadata: { visual_description: v.brief } })),
  }
}
