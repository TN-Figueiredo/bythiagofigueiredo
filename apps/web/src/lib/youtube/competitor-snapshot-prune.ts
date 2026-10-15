/**
 * A5 · E9, Tarefa 11a: a poda de 365 dias dos retratos diários de canal de concorrente (saiu de `app/api/cron/ab-watchdog/route.ts`, que não pode
 * exportar função avulsa). Regra "sem resposta o dado fica": canal que saiu do YouTube (`missing_since` preenchido, decidido ou não) NÃO é podado.
 *
 * Na dúvida não se apaga: leitura dos ausentes que falha, que traz menos linhas que a contagem, ou mais de 150 canais ausentes (a lista vai na URL,
 * ~37 caracteres por id) => nenhuma poda naquele disparo, com o motivo devolvido para o cron pôr na resposta.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const RETENCAO_DE_RETRATOS_DIAS = 365
export const MAX_CANAIS_AUSENTES_NA_PODA = 150

export interface ResultadoDaPoda { ok: boolean; motivo?: string }

export async function podarRetratosDeCanal(sb: SupabaseClient, agoraMs: number): Promise<ResultadoDaPoda> {
  try {
    const leitura = await sb.from('competitor_channels').select('id', { count: 'exact' }).not('missing_since', 'is', null).order('id').range(0, MAX_CANAIS_AUSENTES_NA_PODA)
    if (leitura.error || !Array.isArray(leitura.data) || leitura.count === null) return { ok: false, motivo: 'não foi possível ler os canais ausentes' }
    if (leitura.count > MAX_CANAIS_AUSENTES_NA_PODA) return { ok: false, motivo: `mais de ${MAX_CANAIS_AUSENTES_NA_PODA} canais ausentes (${leitura.count})` }
    const ids: string[] = []
    for (const l of leitura.data as unknown[]) {
      if (typeof l === 'object' && l !== null && typeof (l as Record<string, unknown>).id === 'string') ids.push(String((l as Record<string, unknown>).id))
    }
    if (ids.length !== leitura.count) return { ok: false, motivo: `${ids.length} canais ausentes lidos, contagem ${leitura.count}` }

    const limite = new Date(agoraMs - RETENCAO_DE_RETRATOS_DIAS * 86_400_000).toISOString().slice(0, 10)
    let apagar = sb.from('competitor_channel_snapshots').delete().lt('snapshot_date', limite)
    if (ids.length > 0) apagar = apagar.not('competitor_channel_id', 'in', `(${ids.join(',')})`)
    const r = await apagar
    if (r.error) return { ok: false, motivo: 'a poda de retratos falhou' }
    return { ok: true }
  } catch {
    return { ok: false, motivo: 'a poda de retratos lançou' }
  }
}
