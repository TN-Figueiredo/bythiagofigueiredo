// @vitest-environment node
/**
 * A5 · F2-coleta: respostas de espectadores (`speaker_no`, sem identidade) na função de escrita, na prova, na purga e na prévia,
 * contra Postgres de verdade. Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-f2-terceiros.test.ts --no-file-parallelism
 *
 * A migration `*_observatorio_a5_f2_respostas_de_terceiros` tem de estar aplicada no banco (nunca `db:reset`). Cada teste cria o
 * SEU site e só olha para ele. DADO PESSOAL: só dado inventado; nenhum teste daqui põe nome, foto ou id de canal em resposta de
 * espectador (o caso 15 prova que, mesmo forjado no pacote, nada chega a `competitor_video_comment_authors`).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { criarUsuario } from '../helpers/mg6'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { COMMENT_RULES } from '@/lib/youtube/observatorio/comentarios/regras'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const H = 3_600_000
const D = 24 * H
const NOW = Date.now()
const iso = (ms: number): string => new Date(ms).toISOString()
const JANELA: Record<1 | 7 | 30, readonly [number, number]> = { 1: [24, 72], 7: [168, 240], 30: [720, 888] }
const MARCOS_JSON = JSON.stringify(COMMENT_RULES.marks.map((m) => ({ mark: m.mark, from_h: m.fromH, until_h: m.untilH })))
const uid = (): string => randomUUID().replace(/-/g, '').slice(0, 12)
/** O vídeo é publicado há 40 dias: cada marco tem o seu `taken_at` no passado, na janela dele. */
const PUB = NOW - 40 * D
const IDADE: Record<1 | 7 | 30, number> = { 1: 30, 7: 200, 30: 800 }
const takenDe = (m: 1 | 7 | 30): number => PUB + IDADE[m] * H

vi.setConfig({ testTimeout: 90_000, hookTimeout: 60_000 })

type Linha = Record<string, unknown>
type Marco = 1 | 7 | 30

