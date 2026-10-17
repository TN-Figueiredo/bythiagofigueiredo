/**
 * A5 · X3: a migration de playlists e seções NÃO fica aplicada de vez no `bythiago_int` (banco compartilhado entre worktrees:
 * com as cinco tabelas presentes, o `garantirMg6` de outro worktree reaplicaria a MG6 e deixaria o registro do export em 22).
 * Os testes aplicam o texto da migration DENTRO da transação de cada teste (que termina em `rollback`), duas vezes
 * (idempotência provada por teste). `E10_X3_ARQUIVO` aponta o helper para outro arquivo.
 */
import type { Client } from 'pg'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { iniciarComMg6 } from './mg6'

const MIGRATIONS = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url))

export function caminhoDaX3(): string {
  const v = process.env.E10_X3_ARQUIVO
  if (v && v.length > 0) return v
  const achados = readdirSync(MIGRATIONS).filter(n => n.endsWith('_observatorio_a5_x3_playlists_e_secoes.sql'))
  if (achados.length !== 1) throw new Error(`esperava 1 migration da X3, achei ${achados.length}`)
  return MIGRATIONS + achados[0]
}

export function lerSqlDaX3(): string {
  return readFileSync(caminhoDaX3(), 'utf8')
}

/** O trecho que recria o registro do export, entre os marcadores da migration. */
export function lerX3Registro(): string {
  const sql = lerSqlDaX3()
  const i = sql.indexOf('-- X3:REGISTRO:INICIO')
  const f = sql.indexOf('-- X3:REGISTRO:FIM')
  if (i < 0 || f < i) throw new Error('marcadores X3:REGISTRO não achados na migration')
  return sql.slice(i, f)
}

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
