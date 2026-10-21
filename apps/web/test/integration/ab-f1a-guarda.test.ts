import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico } from '../helpers/db-seed'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
const servico = vi.hoisted(() => ({ cliente: null as unknown }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => servico.cliente }))
vi.mock('@/lib/youtube/ab-preflight', () => ({ preflightTokenCheck: () => { throw new Error('a guarda vem antes do token') } }))

import type { SupabaseClient } from '@supabase/supabase-js'
import { phaseRotateActiveTests } from '@/lib/youtube/ab-rotate-phases'
import { NOTA_TESTE_YOUTUBE } from '@/lib/youtube/ab-settle'

// Rotação real contra o banco: com a flag `on`, linha detectada pausa sem escrever e sem tocar no YouTube.
// O trecho "Não é teste -> retomar aceita" entra com a Tarefa 10 (envio 1b).
describe.skipIf(skipIfNoLocalDb())('guarda do teste do YouTube na rotação (banco)', () => {
  beforeAll(() => { vi.stubEnv('AB_PAUSA_POR_DETECTADO', 'on'); servico.cliente = clienteServico() })
  afterAll(() => { vi.unstubAllEnvs() })
  let t: { testId: string; siteId: string }
  const videoDoTeste = async () => (await clienteServico().from('ab_tests').select('youtube_video_id').eq('id', t.testId).single()).data!.youtube_video_id as string
  /** O banco de integração guarda testes ativos de outras suítes: a rotação só enxerga os do site semeado. */
  const soDoMeuSite = (): SupabaseClient => {
    const c = clienteServico()
    return new Proxy(c, {
      get(alvo, prop) {
        if (prop !== 'from') { const v = Reflect.get(alvo, prop); return typeof v === 'function' ? v.bind(alvo) : v }
        return (tabela: string) => {
          const q = alvo.from(tabela)
          if (tabela !== 'ab_tests') return q
          return new Proxy(q, { get(qa, qp) {
            if (qp === 'select') return (...a: Parameters<typeof qa.select>) => qa.select(...a).eq('site_id', t.siteId)
            const v = Reflect.get(qa, qp); return typeof v === 'function' ? v.bind(qa) : v
          } })
        }
      },
    })
  }
  beforeEach(async () => { t = await semearTesteAb({ status: 'active', testType: 'combo', cicloAberto: 0 }) })

  const semear = async (confirmado: boolean) => {
    const db = clienteServico()
    await db.from('ab_test_cycles').update({ started_at: new Date(Date.now() - 2 * 86_400_000).toISOString() }).eq('test_id', t.testId)
    const ins = await db.from('ab_native_tests').insert({
      site_id: t.siteId, video_id: await videoDoTeste(), youtube_video_id: 'abcdefghijk', origem: confirmado ? 'confirmado' : 'detectado',
      campos: ['titulo'], estado: 'em_andamento', confirmado_em: confirmado ? new Date().toISOString() : null,
      ...(confirmado ? {} : { variantes_titulo: ['a', 'b'], primeira_vista: new Date().toISOString(), versao_regra: 1 }),
    })
    expect(ins.error).toBeNull()
  }

  it('on + detectada: pausa sem escrever (paused, pulado_teste_youtube, ciclo fechado com teste_youtube)', async () => {
    await semear(false)
    const r = await phaseRotateActiveTests(soDoMeuSite())
    expect(r).toMatchObject({ processed: 0, errors: 0 })
    const x = await clienteServico().from('ab_tests').select('status, status_note, restore_status').eq('id', t.testId).single()
    expect(x.data).toMatchObject({ status: 'paused', status_note: NOTA_TESTE_YOUTUBE })
    expect(x.data?.restore_status).toMatchObject({ title: { estado: 'pulado_teste_youtube' } })
    const c = await clienteServico().from('ab_test_cycles').select('end_reason').eq('test_id', t.testId)
    expect(c.data![0]!.end_reason).toBe('teste_youtube')
  })

  it('linha confirmada com a flag on também pausa; e a rotação seguinte não toca mais no teste pausado', async () => {
    await semear(true)
    await phaseRotateActiveTests(soDoMeuSite())
    expect((await clienteServico().from('ab_tests').select('status').eq('id', t.testId).single()).data?.status).toBe('paused')
    const r2 = await phaseRotateActiveTests(soDoMeuSite())
    expect(r2).toMatchObject({ processed: 0 })
  })

  it('sem linha aberta: a guarda não pausa (a rotação segue o caminho de sempre e para no token)', async () => {
    await clienteServico().from('ab_test_cycles').update({ started_at: new Date(Date.now() - 2 * 86_400_000).toISOString() }).eq('test_id', t.testId)
    const r = await phaseRotateActiveTests(soDoMeuSite())
    expect(r.errors).toBe(1) // o preflight falso lança: prova que passou pela guarda
    expect((await clienteServico().from('ab_tests').select('status').eq('id', t.testId).single()).data?.status).toBe('active')
  })
})
