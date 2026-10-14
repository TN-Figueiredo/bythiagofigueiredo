// Leitura paginada de uma consulta do Supabase: o PostgREST corta cada resposta em 1.000 linhas,
// e cortar em silêncio faria o passo concluir sobre dado incompleto. Aqui passar do teto é falha.
// Sem `server-only` e sem importar o Observatório: é um utilitário puro da coleta.

import type { ErroBanco } from './schema'

export const TAMANHO_PAGINA = 1000

export type LeituraPaginada<T> =
  | { ok: true; linhas: T[] }
  | { ok: false; motivo: 'erro_de_banco' | 'passou_do_teto'; lidas: number; detalhe?: string }

/**
 * Lê páginas de 1.000 por `.range(de, ate)` (limites inclusivos) até uma página vir com menos de 1.000.
 * Falha, sem devolver linha nenhuma, quando o total passa de `teto` ou quando uma página dá erro.
 * `lidas` diz quantas linhas já tinham chegado. `detalhe` (português) explica a recusa de teto inválido e de `data` nula.
 * O chamador ordena a consulta por chave única (sem `order` determinístico, `.range` duplica ou perde linha entre páginas).
 */
export async function lerPaginado<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: ErroBanco | null }>,
  teto: number,
): Promise<LeituraPaginada<T>> {
  // Teto que não é número finito positivo faria `linhas.length > teto` nunca valer: recusa antes de ler.
  if (!Number.isFinite(teto) || teto <= 0) {
    return { ok: false, motivo: 'passou_do_teto', lidas: 0, detalhe: 'teto de leitura inválido (precisa ser um número finito maior que zero)' }
  }
  const linhas: T[] = []
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    let res: { data: T[] | null; error: ErroBanco | null }
    try {
      res = await pagina(de, de + TAMANHO_PAGINA - 1)
    } catch {
      return { ok: false, motivo: 'erro_de_banco', lidas: linhas.length }
    }
    if (res.error) return { ok: false, motivo: 'erro_de_banco', lidas: linhas.length }
    // Resposta sem lista NÃO é lista vazia: `[]` é vazio de verdade, `null` é dado ausente.
    if (res.data === null) {
      return { ok: false, motivo: 'erro_de_banco', lidas: linhas.length, detalhe: 'o banco respondeu sem lista (data nula, sem erro)' }
    }
    const dados = res.data
    for (const l of dados) linhas.push(l)
    if (linhas.length > teto) return { ok: false, motivo: 'passou_do_teto', lidas: linhas.length }
    if (dados.length < TAMANHO_PAGINA) return { ok: true, linhas }
  }
}
