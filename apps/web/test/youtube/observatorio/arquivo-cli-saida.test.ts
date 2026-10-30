import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { deveConectar, imprimirSaida } from '../../../src/lib/youtube/observatorio/arquivo/cli'

describe('obs-arquivo: decisão de conectar e saída', () => {
  it('comandos-recarga conecta quando há URL', () => {
    expect(deveConectar('comandos-recarga', 'postgres://x')).toBe(true)
  })
  it('não conecta sem URL nem para comando sem banco', () => {
    expect(deveConectar('comandos-recarga', undefined)).toBe(false)
    expect(deveConectar('comandos-nas', 'postgres://x')).toBe(false)
  })
  it('erros chegam ao stderr e saida ao stdout', () => {
    const out: string[] = []
    const err: string[] = []
    const c = imprimirSaida({ codigo: 0, saida: ['a'], erros: ['aviso sem_destino'] }, { out: l => out.push(l), err: l => err.push(l) })
    expect(c).toBe(0)
    expect(out).toEqual(['a'])
    expect(err).toEqual(['aviso sem_destino'])
  })
  it('o script usa as duas funções em vez de condição própria', () => {
    const fonte = readFileSync('../../scripts/obs-arquivo.ts', 'utf8')
    expect(fonte).toContain('if (deveConectar(comando.nome, url)) {')
    expect(fonte).toContain('return imprimirSaida(r, {')
    expect(fonte).not.toContain('precisaDeBanco')
    expect(fonte).not.toContain('r.saida')
  })
})
