// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { passoDaRemocao } from '@/lib/youtube/observatorio/arquivo/passo-da-remocao'
import { RULES } from '@/lib/youtube/observatorio/rules'

const T0 = Date.parse('2026-10-19T12:00:00Z')
const pausado = new Date(T0).toISOString()
const depois = new Date(T0 + 10 * 60_000).toISOString()
const antes = new Date(T0 - 60_000).toISOString()
const MIN = RULES.pause.minMinutesBeforeExport

describe('passoDaRemocao', () => {
  it('a janela é de 6 min: 5:59 espera, 6:00 exporta', () => {
    expect(MIN).toBe(6)
    expect(passoDaRemocao({ pausadoEm: pausado, lote: null }, T0 + MIN * 60_000 - 1000)).toEqual({ passo: 'esperar', minutos: 1 })
    expect(passoDaRemocao({ pausadoEm: pausado, lote: null }, T0 + MIN * 60_000)).toEqual({ passo: 'exportar' })
  })
  it('pausadoEm nulo espera', () => { expect(passoDaRemocao({ pausadoEm: null, lote: null }, T0).passo).toBe('esperar') })
  const agora = T0 + 60 * 60_000
  const lote = (o: Partial<{ exportadoEm: string; conferidoEm: string | null; confirmadoEm: string | null; fechadoEm: string | null }> = {}) =>
    ({ exportadoEm: depois, conferidoEm: null, confirmadoEm: null, fechadoEm: null, ...o })
  it('lote fechado ou exportado antes da pausa conta como sem lote', () => {
    expect(passoDaRemocao({ pausadoEm: pausado, lote: lote({ fechadoEm: depois }) }, agora).passo).toBe('exportar')
    expect(passoDaRemocao({ pausadoEm: pausado, lote: lote({ exportadoEm: antes, conferidoEm: depois, confirmadoEm: depois }) }, agora).passo).toBe('exportar')
  })
  it('exportado, conferido, confirmado', () => {
    expect(passoDaRemocao({ pausadoEm: pausado, lote: lote() }, agora).passo).toBe('conferir')
    expect(passoDaRemocao({ pausadoEm: pausado, lote: lote({ conferidoEm: depois }) }, agora).passo).toBe('copiar_e_confirmar')
    expect(passoDaRemocao({ pausadoEm: pausado, lote: lote({ conferidoEm: depois, confirmadoEm: depois }) }, agora).passo).toBe('remover')
  })
  it('exportado exatamente na pausa vale (>=)', () => {
    expect(passoDaRemocao({ pausadoEm: pausado, lote: lote({ exportadoEm: pausado }) }, agora).passo).toBe('conferir')
  })
})
