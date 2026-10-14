// @vitest-environment node
/**
 * A5 E10: a ponte entre o que se testa e o que se aplica. O ensaio versionado (`a5-e10-mg6.sql`) é o SQL que as suítes de
 * integração provam; a migration é o SQL que vai à produção. Têm de ser o mesmo arquivo, byte a byte. Sem banco: roda na CI
 * (revisão Yannis 14/10, I-B: antes vivia dentro do `skipIf` de banco e a CI nunca a via).
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FIXTURE = fileURLToPath(new URL('../../fixtures/sql/a5-e10-mg6.sql', import.meta.url))
const PASTA = fileURLToPath(new URL('../../../../../supabase/migrations/', import.meta.url))
const SUFIXO = '_observatorio_a5_e10_export_pausa_e_limite.sql'

function daMigration(): string[] {
  return existsSync(PASTA) ? readdirSync(PASTA).filter(f => f.endsWith(SUFIXO)) : []
}

describe('A5 E10: a migration da MG6 é o ensaio versionado', () => {
  it('o ensaio existe, não é vazio e usa só \\n', () => {
    const texto = readFileSync(FIXTURE, 'utf8')
    expect(texto.length).toBeGreaterThan(1000)
    expect(texto.includes('\r')).toBe(false)
  })

  it('a migration, quando existir em supabase/migrations, é idêntica ao ensaio, byte a byte', () => {
    const arquivos = daMigration()
    if (arquivos.length === 0) return // pende o `db:new` do controlador
    expect(arquivos).toHaveLength(1)
    expect(readFileSync(PASTA + arquivos[0], 'utf8')).toBe(readFileSync(FIXTURE, 'utf8'))
  })

  it('o carimbo da migration é maior que o de todas as outras', () => {
    const arquivos = daMigration()
    if (arquivos.length === 0) return
    const carimbo = (f: string): string => f.split('_')[0]!
    const dela = carimbo(arquivos[0]!)
    const outras = readdirSync(PASTA).filter(f => f.endsWith('.sql') && f !== arquivos[0]).map(carimbo)
    for (const o of outras) expect(dela > o, `carimbo ${dela} não é posterior a ${o}`).toBe(true)
  })
})
