// @vitest-environment node
/**
 * F2 T10: o gravador (`rodarSinaisDoNicho`) contra a função REAL `niche_signals_gravar`, com o lote que o núcleo monta (só o `loadRows` é sintético).
 * Pega o campo renomeado em `p_lote`/`p_vistos` que os testes com dublê deixam passar. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/f2-gravador-rpc.test.ts --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { criarCanal, criarSite } from '../helpers/mg6'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { ObservatoryRows } from '@/lib/youtube/observatorio/load'
import { canal, rowsDe, NOW, type VideoSpec } from '../youtube/observatorio/sinais/fixture-sinais'

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn(), addBreadcrumb: vi.fn() }))

const alvo = vi.hoisted(() => ({ site: '', rows: null as unknown }))
vi.mock('@/lib/youtube/observatorio/load', async (orig) => {
  const real = await orig<typeof import('@/lib/youtube/observatorio/load')>()
  return { ...real, loadRows: async (o: { siteId: string }) => (o.siteId === alvo.site ? alvo.rows : null) as ObservatoryRows }
})

import { rodarSinaisDoNicho } from '@/lib/youtube/observatorio/sinais/gravador'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const AGORA = new Date(NOW)

/** 9 vídeos normais por canal + 1 estourando falando do Egito, em dois canais. */
function cenario(): ObservatoryRows {
  const chs = [randomUUID(), randomUUID()]
  const specs: VideoSpec[] = []
  for (const ch of chs) {
    for (let i = 0; i < 9; i++) specs.push({ id: randomUUID(), ch, vpd: 100, ageDias: 20 + i, title: `Dicas de mala ${i}` })
    specs.push({ id: randomUUID(), ch, vpd: 1000, ageDias: 13, title: 'Viagem ao Egito barata' })
  }
  return rowsDe(chs.map((c) => canal(c)), specs)
}

describe.skipIf(skipIfNoLocalDb())('F2 T10: gravador contra niche_signals_gravar real', () => {
  let pg: Client
  let site = ''
  let org = ''
  // O gravador visita todo site de `competitor_channels`; aqui só o do teste (o banco de integração é compartilhado).
  const sb = (): SupabaseClient => {
    const real = getSupabaseServiceClient() as unknown as SupabaseClient
    return new Proxy(real, {
      get: (t, p) => {
        if (p !== 'from') return Reflect.get(t, p, t)
        return (tabela: string) => {
          const q = t.from(tabela)
          if (tabela !== 'competitor_channels') return q
          return new Proxy(q, { get: (qt, qp) => (qp === 'select' ? (...a: Parameters<typeof qt.select>) => qt.select(...a).eq('site_id', site) : Reflect.get(qt, qp, qt)) })
        }
      },
    })
  }

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    const s = await criarSite(pg)
    site = s.site; org = s.org
    alvo.site = site; alvo.rows = cenario()
    await criarCanal(pg, site)
  })
  afterAll(async () => {
    try {
      for (const t of ['niche_signals', 'niche_outliers_vistos', 'niche_signals_estado', 'video_lugares', 'competitor_channels'])
        await pg.query(`delete from public.${t} where site_id = $1`, [site])
      await pg.query('delete from public.sites where id = $1', [site])
      await pg.query('delete from public.audit_log where org_id = $1', [org])
      await pg.query('delete from public.organizations where id = $1', [org])
    } finally { await pg.end() }
  })

  it('grava de verdade: sinal do Egito, vistos do dia, estado e video_lugares; a 2ª passada atualiza em vez de duplicar', async () => {
    const r1 = await rodarSinaisDoNicho({ sb: sb(), agora: AGORA, prazoMs: 60_000, inicioMs: 0 })
    expect(r1).toMatchObject({ sites: 1, falhas: 0 })
    expect(r1.motivo).toBeUndefined()
    expect(r1.novos).toBeGreaterThanOrEqual(1)
    const sinais = (await pg.query(`select kind, subject_key, status, evidence from public.niche_signals where site_id = $1`, [site])).rows
    expect(sinais.map((s) => s.subject_key)).toContain('pais:EG')
    expect(sinais.every((s) => s.status === 'aberto')).toBe(true)
    expect(Number((await pg.query(`select count(*) from public.niche_outliers_vistos where site_id = $1`, [site])).rows[0].count)).toBeGreaterThanOrEqual(2)
    expect((await pg.query(`select rule_version from public.niche_signals_estado where site_id = $1`, [site])).rows).toHaveLength(1)
    expect(Number((await pg.query(`select count(*) from public.video_lugares where site_id = $1`, [site])).rows[0].count)).toBe(20)

    const antes = sinais.length
    const r2 = await rodarSinaisDoNicho({ sb: sb(), agora: AGORA, prazoMs: 60_000, inicioMs: 0 })
    expect(r2).toMatchObject({ falhas: 0, novos: 0 })
    expect(r2.atualizados).toBeGreaterThanOrEqual(1)
    expect(Number((await pg.query(`select count(*) from public.niche_signals where site_id = $1`, [site])).rows[0].count)).toBe(antes)
  })
})
