// @vitest-environment node
/**
 * F1a-dado T9: "Já iniciei" e "Confirmar" contra o banco, com o settleOnAir REAL e a Data API/token proibidos. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-f1a-confirmar --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico } from '../helpers/db-seed'

const ctx = vi.hoisted(() => ({ siteId: '', userId: '' }))
const proibido = vi.hoisted(() => ({ chamadas: [] as string[] }))
vi.mock('@/lib/youtube/ab-lab-acesso', () => ({ requireEditUser: async () => ({ siteId: ctx.siteId, userId: ctx.userId }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
// Nenhuma porta do YouTube pode ser tocada: o motivo teste_youtube pausa sem token, sem leitura e sem escrita.
vi.mock('@/lib/youtube/ab-preflight', () => ({ preflightTokenCheck: () => { proibido.chamadas.push('preflight'); throw new Error('proibido: preflight') } }))
vi.mock('@/lib/social/token-refresh', async (orig) => ({ ...(await orig<object>()), ensureFreshToken: () => { proibido.chamadas.push('token'); throw new Error('proibido: token') } }))
vi.mock('@/lib/youtube/ab-metadata', async (orig) => ({
  ...(await orig<object>()),
  captureOriginalMetadata: () => { proibido.chamadas.push('metadata'); throw new Error('proibido') },
  updateVideoMetadata: () => { proibido.chamadas.push('update'); throw new Error('proibido: escrita no YouTube') },
  lerSnippet: () => { proibido.chamadas.push('snippet'); throw new Error('proibido') },
}))
vi.mock('@/lib/youtube/ab-youtube', async (orig) => ({ ...(await orig<object>()), setThumbnail: () => { proibido.chamadas.push('thumb'); throw new Error('proibido: escrita no YouTube') } }))

import { confirmarTesteNoStudio } from '@/lib/youtube/teste-youtube/nativo/confirmar'
import { jaIniciei, confirmarDetectado } from '@/app/cms/(authed)/youtube/ab-lab/actions-nativo'
import { NOTA_TESTE_YOUTUBE } from '@/lib/youtube/ab-settle'

vi.setConfig({ testTimeout: 60_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FICHA2 = JSON.stringify([{ n: 1, tipo: 'titulo', titulo: 'Original' }, { n: 2, tipo: 'titulo', titulo: 'Nova' }])

describe.skipIf(skipIfNoLocalDb())('F1a-dado T9: "Já iniciei" e "Confirmar" (banco)', () => {
  let pg: Client
  let t: { testId: string; siteId: string }
  let videoId: string
  let ytId: string
  const usuarios: string[] = []
  const realFetch = globalThis.fetch
  const fetchSpy = vi.fn()

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    ctx.userId = randomUUID(); usuarios.push(ctx.userId)
    await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [ctx.userId, ctx.userId + '@f1a.test'])
    // só o que sai para o YouTube/Google é proibido; o PostgREST local passa
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
      if (/googleapis\.com|youtube\.com|ytimg\.com/.test(url)) { fetchSpy(url); throw new Error('proibido: ' + url) }
      return realFetch(input, init)
    })
  })
  afterAll(async () => {
    vi.unstubAllGlobals()
    try { await pg.query('delete from auth.users where id = any($1::uuid[])', [usuarios]) } finally { await pg.end() }
  })
  beforeEach(async () => {
    proibido.chamadas.length = 0; fetchSpy.mockReset()
    t = await semearTesteAb({ status: 'active', testType: 'title', cicloAberto: 0 })
    ctx.siteId = t.siteId
    const x = (await clienteServico().from('ab_tests').select('youtube_video_id').eq('id', t.testId).single()).data!.youtube_video_id as string
    videoId = x
    ytId = String((await pg.query('select youtube_video_id from public.youtube_videos where id = $1', [videoId])).rows[0].youtube_video_id)
  })

  const ficha = async (variantes = FICHA2): Promise<string> =>
    String((await pg.query(`insert into public.ab_native_fichas (site_id, video_id, campos, variantes) values ($1, $2, '{titulo}', $3::jsonb) returning id`, [t.siteId, videoId, variantes])).rows[0].id)
  const detectada = async (): Promise<{ id: string; updated_at: string }> => {
    const r = await clienteServico().from('ab_native_tests').insert({
      site_id: t.siteId, video_id: videoId, youtube_video_id: ytId.slice(0, 11).padEnd(11, 'x'), origem: 'detectado', campos: ['titulo'], estado: 'em_andamento',
      variantes_titulo: ['a', 'b'], primeira_vista: new Date(Date.now() - 3_600_000).toISOString(), versao_regra: 1,
    }).select('id, updated_at').single()
    expect(r.error).toBeNull()
    return r.data as { id: string; updated_at: string }
  }
  const nosso = async () => (await clienteServico().from('ab_tests').select('status, status_note, restore_status').eq('id', t.testId).single()).data!
  const semEscritaNoYoutube = (): void => { expect(proibido.chamadas).toEqual([]); expect(fetchSpy.mock.calls.filter((c) => !String(c[0]).startsWith('https://i.ytimg.com/vi/'))).toEqual([]) } // a cópia da A (leitura, i.ytimg.com) roda agora que a consulta de ab_tests acerta (Gio F-4)

  it('"Já iniciei" com teste nosso ativo: registro confirmado, nosso paused/pulado_teste_youtube, zero escrita no YouTube', async () => {
    const f = await ficha()
    const r = await jaIniciei(f)
    expect(r).toMatchObject({ ok: true, pausados: [t.testId], naoPausados: [] })
    const n = await nosso()
    expect(n).toMatchObject({ status: 'paused', status_note: NOTA_TESTE_YOUTUBE })
    expect(n.restore_status).toMatchObject({ title: { estado: 'pulado_teste_youtube', escreveu: false } })
    if (!r.ok) throw new Error('x')
    const reg = (await clienteServico().from('ab_native_tests').select('origem, estado, confirmado_em, confirmado_por').eq('id', r.registroId).single()).data!
    expect(reg).toMatchObject({ origem: 'confirmado', estado: 'em_andamento', confirmado_por: ctx.userId })
    expect(reg.confirmado_em).not.toBeNull()
    semEscritaNoYoutube()
  })

  it('"Já iniciei" com detectado aberto confirma a existente; sem linha cria confirmado e vincula a ficha', async () => {
    const d = await detectada()
    const f = await ficha()
    const r = await jaIniciei(f)
    expect(r).toMatchObject({ ok: true, registroId: d.id })
    expect((await pg.query(`select count(*) n from public.ab_native_tests where video_id = $1`, [videoId])).rows[0].n).toBe('1')
    await pg.query('delete from public.ab_native_tests where video_id = $1', [videoId])
    await pg.query('delete from public.ab_native_fichas where video_id = $1', [videoId])
    const f2 = await ficha()
    const r2 = await jaIniciei(f2)
    expect(r2.ok).toBe(true)
    if (!r2.ok) throw new Error('x')
    expect((await pg.query('select registro_id from public.ab_native_fichas where id = $1', [f2])).rows[0].registro_id).toBe(r2.registroId)
  })

  it('"Confirmar" do cartão: confirma a detectada e pausa o nosso sem escrever', async () => {
    const d = await detectada()
    const r = await confirmarDetectado(d.id, d.updated_at)
    expect(r).toMatchObject({ ok: true, registroId: d.id, pausados: [t.testId] })
    expect((await nosso()).status).toBe('paused')
    const reg = (await clienteServico().from('ab_native_tests').select('confirmado_em, confirmado_por, origem').eq('id', d.id).single()).data!
    expect(reg).toMatchObject({ origem: 'detectado', confirmado_por: ctx.userId })
    expect(reg.confirmado_em).not.toBeNull()
    semEscritaNoYoutube()
  })

  it('CAS perdido por atualização de evidência: sucesso na releitura', async () => {
    const d = await detectada()
    await pg.query(`update public.ab_native_tests set ultima_vista = now() where id = $1`, [d.id]) // o registrador acrescenta evidência
    const r = await confirmarDetectado(d.id, d.updated_at)
    expect(r).toMatchObject({ ok: true, registroId: d.id })
  })

  it('CAS perdido porque o registrador encerrou: estado_mudou, nada pausado', async () => {
    const d = await detectada()
    await pg.query(`update public.ab_native_tests set estado = 'encerrado', encerrado_em = now() where id = $1`, [d.id])
    expect(await confirmarDetectado(d.id, d.updated_at)).toEqual({ ok: false, erro: 'estado_mudou', registroId: d.id })
    expect((await nosso()).status).toBe('active')
  })

  it('já confirmada: ja_confirmado; outro site: nao_encontrada; sem permissão (outro uuid): nao_encontrada', async () => {
    const d = await detectada()
    expect(await confirmarDetectado(d.id, d.updated_at)).toMatchObject({ ok: true })
    expect(await confirmarDetectado(d.id, d.updated_at)).toEqual({ ok: false, erro: 'ja_confirmado', registroId: d.id })
    // 2º toque com o `updated_at` ATUAL (outra aba recarregada): só o predicado `confirmado_em is null` recusa, o CAS passaria (Phil m1, Yannis C2).
    const depois1 = (await clienteServico().from('ab_native_tests').select('confirmado_em, confirmado_por, updated_at').eq('id', d.id).single()).data!
    expect(await confirmarDetectado(d.id, depois1.updated_at as string)).toEqual({ ok: false, erro: 'ja_confirmado', registroId: d.id })
    const depois2 = (await clienteServico().from('ab_native_tests').select('confirmado_em, confirmado_por').eq('id', d.id).single()).data!
    expect(depois2).toEqual({ confirmado_em: depois1.confirmado_em, confirmado_por: depois1.confirmado_por })
    const d2 = await clienteServico().from('ab_native_tests').insert({ site_id: t.siteId, video_id: videoId, youtube_video_id: 'abcdefghijk', origem: 'detectado', campos: ['titulo'], estado: 'encerrado', encerrado_em: new Date().toISOString(), variantes_titulo: ['a', 'b'], primeira_vista: new Date(Date.now() - 3_600_000).toISOString(), versao_regra: 1 }).select('id, updated_at').single()
    const siteOriginal = ctx.siteId
    ctx.siteId = randomUUID()
    try { expect(await confirmarDetectado(d2.data!.id as string, d2.data!.updated_at as string)).toEqual({ ok: false, erro: 'nao_encontrada' }) } finally { ctx.siteId = siteOriginal }
    expect(await jaIniciei(await ficha())).toMatchObject({ ok: true })
    expect(await jaIniciei(randomUUID())).toEqual({ ok: false, erro: 'nao_encontrada' })
  })

  it('marcador é aceito mesmo quando o settleOnAir devolve em_andamento: o nosso fica em naoPausados e a rotação o pausa depois', async () => {
    const d = await detectada()
    const r = await confirmarTesteNoStudio({ sb: clienteServico(), siteId: t.siteId, userId: ctx.userId, origem: { registroId: d.id, lido: d.updated_at }, settle: async () => ({ resultado: 'em_andamento', campos: null }) })
    expect(r).toMatchObject({ ok: true, pausados: [], naoPausados: [t.testId], aviso: expect.any(String) })
    expect((await clienteServico().from('ab_native_tests').select('confirmado_em').eq('id', d.id).single()).data!.confirmado_em).not.toBeNull()
    expect((await nosso()).status).toBe('active')
  })

  it('falha do settleOnAir não desfaz a confirmação e volta como aviso', async () => {
    const d = await detectada()
    const r = await confirmarTesteNoStudio({ sb: clienteServico(), siteId: t.siteId, userId: ctx.userId, origem: { registroId: d.id, lido: d.updated_at }, settle: async () => { throw new Error('queda') } })
    expect(r).toMatchObject({ ok: true, aviso: expect.any(String) })
    expect((await clienteServico().from('ab_native_tests').select('confirmado_em').eq('id', d.id).single()).data!.confirmado_em).not.toBeNull()
  })
})
