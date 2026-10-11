// @vitest-environment jsdom
// A3 Tarefa 10 (D18): o gatilho de "Comparar" lembrado na sessão, para o Voltar devolver o foco a ele. Conforto, nunca requisito:
// sem armazenamento (ou com ele lançando) a tela volta como hoje.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { lembrarGatilho, lerGatilho } from '@/app/cms/(authed)/youtube/competitors/_chrome/gatilho-volta'

const CHAVE = 'obs:gatilho-comparar'
beforeEach(() => { window.sessionStorage.clear() })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('lembrarGatilho / lerGatilho', () => {
  it('lê o canal lembrado para o lugar e apaga: o próximo Voltar não repete o foco', () => {
    lembrarGatilho('canais', 'ch-1')
    expect(lerGatilho('canais')).toBe('ch-1')
    expect(lerGatilho('canais')).toBeNull()
    expect(window.sessionStorage.getItem(CHAVE)).toBeNull()
  })
  it('o registro é de UM lugar: ler outro lugar devolve null e não apaga o registro de quem ainda vai ler', () => {
    lembrarGatilho('canal', 'ch-2')
    expect(lerGatilho('canais')).toBeNull()
    expect(window.sessionStorage.getItem(CHAVE)).not.toBeNull()
    expect(lerGatilho('canal')).toBe('ch-2')
  })
  it('o último gatilho vale: lembrar de novo troca o registro', () => {
    lembrarGatilho('canais', 'ch-1'); lembrarGatilho('canais', 'ch-3')
    expect(lerGatilho('canais')).toBe('ch-3')
  })
  it('expira (30 min): um registro que ninguém consumiu não pode fazer um Voltar muito depois pular o foco', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-11T12:00:00Z'))
    lembrarGatilho('canais', 'ch-1')
    vi.setSystemTime(new Date('2026-10-11T12:31:00Z'))
    expect(lerGatilho('canais')).toBeNull()
    expect(window.sessionStorage.getItem(CHAVE)).toBeNull() // o velho é apagado
  })
  it('registro estragado (JSON ruim, formato antigo, carimbo do futuro) é ignorado e apagado', () => {
    for (const raw of ['{não é json', '"texto"', JSON.stringify({ lugar: 'canais', canalId: 7, t: Date.now() }), JSON.stringify({ lugar: 'canais', canalId: '', t: Date.now() }), JSON.stringify({ lugar: 'canais', canalId: 'x', t: Date.now() + 10 * 3600_000 })]) {
      window.sessionStorage.setItem(CHAVE, raw)
      expect(lerGatilho('canais')).toBeNull()
      expect(window.sessionStorage.getItem(CHAVE)).toBeNull()
    }
  })
  it('sem registro: null', () => { expect(lerGatilho('canais')).toBeNull() })
  it('armazenamento que lança (modo privado, bloqueado): nada lança e a leitura é null', () => {
    const quebra = { getItem() { throw new Error('bloqueado') }, setItem() { throw new Error('bloqueado') }, removeItem() { throw new Error('bloqueado') } }
    vi.stubGlobal('sessionStorage', quebra)
    expect(() => lembrarGatilho('canais', 'ch-1')).not.toThrow()
    expect(lerGatilho('canais')).toBeNull()
  })
})
