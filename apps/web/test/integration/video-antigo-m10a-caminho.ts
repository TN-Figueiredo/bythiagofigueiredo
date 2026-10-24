// M10a: o ÚNICO lugar que a Tarefa 5b muda (M10A_SQL aponta para a migration e M10A_EM_MIGRATION vira true).
// Caminho relativo a este arquivo, nunca ao cwd (muda entre `npm test -w` e `npx vitest` da raiz).
import path from 'node:path'
import pg from 'pg'

export const M10A_SQL = path.resolve(__dirname, '../../../../supabase/rascunhos/m10a.sql')
export const M10A_EM_MIGRATION = false

/** O rascunho já foi aplicado neste banco? (coluna do toco existe em competitor_videos). Sem banco, false. */
export async function m10aNoBanco(): Promise<boolean> {
  const url = process.env.SUPABASE_DB_URL
  if (!url) return false
  const c = new pg.Client({ connectionString: url })
  await c.connect()
  try {
    const r = await c.query(`select 1 from information_schema.columns where table_schema = 'public' and table_name = 'competitor_videos' and column_name = 'archive_frozen_at'`)
    return r.rowCount === 1
  } finally {
    await c.end()
  }
}

/** Valem as chaves novas da M10a (ignorados_congelados, arquivados, videos_*)? true com a migration no repositório ou o rascunho já aplicado no banco. */
export async function m10aAtiva(): Promise<boolean> {
  return M10A_EM_MIGRATION || (await m10aNoBanco())
}
