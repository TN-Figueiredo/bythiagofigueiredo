// Contagem do título por grafema (Intl.Segmenter). Sem fonte oficial do YouTube para grafema x code point:
// regra registrada no ledger. Usada pelo contador da tela E pelo `.refine` do `VarianteFichaSchema` (mesma função nos dois lados).
export const LIMITE_TITULO = 100

const segmentador = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' })

export function contarCaracteresDoTitulo(s: string): number {
  let n = 0
  for (const _ of segmentador.segment(s)) n += 1
  return n
}
