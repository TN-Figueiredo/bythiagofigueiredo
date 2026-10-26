/** Manutenção M5: o SQL vive em supabase/rascunhos/m5.sql até a Tarefa 13 (TRAVA M5-1). Único lugar que a Tarefa 13 muda. */
import type { Client } from 'pg'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { aplicarM2 } from './m2'
import { travarDdl } from './ddl-testes'
import { aplicarM3b, m3bNoBanco } from './m3b'
import { M10A_SQL } from '../integration/video-antigo-m10a-caminho'

export const M5_SQL_CAMINHO: string = resolve(__dirname, '../../../../supabase/rascunhos/m5.sql')
export const M5_EM_MIGRATION = false
export type ParteM5 = 1 | 2 | 3 | 4

/** O texto do rascunho até a parte `ate` (inclusive). Parte pedida que não existe, ou marcador faltando no meio, FALHA ALTO (nunca aplica "o que há"). */
export function sqlM5Ate(ate?: ParteM5): string {
  const sql = readFileSync(M5_SQL_CAMINHO, 'utf8')
  const partes = [...sql.matchAll(/^-- M5 PARTE (\d+)/gm)].map(m => Number(m[1]))
  const maior = partes.length ? Math.max(...partes) : 0
  if (ate === undefined) return sql
  if (ate > maior) throw new Error(`parte ${ate} não encontrada no rascunho (a maior é ${maior})`)
  if (ate === maior) return sql
  const fim = sql.indexOf(`-- M5 PARTE ${ate + 1}`)
  if (fim < 0) throw new Error(`marcador da parte ${ate + 1} ausente no meio do rascunho`)
  return sql.slice(0, fim)
}
export async function aplicarM5(c: Client, ate?: ParteM5): Promise<void> { await travarDdl(c); await c.query(sqlM5Ate(ate)) }

/**
 * Logo depois de `begin`: lock, M2, M10a, M3b (e as migrations 03 a 05 da M3b) e a M5 até a parte pedida.
 * Divergência do plano (14/10): no banco de integração a M2, a M10a e a M3b já estão aplicadas (migrations); reaplicar tudo a cada teste
 * é caro. Só aplica o que falta (mesma guarda dos testes da M3b: `m3bNoBanco`). A M5 sempre se aplica.
 */
/** M3b já aplicada E completa (a 03 define obs_archive_m9_pronto): M3b pela metade falha alto, nunca roda a M5 contra uma M3b diferente da da árvore (Yannis m-1). */
async function m3bCompletaNoBanco(c: Client): Promise<boolean> {
  if (!(await m3bNoBanco(c))) return false
  const r = await c.query(`select to_regprocedure('public.obs_archive_m9_pronto(uuid)') is not null as ok`)
  if (r.rows[0]?.ok !== true) throw new Error('banco de integração com a M3b incompleta (falta a migration 03 ou mais): recrie o banco ou aplique 02–05 antes da M5')
  return true
}
export async function prepararM5(c: Client, ate?: ParteM5): Promise<void> {
  await travarDdl(c)
  if (!(await m3bCompletaNoBanco(c))) {
    await aplicarM2(c)
    await c.query(readFileSync(M10A_SQL, 'utf8'))
    await aplicarM3b(c)
    const dir = resolve(__dirname, '../../../../supabase/migrations')
    for (const n of readdirSync(dir).filter(x => /_manutencao_m3b_(recusa|apagar_com_arquivo|apagar_so_cheias)\.sql$/.test(x)).sort()) await c.query(readFileSync(resolve(dir, n), 'utf8'))
  }
  await aplicarM5(c, ate)
}
