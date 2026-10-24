// @vitest-environment node
/**
 * F1a-tela-1 T4: a regra "vencida" da tela (`vistaDaFicha`) é a MESMA do SQL `ab_native_ficha_abrir` (descarte por inatividade > 14 d).
 * Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-f1a-ficha-tela --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { abrirFichaCore, derivarFicha, type FichaLinha } from '@/lib/youtube/teste-youtube/nativo/ficha'
import { vistaDaFicha } from '@/lib/youtube/teste-youtube/nativo/ficha-tela'
import { apagarSites } from '../helpers/limpa-cena'

vi.setConfig({ testTimeout: 60_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const MIN = 60_000
const D = 86_400_000

describe.skipIf(skipIfNoLocalDb())('F1a-tela-1 T4: vencida na tela = descartada no SQL', () => {
  let pg: Client
  let sb: SupabaseClient
  let siteId = ''
  let canal = ''
  let userId = ''
  const ytId = (): string => 'y' + randomUUID().replace(/-/g, '').slice(0, 10)

  beforeAll(async () => {
    sb = getSupabaseServiceClient() as unknown as SupabaseClient
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    siteId = (await seedSite(getSupabaseServiceClient())).siteId
    userId = randomUUID()
    await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [userId, userId + '@f1a.test'])
    const k = randomUUID().replace(/-/g, '')
    canal = String((await pg.query(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [siteId, 'UC' + k.slice(0, 20), '@t4' + k.slice(0, 8), 'UU' + k.slice(0, 20), 'f1at4-' + k.slice(0, 8)])).rows[0].id)
  })
  afterAll(async () => {
    try {
      await pg.query('delete from public.youtube_videos where site_id = $1', [siteId])
      await pg.query('delete from public.youtube_channels where site_id = $1', [siteId])
      await apagarSites(pg, 'id = $1', [siteId])
      await pg.query('delete from auth.users where id = $1', [userId])
    } finally {
      await pg.end()
    }
  })

  async function caso(inatividadeMs: number): Promise<{ vencida: boolean; descartada: boolean; idade: string }> {
    const videoId = String((await pg.query(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at)
      values ($1, $2, $3, 'T', now()) returning id`, [siteId, canal, ytId()])).rows[0].id)
    const a = await abrirFichaCore({ sb, siteId, userId, videoId })
    if (!a.ok) throw new Error('abrir falhou')
    // Envelhece a ficha: `session_replication_role = replica` desliga o gatilho que carimba `atualizada_em`.
    await pg.query(`set session_replication_role = replica`)
    await pg.query(`update public.ab_native_fichas set criada_em = now() - ($2::bigint * interval '1 millisecond'), atualizada_em = now() - ($2::bigint * interval '1 millisecond') where id = $1`, [a.ficha.id, inatividadeMs])
    await pg.query(`set session_replication_role = origin`)
    const { rows } = await pg.query(`select f.*, now() as agora_db from public.ab_native_fichas f where id = $1`, [a.ficha.id])
    const agora = rows[0].agora_db as Date
    const iso = (x: unknown): string | null => (x === null ? null : (x as Date).toISOString())
    const linha: FichaLinha = {
      ...rows[0], criada_em: iso(rows[0].criada_em)!, atualizada_em: iso(rows[0].atualizada_em)!,
      studio_aberto_em: iso(rows[0].studio_aberto_em), lembrar_em: iso(rows[0].lembrar_em), descartada_em: iso(rows[0].descartada_em),
    }
    const v = vistaDaFicha({
      ficha: derivarFicha(linha, agora), agora, largura: 'larga', nosso: null, registroDetectado: null,
      studioAbertoNestaSessao: false, criadaEmOutroAparelho: false, confirmacao: 'fechada',
    })
    const b = await abrirFichaCore({ sb, siteId, userId, videoId })
    if (!b.ok) throw new Error('reabrir falhou')
    return { vencida: v.idade === 'vencida', descartada: b.ficha.id !== a.ficha.id, idade: v.idade }
  }

  it.each([
    ['13 d', 13 * D, 'parada'],
    ['14 d − 1 min', 14 * D - MIN, 'parada'],
    ['14 d + 1 min', 14 * D + MIN, 'vencida'],
    ['20 d', 20 * D, 'vencida'],
  ])('inatividade de %s: a tela e o SQL concordam', async (_n, ms, idade) => {
    const r = await caso(ms)
    expect(r.idade).toBe(idade)
    expect(r.descartada).toBe(r.vencida)
  })
})
