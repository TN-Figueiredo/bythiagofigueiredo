import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

/** Pares de arquivos com o mesmo prefixo de versão (dígitos antes do 1º `_`). Dois com a mesma versão = um é pulado em silêncio no db push. */
export function versoesRepetidas(arquivos: readonly string[]): string[] {
  const porVersao = new Map<string, string[]>()
  for (const a of arquivos) {
    const m = /^(\d+)_/.exec(a)
    if (!m) continue
    porVersao.set(m[1]!, [...(porVersao.get(m[1]!) ?? []), a])
  }
  return [...porVersao.values()].filter(v => v.length > 1).map(v => v.join(' x '))
}

const DIR = resolve(__dirname, '../../../supabase/migrations')

describe('supabase/migrations: versão única', () => {
  it('nenhum par de arquivos com o mesmo prefixo de versão', () => {
    expect(versoesRepetidas(readdirSync(DIR).filter(f => f.endsWith('.sql')))).toEqual([])
  })
  it('a função cai com dois arquivos de mesma versão num diretório temporário', () => {
    const t = mkdtempSync(join(tmpdir(), 'mig-ver-'))
    try {
      for (const f of ['20261024000005_a.sql', '20261024000005_b.sql', '20261024000006_c.sql']) writeFileSync(join(t, f), '')
      expect(versoesRepetidas(readdirSync(t))).toEqual(['20261024000005_a.sql x 20261024000005_b.sql'])
    } finally { rmSync(t, { recursive: true, force: true }) }
  })
})
