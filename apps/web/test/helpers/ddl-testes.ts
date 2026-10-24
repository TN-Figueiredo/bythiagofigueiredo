import type { Client } from 'pg'

/**
 * Yannis N4 (2ª rodada, M3b-site): quem aplica DDL (M2, MG6, M3b) em transação desfeita, em vários arquivos ao mesmo tempo
 * (`HAS_LOCAL_DB=1 npm test` é paralelo), dá deadlock e `tuple concurrently updated`. Todo aplicador pega este lock de transação ANTES de
 * tocar no catálogo: os arquivos passam a se enfileirar em vez de se travar. Fora de transação o lock solta no mesmo instante (inofensivo).
 * (Fica fora de `m2.ts` de propósito: o envio de 23/10 não mexe nos arquivos do grupo M2.)
 */
export const TRAVA_DDL_TESTES = 7339001
export async function travarDdl(c: Client): Promise<void> {
  await c.query('select pg_advisory_xact_lock($1)', [TRAVA_DDL_TESTES])
}

/**
 * Garante as partições mensais de competitor_video_daily para [de, de + dias - 1] (Yannis N1, 2ª rodada): em banco NOVO (db reset, como a CI) a M2
 * só cria a partição do mês de min(coluna) até +12, então uma semeadura em mês antigo falha com "no partition of relation". Idempotente; no-op se a
 * tabela não é particionada ou se obs_part.criar_particao ainda não existe (M2 não aplicada).
 */
export async function garantirParticoesDaDiaria(c: Client, de: string, dias: number): Promise<void> {
  const ok = await c.query(
    `select to_regprocedure('obs_part.criar_particao(regclass,date)') is not null
        and coalesce((select relkind::text from pg_class where oid = 'public.competitor_video_daily'::regclass), '') = 'p' as vale`)
  if (!ok.rows[0].vale) return
  const meses = await c.query(
    `select g::date::text as mes from generate_series(date_trunc('month', $1::date), date_trunc('month', $1::date + ($2::int - 1)), interval '1 month') g`, [de, dias])
  for (const m of meses.rows) await c.query(`select obs_part.criar_particao('public.competitor_video_daily'::regclass, $1::date)`, [m.mes])
}
