/**
 * A5 · X3: a migration de playlists e seções NÃO fica aplicada de vez no `bythiago_int` (banco compartilhado entre worktrees:
 * com as cinco tabelas presentes, o `garantirMg6` de outro worktree reaplicaria a MG6 e deixaria o registro do export em 22).
 * Os testes aplicam o texto da migration DENTRO da transação de cada teste (que termina em `rollback`), duas vezes
 * (idempotência provada por teste). `E10_X3_ARQUIVO` aponta o helper para outro arquivo.
 */
import type { Client } from 'pg'
import { iniciarComMg6 } from './mg6'
import { lerSqlDaX3 } from './x3-sql'

export { caminhoDaX3, lerSqlDaX3, lerX3Registro } from './x3-sql'

/** Aplica a migration da X3 na transação aberta (2 vezes: a segunda prova a idempotência). Depois de `garantirMg6`. */
export async function garantirX3(c: Client): Promise<void> {
  const sql = lerSqlDaX3()
  await c.query(sql)
  await c.query(sql)
}

/** `begin` + MG6 + X3; o chamador termina com `rollback`. */
export async function iniciarComX3(c: Client): Promise<void> {
  await iniciarComMg6(c)
  try {
    await garantirX3(c)
  } catch (e) {
    await c.query('rollback')
    throw e
  }
}

export async function emTransacaoComX3<T>(c: Client, fn: () => Promise<T>): Promise<T> {
  await iniciarComX3(c)
  try {
    return await fn()
  } finally {
    await c.query('rollback')
  }
}
