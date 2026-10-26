/** Manutenção M5 (02 §10.4, itens 34, 35, 81): desde quando cada série está online. Nulo = nada saiu. Não lido = "não medido", nunca 365 dias. */
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { spDateStart } from '../time'

export type TabelaDaSerie = 'competitor_video_daily' | 'competitor_video_early' | 'competitor_video_hourly'
const TABELAS: readonly TabelaDaSerie[] = ['competitor_video_daily', 'competitor_video_early', 'competitor_video_hourly']
export type OnlineDesde =
  | { lido: true; porTabela: Record<TabelaDaSerie, number | null> }
  | { lido: false; porque: 'funcao_ausente' | 'erro_do_banco' | 'fora_do_esquema' }
const DIA = 86_400_000
/** Dias de cada mês de um ano não bissexto, em sequência circular: a menor soma de n meses seguidos é a garantia de dias online. */
const MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
export function minDias(meses: number): number {
  let menor = Infinity
  for (let i = 0; i < 12; i++) { let s = 0; for (let k = 0; k < meses; k++) s += MES[(i + k) % 12]!; menor = Math.min(menor, s) }
  return menor
}
/** Dias online garantidos pela política: a soma mínima de `window_months` meses seguidos (181 para a série, 89 para a horária). */
export const JANELA_MINIMA_DIAS: Record<TabelaDaSerie, number> = { competitor_video_daily: minDias(6), competitor_video_early: minDias(6), competitor_video_hourly: minDias(3) }
const Linha = z.object({ class: z.string(), table_name: z.string(), online_since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), divergencia: z.boolean() }).strict()
const NADA_SAIU: OnlineDesde = { lido: true, porTabela: { competitor_video_daily: null, competitor_video_early: null, competitor_video_hourly: null } }

export function lerOnlineDesdeBruto(bruto: unknown): OnlineDesde {
  const r = z.array(Linha).safeParse(bruto)
  if (!r.success || r.data.some(l => l.divergencia)) return { lido: false, porque: 'fora_do_esquema' }
  const por = new Map(r.data.map(l => [l.table_name, l.online_since]))
  if (!TABELAS.every(t => por.has(t))) return { lido: false, porque: 'fora_do_esquema' }
  const porTabela = Object.fromEntries(TABELAS.map(t => { const d = por.get(t); return [t, d == null ? null : spDateStart(d)] })) as Record<TabelaDaSerie, number | null>
  return { lido: true, porTabela }
}

/** `saidaDeMesExiste` é obrigatório (sem default, para o teste não ser vazio): o chamador servidor passa `SAIDA_DE_MES_EXISTE` de `capacidades.ts` (que é 'server-only'; este módulo continua puro). */
export async function lerOnlineDesde(sb: SupabaseClient, siteId: string, saidaDeMesExiste: boolean): Promise<OnlineDesde> {
  // nunca lança: a leitura do online desde não derruba a página (falha vira "não lido")
  let res: { data: unknown; error: { code?: string } | null }
  try { res = await sb.rpc('obs_archive_online_since', { p_site: siteId }) } catch (e) {
    Sentry.captureException(e, { tags: { component: 'observatorio', step: 'online-desde' } })
    return { lido: false, porque: 'erro_do_banco' }
  }
  const { data, error } = res
  if (error) {
    if (error.code === '42883' || error.code === 'PGRST202') {
      if (!saidaDeMesExiste) { Sentry.captureMessage('obs_archive_online_since ausente', 'warning'); return NADA_SAIU }
      Sentry.captureMessage('obs_archive_online_since ausente com saída de mês existindo', 'error')
      return { lido: false, porque: 'funcao_ausente' }
    }
    Sentry.captureMessage('obs_archive_online_since: ' + (error.code ?? 'sem código'), 'error')
    return { lido: false, porque: 'erro_do_banco' }
  }
  return lerOnlineDesdeBruto(data)
}

/** Início (ms, meia-noite SP) a partir do qual há série online garantida: o online desde; não lido, agora menos a janela mínima. */
export function inicioSeguro(o: OnlineDesde, t: TabelaDaSerie, now: number): number | null {
  return o.lido ? o.porTabela[t] : now - JANELA_MINIMA_DIAS[t] * DIA
}
