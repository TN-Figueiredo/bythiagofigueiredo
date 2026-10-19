import { describe, it, expect, vi, beforeEach } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico } from '../helpers/db-seed'

// P4b lote A, Phil P-6: a consulta de bloqueio da faixa, contra o bythiago_int. Reais: ab_tests e ab_test_restores.
// Dublês: a permissão, a saúde do vigia e (no caso de erro) o cliente de serviço, que falha só na consulta do bloqueio.
const falhaNoBloqueio = { ligada: false }
vi.mock('@/lib/supabase/service', () => {
  return {
    getSupabaseServiceClient: () => {
      const db = clienteServico()
      return new Proxy(db, {
        get(alvo, prop, recv) {
          if (prop !== 'from') return Reflect.get(alvo, prop, recv)
          return (tabela: string) => {
            if (!(falhaNoBloqueio.ligada && tabela === 'ab_tests')) return alvo.from(tabela)
            const q: Record<string, unknown> = {}
            const encadeia = () => q
            for (const m of ['select', 'eq', 'neq', 'in', 'limit']) q[m] = encadeia
            q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'banco caiu' } }).then(ok)
            return q
          }
        },
      })
    },
  }
})
vi.mock('@/lib/cms/auth-guards', () => ({ requireSiteAdminScope: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/lib/cron-health', () => ({ getCronHealth: vi.fn(async () => ({ updated_at: '2026-10-19T07:00:00.000Z' })) }))
const captureMessage = vi.fn()
const captureException = vi.fn()
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => captureMessage(...a), captureException: (...a: unknown[]) => captureException(...a) }))

import { carregarDadosDaFaixa } from '@/app/cms/(authed)/youtube/ab-lab/_components/faixa-dados'
import type { RestoreStatus } from '@/lib/youtube/ab-restore'

const falhou = { estado: 'falhou', destino: 'original', em: new Date().toISOString(), forcado: false, escreveu: false, erro: null, attempts: 1 }
const rs = { title: falhou } as unknown as RestoreStatus

describe.skipIf(skipIfNoLocalDb())('P4b lote A: carregarDadosDaFaixa (bloqueio) no banco real', () => {
  const db = clienteServico()
  beforeEach(() => { vi.clearAllMocks(); falhaNoBloqueio.ligada = false })

  async function semearComOutro(statusDoOutro: string | null) {
    const t = await semearTesteAb({ status: 'active', cicloAberto: null, testType: 'title' })
    await db.from('ab_tests').update({ status: 'completed', restore_status: rs }).eq('id', t.testId)
    const { data } = await db.from('ab_tests').select('youtube_video_id').eq('id', t.testId).single()
    if (statusDoOutro) {
      const r = await db.from('ab_tests').insert({
        site_id: t.siteId, youtube_video_id: data!.youtube_video_id, name: 'Outro', status: statusDoOutro, test_type: 'title',
        config: { max_duration_days: 14, confidence_threshold: 0.95, burn_in_days: 2, rotation_pattern: 'abba' },
        original_thumbnail_url: 'https://i.ytimg.com/vi/test/hqdefault.jpg',
      })
      if (r.error) throw new Error(r.error.message)
    }
    return { id: t.testId, site_id: t.siteId, youtube_video_id: data!.youtube_video_id as string, status: 'completed' }
  }

  it('outro teste aberto no mesmo vídeo → bloqueio outro_teste; sozinho (o próprio não conta) → nulo', async () => {
    const com = await semearComOutro('active')
    expect((await carregarDadosDaFaixa(com, rs)).bloqueio).toBe('outro_teste')
    const so = await semearComOutro(null)
    expect((await carregarDadosDaFaixa(so, rs)).bloqueio).toBeNull()
    const concluido = await semearComOutro('completed')
    expect((await carregarDadosDaFaixa(concluido, rs)).bloqueio).toBeNull()
  })

  it('P-6: erro na consulta do bloqueio → sem promessa de hora (vigiaUltimaExecucao nulo), nunca "sem bloqueio" prometendo; Sentry avisado', async () => {
    const t = await semearComOutro('active')
    expect((await carregarDadosDaFaixa(t, rs)).vigiaUltimaExecucao).not.toBeNull()
    falhaNoBloqueio.ligada = true
    const d = await carregarDadosDaFaixa(t, rs)
    expect(d.vigiaUltimaExecucao).toBeNull()
    expect(captureMessage).toHaveBeenCalledTimes(1)
  })
})
