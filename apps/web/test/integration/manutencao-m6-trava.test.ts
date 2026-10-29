// apps/web/test/integration/manutencao-m6-trava.test.ts
// @vitest-environment node
/** TRAVA M6-1: o SQL da M6 vive em supabase/rascunhos/m6.sql (fora da pasta que o db push lê) até a Tarefa 14. */
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { M6_SQL_CAMINHO, M6_EM_MIGRATION, HASH_REL_SQL_CAMINHO } from '../helpers/m6'

const MIGRATIONS = resolve(__dirname, '../../../../supabase/migrations')

describe('TRAVA M6-1', () => {
  it('enquanto M6_EM_MIGRATION é false, nenhuma migration define as funções de saída', () => {
    if (M6_EM_MIGRATION) return
    expect(existsSync(M6_SQL_CAMINHO)).toBe(true)
    // a migration 1 (Tarefa 14) é o destino do rascunho; o teste m-10 prova que é igual
    for (const f of readdirSync(MIGRATIONS).filter(n => n.endsWith('.sql') && !n.endsWith('_manutencao_m6_saida.sql'))) {
      const sql = readFileSync(resolve(MIGRATIONS, f), 'utf8')
      expect(sql, f).not.toMatch(/function public\.obs_archive_(detach|discard|reattach|drop)_month/)
      expect(sql, f).not.toMatch(/obs_archive_block_delete_while_detached/)
    }
  })
  it('o trecho entre os marcadores do rascunho é o arquivo de hash sobre relação, byte a byte', () => {
    const sql = readFileSync(M6_SQL_CAMINHO, 'utf8')
    const ini = sql.indexOf('-- obs-archive-hash-rel.sql: início\n')
    const fim = sql.indexOf('-- obs-archive-hash-rel.sql: fim')
    expect(ini).toBeGreaterThanOrEqual(0)
    expect(fim).toBeGreaterThan(ini)
    const trecho = sql.slice(ini + '-- obs-archive-hash-rel.sql: início\n'.length, fim)
    expect(trecho).toBe(readFileSync(HASH_REL_SQL_CAMINHO, 'utf8'))
  })
})
