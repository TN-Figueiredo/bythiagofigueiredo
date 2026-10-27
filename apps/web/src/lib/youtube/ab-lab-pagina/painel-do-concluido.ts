/** Monta o `PainelEscolha` de um teste concluído a partir do que a página leu (M7b T12). Puro: sem banco, sem relógio. */
import { lerResultadoV2 } from '../ab-types'
import type { AbTestCardView, AbTestWithVariants, DisplayLabel } from '../ab-types'
import type { TelaV2 } from '../ab-gravacao/tela-v2'
import { noArConfirmado, type NoArLido, type TentativaNoAr } from '../ab-no-ar'
import { fonteDoOriginal } from '../ab-settle'
import { montarPainelEscolha, type PainelEscolha } from './painel-escolha'

type TelaConcluida = Extract<TelaV2, { fase: 'concluido' }>

export interface EntradaConcluidoPainel {
  card: AbTestCardView
  bruto: AbTestWithVariants
  tela: TelaConcluida | null
  ctrs: Record<string, number | null>
  /** histórico de `ab_test_restores` deste teste; ausente/`null` = não lido (o "no ar" fica desconhecido) */
  historico?: TentativaNoAr[] | null
  /** há outro teste aberto no vídeo: o servidor recusa a escrita */
  outroAberto?: boolean
}

/** Painel de escolha do concluído, ou nulo se o painel não é possível (fora da regra v2, ou outro teste aberto no vídeo). */
export function painelEscolhaDoConcluido(c: EntradaConcluidoPainel, podeAdministrar: boolean): PainelEscolha | null {
  if (c.tela === null || c.outroAberto === true) return null
  const { card, bruto } = c
  const original = card.variants.find(v => v.isOriginal)
  const lido = lerResultadoV2(bruto.result_metadata)
  const sugeridaId = lido.estado === 'ok' && typeof lido.v2.vencedor_sugerido === 'string' ? lido.v2.vencedor_sugerido : null
  const letraDe = (isOriginal: boolean, label: DisplayLabel): DisplayLabel => (isOriginal ? 'A' : label)
  const entradaNoAr = {
    test_type: bruto.test_type, restore_status: bruto.restore_status, restore_seq: bruto.restore_seq ?? 0, completed_at: bruto.completed_at,
    winner_variant_id: bruto.winner_variant_id, winner_applied_at: bruto.winner_applied_at,
    variantes: card.variants.map(v => ({ id: v.id, label: letraDe(v.isOriginal, v.label), is_original: v.isOriginal })),
  }
  // Histórico que falhou ao ler (`null`) nunca vira "sem histórico": o que está no ar fica desconhecido.
  const noAr: NoArLido = c.historico === null ? { tipo: 'desconhecido', ultima: null } : noArConfirmado(entradaNoAr, c.historico ?? [])
  const miniaturaGuardada = fonteDoOriginal({
    variantes: bruto.variants.map(v => ({ is_original: v.is_original, blob_url: v.blob_url })),
    original_thumbnail_url: bruto.original_thumbnail_url ?? null,
  }) !== null
  return montarPainelEscolha({
    testId: card.id, nomeVideo: card.videoTitle ?? card.name, tipo: card.type, restoreSeq: card.restoreSeq, podeAdministrar,
    // Teste de título: todas as versões mostram a miniatura do vídeo (a original).
    variantes: card.variants.map(v => ({
      id: v.id, letra: letraDe(v.isOriginal, v.label), original: v.isOriginal, titulo: v.title,
      miniatura: card.type === 'title' ? (original?.thumbUrl ?? card.leaderThumbUrl ?? null) : v.thumbUrl,
      ctr: c.ctrs[v.id] ?? null,
    })),
    sugeridaId, noAr,
    escolha: bruto.escolha_em ? { varianteId: bruto.escolha_variant_id ?? null, em: bruto.escolha_em } : null,
    originalGuardada: { titulo: Boolean(bruto.original_title), miniatura: miniaturaGuardada },
  })
}
