/** Manutenção M5, Tarefa 11 (Phil I9, Yannis I-10): o leitor leve do chrome. Lê SÓ `obs_archive_aviso` (nunca `obs_archive_pagina`/`ModeloPagina`).
 *  Chamado só depois da guarda de edição. Zod `.strict()` sobre a forma de m5.sql PARTE 2. Cache de 60 s por site (a 1ª leitura do minuto é cara: ver ledger T2). */
import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { observatoryTag } from '../cache-tag'

const ts = z.string().nullable()
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const AvisoLeveSchema = z.object({
  versao: z.literal(1),
  lido_em: z.string(),
  hoje: dia,
  proximo_mes: z.object({ class: z.string(), month: dia, pronto_em: dia }).strict().nullable(),
  primeira_devida_em: dia.nullable(),
  ultima_copia: ts,
  casa: z.array(z.object({ worker: z.string(), last_poll_at: ts, updated_at: ts, nas_ok: z.boolean().nullable(), nas_checked_at: ts }).strict()),
  vermelhos_n: z.number(),
  atraso: z.object({ amarelos: z.number(), vermelhos: z.number(), mais_antiga: dia.nullable(), meses_sem_selo: z.number() }).strict(),
}).strict()

export type AvisoLeve = z.infer<typeof AvisoLeveSchema>
export type LeituraAvisoLeve = { ok: true; leve: AvisoLeve } | { ok: false; porque: 'funcao_ausente' | 'erro_do_banco' }

async function buscar(siteId: string): Promise<LeituraAvisoLeve> {
  let res: { data: unknown; error: { code?: string } | null }
  try { res = await getSupabaseServiceClient().rpc('obs_archive_aviso', { p_site: siteId }) } catch {
    Sentry.captureMessage('obs_archive_aviso: exceção', 'error')
    return { ok: false, porque: 'erro_do_banco' }
  }
  if (res.error) {
    if (res.error.code === '42883' || res.error.code === 'PGRST202') return { ok: false, porque: 'funcao_ausente' }
    Sentry.captureMessage('obs_archive_aviso: ' + (res.error.code ?? 'sem código'), 'error')
    return { ok: false, porque: 'erro_do_banco' }
  }
  const r = AvisoLeveSchema.safeParse(res.data)
  if (!r.success) { Sentry.captureMessage('obs_archive_aviso fora do esquema', 'error'); return { ok: false, porque: 'erro_do_banco' } }
  return { ok: true, leve: r.data }
}

/** Nunca lança. */
export async function lerAvisoLeve(siteId: string): Promise<LeituraAvisoLeve> {
  return unstable_cache(() => buscar(siteId), ['arquivo-aviso-leve', siteId], { revalidate: 60, tags: [observatoryTag(siteId)] })()
}
