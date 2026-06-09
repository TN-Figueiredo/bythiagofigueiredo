import type { ABDraft } from '@/lib/pipeline/video-schemas'

export interface AbMaterializationPlan {
  /** The variant chosen to go live FIRST (firstOnAir) — seeds the Lab's is_original row. */
  original: { title: string; brief: string }
  /** Payload for updateTextVariant on the is_original row (createAbTest does NOT set title_text). */
  originalUpdate: { title_text: string; metadata: { visual_description: string } }
  /** Inputs for the 3× createTextVariant calls (the other three variants). */
  challengers: { title_text: string; metadata: { visual_description: string } }[]
}

/**
 * Pure plan for §3.8 materialization. The caller executes, in order, all while status:'draft':
 *   1. createAbTest (seeds is_original row, no title_text)
 *   2. updateTextVariant(originalVariantId, plan.originalUpdate)
 *   3. createTextVariant ×3 from plan.challengers
 *
 * All four variants are fresh challengers at debut — there is no incumbent. The Lab needs ONE
 * is_original seed row, so we pick the `firstOnAir` variant (which thumbnail goes live first);
 * the internal `is_original` flag is purely an implementation detail of the Lab, not a user tag.
 * Schema (.length(4)) guarantees exactly 1 firstOnAir + 3 others = 4 rows.
 */
export function planAbMaterialization(draft: ABDraft): AbMaterializationPlan {
  const first = draft.variants.find(v => v.id === draft.firstOnAir) ?? draft.variants[0]!
  const challengers = draft.variants.filter(v => v.id !== first.id)
  return {
    original: { title: first.title, brief: first.brief },
    originalUpdate: { title_text: first.title, metadata: { visual_description: first.brief } },
    challengers: challengers.map(v => ({ title_text: v.title, metadata: { visual_description: v.brief } })),
  }
}
