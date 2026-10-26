// @vitest-environment node
/**
 * A/B Lab S8-F4 T11b (C-15): aplicar o sugerido usa o ab_settle_claim real (completed -> completed). Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-s8-f4-aplicar.test.ts --no-file-parallelism
 */
import { describe, it, expect, vi } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico } from '../helpers/db-seed'
import { caminhoDe } from '@/lib/youtube/ab-settle'

vi.setConfig({ testTimeout: 60_000 })

describe.skipIf(skipIfNoLocalDb())('S8-F4 C-15: ab_settle_claim com o caminho aplicar_sugerido', () => {
  it('completed regra_v2 -> completed manual_winner: troca vencedor, mantém completed_at e result_metadata.v2.encerrado_em_dia, sobe o seq', async () => {
    const t = await semearTesteAb({ status: 'active', cicloAberto: 0 })
    const s = clienteServico()
    const meta = { v2: { encerrado_em_dia: '2026-10-20', vencedor_sugerido: t.varB, provisorio: true } }
    const fecha = await s.rpc('ab_settle_claim', { p_test_id: t.testId, p_seq: 0, p_de: ['active'], p_para: 'completed', p_end_reason: 'regra_v2', p_restore_status: {}, p_extra: { completed_reason: 'regra_v2' } })
    expect(fecha.error).toBeNull()
    await s.from('ab_tests').update({ result_metadata: meta }).eq('id', t.testId)
    const antes = await s.from('ab_tests').select('completed_at, restore_seq').eq('id', t.testId).single()
    const c = caminhoDe({ siteId: t.siteId, destino: { tipo: 'variante', id: t.varB }, motivo: 'aplicar_sugerido' }, { varianteId: t.varB })
    const r = await s.rpc('ab_settle_claim', { p_test_id: t.testId, p_seq: antes.data!.restore_seq, p_de: c.de, p_para: c.para, p_end_reason: c.endReason, p_restore_status: {}, p_extra: c.extra })
    expect(r.error).toBeNull()
    expect((r.data as unknown[]).length).toBe(1)
    const x = await s.from('ab_tests').select('status, completed_reason, winner_variant_id, completed_at, restore_seq, result_metadata').eq('id', t.testId).single()
    expect(x.data).toMatchObject({ status: 'completed', completed_reason: 'manual_winner', winner_variant_id: t.varB, completed_at: antes.data!.completed_at, restore_seq: antes.data!.restore_seq + 1 })
    expect((x.data!.result_metadata as { v2: { encerrado_em_dia: string } }).v2.encerrado_em_dia).toBe('2026-10-20')
    // seq velho (CAS): segunda chamada com o seq anterior não reivindica nada
    const velho = await s.rpc('ab_settle_claim', { p_test_id: t.testId, p_seq: antes.data!.restore_seq, p_de: c.de, p_para: c.para, p_end_reason: c.endReason, p_restore_status: {}, p_extra: c.extra })
    expect((velho.data as unknown[]).length).toBe(0)
  })

  it('P3 do Phil: p_vencedor_esperado — letra igual reivindica; letra trocada não; sem o parâmetro = comportamento antigo', async () => {
    const s = clienteServico()
    const preparar = async () => {
      const t = await semearTesteAb({ status: 'active', cicloAberto: 0 })
      const fecha = await s.rpc('ab_settle_claim', { p_test_id: t.testId, p_seq: 0, p_de: ['active'], p_para: 'completed', p_end_reason: 'regra_v2', p_restore_status: {}, p_extra: { completed_reason: 'regra_v2' } })
      expect(fecha.error).toBeNull()
      await s.from('ab_tests').update({ result_metadata: { v2: { vencedor_sugerido: t.varB } } }).eq('id', t.testId)
      const seq = (await s.from('ab_tests').select('restore_seq').eq('id', t.testId).single()).data!.restore_seq as number
      const c = caminhoDe({ siteId: t.siteId, destino: { tipo: 'variante', id: t.varB }, motivo: 'aplicar_sugerido' }, { varianteId: t.varB })
      const args = { p_test_id: t.testId, p_seq: seq, p_de: c.de, p_para: c.para, p_end_reason: c.endReason, p_restore_status: {}, p_extra: c.extra }
      return { t, args }
    }
    const igual = await preparar()
    expect(((await s.rpc('ab_settle_claim', { ...igual.args, p_vencedor_esperado: igual.t.varB })).data as unknown[]).length).toBe(1)
    const outra = await preparar()
    const r = await s.rpc('ab_settle_claim', { ...outra.args, p_vencedor_esperado: outra.t.varA })
    expect(r.error).toBeNull()
    expect((r.data as unknown[]).length).toBe(0)
    expect((await s.from('ab_tests').select('restore_seq').eq('id', outra.t.testId).single()).data!.restore_seq).toBe(outra.args.p_seq)
    // Phil M1: result_metadata nulo ou sem v2 + letra esperada => recusa (fail closed), seq intacto.
    for (const meta of [null, {}, { v2: null }, { v2: { vencedor_sugerido: null } }]) {
      const sv = await preparar()
      await s.from('ab_tests').update({ result_metadata: meta }).eq('id', sv.t.testId)
      const rv = await s.rpc('ab_settle_claim', { ...sv.args, p_vencedor_esperado: sv.t.varB })
      expect(rv.error).toBeNull()
      expect((rv.data as unknown[]).length).toBe(0)
      expect((await s.from('ab_tests').select('restore_seq').eq('id', sv.t.testId).single()).data!.restore_seq).toBe(sv.args.p_seq)
    }
    const sem = await preparar()
    expect(((await s.rpc('ab_settle_claim', sem.args)).data as unknown[]).length).toBe(1)
  })
})
