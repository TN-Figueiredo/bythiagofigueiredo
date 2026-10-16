/**
 * A5 · E6 P3: de onde os testes leem o SQL da MG15 (apagar as linhas vazias do diário).
 *
 * Ordem: o arquivo de `supabase/migrations/` cujo nome contém `observatorio_a5_e6_p3_apagar_linhas_vazias` (existe depois da
 * Tarefa 6) e, se não houver, a fixture versionada `test/fixtures/sql/a5-e6-p3-mg15.sql` (a CI a enxerga; o ensaio em
 * `.superpowers/` é ignorado pelo git). Os dois, quando existem, têm de ser idênticos. Sem nenhum dos dois, lança.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const RAIZ = resolve(__dirname, '..', '..', '..', '..')
const DA_MIGRATION = join(RAIZ, 'supabase', 'migrations')
const FIXTURE = resolve(__dirname, '..', 'fixtures', 'sql', 'a5-e6-p3-mg15.sql')
const ENSAIO = join(RAIZ, '.superpowers', 'sdd', 'a5-e6-p3', 'sql', 'mg15.sql')

export function caminhoDaMigrationMg15(): string | null {
  if (!existsSync(DA_MIGRATION)) return null
  const achado = readdirSync(DA_MIGRATION).filter((f) => f.includes('observatorio_a5_e6_p3_apagar_linhas_vazias')).sort()
  return achado.length > 0 ? join(DA_MIGRATION, achado[achado.length - 1]!) : null
}

/** O SQL que vale: a migration se existir, senão a fixture. */
export function lerSqlMg15(): string {
  const m = caminhoDaMigrationMg15()
  if (m) return readFileSync(m, 'utf8')
  if (existsSync(FIXTURE)) return readFileSync(FIXTURE, 'utf8')
  throw new Error('nem a migration (observatorio_a5_e6_p3_apagar_linhas_vazias) nem a fixture a5-e6-p3-mg15.sql existem')
}

export function lerFixtureMg15(): string { return readFileSync(FIXTURE, 'utf8') }
export function lerMigrationMg15(): string | null {
  const m = caminhoDaMigrationMg15()
  return m ? readFileSync(m, 'utf8') : null
}
/** O ensaio local (fora do git), ou null. */
export function lerEnsaioMg15(): string | null { return existsSync(ENSAIO) ? readFileSync(ENSAIO, 'utf8') : null }
