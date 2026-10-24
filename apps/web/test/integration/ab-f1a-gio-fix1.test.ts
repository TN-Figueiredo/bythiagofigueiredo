// @vitest-environment node
/**
 * Conserto 1 do Gio (F1a-tela-1): F-4 (ab_tests.youtube_video_id é o UUID de youtube_videos.id) e F-3 (ficha nova com campos vazios). Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-f1a-gio-fix1 --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import type { SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'u-teste' } })) }))

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { abrirFichaCore, lembrarNoComputadorCore, resolverTituloOriginal, salvarFichaCore } from '@/lib/youtube/teste-youtube/nativo/ficha'
import { mesclar } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/use-ficha-gravada'
import { copiarOriginalParaFichaCore } from '@/lib/youtube/teste-youtube/nativo/imagem-ficha'
import { apagarSites } from '../helpers/limpa-cena'

vi.setConfig({ testTimeout: 60_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const BLOB = 'https://abc123.public.blob.vercel-storage.com/ab/orig.jpg'

describe.skipIf(skipIfNoLocalDb())('Gio fix1: F-3 e F-4 (banco)', () => {
  let pg: Client
  let sb: SupabaseClient
  let siteId: string
  let canal: string
  const userId = randomUUID()

  beforeAll(async () => {
    sb = getSupabaseServiceClient() as unknown as SupabaseClient
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    siteId = (await seedSite(getSupabaseServiceClient())).siteId
    await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [userId, userId + '@f1a.test'])
    const k = randomUUID().replace(/-/g, '')
    canal = String((await pg.query(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [siteId, 'UC' + k.slice(0, 20), '@g1' + k.slice(0, 8), 'UU' + k.slice(0, 20), 'g1-' + k.slice(0, 8)])).rows[0].id)
  })
  afterAll(async () => {
    try {
      await pg.query('delete from public.ab_native_fichas where site_id = $1', [siteId])
      await pg.query('delete from public.ab_tests where site_id = $1', [siteId])
      await pg.query('delete from public.youtube_videos where site_id = $1', [siteId])
      await pg.query('delete from public.youtube_channels where site_id = $1', [siteId])
      await apagarSites(pg, 'id = $1', [siteId])
      await pg.query('delete from auth.users where id = $1', [userId])
    } finally { await pg.end() }
  })

  const video = async (): Promise<string> => String((await pg.query(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at)
    values ($1, $2, $3, 'Título do vídeo', now()) returning id`, [siteId, canal, 'y' + randomUUID().replace(/-/g, '').slice(0, 10)])).rows[0].id)
  const testeNosso = async (videoId: string): Promise<void> => {
    const t = String((await pg.query(`insert into public.ab_tests (site_id, youtube_video_id, name, status, original_thumbnail_url, started_at)
      values ($1, $2, 'T', 'active', $3, now()) returning id`, [siteId, videoId, BLOB])).rows[0].id)
    await pg.query(`insert into public.ab_test_variants (test_id, label, is_original, blob_url, title_text) values ($1, 'A', true, $2, 'Título gravado no teste')`, [t, BLOB])
  }

  it('F-4: resolverTituloOriginal consulta ab_tests pelo UUID do vídeo (não pelo ID de texto) e acha a original do teste nosso', async () => {
    const v = await video()
    await testeNosso(v)
    await expect(resolverTituloOriginal(sb, siteId, v)).resolves.toBe('Título gravado no teste')
  })

  it('F-4: salvar a ficha de um vídeo sem título A guardado resolve no servidor e grava (antes: invalid input syntax for type uuid)', async () => {
    const v = await video()
    const a = await abrirFichaCore({ sb, siteId, userId, videoId: v }); if (!a.ok) throw new Error('x')
    const r = await salvarFichaCore({ sb, siteId, fichaId: a.ficha.id, lido: a.ficha.atualizada_em, dados: { campos: ['titulo'], variantes: [{ n: 2, tipo: 'titulo', titulo: 'B nova' }] } })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.ficha.variantes.find((x) => x.n === 1)?.titulo).toBe('Título do vídeo')
  })

  it('F-4: a cópia da A (marcarStudioAberto) lê a variante original do teste nosso pelo UUID do vídeo', async () => {
    const v = await video()
    await testeNosso(v)
    const a = await abrirFichaCore({ sb, siteId, userId, videoId: v }); if (!a.ok) throw new Error('x')
    const jpeg = await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#336' } }).jpeg().toBuffer()
    const buscar = (async () => new Response(jpeg, { status: 200, headers: { 'content-type': 'image/jpeg' } })) as unknown as typeof fetch
    const put = (async (caminho: string) => ({ url: 'https://abc123.public.blob.vercel-storage.com/' + caminho })) as never
    const r = await copiarOriginalParaFichaCore({ sb, siteId, fichaId: a.ficha.id, permitirYtimg: false, buscar, put })
    expect(r).toMatchObject({ ok: true, imagem: { origem: 'teste_nosso' } })
  })

  it('F-3: ficha nova nasce com campos vazios no banco, mas o rascunho da tela já traz ["titulo"] e a 1ª gravação o persiste', async () => {
    const v = await video()
    const a = await abrirFichaCore({ sb, siteId, userId, videoId: v }); if (!a.ok) throw new Error('x')
    expect(a.ficha.campos).toEqual([])
    const r = mesclar(a.ficha, {})
    expect(r.campos).toEqual(['titulo'])
    const s = await salvarFichaCore({ sb, siteId, fichaId: a.ficha.id, lido: a.ficha.atualizada_em, dados: { campos: r.campos, variantes: [{ n: 2, tipo: 'titulo', titulo: 'B' }] } })
    expect(s.ok).toBe(true)
    expect(String((await pg.query('select campos from public.ab_native_fichas where id = $1', [a.ficha.id])).rows[0].campos)).toBe('titulo')
  })

  it('F-6: o aviso do lembrete leva o texto do botão em português (suggested_action) e o link da ficha', async () => {
    const v = await video()
    const a = await abrirFichaCore({ sb, siteId, userId, videoId: v }); if (!a.ok) throw new Error('x')
    const criar = vi.fn(async () => ({ success: true as const }))
    const r = await lembrarNoComputadorCore({ sb, siteId, userId, fichaId: a.ficha.id, criar: criar as never })
    expect(r.ok).toBe(true)
    const arg = (criar.mock.calls[0] as unknown as [{ suggested_action?: string; action_href?: string }])[0]
    expect(arg.suggested_action).toBe('Abrir a ficha')
    expect(arg.action_href).toMatch(/^\/cms\/youtube\/ab-lab\?video=y/)
  })
})
