// Numeração das versões do dia 14 (§5.3): a tela e o servidor contam pelas mesmas funções. Módulo puro (zod + schema da ficha +
// normalizador): nada de Sentry nem notificações, para o bundle do cliente não arrastar código de servidor.
import { z } from 'zod'
import { VarianteFichaSchema, type VarianteFicha } from './ficha-schema'
import { normalizarTitulo } from '../normalizar-titulo'

export type RespostaDono = 'venceu_nova' | 'venceu_original' | 'ficou_igual' | 'inconclusivo' | 'nao_vi'
export const MOTIVO_RESPOSTA_DO_DONO = 'resposta_do_dono'
/** `originalConhecido`: a ficha sempre sabe qual é o original (n = 1); a derivada só quando o título de antes casa com um título visto. */
export type VariantesDaResposta = { itens: VarianteFicha[]; origem: 'ficha' | 'derivada'; originalConhecido: boolean }
export type PatchDaResposta =
  | { sempre: Record<string, unknown>; seEmAndamento: Record<string, unknown> }
  | { erro: 'variante_invalida' }

/**
 * Linha `detectado` confirmada pelo "Confirmar" (sem ficha): monta `{n, tipo titulo, titulo}` de `variantes_titulo`.
 * `tituloAntes` é o título vigente na Data API em `primeira_vista` (D-1), NUNCA `titulo_oficial` (o Studio pode ter aplicado o vencedor).
 */
export function derivadasDeVariantesTitulo(
  variantesTitulo: unknown, tituloAntes: string | null,
): { itens: VarianteFicha[]; originalConhecido: boolean } | null {
  const t = z.array(z.string().trim().min(1)).min(1).max(3).safeParse(variantesTitulo)
  if (!t.success) return null
  const alvo = tituloAntes === null ? null : normalizarTitulo(tituloAntes)
  const par = alvo === null ? -1 : t.data.findIndex((x) => normalizarTitulo(x) === alvo)
  const ordem = par < 0 ? t.data : [t.data[par]!, ...t.data.filter((_, i) => i !== par)]
  return { itens: ordem.map((titulo, i) => ({ n: i + 1, tipo: 'titulo' as const, titulo })), originalConhecido: par >= 0 }
}

export function variantesDaResposta(l: { variantes: unknown; variantes_titulo: unknown; titulo_antes: string | null }): VariantesDaResposta | null {
  if (l.variantes !== null && l.variantes !== undefined) {
    const f = z.array(VarianteFichaSchema).safeParse(l.variantes)
    return f.success && f.data.length > 0 ? { itens: f.data, origem: 'ficha', originalConhecido: true } : null
  }
  const d = derivadasDeVariantesTitulo(l.variantes_titulo, l.titulo_antes)
  return d ? { itens: d.itens, origem: 'derivada', originalConhecido: d.originalConhecido } : null
}

export function patchDaResposta(r: RespostaDono, n: number | null, variantes: VariantesDaResposta | null): PatchDaResposta {
  const base = { resposta_dono: r }
  const encerra = (desfecho_estado: string, estado: string, extra: Record<string, unknown>) => ({
    estado, desfecho_estado, desfecho_motivo: MOTIVO_RESPOSTA_DO_DONO, ...extra,
  })
  if (r === 'venceu_nova') {
    if (!variantes || n === null || !Number.isInteger(n) || n < 1 || n > 3) return { erro: 'variante_invalida' }
    // Com o original conhecido (ficha ou derivada casada), n = 1 é o original e não "a nova". Sem ele, a posição é só a ordem vista.
    if (variantes.originalConhecido && n < 2) return { erro: 'variante_invalida' }
    const v = variantes.origem === 'derivada' ? variantes.itens[n - 1] : variantes.itens.find((x) => x.n === n)
    if (!v) return { erro: 'variante_invalida' }
    return { sempre: { ...base, variante_vencedora: n }, seEmAndamento: encerra('vencedor_provavel', 'encerrado', { vencedor_titulo: v.titulo ?? null, vencedor_fonte: 'dono' }) }
  }
  if (r === 'venceu_original') {
    if (!variantes || !(variantes.origem === 'ficha' || (variantes.origem === 'derivada' && variantes.originalConhecido))) return { erro: 'variante_invalida' }
    const v = variantes.itens.find((x) => x.n === 1)
    if (!v) return { erro: 'variante_invalida' }
    return { sempre: { ...base, variante_vencedora: 1 }, seEmAndamento: encerra('vencedor_provavel', 'encerrado', { vencedor_titulo: v.titulo ?? null, vencedor_fonte: 'dono' }) }
  }
  const semVencedor = { vencedor_titulo: null, vencedor_fonte: null }
  return {
    sempre: { ...base, variante_vencedora: null },
    seEmAndamento: encerra('sem_dado', r === 'nao_vi' ? 'sem_desfecho' : 'encerrado', semVencedor),
  }
}
