import type { ABDraft } from '@/lib/pipeline/video-schemas'
import { V_MAXIMO_V2 } from '@/lib/youtube/ab-gravacao/decisao-v2'

export interface AbMaterializationPlan {
  /** The variant chosen to go live FIRST (firstOnAir) — seeds the Lab's is_original row. */
  original: { title: string; brief: string }
  /** Payload for updateTextVariant on the is_original row (createAbTest does NOT set title_text). */
  originalUpdate: { title_text: string; metadata: { visual_description: string } }
}

/**
 * Pure plan for §3.8 materialization. The caller executes, in order, all while status:'draft':
 *   1. createAbTest (seeds is_original row, no title_text)
 *   2. updateTextVariant(originalVariantId, plan.originalUpdate)
 *   3. createTextVariant para cada `escolhidas` de escolherDesafiantes
 *
 * All four variants are fresh challengers at debut — there is no incumbent. The Lab needs ONE
 * is_original seed row, so we pick the `firstOnAir` variant (which thumbnail goes live first);
 * the internal `is_original` flag is purely an implementation detail of the Lab, not a user tag.
 * Os desafiantes saem de escolherDesafiantes (fonte única da regra de seleção).
 */
function separar(draft: ABDraft) {
  const first = draft.variants.find(v => v.id === draft.firstOnAir) ?? draft.variants[0]!
  return { first, resto: draft.variants.filter(v => v.id !== first.id) }
}

export function planAbMaterialization(draft: ABDraft): AbMaterializationPlan {
  const { first } = separar(draft)
  return {
    original: { title: first.title, brief: first.brief },
    originalUpdate: { title_text: first.title, metadata: { visual_description: first.brief } },
  }
}

/**
 * S8-F4 (regra v2): o teste leva no máximo V_MAXIMO_V2 variantes (a original + V_MAXIMO_V2 - 1 desafiantes).
 * Entram primeiro o desafiante de role 'winner', depois a ordem do rascunho; os demais vão para `descartadas`
 * (nota do teste; o dono decide "vencedor + C" depois).
 */
export function escolherDesafiantes(draft: ABDraft): { escolhidas: { title_text: string; metadata: { visual_description: string } }[]; descartadas: string[] } {
  const { resto } = separar(draft)
  const ordenadas = [...resto.filter(v => v.role === 'winner'), ...resto.filter(v => v.role !== 'winner')]
  const mapa = (v: ABDraft['variants'][number]) => ({ title_text: v.title, metadata: { visual_description: v.brief } })
  return {
    escolhidas: ordenadas.slice(0, V_MAXIMO_V2 - 1).map(mapa),
    descartadas: ordenadas.slice(V_MAXIMO_V2 - 1).map(v => `${v.id}: ${v.title}`),
  }
}
