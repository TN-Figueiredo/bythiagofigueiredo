// @vitest-environment node
// A5 · E7, Tarefa 11 (commit da reexportação): o módulo de serviço não escreve frase, só reexporta a tabela única, e a guarda de
// importação da forja (Tarefa 1) já proíbe a forja de importá-lo.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as servico from '@/lib/pipeline/services/competitors-frases'
import * as unica from '@/lib/youtube/observatorio/medidas-frases'
import { MOTIVOS_NAO_MEDIDO } from '@/lib/youtube/observatorio/medidas/tipos'

describe('o módulo de serviço só reexporta a tabela única', () => {
  it('FRASES_DE_MOTIVO e fraseDoMotivo dos dois são a mesma referência', () => {
    expect(servico.FRASES_DE_MOTIVO).toBe(unica.FRASES_DE_MOTIVO)
    expect(servico.fraseDoMotivo).toBe(unica.fraseDoMotivo)
  })

  it('o texto de competitors-frases.ts não tem nenhuma frase escrita', () => {
    const t = readFileSync(join(process.cwd(), 'src/lib/pipeline/services/competitors-frases.ts'), 'utf8').replace(/\/\/.*$/gm, '')
    // nenhum literal com espaço (frase) e nenhuma função
    expect(t).not.toMatch(/'[^']* [^']*'|=>/)
    for (const m of MOTIVOS_NAO_MEDIDO) expect(t).not.toContain(m)
    expect(t.trim().startsWith('export {')).toBe(true)
    expect(t).not.toContain('server-only')
  })

  it('a forja não importa este módulo (a guarda de importação da Tarefa 1 cobre o nome)', () => {
    const guarda = readFileSync(join(process.cwd(), 'test/youtube/observatorio/forja-sent-congelado.test.ts'), 'utf8')
    expect(guarda).toContain('competitors-frases')
  })
})
