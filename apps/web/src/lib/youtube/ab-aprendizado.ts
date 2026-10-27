/**
 * M7b P2: fonte única de "o vencedor que ensina". Os três leitores de aprendizado usam esta função:
 * `getLearnings` e `getChannelLearnings` (CMS) e `getAbLearnings` (Cowork/MCP). Assim o mesmo número
 * sai igual nos dois caminhos.
 *
 * Conta o vencedor ESTATÍSTICO (`result_metadata.v2.vencedor_sugerido`), nunca a escolha do dono.
 * Sem sugerida (inconclusivo ou regra antiga), vale o `winner_variant_id`. A original vencedora
 * ("não mudar nada") não ensina tag, e sem vencedor nenhum o teste não conta.
 */
export interface VarianteDoAprendizado {
  id: unknown
  is_original?: unknown
}

export interface TesteDoAprendizado {
  winner_variant_id?: unknown
  result_metadata?: unknown
}

export function vencedorQueEnsina(
  teste: TesteDoAprendizado,
  variantesDoTeste: ReadonlyArray<VarianteDoAprendizado>,
): string | null {
  const sug = (teste.result_metadata as { v2?: { vencedor_sugerido?: string | null } } | null | undefined)?.v2?.vencedor_sugerido
  // A sugerida só vale se for variante DESTE teste.
  const sugVar = sug ? variantesDoTeste.find(v => v.id === sug) : undefined
  const efetivo = sugVar ? sug! : ((teste.winner_variant_id as string | null | undefined) ?? null)
  if (!efetivo) return null
  const v = variantesDoTeste.find(x => x.id === efetivo)
  if (v?.is_original === true) return null
  return efetivo
}
