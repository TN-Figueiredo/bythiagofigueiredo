// @vitest-environment node
/**
 * A5 · E10, Tarefa 5: o catálogo de códigos e frases (`arquivo/codigos.ts`). Os testes que a Tarefa 11a lista para código e frase moram aqui.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { codigoE10, FRASES_E10, type CodigoE10 } from '@/lib/youtube/observatorio/arquivo/codigos'
import { RULES } from '@/lib/youtube/observatorio/rules'

const TODOS = Object.keys(FRASES_E10) as CodigoE10[]
const DO_BANCO = TODOS.filter(c => !['demorou_demais', 'schema_ausente', 'inesperado'].includes(c))

describe('A5 E10 T5: codigos', () => {
  it('um teste por código: a frase vem do catálogo e nenhuma parte da mensagem do banco aparece', () => {
    expect(DO_BANCO).toHaveLength(16)
    for (const c of DO_BANCO) {
      const mensagem = `E10:${c}: competitor_video_daily 2026-10 banco=3 arquivo=2 SEGREDO`
      const codigo = codigoE10({ message: mensagem, code: 'P0001' })
      expect(codigo).toBe(c)
      const frase = FRASES_E10[codigo]
      expect(frase.length).toBeGreaterThan(10)
      for (const parte of ['competitor_video_daily', 'banco=3', 'SEGREDO', 'E10:']) expect(frase).not.toContain(parte)
    }
  })

  it('mensagem sem o prefixo é inesperado (e prefixo de código que o catálogo não tem também)', () => {
    expect(codigoE10({ message: 'permission denied for table x' })).toBe('inesperado')
    expect(codigoE10({ message: 'E10 banco_difere_do_manifesto' })).toBe('inesperado')
    expect(codigoE10({ message: 'E10:codigo_que_nao_existe: x' })).toBe('inesperado')
    expect(codigoE10({ message: 'E10:Maiusculo: x' })).toBe('inesperado')
    expect(codigoE10({ message: 'E10:demorou_demais: x' })).toBe('inesperado') // só o `code` 57014 diz isso
    expect(codigoE10({})).toBe('inesperado')
    expect(codigoE10(null)).toBe('inesperado')
    expect(codigoE10(undefined)).toBe('inesperado')
  })

  it('função ausente é schema_ausente (PGRST202 e 42883), mesmo com mensagem E10', () => {
    expect(codigoE10({ code: 'PGRST202', message: 'Could not find the function' })).toBe('schema_ausente')
    expect(codigoE10({ code: '42883', message: 'function does not exist' })).toBe('schema_ausente')
    expect(codigoE10({ code: '42883', message: 'E10:sem_lote: x' })).toBe('schema_ausente')
  })

  it('57014 vira demorou_demais e a frase diz que nada foi apagado e manda usar o comando remover', () => {
    const c = codigoE10({ code: '57014', message: 'canceling statement due to statement timeout' })
    expect(c).toBe('demorou_demais')
    expect(FRASES_E10[c]).toContain('nada foi apagado')
    expect(FRASES_E10[c]).toContain('`remover`')
    // o code vale mais que a mensagem
    expect(codigoE10({ code: '57014', message: 'E10:sem_lote: x' })).toBe('demorou_demais')
  })

  it('nenhuma frase de FRASES_E10 contém a palavra "lote" nem "MB" (a palavra de tela é "exportação")', () => {
    for (const c of TODOS) {
      expect(FRASES_E10[c], c).not.toMatch(/\blotes?\b/i)
      expect(FRASES_E10[c], c).not.toMatch(/\bMB\b/)
    }
  })

  it('toda frase é uma frase: começa em maiúscula, termina em ponto, e o catálogo cobre os 19 códigos', () => {
    expect(TODOS).toHaveLength(19)
    for (const c of TODOS) {
      expect(FRASES_E10[c], c).toMatch(/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/)
      expect(FRASES_E10[c], c).toMatch(/[.]$/)
    }
  })

  it('pausa_recente usa a espera do RULES (o banco confere o mesmo número)', () => {
    expect(FRASES_E10.pausa_recente).toContain(`${RULES.pause.minMinutesBeforeExport} minutos`)
  })

  it('o módulo só importa de node: e de caminho relativo (o tsx da raiz o importa)', () => {
    const src = readFileSync(join(__dirname, '../../../src/lib/youtube/observatorio/arquivo/codigos.ts'), 'utf8')
    for (const m of src.matchAll(/^\s*import[^'"]*['"]([^'"]+)['"]/gm)) expect(m[1]!.startsWith('node:') || m[1]!.startsWith('.'), m[1]).toBe(true)
  })
})
