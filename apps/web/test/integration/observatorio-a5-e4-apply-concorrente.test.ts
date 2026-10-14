// @vitest-environment node
/**
 * A5 · E4, portão de 15/10 (Phil D1): duas execuções de `competitor_marks_apply` ao mesmo tempo não deixam o par nas duas
 * tabelas. A primeira segura a transação com a marca; a segunda manda o motivo do MESMO par. Sem a trava
 * (`pg_advisory_xact_lock`) o `not exists` da segunda não enxerga a marca ainda não confirmada e as duas linhas ficam.
 *
 * Banco: SÓ o `bythiago_int` (MG4 aplicada).
 *   HAS_LOCAL_DB=1 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run test/integration/observatorio-a5-e4-apply-concorrente.test.ts
 * Dado inventado, criado e apagado (site inteiro) pelo próprio teste.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { criarCanal, criarSite, criarVideo, escalar, q1 } from '../helpers/mg6'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? ''

describe.skipIf(skipIfNoLocalDb())('A5 E4: competitor_marks_apply concorrente (trava de uma execução por vez)', () => {
  let a: Client
  let b: Client
  let adm: Client
  let site = ''
  let org = ''

  beforeAll(async () => {
    if (!PG_URL.includes(':54422/')) throw new Error('SUPABASE_DB_URL não aponta para o banco de integração (:54422/)')
    adm = new Client({ connectionString: PG_URL })
    a = new Client({ connectionString: PG_URL })
    b = new Client({ connectionString: PG_URL })
    await Promise.all([adm.connect(), a.connect(), b.connect()])
  })
  afterAll(async () => {
    try {
      if (site) await adm.query('delete from public.sites where id = $1', [site])
      if (org) await adm.query('delete from public.organizations where id = $1', [org])
    } finally {
      await Promise.all([adm.end(), a.end(), b.end()])
    }
  })

  it('marca e motivo do mesmo par, ao mesmo tempo: o par fica em UMA tabela só', async () => {
    const s = await criarSite(adm)
    site = s.site
    org = s.org
    const canal = await criarCanal(adm, site)
    const video = await criarVideo(adm, canal, 5)
    const base = (await q1(adm, `select to_char(published_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as t, extract(epoch from published_at)::float8 as e from public.competitor_videos where id = $1`, [video]))
    const t0 = base.t as string
    const marcas = JSON.stringify([{
      video_id: video, age_days: 1, base_at: t0, views: 1000, likes: null, comments: null, likes_hidden: false, comments_disabled: false,
      read_before_at: new Date(Math.floor(Number(base.e) * 1000) + 23 * 3_600_000).toISOString(),
      read_after_at: new Date(Math.floor(Number(base.e) * 1000) + 25 * 3_600_000).toISOString(),
    }])
    const faltas = JSON.stringify([{ video_id: video, age_days: 1, base_at: t0, reason: 'sem_leitura', since_at: null }])
    const SQL = 'select public.competitor_marks_apply($1::jsonb, $2::jsonb, 1, now(), 8, 36) as r'

    await a.query('begin')
    const ra = (await a.query(SQL, [marcas, '[]'])).rows[0].r as { marcas: number }
    expect(ra.marcas).toBe(1)
    // B dispara com A ainda aberta: com a trava, B espera; sem ela, termina na hora.
    const pb = b.query(SQL, ['[]', faltas])
    await new Promise((r) => setTimeout(r, 1500))
    await a.query('commit')
    await pb

    const m = await escalar(adm, `select count(*)::int from public.competitor_video_marks where video_id = $1`, [video])
    const f = await escalar(adm, `select count(*)::int from public.competitor_video_mark_misses where video_id = $1`, [video])
    expect({ marcas: m, faltas: f }).toEqual({ marcas: 1, faltas: 0 })
  })
})
