import { describe, it, expect, beforeEach, vi } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico } from '../helpers/db-seed'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { throw new Error('use o cliente injetado') } }))

import { settleOnAir, ORIGINAL, NOTA_TESTE_YOUTUBE } from '@/lib/youtube/ab-settle'
import type { PortasSaida } from '@/lib/youtube/ab-settle'

// Ensaio no banco real (bythiago_int): settleOnAir(teste_youtube) fecha o ciclo e grava o restore_status final, sem tocar o YouTube.
describe.skipIf(skipIfNoLocalDb())('settleOnAir teste_youtube no banco', () => {
  let t: { testId: string; varA: string; varB: string; siteId: string }
  const proibida = (n: string) => vi.fn(() => { throw new Error(`porta proibida: ${n}`) })
  const portas = (): Partial<PortasSaida> => ({
    supabase: clienteServico(),
    token: proibida('token') as unknown as PortasSaida['token'],
    fetch: proibida('fetch') as unknown as typeof fetch,
    autoImportWinner: proibida('autoImportWinner') as unknown as PortasSaida['autoImportWinner'],
  })
  beforeEach(async () => { t = await semearTesteAb({ status: 'active', testType: 'combo', cicloAberto: 0 }) })

  it('active: pausa, nota, restore_seq+1, campos pulados, ciclo fechado com teste_youtube, marcador nulo', async () => {
    const db = clienteServico()
    await db.from('ab_tests').update({ last_applied_variant_id: t.varB }).eq('id', t.testId)
    const r = await settleOnAir(t.testId, { siteId: t.siteId, destino: ORIGINAL, motivo: 'teste_youtube' }, portas())
    expect(r.resultado).toBe('feito')
    const x = await db.from('ab_tests').select('status, status_note, restore_seq, restore_status, last_applied_variant_id, paused_at').eq('id', t.testId).single()
    expect(x.data).toMatchObject({ status: 'paused', status_note: NOTA_TESTE_YOUTUBE, restore_seq: 1, last_applied_variant_id: null })
    expect(x.data?.paused_at).not.toBeNull()
    expect(x.data?.restore_status).toMatchObject({ title: { estado: 'pulado_teste_youtube', escreveu: false }, thumbnail: { estado: 'pulado_teste_youtube', escreveu: false } })
    const c = await db.from('ab_test_cycles').select('ended_at, end_reason').eq('test_id', t.testId)
    expect(c.data).toHaveLength(1)
    expect(c.data![0]).toMatchObject({ end_reason: 'teste_youtube' })
    expect(c.data![0]!.ended_at).not.toBeNull()
    const h = await db.from('ab_test_restores').select('campo, estado').eq('test_id', t.testId)
    expect(h.error).toBeNull()
    expect((h.data ?? []).every((l) => l.estado === 'pulado_teste_youtube')).toBe(true)
  })

  it('já paused: o ended_at do ciclo continua o da pausa antiga (Yannis C1)', async () => {
    const db = clienteServico()
    const antes = new Date(Date.now() - 3 * 86_400_000).toISOString()
    await db.from('ab_test_cycles').update({ started_at: new Date(Date.now() - 5 * 86_400_000).toISOString() }).eq('test_id', t.testId)
    await db.from('ab_tests').update({ status: 'paused', paused_at: antes }).eq('id', t.testId)
    const r = await settleOnAir(t.testId, { siteId: t.siteId, destino: ORIGINAL, motivo: 'teste_youtube' }, portas())
    expect(r.resultado).toBe('feito')
    const x = await db.from('ab_tests').select('paused_at, status').eq('id', t.testId).single()
    expect(x.data?.status).toBe('paused')
    expect(new Date(x.data!.paused_at as string).getTime()).toBe(new Date(antes).getTime())
    const c = await db.from('ab_test_cycles').select('ended_at, started_at, end_reason').eq('test_id', t.testId).single()
    expect(c.data?.end_reason).toBe('teste_youtube')
    expect(new Date(c.data!.ended_at as string).getTime()).toBe(new Date(antes).getTime())
  })

  it('segunda chamada (paused, restore_seq mudou, seqEsperado velho): não regrava', async () => {
    await settleOnAir(t.testId, { siteId: t.siteId, destino: ORIGINAL, motivo: 'teste_youtube' }, portas())
    const r = await settleOnAir(t.testId, { siteId: t.siteId, destino: ORIGINAL, motivo: 'teste_youtube', seqEsperado: 0 }, portas())
    expect(r.resultado).toBe('em_andamento')
    const x = await clienteServico().from('ab_tests').select('restore_seq').eq('id', t.testId).single()
    expect(x.data?.restore_seq).toBe(1)
  })
})
