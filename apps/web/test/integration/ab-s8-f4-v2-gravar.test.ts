// @vitest-environment node
/**
 * A/B Lab S8-F4 (T6): RPC `ab_test_v2_gravar`. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-s8-f4-v2-gravar.test.ts --no-file-parallelism
 */
import { describe, it, expect, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico, q, SUPABASE_URL, ANON_KEY, signUserJwt } from '../helpers/db-seed'

vi.setConfig({ testTimeout: 60_000 })

async function semearV2(regra: 'v1' | 'v2' = 'v2'): Promise<string> {
  const t = await semearTesteAb({ status: 'active' })
  await q(`update public.ab_tests set regra_duracao = $2 where id = $1`, [t.testId, regra])
  return t.testId
}
async function v2De(id: string): Promise<Record<string, unknown>> {
  const r = await q<{ v2: Record<string, unknown> | null }>(`select result_metadata->'v2' as v2 from public.ab_tests where id = $1`, [id])
  return r[0]?.v2 ?? {}
}
async function gravar(id: string, v2: object, hist: object[] | null = null, soSeSemN = false): Promise<number> {
  const r = await clienteServico().rpc('ab_test_v2_gravar', { p_test_id: id, p_v2: v2, p_hist: hist, p_so_se_sem_n: soSeSemN })
  expect(r.error).toBeNull()
  return r.data as unknown as number
}

describe.skipIf(skipIfNoLocalDb())('S8-F4 T6: ab_test_v2_gravar', () => {
  it('(a) n, tentativa_falhou, desfecho, desfecho_final: congelados ficam', async () => {
    const id = await semearV2()
    expect(await gravar(id, { n: 5000, p1: 0.04, base_estimada: 120000, p1_motivo: 'janela' })).toBe(1)
    await gravar(id, { tentativa_falhou: { em: 'x' } })
    await gravar(id, { desfecho: 'seguir', desfecho_no_encerramento: 'vencedor_provavel', encerrado_em_dia: '2026-10-20' })
    await gravar(id, { desfecho_final: 'vencedor_provavel', n: 9, p1: 0.5, base_estimada: 1, p1_motivo: 'outro', desfecho_no_encerramento: 'zzz' })
    const v = await v2De(id)
    expect(v).toMatchObject({ n: 5000, p1: 0.04, base_estimada: 120000, p1_motivo: 'janela', desfecho_no_encerramento: 'vencedor_provavel', desfecho: 'seguir', desfecho_final: 'vencedor_provavel', tentativa_falhou: { em: 'x' } })
  })
  it('(b) duas chamadas com a flag: a 2ª devolve 0', async () => {
    const id = await semearV2()
    expect(await gravar(id, { n: 100 }, null, true)).toBe(1)
    expect(await gravar(id, { n: 200 }, null, true)).toBe(0)
    expect((await v2De(id)).n).toBe(100)
  })
  it('(c) 2ª gravação de desfecho_no_encerramento e encerrado_em_dia não muda', async () => {
    const id = await semearV2()
    await gravar(id, { desfecho_no_encerramento: 'a', encerrado_em_dia: '2026-10-01' })
    await gravar(id, { desfecho_no_encerramento: 'b', encerrado_em_dia: '2026-10-02' })
    expect(await v2De(id)).toMatchObject({ desfecho_no_encerramento: 'a', encerrado_em_dia: '2026-10-01' })
  })
  it('(d) historico cresce e p_v2 com historico não o apaga', async () => {
    const id = await semearV2()
    await gravar(id, { x: 1 }, [{ em: '1', desfecho: 'seguir' }])
    await gravar(id, { x: 2, historico: [{ lixo: true }] }, [{ em: '2', desfecho: 'encerrar' }])
    const v = await v2De(id)
    expect(v.historico).toEqual([{ em: '1', desfecho: 'seguir' }, { em: '2', desfecho: 'encerrar' }])
    await gravar(id, { x: 3, historico: [] })
    expect((await v2De(id)).historico).toHaveLength(2)
  })
  it('(e) anon e authenticated recebem permission denied', async () => {
    const id = await semearV2()
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
    const ra = await anon.rpc('ab_test_v2_gravar', { p_test_id: id, p_v2: { n: 1 } })
    expect(ra.error?.message).toMatch(/permission denied/)
    const { jwt } = signUserJwt()
    const au = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${jwt}` } } })
    const rb = await au.rpc('ab_test_v2_gravar', { p_test_id: id, p_v2: { n: 1 } })
    expect(rb.error?.message).toMatch(/permission denied/)
    expect(await v2De(id)).toEqual({})
  })
  it('(f) inexistente e v1 devolvem -1', async () => {
    expect(await gravar(randomUUID(), { n: 1 })).toBe(-1)
    const v1 = await semearV2('v1')
    expect(await gravar(v1, { n: 1 })).toBe(-1)
    expect(await v2De(v1)).toEqual({})
  })
  it('(h) tentativa_falhou null limpa a chave anterior', async () => {
    const id = await semearV2()
    await gravar(id, { tentativa_falhou: { em: 'x' } })
    await gravar(id, { tentativa_falhou: null })
    expect((await v2De(id)).tentativa_falhou).toBeNull()
  })
  it('(i) n JSON null não grava n e a chamada seguinte com flag e n numérico devolve 1', async () => {
    const id = await semearV2()
    expect(await gravar(id, { n: null, p1: null }, null, true)).toBe(1)
    const v = await v2De(id)
    expect('n' in v).toBe(false)
    expect('p1' in v).toBe(false)
    expect(await gravar(id, { n: 777 }, null, true)).toBe(1)
    expect((await v2De(id)).n).toBe(777)
    expect(await gravar(id, { n: 888 }, null, true)).toBe(0)
  })
  it('(j) duas chamadas iguais com p_hist deixam 1 entrada', async () => {
    const id = await semearV2()
    const h = [{ em: '2026-10-20T14:00:00Z', desfecho: 'seguir' }]
    await gravar(id, { desfecho: 'seguir' }, h)
    await gravar(id, { desfecho: 'seguir' }, h)
    expect((await v2De(id)).historico).toHaveLength(1)
    await gravar(id, { desfecho: 'encerrar' }, [{ em: 'b', desfecho: 'encerrar' }])
    expect((await v2De(id)).historico).toHaveLength(2)
  })
})
