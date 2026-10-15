// apps/web/test/helpers/migrations.ts
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export interface Migration { arquivo: string; sql: string }

export const PASTA_DAS_MIGRATIONS = resolve(__dirname, '../../../../supabase/migrations')

/** Todas as migrations, em ordem de nome (= ordem de aplicação). */
export function lerMigrations(dir: string = PASTA_DAS_MIGRATIONS): Migration[] {
  return readdirSync(dir).filter(n => n.endsWith('.sql')).sort().map(arquivo => ({ arquivo, sql: readFileSync(join(dir, arquivo), 'utf8') }))
}

/**
 * A última definição (`create [or replace] function [public.]<funcao>(`) e o texto até o fim do corpo `$$ ... $$`
 * (ou até o fim do arquivo, se o corpo não fechar). Definição dentro de `execute $f$ ... $f$` também conta.
 */
export function ultimaDefinicao(migs: readonly Migration[], funcao: string): { arquivo: string; corpo: string } | null {
  const re = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+(?:public\\.)?${funcao}\\s*\\(`, 'gi')
  let achada: { arquivo: string; corpo: string } | null = null
  for (const m of migs) {
    for (const hit of m.sql.matchAll(re)) {
      const ini = hit.index ?? 0
      const resto = m.sql.slice(ini)
      const abre = resto.search(/\$[a-z_]*\$/i)
      if (abre < 0) { achada = { arquivo: m.arquivo, corpo: resto }; continue }
      const marca = (resto.slice(abre).match(/^\$[a-z_]*\$/i) ?? ['$$'])[0]
      const fecha = resto.indexOf(marca, abre + marca.length)
      achada = { arquivo: m.arquivo, corpo: fecha < 0 ? resto : resto.slice(0, fecha + marca.length) }
    }
  }
  return achada
}

/** As migrations desta fase: o nome leva `_manutencao_` (regra do plano da M2). */
export function migrationsDaFase(migs: readonly Migration[]): Migration[] {
  return migs.filter(m => m.arquivo.includes('_manutencao_'))
}
