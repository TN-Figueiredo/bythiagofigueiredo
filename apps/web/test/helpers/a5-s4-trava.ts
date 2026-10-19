import type { Client } from 'pg'

/**
 * Trava de sessão única da S4: os 4 arquivos `a5-s4-watch-*` apagam e escrevem `yt_watch_*` INTEIRAS, então não podem
 * rodar ao mesmo tempo (o vitest roda arquivos em forks). A conexão `pg` de cada arquivo é dedicada; o `pg_advisory_lock`
 * de sessão espera a vez e é liberado no `afterAll` (ou quando a conexão fecha).
 */
export const TRAVA_S4_WATCH = 4_505_004_001

export async function travarS4(pg: Client): Promise<void> {
  await pg.query('select pg_advisory_lock($1::bigint)', [TRAVA_S4_WATCH])
}
export async function destravarS4(pg: Client): Promise<void> {
  try { await pg.query('select pg_advisory_unlock($1::bigint)', [TRAVA_S4_WATCH]) } catch { /* a conexão caiu: o banco solta a trava */ }
}
