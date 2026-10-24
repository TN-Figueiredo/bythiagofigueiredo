// @vitest-environment node
/**
 * F1a-tela-2 T1: CHECK da derivada aceita venceu_original (n = 1) e `resposta_mudada_em`. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-f1a-tela2-migration --no-file-parallelism
 * Mutante: trocar na migration `venceu_original' and variante_vencedora = 1` por `... and variantes is not null and ...` derruba o teste (b).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { apagarSites } from '../helpers/limpa-cena'

vi.setConfig({ testTimeout: 60_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FICHA2 = JSON.stringify([{ n: 1, tipo: 'titulo', titulo: 'Original' }, { n: 2, tipo: 'titulo', titulo: 'Nova' }])
const MIGRATION = (() => {
  const dir = resolve(__dirname, '../../../../supabase/migrations')
  return readFileSync(resolve(dir, readdirSync(dir).find((f) => f.endsWith('_ab_lab_f1a_tela2_original_derivada_e_mudanca.sql'))!), 'utf8')
})()

describe.skipIf(skipIfNoLocalDb())('F1a-tela-2 T1: migration (CHECK da derivada, resposta_mudada_em)', () => {
  let pg: Client
  let siteId: string
  let videoId: string

  beforeAll(async () => {
    const sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    siteId = (await seedSite(sb)).siteId
    const k = randomUUID().replace(/-/g, '')
    const canal = String((await pg.query(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [siteId, 'UC' + k.slice(0, 20), '@t2' + k.slice(0, 8), 'UU' + k.slice(0, 20), 't2-' + k.slice(0, 8)])).rows[0].id)
    videoId = String((await pg.query(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at)
      values ($1, $2, $3, 'T', now()) returning id`, [siteId, canal, 'y' + randomUUID().replace(/-/g, '').slice(0, 10)])).rows[0].id)
  })
  afterAll(async () => {
    try {
      await pg.query('delete from public.youtube_videos where site_id = $1', [siteId])
      await pg.query('delete from public.youtube_channels where site_id = $1', [siteId])
      await pg.query('delete from public.audit_log where site_id = $1', [siteId])
      await apagarSites(pg, 'id = $1', [siteId])
    } finally {
      await pg.end()
    }
  })

  async function tenta(o: { ficha: boolean; resposta: string; n: number }): Promise<string | null> {
    await pg.query('begin')
    try {
      await pg.query(`insert into public.ab_native_tests (site_id, video_id, youtube_video_id, origem, campos, estado, variantes_titulo, primeira_vista, versao_regra,
          variantes, confirmado_em, encerrado_em, resposta_dono, variante_vencedora, respondido_em)
        values ($1, $2, 'abcdefghijk', $3, '{titulo}', 'encerrado', $4::jsonb, now() - interval '1 day', 1, $5::jsonb, $6, now(), $7, $8, now())`,
      [siteId, videoId, o.ficha ? 'confirmado' : 'detectado', o.ficha ? null : '["a","b"]', o.ficha ? FICHA2 : null,
        o.ficha ? new Date().toISOString() : null, o.resposta, o.n])
      return null
    } catch (e) { return (e as { code?: string }).code ?? 'sem_codigo' } finally { await pg.query('rollback') }
  }

  it('(a) derivada: venceu_nova aceita n=1 e recusa n=4', async () => {
    expect(await tenta({ ficha: false, resposta: 'venceu_nova', n: 1 })).toBeNull()
    expect(await tenta({ ficha: false, resposta: 'venceu_nova', n: 4 })).toBe('23514')
  })
  it('(b) derivada: venceu_original com n=1 aceito, com n=2 recusado', async () => {
    expect(await tenta({ ficha: false, resposta: 'venceu_original', n: 1 })).toBeNull()
    expect(await tenta({ ficha: false, resposta: 'venceu_original', n: 2 })).toBe('23514')
  })
  it('(c) ficha: o CHECK antigo segue (venceu_nova n=1 recusado; venceu_original n=1 aceito)', async () => {
    expect(await tenta({ ficha: true, resposta: 'venceu_nova', n: 1 })).toBe('23514')
    expect(await tenta({ ficha: true, resposta: 'venceu_nova', n: 2 })).toBeNull()
    expect(await tenta({ ficha: true, resposta: 'venceu_original', n: 1 })).toBeNull()
  })
  it('(d) rodar a migration duas vezes não falha e a definição não tem o ramo antigo', async () => {
    await pg.query(MIGRATION)
    await pg.query(MIGRATION)
    const def = String((await pg.query(`select pg_get_constraintdef(oid) d from pg_constraint where conname = 'ab_native_tests_variante_da_resposta'`)).rows[0].d)
    expect(def).toContain(`venceu_original'::text) AND (variante_vencedora = 1`)
    expect(def).not.toContain('variantes IS NOT NULL) AND (variante_vencedora = 1')
  })
  const CHECK_ANTIGO = `check (variante_vencedora is null or (
    (resposta_dono = 'venceu_nova' and ((variantes is null and variante_vencedora between 1 and 3) or (variantes is not null and variante_vencedora between 2 and 3)))
    or (resposta_dono = 'venceu_original' and variantes is not null and variante_vencedora = 1)))`
  async function defDoCheck(): Promise<string> {
    return String((await pg.query(`select pg_get_constraintdef(oid) d from pg_constraint where conname = 'ab_native_tests_variante_da_resposta'`)).rows[0].d)
  }
  it.each([
    ['o CHECK antigo (ramo com variantes is not null)', CHECK_ANTIGO],
    ['uma terceira forma (correção manual)', `check (variante_vencedora is null or variante_vencedora between 1 and 3)`],
  ])('(f) ensaio da troca: parte de %s, aplica a migration e fica o CHECK novo, validado', async (_nome, check) => {
    await pg.query('begin')
    try {
      await pg.query('alter table public.ab_native_tests drop constraint ab_native_tests_variante_da_resposta')
      await pg.query(`alter table public.ab_native_tests add constraint ab_native_tests_variante_da_resposta ${check} not valid`)
      await pg.query(MIGRATION)
      const def = await defDoCheck()
      expect(def).toContain(`venceu_original'::text) AND (variante_vencedora = 1`)
      expect(def).not.toContain('variantes IS NOT NULL) AND (variante_vencedora = 1')
      expect((await pg.query(`select convalidated from pg_constraint where conname = 'ab_native_tests_variante_da_resposta'`)).rows[0].convalidated).toBe(true)
    } finally { await pg.query('rollback') }
  })
  it('(f2) CHECK ausente: a migration o cria', async () => {
    await pg.query('begin')
    try {
      await pg.query('alter table public.ab_native_tests drop constraint ab_native_tests_variante_da_resposta')
      await pg.query(MIGRATION)
      expect(await defDoCheck()).toContain(`venceu_original'::text) AND (variante_vencedora = 1`)
    } finally { await pg.query('rollback') }
  })
  it('(e) resposta_mudada_em existe, timestamptz, nula por padrão', async () => {
    const c = await pg.query(`select data_type, column_default from information_schema.columns where table_schema = 'public' and table_name = 'ab_native_tests' and column_name = 'resposta_mudada_em'`)
    expect(c.rows[0]).toMatchObject({ data_type: 'timestamp with time zone', column_default: null })
  })
})
