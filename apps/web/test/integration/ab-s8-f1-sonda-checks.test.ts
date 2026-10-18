// @vitest-environment node
/**
 * A/B Lab S8-F1: CHECKs de formato de ab_test_dias / ab_test_sondas (P3/Y4). Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run test/integration/ab-s8-f1-sonda-checks.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

describe.skipIf(skipIfNoLocalDb())('S8-F1: CHECKs de formato das tabelas de gravação', () => {
  let pg: Client
  let siteId: string
  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
    siteId = (await seedSite(getSupabaseServiceClient())).siteId
  })
  afterAll(async () => {
    await pg.query('delete from public.ab_test_sondas where site_id = $1', [siteId])
    await pg.query('delete from public.ab_test_dias where site_id = $1', [siteId])
    await pg.end()
  })

  const sonda = (video: string | null, erro: string | null) => pg.query(
    `insert into public.ab_test_sondas (test_id, hora, site_id, youtube_video_id, lida_em, erro, leitura_estado) values ($1, now(), $2, $3, now(), $4, 'falhou')`,
    [randomUUID(), siteId, video, erro]).then(() => null, (e: Error) => e.message)

  it.each(['timeout', 'rede', 'imagem_invalida', 'http_404', 'http_503', null])('erro %s é aceito', async (erro) => {
    expect(await sonda('abcdefghijk', erro)).toBeNull()
  })
  it.each(['xyz', 'http_4', 'http_4040', ''])('erro %j é recusado', async (erro) => {
    expect(await sonda('abcdefghijk', erro)).toMatch(/check/)
  })
  it('youtube_video_id nulo ou de tamanho errado é recusado', async () => {
    expect(await sonda(null, null)).toMatch(/null|check/)
    expect(await sonda('curto', null)).toMatch(/check/)
  })
  it('regra_duracao fora de v1/v2 é recusada em ab_test_dias', async () => {
    const r = await pg.query(
      `insert into public.ab_test_dias (test_id, day_pt, site_id, youtube_video_id, regra_duracao, segundos_do_dia, ciclos, alcance_estado, views_estado, retratado_em)
       values ($1, '2026-10-01', $2, 'abcdefghijk', 'v9', 86400, '[]', 'nao_medido', 'nao_medido', now())`, [randomUUID(), siteId]).then(() => null, (e: Error) => e.message)
    expect(r).toMatch(/check/)
  })
})
