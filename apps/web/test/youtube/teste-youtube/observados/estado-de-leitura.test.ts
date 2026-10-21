// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { estadoDeLeitura, estadosDeLeitura, lerEstadosDeLeitura, type EntradaEstado } from '@/lib/youtube/teste-youtube/observados/estado-de-leitura'
import { VALIDAS_MIN_MEDIDO, type CampoObs } from '@/lib/youtube/teste-youtube/observados/inferir'

const AGORA = Date.parse('2026-10-25T12:00:00Z')
const H = 3_600_000
const ent = (o: Partial<EntradaEstado> = {}): EntradaEstado => ({
  flagLigada: true, alvo: { rodadas: 40, ultimaRodadaEm: new Date(AGORA - 3 * H).toISOString() },
  cursor: { avaliadoAteRodada: 40, avaliadoEm: new Date(AGORA - 2 * H).toISOString(), motivo: 'ok', validasTitulo: 30, validasMiniatura: 30 },
  camposComLinha: new Set<CampoObs>(), agoraMs: AGORA, frescorMs: 26 * H, ...o,
})

describe('estadoDeLeitura (três estados por campo)', () => {
  it('avaliado ok sem troca, alvo fresco -> sem troca vista', () => {
    expect(estadoDeLeitura(ent(), 'titulo')).toBe('sem_troca_vista')
  })
  it('flag off com 40 rodadas -> não medido (cursor antigo não vale)', () => {
    expect(estadoDeLeitura(ent({ flagLigada: false }), 'titulo')).toBe('nao_medido')
  })
  it('sem cursor, ou cursor sem_publicacao -> não medido', () => {
    expect(estadoDeLeitura(ent({ cursor: null }), 'titulo')).toBe('nao_medido')
    expect(estadoDeLeitura(ent({ cursor: { avaliadoAteRodada: 40, avaliadoEm: new Date(AGORA).toISOString(), motivo: 'sem_publicacao' } }), 'miniatura')).toBe('nao_medido')
  })
  it('alvo ausente (podado), 2 rodadas, ou última rodada velha -> não medido', () => {
    expect(estadoDeLeitura(ent({ alvo: null }), 'titulo')).toBe('nao_medido')
    expect(estadoDeLeitura(ent({ alvo: { rodadas: 2, ultimaRodadaEm: new Date(AGORA).toISOString() } }), 'titulo')).toBe('nao_medido')
    expect(estadoDeLeitura(ent({ alvo: { rodadas: 40, ultimaRodadaEm: new Date(AGORA - 60 * H).toISOString() } }), 'titulo')).toBe('nao_medido')
  })
  it('avaliação atrasada (cursor velho e rodadas bem acima) -> não medido; cursor a 1 rodada do alvo -> sem troca vista', () => {
    const velho = { avaliadoAteRodada: 30, avaliadoEm: new Date(AGORA - 60 * H).toISOString(), motivo: 'ok' }
    expect(estadoDeLeitura(ent({ cursor: velho }), 'titulo')).toBe('nao_medido')
    expect(estadoDeLeitura(ent({ cursor: { ...velho, avaliadoAteRodada: 39 } }), 'titulo')).toBe('sem_troca_vista')
  })
  it('miniatura com linha e título sem linha, alvo fresco -> título sem troca vista', () => {
    expect(estadosDeLeitura(ent({ camposComLinha: new Set<CampoObs>(['miniatura']) }))).toEqual({ titulo: 'sem_troca_vista', miniatura: 'com_troca' })
  })
  it('linha com a flag off ainda é "com troca"', () => {
    expect(estadoDeLeitura(ent({ flagLigada: false, camposComLinha: new Set<CampoObs>(['titulo']) }), 'titulo')).toBe('com_troca')
  })
  it('cursor ok mas SEM leitura válida (sonda bloqueada, 10 rodadas): não medido nos dois campos, nunca "sem troca vista"', () => {
    const cego = { avaliadoAteRodada: 40, avaliadoEm: new Date(AGORA - 2 * H).toISOString(), motivo: 'ok', validasTitulo: 0, validasMiniatura: 0 }
    expect(estadosDeLeitura(ent({ cursor: cego }))).toEqual({ titulo: 'nao_medido', miniatura: 'nao_medido' })
  })
  it('título lido e miniatura sem dhash válido: título sem troca vista, miniatura não medida (por campo)', () => {
    const c = { ...ent().cursor!, validasMiniatura: 0 }
    expect(estadosDeLeitura(ent({ cursor: c }))).toEqual({ titulo: 'sem_troca_vista', miniatura: 'nao_medido' })
  })
  it('o mínimo é VALIDAS_MIN_MEDIDO rodadas válidas: uma a menos = não medido, exatamente o mínimo = sem troca vista', () => {
    const mk = (n: number) => ent({ cursor: { ...ent().cursor!, validasTitulo: n } })
    expect(estadoDeLeitura(mk(VALIDAS_MIN_MEDIDO - 1), 'titulo')).toBe('nao_medido')
    expect(estadoDeLeitura(mk(VALIDAS_MIN_MEDIDO), 'titulo')).toBe('sem_troca_vista')
  })
  it('campo com linha continua "com troca" mesmo sem validas no cursor', () => {
    const c = { ...ent().cursor!, validasTitulo: 0 }
    expect(estadoDeLeitura(ent({ cursor: c, camposComLinha: new Set<CampoObs>(['titulo']) }), 'titulo')).toBe('com_troca')
  })
  it('a consulta injetada alimenta a decisão', async () => {
    const r = await lerEstadosDeLeitura(async () => ({ alvo: ent().alvo, cursor: ent().cursor, camposComLinha: new Set<CampoObs>() }), 's', 'abcdefghijk', { flagLigada: true, agoraMs: AGORA, frescorMs: 26 * H })
    expect(r).toEqual({ titulo: 'sem_troca_vista', miniatura: 'sem_troca_vista' })
  })
})
