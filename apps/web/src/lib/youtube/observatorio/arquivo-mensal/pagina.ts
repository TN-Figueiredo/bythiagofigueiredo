/** Manutenção M5, Tarefa 7 (04 §14.2): o leitor da página do Arquivo. Zod `.strict()` sobre a forma de `obs_archive_pagina` (m5.sql PARTE 2); chave a mais ou a menos = fora do esquema. */
import { avisarFuncaoAusente } from './funcao-ausente'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

const ts = z.string().nullable()
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
/** Só as três classes da página; o vídeo antigo e o ensaio nunca chegam aqui (Phil M4). */
const Classe = z.enum(['horaria', 'serie', 'texto'])

/** O `b2` de cada mês: lista fechada, SEM `por` (uuid de pessoa; Phil r3 N5). Sem registro só vêm `atestada_em` e `retirada`. */
const B2 = z.object({
  atestada_em: ts.optional(), via: z.string().nullable().optional(), forja_ok_at: ts.optional(), dono_ok_at: ts.optional(), forja_divergiu_em: ts.optional(),
  retirada: z.object({ em: ts, motivo: z.string().nullable(), via: z.string().nullable() }).strict().nullable().optional(),
  ultima_tentativa: z.object({ em: ts, resultado: z.string().nullable(), via: z.string().nullable() }).strict().optional(),
  idade_dias: z.number().nullable().optional(),
}).strict()

const LinhaMes = z.object({
  class: Classe, table_name: z.string(), month: dia, devido_em: dia, tem_linha: z.boolean(),
  sealed_at: ts, sealed_kind: z.string().nullable(), unsealed_at: ts, unsealed_reason: z.string().nullable(),
  nas_attested_at: ts, manifest_nas_withdrawn_at: ts,
  b2_attested_at: ts, b2_attested_via: z.string().nullable(), b2_forja_ok_at: ts, b2_dono_ok_at: ts, b2_forja_diverged_at: ts,
  b2_withdrawn_at: ts, b2_withdrawn_reason: z.string().nullable(), b2_last_attempt_at: ts, b2_last_attempt_result: z.string().nullable(),
  detached_at: ts, dropped_at: ts, closed_at: ts,
  rows_total: z.number().nullable(), units_total: z.number().nullable(), units_empty: z.number().nullable(), days_measured: z.number().nullable(), days_in_month: z.number().nullable(),
  rows_dropped: z.number().nullable(), bytes_freed: z.number().nullable(),
  reattach_out_of_order: z.boolean(),
  b2: B2,
}).strict()

const Casa = z.object({
  worker: z.string(), last_poll_at: ts, updated_at: ts, version: z.unknown(), machine_time: z.unknown(), stopped_at_cap: z.unknown(),
  nas_ok: z.boolean().nullable(), nas_checked_at: ts, last_error: z.string().nullable(),
  livre_bytes: z.unknown(), total_bytes: z.unknown(), sentinel_ok: z.unknown(), mounts_ok: z.unknown(),
}).strict()

const Pagina = z.object({
  versao: z.literal(1), lido_em: z.string(), hoje: dia,
  casa: z.array(Casa),
  classes: z.array(z.object({ class: Classe, first_month: dia.nullable(), released: z.boolean(), window_months: z.number(), seal_margin_days: z.number(), wait_days: z.number() }).strict()),
  online_since: z.array(z.object({ class: z.string(), table_name: z.string(), online_since: dia.nullable(), divergencia: z.boolean() }).strict()),
  meses: z.array(LinhaMes),
  progresso: z.array(z.object({ class: Classe, month: dia, canais_esperados: z.number(), canais_prontos: z.number(), canais_perdidos: z.number() }).strict()),
  recuperacao: z.array(z.object({ class: Classe, table_name: z.string(), done_at: ts, schema_fp: z.string().nullable(), schema_fp_atual: z.string().nullable(), diff_rows: z.number().nullable() }).strict()),
  meses_a_frente: z.array(z.object({ table_name: z.string(), months_ahead: z.number().nullable(), last_month: dia.nullable(), converted_at: ts }).strict()),
  teste: z.object({
    aberto: z.boolean(),
    meses: z.array(z.object({ month: dia, sealed_at: ts, nas_attested_at: ts, b2_attested_at: ts, detached_at: ts, dropped_at: ts, closed_at: ts }).strict()),
    encerrado_em: ts,
  }).strict(),
  vermelhos: z.array(z.string()),
  atraso: z.object({ amarelos: z.number(), vermelhos: z.number(), mais_antiga: dia.nullable(), meses_sem_selo: z.number() }).strict(),
  teto_b2: z.enum(['verde', 'ambar', 'vermelho']),
}).strict()

/** A lista fechada das chaves de cada elemento de `meses` e de `casa` (o teste de integração compara com a saída real do SQL). */
export const CHAVES_LINHA_MES: readonly string[] = Object.keys(LinhaMes.shape)
export const CHAVES_CASA: readonly string[] = Object.keys(Casa.shape)
export type PaginaLida = z.infer<typeof Pagina>
export type LinhaMesLida = z.infer<typeof LinhaMes>
export type ResultadoPagina = { ok: true; pagina: PaginaLida } | { ok: false; porque: 'funcao_ausente' | 'erro_do_banco' | 'fora_do_esquema' }

export function lerPaginaBruta(bruto: unknown): ResultadoPagina {
  const r = Pagina.safeParse(bruto)
  return r.success ? { ok: true, pagina: r.data } : { ok: false, porque: 'fora_do_esquema' }
}

/** Nunca lança. Função ausente (migration ainda não subiu): a aba nem aparece; com OBS_ARQUIVO=on vai um aviso ao Sentry (Phil I5). O resto vai ao Sentry como erro. */
export async function lerPagina(sb: SupabaseClient, siteId: string): Promise<ResultadoPagina> {
  let res: { data: unknown; error: { code?: string } | null }
  try { res = await sb.rpc('obs_archive_pagina', { p_site: siteId }) } catch {
    Sentry.captureMessage('obs_archive_pagina: exceção ao chamar o rpc', 'error')
    return { ok: false, porque: 'erro_do_banco' }
  }
  if (res.error) {
    if (res.error.code === '42883' || res.error.code === 'PGRST202') { avisarFuncaoAusente('obs_archive_pagina'); return { ok: false, porque: 'funcao_ausente' } }
    Sentry.captureMessage('obs_archive_pagina falhou: ' + (res.error.code ?? 'sem código'), 'error')
    return { ok: false, porque: 'erro_do_banco' }
  }
  const r = lerPaginaBruta(res.data)
  if (!r.ok) Sentry.captureMessage('obs_archive_pagina fora do esquema', 'error')
  return r
}
