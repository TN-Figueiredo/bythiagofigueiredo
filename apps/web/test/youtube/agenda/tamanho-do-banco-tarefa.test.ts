// @vitest-environment node
/** A5 · E10, Tarefa 9: `tamanho_do_banco` = medida + nova tentativa das miniaturas. Medida e remoção mockadas. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const rodar = vi.fn()
const retentar = vi.fn()
vi.mock('@/lib/youtube/observatorio/arquivo/medir-tamanho', () => ({ rodarTamanhoDoBanco: (...a: unknown[]) => rodar(...a), MOTIVOS_TAMANHO: {} }))
vi.mock('@/lib/youtube/observatorio/arquivo/remover', () => ({ retentarMiniaturasPendentes: (...a: unknown[]) => retentar(...a) }))

import { tamanhoDoBanco } from '@/lib/youtube/agenda/tarefas/tamanho-do-banco'

const ctx = (gasto = 0) => {
  let t = 1_000_000
  return { t0: t, agora: () => t + gasto, apiKey: 'k', sb: {} as SupabaseClient, linhas: null, avanca: (ms: number) => { t += ms } }
}
beforeEach(() => { rodar.mockReset().mockResolvedValue({ estado: 'ok', feitas: 1, deixadas: 0, detalhe: { medidas: 1 } }); retentar.mockReset() })
afterEach(() => vi.useRealTimers())

describe('tamanho_do_banco', () => {
  it('medida ok: acrescenta apagadas/pendentes ao detalhe sem trocar o estado', async () => {
    retentar.mockResolvedValue({ apagadas: 4, pendentes: 2, foraDoPrefixo: 0 })
    const r = await tamanhoDoBanco.rodar(ctx())
    expect(r.estado).toBe('ok')
    expect(r.detalhe).toEqual({ medidas: 1, miniaturas_apagadas: 4, miniaturas_pendentes: 2 })
  })
  it('fora do prefixo > 0 aparece no detalhe', async () => {
    retentar.mockResolvedValue({ apagadas: 0, pendentes: 1, foraDoPrefixo: 3 })
    expect((await tamanhoDoBanco.rodar(ctx())).detalhe).toMatchObject({ miniaturas_fora_do_prefixo: 3 })
  })
  it('medida com erro: não tenta apagar nada', async () => {
    rodar.mockResolvedValue({ estado: 'erro', feitas: 0, deixadas: null, motivo: 'medida_falhou' })
    const r = await tamanhoDoBanco.rodar(ctx())
    expect(r.estado).toBe('erro')
    expect(retentar).not.toHaveBeenCalled()
  })
  it('sem_token: miniaturas_nao_tentadas e nenhum miniaturas_apagadas; o estado segue ok', async () => {
    retentar.mockResolvedValue({ porque: 'sem_token' })
    const r = await tamanhoDoBanco.rodar(ctx())
    expect(r.estado).toBe('ok')
    expect(r.detalhe).toEqual({ medidas: 1, miniaturas_nao_tentadas: 1 })
  })
  it('a nova tentativa lança: miniaturas_nao_tentadas, estado ok', async () => {
    retentar.mockRejectedValue(new Error('blob caiu'))
    const r = await tamanhoDoBanco.rodar(ctx())
    expect(r.estado).toBe('ok')
    expect(r.detalhe).toMatchObject({ miniaturas_nao_tentadas: 1 })
    expect(JSON.stringify(r)).not.toContain('blob caiu')
  })
  it('sem folga (menos de 25 s até o fim): não tenta e marca miniaturas_sem_tempo', async () => {
    const r = await tamanhoDoBanco.rodar(ctx(70_000))
    expect(retentar).not.toHaveBeenCalled()
    expect(r.detalhe).toMatchObject({ miniaturas_sem_tempo: 1 })
  })
  it('Blob pendurado: volta antes do fimAteMs, com miniaturas_sem_tempo e estado ok', async () => {
    vi.useFakeTimers()
    retentar.mockReturnValue(new Promise(() => {}))
    const p = tamanhoDoBanco.rodar(ctx())
    await vi.advanceTimersByTimeAsync(20_000)
    const r = await p
    expect(r.estado).toBe('ok')
    expect(r.detalhe).toMatchObject({ miniaturas_sem_tempo: 1 })
    expect(retentar.mock.calls[0]![1].prazoMs).toBeLessThanOrEqual(20_000)
  })
})
