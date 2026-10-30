// @vitest-environment node
/** A5 · E10, Tarefa 9: `tamanho_do_banco` = medida + nova tentativa das miniaturas. Medida e remoção mockadas. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const rodar = vi.fn()
const retentar = vi.fn()
const blobs = vi.fn()
vi.mock('@/lib/youtube/observatorio/arquivo/medir-tamanho', () => ({ rodarTamanhoDoBanco: (...a: unknown[]) => rodar(...a), MOTIVOS_TAMANHO: {} }))
vi.mock('@/lib/youtube/observatorio/arquivo/remover', () => ({ retentarMiniaturasPendentes: (...a: unknown[]) => retentar(...a), retentarBlobsDeRemocoes: (...a: unknown[]) => blobs(...a) }))

import { tamanhoDoBanco } from '@/lib/youtube/agenda/tarefas/tamanho-do-banco'

const rpc = vi.fn()
const ctx = (gasto = 0) => {
  let t = 1_000_000
  return { t0: t, agora: () => t + gasto, apiKey: 'k', sb: { rpc } as unknown as SupabaseClient, linhas: null, avanca: (ms: number) => { t += ms } }
}
beforeEach(() => { rpc.mockReset().mockResolvedValue({ data: 0, error: null }); rodar.mockReset().mockResolvedValue({ estado: 'ok', feitas: 1, deixadas: 0, detalhe: { medidas: 1 } }); retentar.mockReset(); blobs.mockReset().mockResolvedValue({ porque: 'flag_desligada' }) })
afterEach(() => vi.useRealTimers())

describe('tamanho_do_banco', () => {
  it('medida ok: acrescenta apagadas/pendentes ao detalhe sem trocar o estado', async () => {
    retentar.mockResolvedValue({ apagadas: 4, pendentes: 2, foraDoPrefixo: 0 })
    const r = await tamanhoDoBanco.rodar(ctx())
    expect(r.estado).toBe('ok')
    expect(r.detalhe).toEqual({ medidas: 1, miniaturas_apagadas: 4, miniaturas_pendentes: 2, blobs_remocoes_flag_desligada: 1 })
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
    expect(r.detalhe).toEqual({ medidas: 1, miniaturas_nao_tentadas: 1, blobs_remocoes_flag_desligada: 1 })
  })
  it('M9 T13: os blobs das remoções recebem o máximo que SOBRA das miniaturas e o resultado entra no detalhe', async () => {
    retentar.mockResolvedValue({ apagadas: 50, pendentes: 0, foraDoPrefixo: 0 })
    blobs.mockResolvedValue({ apagadas: 7, pendentes: 2, foraDoPrefixo: 1 })
    const r = await tamanhoDoBanco.rodar(ctx())
    expect(blobs.mock.calls[0]![1]).toMatchObject({ maximo: 150 })
    expect(r.detalhe).toMatchObject({ blobs_remocoes_apagadas: 7, blobs_remocoes_pendentes: 2, blobs_remocoes_fora_do_prefixo: 1 })
  })
  it('M9 T13: os blobs lançando não trocam o estado', async () => {
    retentar.mockResolvedValue({ apagadas: 0, pendentes: 0, foraDoPrefixo: 0 })
    blobs.mockRejectedValue(new Error('x'))
    const r = await tamanhoDoBanco.rodar(ctx())
    expect(r.estado).toBe('ok')
    expect(r.detalhe).toMatchObject({ blobs_remocoes_nao_tentadas: 1 })
  })
  it('M9 T13: a poda é chamada com p_dias 90, grava ausencia_podadas e roda mesmo com a flag desligada', async () => {
    retentar.mockResolvedValue({ apagadas: 0, pendentes: 0, foraDoPrefixo: 0 })
    rpc.mockResolvedValue({ data: 3, error: null })
    const r = await tamanhoDoBanco.rodar(ctx())
    expect(rpc).toHaveBeenCalledWith('obs_archive_absence_prune', { p_dias: 90 })
    expect(r.detalhe).toMatchObject({ ausencia_podadas: 3, blobs_remocoes_flag_desligada: 1 })
  })
  it('M9 T13: poda com error ou lançando grava ausencia_poda_falhou e o estado segue ok', async () => {
    retentar.mockResolvedValue({ apagadas: 0, pendentes: 0, foraDoPrefixo: 0 })
    rpc.mockResolvedValue({ data: null, error: { message: 'x' } })
    const a = await tamanhoDoBanco.rodar(ctx())
    expect(a.estado).toBe('ok'); expect(a.detalhe).toMatchObject({ ausencia_poda_falhou: 1 })
    rpc.mockRejectedValue(new Error('y'))
    const b = await tamanhoDoBanco.rodar(ctx())
    expect(b.estado).toBe('ok'); expect(b.detalhe).toMatchObject({ ausencia_poda_falhou: 1 })
  })
  it('M9 T13: poda pendurada volta em 5 s com ausencia_poda_sem_tempo', async () => {
    vi.useFakeTimers()
    retentar.mockResolvedValue({ apagadas: 0, pendentes: 0, foraDoPrefixo: 0 })
    rpc.mockReturnValue(new Promise(() => {}))
    const p = tamanhoDoBanco.rodar(ctx())
    await vi.advanceTimersByTimeAsync(5_000)
    const r = await p
    expect(r.estado).toBe('ok'); expect(r.detalhe).toMatchObject({ ausencia_poda_sem_tempo: 1 })
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
