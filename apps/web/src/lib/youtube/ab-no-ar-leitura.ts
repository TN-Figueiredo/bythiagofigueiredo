/**
 * Leitura do histórico de tentativas (`ab_test_restores`) para a fonte única do "no ar" (M7b T12). Só lê.
 * Pagina em 1000 e agrupa por teste; ordem `test_id, seq desc, campo` (o índice único é `(test_id, seq, campo)`: sem o desempate a
 * fronteira de página duplica ou perde linha). Erro de leitura nunca vira "sem histórico": devolve `ok: false`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CampoNome, EstadoCampo } from './ab-restore'
import type { TentativaNoAr } from './ab-no-ar'

export const PAGINA_RESTORES = 1000
export const LOTE_RESTORES = 100
const MAX_PAGINAS = 60

export type LidoRestores = { ok: true; porTeste: Map<string, TentativaNoAr[]> } | { ok: false; motivo: string }

interface Linha { test_id: string; seq: number; campo: CampoNome; destino: string; estado: EstadoCampo; escreveu: boolean | null; em: string }
const forma = (x: unknown): x is Linha => {
  if (typeof x !== 'object' || x === null) return false
  const r = x as Record<string, unknown>
  return typeof r.test_id === 'string' && typeof r.seq === 'number' && (r.campo === 'title' || r.campo === 'thumbnail')
    && typeof r.destino === 'string' && typeof r.estado === 'string' && (r.escreveu === null || typeof r.escreveu === 'boolean') && typeof r.em === 'string'
}

export async function lerHistoricoDeRestores(sb: SupabaseClient, ids: readonly string[]): Promise<LidoRestores> {
  const porTeste = new Map<string, TentativaNoAr[]>()
  const unicos = [...new Set(ids)]
  try {
    for (let i = 0; i < unicos.length; i += LOTE_RESTORES) {
      const lote = unicos.slice(i, i + LOTE_RESTORES)
      for (let p = 0; p < MAX_PAGINAS; p++) {
        const r = await sb.from('ab_test_restores').select('test_id, seq, campo, destino, estado, escreveu, motivo, iniciativa, em')
          .in('test_id', lote).order('test_id').order('seq', { ascending: false }).order('campo')
          .range(p * PAGINA_RESTORES, p * PAGINA_RESTORES + PAGINA_RESTORES - 1)
        if (r.error) return { ok: false, motivo: r.error.message }
        const data: unknown = r.data
        if (!Array.isArray(data) || !data.every(forma)) return { ok: false, motivo: 'ab_test_restores: resposta fora da forma' }
        for (const l of data) {
          const lista = porTeste.get(l.test_id) ?? []
          lista.push({ seq: l.seq, campo: l.campo, destino: l.destino, estado: l.estado, escreveu: l.escreveu, em: l.em })
          porTeste.set(l.test_id, lista)
        }
        if (data.length < PAGINA_RESTORES) break
        if (p === MAX_PAGINAS - 1) return { ok: false, motivo: 'ab_test_restores: linhas demais' }
      }
    }
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : 'leitura lançou' }
  }
  return { ok: true, porTeste }
}
