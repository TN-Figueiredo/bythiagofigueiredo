// @vitest-environment node
/**
 * F1a-dado T8: ficha gravada (abrir, salvar, "Abrir no Studio", "Lembrar no computador"). Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-f1a-ficha --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'

const ctx = vi.hoisted(() => ({ siteId: '', userId: '' }))
vi.mock('@/lib/youtube/ab-lab-acesso', () => ({ requireEditUser: async () => ({ siteId: ctx.siteId, userId: ctx.userId }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
// a prova de edição que a leitura do retrato diário repete (`leituraDoEditor`): a guarda simulada aceita
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'u-teste' } })) }))

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { abrirFicha, salvarFicha, marcarStudioAberto, lembrarNoComputador, lerFichaDoVideo, recomecarFicha } from '@/app/cms/(authed)/youtube/ab-lab/actions-nativo'
import { lembrarNoComputadorCore, recomecarFichaCore } from '@/lib/youtube/teste-youtube/nativo/ficha'
import { jaIniciouCore } from '@/lib/youtube/teste-youtube/nativo/ficha-fluxo'
import { bloqueadoPorTesteNativo } from '@/lib/youtube/teste-youtube/nativo/guarda'

vi.setConfig({ testTimeout: 60_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const SHA = 'b'.repeat(64)
const BLOB = 'https://abc123.public.blob.vercel-storage.com/ab-native-ficha/s/f/v1.jpg'
const dias = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString()

describe.skipIf(skipIfNoLocalDb())('F1a-dado T8: ficha gravada (banco)', () => {
  let pg: Client
  let sb: SupabaseClient
  let outroSite: string
  let canal: string
  const usuarios: string[] = []
  const ytId = (): string => 'y' + randomUUID().replace(/-/g, '').slice(0, 10)

  beforeAll(async () => {
    sb = getSupabaseServiceClient() as unknown as SupabaseClient
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    ctx.siteId = (await seedSite(getSupabaseServiceClient())).siteId
    outroSite = (await seedSite(getSupabaseServiceClient())).siteId
    ctx.userId = randomUUID(); usuarios.push(ctx.userId)
    await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [ctx.userId, ctx.userId + '@f1a.test'])
    const k = randomUUID().replace(/-/g, '')
    canal = String((await pg.query(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [ctx.siteId, 'UC' + k.slice(0, 20), '@f8' + k.slice(0, 8), 'UU' + k.slice(0, 20), 'f1a8-' + k.slice(0, 8)])).rows[0].id)
  })
  afterAll(async () => {
    try {
      await pg.query('drop trigger if exists f1a_teste_falha_lembrar on public.ab_native_fichas')
      await pg.query('drop function if exists public.f1a_teste_falha_lembrar()')
      await pg.query('delete from public.youtube_videos where site_id = $1', [ctx.siteId])
      await pg.query('delete from public.youtube_channels where site_id = $1', [ctx.siteId])
      await pg.query('delete from public.sites where id = any($1::uuid[])', [[ctx.siteId, outroSite]])
      await pg.query('delete from auth.users where id = any($1::uuid[])', [usuarios])
    } finally {
      await pg.end()
    }
  })

  const video = async (): Promise<{ id: string; yt: string }> => {
    const yt = ytId()
    const id = String((await pg.query(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at)
      values ($1, $2, $3, 'T', now()) returning id`, [ctx.siteId, canal, yt])).rows[0].id)
    return { id, yt }
  }
  const linhaDaFicha = async (id: string): Promise<Record<string, unknown>> => (await pg.query('select * from public.ab_native_fichas where id = $1', [id])).rows[0]
  const dados = {
    campos: ['titulo', 'miniatura'] as ('titulo' | 'miniatura')[],
    variantes: [
      { n: 1, tipo: 'combo' as const, titulo: 'Original', imagem: { url: BLOB, sha256: SHA, largura: 1280, altura: 720 } },
      { n: 2, tipo: 'combo' as const, titulo: 'Nova', imagem: { url: BLOB, sha256: SHA, largura: 1280, altura: 720 } },
    ],
  }

  it('abrir 2x devolve a mesma ficha com as mesmas variantes (recarregar mantém)', async () => {
    const v = await video()
    const a = await abrirFicha(v.id)
    expect(a).toMatchObject({ ok: true, ficha: { aberta: true, enviada: false, campos: [], variantes: [] } })
    if (!a.ok) throw new Error('x')
    const s = await salvarFicha(a.ficha.id, a.ficha.atualizada_em, dados)
    expect(s.ok).toBe(true)
    const b = await abrirFicha(v.id)
    if (!b.ok) throw new Error('x')
    expect(b.ficha.id).toBe(a.ficha.id)
    expect(b.ficha.variantes).toEqual(dados.variantes)
    expect(b.ficha.campos).toEqual(dados.campos)
    expect(b.ficha.criada_por).toBe(ctx.userId)
  })

  it('ficha só com o original grava', async () => {
    const v = await video()
    const a = await abrirFicha(v.id); if (!a.ok) throw new Error('x')
    const s = await salvarFicha(a.ficha.id, a.ficha.atualizada_em, { campos: ['titulo'], variantes: [{ n: 1, tipo: 'titulo', titulo: 'Só o original' }] })
    expect(s.ok).toBe(true)
  })

  it('entrada hostil: recusada com motivo, nada gravado', async () => {
    const v = await video()
    const a = await abrirFicha(v.id); if (!a.ok) throw new Error('x')
    const base = a.ficha.atualizada_em
    const casos: Array<[string, unknown]> = [
      ['url fora do Blob', { campos: ['miniatura'], variantes: [{ n: 1, tipo: 'miniatura', imagem: { url: 'https://evil.example.com/a.jpg', sha256: SHA, largura: 1280, altura: 720 } }] }],
      ['sha malformado', { campos: ['miniatura'], variantes: [{ n: 1, tipo: 'miniatura', imagem: { url: BLOB, sha256: 'zz', largura: 1280, altura: 720 } }] }],
      ['título de 101', { campos: ['titulo'], variantes: [{ n: 1, tipo: 'titulo', titulo: 'x'.repeat(101) }] }],
      ['n repetido', { campos: ['titulo'], variantes: [{ n: 1, tipo: 'titulo', titulo: 'a' }, { n: 1, tipo: 'titulo', titulo: 'b' }] }],
      ['n fora de 1..3', { campos: ['titulo'], variantes: [{ n: 4, tipo: 'titulo', titulo: 'a' }] }],
    ]
    for (const [nome, d] of casos) {
      const r = await salvarFicha(a.ficha.id, base, d as never)
      expect(r.ok, nome).toBe(false)
      if (!r.ok) expect(r.error.length, nome).toBeGreaterThan(0)
    }
    const l = await linhaDaFicha(a.ficha.id)
    expect(l.variantes).toEqual([])
    expect(l.campos).toEqual([])
  })

  it('CAS por atualizada_em: o que perde recebe a ficha atual e nada é sobrescrito', async () => {
    const v = await video()
    const a = await abrirFicha(v.id); if (!a.ok) throw new Error('x')
    const velho = a.ficha.atualizada_em
    const ganhou = await salvarFicha(a.ficha.id, velho, dados)
    expect(ganhou.ok).toBe(true)
    const perdeu = await salvarFicha(a.ficha.id, velho, { campos: ['titulo'], variantes: [{ n: 1, tipo: 'titulo', titulo: 'Outro' }] })
    expect(perdeu.ok).toBe(false)
    if (perdeu.ok) throw new Error('x')
    expect(perdeu.fichaAtual?.variantes).toEqual(dados.variantes)
    expect((await linhaDaFicha(a.ficha.id)).variantes).toEqual(dados.variantes)
  })

  it('"Abrir no Studio" grava studio_aberto_em e a ficha passa a "enviada"', async () => {
    const v = await video()
    const a = await abrirFicha(v.id); if (!a.ok) throw new Error('x')
    expect(a.ficha.enviada).toBe(false)
    const m = await marcarStudioAberto(a.ficha.id)
    expect(m).toMatchObject({ ok: true, ficha: { enviada: true } })
    expect((await linhaDaFicha(a.ficha.id)).studio_aberto_em).not.toBeNull()
  })

  it('enviada: Studio aberto há 20 d e "Lembrar" ontem => true; só Studio há 20 d => false', async () => {
    const v = await video()
    const a = await abrirFicha(v.id); if (!a.ok) throw new Error('x')
    await pg.query(`update public.ab_native_fichas set studio_aberto_em = $2 where id = $1`, [a.ficha.id, dias(20)])
    expect((await abrirFicha(v.id) as { ficha: { enviada: boolean } }).ficha.enviada).toBe(false)
    await pg.query(`update public.ab_native_fichas set lembrar_em = $2 where id = $1`, [a.ficha.id, dias(1)])
    expect((await abrirFicha(v.id) as { ficha: { enviada: boolean } }).ficha.enviada).toBe(true)
  })

  it('"Lembrar no computador" 2x: uma notificação, o 2º devolve jaLembrado com a data', async () => {
    const v = await video()
    const a = await abrirFicha(v.id); if (!a.ok) throw new Error('x')
    const r1 = await lembrarNoComputador(a.ficha.id)
    expect(r1).toMatchObject({ ok: true, jaLembrado: false })
    const r2 = await lembrarNoComputador(a.ficha.id)
    expect(r2).toMatchObject({ ok: true, jaLembrado: true })
    if (!r1.ok || !r2.ok) throw new Error('x')
    expect(r2.lembrarEm).toBe(r1.lembrarEm)
    // a ficha nova (com o atualizada_em do trigger) volta nos dois ramos de sucesso
    const linha = await linhaDaFicha(a.ficha.id)
    expect(r1.ficha.lembrar_em).toBe(r1.lembrarEm)
    expect(new Date(r1.ficha.atualizada_em).getTime()).toBe(new Date(linha.atualizada_em).getTime())
    expect(new Date(r2.ficha.atualizada_em).getTime()).toBe(new Date(linha.atualizada_em).getTime())
    const n = await pg.query(`select type, user_id, action_href, payload from public.notifications where dedup_key = $1`, ['ficha-lembrar:' + a.ficha.id])
    expect(n.rowCount).toBe(1)
    expect(n.rows[0]).toMatchObject({ type: 'youtube.native_ficha_lembrar', user_id: ctx.userId, action_href: `/cms/youtube/ab-lab?video=${v.yt}` })
    expect(JSON.stringify(n.rows[0].payload)).not.toContain('Original')
    expect((await linhaDaFicha(a.ficha.id)).lembrar_em).not.toBeNull()
  })

  it('erro do createNotification volta como { ok: false } e lembrar_em não é gravado', async () => {
    const v = await video()
    const a = await abrirFicha(v.id); if (!a.ok) throw new Error('x')
    const r = await lembrarNoComputadorCore({ sb, siteId: ctx.siteId, userId: ctx.userId, fichaId: a.ficha.id, criar: async () => ({ success: false, error: 'sem canal' }) })
    expect(r).toEqual({ ok: false, error: 'sem canal' })
    expect((await linhaDaFicha(a.ficha.id)).lembrar_em).toBeNull()
  })

  it('notificação criada e o update de lembrar_em falhou: o 2º toque grava lembrar_em e responde jaLembrado (Yannis M7)', async () => {
    const v = await video()
    const a = await abrirFicha(v.id); if (!a.ok) throw new Error('x')
    // falha injetada no banco (trigger temporário), independente da forma da consulta
    await pg.query(`create or replace function public.f1a_teste_falha_lembrar() returns trigger language plpgsql as $$ begin raise exception 'queda'; end $$`)
    await pg.query(`create trigger f1a_teste_falha_lembrar before update on public.ab_native_fichas for each row when (new.id = '${a.ficha.id}' and new.lembrar_em is not null) execute function public.f1a_teste_falha_lembrar()`)
    const r1 = await lembrarNoComputadorCore({ sb, siteId: ctx.siteId, userId: ctx.userId, fichaId: a.ficha.id }).finally(() => pg.query('drop trigger if exists f1a_teste_falha_lembrar on public.ab_native_fichas'))
    expect(r1.ok).toBe(false)
    expect((await linhaDaFicha(a.ficha.id)).lembrar_em).toBeNull()
    expect((await pg.query(`select 1 from public.notifications where dedup_key = $1`, ['ficha-lembrar:' + a.ficha.id])).rowCount).toBe(1)
    const r2 = await lembrarNoComputador(a.ficha.id)
    expect(r2).toMatchObject({ ok: true, jaLembrado: true })
    expect((await linhaDaFicha(a.ficha.id)).lembrar_em).not.toBeNull()
    expect((await pg.query(`select 1 from public.notifications where dedup_key = $1`, ['ficha-lembrar:' + a.ficha.id])).rowCount).toBe(1)
  })

  it('id de outro site ou inexistente: "não encontrado", zero linhas alteradas', async () => {
    const v = await video()
    const a = await abrirFicha(v.id); if (!a.ok) throw new Error('x')
    const siteOriginal = ctx.siteId
    ctx.siteId = outroSite
    try {
      expect(await salvarFicha(a.ficha.id, a.ficha.atualizada_em, dados)).toEqual({ ok: false, error: 'não encontrado' })
      expect(await marcarStudioAberto(a.ficha.id)).toEqual({ ok: false, error: 'não encontrado' })
      expect(await lembrarNoComputador(a.ficha.id)).toEqual({ ok: false, error: 'não encontrado' })
      expect(await abrirFicha(v.id)).toEqual({ ok: false, error: 'não encontrado' })
    } finally { ctx.siteId = siteOriginal }
    expect(await marcarStudioAberto(randomUUID())).toEqual({ ok: false, error: 'não encontrado' })
    expect(await abrirFicha(randomUUID())).toEqual({ ok: false, error: 'não encontrado' })
    const l = await linhaDaFicha(a.ficha.id)
    expect(l.studio_aberto_em).toBeNull(); expect(l.lembrar_em).toBeNull(); expect(l.variantes).toEqual([])
    expect((await pg.query(`select 1 from public.notifications where dedup_key = $1`, ['ficha-lembrar:' + a.ficha.id])).rowCount).toBe(0)
  })

  it('T5: lerFichaDoVideo não cria nem descarta; vencida só pela leitura; recomecarFicha descarta a velha, copia as versões e expira o lembrete', async () => {
    const v = await video()
    expect(await lerFichaDoVideo(v.id)).toEqual({ ok: true, ficha: null, vencida: false })
    expect((await pg.query('select 1 from public.ab_native_fichas where video_id = $1', [v.id])).rowCount).toBe(0)
    const a = await abrirFicha(v.id); if (!a.ok) throw new Error('x')
    expect((await salvarFicha(a.ficha.id, a.ficha.atualizada_em, dados)).ok).toBe(true)
    expect((await lembrarNoComputador(a.ficha.id)).ok).toBe(true)
    await pg.query('alter table public.ab_native_fichas disable trigger user')
    await pg.query(`update public.ab_native_fichas set criada_em = $2, atualizada_em = $2, lembrar_em = $2 where id = $1`, [a.ficha.id, dias(15)])
    await pg.query('alter table public.ab_native_fichas enable trigger user')
    const lida = await lerFichaDoVideo(v.id)
    expect(lida).toMatchObject({ ok: true, vencida: true, ficha: { id: a.ficha.id } })
    expect((await linhaDaFicha(a.ficha.id)).descartada_em).toBeNull()
    const r = await recomecarFicha(a.ficha.id)
    if (!r.ok) throw new Error(r.error)
    expect(r.ficha.id).not.toBe(a.ficha.id)
    expect(r.ficha.variantes).toEqual(dados.variantes)
    expect(r.ficha.campos).toEqual(dados.campos)
    expect((await linhaDaFicha(a.ficha.id)).descartada_em).not.toBeNull()
    const n = await pg.query(`select expired_at from public.notifications where dedup_key = $1`, ['ficha-lembrar:' + a.ficha.id])
    expect(n.rows[0].expired_at).not.toBeNull()
  })

  it('T5 conserto: recomeçar é idempotente (salvar falha na 1ª, a 2ª conclui) e a nova herda o studio_aberto_em sem reabrir o ytimg', async () => {
    const v = await video()
    const a = await abrirFicha(v.id); if (!a.ok) throw new Error('x')
    expect((await salvarFicha(a.ficha.id, a.ficha.atualizada_em, dados)).ok).toBe(true)
    const studio = dias(16)
    await pg.query('alter table public.ab_native_fichas disable trigger user')
    await pg.query(`update public.ab_native_fichas set criada_em = $2, atualizada_em = $2, studio_aberto_em = $3 where id = $1`, [a.ficha.id, dias(20), studio])
    await pg.query('alter table public.ab_native_fichas enable trigger user')
    const base = { sb, siteId: ctx.siteId, userId: ctx.userId, fichaVencidaId: a.ficha.id }
    const cai = vi.fn(async () => ({ ok: false as const, error: 'falha injetada' }))
    const r1 = await recomecarFichaCore({ ...base, salvar: cai })
    expect(r1.ok).toBe(false)
    expect((await linhaDaFicha(a.ficha.id)).descartada_em).not.toBeNull() // a velha já foi descartada: o trabalho tem de ser repetível
    const r2 = await recomecarFichaCore(base)
    if (!r2.ok) throw new Error(r2.error)
    expect(r2.ficha.id).not.toBe(a.ficha.id)
    expect(r2.ficha.variantes).toEqual(dados.variantes)
    expect(r2.ficha.campos).toEqual(dados.campos)
    expect(new Date(r2.ficha.studio_aberto_em as string).getTime()).toBe(new Date(studio).getTime())
    expect((await pg.query('select count(*)::int as n from public.ab_native_fichas where video_id = $1 and descartada_em is null', [v.id])).rows[0].n).toBe(1)
    const r3 = await recomecarFichaCore(base) // repetir de novo não duplica nem apaga
    if (!r3.ok) throw new Error(r3.error)
    expect(r3.ficha.id).toBe(r2.ficha.id); expect(r3.ficha.variantes).toEqual(dados.variantes)
    // Studio já aberto: "Já iniciei" na nova nunca consulta i.ytimg.com
    await pg.query(`update public.ab_native_fichas set variantes = '[]'::jsonb where id = $1`, [r2.ficha.id])
    const pedidos: string[] = []
    const buscar = (async (u: string | URL | Request) => { pedidos.push(String(u)); return new Response('', { status: 404 }) }) as typeof fetch
    await jaIniciouCore({ sb, siteId: ctx.siteId, userId: ctx.userId, fichaId: r2.ficha.id, buscar, confirmar: async () => ({ ok: true, registroId: 'R', pausados: [], naoPausados: [] }) })
    expect(pedidos.filter((u) => u.includes('ytimg.com'))).toEqual([])
  })

  it('T5: recomecarFicha com id de outro site e id inexistente: não encontrado', async () => {
    const v = await video()
    const a = await abrirFicha(v.id); if (!a.ok) throw new Error('x')
    const original = ctx.siteId
    ctx.siteId = outroSite
    try { expect(await recomecarFicha(a.ficha.id)).toEqual({ ok: false, error: 'não encontrado' }) } finally { ctx.siteId = original }
    expect(await recomecarFicha(randomUUID())).toEqual({ ok: false, error: 'não encontrado' })
  })

  it('a ficha nunca aparece para a guarda nem para o registrador', async () => {
    const v = await video()
    const a = await abrirFicha(v.id); if (!a.ok) throw new Error('x')
    await salvarFicha(a.ficha.id, a.ficha.atualizada_em, dados)
    const b = await bloqueadoPorTesteNativo(sb, ctx.siteId, [v.id])
    expect(b).toMatchObject({ ok: true })
    if (b.ok) expect(b.linhas.size).toBe(0)
    for (const f of ['guarda.ts', 'aplicar-guarda.ts']) expect(readFileSync(`src/lib/youtube/teste-youtube/nativo/${f}`, 'utf8')).not.toContain('ab_native_fichas')
    for (const f of ['ler.ts', 'tarefa.ts', 'registrar.ts']) expect(readFileSync(`src/lib/youtube/teste-youtube/registro/${f}`, 'utf8')).not.toContain('ab_native_fichas')
  })
})
