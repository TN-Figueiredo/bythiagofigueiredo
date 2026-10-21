import type { SupabaseClient } from '@supabase/supabase-js'
import type { ModoPausaDetectado } from './flag'

/** Linha aberta (`estado = 'em_andamento'`) do registro do teste nativo do YouTube. Confirmada = `confirmado_em` não nulo. */
export interface LinhaAberta { id: string; video_id: string; confirmado_em: string | null; updated_at: string }

export type DecisaoGuarda =
  | { acao: 'seguir' }
  | { acao: 'seguir_e_anotar'; nativeTestId: string }
  | { acao: 'pausar_sem_escrever'; nativeTestId: string; motivo: 'confirmado' | 'detectado' }

/** Dias depois do lembrete enviado antes de fechar por silêncio (r2, Phil I2). */
export const MARGEM_FECHAMENTO_DIAS = 2

const PAGINA = 1000
const MAX_PAGINAS = 60
const LOTE_UUIDS = 100

const ehLinha = (x: unknown): x is LinhaAberta => {
  if (typeof x !== 'object' || x === null) return false
  const r = x as Record<string, unknown>
  return typeof r.id === 'string' && typeof r.video_id === 'string' && typeof r.updated_at === 'string' && (r.confirmado_em === null || typeof r.confirmado_em === 'string')
}

/**
 * Uma consulta (em lotes de 100 ids, paginada) às linhas abertas do site para os vídeos pedidos. UM SITE por chamada:
 * quem tem testes de vários sites agrupa e chama uma vez por site. Erro do banco = `{ ok: false }`, nunca mapa vazio (falha fechada).
 */
export async function bloqueadoPorTesteNativo(
  sb: SupabaseClient, siteId: string, videoIds: readonly string[],
): Promise<{ ok: true; linhas: Map<string, LinhaAberta> } | { ok: false; erro: string }> {
  const linhas = new Map<string, LinhaAberta>()
  const ids = [...new Set(videoIds)]
  try {
    for (let i = 0; i < ids.length; i += LOTE_UUIDS) {
      const lote = ids.slice(i, i + LOTE_UUIDS)
      for (let p = 0; p < MAX_PAGINAS; p++) {
        const r = await sb.from('ab_native_tests')
          .select('id, video_id, confirmado_em, updated_at')
          .eq('site_id', siteId).eq('estado', 'em_andamento').in('video_id', lote)
          .order('id', { ascending: true })
          .range(p * PAGINA, p * PAGINA + PAGINA - 1)
        if (r.error) return { ok: false, erro: `leitura de ab_native_tests falhou: ${r.error.message}` }
        const dados = (r.data ?? []) as unknown[]
        for (const d of dados) {
          if (!ehLinha(d)) return { ok: false, erro: 'linha de ab_native_tests em formato inesperado' }
          linhas.set(d.video_id, d)
        }
        if (dados.length < PAGINA) break
      }
    }
  } catch (e) {
    return { ok: false, erro: `leitura de ab_native_tests lançou: ${e instanceof Error ? e.message : String(e)}` }
  }
  return { ok: true, linhas }
}

/** Confirmada pausa nos três modos; detectada: `off` segue, `log` segue e anota, `on` pausa. */
export function decidirGuarda(linha: LinhaAberta | undefined, modo: ModoPausaDetectado): DecisaoGuarda {
  if (!linha) return { acao: 'seguir' }
  if (linha.confirmado_em !== null) return { acao: 'pausar_sem_escrever', nativeTestId: linha.id, motivo: 'confirmado' }
  if (modo === 'on') return { acao: 'pausar_sem_escrever', nativeTestId: linha.id, motivo: 'detectado' }
  if (modo === 'log') return { acao: 'seguir_e_anotar', nativeTestId: linha.id }
  return { acao: 'seguir' }
}

/** Início do teste nativo: o menor não nulo entre `primeira_vista` e `confirmado_em`; sem nenhum, `created_at`. */
export function inicioDoTeste(r: { primeira_vista: string | null; confirmado_em: string | null; created_at: string }): Date {
  const cands = [r.primeira_vista, r.confirmado_em]
    .filter((x): x is string => x !== null)
    .map((x) => Date.parse(x))
    .filter((n) => Number.isFinite(n))
  return new Date(cands.length ? Math.min(...cands) : Date.parse(r.created_at))
}
