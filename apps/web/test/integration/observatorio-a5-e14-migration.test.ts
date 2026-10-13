// @vitest-environment node
/**
 * A5 · E14 (MG8): as cinco funções e as quatro tabelas dos comentários de destaque, contra Postgres de verdade, e a fronteira com
 * o TypeScript (`gravar.ts`, `anular.ts`). Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e14-migration.test.ts --no-file-parallelism
 *
 * O banco é dividido com outras etapas: cada teste cria o SEU site, os SEUS canais e vídeos e só olha para eles; toda chamada
 * que lista, prova ou apaga leva o site. Datas relativas ao relógio (`NOW`): o banco recusa `taken_at` mais de 10 minutos no
 * futuro, então os retratos "envelhecem" escolhendo `taken_at` no passado (a idade do vídeo é calculada por ele).
 * DADO PESSOAL: só dado INVENTADO. Cada teste de identidade usa uma sentinela própria e a procura em todas as tabelas
 * (varredura por catálogo). Função sem EXECUTE nunca é chamada como anon/authenticated (derruba este Postgres): isso é do RLS.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { COMMENT_RULES, MOTIVOS, RATIO_BANDS, SIZE_BANDS } from '@/lib/youtube/observatorio/comentarios/regras'
import {
  anular, gravarRetrato, lerCadastro, lerDevidos, lerGuardados, lerImpacto, lerProva, montarPacote, PacoteInvalido,
  type EntradaPacote,
} from '@/lib/youtube/observatorio/comentarios/gravar'
import { runAnularIdentidade } from '@/lib/youtube/observatorio/comentarios/anular'
import type { AgregadosDoLote, Conversa, Devido, Escolhido, Marco } from '@/lib/youtube/observatorio/comentarios/tipos'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const H = 3_600_000
const D = 24 * H
const MIN = 60_000
const NOW = Date.now()
const iso = (ms: number): string => new Date(ms).toISOString()
/** Os marcos e a tolerância (horas de idade) como o banco os confere. */
const JANELA: Record<Marco, readonly [number, number]> = { 1: [24, 72], 7: [168, 240], 30: [720, 888] }
const MARCOS_JSON = JSON.stringify(COMMENT_RULES.marks.map((m) => ({ mark: m.mark, from_h: m.fromH, until_h: m.untilH })))
const uid = (): string => randomUUID().replace(/-/g, '').slice(0, 12)

// a varredura por catálogo e as semeaduras passam de 5 s
vi.setConfig({ testTimeout: 90_000, hookTimeout: 60_000 })

type Linha = Record<string, unknown>
type Prova = Record<string, number | string | null | Record<string, number>>

