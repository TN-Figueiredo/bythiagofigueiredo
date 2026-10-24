// @vitest-environment node
/**
 * F1a-dado T2: `ab_native_ficha_abrir` e `ab_native_iniciar`. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-f1a-funcoes --no-file-parallelism
 * O relógio não se controla por `set local`: datas semeadas no passado. Função sem EXECUTE nunca é chamada como authenticated (SIGSEGV).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { apagarSites } from '../helpers/limpa-cena'

vi.setConfig({ testTimeout: 60_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FICHA2 = JSON.stringify([{ n: 1, tipo: 'titulo', titulo: 'Original' }, { n: 2, tipo: 'titulo', titulo: 'Nova' }])
const FICHA1 = JSON.stringify([{ n: 1, tipo: 'titulo', titulo: 'Original' }])
const dias = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString()

describe.skipIf(skipIfNoLocalDb())('F1a-dado T2: funções da ficha e do "Já iniciei"', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let siteId: string
  let outroSite: string
  let canal: string
  let usuario: string
  const ytId = (): string => 'y' + randomUUID().replace(/-/g, '').slice(0, 10)
  const extras: Client[] = []

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    siteId = (await seedSite(sb)).siteId
    outroSite = (await seedSite(sb)).siteId
    usuario = randomUUID()
    await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [usuario, usuario + '@f1a.test'])
    const k = randomUUID().replace(/-/g, '')
    canal = String((await pg.query(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [siteId, 'UC' + k.slice(0, 20), '@f2' + k.slice(0, 8), 'UU' + k.slice(0, 20), 'f1a2-' + k.slice(0, 8)])).rows[0].id)
  })
  afterAll(async () => {
    try {
      await pg.query('drop trigger if exists f1a_teste_falha on public.ab_native_fichas')
      await pg.query('drop function if exists public.f1a_teste_falha()')
      for (const c of extras) await c.end().catch(() => undefined)
      await pg.query('delete from public.youtube_videos where site_id = $1', [siteId])
      await pg.query('delete from public.youtube_channels where site_id = $1', [siteId])
      await apagarSites(pg, 'id = any($1::uuid[])', [[siteId, outroSite]])
      await pg.query('delete from auth.users where id = $1', [usuario])
    } finally {
      await pg.end()
    }
  })

  const video = async (): Promise<{ id: string; yt: string }> => {
    const yt = ytId()
    const id = String((await pg.query(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at)
      values ($1, $2, $3, 'T', now()) returning id`, [siteId, canal, yt])).rows[0].id)
    return { id, yt }
  }
  const conexao = async (): Promise<Client> => { const c = new Client({ connectionString: PG_URL }); await c.connect(); extras.push(c); return c }
  const abrir = async (v: string, c: Client = pg, site: string = siteId): Promise<Record<string, unknown>> =>
    (await c.query(`select * from public.ab_native_ficha_abrir($1, $2, $3)`, [site, v, usuario])).rows[0]
  const iniciar = async (ficha: string, c: Client = pg, site: string = siteId): Promise<Record<string, unknown>> =>
    (await c.query(`select public.ab_native_iniciar($1, $2, $3) as r`, [site, ficha, usuario])).rows[0].r
  const semearFicha = async (v: string, o: { variantes?: string; campos?: string; criadaHa?: number; studioHa?: number | null; atualizadaHa?: number } = {}): Promise<string> =>
    String((await pg.query(`insert into public.ab_native_fichas (site_id, video_id, campos, variantes, criada_em, atualizada_em, studio_aberto_em)
      values ($1, $2, $3::text[], $4::jsonb, $5, $6, $7) returning id`,
    [siteId, v, o.campos ?? '{titulo}', o.variantes ?? FICHA2, dias(o.criadaHa ?? 0), dias(o.atualizadaHa ?? o.criadaHa ?? 0), o.studioHa == null ? null : dias(o.studioHa)])).rows[0].id)
  const semearDetectada = async (v: string, yt: string, campos = '{miniatura}'): Promise<string> =>
    String((await pg.query(`insert into public.ab_native_tests (site_id, video_id, youtube_video_id, origem, campos, estado, variantes_titulo, primeira_vista, versao_regra)
      values ($1, $2, $3, 'detectado', $4::text[], 'em_andamento', '["a","b"]', now() - interval '1 day', 1) returning id`, [siteId, v, yt, campos])).rows[0].id)
  const contar = async (sql: string, p: unknown[]): Promise<number> => Number((await pg.query(sql, p)).rows[0].n)

  it('duas chamadas concorrentes de ficha_abrir: uma linha aberta', async () => {
    const v = await video()
    const c1 = await conexao(); const c2 = await conexao()
    const [a, b] = await Promise.all([abrir(v.id, c1), abrir(v.id, c2)])
    expect(a.id).toBe(b.id)
    expect(await contar(`select count(*) n from public.ab_native_fichas where video_id = $1 and registro_id is null and descartada_em is null`, [v.id])).toBe(1)
  })

  it('ficha criada há 15 d com Studio aberto há 3 d continua aberta', async () => {
    const v = await video()
    const id = await semearFicha(v.id, { criadaHa: 15, studioHa: 3 })
    const r = await abrir(v.id)
    expect(r.id).toBe(id)
    expect(r.descartada_em).toBeNull()
  })

  it('ficha inativa há 15 d é descartada, nova aberta e a notificação ficha-lembrar expira', async () => {
    const v = await video()
    const velha = await semearFicha(v.id, { criadaHa: 15 })
    await pg.query(`insert into public.notifications (site_id, user_id, type, domain, priority, title, dedup_key)
      values ($1, $2, 'youtube.native_ficha_lembrar', 'youtube', 3, 'Lembrete', $3)`, [siteId, usuario, 'ficha-lembrar:' + velha])
    const nova = await abrir(v.id)
    expect(nova.id).not.toBe(velha)
    expect(nova.descartada_em).toBeNull()
    expect(nova.criada_por).toBe(usuario)
    const d = await pg.query(`select descartada_em from public.ab_native_fichas where id = $1`, [velha])
    expect(d.rows[0].descartada_em).not.toBeNull()
    const n = await pg.query(`select expired_at from public.notifications where dedup_key = $1`, ['ficha-lembrar:' + velha])
    expect(n.rows[0].expired_at).not.toBeNull()
  })

  it('ficha_abrir: vídeo de outro site ou inexistente é recusado (23503), nada gravado', async () => {
    const v = await video()
    const e = async (site: string, vid: string): Promise<string | null> => {
      try { await abrir(vid, pg, site); return null } catch (x) { return (x as { code?: string }).code ?? 'sem_codigo' }
    }
    expect(await e(outroSite, v.id)).toBe('23503')
    expect(await e(siteId, randomUUID())).toBe('23503')
    expect(await contar(`select count(*) n from public.ab_native_fichas where video_id = $1`, [v.id])).toBe(0)
  })

  it('iniciar duas vezes: um registro; a 2ª devolve ja_iniciada', async () => {
    const v = await video()
    const f = await semearFicha(v.id)
    const a = await iniciar(f)
    expect(a).toMatchObject({ ok: true, confirmou_detectado: false })
    const b = await iniciar(f)
    expect(b).toEqual({ ok: true, ja_iniciada: true, registro_id: a.registro_id })
    expect(await contar(`select count(*) n from public.ab_native_tests where video_id = $1`, [v.id])).toBe(1)
    const t = (await pg.query(`select youtube_video_id, origem, campos, estado, confirmado_por, confirmado_em, variantes from public.ab_native_tests where id = $1`, [a.registro_id])).rows[0]
    expect(t).toMatchObject({ youtube_video_id: v.yt, origem: 'confirmado', campos: ['titulo'], estado: 'em_andamento', confirmado_por: usuario })
    expect(t.confirmado_em).not.toBeNull()
    expect(t.variantes).toHaveLength(2)
    const fx = (await pg.query(`select registro_id from public.ab_native_fichas where id = $1`, [f])).rows[0]
    expect(fx.registro_id).toBe(a.registro_id)
  })

  it('com detectado aberta: confirma a existente (origem continua detectado), une os campos, zero linha nova, expira o lembrete', async () => {
    const v = await video()
    const det = await semearDetectada(v.id, v.yt, '{miniatura}')
    const f = await semearFicha(v.id, { campos: '{titulo}' })
    await pg.query(`insert into public.notifications (site_id, user_id, type, domain, priority, title, dedup_key)
      values ($1, $2, 'youtube.native_ficha_lembrar', 'youtube', 3, 'Lembrete', $3)`, [siteId, usuario, 'ficha-lembrar:' + f])
    const r = await iniciar(f)
    expect(r).toMatchObject({ ok: true, registro_id: det, confirmou_detectado: true })
    expect(await contar(`select count(*) n from public.ab_native_tests where video_id = $1`, [v.id])).toBe(1)
    const t = (await pg.query(`select origem, campos, confirmado_em, confirmado_por, variantes from public.ab_native_tests where id = $1`, [det])).rows[0]
    expect(t.origem).toBe('detectado')
    expect([...t.campos].sort()).toEqual(['miniatura', 'titulo'])
    expect(t.confirmado_em).not.toBeNull()
    expect(t.confirmado_por).toBe(usuario)
    expect(t.variantes).toHaveLength(2)
    expect((await pg.query(`select expired_at from public.notifications where dedup_key = $1`, ['ficha-lembrar:' + f])).rows[0].expired_at).not.toBeNull()
  })

  it('ficha A iniciada e ficha B aberta no mesmo vídeo: B recebe ja_ha_teste_em_andamento, variantes de X intactas', async () => {
    const v = await video()
    const a = await semearFicha(v.id)
    const x = await iniciar(a)
    const b = await semearFicha(v.id, { variantes: JSON.stringify([{ n: 1, tipo: 'titulo', titulo: 'O' }, { n: 2, tipo: 'titulo', titulo: 'Outra' }, { n: 3, tipo: 'titulo', titulo: 'Mais' }]) })
    const r = await iniciar(b)
    expect(r).toEqual({ erro: 'ja_ha_teste_em_andamento', registro_id: x.registro_id })
    const t = (await pg.query(`select variantes from public.ab_native_tests where id = $1`, [x.registro_id])).rows[0]
    expect(t.variantes).toHaveLength(2)
    expect((await pg.query(`select registro_id from public.ab_native_fichas where id = $1`, [b])).rows[0].registro_id).toBeNull()
  })

  it('ficha de outro site: nao_encontrada; 1 variante: ficha_incompleta (variantes); campos vazios: ficha_incompleta (campos)', async () => {
    const v = await video()
    const f = await semearFicha(v.id)
    expect(await iniciar(f, pg, outroSite)).toEqual({ erro: 'nao_encontrada' })
    expect(await iniciar(randomUUID())).toEqual({ erro: 'nao_encontrada' })
    const v1 = await video()
    expect(await iniciar(await semearFicha(v1.id, { variantes: FICHA1 }))).toEqual({ erro: 'ficha_incompleta', motivo: 'variantes' })
    const v2 = await video()
    expect(await iniciar(await semearFicha(v2.id, { campos: '{}' }))).toEqual({ erro: 'ficha_incompleta', motivo: 'campos' })
    expect(await contar(`select count(*) n from public.ab_native_tests where video_id = any($1::uuid[])`, [[v.id, v1.id, v2.id]])).toBe(0)
  })

  it('falha no passo 4 desfaz o insert do passo 2', async () => {
    const v = await video()
    const f = await semearFicha(v.id)
    await pg.query(`create or replace function public.f1a_teste_falha() returns trigger language plpgsql as $$ begin raise exception 'falha injetada' using errcode = 'P0001'; end $$`)
    await pg.query(`create trigger f1a_teste_falha before update on public.ab_native_fichas for each row when (new.id = '${f}') execute function public.f1a_teste_falha()`)
    try {
      await expect(iniciar(f)).rejects.toMatchObject({ code: 'P0001' })
    } finally {
      await pg.query('drop trigger if exists f1a_teste_falha on public.ab_native_fichas')
    }
    expect(await contar(`select count(*) n from public.ab_native_tests where video_id = $1`, [v.id])).toBe(0)
    expect((await pg.query(`select registro_id from public.ab_native_fichas where id = $1`, [f])).rows[0].registro_id).toBeNull()
  })

  it('o registrador encerra a linha entre o passo 2 e o 3: estado_mudou, ficha sem registro_id', async () => {
    const v = await video()
    const det = await semearDetectada(v.id, v.yt)
    const f = await semearFicha(v.id)
    const a = await conexao(); const b = await conexao()
    await a.query('begin')
    await a.query(`select 1 from public.ab_native_tests where id = $1 for update`, [det]) // segura a linha: o passo 3 de B espera aqui
    const pidB = Number((await b.query('select pg_backend_pid() p')).rows[0].p)
    const pendente = iniciar(f, b)
    let esperando = false
    for (let i = 0; i < 50 && !esperando; i++) { // B só entra em espera de lock depois de passar pelo passo 2 (conflito)
      esperando = ((await pg.query(`select 1 from pg_stat_activity where wait_event_type = 'Lock' and pid = $1`, [pidB])).rowCount ?? 0) > 0
      if (!esperando) await new Promise((r) => setTimeout(r, 100))
    }
    expect(esperando).toBe(true)
    await a.query(`update public.ab_native_tests set estado = 'encerrado', encerrado_em = now() where id = $1`, [det])
    await a.query('commit')
    expect(await pendente).toEqual({ erro: 'estado_mudou' })
    expect((await pg.query(`select registro_id from public.ab_native_fichas where id = $1`, [f])).rows[0].registro_id).toBeNull()
    expect(await contar(`select count(*) n from public.ab_native_tests where video_id = $1 and estado = 'em_andamento'`, [v.id])).toBe(0)
  })

  it('ficha sem o original (n=1) ou título faltando numa ficha de título: ficha_incompleta (original/titulo) (Yannis M4)', async () => {
    const v = await video()
    const semOriginal = JSON.stringify([{ n: 2, tipo: 'titulo', titulo: 'A' }, { n: 3, tipo: 'titulo', titulo: 'B' }])
    expect(await iniciar(await semearFicha(v.id, { variantes: semOriginal }))).toEqual({ erro: 'ficha_incompleta', motivo: 'original' })
    const v2 = await video()
    const semTitulo = JSON.stringify([{ n: 1, tipo: 'titulo', titulo: 'O' }, { n: 2, tipo: 'titulo' }])
    expect(await iniciar(await semearFicha(v2.id, { variantes: semTitulo }))).toEqual({ erro: 'ficha_incompleta', motivo: 'titulo' })
    const v3 = await video()
    const soMiniatura = JSON.stringify([{ n: 1, tipo: 'miniatura' }, { n: 2, tipo: 'miniatura' }])
    expect(await iniciar(await semearFicha(v3.id, { campos: '{miniatura}', variantes: soMiniatura }))).toMatchObject({ ok: true })
    expect(await contar(`select count(*) n from public.ab_native_tests where video_id = any($1::uuid[]) and variantes is not null`, [[v.id, v2.id]])).toBe(0)
  })

  it('duplo toque concorrente em "Já iniciei": o lock da ficha faz a 2ª ver ja_iniciada, e há um registro só (Yannis M1)', async () => {
    const v = await video()
    const f = await semearFicha(v.id)
    const a = await conexao(); const b = await conexao()
    await a.query('begin')
    const r1 = (await a.query(`select public.ab_native_iniciar($1, $2, $3) as r`, [siteId, f, usuario])).rows[0].r
    expect(r1).toMatchObject({ ok: true })
    const pidB = Number((await b.query('select pg_backend_pid() p')).rows[0].p)
    const pendente = iniciar(f, b)
    let esperando = false
    for (let i = 0; i < 50 && !esperando; i++) {
      esperando = ((await pg.query(`select 1 from pg_stat_activity where wait_event_type = 'Lock' and pid = $1`, [pidB])).rowCount ?? 0) > 0
      if (!esperando) await new Promise((r) => setTimeout(r, 100))
    }
    expect(esperando).toBe(true)
    await a.query('commit')
    expect(await pendente).toEqual({ ok: true, ja_iniciada: true, registro_id: r1.registro_id })
    expect(await contar(`select count(*) n from public.ab_native_tests where video_id = $1`, [v.id])).toBe(1)
  })

  it('a expiração do ficha-lembrar: é do site da chamada (não toca notificação de outro site com a mesma chave) (Yannis M3)', async () => {
    const v = await video()
    const f = await semearFicha(v.id)
    const k = `ficha-lembrar:${f}`
    for (const s of [siteId, outroSite]) {
      await pg.query(`insert into public.notifications (site_id, user_id, type, domain, priority, title, dedup_key) values ($1, $2, 'youtube.native_ficha_lembrar', 'youtube', 3, 'x', $3)`, [s, usuario, k])
    }
    expect(await iniciar(f)).toMatchObject({ ok: true })
    const r = await pg.query(`select site_id, expired_at from public.notifications where dedup_key = $1`, [k])
    expect(r.rows.find((x) => x.site_id === siteId).expired_at).not.toBeNull()
    expect(r.rows.find((x) => x.site_id === outroSite).expired_at).toBeNull()
  })

  it('privilégios: só service_role executa', async () => {
    for (const fn of ['public.ab_native_ficha_abrir(uuid,uuid,uuid)', 'public.ab_native_iniciar(uuid,uuid,uuid)']) {
      for (const role of ['authenticated', 'anon', 'public']) {
        const r = await pg.query(`select has_function_privilege($1, $2, 'execute') as x`, [role, fn])
        expect(r.rows[0].x, `${role} ${fn}`).toBe(false)
      }
      expect((await pg.query(`select has_function_privilege('service_role', $1, 'execute') as x`, [fn])).rows[0].x).toBe(true)
      const p = await pg.query(`select prosecdef, proconfig from pg_proc where oid = $1::regprocedure`, [fn])
      expect(p.rows[0].prosecdef).toBe(false)
      expect(String(p.rows[0].proconfig)).toContain('search_path=""')
    }
  })
})