describe.skipIf(skipIfNoLocalDb())('A5 F2-coleta: respostas de espectadores, SQL (banco local)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const sites: string[] = []
  const usuarios: string[] = []

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    const ok = (await pg.query(`select exists(select 1 from information_schema.columns where table_name = 'competitor_video_comments' and column_name = 'speaker_no') as ok`)).rows[0]!.ok
    if (!ok) throw new Error('migration da F2-coleta não aplicada no banco de integração (aplique o arquivo; nunca db:reset)')
  })
  afterAll(async () => {
    try {
      if (sites.length > 0) {
        for (const t of ['competitor_removed_items', 'youtube_channels']) {
          await pg.query(`delete from public.${t} where site_id = any($1::uuid[])`, [sites])
        }
        await pg.query('delete from public.audit_log where site_id = any($1::uuid[])', [sites])
        await pg.query('delete from public.sites where id = any($1::uuid[])', [sites])
      }
      if (usuarios.length > 0) await pg.query('delete from auth.users where id = any($1::uuid[])', [usuarios])
    } finally {
      await pg.end()
    }
  })

  // ───────────────────────── semeadura ─────────────────────────
  const q = async (sql: string, params: unknown[] = []): Promise<Linha[]> => (await pg.query(sql, params)).rows as Linha[]
  async function cena(): Promise<{ site: string; canal: string; video: string }> {
    const site = (await seedSite(sb)).siteId; sites.push(site)
    const canal = String((await q(`insert into public.competitor_channels (site_id, channel_id, channel_name, subscriber_count)
      values ($1, $2, 'Canal de teste', 5000) returning id`, [site, 'UC' + uid() + uid()]))[0]!.id)
    const video = String((await q(`insert into public.competitor_videos (competitor_channel_id, video_id, published_at, comment_count)
      values ($1, $2, $3, 40) returning id`, [canal, 'v' + uid(), iso(PUB)]))[0]!.id)
    return { site, canal, video }
  }
  const snapDe = (mark: Marco, extra: Linha = {}): Linha => ({
    taken_at: iso(takenDe(mark)), from_h: JANELA[mark][0], until_h: JANELA[mark][1], status: 'ok', error_reason: null, pool_size: 5,
    pool_complete: true, video_comment_count: 40, selected_count: 3, featured_lookup_n: 0, featured_unknown_n: 0, rule_version: 2,
    rule_params: { teste: true }, units_used: 3, identity_days: 28, creator_replies_max: 5, third_party_replies_max: 20, ...extra,
  })
  const topo = (id: string, o: Linha = {}): Linha => ({
    youtube_comment_id: id, parent_youtube_id: null, via: 'lote', body: 'corpo de ' + id, body_truncated: false, published_at: iso(NOW - 20 * H),
    edited_at: null, is_creator: false, creator_replied: null, featured_reason: null, featured_channel_id: null, featured_size_band: null,
    featured_ratio_band: null, author: { display_name: 'Autor ' + id, channel_id: 'UC' + id, avatar_url: 'https://img.invalid/' + id + '.jpg' },
    likes: 10, reply_count: 2, relevance_rank: 1, slot: 'curtidos', ...o,
  })
  let seq = 0
  /** Resposta do criador; `published_at` cresce com a ordem de criação (a ordem do pacote). */
  const resp = (id: string, pai: string, o: Linha = {}): Linha => ({
    youtube_comment_id: id, parent_youtube_id: pai, via: 'lote', body: 'resposta ' + id, body_truncated: false,
    published_at: iso(NOW - 10 * H + (seq++) * 1000), edited_at: null, is_creator: true, likes: 1, ...o,
  })
  const terc = (id: string, pai: string, no: number | null, o: Linha = {}): Linha =>
    resp(id, pai, { is_creator: false, speaker_no: no, likes: 2, ...o })

  async function grava(video: string, mark: Marco, snap: Linha, comments: Linha[] = [], missing: string[] = []): Promise<Linha> {
    const r = await q('select public.apply_competitor_comment_snap($1::uuid, $2::smallint, $3::jsonb, $4::jsonb, $5::text[]) as r',
      [video, mark, JSON.stringify(snap), JSON.stringify(comments), missing])
    return r[0]!.r as Linha
  }
  async function recusa(fn: () => Promise<unknown>): Promise<{ code: string; msg: string }> {
    try { await fn() } catch (e) { const x = e as { code?: string; message?: string }; return { code: x.code ?? '', msg: x.message ?? '' } }
    throw new Error('a chamada deveria ter sido recusada')
  }
  const terceirosDe = (video: string): Promise<Linha[]> => q(
    `select youtube_comment_id, speaker_no, body, missing_since from public.competitor_video_comments
      where video_id = $1 and parent_id is not null and not is_creator order by id`, [video])
  const linha = async (video: string, yt: string): Promise<Linha> => {
    const r = await q('select * from public.competitor_video_comments where video_id = $1 and youtube_comment_id = $2', [video, yt])
    expect(r, 'comentário ' + yt).toHaveLength(1)
    return r[0]!
  }
  const removidos = async (site: string): Promise<number> =>
    Number((await q(`select count(*) as n from public.competitor_removed_items where site_id = $1 and kind = 'comentario'`, [site]))[0]!.n)
  async function prova(site: string): Promise<Record<string, number>> {
    const r = await q('select public.competitor_comment_health($1::uuid, $2::timestamptz, $3::jsonb, 28, $4::interval, null) as r',
      [site, iso(NOW), MARCOS_JSON, COMMENT_RULES.graceHours + ' hours'])
    return r[0]!.r as Record<string, number>
  }
  /** Fio padrão: topo (de espectador) + 1 resposta do criador, gravados no marco 1. */
  async function fio(c: { video: string }, n: string, snapExtra: Linha = {}, terceiros: Linha[] = []): Promise<Linha> {
    return grava(c.video, 1, snapDe(1, snapExtra), [topo('t' + n), resp('r' + n, 't' + n), ...terceiros])
  }

  // ───────────────────────── 1 a 3: o básico ─────────────────────────
  it('1. compatível: pacote sem third_party_replies_max nunca grava terceiro', async () => {
    const c = await cena()
    const { third_party_replies_max: _t, ...semCampo } = snapDe(1)
    void _t
    const r = await grava(c.video, 1, semCampo, [topo('t1'), resp('r1', 't1'), terc('x1', 't1', 2)])
    expect(r).toMatchObject({ status: 'gravado', comentarios_novos: 1, respostas_novas: 1, terceiros_novos: 0, terceiros_sem_fio: 0, nao_gravados: 1 })
    expect(await terceirosDe(c.video)).toHaveLength(0)
  })

  it('2. grava: 3 terceiros com os números, 1 marca por linha, nenhuma identidade', async () => {
    const c = await cena()
    const r = await fio(c, '2', {}, [terc('x1', 't2', 1), terc('x2', 't2', 2), terc('x3', 't2', 2)])
    expect(r).toMatchObject({ terceiros_novos: 3, terceiros_fora_do_teto: 0, terceiros_sem_fio: 0, nao_gravados: 0 })
    const t = await terceirosDe(c.video)
    expect(t.map((x) => x.speaker_no)).toEqual([1, 2, 2])
    const ids = await q(`select
      (select count(*) from public.competitor_video_comment_authors a join public.competitor_video_comments k on k.id = a.comment_id
        where k.video_id = $1 and k.parent_id is not null)::int as autores_de_resposta,
      (select count(*) from public.competitor_video_comment_authors a join public.competitor_video_comments k on k.id = a.comment_id
        where k.video_id = $1 and k.parent_id is null)::int as autores_do_topo,
      (select count(*) from public.competitor_video_comment_marks m join public.competitor_video_comments k on k.id = m.comment_id
        where k.video_id = $1 and k.parent_id is not null and not k.is_creator)::int as marcas_de_terceiros`, [c.video])
    expect(ids[0]).toEqual({ autores_de_resposta: 0, autores_do_topo: 1, marcas_de_terceiros: 3 })
  })

  it('3. F2 crítico 1: 4 terceiros guardados não travam a resposta nova do criador (o ja do criador conta só is_creator)', async () => {
    const c = await cena()
    await fio(c, '3', {}, [terc('x1', 't3', 1), terc('x2', 't3', 2), terc('x3', 't3', 3), terc('x4', 't3', 4)])
    expect((await terceirosDe(c.video))).toHaveLength(4)
    const r = await grava(c.video, 7, snapDe(7, { creator_replies_max: 2 }), [resp('r3b', 't3')])
    expect(r).toMatchObject({ respostas_novas: 1 })
    expect(await linha(c.video, 'r3b')).toMatchObject({ is_creator: true })
  })

  // ───────────────────────── 4: o teto ─────────────────────────
  it('4. teto de 20 por vídeo, na ordem do pacote; as guardadas contam no marco seguinte', async () => {
    const c = await cena()
    const topos: Linha[] = []
    const ts: Linha[] = []
    for (let f = 1; f <= 6; f++) {
      topos.push(topo('t4' + f), resp('r4' + f, 't4' + f))
      for (let k = 1; k <= 4; k++) ts.push(terc(`x4${f}${k}`, 't4' + f, k))
    }
    const r = await grava(c.video, 1, snapDe(1), [...topos, ...ts])
    expect(r).toMatchObject({ terceiros_novos: 20, terceiros_fora_do_teto: 4, terceiros_sem_fio: 0 })
    const t = await terceirosDe(c.video)
    expect(t).toHaveLength(20)
    expect(t.map((x) => x.youtube_comment_id)).toEqual(ts.slice(0, 20).map((x) => x.youtube_comment_id))
    const r2 = await grava(c.video, 7, snapDe(7), [terc('x4novo1', 't41', 9), terc('x4novo2', 't42', 9)])
    expect(r2).toMatchObject({ terceiros_novos: 0, terceiros_fora_do_teto: 2 })
    expect(await terceirosDe(c.video)).toHaveLength(20)
  })

  it('4b. o teto é contado depois das deleções (Phil I3, Yannis I3): 20 guardados, 4 ausentes, 3 novos => 19', async () => {
    const c = await cena()
    const topos: Linha[] = []
    const ts: Linha[] = []
    for (let f = 1; f <= 5; f++) {
      topos.push(topo('t4b' + f), resp('r4b' + f, 't4b' + f))
      for (let k = 1; k <= 4; k++) ts.push(terc(`x4b${f}${k}`, 't4b' + f, k))
    }
    expect(await grava(c.video, 1, snapDe(1), [...topos, ...ts])).toMatchObject({ terceiros_novos: 20 })
    const ausentes = ['x4b11', 'x4b12', 'x4b13', 'x4b14']
    const r = await grava(c.video, 7, snapDe(7), [terc('n1', 't4b2', 7), terc('n2', 't4b2', 8), terc('n3', 't4b3', 7)], ausentes)
    expect(r).toMatchObject({ terceiros_apagados: 4, terceiros_novos: 3, terceiros_fora_do_teto: 0 })
    expect(await terceirosDe(c.video)).toHaveLength(19)
  })

  // ───────────────────────── 5, 16, 17: o fio e o criador ─────────────────────────
  it('5. fio sem resposta do criador, ou com a única ausente, não recebe terceiro', async () => {
    const c = await cena()
    const r = await grava(c.video, 1, snapDe(1), [topo('t5a'), topo('t5b'), resp('r5b', 't5b'), terc('x5a', 't5a', 2)])
    expect(r).toMatchObject({ terceiros_novos: 0, terceiros_sem_fio: 1, nao_gravados: 0 })
    await q(`update public.competitor_video_comments set missing_since = current_date where video_id = $1 and youtube_comment_id = 'r5b'`, [c.video])
    const r2 = await grava(c.video, 7, snapDe(7), [terc('x5b', 't5b', 2)])
    expect(r2).toMatchObject({ terceiros_novos: 0, terceiros_sem_fio: 1 })
    expect(await terceirosDe(c.video)).toHaveLength(0)
  })

  it('16. topo removido pelo dono: o terceiro conta em terceiros_sem_fio, não em nao_gravados', async () => {
    const c = await cena()
    await q(`insert into public.competitor_removed_items (site_id, kind, youtube_id, competitor_channel_id, decided_by, rows_deleted)
      values ($1, 'comentario', 't16', $2, $3, '{}'::jsonb)`, [c.site, c.canal, randomUUID()])
    const r = await grava(c.video, 1, snapDe(1), [terc('x16', 't16', 2)])
    expect(r).toMatchObject({ terceiros_novos: 0, terceiros_sem_fio: 1, nao_gravados: 0 })
    expect(await terceirosDe(c.video)).toHaveLength(0)
  })

  it('17. terceiro de fio sem criador conta em terceiros_sem_fio uma vez só', async () => {
    const c = await cena()
    const r = await grava(c.video, 1, snapDe(1), [topo('t17'), terc('x17a', 't17', 1), terc('x17b', 't17', 2)])
    expect(r).toMatchObject({ comentarios_novos: 1, terceiros_novos: 0, terceiros_sem_fio: 2, nao_gravados: 0 })
  })

  // ───────────────────────── 6, 7, 7b: apagar sozinho ─────────────────────────
  it('6. terceiro ausente é apagado na hora, com as marcas, sem passar por competitor_removed_items', async () => {
    const c = await cena()
    await fio(c, '6', {}, [terc('x1', 't6', 1), terc('x2', 't6', 2)])
    const antes = await prova(c.site)
    const r = await grava(c.video, 7, snapDe(7), [], ['x1'])
    expect(r).toMatchObject({ terceiros_apagados: 1, ausentes: 0, ausentes_marcados: 0 })
    expect((await terceirosDe(c.video)).map((x) => x.youtube_comment_id)).toEqual(['x2'])
    const marcas = await q(`select count(*)::int as n from public.competitor_video_comment_marks m
      where not exists (select 1 from public.competitor_video_comments k where k.id = m.comment_id) `)
    expect(marcas[0]!.n).toBe(0)
    expect(await removidos(c.site)).toBe(0)
    expect((await prova(c.site)).comentarios_ausentes_sem_decisao).toBe(antes.comentarios_ausentes_sem_decisao)
  })

  it('7. a resposta do criador some no marco 30: os terceiros do fio saem na mesma chamada', async () => {
    const c = await cena()
    await fio(c, '7', {}, [terc('x1', 't7', 1), terc('x2', 't7', 2)])
    const r = await grava(c.video, 30, snapDe(30), [], ['r7'])
    expect(r).toMatchObject({ ausentes: 1, ausentes_marcados: 1, terceiros_apagados: 2 })
    expect(await terceirosDe(c.video)).toHaveLength(0)
    expect((await linha(c.video, 'r7')).missing_since).not.toBeNull()
    expect(await linha(c.video, 't7')).toBeTruthy()
    expect((await prova(c.site)).respostas_de_terceiros).toBe(0)
  })

  it('7b. criador ausente pela 1ª vez + terceiros novos no lote: nenhum entra, só saem os que já estavam', async () => {
    const c = await cena()
    await fio(c, '7b', {}, [terc('x0', 't7b', 1)])
    const r = await grava(c.video, 30, snapDe(30), [terc('n1', 't7b', 2), terc('n2', 't7b', 3), terc('n3', 't7b', 4)], ['r7b'])
    expect(r).toMatchObject({ terceiros_novos: 0, terceiros_apagados: 1 })
    expect(await terceirosDe(c.video)).toHaveLength(0)
  })

  // ───────────────────────── 8 a 11: regras do banco ─────────────────────────
  it('8. checks: speaker_no só em resposta de espectador, obrigatório nela, e maior que 0', async () => {
    const c = await cena()
    await fio(c, '8', {}, [terc('x1', 't8', 1)])
    const topoId = (await linha(c.video, 't8')).id
    const tercId = (await linha(c.video, 'x1')).id
    expect((await recusa(() => pg.query('update public.competitor_video_comments set speaker_no = 1 where id = $1', [topoId]))).code).toBe('23514')
    expect((await recusa(() => pg.query('update public.competitor_video_comments set speaker_no = 0 where id = $1', [tercId]))).code).toBe('23514')
    expect((await recusa(() => pg.query(`insert into public.competitor_video_comments
      (site_id, competitor_channel_id, video_id, youtube_comment_id, parent_id, body, published_at, is_creator, first_seen_at, last_seen_at)
      values ($1, $2, $3, 'sem-numero', $4, 'x', now(), false, now(), now())`, [c.site, c.canal, c.video, topoId]))).code).toBe('23514')
  })

  it('9. o número é congelado: o mesmo id voltando com outro speaker_no mantém o primeiro; texto e curtidas atualizam', async () => {
    const c = await cena()
    await fio(c, '9', {}, [terc('x1', 't9', 2)])
    const r = await grava(c.video, 7, snapDe(7), [terc('x1', 't9', 3, { body: 'texto novo', likes: 9 })])
    expect(r).toMatchObject({ terceiros_atualizados: 1, terceiros_novos: 0 })
    expect(await linha(c.video, 'x1')).toMatchObject({ speaker_no: 2, body: 'texto novo' })
    const m = await q(`select m.likes from public.competitor_video_comment_marks m join public.competitor_video_comments k on k.id = m.comment_id
      where k.video_id = $1 and k.youtube_comment_id = 'x1' and m.mark = 7`, [c.video])
    expect(m[0]!.likes).toBe(9)
  })

  it('10. id de terceiro em competitor_removed_items não ganha returned_seen_at; o de topo ganha', async () => {
    const c = await cena()
    for (const id of ['x10', 't10b']) {
      await q(`insert into public.competitor_removed_items (site_id, kind, youtube_id, competitor_channel_id, decided_by, rows_deleted)
        values ($1, 'comentario', $2, $3, $4, '{}'::jsonb)`, [c.site, id, c.canal, randomUUID()])
    }
    await grava(c.video, 1, snapDe(1), [topo('t10'), resp('r10', 't10'), terc('x10', 't10', 2), topo('t10b')])
    const r = await q(`select youtube_id, returned_seen_at is not null as visto from public.competitor_removed_items where site_id = $1 order by youtube_id`, [c.site])
    expect(r).toEqual([{ youtube_id: 't10b', visto: true }, { youtube_id: 'x10', visto: false }])
    expect(await terceirosDe(c.video)).toHaveLength(0)
  })

  it('11. limites: creator_replies_max até 5, third_party_replies_max até 20, criador com 5 no prefixo grava 5', async () => {
    const c = await cena()
    expect((await recusa(() => grava(c.video, 1, snapDe(1, { creator_replies_max: 6 }), [])) ).code).toBe('22023')
    expect((await recusa(() => grava(c.video, 1, snapDe(1, { creator_replies_max: 0 }), []))).code).toBe('22023')
    expect((await recusa(() => grava(c.video, 1, snapDe(1, { third_party_replies_max: 21 }), []))).code).toBe('22023')
    expect((await recusa(() => grava(c.video, 1, snapDe(1, { third_party_replies_max: -1 }), []))).code).toBe('22023')
    const cinco = [1, 2, 3, 4, 5].map((i) => resp('r11' + i, 't11'))
    const r = await grava(c.video, 1, snapDe(1, { creator_replies_max: 5 }), [topo('t11'), ...cinco])
    expect(r).toMatchObject({ respostas_novas: 5 })
    const seis = await cena()
    const r6 = await grava(seis.video, 1, snapDe(1, { creator_replies_max: 5 }), [topo('t11'), ...cinco, resp('r11x', 't11')])
    expect(r6).toMatchObject({ respostas_novas: 5, nao_gravados: 1 })
  })

  // ───────────────────────── 12: a prova ─────────────────────────
  it('12. prova: cada violação de respostas_de_terceiros conta 1 (forjada por SQL); tudo gravado pela função dá 0', async () => {
    const c = await cena()
    await fio(c, '12', {}, [terc('x1', 't12', 1)])
    expect((await prova(c.site)).respostas_de_terceiros).toBe(0)
    const tId = (await linha(c.video, 'x1')).id
    const rId = (await linha(c.video, 'r12')).id
    const paiId = (await linha(c.video, 't12')).id
    const forjado = async (sql: (c: { site: string; canal: string; video: string }) => Promise<void>, soltarReplyCheck = false): Promise<number> => {
      await pg.query('begin')
      try {
        await pg.query(`set local lock_timeout = '5s'`)
        if (soltarReplyCheck) await pg.query('alter table public.competitor_video_comments drop constraint competitor_video_comments_reply_check')
        await sql(c)
        return (await prova(c.site)).respostas_de_terceiros
      } finally { await pg.query('rollback') }
    }
    // (a) sem speaker_no
    expect(await forjado(async () => {
      await pg.query(`insert into public.competitor_video_comments (site_id, competitor_channel_id, video_id, youtube_comment_id, parent_id, body, published_at, is_creator, first_seen_at, last_seen_at)
        values ($1, $2, $3, 'f1', $4, 'forjada', now(), false, now(), now())`, [c.site, c.canal, c.video, paiId])
    }, true)).toBe(1)
    // (b) com missing_since
    expect(await forjado(async () => { await pg.query('update public.competitor_video_comments set missing_since = current_date where id = $1', [tId]) })).toBe(1)
    // (c) fio cuja resposta do criador foi marcada ausente por update direto
    expect(await forjado(async () => { await pg.query('update public.competitor_video_comments set missing_since = current_date where id = $1', [rId]) })).toBe(1)
    // (d) 21 terceiros no vídeo (conta só o excesso: 1)
    expect(await forjado(async () => {
      await pg.query(`insert into public.competitor_video_comments (site_id, competitor_channel_id, video_id, youtube_comment_id, parent_id, body, published_at, is_creator, speaker_no, first_seen_at, last_seen_at)
        select $1, $2, $3, 'g' || g, $4, 'forjada', now(), false, 2, now(), now() from generate_series(1, 20) g`, [c.site, c.canal, c.video, paiId])
    })).toBe(1)
    // (e) linha de identidade presa a um terceiro
    expect(await forjado(async () => {
      await pg.query(`insert into public.competitor_video_comment_authors (comment_id, site_id, display_name, expires_at) values ($1, $2, 'forjado', now() + interval '28 days')`, [tId, c.site])
    })).toBe(1)
    expect((await prova(c.site)).respostas_de_terceiros).toBe(0)
  })

  // ───────────────────────── 13: a purga e a prévia do dono ─────────────────────────
  it('13. purga e prévia: o terceiro cai por cascata e é contado, mas o id dele nunca vai para competitor_removed_items', async () => {
    const c = await cena()
    const admin = await criarUsuario(pg); usuarios.push(admin)
    await fio(c, '13', {}, [terc('x1', 't13', 1), terc('x2', 't13', 2)])
    const topoId = String((await linha(c.video, 't13')).id)
    await q(`update public.competitor_video_comments set missing_since = current_date - 5 where id = $1`, [topoId])
    const prev = (await q('select public.competitor_comments_preview($1::uuid, $2::uuid, $3::bigint[]) as r', [c.site, c.canal, [topoId]]))[0]!.r as Linha
    expect(prev).toMatchObject({ status: 'ok', encontrados: 1, respostas: 1 })
    expect((prev.rows as Record<string, number>).competitor_video_comments).toBe(4)
    const r = (await q('select public.competitor_comments_purge($1::uuid, $2::uuid, $3::bigint[], $4::uuid, null, null) as r', [c.site, c.canal, [topoId], admin]))[0]!.r as Linha
    expect(r).toMatchObject({ status: 'apagado', comentarios: 4 })
    expect((r.rows_deleted as Record<string, number>).competitor_video_comments).toBe(4)
    expect((await q('select count(*)::int as n from public.competitor_video_comments where video_id = $1', [c.video]))[0]!.n).toBe(0)
    const ids = (await q(`select youtube_id from public.competitor_removed_items where site_id = $1 and kind = 'comentario' order by youtube_id`, [c.site])).map((x) => x.youtube_id)
    expect(ids).toEqual(['r13', 't13'])
  })

  // ───────────────────────── 14, 15: achado por id e autor forjado ─────────────────────────
  it('14. terceiro achado por id: atualiza o texto, ganha marca e não muda o speaker_no', async () => {
    const c = await cena()
    await fio(c, '14', {}, [terc('x1', 't14', 3)])
    const r = await grava(c.video, 7, snapDe(7), [{
      youtube_comment_id: 'x1', parent_youtube_id: 't14', via: 'id', body: 'achado por id', body_truncated: false, edited_at: null,
      likes: 5, reply_count: null, speaker_no: 9,
    }])
    expect(r).toMatchObject({ achados_por_id: 1, terceiros_novos: 0 })
    expect(await linha(c.video, 'x1')).toMatchObject({ speaker_no: 3, body: 'achado por id' })
    const m = await q(`select count(*)::int as n from public.competitor_video_comment_marks m join public.competitor_video_comments k on k.id = m.comment_id
      where k.video_id = $1 and k.youtube_comment_id = 'x1' and m.mark = 7`, [c.video])
    expect(m[0]!.n).toBe(1)
  })

  it('15. pacote forjado com author numa resposta de espectador: nenhuma linha de identidade', async () => {
    const c = await cena()
    await fio(c, '15', {}, [terc('x1', 't15', 1, { author: { display_name: 'Nome Inventado', channel_id: 'UCinventado', avatar_url: 'https://img.invalid/a.jpg' } })])
    expect((await terceirosDe(c.video))).toHaveLength(1)
    const a = await q(`select count(*)::int as n from public.competitor_video_comment_authors a join public.competitor_video_comments k on k.id = a.comment_id
      where k.video_id = $1 and k.parent_id is not null`, [c.video])
    expect(a[0]!.n).toBe(0)
    expect(JSON.stringify(await q('select * from public.competitor_video_comments where video_id = $1', [c.video]))).not.toContain('Nome Inventado')
  })

  // ───────────────────────── grants ─────────────────────────
  it('só service_role executa as quatro funções (anon e authenticated sem EXECUTE; nunca chamadas)', async () => {
    const fns = [
      'public.apply_competitor_comment_snap(uuid,smallint,jsonb,jsonb,text[])',
      'public.competitor_comment_health(uuid,timestamptz,jsonb,integer,interval,timestamptz)',
      'public.competitor_comments_purge(uuid,uuid,bigint[],uuid,text,text)',
      'public.competitor_comments_preview(uuid,uuid,bigint[])',
    ]
    for (const f of fns) {
      const r = await q(`select has_function_privilege('anon', $1, 'execute') as anon, has_function_privilege('authenticated', $1, 'execute') as auth,
        has_function_privilege('service_role', $1, 'execute') as svc`, [f])
      expect(r[0], f).toEqual({ anon: false, auth: false, svc: true })
    }
  })
})
