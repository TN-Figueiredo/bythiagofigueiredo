// @vitest-environment node
/**
 * S8-F3 T2: leitura de ab_test_dias pelo cliente de service role (banco local de integração):
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-s8-f3-leitura.test.ts --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { apagarSites } from '../helpers/limpa-cena'
import { lerDiasDoTeste } from '@/lib/youtube/ab-gravacao/placar-leitura'

vi.setConfig({ testTimeout: 60_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

function linha(testId: string, siteId: string, dia: string, extra: Record<string, unknown>): Record<string, unknown> {
  return {
    test_id: testId, day_pt: dia, site_id: siteId, youtube_video_id: 'abcdefghijk', regra_duracao: 'v2',
    variant_id: randomUUID(), motivo_sem_variante: null, motivo_nulo_meta: null,
    segundos_no_ar: 80000, segundos_do_dia: 86400, dia_de_troca: true, ciclos: [{ id: 'c1', started_at: '2026-10-01T00:00:00Z', ended_at: null }],
    impressoes: 100, ctr: 0.0412, alcance_estado: 'medido', source_report_id: 'rep', report_create_time: null,
    views: 4, views_estado: 'medido', views_fonte: 'f', metric_version: 'mv', engaged_views: null,
    watch_time_minutes: null, avg_view_percentage: null, troca_vista_em: null, retratado_em: '2026-10-01T14:00:00Z', final: false,
    ...extra,
  }
}

describe.skipIf(skipIfNoLocalDb())('S8-F3 T2: leitura de ab_test_dias (banco local)', () => {
  let pg: Client
  const sites: string[] = []
  const testes: string[] = []
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => {
    try {
      if (testes.length > 0) await pg.query('delete from public.ab_test_dias where test_id = any($1::uuid[])', [testes])
      if (sites.length > 0) await apagarSites(pg, 'id = any($1::uuid[])', [sites])
    } finally { await pg.end() }
  })

  it('numeric volta como número (ctr e impressoes)', async () => {
    const sb = getSupabaseServiceClient()
    const siteId = (await seedSite(sb)).siteId; sites.push(siteId)
    const testId = randomUUID(); testes.push(testId)
    const rows = [
      linha(testId, siteId, '2026-10-01', {}),
      linha(testId, siteId, '2026-10-02', { alcance_estado: 'zero_medido', impressoes: 0, ctr: null }),
      linha(testId, siteId, '2026-10-03', { alcance_estado: 'aguardando', impressoes: null, ctr: null }),
    ]
    const ap = await sb.rpc('ab_test_dias_apply', { p_rows: rows })
    if (ap.error) throw new Error('apply: ' + ap.error.message)
    const r = await lerDiasDoTeste(sb, siteId, testId)
    if (!r.ok) throw new Error('leitura: ' + r.motivo)
    expect(r.dias).toHaveLength(3)
    expect(typeof r.dias[0]!.ctr).toBe('number')
    expect(r.dias[0]!.ctr).toBeCloseTo(0.0412, 6)
    expect(typeof r.dias[0]!.impressoes).toBe('number')
    expect(r.dias[2]!.impressoes).toBeNull()
  })
})
