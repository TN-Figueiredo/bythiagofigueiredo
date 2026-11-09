import type { Client } from 'pg'

/**
 * Roda `fn` dentro de uma transação que SEMPRE termina em rollback, com o papel `authenticated` e o JWT do usuário
 * (auth.uid() = userId). Para `anon` passe userId = null. Nunca chame aqui função sem EXECUTE para o papel (derruba o
 * Postgres local); confira por has_function_privilege.
 */
export async function comoUsuario<T>(
  pg: Client,
  userId: string | null,
  fn: (q: Client['query']) => Promise<T>,
  appRole?: string,
): Promise<T> {
  await pg.query('begin')
  try {
    const claims = userId
      ? { role: 'authenticated', sub: userId, ...(appRole ? { app_metadata: { role: appRole } } : {}) }
      : { role: 'anon' }
    await pg.query(`select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)`, [
      JSON.stringify(claims),
      userId ?? '',
    ])
    await pg.query(`set local role ${userId ? 'authenticated' : 'anon'}`)
    return await fn(pg.query.bind(pg))
  } finally {
    await pg.query('rollback')
  }
}

/** Tenta a operação num savepoint; devolve linhas afetadas/lidas ou o código do erro. */
export async function tentar(
  pg: Client,
  sql: string,
  params: unknown[] = [],
): Promise<{ rows: number; code: string | null }> {
  await pg.query('savepoint t')
  try {
    const r = await pg.query(sql, params)
    await pg.query('release savepoint t')
    return { rows: r.rowCount ?? 0, code: null }
  } catch (e) {
    await pg.query('rollback to savepoint t')
    return { rows: 0, code: (e as { code?: string }).code ?? 'erro' }
  }
}
