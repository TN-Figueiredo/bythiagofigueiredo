// m-10: o corpo da migration 1 da M6 é o rascunho testado (PARTES 1 a 6).
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { sqlM6Ate } from '../helpers/m6'

const DIR = resolve(__dirname, '../../../../supabase/migrations')

function normalizar(sql: string): string {
  return sql
    .split('\n')
    .map((l) => l.replace(/--.*$/, '').trimEnd())
    .join('\n')
    .trim()
}

describe('M6 migration 1 = rascunho (m-10)', () => {
  it('a migration manutencao_m6_saida tem o texto das PARTES 1 a 6', () => {
    const arquivos = readdirSync(DIR).filter((f) => f.endsWith('_manutencao_m6_saida.sql'))
    expect(arquivos).toHaveLength(1)
    const migration = readFileSync(resolve(DIR, arquivos[0]), 'utf8')
    expect(normalizar(migration)).toBe(normalizar(sqlM6Ate(6)))
  })
})
