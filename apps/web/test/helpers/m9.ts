import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Client } from 'pg'
import { aplicarM3b, m3bNoBanco } from './m3b'

export const M9_SQL_CAMINHO: string = resolve(__dirname, '../../../../supabase/rascunhos/m9.sql')
export const M9_SQL = (): string => readFileSync(M9_SQL_CAMINHO, 'utf8')
export type ParteM9 = 1 | 2 | 3 | 4 | 5 | 6

/**
 * O texto da M9 até o fim da parte `ate` (padrão: tudo). Partes marcadas por `-- M9 PARTE <n>:`.
 * Parte pedida que ainda não existe no rascunho falha alto (nunca aplica "o que há"); a maior parte existente vai até o fim do arquivo.
 */
export function sqlM9Ate(ate: ParteM9 = 6): string {
  const sql = M9_SQL()
  const partes = [...sql.matchAll(/^-- M9 PARTE (\d+):/gm)].map(m => Number(m[1]))
  const maior = partes.length ? Math.max(...partes) : 0
  if (ate > maior) throw new Error(`m9.sql sem a parte ${ate} (a maior é ${maior})`)
  if (ate === maior) return sql
  const fim = sql.indexOf(`-- M9 PARTE ${ate + 1}:`)
  if (fim < 0) throw new Error(`m9.sql sem o marcador da parte ${ate + 1}`)
  return sql.slice(0, fim)
}

const DIR_MIGRATIONS = resolve(__dirname, '../../../../supabase/migrations')
const FUNCOES_E9 = ['competitor_video_purge', 'competitor_comments_purge', 'competitor_channel_purge'] as const
// Ordem real: E9, F2 (comentários de terceiros), recusa da M3b (injeta obs_archive_m9_pronto por bloco DO).
const MIGRATIONS_DAS_FUNCOES = ['20261015000001_', '20261018000002_', '20261025000003_']

/**
 * As três funções da E9 com o corpo vigente em produção. Não dá para extrair só o `create function` da última migration que a define:
 * a recusa da M3b (20261025000003) injeta `obs_archive_m9_pronto` nelas por bloco DO. Por isso: confere no banco de integração que
 * existem (o md5 esperado sai do `prosrc` instalado, nunca de constante copiada) e, se faltarem, aplica as migrations reais na ordem.
 */
export async function semearE9(c: Client): Promise<void> {
  const conta = async (): Promise<number> => Number((await c.query(
    `select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1)`, [FUNCOES_E9])).rows[0].n)
  if ((await conta()) === 3) return
  for (const prefixo of MIGRATIONS_DAS_FUNCOES) {
    const nome = readdirSync(DIR_MIGRATIONS).find(n => n.startsWith(prefixo))
    if (!nome) throw new Error(`migration ${prefixo}* ausente`)
    await c.query(readFileSync(resolve(DIR_MIGRATIONS, nome), 'utf8'))
  }
  if ((await conta()) !== 3) throw new Error('semearE9: as três funções da E9 não nasceram')
}

/** M3b já em migration (e em produção): aplica só se o banco ainda não a tem (mesmo padrão dos testes da M3b). */
export async function aplicarM9(c: Client, ate?: ParteM9): Promise<void> {
  if (!(await m3bNoBanco(c))) await aplicarM3b(c)
  await semearE9(c)
  await c.query(sqlM9Ate(ate))
}
