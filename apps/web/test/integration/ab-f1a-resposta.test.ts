// @vitest-environment node
/**
 * F1a-dado T11: resposta do dia 14 contra o banco (CHECKs reais). Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-f1a-resposta --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico } from '../helpers/db-seed'

const ctx = vi.hoisted(() => ({ siteId: '', userId: '' }))
vi.mock('@/lib/youtube/ab-lab-acesso', () => ({ requireEditUser: async () => ({ siteId: ctx.siteId, userId: ctx.userId }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))

import { responderTesteDoYouTube } from '@/app/cms/(authed)/youtube/ab-lab/actions-nativo'

vi.setConfig({ testTimeout: 60_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const IMG = { url: 'https://x.public.blob.vercel-storage.com/a.jpg', sha256: 'a'.repeat(64), largura: 1280, altura: 720 }
const V2 = [{ n: 1, tipo: 'titulo', titulo: 'Original' }, { n: 2, tipo: 'titulo', titulo: 'Nova' }]
const V3 = [...V2, { n: 3, tipo: 'combo', titulo: 'Terceira', imagem: IMG }]
const VMINI = [{ n: 1, tipo: 'miniatura', imagem: IMG }, { n: 2, tipo: 'miniatura', imagem: IMG }]

describe.skipIf(skipIfNoLocalDb())('F1a-dado T11: resposta do dia 14 (banco)', () => {
  let pg: Client
  let siteId: string
  let videoId: string
  let ytId: string
  const usuarios: string[] = []

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    ctx.userId = randomUUID(); usuarios.push(ctx.userId)
    await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [ctx.userId, ctx.userId + '@f1a.test'])
  })
  afterAll(async () => {
    try { await pg.query('delete from auth.users where id = any($1::uuid[])', [usuarios]) } finally { await pg.end() }
  })
  beforeEach(async () => {
    const t = await semearTesteAb({ status: 'active', testType: 'title', cicloAberto: 0 })
    siteId = t.siteId; ctx.siteId = siteId
    videoId = (await clienteServico().from('ab_tests').select('youtube_video_id').eq('id', t.testId).single()).data!.youtube_video_id as string
    ytId = String((await pg.query('select youtube_video_id from public.youtube_videos where id = $1', [videoId])).rows[0].youtube_video_id)
  })

  const base = () => ({ site_id: siteId, video_id: videoId, youtube_video_id: ytId.slice(0, 11).padEnd(11, 'x'), campos: ['titulo'] })
  const confirmada = async (o: Record<string, unknown> = {}): Promise<{ id: string; updated_at: string }> => {
    const r = await clienteServico().from('ab_native_tests').insert({
      ...base(), origem: 'confirmado', estado: 'em_andamento', confirmado_em: new Date().toISOString(), confirmado_por: ctx.userId, variantes: V2, ...o,
    }).select('id, updated_at').single()
    expect(r.error).toBeNull()
    return r.data as { id: string; updated_at: string }
  }
  const linha = async (id: string) => (await clienteServico().from('ab_native_tests').select('*').eq('id', id).single()).data!
  const resp = (l: { id: string; updated_at: string }, resposta: 'venceu_nova' | 'venceu_original' | 'ficou_igual' | 'inconclusivo' | 'nao_vi', n: number | null = null) =>
    responderTesteDoYouTube({ registroId: l.id, lido: l.updated_at, resposta, n })

  it('um caso por botão grava a linha da tabela de §5.3', async () => {
    const a = await confirmada()
    expect(await resp(a, 'venceu_nova', 2)).toEqual({ ok: true, conflito: null })
    expect(await linha(a.id)).toMatchObject({ estado: 'encerrado', desfecho_estado: 'vencedor_provavel', desfecho_motivo: 'resposta_do_dono', resposta_dono: 'venceu_nova', variante_vencedora: 2, vencedor_titulo: 'Nova', vencedor_fonte: 'dono' })
    await pg.query('delete from public.ab_native_tests where id = $1', [a.id])

    const b = await confirmada()
    expect(await resp(b, 'venceu_original')).toEqual({ ok: true, conflito: null })
    expect(await linha(b.id)).toMatchObject({ estado: 'encerrado', desfecho_estado: 'vencedor_provavel', resposta_dono: 'venceu_original', variante_vencedora: 1, vencedor_titulo: 'Original', vencedor_fonte: 'dono' })
    await pg.query('delete from public.ab_native_tests where id = $1', [b.id])

    for (const [r, estado] of [['ficou_igual', 'encerrado'], ['inconclusivo', 'encerrado'], ['nao_vi', 'sem_desfecho']] as const) {
      const c = await confirmada()
      expect(await resp(c, r)).toEqual({ ok: true, conflito: null })
      const l = await linha(c.id)
      expect(l).toMatchObject({ estado, desfecho_estado: 'sem_dado', resposta_dono: r, variante_vencedora: null, vencedor_titulo: null, vencedor_fonte: null })
      expect(l.respondido_em).not.toBeNull()
      expect(l.encerrado_em).not.toBeNull()
      await pg.query('delete from public.ab_native_tests where id = $1', [c.id])
    }
  })

  it('"Venceu a nova" só de miniatura passa no CHECK novo (sem título, com variante)', async () => {
    const a = await confirmada({ variantes: VMINI })
    expect(await resp(a, 'venceu_nova', 2)).toEqual({ ok: true, conflito: null })
    expect(await linha(a.id)).toMatchObject({ variante_vencedora: 2, vencedor_titulo: null, vencedor_fonte: 'dono', estado: 'encerrado' })
  })

  it('3 variantes: n=3 grava e n=4 recusa; n=1 em venceu_nova com ficha recusa', async () => {
    const a = await confirmada({ variantes: V3 })
    expect(await resp(a, 'venceu_nova', 4)).toMatchObject({ ok: false })
    expect(await resp(a, 'venceu_nova', 1)).toEqual({ ok: false, erro: 'variante_invalida' })
    expect((await linha(a.id)).resposta_dono).toBeNull()
    expect(await resp(a, 'venceu_nova', 3)).toEqual({ ok: true, conflito: null })
    expect(await linha(a.id)).toMatchObject({ variante_vencedora: 3, vencedor_titulo: 'Terceira' })
  })

  it('detectado confirmado sem ficha, variantes_titulo [A,B]: n=2 grava o 2º título; n=1 grava o 1º', async () => {
    const mk = () => confirmada({ origem: 'detectado', variantes: null, variantes_titulo: ['A', 'B'], primeira_vista: new Date().toISOString(), versao_regra: 1 })
    const a = await mk()
    expect(await resp(a, 'venceu_nova', 2)).toEqual({ ok: true, conflito: null })
    expect(await linha(a.id)).toMatchObject({ vencedor_titulo: 'B', vencedor_fonte: 'dono', variante_vencedora: 2 })
    await pg.query('delete from public.ab_native_tests where id = $1', [a.id])
    const b = await mk()
    expect(await resp(b, 'venceu_nova', 1)).toEqual({ ok: true, conflito: null })
    expect(await linha(b.id)).toMatchObject({ vencedor_titulo: 'A', vencedor_fonte: 'dono', variante_vencedora: 1 })
    await pg.query('delete from public.ab_native_tests where id = $1', [b.id])
    const c = await mk()
    expect(await resp(c, 'venceu_original')).toEqual({ ok: false, erro: 'variante_invalida' })
  })

  it('sem_desfecho sem fonte (e sem_resposta no dia 17): a resposta vira desfecho; encerrado_em fica; o CHECK não estoura', async () => {
    const ontem = new Date(Date.now() - 86_400_000).toISOString()
    const a = await confirmada({ estado: 'sem_desfecho', desfecho_estado: 'sem_dado', desfecho_motivo: 'oficial_nao_lido', encerrado_em: ontem })
    expect(await resp(a, 'venceu_nova', 2)).toEqual({ ok: true, conflito: null })
    const l = await linha(a.id)
    expect(l).toMatchObject({ estado: 'encerrado', desfecho_estado: 'vencedor_provavel', desfecho_motivo: 'resposta_do_dono', vencedor_fonte: 'dono', vencedor_titulo: 'Nova' })
    expect(new Date(l.encerrado_em).getTime()).toBe(new Date(ontem).getTime())

    const b = await confirmada({ estado: 'sem_desfecho', desfecho_estado: 'sem_dado', desfecho_motivo: 'sem_resposta', resposta_dono: 'sem_resposta', encerrado_em: ontem })
    expect(await resp(b, 'venceu_original')).toEqual({ ok: true, conflito: null })
    expect(await linha(b.id)).toMatchObject({ estado: 'encerrado', resposta_dono: 'venceu_original', vencedor_fonte: 'dono', variante_vencedora: 1 })
    expect((await linha(b.id)).respondido_em).not.toBeNull()
  })

  it('vencedor da data_api no outro lado: guarda as duas e devolve conflito, sem mexer no veredito', async () => {
    const agora = new Date().toISOString()
    const a = await confirmada({ estado: 'encerrado', encerrado_em: agora, desfecho_estado: 'vencedor_provavel', desfecho_motivo: 'data_api', vencedor_titulo: 'Original', vencedor_fonte: 'data_api', vencedor_visto_em: agora })
    const r = await resp(a, 'venceu_nova', 2)
    expect(r).toEqual({ ok: true, conflito: { youtube: 'Original', dono: 'Nova' } })
    expect(await linha(a.id)).toMatchObject({ resposta_dono: 'venceu_nova', variante_vencedora: 2, vencedor_titulo: 'Original', vencedor_fonte: 'data_api', estado: 'encerrado' })
  })

  it('duas respostas seguidas: a 2ª devolve ja_respondido e a linha fica igual à da 1ª', async () => {
    const a = await confirmada()
    expect(await resp(a, 'ficou_igual')).toEqual({ ok: true, conflito: null })
    const antes = await linha(a.id)
    expect(await resp({ id: a.id, updated_at: antes.updated_at }, 'venceu_nova', 2)).toEqual({ ok: false, erro: 'ja_respondido' })
    expect(await linha(a.id)).toEqual(antes)
  })

  it('CAS velho (o registrador mexeu depois da leitura da tela): relê e grava uma vez', async () => {
    const a = await confirmada()
    await pg.query(`update public.ab_native_tests set ultima_vista = now() where id = $1`, [a.id])
    expect(await resp(a, 'venceu_nova', 2)).toEqual({ ok: true, conflito: null })
    expect((await linha(a.id)).resposta_dono).toBe('venceu_nova')
  })

  it('responder derruba o número que o sino lê (mesmo filtro de /api/notifications/count)', async () => {
    const a = await confirmada()
    const ins = await clienteServico().from('notifications').insert({
      site_id: siteId, user_id: ctx.userId, type: 'youtube.native_lembrete', domain: 'youtube', priority: 3, title: 'Como foi o teste?', dedup_key: `lembrete-nativo:${a.id}`,
    })
    expect(ins.error).toBeNull()
    const contador = async () => (await clienteServico().from('notifications').select('id', { count: 'exact', head: true })
      .eq('site_id', siteId).eq('user_id', ctx.userId).is('dismissed_at', null).is('expired_at', null).is('read_at', null)).count
    expect(await contador()).toBe(1)
    expect(await resp(a, 'nao_vi')).toEqual({ ok: true, conflito: null })
    expect(await contador()).toBe(0)
  })

  it('sem permissão e pedido inválido não escrevem', async () => {
    const a = await confirmada()
    expect(await responderTesteDoYouTube({ registroId: 'nao-uuid', lido: a.updated_at, resposta: 'nao_vi', n: null })).toMatchObject({ ok: false, erro: 'pedido_invalido' })
    expect((await linha(a.id)).resposta_dono).toBeNull()
  })

  it('detectada não confirmada e linha de outro site não são respondíveis', async () => {
    const d = await clienteServico().from('ab_native_tests').insert({
      ...base(), origem: 'detectado', estado: 'em_andamento', variantes_titulo: ['A', 'B'], primeira_vista: new Date().toISOString(), versao_regra: 1,
    }).select('id, updated_at').single()
    expect(await resp(d.data as { id: string; updated_at: string }, 'nao_vi')).toEqual({ ok: false, erro: 'nao_respondivel' })
    await pg.query('delete from public.ab_native_tests where video_id = $1', [videoId])
    const a = await confirmada()
    ctx.siteId = randomUUID()
    expect(await resp(a, 'nao_vi')).toEqual({ ok: false, erro: 'nao_encontrado' })
    ctx.siteId = siteId
  })
})
