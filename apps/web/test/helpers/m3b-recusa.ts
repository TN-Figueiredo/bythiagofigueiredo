/** M3b-recusa: o SQL vive em supabase/rascunhos/m3b-recusa.sql até o Passo 6 (migration). Este é o único lugar que o Passo 6 muda. */
import type { Client } from 'pg'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { travarDdl } from './ddl-testes'

const MIGRATIONS = resolve(__dirname, '../../../../supabase/migrations')
const RASCUNHO = resolve(__dirname, '../../../../supabase/rascunhos/m3b-recusa.sql')
export const RECUSA_DESFAZER_CAMINHO: string = resolve(__dirname, '../../../../supabase/rascunhos/m3b-recusa-desfazer.sql')
const NA_MIGRATION = readdirSync(MIGRATIONS).find(n => n.endsWith('_manutencao_m3b_recusa.sql'))
export const RECUSA_EM_MIGRATION: boolean = NA_MIGRATION !== undefined
export const RECUSA_SQL_CAMINHO: string = NA_MIGRATION ? resolve(MIGRATIONS, NA_MIGRATION) : RASCUNHO
export const RECUSA_SQL = (): string => {
  if (!existsSync(RECUSA_SQL_CAMINHO)) throw new Error(`recusa ausente: ${RECUSA_SQL_CAMINHO}`)
  return readFileSync(RECUSA_SQL_CAMINHO, 'utf8')
}
export const MD5_PARTIDA = { video: '8c6d51b2ae774671c2fa15c3e8d48535', comentarios: '2233c4edb3613594ed363ed68eb2378a' } as const
export const MD5_COM_RECUSA = { video: 'ef1c5f6ec42164c59b9b0652edc88cbc', comentarios: '07cd637de2ded4cc0f5e2ebcb71b2e22' } as const
/** md5 do prosrc do helper (com Phil M1: volatile + lock share). Recalculado em 25/10 (o do plano, 2d3032fc…, era sem o lock). */
export const MD5_HELPER = '5bc4e78c923a996a4c807ca53c201130'

/** Aplica o SQL da recusa (idempotente). Dentro de transação desfeita; pega a trava de DDL dos testes. */
export async function aplicarRecusa(c: Client): Promise<void> {
  await travarDdl(c)
  await c.query(RECUSA_SQL())
}
export async function desfazerRecusa(c: Client): Promise<void> {
  await travarDdl(c)
  // o arquivo traz begin/commit próprios (atômico fora do teste); dentro da transação do teste tiramos os dois
  await c.query(readFileSync(RECUSA_DESFAZER_CAMINHO, 'utf8').replace(/^begin;$/m, '').replace(/^commit;$/m, ''))
}
