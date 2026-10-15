// @vitest-environment node
// apps/web/test/youtube/observatorio/medidas-telas-tarefa-viva.test.ts
// E5a Tarefa 14a0: tarefaViva, a regra de avaliarAgenda com a primeira execução da própria tarefa.
import { describe, it, expect } from 'vitest'
import { tarefaViva } from '@/lib/youtube/observatorio/medidas-telas/tarefa-viva'
import { DEFINICAO_RETRATOS_COMENTARIOS } from '@/lib/youtube/agenda/definicoes'

const H = 3_600_000
const agora = Date.UTC(2026, 9, 15, 12)
const tol = DEFINICAO_RETRATOS_COMENTARIOS.toleranciaVigiaH

describe('tarefaViva (E5a T14a0)', () => {
  it('ok dentro da tolerância: viva, inclusive na ponta', () => {
    expect(tarefaViva({ ultimoOkMs: agora - tol * H, primeiraExecucaoMs: agora - 99 * H, toleranciaH: tol, agoraMs: agora })).toEqual({ estado: 'viva' })
    expect(tarefaViva({ ultimoOkMs: agora - 1 * H, primeiraExecucaoMs: null, toleranciaH: tol, agoraMs: agora })).toEqual({ estado: 'viva' })
  })
  it('ok mais velho que a tolerância: parada desde o ok', () => {
    const ok = agora - tol * H - 1
    expect(tarefaViva({ ultimoOkMs: ok, primeiraExecucaoMs: agora - 999 * H, toleranciaH: tol, agoraMs: agora })).toEqual({ estado: 'parada', desdeMs: ok, semOk: false })
  })
  it('sem ok e primeira execução dentro da tolerância: viva', () => {
    expect(tarefaViva({ ultimoOkMs: null, primeiraExecucaoMs: agora - tol * H, toleranciaH: tol, agoraMs: agora })).toEqual({ estado: 'viva' })
  })
  it('sem ok e primeira execução fora: parada desde a primeira execução, semOk', () => {
    const p = agora - tol * H - 1
    expect(tarefaViva({ ultimoOkMs: null, primeiraExecucaoMs: p, toleranciaH: tol, agoraMs: agora })).toEqual({ estado: 'parada', desdeMs: p, semOk: true })
  })
  it('sem ok e sem execução: nao_lida, nunca viva nem data nula', () => {
    expect(tarefaViva({ ultimoOkMs: null, primeiraExecucaoMs: null, toleranciaH: tol, agoraMs: agora })).toEqual({ estado: 'nao_lida' })
  })
  it('a tolerância é a da definição, não um número escrito', () => {
    expect(tol).toBeGreaterThan(0)
    expect(tarefaViva({ ultimoOkMs: agora - 3 * H, primeiraExecucaoMs: null, toleranciaH: 2, agoraMs: agora }).estado).toBe('parada')
  })
})
