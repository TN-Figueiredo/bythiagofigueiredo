/**
 * A5 · X3: localização e leitura do texto da migration (sem importar `mg6.ts`, que importa este arquivo: evita o ciclo).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

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
