// @vitest-environment node
/**
 * A/B Lab S8-F4 T9 (C-15): o encerramento pela regra v2 usa o ab_settle_claim real. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-s8-f4-settle.test.ts --no-file-parallelism
 */
import { describe, it, expect, vi } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico } from '../helpers/db-seed'

vi.setConfig({ testTimeout: 60_000 })

describe.skipIf(skipIfNoLocalDb())('S8-F4 C-15: ab_settle_claim com p_end_reason regra_v2', () => {
  it('fecha o ciclo com end_reason regra_v2, deixa completed e sem winner_variant_id', async () => {
    const t = await semearTesteAb({ status: 'active', cicloAberto: 0 })
    const s = clienteServico()
    const r = await s.rpc('ab_settle_claim', { p_test_id: t.testId, p_seq: 0, p_de: ['active'], p_para: 'completed', p_end_reason: 'regra_v2', p_restore_status: {}, p_extra: { completed_reason: 'regra_v2' } })
    expect(r.error).toBeNull()
    const x = await s.from('ab_tests').select('status, completed_reason, winner_variant_id').eq('id', t.testId).single()
    const c = await s.from('ab_test_cycles').select('ended_at, end_reason').eq('test_id', t.testId).single()
    expect(x.data).toMatchObject({ status: 'completed', completed_reason: 'regra_v2', winner_variant_id: null })
    expect(c.data?.end_reason).toBe('regra_v2')
    expect(c.data?.ended_at).not.toBeNull()
  })
})
