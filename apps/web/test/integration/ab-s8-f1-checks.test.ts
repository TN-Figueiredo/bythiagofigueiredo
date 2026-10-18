// @vitest-environment node
/**
 * A/B Lab S8-F1 (C-10a): os quatro CHECKs alargados por superconjunto provado. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-s8-f1-checks.test.ts --no-file-parallelism
 */
import { describe, it, expect, vi } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico, q } from '../helpers/db-seed'

vi.setConfig({ testTimeout: 60_000 })

const OK = { estado: 'ok', destino: 'original', forcado: false, escreveu: true, erro: null, em: '2026-10-12T08:02:00Z', attempts: 0 }
const PULADO = { ...OK, estado: 'pulado_teste_youtube', escreveu: false, motivo: 'gatilho:drift' }
const ESTADOS_ANTIGOS = ['ok', 'falhou', 'pulado_sem_original', 'pulado_drift', 'desistiu'] as const
const ESTADOS_RESTORE_STATUS = ['em_andamento', ...ESTADOS_ANTIGOS] as const
const REASONS_ANTIGOS = ['auto_resolve', 'manual_winner', 'manual_archive', 'max_duration', 'inconclusive', 'manual_no_apply', 'manual_apply'] as const
const END_ANTIGOS = ['pausa', 'encerrado', 'falha_api', 'duracao_maxima', 'drift', 'rotacao'] as const

describe.skipIf(skipIfNoLocalDb())('S8-F1 C-10a: CHECKs superconjunto', () => {
  it.each([...REASONS_ANTIGOS, null, 'regra_v2'])('completed_reason %s é aceito', async (valor) => {
    const t = await semearTesteAb({ status: 'paused' })
    const r = await clienteServico().from('ab_tests').update({ completed_reason: valor }).eq('id', t.testId)
    expect(r.error).toBeNull()
  })
  it('completed_reason "xyz" é recusado com o nome da constraint', async () => {
    const t = await semearTesteAb({ status: 'paused' })
    const r = await clienteServico().from('ab_tests').update({ completed_reason: 'xyz' }).eq('id', t.testId)
    expect(r.error?.message).toMatch(/ab_tests_completed_reason_check/)
  })

  it.each([...END_ANTIGOS, null, 'regra_v2', 'teste_youtube'])('end_reason %s num ciclo fechado é aceito', async (valor) => {
    const t = await semearTesteAb({ status: 'paused' })
    const r = await clienteServico().from('ab_test_cycles').update({ ended_at: new Date().toISOString(), end_reason: valor }).eq('test_id', t.testId)
    expect(r.error).toBeNull()
  })
  it('end_reason "xyz" é recusado', async () => {
    const t = await semearTesteAb({ status: 'paused' })
    const r = await clienteServico().from('ab_test_cycles').update({ ended_at: new Date().toISOString(), end_reason: 'xyz' }).eq('test_id', t.testId)
    expect(r.error?.message).toMatch(/ab_test_cycles_end_reason_check/)
  })

  const casosRestore: Array<[string, string]> = ESTADOS_RESTORE_STATUS.flatMap(e => (['title', 'thumbnail'] as const).map(c => [e, c] as [string, string]))
  it.each(casosRestore)('restore_status estado antigo %s no ramo %s é aceito', async (estado, ramo) => {
    const t = await semearTesteAb({ status: 'paused' })
    const r = await clienteServico().from('ab_tests').update({ restore_status: { [ramo]: { ...OK, estado } } }).eq('id', t.testId)
    expect(r.error).toBeNull()
  })
  it.each(['title', 'thumbnail'])('restore_status pulado_teste_youtube no ramo %s é aceito', async (ramo) => {
    const t = await semearTesteAb({ status: 'paused' })
    const r = await clienteServico().from('ab_tests').update({ restore_status: { [ramo]: PULADO } }).eq('id', t.testId)
    expect(r.error).toBeNull()
  })
  it.each(['title', 'thumbnail'])('restore_status "xyz" no ramo %s é recusado', async (ramo) => {
    const t = await semearTesteAb({ status: 'paused' })
    const r = await clienteServico().from('ab_tests').update({ restore_status: { [ramo]: { ...OK, estado: 'xyz' } } }).eq('id', t.testId)
    expect(r.error?.message).toMatch(/ab_tests_restore_status_shape/)
  })

  it.each([...ESTADOS_ANTIGOS, 'pulado_teste_youtube'])('ab_test_restores aceita estado %s em insert direto', async (estado) => {
    const t = await semearTesteAb({ status: 'paused' })
    const r = await q(`insert into public.ab_test_restores (test_id, seq, campo, destino, estado, forcado, attempts, em)
      values ($1, 1, 'title', 'original', $2, false, 0, now()) returning estado`, [t.testId, estado])
    expect(r[0]).toEqual({ estado })
  })
  it('ab_test_restores recusa "xyz" com o nome da constraint', async () => {
    const t = await semearTesteAb({ status: 'paused' })
    await expect(q(`insert into public.ab_test_restores (test_id, seq, campo, destino, estado, forcado, attempts, em)
      values ($1, 1, 'title', 'original', 'xyz', false, 0, now())`, [t.testId])).rejects.toThrow(/ab_test_restores_estado_check/)
  })

  it.each(['title', 'thumbnail'])('pelo gatilho: pulado_teste_youtube no ramo %s chega ao histórico', async (ramo) => {
    const t = await semearTesteAb({ status: 'paused' })
    const r = await clienteServico().from('ab_tests').update({ restore_status: { [ramo]: PULADO } }).eq('id', t.testId)
    expect(r.error).toBeNull()
    const h = await q(`select estado from public.ab_test_restores where test_id = $1 and campo = $2`, [t.testId, ramo])
    expect(h).toEqual([{ estado: 'pulado_teste_youtube' }])
  })
  it.each([...ESTADOS_ANTIGOS])('pelo gatilho: estado antigo %s chega ao histórico', async (estado) => {
    const t = await semearTesteAb({ status: 'paused' })
    const r = await clienteServico().from('ab_tests').update({ restore_status: { title: { ...OK, estado } } }).eq('id', t.testId)
    expect(r.error).toBeNull()
    const h = await q(`select estado from public.ab_test_restores where test_id = $1 and campo = 'title'`, [t.testId])
    expect(h).toEqual([{ estado }])
  })
  it('pelo gatilho: "xyz" é recusado no shape, antes do gatilho', async () => {
    const t = await semearTesteAb({ status: 'paused' })
    const r = await clienteServico().from('ab_tests').update({ restore_status: { title: { ...OK, estado: 'xyz' } } }).eq('id', t.testId)
    expect(r.error?.message).toMatch(/ab_tests_restore_status_shape/)
    expect(await q(`select 1 from public.ab_test_restores where test_id = $1`, [t.testId])).toHaveLength(0)
  })

  it('regra_duracao nasce "v1" sem ninguém escrever', async () => {
    const t = await semearTesteAb({ status: 'paused' })
    const r = await q(`select regra_duracao from public.ab_tests where id = $1`, [t.testId])
    expect(r[0]).toEqual({ regra_duracao: 'v1' })
  })
  it('regra_duracao "v3" é recusado', async () => {
    const t = await semearTesteAb({ status: 'paused' })
    const r = await clienteServico().from('ab_tests').update({ regra_duracao: 'v3' }).eq('id', t.testId)
    expect(r.error?.message).toMatch(/ab_tests_regra_duracao_check/)
  })
})