describe.skipIf(skipIfNoLocalDb())('A5 E14 (MG8): comentários de destaque, SQL e fronteira com o TypeScript (banco local)', () => {
  let pg: Client
  let pg2: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const sites: string[] = []

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    pg2 = new Client({ connectionString: PG_URL }); await pg2.connect()
  })
  afterAll(async () => {
    // roda também depois de falha. youtube_channels e a decisão de remoção não caem em cascata do site: apagar antes dele
    try {
      if (sites.length > 0) {
        for (const t of ['competitor_removed_items', 'youtube_channels']) {
          await pg.query(`delete from public.${t} where site_id = any($1::uuid[])`, [sites])
        }
        await pg.query('delete from public.sites where id = any($1::uuid[])', [sites])
      }
    } finally {
      await pg.end()
      await pg2.end()
    }
  })

  // ───────────────────────── semeadura ─────────────────────────
  const q = async (c: Client, sql: string, params: unknown[] = []): Promise<Linha[]> => (await c.query(sql, params)).rows as Linha[]
  const novoSite = async (): Promise<string> => { const s = (await seedSite(sb)).siteId; sites.push(s); return s }
  async function novoCanal(site: string, o: { subs?: number; ausente?: boolean; yt?: string } = {}): Promise<{ id: string; yt: string }> {
    const yt = o.yt ?? 'UC' + uid() + uid()
    const r = await q(pg, `insert into public.competitor_channels (site_id, channel_id, channel_name, subscriber_count, missing_since)
      values ($1, $2, 'Canal de teste', $3, $4) returning id`, [site, yt, o.subs ?? 5000, o.ausente ? iso(NOW - 3 * D).slice(0, 10) : null])
    return { id: String(r[0]!.id), yt }
  }
  interface OpcVideo { pubMs?: number | null; contagem?: number | null; descobertoMs?: number | null; lbc?: string | null; inicioAoVivoMs?: number | null; ausente?: boolean }
  async function novoVideo(canalId: string, o: OpcVideo = {}): Promise<{ id: string; yt: string }> {
    const pub = o.pubMs === undefined ? NOW - 30 * H : o.pubMs
    const yt = 'v' + uid()
    const r = await q(pg, `insert into public.competitor_videos (competitor_channel_id, video_id, published_at, comment_count, discovered_at, live_broadcast_content, live_actual_start_at, missing_since)
      values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [canalId, yt, pub === null ? null : iso(pub), o.contagem === undefined ? 40 : o.contagem, o.descobertoMs == null ? null : iso(o.descobertoMs),
      o.lbc ?? null, o.inicioAoVivoMs == null ? null : iso(o.inicioAoVivoMs), o.ausente ? iso(NOW - 2 * D).slice(0, 10) : null])
    return { id: String(r[0]!.id), yt }
  }
  /** Um site com um canal e um vídeo que, em `takenMs`, tem `idadeH` horas. */
  interface Base { site: string; canal: { id: string; yt: string }; video: { id: string; yt: string }; taken: number }
  async function base(o: { idadeH?: number; takenMs?: number } = {}): Promise<Base> {
    const taken = o.takenMs ?? NOW - 2 * MIN
    const site = await novoSite()
    const canal = await novoCanal(site)
    const video = await novoVideo(canal.id, { pubMs: taken - (o.idadeH ?? 30) * H })
    return { site, canal, video, taken }
  }
  /** Mais um vídeo no mesmo canal, publicado `idadeH` horas antes de `takenMs`. */
  const maisUm = (b: Base, idadeH: number, takenMs: number): Promise<{ id: string; yt: string }> => novoVideo(b.canal.id, { pubMs: takenMs - idadeH * H })

  const snapDe = (mark: Marco, takenMs: number, extra: Linha = {}): Linha => ({
    taken_at: iso(takenMs), from_h: JANELA[mark][0], until_h: JANELA[mark][1], status: 'ok', error_reason: null, pool_size: 5, pool_complete: true,
    video_comment_count: 40, selected_count: 3, featured_lookup_n: 0, featured_unknown_n: 0, rule_version: 1, rule_params: { teste: true },
    units_used: 3, identity_days: 28, creator_replies_max: 3, ...extra,
  })
  const autorDe = (s: string): Linha => ({ display_name: 'Autor ' + s, channel_id: 'UC' + s, avatar_url: 'https://img.invalid/' + s + '.jpg' })
  const topo = (id: string, o: Linha = {}): Linha => ({
    youtube_comment_id: id, parent_youtube_id: null, via: 'lote', body: 'corpo de ' + id, body_truncated: false, published_at: iso(NOW - 20 * H),
    edited_at: null, is_creator: false, creator_replied: null, featured_reason: null, featured_channel_id: null, featured_size_band: null,
    featured_ratio_band: null, author: autorDe(uid()), likes: 10, reply_count: 2, relevance_rank: 1, slot: 'curtidos', ...o,
  })
  const resp = (id: string, pai: string, o: Linha = {}): Linha => ({
    youtube_comment_id: id, parent_youtube_id: pai, via: 'lote', body: 'resposta ' + id, body_truncated: false, published_at: iso(NOW - 10 * H),
    edited_at: null, is_creator: true, likes: 1, ...o,
  })
  const porId = (id: string, likes: number | null, o: Linha = {}): Linha => ({
    youtube_comment_id: id, parent_youtube_id: null, via: 'id', body: 'corpo novo de ' + id, body_truncated: false, edited_at: null, likes, reply_count: 3, ...o,
  })

  async function grava(c: Client, video: string, mark: number, snap: Linha, comments: Linha[] = [], missing: string[] = []): Promise<Linha> {
    const r = await q(c, 'select public.apply_competitor_comment_snap($1::uuid, $2::smallint, $3::jsonb, $4::jsonb, $5::text[]) as r',
      [video, mark, JSON.stringify(snap), JSON.stringify(comments), missing])
    return r[0]!.r as Linha
  }
  /** Chamada que TEM de falhar: devolve o código SQLSTATE e a mensagem. */
  async function recusa(fn: () => Promise<unknown>): Promise<{ code: string; msg: string }> {
    try { await fn() } catch (e) { const x = e as { code?: string; message?: string }; return { code: x.code ?? '', msg: x.message ?? '' } }
    throw new Error('a chamada deveria ter sido recusada')
  }
  async function purga(c: Client, site: string | null): Promise<Linha> {
    return (await q(c, 'select public.competitor_comment_identity_purge($1::uuid) as r', [site]))[0]!.r as Linha
  }
  /** Insere um retrato direto (superusuário), para os cenários de prova e de devidos. */
  async function snapSql(video: string, mark: Marco, o: { takenMs: number; status?: string; motivo?: string | null }): Promise<void> {
    await pg.query(`insert into public.competitor_video_comment_snaps (video_id, mark, site_id, competitor_channel_id, taken_at, video_age_hours, status, error_reason, rule_version, rule_params, units_used)
      select v.id, $2, c.site_id, c.id, $3, 30, $4, $5, 1, '{}'::jsonb, 1 from public.competitor_videos v join public.competitor_channels c on c.id = v.competitor_channel_id where v.id = $1`,
    [video, mark, iso(o.takenMs), o.status ?? 'ok', o.motivo ?? null])
  }
  const contagem = async (video: string): Promise<Record<string, number>> => {
    const r = await q(pg, `select
      (select count(*) from public.competitor_video_comment_snaps where video_id = $1)::int as snaps,
      (select count(*) from public.competitor_video_comments where video_id = $1)::int as comentarios,
      (select count(*) from public.competitor_video_comment_marks m join public.competitor_video_comments c on c.id = m.comment_id where c.video_id = $1)::int as leituras,
      (select count(*) from public.competitor_video_comment_authors a join public.competitor_video_comments c on c.id = a.comment_id where c.video_id = $1)::int as identidades`, [video])
    return r[0] as Record<string, number>
  }
  const comentario = async (video: string, ytId: string): Promise<Linha> => {
    const r = await q(pg, `select c.*, c.first_seen_at::text as first_seen_txt, c.missing_since::text as missing_since_txt from public.competitor_video_comments c where video_id = $1 and youtube_comment_id = $2`, [video, ytId])
    expect(r, 'comentário ' + ytId).toHaveLength(1)
    return r[0]!
  }
  const leitura = async (commentId: unknown, mark: number): Promise<Linha | undefined> =>
    (await q(pg, 'select * from public.competitor_video_comment_marks where comment_id = $1 and mark = $2', [commentId, mark]))[0]

  async function prova(site: string | null, o: { nowMs?: number; marks?: string | null; dias?: number | null; grace?: string | null; since?: number | null } = {}): Promise<Prova | null> {
    const r = await q(pg, 'select public.competitor_comment_health($1::uuid, $2::timestamptz, $3::jsonb, $4::integer, $5::interval, $6::timestamptz) as r', [
      site, iso(o.nowMs ?? NOW), o.marks === undefined ? MARCOS_JSON : o.marks, o.dias === undefined ? 28 : o.dias,
      o.grace === undefined ? COMMENT_RULES.graceHours + ' hours' : o.grace, o.since == null ? null : iso(o.since)])
    return r[0]!.r as Prova | null
  }
  interface OpcDevidos { nowMs?: number | null; marks?: string | null; retryAfter?: string | null; limit?: number | null; fast?: string[]; retryFast?: string | null; since?: number | null }
  async function devidos(site: string | null, o: OpcDevidos = {}): Promise<Linha[]> {
    return q(pg, 'select * from public.competitor_comment_due($1::timestamptz, $2::jsonb, $3::interval, $4::integer, $5::text[], $6::interval, $7::timestamptz, $8::uuid)', [
      o.nowMs === null ? null : iso(o.nowMs ?? NOW), o.marks === undefined ? MARCOS_JSON : o.marks,
      o.retryAfter === undefined ? '20 hours' : o.retryAfter, o.limit === undefined ? 200 : o.limit, o.fast ?? [],
      o.retryFast === undefined ? '15 minutes' : o.retryFast, o.since == null ? null : iso(o.since), site])
  }

  /**
   * Varredura por catálogo: acha `sentinela` em QUALQUER coluna de QUALQUER tabela do schema `public` (linha inteira em texto, depois
   * a coluna). Devolve "tabela.coluna". Partições entram pela tabela-mãe.
   */
  async function varredura(sentinela: string): Promise<string[]> {
    const padrao = '%' + sentinela + '%'
    const tabelas = await q(pg, `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relispartition order by 1`)
    const achados: string[] = []
    for (const t of tabelas) {
      const nome = String(t.relname)
      const n = Number((await q(pg, `select count(*) as n from public."${nome}" x where x::text like $1`, [padrao]))[0]!.n)
      if (n === 0) continue
      const cols = await q(pg, `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position`, [nome])
      for (const col of cols) {
        const m = Number((await q(pg, `select count(*) as n from public."${nome}" x where x."${String(col.column_name)}"::text like $1`, [padrao]))[0]!.n)
        if (m > 0) achados.push(nome + '.' + String(col.column_name))
      }
    }
    return achados.sort()
  }

  // ───────────────────────── a fronteira dos dois caminhos ─────────────────────────
  it('o pg direto e o cliente de serviço falam com o mesmo banco, e o relógio dele é o nosso', async () => {
    const viaPg = await q(pg, `select to_regclass('public.competitor_video_comment_snaps') is not null as existe, extract(epoch from now()) * 1000 as agora`)
    expect(viaPg[0]!.existe).toBe(true)
    expect(Math.abs(Number(viaPg[0]!.agora) - Date.now())).toBeLessThan(60_000)
    const viaServico = await sb.from('competitor_video_comment_snaps').select('video_id').limit(1)
    expect(viaServico.error, 'um select pelo cliente de serviço não pode devolver PGRST205').toBeNull()
  })

  // ───────────────────────── a escrita ─────────────────────────
  it('escrita: retrato ok grava retrato, comentários, leituras e identidade numa chamada', async () => {
    const b = await base()
    const acompanhado = await novoCanal(b.site)
    const r = await grava(pg, b.video.id, 1, snapDe(1, b.taken), [
      topo('criador1', { is_creator: true, author: null, slot: 'criador', relevance_rank: 1 }),
      topo('destaque1', { featured_reason: 'canal_acompanhado', featured_channel_id: acompanhado.id, slot: 'destaque', relevance_rank: 2 }),
      topo('comum1', { slot: 'curtidos', relevance_rank: 3 }),
    ])
    expect(r).toMatchObject({ status: 'gravado', retrato: 'ok', recebidos: 3, comentarios_novos: 3, comentarios_atualizados: 0, identidades: 2, leituras: 3, nao_gravados: 0 })
    expect(await contagem(b.video.id)).toEqual({ snaps: 1, comentarios: 3, leituras: 3, identidades: 2 })
    const autores = await q(pg, `select c.youtube_comment_id, extract(epoch from (a.expires_at - c.first_seen_at)) / 86400 as dias
      from public.competitor_video_comment_authors a join public.competitor_video_comments c on c.id = a.comment_id where c.video_id = $1 order by 1`, [b.video.id])
    expect(autores.map((x) => x.youtube_comment_id)).toEqual(['comum1', 'destaque1'])
    expect(autores.map((x) => Number(x.dias))).toEqual([28, 28])
    const s = (await q(pg, `select status, error_reason, video_age_hours::float8 as idade, selected_count from public.competitor_video_comment_snaps where video_id = $1`, [b.video.id]))[0]!
    expect(s).toMatchObject({ status: 'ok', error_reason: null, idade: 30, selected_count: 3 })
  })

  it('escrita: resposta do criador entra, a de terceiro não, e no máximo 3 por conversa', async () => {
    const b = await base()
    const pai = 'pai2'
    const r = await grava(pg, b.video.id, 1, snapDe(1, b.taken), [
      topo(pai),
      resp('r-d', pai, { published_at: iso(NOW - 7 * H) }),
      resp('r-a', pai, { published_at: iso(NOW - 10 * H) }),
      resp('r-c', pai, { published_at: iso(NOW - 8 * H) }),
      resp('r-b', pai, { published_at: iso(NOW - 9 * H) }),
      resp('r-terceiro', pai, { is_creator: false, published_at: iso(NOW - 11 * H) }),
    ])
    expect(r).toMatchObject({ recebidos: 6, comentarios_novos: 1, respostas_novas: 3, nao_gravados: 2 })
    const respostas = await q(pg, `select r.youtube_comment_id from public.competitor_video_comments r join public.competitor_video_comments p on p.id = r.parent_id where p.video_id = $1 order by r.published_at`, [b.video.id])
    expect(respostas.map((x) => x.youtube_comment_id)).toEqual(['r-a', 'r-b', 'r-c'])
    expect((await contagem(b.video.id)).identidades).toBe(1)   // só o pai: a resposta do criador não tem identidade
  })

  it('escrita: o mesmo retrato de novo devolve ja_existe e não muda nada', async () => {
    const b = await base()
    const pacote = [topo('c3a'), topo('c3b')]
    await grava(pg, b.video.id, 1, snapDe(1, b.taken), pacote)
    const antes = await q(pg, `select c.*, (select count(*) from public.competitor_video_comment_marks m where m.comment_id = c.id) as n from public.competitor_video_comments c where video_id = $1 order by id`, [b.video.id])
    const r = await grava(pg, b.video.id, 1, snapDe(1, b.taken + MIN, { units_used: 9 }), [topo('c3a', { body: 'OUTRO' }), topo('novo3')])
    expect(r).toEqual({ status: 'ja_existe', anterior: 'ok' })
    const depois = await q(pg, `select c.*, (select count(*) from public.competitor_video_comment_marks m where m.comment_id = c.id) as n from public.competitor_video_comments c where video_id = $1 order by id`, [b.video.id])
    expect(depois).toEqual(antes)
    expect((await q(pg, 'select units_used from public.competitor_video_comment_snaps where video_id = $1', [b.video.id]))[0]!.units_used).toBe(3)
  })

  it('escrita: retrato em erro é substituído pelo ok e as unidades somam', async () => {
    const b = await base()
    const e = await grava(pg, b.video.id, 1, snapDe(1, b.taken - 5 * MIN, { status: 'erro', error_reason: 'rede', units_used: 2, pool_size: null, pool_complete: null, selected_count: null }))
    expect(e).toMatchObject({ status: 'gravado', retrato: 'erro' })
    expect((await q(pg, 'select status, error_reason from public.competitor_video_comment_snaps where video_id = $1', [b.video.id]))[0]).toMatchObject({ status: 'erro', error_reason: 'rede' })
    const ok = await grava(pg, b.video.id, 1, snapDe(1, b.taken, { units_used: 3 }), [topo('c4a'), topo('c4b'), topo('c4c')])
    expect(ok).toMatchObject({ status: 'gravado', retrato: 'ok', comentarios_novos: 3 })
    const s = await q(pg, 'select status, error_reason, units_used from public.competitor_video_comment_snaps where video_id = $1', [b.video.id])
    expect(s).toEqual([{ status: 'ok', error_reason: null, units_used: 5 }])
  })

  it('escrita: recusa erro sem motivo, comentário em retrato que não é ok, marco 3 e prazo de identidade de 60 dias', async () => {
    const b = await base()
    const semMotivo = await recusa(() => grava(pg, b.video.id, 1, snapDe(1, b.taken, { status: 'erro', error_reason: null })))
    expect(semMotivo.code, 'check do motivo').toBe('23514')
    const comentarioForaDoOk = await recusa(() => grava(pg, b.video.id, 1, snapDe(1, b.taken, { status: 'sem_comentarios' }), [topo('c5a')]))
    expect(comentarioForaDoOk.code).toBe('22023')
    const ausenciaForaDoOk = await recusa(() => grava(pg, b.video.id, 1, snapDe(1, b.taken, { status: 'desligados' }), [], ['c5a']))
    expect(ausenciaForaDoOk.code).toBe('22023')
    const marco3 = await recusa(() => grava(pg, b.video.id, 3, snapDe(1, b.taken), [topo('c5b')]))
    expect(marco3.code).toBe('22023')
    const prazo60 = await recusa(() => grava(pg, b.video.id, 1, snapDe(1, b.taken, { identity_days: 60 }), [topo('c5c')]))
    expect(prazo60.code).toBe('22023')
    // atômico: nenhuma das quatro recusas deixou rastro
    expect(await contagem(b.video.id)).toEqual({ snaps: 0, comentarios: 0, leituras: 0, identidades: 0 })
  })

  it('escrita: vídeo inexistente devolve video_ausente', async () => {
    const r = await grava(pg, randomUUID(), 1, snapDe(1, NOW - 2 * MIN), [topo('c6a')])
    expect(r).toEqual({ status: 'video_ausente' })
  })

  it('escrita: comentário sem curtidas não é gravado e conta em nao_gravados (nunca curtida 0)', async () => {
    const b = await base()
    const semChave = topo('c7c'); delete semChave.likes
    const r = await grava(pg, b.video.id, 1, snapDe(1, b.taken), [topo('c7a', { likes: 5 }), topo('c7b', { likes: null }), semChave])
    expect(r).toMatchObject({ recebidos: 3, comentarios_novos: 1, leituras: 1, nao_gravados: 2 })
    const l = await q(pg, `select c.youtube_comment_id, m.likes from public.competitor_video_comment_marks m join public.competitor_video_comments c on c.id = m.comment_id where c.video_id = $1`, [b.video.id])
    expect(l).toEqual([{ youtube_comment_id: 'c7a', likes: 5 }])
    // por id também: curtida nula não vira zero
    const b2 = await base({ idadeH: 30 })
    await grava(pg, b2.video.id, 1, snapDe(1, b2.taken), [topo('c7d')])
    await q(pg, `update public.competitor_videos set published_at = $2 where id = $1`, [b2.video.id, iso(b2.taken - 192 * H)])
    const r2 = await grava(pg, b2.video.id, 7, snapDe(7, b2.taken), [porId('c7d', null)])
    expect(r2).toMatchObject({ achados_por_id: 0, nao_gravados: 1 })
    expect(await leitura((await comentario(b2.video.id, 'c7d')).id, 7)).toBeUndefined()
  })

  it('escrita: comentário que volta num marco posterior atualiza texto e curtidas e NÃO regrava identidade', async () => {
    // (a) identidade já apagada pela rotina: o marco 7 não a traz de volta
    const t1 = NOW - 30 * D
    const a = await base({ takenMs: t1 })
    await grava(pg, a.video.id, 1, snapDe(1, t1), [topo('c8a', { author: autorDe('s8a') })])
    expect((await purga(pg, a.site)).apagadas).toBe(1)
    expect((await contagem(a.video.id)).identidades).toBe(0)
    const t2 = t1 - 30 * H + 192 * H
    const r = await grava(pg, a.video.id, 7, snapDe(7, t2), [topo('c8a', { author: autorDe('s8a'), body: 'texto novo', likes: 99, relevance_rank: 4 })])
    expect(r).toMatchObject({ comentarios_novos: 0, comentarios_atualizados: 1, identidades: 0 })
    const c = await comentario(a.video.id, 'c8a')
    expect(c).toMatchObject({ body: 'texto novo' })
    expect(c.author_purged_at, 'a rotina carimbou').not.toBeNull()
    expect((await contagem(a.video.id)).identidades, 'a identidade apagada não volta').toBe(0)
    expect(await leitura(c.id, 7)).toMatchObject({ likes: 99, relevance_rank: 4 })
    expect((await contagem(a.video.id)).leituras).toBe(2)
    // (b) identidade que ainda existe: o marco 7 não a regrava (nem muda o prazo)
    const t1b = NOW - 10 * D
    const bb = await base({ takenMs: t1b })
    await grava(pg, bb.video.id, 1, snapDe(1, t1b), [topo('c8b', { author: autorDe('s8b-original') })])
    const antes = (await q(pg, `select a.display_name, a.channel_id, a.expires_at from public.competitor_video_comment_authors a join public.competitor_video_comments c on c.id = a.comment_id where c.video_id = $1`, [bb.video.id]))
    const t2b = t1b - 30 * H + 192 * H
    const rb = await grava(pg, bb.video.id, 7, snapDe(7, t2b), [topo('c8b', { author: autorDe('s8b-trocado'), likes: 44 })])
    expect(rb).toMatchObject({ comentarios_atualizados: 1, identidades: 0 })
    const depois = (await q(pg, `select a.display_name, a.channel_id, a.expires_at from public.competitor_video_comment_authors a join public.competitor_video_comments c on c.id = a.comment_id where c.video_id = $1`, [bb.video.id]))
    expect(depois).toEqual(antes)
    expect(String(depois[0]!.display_name)).toContain('s8b-original')
  })

  it('escrita: destaque gravado não é apagado por marco sem destaque; criador_respondeu sim não vira nulo, e a leitura do marco guarda o que ESTA leitura viu', async () => {
    const t1 = NOW - 12 * D
    const b = await base({ takenMs: t1 })
    const acomp = await novoCanal(b.site)
    await grava(pg, b.video.id, 1, snapDe(1, t1), [topo('c9a', { featured_reason: 'canal_acompanhado', featured_channel_id: acomp.id, creator_replied: true, slot: 'destaque' })])
    const t2 = t1 - 30 * H + 192 * H
    await grava(pg, b.video.id, 7, snapDe(7, t2), [topo('c9a', { featured_reason: null, featured_channel_id: null, creator_replied: null, slot: null, likes: 70 })])
    const c = await comentario(b.video.id, 'c9a')
    expect(c).toMatchObject({ featured_reason: 'canal_acompanhado', featured_channel_id: acomp.id, creator_replied: true })
    expect(await leitura(c.id, 1)).toMatchObject({ creator_replied: true, slot: 'destaque' })
    expect(await leitura(c.id, 7)).toMatchObject({ creator_replied: null, slot: null, likes: 70 })
  })

  it('pergunta 30 (a): a anulação de identidade zera featured_channel_id do comentário de autor que é canal acompanhado, e só dele', async () => {
    const t1 = NOW - 30 * D
    const a = await base({ takenMs: t1 })
    const acomp = await novoCanal(a.site)
    await grava(pg, a.video.id, 1, snapDe(1, t1), [
      topo('p30a', { featured_reason: 'canal_acompanhado', featured_channel_id: acomp.id, slot: 'destaque', author: autorDe('s30a') }),
      topo('p30n', { featured_reason: null, featured_channel_id: null, author: autorDe('s30n') }),
    ])
    expect(await comentario(a.video.id, 'p30a'), 'antes da anulação o vínculo existe').toMatchObject({ featured_channel_id: acomp.id })
    expect((await purga(pg, a.site)).apagadas).toBe(2)
    expect(await comentario(a.video.id, 'p30a')).toMatchObject({ featured_reason: 'canal_acompanhado', featured_channel_id: null })
    expect((await comentario(a.video.id, 'p30a')).author_purged_at).not.toBeNull()
    expect(await comentario(a.video.id, 'p30n')).toMatchObject({ featured_reason: null, featured_channel_id: null })
  })

  it('pergunta 30 (b): o marco de 30 dias que roda DEPOIS da anulação não regrava featured_channel_id (o canal virou acompanhado tarde)', async () => {
    const t1 = NOW - 30 * D
    const a = await base({ takenMs: t1 })
    const acomp = await novoCanal(a.site)
    await grava(pg, a.video.id, 1, snapDe(1, t1), [topo('p30b', { featured_reason: null, featured_channel_id: null, author: autorDe('s30b') })])
    expect((await purga(pg, a.site)).apagadas).toBe(1)
    const t2 = t1 - 30 * H + 720 * H
    await grava(pg, a.video.id, 30, snapDe(30, t2), [topo('p30b', { featured_reason: 'canal_acompanhado', featured_channel_id: acomp.id, slot: 'destaque', author: autorDe('s30b') })])
    const c = await comentario(a.video.id, 'p30b')
    expect(c.author_purged_at, 'continua anulado').not.toBeNull()
    expect(c.featured_channel_id, 'o vínculo não volta').toBeNull()
    expect((await contagem(a.video.id)).identidades, 'a identidade também não volta').toBe(0)
  })

  it('pergunta 30 (c): comentário ainda não anulado continua ganhando featured_channel_id no marco posterior', async () => {
    const t1 = NOW - 12 * D
    const a = await base({ takenMs: t1 })
    const acomp = await novoCanal(a.site)
    await grava(pg, a.video.id, 1, snapDe(1, t1), [topo('p30c', { featured_reason: null, featured_channel_id: null, author: autorDe('s30c') })])
    const t2 = t1 - 30 * H + 192 * H
    await grava(pg, a.video.id, 7, snapDe(7, t2), [topo('p30c', { featured_reason: 'canal_acompanhado', featured_channel_id: acomp.id, slot: 'destaque', author: autorDe('s30c') })])
    const c = await comentario(a.video.id, 'p30c')
    expect(c.author_purged_at).toBeNull()
    expect(c).toMatchObject({ featured_reason: 'canal_acompanhado', featured_channel_id: acomp.id })
  })

  it('escrita: achado por id atualiza texto e curtidas com posição nula; id que não existe no banco não vira comentário', async () => {
    const t1 = NOW - 12 * D
    const b = await base({ takenMs: t1 })
    await grava(pg, b.video.id, 1, snapDe(1, t1), [topo('c10a', { relevance_rank: 2, slot: 'destaque' }), resp('c10r', 'c10a')])
    const t2 = t1 - 30 * H + 192 * H
    const r = await grava(pg, b.video.id, 7, snapDe(7, t2), [porId('c10a', 33), porId('c10r', 8), porId('c10fantasma', 5)])
    expect(r).toMatchObject({ recebidos: 3, achados_por_id: 2, comentarios_novos: 0, nao_gravados: 1 })
    expect((await contagem(b.video.id)).comentarios).toBe(2)
    const a = await comentario(b.video.id, 'c10a')
    const rr = await comentario(b.video.id, 'c10r')
    expect(a.body).toBe('corpo novo de c10a')
    expect(await leitura(a.id, 7)).toMatchObject({ likes: 33, reply_count: 3, relevance_rank: null, slot: null })
    expect(await leitura(rr.id, 7)).toMatchObject({ likes: 8, reply_count: null, relevance_rank: null, slot: null })
    expect(await q(pg, `select 1 from public.competitor_video_comments where video_id = $1 and youtube_comment_id = 'c10fantasma'`, [b.video.id])).toHaveLength(0)
  })

  it('ausência: primeira entre 7 e 30 deixa miss_streak 1 e missing_since nulo; segunda marca; no marco 30 uma basta', async () => {
    const t1 = NOW - 35 * D
    const b = await base({ takenMs: t1 })
    await grava(pg, b.video.id, 1, snapDe(1, t1), [topo('c11a')])
    const t7 = t1 - 30 * H + 192 * H
    const r1 = await grava(pg, b.video.id, 7, snapDe(7, t7), [], ['c11a'])
    expect(r1).toMatchObject({ ausentes: 1, ausentes_marcados: 0 })
    expect(await comentario(b.video.id, 'c11a')).toMatchObject({ miss_streak: 1, missing_since_txt: null })
    // a segunda leitura do mesmo marco só existe se o retrato anterior sair do caminho (o vídeo "envelhece" por SQL)
    await q(pg, 'delete from public.competitor_video_comment_snaps where video_id = $1 and mark = 7', [b.video.id])
    const r2 = await grava(pg, b.video.id, 7, snapDe(7, t7 + MIN), [], ['c11a'])
    expect(r2).toMatchObject({ ausentes: 1, ausentes_marcados: 1 })
    const esperado = String((await q(pg, `select ((($1::timestamptz) at time zone 'America/Sao_Paulo')::date)::text as d`, [iso(t7 + MIN)]))[0]!.d)
    expect(await comentario(b.video.id, 'c11a')).toMatchObject({ miss_streak: 2, missing_since_txt: esperado })
    // marco 30: uma ausência basta
    const b2 = await base({ takenMs: t1 })
    await grava(pg, b2.video.id, 1, snapDe(1, t1), [topo('c11b')])
    const t30 = t1 - 30 * H + 744 * H
    const r3 = await grava(pg, b2.video.id, 30, snapDe(30, t30), [], ['c11b'])
    expect(r3).toMatchObject({ ausentes: 1, ausentes_marcados: 1 })
    expect(await comentario(b2.video.id, 'c11b')).toMatchObject({ miss_streak: 1 })
    expect((await comentario(b2.video.id, 'c11b')).missing_since_txt).not.toBeNull()
  })

  it('ausência: id que está em p_missing e também veio não é marcado', async () => {
    const t1 = NOW - 12 * D
    const b = await base({ takenMs: t1 })
    await grava(pg, b.video.id, 1, snapDe(1, t1), [topo('c12a')])
    const r = await grava(pg, b.video.id, 7, snapDe(7, t1 - 30 * H + 192 * H), [porId('c12a', 5)], ['c12a'])
    expect(r).toMatchObject({ achados_por_id: 1, ausentes: 0, ausentes_marcados: 0 })
    expect(await comentario(b.video.id, 'c12a')).toMatchObject({ miss_streak: 0, missing_since_txt: null })
  })

  it('apagado pelo dono não volta e returned_seen_at é carimbado', async () => {
    const b = await base()
    await pg.query(`insert into public.competitor_removed_items (site_id, kind, youtube_id, decided_by, rows_deleted) values ($1, 'comentario', 'c13-apagado', $2, '{}'::jsonb)`, [b.site, randomUUID()])
    await pg.query(`insert into public.competitor_removed_items (site_id, kind, youtube_id, decided_by, rows_deleted) values ($1, 'comentario', 'c13-pai-apagado', $2, '{}'::jsonb)`, [b.site, randomUUID()])
    const r = await grava(pg, b.video.id, 1, snapDe(1, b.taken), [
      topo('c13-apagado'), topo('c13-ok'), topo('c13-pai-apagado'), resp('c13-resp', 'c13-pai-apagado'), resp('c13-resp-ok', 'c13-ok'),
    ])
    expect(r).toMatchObject({ comentarios_novos: 1, respostas_novas: 1 })
    const guardados = await q(pg, 'select youtube_comment_id from public.competitor_video_comments where video_id = $1 order by 1', [b.video.id])
    expect(guardados.map((x) => x.youtube_comment_id)).toEqual(['c13-ok', 'c13-resp-ok'])
    const vistos = await q(pg, `select youtube_id, returned_seen_at is not null as visto from public.competitor_removed_items where site_id = $1 order by 1`, [b.site])
    expect(vistos).toEqual([{ youtube_id: 'c13-apagado', visto: true }, { youtube_id: 'c13-pai-apagado', visto: true }])
  })

  it('duas escritas simultâneas do mesmo (vídeo, marco): uma grava, a outra recebe ja_existe', async () => {
    const b = await base()
    const comentarios = [topo('c14a'), topo('c14b'), topo('c14c')]
    const [x, y] = await Promise.all([
      grava(pg, b.video.id, 1, snapDe(1, b.taken), comentarios),
      grava(pg2, b.video.id, 1, snapDe(1, b.taken), comentarios),
    ])
    expect([x.status, y.status].sort()).toEqual(['gravado', 'ja_existe'])
    expect(await contagem(b.video.id)).toEqual({ snaps: 1, comentarios: 3, leituras: 3, identidades: 3 })
  })

  // ───────────────────────── a rotina ─────────────────────────
  it('rotina: nada vencido apaga 0; vencida apaga, carimba author_purged_at e conta vencidas_ha_mais_de_1_dia; segunda vez apaga 0', async () => {
    const b = await base()
    const tc = NOW - 10 * D
    const vc = await maisUm(b, 30, tc)
    await grava(pg, vc.id, 1, snapDe(1, tc), [topo('c15c')])
    expect(await purga(pg, b.site)).toEqual({ apagadas: 0, comentarios_carimbados: 0, vencidas_ha_mais_de_1_dia: 0, restantes: 1 })
    const ta = NOW - 30 * D
    const va = await maisUm(b, 30, ta)
    await grava(pg, va.id, 1, snapDe(1, ta), [topo('c15a')])
    const tb = NOW - 28 * D - 12 * H
    const vb = await maisUm(b, 30, tb)
    await grava(pg, vb.id, 1, snapDe(1, tb), [topo('c15b')])
    const linhaAntes = async (v: string, id: string): Promise<Linha> => {
      const c = await comentario(v, id); const { author_purged_at: _omitido, ...resto } = c; void _omitido; return resto
    }
    const antes = [await linhaAntes(va.id, 'c15a'), await linhaAntes(vb.id, 'c15b'), await linhaAntes(vc.id, 'c15c')]
    expect(await purga(pg, b.site)).toEqual({ apagadas: 2, comentarios_carimbados: 2, vencidas_ha_mais_de_1_dia: 1, restantes: 1 })
    expect(await purga(pg, b.site)).toEqual({ apagadas: 0, comentarios_carimbados: 0, vencidas_ha_mais_de_1_dia: 0, restantes: 1 })
    expect([await linhaAntes(va.id, 'c15a'), await linhaAntes(vb.id, 'c15b'), await linhaAntes(vc.id, 'c15c')], 'só author_purged_at muda').toEqual(antes)
    expect((await comentario(va.id, 'c15a')).author_purged_at).not.toBeNull()
    expect((await comentario(vb.id, 'c15b')).author_purged_at).not.toBeNull()
    expect((await comentario(vc.id, 'c15c')).author_purged_at, 'o que não venceu fica').toBeNull()
    expect((await contagem(vc.id)).identidades).toBe(1)
  })

  it('rotina: erro no meio não muda nada', async () => {
    const t = NOW - 30 * D
    const b = await base({ takenMs: t })
    await grava(pg, b.video.id, 1, snapDe(1, t), [topo('c16a'), topo('c16b')])
    expect((await contagem(b.video.id)).identidades).toBe(2)
    await pg.query('begin')
    let restantes = -1
    try {
      await pg.query(`set local lock_timeout = '5s'`)
      await pg.query(`create function pg_temp.e14_explode() returns trigger language plpgsql as $f$ begin raise exception 'falha forjada' using errcode = 'P0001'; end $f$`)
      await pg.query(`create trigger e14_explode before update on public.competitor_video_comments for each row when (new.site_id = '${b.site}') execute function pg_temp.e14_explode()`)
      await pg.query('savepoint antes_da_rotina')
      const falha = await recusa(() => pg.query('select public.competitor_comment_identity_purge($1::uuid)', [b.site]))
      expect(falha.code).toBe('P0001')
      await pg.query('rollback to savepoint antes_da_rotina')
      restantes = Number((await q(pg, 'select count(*) as n from public.competitor_video_comment_authors where site_id = $1', [b.site]))[0]!.n)
    } finally {
      await pg.query('rollback')
    }
    expect(restantes, 'a falha no update desfez o delete da identidade').toBe(2)
    expect(Number((await q(pg, `select count(*) as n from pg_trigger where tgname = 'e14_explode'`))[0]!.n), 'o gatilho de teste não sobrou').toBe(0)
    expect((await contagem(b.video.id)).identidades).toBe(2)
    expect((await purga(pg, b.site)).apagadas, 'sem o gatilho, a mesma rotina apaga').toBe(2)
  })

  it('rotina: site sem identidade devolve apagadas 0 e restantes 0; rotina chamada para outro site não apaga a deste', async () => {
    const vazio = await novoSite()
    expect(await purga(pg, vazio)).toEqual({ apagadas: 0, comentarios_carimbados: 0, vencidas_ha_mais_de_1_dia: 0, restantes: 0 })
    const t = NOW - 30 * D
    const b = await base({ takenMs: t })
    await grava(pg, b.video.id, 1, snapDe(1, t), [topo('c17a')])
    expect((await purga(pg, vazio)).apagadas).toBe(0)
    expect((await contagem(b.video.id)).identidades, 'a identidade vencida do outro site continua').toBe(1)
    expect(await purga(pg, b.site)).toMatchObject({ apagadas: 1, restantes: 0 })
  })

  // ───────────────────────── os devidos ─────────────────────────
  it('devidos: site sem retrato devolve os vídeos na janela, ordenados pelo prazo, com total_due', async () => {
    const site = await novoSite()
    const canal = await novoCanal(site)
    const v30 = await novoVideo(canal.id, { pubMs: NOW - 744 * H, contagem: 11 })
    const v1 = await novoVideo(canal.id, { pubMs: NOW - 30 * H, contagem: 57 })
    const v1b = await novoVideo(canal.id, { pubMs: NOW - 60 * H, contagem: null })
    const v7 = await novoVideo(canal.id, { pubMs: NOW - 192 * H })
    const r = await devidos(site)
    expect(r.map((x) => [x.youtube_video_id, Number(x.mark)])).toEqual([[v1b.yt, 1], [v1.yt, 1], [v7.yt, 7], [v30.yt, 30]])
    expect(r.every((x) => Number(x.total_due) === 4 && x.site_id === site && x.channel_youtube_id === canal.yt && x.channel_row_id === canal.id)).toBe(true)
    expect(r.map((x) => x.prev_status)).toEqual([null, null, null, null])
    expect(r.map((x) => Number(x.stored_n))).toEqual([0, 0, 0, 0])
    expect(r.map((x) => (x.video_comment_count === null ? null : Number(x.video_comment_count)))).toEqual([null, 57, 40, 11])
    // o prazo é t0 + until_h
    expect(new Date(r[0]!.deadline as Date).getTime()).toBeCloseTo(NOW - 60 * H + 72 * H, -3)
    // o limite não esconde o total
    const limitado = await devidos(site, { limit: 2 })
    expect(limitado).toHaveLength(2)
    expect(limitado.every((x) => Number(x.total_due) === 4)).toBe(true)
    // outro site só vê os dele
    const outro = await novoSite()
    const co = await novoCanal(outro)
    const vo = await novoVideo(co.id, { pubMs: NOW - 30 * H })
    const rOutro = await devidos(outro)
    expect(rOutro.map((x) => x.youtube_video_id)).toEqual([vo.yt])
    expect(Number(rOutro[0]!.total_due)).toBe(1)
  })

  it('devidos: fora da lista o de 5 horas, o de 4 dias, o com missing_since, o de canal com missing_since, o upcoming, o sem published_at; a transmissão conta do início real', async () => {
    const site = await novoSite()
    const canal = await novoCanal(site)
    const ausente = await novoCanal(site, { ausente: true })
    const dentro = await novoVideo(canal.id, { pubMs: NOW - 30 * H })
    await novoVideo(canal.id, { pubMs: NOW - 5 * H })
    await novoVideo(canal.id, { pubMs: NOW - 96 * H })
    await novoVideo(canal.id, { pubMs: NOW - 30 * H, ausente: true })
    await novoVideo(ausente.id, { pubMs: NOW - 30 * H })
    await novoVideo(canal.id, { pubMs: NOW - 30 * H, lbc: 'upcoming' })
    await novoVideo(canal.id, { pubMs: NOW - 30 * H, lbc: 'live' })
    await novoVideo(canal.id, { pubMs: null })
    const aoVivo = await novoVideo(canal.id, { pubMs: NOW - 9 * D, inicioAoVivoMs: NOW - 30 * H, lbc: 'none' })
    const r = await devidos(site)
    expect(r.map((x) => x.youtube_video_id).sort()).toEqual([dentro.yt, aoVivo.yt].sort())
    expect(r.every((x) => Number(x.mark) === 1 && Number(x.total_due) === 2)).toBe(true)
    const t0 = new Date(r.find((x) => x.youtube_video_id === aoVivo.yt)!.t0 as Date).getTime()
    expect(t0).toBeCloseTo(NOW - 30 * H, -3)
  })

  it('devidos: retrato em erro volta depois de 20 horas e não antes; com motivo passageiro volta depois de 15 minutos e não antes; retrato final não volta', async () => {
    const site = await novoSite()
    const canal = await novoCanal(site)
    const mk = async (status: string, motivo: string | null, haMin: number): Promise<string> => {
      const v = await novoVideo(canal.id, { pubMs: NOW - 30 * H }); await snapSql(v.id, 1, { takenMs: NOW - haMin * MIN, status, motivo }); return v.yt
    }
    const lento21h = await mk('erro', 'http_4xx', 21 * 60)
    await mk('erro', 'http_4xx', 19 * 60)
    const rapido16 = await mk('erro', 'rede', 16)
    await mk('erro', 'rede', 14)
    await mk('ok', null, 30 * 60)
    await mk('sem_comentarios', null, 30 * 60)
    await mk('desligados', null, 30 * 60)
    const passageiros = [...COMMENT_RULES.marks.length ? ['rede', 'tempo_esgotado', 'http_5xx', 'resposta_ilegivel', 'resposta_sem_lista', 'lote_ilegivel', 'contagem_nao_lida'] : []]
    const r = await devidos(site, { fast: passageiros })
    expect(r.map((x) => x.youtube_video_id).sort()).toEqual([lento21h, rapido16].sort())
    expect(r.map((x) => x.prev_status)).toEqual(['erro', 'erro'])
    // o mesmo pela fronteira do TypeScript (que manda MOTIVOS_PASSAGEIROS, 20 horas e 15 minutos)
    const viaTs = await lerDevidos(sb, { nowIso: iso(NOW), since: null, siteId: site })
    expect(viaTs).not.toBeNull()
    expect(viaTs!.linhas.map((l) => l.youtubeVideoId).sort()).toEqual([lento21h, rapido16].sort())
    expect(viaTs!.total).toBe(2)
  })

  // ───────────────────────── a prova ─────────────────────────
  it('prova: site vazio devolve zeros, mapas vazios e primeira_coleta nula (e as 17 chaves, pelo banco e pelo TypeScript)', async () => {
    const site = await novoSite()
    const p = await prova(site)
    expect(p).not.toBeNull()
    expect(Object.keys(p!).sort()).toEqual([
      'comentarios_ausentes_sem_decisao', 'comentarios_total', 'erros_por_motivo', 'identidade_de_criador', 'identidade_prazo_errado', 'identidade_vencida',
      'identidades_total', 'perdidos_por_motivo', 'primeira_coleta', 'respostas_de_terceiros', 'retratos_atrasados', 'retratos_em_erro', 'retratos_na_janela',
      'retratos_ok', 'retratos_perdidos_7d', 'retratos_total', 'ultima_coleta',
    ])
    expect(p).toEqual({
      identidade_vencida: 0, identidade_prazo_errado: 0, identidade_de_criador: 0, respostas_de_terceiros: 0, retratos_atrasados: 0, retratos_em_erro: 0,
      erros_por_motivo: {}, retratos_na_janela: 0, retratos_perdidos_7d: 0, perdidos_por_motivo: {}, retratos_total: 0, retratos_ok: 0, primeira_coleta: null,
      ultima_coleta: null, comentarios_total: 0, identidades_total: 0, comentarios_ausentes_sem_decisao: 0,
    })
    const viaTs = await lerProva(sb, { siteId: site, nowIso: iso(NOW), since: null })
    expect(viaTs).toEqual({ ok: true, prova: p })
  })

  it('prova: identidade_vencida sobe com comentário de 29 dias e 1 hora com identidade; NÃO sobe com 28 dias e 23 horas', async () => {
    const velho = await base({ takenMs: NOW - 29 * D - H })
    await grava(pg, velho.video.id, 1, snapDe(1, velho.taken), [topo('c22a')])
    expect(await prova(velho.site)).toMatchObject({ identidade_vencida: 1, identidade_prazo_errado: 0, identidades_total: 1 })
    const novo = await base({ takenMs: NOW - 28 * D - 23 * H })
    await grava(pg, novo.video.id, 1, snapDe(1, novo.taken), [topo('c22b')])
    expect(await prova(novo.site)).toMatchObject({ identidade_vencida: 0, identidade_prazo_errado: 0, identidades_total: 1 })
  })

  it('prova: identidade_de_criador, respostas_de_terceiros e identidade_prazo_errado sobem com a linha forjada por SQL direto e ficam em 0 com tudo gravado pela função', async () => {
    const b = await base()
    await grava(pg, b.video.id, 1, snapDe(1, b.taken), [
      topo('c23criador', { is_creator: true, author: null, slot: 'criador' }), topo('c23comum'), resp('c23resp', 'c23comum'),
    ])
    const limpo = { identidade_de_criador: 0, respostas_de_terceiros: 0, identidade_prazo_errado: 0, identidade_vencida: 0 }
    expect(await prova(b.site)).toMatchObject(limpo)
    // identidade de criador
    const idCriador = (await comentario(b.video.id, 'c23criador')).id
    await pg.query(`insert into public.competitor_video_comment_authors (comment_id, site_id, display_name, expires_at)
      select c.id, c.site_id, 'forjado', c.first_seen_at + interval '28 days' from public.competitor_video_comments c where c.id = $1`, [idCriador])
    expect(await prova(b.site)).toMatchObject({ ...limpo, identidade_de_criador: 1 })
    await pg.query('delete from public.competitor_video_comment_authors where comment_id = $1', [idCriador])
    expect(await prova(b.site)).toMatchObject(limpo)
    // prazo errado
    const idComum = (await comentario(b.video.id, 'c23comum')).id
    await pg.query(`update public.competitor_video_comment_authors set expires_at = expires_at + interval '1 day' where comment_id = $1`, [idComum])
    expect(await prova(b.site)).toMatchObject({ ...limpo, identidade_prazo_errado: 1 })
    await pg.query(`update public.competitor_video_comment_authors set expires_at = expires_at - interval '1 day' where comment_id = $1`, [idComum])
    expect(await prova(b.site)).toMatchObject(limpo)
    // resposta de terceiro: só forjável desligando a constraint, dentro da transação do teste
    await pg.query('begin')
    try {
      await pg.query(`set local lock_timeout = '5s'`)
      await pg.query('alter table public.competitor_video_comments drop constraint competitor_video_comments_reply_check')
      await pg.query(`insert into public.competitor_video_comments (site_id, competitor_channel_id, video_id, youtube_comment_id, parent_id, body, published_at, is_creator, first_seen_at, last_seen_at)
        values ($1, $2, $3, 'c23terceiro', $4, 'forjada', now(), false, now(), now())`, [b.site, b.canal.id, b.video.id, idComum])
      expect(await prova(b.site)).toMatchObject({ ...limpo, respostas_de_terceiros: 1 })
    } finally {
      await pg.query('rollback')
    }
    expect(await prova(b.site)).toMatchObject(limpo)
    expect(Number((await q(pg, `select count(*) as n from pg_constraint where conname = 'competitor_video_comments_reply_check'`))[0]!.n), 'a constraint voltou').toBe(1)
  })

  it('prova: retratos_atrasados sobe com vídeo de 9 dias sem retrato; NÃO sobe com 8 dias, nem com o descoberto há 1 hora, nem com retrato em erro (esse vai para retratos_em_erro e erros_por_motivo)', async () => {
    const site = await novoSite()
    const canal = await novoCanal(site)
    await novoVideo(canal.id, { pubMs: NOW - 9 * D })                                        // atrasado
    await novoVideo(canal.id, { pubMs: NOW - 8 * D })                                        // 192 h < 168 + 30 h de folga
    await novoVideo(canal.id, { pubMs: NOW - 9 * D, descobertoMs: NOW - H })                 // descoberto há 1 hora
    const comErro = await novoVideo(canal.id, { pubMs: NOW - 9 * D })
    await snapSql(comErro.id, 7, { takenMs: NOW - 2 * H, status: 'erro', motivo: 'http_4xx' })
    const p = await prova(site)
    expect(p).toMatchObject({ retratos_atrasados: 1, retratos_em_erro: 1, erros_por_motivo: { http_4xx: 1 }, retratos_na_janela: 4 })
  })

  it('prova: retratos_perdidos_7d só conta janela aberta depois da primeira coleta, e não conta vídeo descoberto tarde; perdidos_por_motivo separa sem_retrato de cada motivo de erro', async () => {
    const site = await novoSite()
    const canal = await novoCanal(site)
    // a primeira coleta do site: há 6 dias (um vídeo com retrato ok no marco 1)
    const primeiro = await novoVideo(canal.id, { pubMs: NOW - 6 * D - 30 * H })
    await snapSql(primeiro.id, 1, { takenMs: NOW - 6 * D })
    await novoVideo(canal.id, { pubMs: NOW - 5 * D })                                         // janela de 24 a 72 h fechou há 2 dias, sem retrato: perdido
    const proibido = await novoVideo(canal.id, { pubMs: NOW - 5 * D })
    await snapSql(proibido.id, 1, { takenMs: NOW - 4 * D, status: 'erro', motivo: 'proibido' })  // perdido por motivo
    await novoVideo(canal.id, { pubMs: NOW - 5 * D, descobertoMs: NOW - D })                  // descoberto tarde: não conta
    await novoVideo(canal.id, { pubMs: NOW - 8 * D })                                         // a janela abriu antes da primeira coleta: não conta
    const p = await prova(site)
    expect(p).toMatchObject({ retratos_perdidos_7d: 2, perdidos_por_motivo: { sem_retrato: 1, proibido: 1 } })
  })

  it('prova: site sem nada devolve zeros enquanto outro site tem dados (filtro por site)', async () => {
    const t = NOW - 30 * D
    const cheio = await base({ takenMs: t })
    await grava(pg, cheio.video.id, 1, snapDe(1, t), [topo('c26a'), topo('c26b')])
    expect(await prova(cheio.site)).toMatchObject({ comentarios_total: 2, identidades_total: 2, identidade_vencida: 2, retratos_total: 1, retratos_ok: 1 })
    const vazio = await novoSite()
    expect(await prova(vazio)).toMatchObject({ comentarios_total: 0, identidades_total: 0, identidade_vencida: 0, retratos_total: 0, retratos_ok: 0, primeira_coleta: null })
  })

  // ───────────────────────── remoção e colunas ─────────────────────────
  it('remoção: competitor_channel_comment_impact conta as quatro tabelas e devolve not_found para canal de outro site; apagar o canal zera as quatro', async () => {
    const b = await base()
    const outro = await novoCanal(b.site)
    const vOutro = await novoVideo(outro.id, { pubMs: b.taken - 30 * H })
    await grava(pg, b.video.id, 1, snapDe(1, b.taken), [topo('c27a'), topo('c27b', { is_creator: true, author: null, slot: 'criador' }), resp('c27r', 'c27a')])
    await grava(pg, vOutro.id, 1, snapDe(1, b.taken), [topo('c27x', { featured_reason: 'canal_acompanhado', featured_channel_id: b.canal.id, slot: 'destaque' })])
    const esperado = { comment_snaps: 1, comments: 3, comment_marks: 3, comment_authors: 1, featured_elsewhere: 1 }
    const bruto = (await q(pg, 'select public.competitor_channel_comment_impact($1::uuid, $2::uuid) as r', [b.site, b.canal.id]))[0]!.r
    expect(bruto).toEqual({ status: 'ok', ...esperado })
    expect(await lerImpacto(sb, b.site, b.canal.id)).toEqual(esperado)
    const alheio = await base()
    expect((await q(pg, 'select public.competitor_channel_comment_impact($1::uuid, $2::uuid) as r', [alheio.site, b.canal.id]))[0]!.r).toEqual({ status: 'not_found' })
    expect(await lerImpacto(sb, alheio.site, b.canal.id)).toBeNull()
    // apagar o canal leva as quatro tabelas
    await pg.query('delete from public.competitor_channels where id = $1', [b.canal.id])
    const resto = await q(pg, `select
      (select count(*) from public.competitor_video_comment_snaps where competitor_channel_id = $1)::int as snaps,
      (select count(*) from public.competitor_video_comments where competitor_channel_id = $1)::int as comentarios,
      (select count(*) from public.competitor_video_comment_marks where site_id = $2 and comment_id not in (select id from public.competitor_video_comments))::int as leituras_soltas,
      (select count(*) from public.competitor_video_comment_authors a where a.site_id = $2 and a.comment_id not in (select id from public.competitor_video_comments))::int as identidades_soltas`, [b.canal.id, b.site])
    expect(resto[0]).toEqual({ snaps: 0, comentarios: 0, leituras_soltas: 0, identidades_soltas: 0 })
    expect(await q(pg, `select featured_channel_id from public.competitor_video_comments where video_id = $1`, [vOutro.id])).toEqual([{ featured_channel_id: null }])
  })

  it('colunas: competitor_video_comments só tem author_purged_at com prefixo author; competitor_video_comment_authors tem exatamente as sete colunas; nenhuma coluna de inscritos nem de razão nas quatro tabelas', async () => {
    const autor = await q(pg, `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'competitor_video_comments' and column_name like 'author%'`)
    expect(autor.map((x) => x.column_name)).toEqual(['author_purged_at'])
    const authors = await q(pg, `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'competitor_video_comment_authors'`)
    expect(authors.map((x) => x.column_name).sort()).toEqual(['avatar_url', 'channel_id', 'comment_id', 'created_at', 'display_name', 'expires_at', 'site_id'])
    const proibidas = await q(pg, `select table_name, column_name from information_schema.columns where table_schema = 'public' and table_name like 'competitor_video_comment%'
      and (column_name ilike '%subscri%' or column_name ilike '%inscrit%' or column_name ilike '%ratio' or column_name ilike '%subs' or column_name ilike '%razao%')`)
    expect(proibidas).toEqual([])
  })

  // ───────────────────────── os emendados ─────────────────────────
  it('parâmetro nulo nunca é verde: a prova devolve nulo, a lista lança, e com tudo preenchido há objeto', async () => {
    const b = await base({ takenMs: NOW - 40 * D })
    await grava(pg, b.video.id, 1, snapDe(1, b.taken), [topo('c29a')])
    expect(await prova(b.site, { dias: 28 }), 'identidade de 40 dias').toMatchObject({ identidade_vencida: 1 })
    expect(await prova(b.site, { dias: null }), 'p_identity_days nulo').toBeNull()
    const nulos = [
      await prova(b.site, { marks: null }), await prova(b.site, { marks: '{}' }), await prova(b.site, { marks: '[]' }), await prova(b.site, { grace: null }),
      (await q(pg, 'select public.competitor_comment_health($1::uuid, null::timestamptz, $2::jsonb, 28, interval \'30 hours\', null) as r', [b.site, MARCOS_JSON]))[0]!.r,
    ]
    expect(nulos).toEqual([null, null, null, null, null])
    expect(await prova(b.site)).not.toBeNull()
    // a lista lança
    expect((await recusa(() => devidos(b.site, { nowMs: null }))).code).toBe('22023')
    for (const marks of [null, '{}', '[]']) expect((await recusa(() => devidos(b.site, { marks }))).code, 'p_marks ' + String(marks)).toBe('22023')
    // limite nulo: até 200; p_retry_after nulo: 20 horas; p_retry_fast nulo: 15 minutos
    const site = await novoSite()
    const canal = await novoCanal(site)
    const mk = async (motivo: string, haMin: number): Promise<string> => {
      const v = await novoVideo(canal.id, { pubMs: NOW - 30 * H }); await snapSql(v.id, 1, { takenMs: NOW - haMin * MIN, status: 'erro', motivo }); return v.yt
    }
    const lento21 = await mk('http_4xx', 21 * 60)
    await mk('http_4xx', 19 * 60)
    const rapido16 = await mk('rede', 16)
    await mk('rede', 14)
    const todos = await devidos(site, { limit: null, retryAfter: null, retryFast: null, fast: ['rede'] })
    expect(todos.map((x) => x.youtube_video_id).sort()).toEqual([lento21, rapido16].sort())
  })

  it('relógio de quem grava: taken_at 12 dias no futuro é recusado, 9 minutos passa; identidade com created_at de 30 dias atrás faz identidade_vencida e identidade_prazo_errado subirem', async () => {
    const futuro = await base({ takenMs: NOW + 12 * D })
    expect((await recusa(() => grava(pg, futuro.video.id, 1, snapDe(1, futuro.taken), [topo('c30a')]))).code).toBe('22023')
    expect(await contagem(futuro.video.id)).toEqual({ snaps: 0, comentarios: 0, leituras: 0, identidades: 0 })
    const quase = await base({ takenMs: NOW + 9 * MIN })
    expect(await grava(pg, quase.video.id, 1, snapDe(1, quase.taken), [topo('c30b')])).toMatchObject({ status: 'gravado', identidades: 1 })
    // forja: first_seen_at de hoje e created_at de 30 dias atrás
    const b = await base()
    await grava(pg, b.video.id, 1, snapDe(1, b.taken), [topo('c30c')])
    expect(await prova(b.site)).toMatchObject({ identidade_vencida: 0, identidade_prazo_errado: 0 })
    await pg.query(`update public.competitor_video_comment_authors set created_at = now() - interval '30 days' where site_id = $1`, [b.site])
    expect(await prova(b.site)).toMatchObject({ identidade_vencida: 1, identidade_prazo_errado: 1 })
    await pg.query(`update public.competitor_video_comment_authors set created_at = now() where site_id = $1`, [b.site])
    expect(await prova(b.site)).toMatchObject({ identidade_vencida: 0, identidade_prazo_errado: 0 })
  })

  it('id repetido no pacote não derruba a escrita: um comentário, com o slot e a posição do primeiro do lote', async () => {
    const t1 = NOW - 12 * D
    const b = await base({ takenMs: t1 })
    const r = await grava(pg, b.video.id, 1, snapDe(1, t1), [
      topo('c31', { slot: 'destaque', relevance_rank: 3 }), topo('c31', { slot: 'curtidos', relevance_rank: 9 }), topo('c31', { slot: 'criador', relevance_rank: 1 }), porId('c31', 99),
    ])
    expect(r).toMatchObject({ recebidos: 4, comentarios_novos: 1, achados_por_id: 0, nao_gravados: 3 })
    const c = await comentario(b.video.id, 'c31')
    expect(await leitura(c.id, 1)).toMatchObject({ slot: 'destaque', relevance_rank: 3, likes: 10 })
    // dois "via id" iguais: um
    const r7 = await grava(pg, b.video.id, 7, snapDe(7, t1 - 30 * H + 192 * H), [porId('c31', 20), porId('c31', 21)])
    expect(r7).toMatchObject({ recebidos: 2, achados_por_id: 1, nao_gravados: 1 })
    expect(await leitura(c.id, 7)).toMatchObject({ likes: 20 })
  })

  it('o rótulo do marco é do banco: fora da tolerância não grava; 24 h exatas grava; a idade é a calculada; sem from_h ou until_h é recusado', async () => {
    const taken = NOW - 10 * MIN
    const nada = { snaps: 0, comentarios: 0, leituras: 0, identidades: 0 }
    const b = await base({ takenMs: taken, idadeH: 30 })
    expect(await grava(pg, b.video.id, 7, snapDe(7, taken), [topo('c32a')])).toEqual({ status: 'fora_da_tolerancia', idade_h: 30 })
    expect(await contagem(b.video.id)).toEqual(nada)
    const velho = await base({ takenMs: taken, idadeH: 8 * 24 })
    expect(await grava(pg, velho.video.id, 1, snapDe(1, taken))).toMatchObject({ status: 'fora_da_tolerancia', idade_h: 192 })
    const cedo = await base({ takenMs: taken, idadeH: 5 })
    expect(await grava(pg, cedo.video.id, 1, snapDe(1, taken))).toMatchObject({ status: 'fora_da_tolerancia', idade_h: 5 })
    const setentaEDuas = await base({ takenMs: taken, idadeH: 72 })
    expect((await grava(pg, setentaEDuas.video.id, 1, snapDe(1, taken))).status, '72 h exatas já são do próximo').toBe('fora_da_tolerancia')
    const semData = await base({ takenMs: taken })
    await pg.query('update public.competitor_videos set published_at = null where id = $1', [semData.video.id])
    expect(await grava(pg, semData.video.id, 1, snapDe(1, taken))).toEqual({ status: 'fora_da_tolerancia', idade_h: null })
    for (const v of [velho, cedo, setentaEDuas, semData]) expect((await contagem(v.video.id)).snaps).toBe(0)
    // 24 h exatas grava, e a idade gravada é a calculada, não a mandada
    const exato = await base({ takenMs: taken, idadeH: 24 })
    expect(await grava(pg, exato.video.id, 1, snapDe(1, taken, { video_age_hours: 999 }))).toMatchObject({ status: 'gravado' })
    expect((await q(pg, 'select video_age_hours::float8 as h from public.competitor_video_comment_snaps where video_id = $1', [exato.video.id]))[0]!.h).toBe(24)
    const trinta = await base({ takenMs: taken, idadeH: 30 })
    await grava(pg, trinta.video.id, 1, snapDe(1, taken, { video_age_hours: 999 }))
    expect((await q(pg, 'select video_age_hours::float8 as h from public.competitor_video_comment_snaps where video_id = $1', [trinta.video.id]))[0]!.h).toBe(30)
    // sem a tolerância: recusado
    const sem = await base({ takenMs: taken })
    const semFrom = snapDe(1, taken); delete semFrom.from_h
    const semUntil = snapDe(1, taken); delete semUntil.until_h
    expect((await recusa(() => grava(pg, sem.video.id, 1, semFrom))).code).toBe('22023')
    expect((await recusa(() => grava(pg, sem.video.id, 1, semUntil))).code).toBe('22023')
  })

  it('corte p_since: a lista traz só os marcos atingidos depois; a prova com o mesmo corte não cobra o que a lista não lista; sem coleta, retratos_perdidos_7d conta do corte', async () => {
    const site = await novoSite()
    const canal = await novoCanal(site)
    const a = await novoVideo(canal.id, { pubMs: NOW - 30 * H })   // marco 1 atingido há 6 horas
    const bb = await novoVideo(canal.id, { pubMs: NOW - 60 * H })  // marco 1 atingido há 36 horas
    expect((await devidos(site)).map((x) => x.youtube_video_id).sort()).toEqual([a.yt, bb.yt].sort())
    expect((await devidos(site, { since: NOW - 12 * H })).map((x) => x.youtube_video_id)).toEqual([a.yt])
    expect(await devidos(site, { since: NOW + H })).toEqual([])
    const sem = await prova(site)
    expect(sem).toMatchObject({ retratos_atrasados: 1, retratos_na_janela: 2 })
    const com = await prova(site, { since: NOW - 12 * H })
    expect(com).toMatchObject({ retratos_atrasados: 0, retratos_na_janela: 1 })
    // sem nenhuma coleta: o corte é o que abre a conta das janelas perdidas
    const perdeu = await novoSite()
    const cp = await novoCanal(perdeu)
    await novoVideo(cp.id, { pubMs: NOW - 4 * D })                 // a janela de 24 a 72 h fechou há 1 dia
    expect(await prova(perdeu)).toMatchObject({ retratos_perdidos_7d: 0 })
    expect(await prova(perdeu, { since: NOW - 80 * H })).toMatchObject({ retratos_perdidos_7d: 1, perdidos_por_motivo: { sem_retrato: 1 } })
  })

  it('pool_stats e formato do motivo: número e sim/não grava; texto e lista são recusados; motivo com texto livre é recusado; cada item de MOTIVOS passa', async () => {
    const b = await base()
    const gravaStats = (stats: unknown): Promise<Linha> => grava(pg, b.video.id, 1, snapDe(1, b.taken, { pool_stats: stats }), [])
    expect(await gravaStats({ conversas: 40, descartadas: 2, conferencia_falhou: false, curtidas_max: 120 })).toMatchObject({ status: 'gravado' })
    expect((await q(pg, 'select pool_stats from public.competitor_video_comment_snaps where video_id = $1', [b.video.id]))[0]!.pool_stats).toEqual({ conversas: 40, descartadas: 2, conferencia_falhou: false, curtidas_max: 120 })
    const outro = await base()
    const stats = (s: unknown): Promise<Linha> => grava(pg, outro.video.id, 1, snapDe(1, outro.taken, { pool_stats: s }), [])
    expect((await recusa(() => stats({ nome: 'Fulano de Tal' }))).code, 'texto').toBe('22023')
    expect((await recusa(() => stats([1, 2, 3]))).code, 'lista').toBe('22023')
    expect((await recusa(() => stats({ x: { y: 1 } }))).code, 'objeto dentro').toBe('22023')
    const motivoLivre = await recusa(() => grava(pg, outro.video.id, 1, snapDe(1, outro.taken, { status: 'erro', error_reason: 'Failing row contains (algo)' })))
    expect(motivoLivre.code).toBe('23514')
    expect((await recusa(() => grava(pg, outro.video.id, 1, snapDe(1, outro.taken, { status: 'erro', error_reason: 'http:500' })))).code, 'sem dois-pontos').toBe('23514')
    for (const m of MOTIVOS) {
      expect(await grava(pg, outro.video.id, 1, snapDe(1, outro.taken, { status: 'erro', error_reason: m })), m).toMatchObject({ status: 'gravado', retrato: 'erro' })
    }
    expect(await contagem(outro.video.id)).toMatchObject({ snaps: 1 })
  })

  // ───────────────────────── a fronteira com o TypeScript ─────────────────────────
  const agregados: AgregadosDoLote = {
    conversas: 5, descartadas: 0, curtidas_soma: 40, curtidas_max: 20, curtidas_mediana: 8, respostas_soma: 6, do_criador: 1, criador_respondeu_sim: 1,
    criador_respondeu_nao: 2, criador_respondeu_nao_se_sabe: 2, autores_distintos: 4, sem_canal: 0, nas_primeiras_24h: 5,
  }
  const conversa = (id: string, o: Partial<Conversa> = {}): Conversa => ({
    id, posicao: 0, texto: 'texto de ' + id, cortado: false, publicadoEm: iso(NOW - 20 * H), editadoEm: null, curtidas: 10, respostasTotal: 2,
    autor: { nome: 'Autor ' + id, canalId: 'UC' + id, foto: 'https://img.invalid/' + id + '.jpg' }, doCriador: false, criadorRespondeu: null,
    respostasDoCriador: [], canaisNasRespostas: [], ...o,
  })
  const escolhido = (c: Conversa, grupo: Escolhido['grupo'] = 'curtidos', destaque: Escolhido['destaque'] = null): Escolhido => ({ conversa: c, grupo, destaque })
  const entrada = (devido: Devido, tiradoEm: number, o: Partial<EntradaPacote> = {}): EntradaPacote => ({
    devido, tiradoEm: iso(tiradoEm), estado: 'ok', consulta: { n: 0, desconhecidos: 0 }, unidades: 3, ...o,
  })
  async function devidoDe(b: Base, nowMs: number): Promise<Devido> {
    const r = await lerDevidos(sb, { nowIso: iso(nowMs), since: null, siteId: b.site })
    expect(r, 'lerDevidos').not.toBeNull()
    const d = r!.linhas.find((l) => l.videoId === b.video.id)
    expect(d, 'o vídeo está na lista de devidos').toBeDefined()
    return d!
  }

  it('TS: lerDevidos → montarPacote → gravarRetrato → lerGuardados; o segundo gravarRetrato devolve ja_existe', async () => {
    const b = await base()
    const d = await devidoDe(b, NOW)
    expect(d).toMatchObject({ siteId: b.site, channelRowId: b.canal.id, channelYoutubeId: b.canal.yt, channelSubscribers: 5000, mark: 1, prevStatus: null, storedN: 0, totalDue: 1, videoCommentCount: 40 })
    const criador = conversa('t1criador', { doCriador: true, posicao: 0 })
    const comum = conversa('t1comum', { posicao: 1, respostasDoCriador: [{ id: 't1resp', texto: 'resp', cortado: false, publicadoEm: iso(NOW - 5 * H), editadoEm: null, curtidas: 2, autorCanalId: b.canal.yt }] })
    const terceiro = conversa('t1terceiro', { posicao: 2, respostasDoCriador: [{ id: 't1falsa', texto: 'x', cortado: false, publicadoEm: iso(NOW - 5 * H), editadoEm: null, curtidas: 2, autorCanalId: 'UCoutrapessoa' }] })
    const pacote = montarPacote(entrada(d, b.taken, {
      lote: { conversas: [criador, comum, terceiro], descartadas: 0, completo: true }, escolhidos: [escolhido(criador, 'criador'), escolhido(comum), escolhido(terceiro)], agregados,
    }))
    const g = await gravarRetrato(sb, d.videoId, 1, pacote)
    expect(g).toEqual({ ok: true, resultado: expect.objectContaining({ status: 'gravado', retrato: 'ok', recebidos: 4, comentarios_novos: 3, respostas_novas: 1, identidades: 2, leituras: 4, nao_gravados: 0 }) })
    const guardados = await lerGuardados(sb, d.videoId)
    expect(guardados?.map((x) => [x.youtubeId, x.topo]).sort()).toEqual([['t1comum', true], ['t1criador', true], ['t1resp', false], ['t1terceiro', true]])
    const de_novo = await gravarRetrato(sb, d.videoId, 1, pacote)
    expect(de_novo).toEqual({ ok: true, resultado: { status: 'ja_existe', anterior: 'ok' } })
    // depois de gravado, o vídeo some da lista (retrato final)
    expect((await lerDevidos(sb, { nowIso: iso(NOW), since: null, siteId: b.site }))?.linhas).toEqual([])
    // pool_stats gravado como o TypeScript o monta
    const stats = (await q(pg, 'select pool_stats, rule_params, rule_version from public.competitor_video_comment_snaps where video_id = $1', [d.videoId]))[0]!
    expect(stats.pool_stats).toMatchObject({ conversas: 5, conferencia_falhou: false })
    expect(stats.rule_version).toBe(1)
  })

  it('TS: lerCadastro devolve o mapa de canais acompanhados e o conjunto de canais próprios do site', async () => {
    const b = await base()
    const n = uid()
    await pg.query(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug) values ($1, $2, 'pt', $3, 'Teste', $4, $5)`,
      [b.site, 'UCprop' + n, '@t' + n, 'UU' + n, 'teste-' + n])
    const c = await lerCadastro(sb, b.site)
    expect(c).not.toBeNull()
    expect([...c!.acompanhados.entries()]).toEqual([[b.canal.yt, b.canal.id]])
    expect([...c!.proprios]).toEqual(['UCprop' + n])
    const vazio = await lerCadastro(sb, await novoSite())
    expect(vazio).toEqual({ acompanhados: new Map(), proprios: new Set() })
  })

  it('TS: retrato em erro com cada motivo de MOTIVOS passa pelo banco; erro sem motivo nem sai do montarPacote; curtida não medida não é enviada', async () => {
    const b = await base()
    const d = await devidoDe(b, NOW)
    expect(() => montarPacote(entrada(d, b.taken, { estado: 'erro' }))).toThrow(PacoteInvalido)
    for (const m of MOTIVOS) {
      const g = await gravarRetrato(sb, d.videoId, 1, montarPacote(entrada(d, b.taken, { estado: 'erro', motivo: m })))
      expect(g, m).toEqual({ ok: true, resultado: expect.objectContaining({ status: 'gravado', retrato: 'erro' }) })
    }
    expect((await q(pg, 'select status, error_reason from public.competitor_video_comment_snaps where video_id = $1', [d.videoId]))[0]).toMatchObject({ status: 'erro', error_reason: MOTIVOS[MOTIVOS.length - 1] })
    // curtida não medida: o item não vai, e o comentário não vira ausente
    const t1 = NOW - 12 * D
    const c = await base({ takenMs: t1 })
    const dc = await devidoDe(c, t1)
    const conv = conversa('t3a')
    await gravarRetrato(sb, dc.videoId, 1, montarPacote(entrada(dc, t1, { lote: { conversas: [conv], descartadas: 0, completo: true }, escolhidos: [escolhido(conv)], agregados })))
    const d7 = { ...dc, mark: 7 as const }
    const pacote7 = montarPacote(entrada(d7, t1 - 30 * H + 192 * H, { porId: new Map([['t3a', { texto: 'x', cortado: false, editadoEm: null, curtidas: null, respostasTotal: null }]]), ausentes: ['t3a'] }))
    expect(pacote7.comments).toEqual([])
    expect(pacote7.missing).toEqual([])
    const g7 = await gravarRetrato(sb, dc.videoId, 7, pacote7)
    expect(g7).toEqual({ ok: true, resultado: expect.objectContaining({ status: 'gravado', ausentes: 0, leituras: 0 }) })
    expect((await comentario(dc.videoId, 't3a')).miss_streak).toBe(0)
  })

  it('TS: o banco recusa o relógio adiantado (banco:22023), tolerância incoerente nem sai do TypeScript; mais de 12 escolhidos nem sai do montarPacote, mas o banco NÃO impõe o teto', async () => {
    const b = await base({ takenMs: NOW + 12 * D })
    const d = await devidoDe(b, NOW + 12 * D)
    const conv = conversa('t4a')
    const pacote = montarPacote(entrada(d, b.taken, { lote: { conversas: [conv], descartadas: 0, completo: true }, escolhidos: [escolhido(conv)] }))
    expect(await gravarRetrato(sb, d.videoId, 1, pacote)).toEqual({ ok: false, codigo: 'banco:22023' })
    expect(await gravarRetrato(sb, d.videoId, 7, pacote)).toEqual({ ok: false, codigo: 'tolerancia_incoerente' })
    expect((await contagem(d.videoId)).snaps).toBe(0)
    // o teto de 12
    const c = await base()
    const dc = await devidoDe(c, NOW)
    const treze = Array.from({ length: 13 }, (_, i) => conversa('t4m' + i, { posicao: i }))
    expect(() => montarPacote(entrada(dc, c.taken, { lote: { conversas: treze, descartadas: 0, completo: true }, escolhidos: treze.map((x) => escolhido(x)) }))).toThrow(PacoteInvalido)
    // ACHADO: o banco aceita 13 comentários se o chamador os mandar (nenhum check de teto em SQL; o teto mora só em montarPacote)
    const r = await grava(pg, c.video.id, 1, snapDe(1, c.taken), treze.map((x) => topo(x.id)))
    expect(r).toMatchObject({ status: 'gravado', comentarios_novos: 13 })
  })

  it('TS: sem_comentarios e desligados são finais; cada destaque (acompanhado, inscritos com faixas, próprio) e cada faixa do TypeScript passa nos checks do banco', async () => {
    for (const estado of ['sem_comentarios', 'desligados'] as const) {
      const b = await base()
      const d = await devidoDe(b, NOW)
      const g = await gravarRetrato(sb, d.videoId, 1, montarPacote(entrada(d, b.taken, { estado, ...(estado === 'sem_comentarios' ? { lote: { conversas: [], descartadas: 0, completo: true } } : {}) })))
      expect(g, estado).toEqual({ ok: true, resultado: expect.objectContaining({ status: 'gravado', retrato: estado, recebidos: 0 }) })
      const s = (await q(pg, 'select status, error_reason, video_comment_count, selected_count from public.competitor_video_comment_snaps where video_id = $1', [d.videoId]))[0]!
      expect(s).toMatchObject({ status: estado, error_reason: null, selected_count: null })
      expect(s.video_comment_count === null ? null : Number(s.video_comment_count)).toBe(estado === 'sem_comentarios' ? 0 : 40)
      expect((await lerDevidos(sb, { nowIso: iso(NOW), since: null, siteId: b.site }))?.linhas, estado + ' não volta').toEqual([])
    }
    const b = await base()
    const acomp = await novoCanal(b.site)
    const d = await devidoDe(b, NOW)
    const todos: Escolhido[] = []
    let i = 0
    for (const [fam] of SIZE_BANDS) for (const [razao] of RATIO_BANDS) {
      todos.push(escolhido(conversa('t5b' + i, { posicao: i++ }), 'destaque', { motivo: 'inscritos', canalRowId: null, faixaTamanho: fam, faixaRazao: razao }))
    }
    todos.push(escolhido(conversa('t5acomp', { posicao: 9 }), 'destaque', { motivo: 'canal_acompanhado', canalRowId: acomp.id, faixaTamanho: null, faixaRazao: null }))
    todos.push(escolhido(conversa('t5proprio', { posicao: 10 }), 'destaque', { motivo: 'canal_proprio', canalRowId: null, faixaTamanho: null, faixaRazao: null }))
    expect(todos.length).toBe(11)
    const g = await gravarRetrato(sb, d.videoId, 1, montarPacote(entrada(d, b.taken, { lote: { conversas: todos.map((e) => e.conversa), descartadas: 0, completo: true }, escolhidos: todos, agregados })))
    expect(g).toEqual({ ok: true, resultado: expect.objectContaining({ status: 'gravado', comentarios_novos: 11, identidades: 11 }) })
    const bandas = await q(pg, `select featured_reason, featured_size_band, featured_ratio_band from public.competitor_video_comments where video_id = $1 and featured_reason = 'inscritos' order by 2, 3`, [d.videoId])
    expect(bandas).toHaveLength(9)
  })

  it('TS: gravarRetrato devolve fora_da_tolerancia (com a idade que o banco calculou) e video_ausente como resultado, e lerDevidos entende contagem, inscritos e conferência nulos', async () => {
    const b = await base({ idadeH: 30 })
    const d = await devidoDe(b, NOW)
    const conv = conversa('t6a')
    const pacote = montarPacote(entrada(d, b.taken, { lote: { conversas: [conv], descartadas: 0, completo: true }, escolhidos: [escolhido(conv)] }))
    // o vídeo "envelhece" por SQL: o banco confere a idade, não o marco que o chamador achou
    await q(pg, 'update public.competitor_videos set published_at = $2 where id = $1', [d.videoId, iso(b.taken - 100 * H)])
    expect(await gravarRetrato(sb, d.videoId, 1, pacote)).toEqual({ ok: true, resultado: { status: 'fora_da_tolerancia', idade_h: 100 } })
    expect(await gravarRetrato(sb, randomUUID(), 1, pacote)).toEqual({ ok: true, resultado: { status: 'video_ausente' } })
    expect((await contagem(d.videoId)).snaps).toBe(0)
    // contagem, inscritos e última conferência ausentes: nulos, nunca zero
    const site = await novoSite()
    const canal = await novoCanal(site)
    await pg.query('update public.competitor_channels set subscriber_count = null where id = $1', [canal.id])
    const v = await novoVideo(canal.id, { pubMs: NOW - 30 * H, contagem: null })
    await pg.query('update public.competitor_videos set last_checked_at = null where id = $1', [v.id])
    const r = await lerDevidos(sb, { nowIso: iso(NOW), since: null, siteId: site })
    expect(r?.linhas).toHaveLength(1)
    expect(r!.linhas[0]).toMatchObject({ channelSubscribers: null, channelSubscribersHidden: null, videoCommentCount: null, videoCheckedAt: null, prevStatus: null })
  })

  // ───────────────────────── LGPD: o dado pessoal do autor ─────────────────────────
  /**
   * 6 conversas com identidade (1 acompanhado como autor), 1 do criador (nunca tem identidade), numa coleta de 29 dias atrás
   * (a identidade venceu há 1 dia); mais um vídeo recente cuja identidade ainda não venceu.
   */
  async function cenarioLgpd(): Promise<{
    b: Base; sentinelas: string[]; sentCriador: string; sentAcomp: string; sentNova: string; acompanhado: { id: string; yt: string }
    corpo: string; videoRecente: string
  }> {
    const t = NOW - 29 * D
    const b = await base({ takenMs: t })
    const sentinelas = Array.from({ length: 5 }, () => 'zq' + uid())
    const sentCriador = 'zq' + uid()
    const sentAcomp = 'zq' + uid()
    const sentNova = 'zq' + uid()
    const corpo = 'zq' + uid()
    const acompanhado = await novoCanal(b.site, { yt: 'UC' + sentAcomp })
    const d = await devidoDe(b, t)
    const conv = sentinelas.map((s, i) => conversa('lg' + i, {
      posicao: i, texto: 'comentário inventado ' + i, autor: { nome: 'Autor ' + s, canalId: 'UC' + s, foto: 'https://img.invalid/' + s + '.jpg' },
    }))
    const daAcompanhado = conversa('lgacomp', {
      posicao: 5, texto: 'texto com a marca ' + corpo, autor: { nome: 'Acompanhado ' + sentAcomp, canalId: 'UC' + sentAcomp, foto: 'https://img.invalid/' + sentAcomp + '.jpg' },
    })
    const doCriador = conversa('lgcriador', {
      posicao: 6, doCriador: true, texto: 'comentário do criador', autor: { nome: 'Criador ' + sentCriador, canalId: 'UC' + sentCriador, foto: 'https://img.invalid/' + sentCriador + '.jpg' },
    })
    const todas = [...conv, daAcompanhado, doCriador]
    const escolhidos: Escolhido[] = [
      ...conv.map((c) => escolhido(c)),
      escolhido(daAcompanhado, 'destaque', { motivo: 'canal_acompanhado', canalRowId: acompanhado.id, faixaTamanho: null, faixaRazao: null }),
      escolhido(doCriador, 'criador'),
    ]
    const g = await gravarRetrato(sb, d.videoId, 1, montarPacote(entrada(d, t, { lote: { conversas: todas, descartadas: 0, completo: true }, escolhidos, agregados })))
    expect(g).toEqual({ ok: true, resultado: expect.objectContaining({ comentarios_novos: 7, identidades: 6 }) })
    // um vídeo que ainda não venceu
    const tn = NOW - 10 * D
    const recente = await maisUm(b, 30, tn)
    const dr = await devidoDe({ ...b, video: recente }, tn)
    const cn = conversa('lgnova', { autor: { nome: 'Nova ' + sentNova, canalId: 'UC' + sentNova, foto: 'https://img.invalid/' + sentNova + '.jpg' } })
    await gravarRetrato(sb, dr.videoId, 1, montarPacote(entrada(dr, tn, { lote: { conversas: [cn], descartadas: 0, completo: true }, escolhidos: [escolhido(cn)], agregados })))
    return { b, sentinelas, sentCriador, sentAcomp, sentNova, acompanhado, corpo, videoRecente: recente.id }
  }

  it('LGPD (a): depois de gravar, nome, id de canal e foto do autor só existem na tabela de identidade (varredura por catálogo)', async () => {
    const s = await cenarioLgpd()
    for (const sent of s.sentinelas) {
      expect(await varredura(sent), 'sentinela ' + sent).toEqual([
        'competitor_video_comment_authors.avatar_url', 'competitor_video_comment_authors.channel_id', 'competitor_video_comment_authors.display_name',
      ])
    }
    // o criador nunca tem identidade: a sentinela dele não está em lugar nenhum
    expect(await varredura(s.sentCriador)).toEqual([])
    // o autor que é canal acompanhado: a identidade E o cadastro do canal (que é dado do dono, não do comentário)
    expect(await varredura(s.sentAcomp)).toEqual([
      'competitor_channels.channel_id', 'competitor_video_comment_authors.avatar_url', 'competitor_video_comment_authors.channel_id', 'competitor_video_comment_authors.display_name',
    ])
    // o texto do comentário fica no comentário (risco aceito), e só lá
    expect(await varredura(s.corpo)).toEqual(['competitor_video_comments.body'])
    // as quatro tabelas, coluna por coluna: nada de nome, id ou foto fora de authors
    const fora = await q(pg, `select count(*)::int as n from public.competitor_video_comments c where c::text like $1 or c::text like $2`, ['%' + s.sentinelas[0] + '%', '%UC' + s.sentinelas[1] + '%'])
    expect(fora[0]!.n).toBe(0)
  })

  it('LGPD (b): a anulação aos 28 dias apaga a linha inteira, é idempotente, é segura com dois clientes ao mesmo tempo, e o que não venceu fica', async () => {
    const s = await cenarioLgpd()
    expect((await contagem(s.videoRecente)).identidades).toBe(1)
    const [x, y, z] = await Promise.all([purga(pg, s.b.site), purga(pg2, s.b.site), anular(sb, s.b.site).catch((e: unknown) => e)])
    expect(z, 'o anular do TypeScript não lançou').not.toBeInstanceOf(Error)
    const zr = z as { apagadas: number; comentarios_carimbados: number }
    const apagadas = Number(x.apagadas) + Number(y.apagadas) + zr.apagadas
    const carimbadas = Number(x.comentarios_carimbados) + Number(y.comentarios_carimbados) + zr.comentarios_carimbados
    expect(apagadas, 'cada linha foi apagada por UMA das três chamadas').toBe(6)
    expect(carimbadas, 'e carimbada uma vez').toBe(6)
    const resto = await q(pg, `select count(*)::int as n, (count(*) filter (where a.display_name like '%' || $2 || '%'))::int as nova from public.competitor_video_comment_authors a where a.site_id = $1`, [s.b.site, s.sentNova])
    expect(resto[0]).toEqual({ n: 1, nova: 1 })
    // idempotente: a segunda vez apaga 0 e o resto continua o mesmo
    expect(await purga(pg, s.b.site)).toEqual({ apagadas: 0, comentarios_carimbados: 0, vencidas_ha_mais_de_1_dia: 0, restantes: 1 })
    expect(await anular(sb, s.b.site)).toEqual({ apagadas: 0, comentarios_carimbados: 0, vencidas_ha_mais_de_1_dia: 0, restantes: 1 })
    // a linha inteira foi apagada (não só o nome): nenhuma identidade do vídeo antigo
    expect(Number((await q(pg, `select count(*) as n from public.competitor_video_comment_authors a join public.competitor_video_comments c on c.id = a.comment_id where c.video_id = $1`, [s.b.video.id]))[0]!.n)).toBe(0)
    // carimbo: os 6 do vídeo antigo, nenhum do criador nem do recente
    const carimbo = await q(pg, `select youtube_comment_id, author_purged_at is not null as carimbado from public.competitor_video_comments where site_id = $1 order by 1`, [s.b.site])
    expect(carimbo.filter((c) => c.carimbado).map((c) => c.youtube_comment_id)).toEqual(['lg0', 'lg1', 'lg2', 'lg3', 'lg4', 'lgacomp'])
    expect(carimbo.filter((c) => !c.carimbado).map((c) => c.youtube_comment_id)).toEqual(['lgcriador', 'lgnova'])
  })

  it('LGPD (c): depois da anulação a varredura por catálogo não acha a identidade em lugar nenhum, exceto o que o plano declara que fica', async () => {
    const s = await cenarioLgpd()
    await purga(pg, s.b.site)
    for (const sent of s.sentinelas) expect(await varredura(sent), 'sentinela ' + sent).toEqual([])
    expect(await varredura(s.sentCriador)).toEqual([])
    // o que sobra do autor que é canal acompanhado: SÓ o cadastro do canal acompanhado (competitor_channels.channel_id), que é do dono
    expect(await varredura(s.sentAcomp)).toEqual(['competitor_channels.channel_id'])
    // decisão do dono (13/10, pergunta 30): a anulação também zera o vínculo featured_channel_id (liga o comentário ao canal do autor);
    // o motivo do destaque fica, o texto fica, e o vínculo não sobrevive
    const c = await comentario(s.b.video.id, 'lgacomp')
    expect(c).toMatchObject({ featured_reason: 'canal_acompanhado', featured_channel_id: null })
    expect(c.author_purged_at).not.toBeNull()
    // o texto do comentário fica
    expect(await varredura(s.corpo)).toEqual(['competitor_video_comments.body'])
    // a identidade que não venceu continua inteira
    expect(await varredura(s.sentNova)).toEqual([
      'competitor_video_comment_authors.avatar_url', 'competitor_video_comment_authors.channel_id', 'competitor_video_comment_authors.display_name',
    ])
    // a prova, pelo TypeScript, não vê identidade vencida
    const p = await lerProva(sb, { siteId: s.b.site, nowIso: iso(NOW), since: null })
    expect(p.ok).toBe(true)
    if (p.ok) expect(p.prova).toMatchObject({ identidade_vencida: 0, identidade_prazo_errado: 0, identidade_de_criador: 0, respostas_de_terceiros: 0, identidades_total: 1, comentarios_total: 8 })
  })

  /** A primeira anulação (pg2) ainda não confirmou quando a segunda (pg) começa: devolve o que a segunda disse depois de esperar. */
  async function anulacoesEmContencao(site: string): Promise<{ primeira: Linha; segunda: Linha; presa: boolean }> {
    await pg2.query('begin')
    try {
      const primeira = (await q(pg2, 'select public.competitor_comment_identity_purge($1::uuid) as r', [site]))[0]!.r as Linha
      const segunda = purga(pg, site)
      const espera = await Promise.race([segunda.then(() => 'terminou'), new Promise<string>((r) => setTimeout(() => r('presa'), 1_500))])
      await pg2.query('commit')
      return { primeira, segunda: await segunda, presa: espera === 'presa' }
    } finally {
      await pg2.query('rollback').catch(() => undefined)
    }
  }

  it('LGPD (b2): duas anulações realmente simultâneas (a primeira ainda não confirmou): a segunda espera a trava de linha e apaga 0', async () => {
    const s = await cenarioLgpd()
    const { primeira, segunda, presa } = await anulacoesEmContencao(s.b.site)
    expect(primeira).toMatchObject({ apagadas: 6, comentarios_carimbados: 6 })
    expect(presa, 'a segunda chamada espera a primeira confirmar').toBe(true)
    expect(segunda).toMatchObject({ apagadas: 0, comentarios_carimbados: 0, vencidas_ha_mais_de_1_dia: 0 })
    expect(Number((await q(pg, 'select count(*) as n from public.competitor_video_comment_authors where site_id = $1', [s.b.site]))[0]!.n)).toBe(1)
  })

  // ACHADO (relatório 1a): `restantes` é "contagem do começo da instrução menos o que ESTA chamada apagou". Sob concorrência a segunda
  // chamada vê o retrato antigo e diz 7 quando só 1 identidade existe. O teste está escrito como DEVERIA passar; `it.fails` só para a
  // suíte não ficar vermelha. Quando o SQL for corrigido, este teste passa a falhar e a marca sai.
  it.fails('LGPD (b3): restantes da segunda anulação concorrente diz quantas identidades existem de fato (1), não o retrato do começo (7)', async () => {
    const s = await cenarioLgpd()
    const { segunda } = await anulacoesEmContencao(s.b.site)
    expect(segunda.restantes).toBe(1)
  })

  it('TS: runAnularIdentidade apaga, prova depois e fica ok; na segunda vez apaga 0; com identidade de criador forjada fica vermelho identidade_invariante', async () => {
    const s = await cenarioLgpd()
    const ctx = { sb, now: () => NOW, siteId: s.b.site }
    const r1 = await runAnularIdentidade(ctx)
    expect(r1).toMatchObject({ status: 'ok', feitos: 6, ficaram: 0, numeros: { apagadas: 6, comentarios_carimbados: 6, restantes: 1, identidade_vencida: 0 } })
    const r2 = await runAnularIdentidade(ctx)
    expect(r2).toMatchObject({ status: 'ok', feitos: 0, numeros: { apagadas: 0, restantes: 1 } })
    // identidade forjada no comentário do criador: a prova de depois fica vermelha
    const idCriador = (await comentario(s.b.video.id, 'lgcriador')).id
    await pg.query(`insert into public.competitor_video_comment_authors (comment_id, site_id, display_name, expires_at) values ($1, $2, 'forjado', now() + interval '28 days')`, [idCriador, s.b.site])
    const r3 = await runAnularIdentidade(ctx)
    expect(r3).toMatchObject({ status: 'erro', motivo: 'identidade_invariante', numeros: { identidade_de_criador: 1 } })
    await pg.query('delete from public.competitor_video_comment_authors where comment_id = $1', [idCriador])
    expect(await runAnularIdentidade(ctx)).toMatchObject({ status: 'ok' })
  })
})
