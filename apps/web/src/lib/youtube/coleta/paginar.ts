// Leitura paginada de uma consulta do Supabase: o PostgREST corta cada resposta em 1.000 linhas,
// e cortar em silêncio faria o passo concluir sobre dado incompleto. Aqui passar do teto é falha.
// Sem `server-only` e sem importar o Observatório: é um utilitário puro da coleta.

import type { ErroBanco } from './schema'

export const TAMANHO_PAGINA = 1000

export type LeituraPaginada<T> =
  | { ok: true; linhas: T[] }
  | { ok: false; motivo: 'erro_de_banco' | 'passou_do_teto'; lidas: number }

/**
 * Lê páginas de 1.000 por `.range(de, ate)` (limites inclusivos) até uma página vir com menos de 1.000.
 * Falha, sem devolver linha nenhuma, quando o total passa de `teto` ou quando uma página dá erro.
 * `lidas` diz quantas linhas já tinham chegado.
 */
export async function lerPaginado<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: ErroBanco | null }>,
  teto: number,
): Promise<LeituraPaginada<T>> {
  const linhas: T[] = []
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    let res: { data: T[] | null; error: ErroBanco | null }
    try {
      res = await pagina(de, de + TAMANHO_PAGINA - 1)
    } catch {
      return { ok: false, motivo: 'erro_de_banco', lidas: linhas.length }
    }
    if (res.error) return { ok: false, motivo: 'erro_de_banco', lidas: linhas.length }
    const dados = res.data ?? []
    for (const l of dados) linhas.push(l)
    if (linhas.length > teto) return { ok: false, motivo: 'passou_do_teto', lidas: linhas.length }
    if (dados.length < TAMANHO_PAGINA) return { ok: true, linhas }
  }
}
