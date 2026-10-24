import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContextoTarefa } from '@/lib/youtube/agenda/tipos'

/** Leitura paginada do observador (extraída de `passo.ts`; usada também pelo alarme em `avisos.ts`). */
export const PAGINA = 1000
const MAX_PAGINAS = 60

/** O prazo da tarefa acabou: quem chama decide se conta `sem_tempo`. */
export class SemTempo extends Error {}

export function ida(c: Pick<ContextoTarefa, 'agora'>, fimDuroMs: number): void {
  if (c.agora() >= fimDuroMs) throw new SemTempo()
}

export type Linha = Record<string, unknown>
export type Montar = (sb: SupabaseClient) => { range: (a: number, b: number) => PromiseLike<{ data: unknown; error: unknown; count: number | null }> }

/**
 * Páginas de 1000 com `count: 'exact'` e ordem estável (quem monta a consulta ordena). Erro de página LANÇA (`leitura_falhou`), nunca vira lista parcial;
 * total diferente das linhas lidas também lança (`paginacao`). `antes()` roda antes de cada página (prazo).
 */
export async function paginado(sb: SupabaseClient, antes: () => void, montar: Montar): Promise<Linha[]> {
  const out: Linha[] = []
  let total: number | null = null
  for (let p = 0; p < MAX_PAGINAS; p++) {
    antes()
    const r = await montar(sb).range(p * PAGINA, p * PAGINA + PAGINA - 1)
    if (r.error || !Array.isArray(r.data)) throw new Error('leitura_falhou')
    out.push(...(r.data as Linha[]))
    total = r.count
    if (r.data.length < PAGINA) break
  }
  if (total !== null && out.length !== total) throw new Error('paginacao')
  return out
}
