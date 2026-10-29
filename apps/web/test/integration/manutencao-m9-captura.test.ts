// @vitest-environment node
/** M9 Tarefa 2: a lista do item antes da cascata, a bandeira por chave, a guarda do record, a injeção na E9 e a recusa. Tudo em begin … rollback (54422). */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { m3bNoBanco, aplicarM3b, escalar, tenta, semearCanal, semearDiaria } from '../helpers/m3b'
import { aplicarM9, sqlM9Resolvido } from '../helpers/m9'
import { criarUsuario } from '../helpers/mg6'
import { travarDdl } from '../helpers/ddl-testes'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const CAP = 'public.obs_archive_item_capture(uuid,text,uuid,text[],text[])'
const ESP = 'public.obs_archive_item_esperadas(uuid,text,text,uuid,date,text,text[],bigint)'
const SEMANA = ['2026-09-01', '2026-10-01'] as const

type Cena = { site: string; canal: string; videos: string[]; yt: string[]; actor: string }
type Linha = Record<string, unknown>

describe.skipIf(skipIfNoLocalDb())('M9 parte 2: captura, bandeira, guarda do record, injeção e recusa', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })

  async function emTx(fn: (c: Cena) => Promise<void>, o: { parte?: boolean; videos?: number } = {}): Promise<void> {
    await pg.query('begin'); await pg.query('select pg_advisory_xact_lock(7339001)')
    try {
      if (!(await m3bNoBanco(pg))) await aplicarM3b(pg)
      await travarDdl(pg)
      if (o.parte !== false) await aplicarM9(pg, 2)
      const s = await semearCanal(pg, { videos: o.videos ?? 2 })
      const yt = (await pg.query(`select video_id from public.competitor_videos where id = any($1::uuid[]) order by array_position($1::uuid[], id)`, [s.videos])).rows.map(r => r.video_id as string)
      const actor = await criarUsuario(pg)
      await pg.query(`insert into public.organization_members (org_id, user_id, role) select s.org_id, $2, 'org_admin' from public.sites s where s.id = $1`, [s.site, actor])
      await fn({ site: s.site, canal: s.canal, videos: s.videos, yt, actor })
    } finally { await pg.query('rollback') }
  }

  /** Daily dos vídeos (set/out) e a unidade corrente que casa com o online (row_count = contagem real do mês). */
  async function diaria(c: Cena, videos = c.videos, meses: readonly string[] = SEMANA, extra: { rows?: number } = {}): Promise<void> {
    await semearDiaria(pg, videos, '2026-09-25', 10)                       // 6 dias de set + 4 de out por vídeo
    for (const m of meses) await unidade(c, 'serie', 'competitor_video_daily', m, 1, extra.rows)
  }
  async function online(c: Cena, tabela: string, mes: string): Promise<number> {
    const col = tabela === 'competitor_video_daily' ? 't.snap_date' : 't.first_seen_at'
    if (tabela === 'competitor_video_daily') {
      return escalar(pg, `select count(*)::int from public.competitor_video_daily t join public.competitor_videos v on v.id = t.video_id
        where v.competitor_channel_id = $1 and ${col} >= $2::date and ${col} < ($2::date + interval '1 month')`, [c.canal, mes])
    }
    return escalar(pg, `select count(*)::int from public.competitor_video_comments t where t.competitor_channel_id = $1
      and t.first_seen_at >= ($2::date::text || ' 00:00:00-03')::timestamptz and t.first_seen_at < (($2::date + interval '1 month')::date::text || ' 00:00:00-03')::timestamptz`, [c.canal, mes])
  }
  async function unidade(c: Cena, classe: string, tabela: string, mes: string, versao: number, rows?: number): Promise<string> {
    const n = rows ?? await online(c, tabela, mes)
    return (await pg.query(
      `insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, received_at)
       values ($1, $2, $3, $4, $5::date, $6, $7::bigint, repeat('a', 64), repeat('b', 64), case when $7::bigint = 0 then null else repeat('c', 64) end, repeat('d', 64), 100, now()) returning id`,
      [c.site, classe, tabela, c.canal, mes, versao, n])).rows[0].id as string
  }
  async function comentario(c: Cena, video: string, mes: string, extra: { missing?: boolean; parent?: number | null; creator?: boolean } = {}): Promise<number> {
    return (await pg.query(
      `insert into public.competitor_video_comments (site_id, competitor_channel_id, video_id, youtube_comment_id, parent_id, body, is_creator, published_at, first_seen_at, last_seen_at, missing_since, speaker_no)
       values ($1, $2, $3, 'cm' || substr(md5(gen_random_uuid()::text), 1, 10), $4, 'x', $5, $6::timestamptz, $6::timestamptz + interval '1 hour', $6::timestamptz + interval '2 days', $7, case when $4::bigint is not null and not $5 then 1 end)
       returning id`,
      [c.site, c.canal, video, extra.parent ?? null, extra.creator ?? false, `${mes}T12:00:00Z`, extra.missing === false ? null : '2026-10-20'])).rows[0].id as number
  }
  const alvoWatch = (site: string, yt: string, tipo = 'concorrente') => pg.query(
    `insert into public.yt_watch_alvos (site_id, youtube_video_id, tipo, motivo_ate, coleta_ate, hora_base_min, proxima_rodada_em) values ($1, $2, $3, 'janela_concorrente', now() + interval '7 days', 10, now())`, [site, yt, tipo])
  const leituraWatch = (site: string, yt: string, miniatura: string | null = null) => pg.query(
    `insert into public.yt_watch_readings (site_id, youtube_video_id, lida_em, rodada_id, origem_rede, versao_leitor, http, miniatura_id) values ($1, $2, now(), gen_random_uuid(), 'forja', 1, 200, $3)`, [site, yt, miniatura])
  const ligar = (c: Cena) => pg.query(`select public.obs_archive_m9_ligar($1, true)`, [c.site])
  const sinal = (c: Cena, v: string) => pg.query(`update public.competitor_videos set missing_since = current_date - 3 where id = $1`, [v])
  async function comoServico<T>(fn: () => Promise<T>): Promise<T> {
    await pg.query('set local role service_role')
    try { return await fn() } finally { await pg.query('reset role') }
  }
  const apagarVideo = (c: Cena, v = c.videos[0]!) => comoServico(() => tenta(pg, `select public.competitor_video_purge($1, $2, $3, 60, '203.0.113.7', 'ua') as r`, [c.site, v, c.actor]))
  const apagarComentarios = (c: Cena, ids: number[]) => comoServico(() => tenta(pg, `select public.competitor_comments_purge($1, $2, $3::bigint[], $4, '203.0.113.7', 'ua') as r`, [c.site, c.canal, ids, c.actor]))
  const alvos = async (c: Cena): Promise<Linha[]> =>
    (await pg.query(`select * from public.obs_archive_item_targets where site_id = $1 order by month, table_name, item_kind, geracao`, [c.site])).rows

  it('captura: permissões e captura_presente; ligar(true) liga e ligar(false) desliga', async () => {
    await emTx(async c => {
      const prv = async (fn: string, role: string) => escalar<boolean>(pg, `select has_function_privilege($1, $2, 'EXECUTE')`, [role, fn])
      expect(await prv(CAP, 'service_role')).toBe(true)
      expect(await prv(CAP, 'anon')).toBe(false)
      expect(await prv(CAP, 'authenticated')).toBe(false)
      for (const r of ['service_role', 'anon', 'authenticated']) expect(await prv(ESP, r)).toBe(false)
      expect(await prv('public.obs_archive_m9_captura_presente()', 'service_role')).toBe(false)
      expect(await prv('public.obs_archive_m9_pronto(uuid)', 'service_role')).toBe(true)
      expect(await prv('public.obs_archive_m9_pronto(uuid)', 'anon')).toBe(false)
      expect(await escalar<boolean>(pg, `select public.obs_archive_m9_captura_presente()`)).toBe(true)
      expect(await escalar<boolean>(pg, `select public.obs_archive_m9_ligar($1, true)`, [c.site])).toBe(true)
      expect(await escalar<boolean>(pg, `select public.obs_archive_m9_ligado($1)`, [c.site])).toBe(true)
      expect(await escalar<boolean>(pg, `select public.obs_archive_m9_ligar($1, false)`, [c.site])).toBe(false)
      expect(await escalar<boolean>(pg, `select public.obs_archive_m9_ligado($1)`, [c.site])).toBe(false)
    })
  })

  it('captura_presente: falso se uma das funções for recriada sem a captura; ligar(true) falha captura_ausente', async () => {
    await emTx(async c => {
      const def = (await pg.query(`select pg_get_functiondef('public.competitor_video_purge(uuid,uuid,uuid,integer,text,text)'::regprocedure) as d`)).rows[0].d as string
      await pg.query(def.replace(/perform public\.obs_archive_item_capture\([^;]*;/, ''))
      expect(await escalar<boolean>(pg, `select public.obs_archive_m9_captura_presente()`)).toBe(false)
      const r = await tenta(pg, `select public.obs_archive_m9_ligar($1, true)`, [c.site])
      expect(r).toMatchObject({ ok: false, message: 'captura_ausente' })
    })
  })

  it('captura_presente: o nome só num comentário não conta (Phil M3)', async () => {
    await emTx(async c => {
      const def = (await pg.query(`select pg_get_functiondef('public.competitor_video_purge(uuid,uuid,uuid,integer,text,text)'::regprocedure) as d`)).rows[0].d as string
      await pg.query(def.replace(/perform public\.obs_archive_item_capture\([^;]*;/, '-- obs_archive_item_capture saiu daqui\n'))
      expect(await escalar<boolean>(pg, `select public.obs_archive_m9_captura_presente()`)).toBe(false)
    })
  })

  it('service_role_apaga_video_e_comentarios: sem 42501, alvos antes da cascata, watch limpa só deste site, bandeira ligada', async () => {
    await emTx(async c => {
      await sinal(c, c.videos[0]!)
      await diaria(c)
      const outro = '00000000-0000-0000-0000-00000000a3b1'
      const outroSite = await semearCanal(pg, { site: outro, videos: 1 })
      const yt = c.yt[0]!
      for (const s of [c.site, outro]) {
        await alvoWatch(s, yt)
        const th = (await pg.query(`insert into public.yt_watch_thumbs (site_id, youtube_video_id, host, variante, http, etag, sha16, dhash, largura, altura, primeira_vista, ultima_vista)
          values ($1, $2, 'i.ytimg.com', 'default', 200, 'e', repeat('a', 16), repeat('b', 16), 120, 90, now(), now()) returning id`, [s, yt])).rows[0].id as string
        await leituraWatch(s, yt, th)
      }
      void outroSite
      const total = await online(c, 'competitor_video_daily', SEMANA[0])
      await ligar(c)
      const r = await apagarVideo(c)
      expect(r.ok, JSON.stringify(r)).toBe(true)
      if (!r.ok) return
      const res = r.rows[0]!.r as { status: string; rows_deleted: Record<string, number> }
      expect(res.status).toBe('apagado')
      expect(res.rows_deleted).toMatchObject({ yt_watch_readings: 1, yt_watch_thumbs: 1, yt_watch_alvos: 1 })
      for (const t of ['yt_watch_alvos', 'yt_watch_thumbs', 'yt_watch_readings']) {
        expect(await escalar(pg, `select count(*)::int from public.${t} where site_id = $1`, [c.site])).toBe(0)
        expect(await escalar(pg, `select count(*)::int from public.${t} where site_id = $1`, [outro])).toBe(1)
        expect(await escalar<boolean>(pg, `select has_table_privilege('service_role', 'public.${t}', 'DELETE')`)).toBe(true)
      }
      const a = await alvos(c)
      expect(a).toHaveLength(2)
      expect(a[0]).toMatchObject({ item_kind: 'video', estado: 'copiar', esperadas: String(total / 2), item_refs: [yt], keys: [c.videos[0]] })
      expect(await escalar(pg, `select count(*)::int from public.competitor_videos where id = $1`, [c.videos[0]])).toBe(0)
      expect(await escalar<boolean>(pg, `select archive_pending from public.competitor_removed_items where site_id = $1 and kind = 'video' and youtube_id = $2`, [c.site, yt])).toBe(true)
      expect(await escalar<boolean>(pg, `select prosecdef from pg_proc where proname = 'competitor_video_purge'`)).toBe(false)
      expect(await escalar<boolean>(pg, `select prosecdef from pg_proc where proname = 'competitor_comments_purge'`)).toBe(false)
      // comentários: top-level (alvo) com uma resposta de espectador; unidade de texto casa com o online
      const topo = await comentario(c, c.videos[1]!, '2026-09-10')
      await comentario(c, c.videos[1]!, '2026-09-10', { parent: topo })
      await unidade(c, 'texto', 'competitor_video_comments', '2026-09-01', 1)
      await unidade(c, 'texto', 'competitor_video_comment_marks', '2026-09-01', 1, 0)
      const r2 = await apagarComentarios(c, [topo])
      expect(r2.ok, JSON.stringify(r2)).toBe(true)
      const t = (await alvos(c)).filter(x => x.item_kind === 'comentario')
      expect(t.map(x => x.table_name)).toEqual(['competitor_video_comments'])
      expect(t[0]).toMatchObject({ esperadas: '2', estado: 'copiar' })
      expect((t[0]!.keys as string[]).length).toBe(2)
      expect((t[0]!.item_refs as string[]).length).toBe(1)           // resposta de espectador não vai à lista de removidos
      expect(await escalar(pg, `select count(*)::int from public.competitor_removed_items where site_id = $1 and kind = 'comentario'`, [c.site])).toBe(1)
    })
  })

  it('watch compartilhada: vídeo com o mesmo youtube_video_id em outro canal do mesmo site não perde a watch', async () => {
    await emTx(async c => {
      await sinal(c, c.videos[0]!)
      const yt = c.yt[0]!
      const outroCanal = randomUUID()
      await pg.query(`insert into public.competitor_channels (id, site_id, channel_id, channel_name, added_at) values ($1, $2, 'UC' || substr(md5($1::uuid::text), 1, 22), 'b', now())`, [outroCanal, c.site])
      await pg.query(`insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at) values ($1, $2, 'v', now())`, [outroCanal, yt])
      await alvoWatch(c.site, yt)
      const r = await apagarVideo(c)
      expect(r.ok, JSON.stringify(r)).toBe(true)
      expect(await escalar(pg, `select count(*)::int from public.yt_watch_alvos where site_id = $1`, [c.site])).toBe(1)
    })
  })

  it('service_role_apaga_canal: sem skip, a watch dos vídeos do canal sai (chave = array_agg(video_id)) e o canal não declara de novo', async () => {
    await emTx(async c => {
      await pg.query(`update public.competitor_channels set missing_since = current_date - 3 where id = $1`, [c.canal])
      const outro = '00000000-0000-0000-0000-00000000a3b1'
      await semearCanal(pg, { site: outro, videos: 1 })
      for (const s of [c.site, outro]) for (const yt of c.yt) {
        await alvoWatch(s, yt)
        await leituraWatch(s, yt)
      }
      const r = await comoServico(() => tenta(pg, `select public.competitor_channel_purge($1, $2, $3, 60, null, null) as r`, [c.site, c.canal, c.actor]))
      expect(r.ok, JSON.stringify(r)).toBe(true)
      if (!r.ok) return
      const res = r.rows[0]!.r as { status: string; rows_deleted: Record<string, number> }
      expect(res.status).toBe('apagado')
      expect(res.rows_deleted).toMatchObject({ yt_watch_readings: 2, yt_watch_alvos: 2 })
      expect(await escalar(pg, `select count(*)::int from public.yt_watch_alvos where site_id = $1`, [c.site])).toBe(0)
      expect(await escalar(pg, `select count(*)::int from public.yt_watch_alvos where site_id = $1`, [outro])).toBe(2)
      expect(await escalar(pg, `select count(*)::int from public.obs_archive_channel_removals where site_id = $1 and archive_decision = 'apagar' and removed_via = 'fila'`, [c.site])).toBe(1)
      expect(await escalar(pg, `select count(*)::int from public.competitor_channels where id = $1`, [c.canal])).toBe(0)
    })
  })

  const apagarCanal = async (c: Cena) => {
    await pg.query(`update public.competitor_channels set missing_since = current_date - 3 where id = $1`, [c.canal])
    return comoServico(() => tenta(pg, `select public.competitor_channel_purge($1, $2, $3, 60, null, null) as r`, [c.site, c.canal, c.actor]))
  }
  const watchDe = (c: Cena, yt: string) => pg.query(
    `select (select count(*)::int from public.yt_watch_alvos where site_id = $1 and youtube_video_id = $2) as alvos,
            (select count(*)::int from public.yt_watch_readings where site_id = $1 and youtube_video_id = $2) as leituras`, [c.site, yt]).then(r => r.rows[0] as { alvos: number; leituras: number })

  it('channel_purge, watch: vídeo também em OUTRO canal do mesmo site não perde a watch (cláusula competitor_channel_id <> p_channel)', async () => {
    await emTx(async c => {
      const outroCanal = randomUUID()
      await pg.query(`insert into public.competitor_channels (id, site_id, channel_id, channel_name, added_at) values ($1, $2, 'UC' || substr(md5($1::uuid::text), 1, 22), 'b', now())`, [outroCanal, c.site])
      await pg.query(`insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at) values ($1, $2, 'v', now())`, [outroCanal, c.yt[0]])
      for (const yt of c.yt) { await alvoWatch(c.site, yt); await leituraWatch(c.site, yt) }
      const r = await apagarCanal(c)
      expect(r.ok, JSON.stringify(r)).toBe(true)
      expect(await watchDe(c, c.yt[0]!)).toEqual({ alvos: 1, leituras: 1 })          // do outro canal: fica
      expect(await watchDe(c, c.yt[1]!)).toEqual({ alvos: 0, leituras: 0 })          // só deste canal: sai
    })
  })

  it('channel_purge, watch: alvo que não é de concorrente (tipo proprio) não é apagado (cláusula tipo <> concorrente)', async () => {
    await emTx(async c => {
      await alvoWatch(c.site, c.yt[0]!); await leituraWatch(c.site, c.yt[0]!)
      await alvoWatch(c.site, c.yt[1]!, 'proprio'); await leituraWatch(c.site, c.yt[1]!)
      const r = await apagarCanal(c)
      expect(r.ok, JSON.stringify(r)).toBe(true)
      expect(await watchDe(c, c.yt[0]!)).toEqual({ alvos: 0, leituras: 0 })
      expect(await watchDe(c, c.yt[1]!)).toEqual({ alvos: 1, leituras: 1 })          // próprio: fica
    })
  })

  it('captura: uma unidade, uma linha por tipo (maior versão); dois itens na mesma unidade fundem', async () => {
    await emTx(async c => {
      await diaria(c)
      await unidade(c, 'serie', 'competitor_video_daily', '2026-09-01', 2)           // versão maior do mesmo mês
      const v2 = (await pg.query(`select id from public.obs_archive_units where site_id = $1 and version = 2`, [c.site])).rows[0].id as string
      const n = await escalar(pg, `select public.obs_archive_item_capture($1, 'video', $2, array['a1'], array[$3::text])`, [c.site, c.canal, c.videos[0]])
      expect(n).toBe(2)
      const a = await alvos(c)
      expect(a).toHaveLength(2)
      expect(a[0]).toMatchObject({ estado: 'copiar', from_unit_id: v2, from_version: 2, geracao: 1 })
      const esp1 = Number(a[0]!.esperadas)
      await pg.query(`delete from public.competitor_video_daily where video_id = $1`, [c.videos[0]])      // as linhas do 1º item já saíram do online
      await pg.query(`select public.obs_archive_item_capture($1, 'video', $2, array['a2'], array[$3::text])`, [c.site, c.canal, c.videos[1]])
      const b = await alvos(c)
      expect(b).toHaveLength(2)                                                       // fundiu: continua um alvo por mês
      expect(b[0]!.item_refs).toEqual(['a1', 'a2'])
      expect((b[0]!.keys as string[]).length).toBe(2)
      expect(Number(b[0]!.esperadas)).toBe(esp1 + esp1)
    })
  })

  it('segundo_lote_de_comentarios_gera_geracao: alvo em aguardando_nova e unidade nova nasce geracao 2', async () => {
    await emTx(async c => {
      const k1 = await comentario(c, c.videos[0]!, '2026-09-10')
      const u1 = await unidade(c, 'texto', 'competitor_video_comments', '2026-09-01', 1)
      await pg.query(`select public.obs_archive_item_capture($1, 'comentario', $2, array['x1'], array[$3::text])`, [c.site, c.canal, k1])
      await pg.query(`update public.obs_archive_item_targets set estado = 'aguardando_nova' where site_id = $1`, [c.site])
      await pg.query(`delete from public.competitor_video_comments where id = $1`, [k1])
      const k2 = await comentario(c, c.videos[0]!, '2026-09-12')
      const u2 = await unidade(c, 'texto', 'competitor_video_comments', '2026-09-01', 2)
      await pg.query(`select public.obs_archive_item_capture($1, 'comentario', $2, array['x2'], array[$3::text])`, [c.site, c.canal, k2])
      const a = (await alvos(c)).filter(x => x.table_name === 'competitor_video_comments')
      expect(a.map(x => x.geracao)).toEqual([1, 2])
      expect(a[0]!.from_unit_id).toBe(u1)
      expect(a[1]).toMatchObject({ from_unit_id: u2, from_version: 2, estado: 'copiar' })
    })
  })

  it('captura: unidade vazia ou item ausente não gera alvo; canal com decisão apagar devolve 0', async () => {
    await emTx(async c => {
      await semearDiaria(pg, [c.videos[0]!], '2026-09-25', 3)
      await unidade(c, 'serie', 'competitor_video_daily', '2026-09-01', 1)            // só o v0 tem linhas
      await unidade(c, 'serie', 'competitor_video_daily', '2026-10-01', 1, 0)         // mais nova vazia
      const cap = (v: string) => escalar(pg, `select public.obs_archive_item_capture($1, 'video', $2, array['q'], array[$3::text])`, [c.site, c.canal, v])
      expect(await cap(c.videos[1]!)).toBe(0)                                         // v1 não está na unidade: esperadas = 0
      expect(await alvos(c)).toHaveLength(0)
      expect(await cap(c.videos[0]!)).toBe(1)                                         // só set; out vazio
      await pg.query(`delete from public.obs_archive_item_targets where site_id = $1`, [c.site])
      await pg.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, archive_decision, removed_via, decided_at, online_thumbs_known) values ($1, $2, 'apagar', 'fila', now(), true)`, [c.site, c.canal])
      expect(await cap(c.videos[0]!)).toBe(0)
      expect(await alvos(c)).toHaveLength(0)
    })
  })

  it('captura: mês destacado em trânsito levanta e a função da E9 inteira desfaz', async () => {
    await emTx(async c => {
      await sinal(c, c.videos[0]!)
      await diaria(c)
      await pg.query(`insert into public.obs_archive_months (site_id, class, table_name, month, detached_at) values ($1, 'serie', 'competitor_video_daily', '2026-09-01', now())`, [c.site])
      await ligar(c)
      const r = await apagarVideo(c)
      expect(r).toMatchObject({ ok: false, message: 'mes_destacado_em_transito' })
      expect(await escalar(pg, `select count(*)::int from public.competitor_videos where id = $1`, [c.videos[0]])).toBe(1)
    })
  })

  it('captura: mês já fora do banco gera alvo com esperadas nulo', async () => {
    await emTx(async c => {
      await diaria(c)
      await pg.query(`insert into public.obs_archive_months (site_id, class, table_name, month, detached_at, dropped_at) values ($1, 'serie', 'competitor_video_daily', '2026-09-01', now(), now())`, [c.site])
      expect(await escalar(pg, `select public.obs_archive_item_capture($1, 'video', $2, array['q'], array[$3::text])`, [c.site, c.canal, c.videos[0]])).toBe(2)
      const a = await alvos(c)
      expect(a[0]!.esperadas).toBeNull()
      expect(a[1]!.esperadas).not.toBeNull()
    })
  })

  it('captura: video_antigo só com archive_frozen_at no mês; ensaio nunca; comentário só nas tabelas de texto; defasada = nulo', async () => {
    await emTx(async c => {
      await diaria(c, c.videos, ['2026-09-01'])
      await unidade(c, 'video_antigo', 'competitor_changes', '2026-09-01', 1, 3)
      await unidade(c, 'ensaio', 'obs_archive_rehearsal', '2026-09-01', 1, 3)
      const cap = (kind: string, k: string) => escalar(pg, `select public.obs_archive_item_capture($1, $2, $3, array['q'], array[$4::text])`, [c.site, kind, c.canal, k])
      expect(await cap('video', c.videos[0]!)).toBe(1)                                // só a série; video_antigo sem congelamento não conta
      expect((await alvos(c)).map(x => x.class)).toEqual(['serie'])           // ensaio nunca entra
      await pg.query(`update public.competitor_videos set archive_frozen_at = '2026-09-10T12:00:00Z' where id = $1`, [c.videos[0]])
      await pg.query(`delete from public.obs_archive_item_targets where site_id = $1`, [c.site])
      expect(await cap('video', c.videos[0]!)).toBe(2)
      const a = await alvos(c)
      const ant = a.find(x => x.class === 'video_antigo')!
      expect(ant).toMatchObject({ estado: 'bloqueado', motivo: 'depende_m10b' })
      expect(ant.esperadas).toBeNull()
      // defasada: online com linhas a mais que o row_count da unidade corrente
      await pg.query(`delete from public.obs_archive_item_targets where site_id = $1`, [c.site])
      await pg.query(`update public.obs_archive_units set row_count = row_count + 5 where site_id = $1 and class = 'serie'`, [c.site])
      expect(await cap('video', c.videos[1]!)).toBe(1)
      const d = (await alvos(c)).find(x => x.class === 'serie')!
      expect(d.esperadas).toBeNull()
      // comentário: só gera alvo nas tabelas de texto
      await pg.query(`delete from public.obs_archive_item_targets where site_id = $1`, [c.site])
      const k = await comentario(c, c.videos[0]!, '2026-09-10')
      await unidade(c, 'texto', 'competitor_video_comments', '2026-09-01', 1)
      expect(await cap('comentario', String(k))).toBe(1)
      expect((await alvos(c)).map(x => x.table_name)).toEqual(['competitor_video_comments'])
    })
  })

  it('bandeira: derivada por chave; religa no purge_count; item de canal não é tocado', async () => {
    await emTx(async c => {
      await diaria(c, c.videos, ['2026-09-01'])
      await pg.query(`select public.obs_archive_item_capture($1, 'video', $2, array['ytA'], array[$3::text])`, [c.site, c.canal, c.videos[0]])
      const item = (youtube: string, kind = 'video') => pg.query(
        `insert into public.competitor_removed_items (site_id, kind, youtube_id, competitor_channel_id, decided_at, decided_by, rows_deleted, archive_pending) values ($1, $2, $3, $4, now(), $5, '{}', false) returning id, archive_pending`,
        [c.site, kind, youtube, c.canal, c.actor])
      expect((await item('ytA')).rows[0]!.archive_pending).toBe(true)
      expect((await item('ytB')).rows[0]!.archive_pending).toBe(false)
      expect((await item('ytA', 'canal')).rows[0]!.archive_pending).toBe(false)
      await pg.query(`update public.competitor_removed_items set archive_pending = false where site_id = $1 and youtube_id = 'ytA' and kind = 'video'`, [c.site])
      await pg.query(`update public.competitor_removed_items set purge_count = purge_count + 1 where site_id = $1 and youtube_id = 'ytA' and kind = 'video'`, [c.site])
      expect(await escalar<boolean>(pg, `select archive_pending from public.competitor_removed_items where site_id = $1 and youtube_id = 'ytA' and kind = 'video'`, [c.site])).toBe(true)
    })
  })

  it('link: item_id é o menor dos itens do mesmo alvo', async () => {
    await emTx(async c => {
      await diaria(c, c.videos, ['2026-09-01'])
      await pg.query(`select public.obs_archive_item_capture($1, 'video', $2, array['ytA', 'ytB'], array[$3::text, $4::text])`, [c.site, c.canal, c.videos[0], c.videos[1]])
      const ids: number[] = []
      for (const y of ['ytB', 'ytA']) ids.push((await pg.query(`insert into public.competitor_removed_items (site_id, kind, youtube_id, competitor_channel_id, decided_at, decided_by, rows_deleted) values ($1, 'video', $2, $3, now(), $4, '{}') returning id`, [c.site, y, c.canal, c.actor])).rows[0].id as number)
      expect(Number(((await alvos(c))[0]!).item_id)).toBe(Math.min(...ids.map(Number)))
    })
  })

  it('record: guarda expurgo_em_curso (copiar/aguardando_nova/bloqueado) e passa com alvo concluido; record_core com origem expurgo é livre', async () => {
    await emTx(async c => {
      await diaria(c, c.videos, ['2026-09-01'])
      await pg.query(`select public.obs_archive_item_capture($1, 'video', $2, array['ytA'], array[$3::text])`, [c.site, c.canal, c.videos[0]])
      const payload = (kind: string) => JSON.stringify({ classe: 'serie', tabela: 'competitor_video_daily', canal: c.canal, mes: '2026-09-01', ...(kind === 'resumo' ? { tabela: 'outra' } : {}) })
      const rec = async (kind: string): Promise<{ status?: string }> => {
        const r = await tenta(pg, `select public.obs_archive_record($1, $2, $3::jsonb) as r`, [c.site, kind, payload(kind)])
        return r.ok ? (r.rows[0]!.r as { status?: string }) : { status: `erro:${r.message}` }
      }
      const nUnits = () => escalar(pg, `select count(*)::int from public.obs_archive_units where site_id = $1`, [c.site])
      const antes = await nUnits()
      for (const estado of ['copiar', 'aguardando_nova', 'bloqueado']) {
        await pg.query(`update public.obs_archive_item_targets set estado = $2, motivo = case when $2 = 'bloqueado' then 'depende_m10b' end where site_id = $1`, [c.site, estado])
        expect(await rec('unidade')).toEqual({ status: 'expurgo_em_curso' })
        expect(await rec('resumo')).toEqual({ status: 'expurgo_em_curso' })
      }
      expect(await nUnits()).toBe(antes)
      await pg.query(`update public.obs_archive_item_targets set estado = 'copiar', motivo = null where site_id = $1`, [c.site])
      const core = await tenta(pg, `select public.obs_archive_record_core($1, 'unidade', $2::jsonb, 'expurgo') as r`, [c.site, payload('unidade')])
      expect(core.ok ? (core.rows[0]!.r as { status?: string }).status : core.message).not.toBe('expurgo_em_curso')
      await pg.query(`update public.obs_archive_item_targets set estado = 'concluido', motivo = null, done_at = now() where site_id = $1`, [c.site])
      expect((await rec('unidade')).status).not.toBe('expurgo_em_curso')
    })
  })

  it('injecao: idempotente (uma chamada de cada efeito), preserva v_conta e a recusa; fail-closed', async () => {
    await emTx(async c => {
      const corpo = async (f: string) => (await pg.query(`select prosrc from pg_proc where proname = $1 and pronamespace = 'public'::regnamespace`, [f])).rows[0]!.prosrc as string
      const conta = (t: string, s: string) => t.split(s).length - 1
      const sql = await sqlM9Resolvido(pg, 2)
      await pg.query(sql)                                                             // 2ª aplicação
      for (const [f, t] of [['competitor_video_purge', await corpo('competitor_video_purge')], ['competitor_comments_purge', await corpo('competitor_comments_purge')]] as const) {
        expect(conta(t, 'obs_archive_m9_pronto'), f).toBe(1)
        expect(conta(t, 'obs_archive_item_capture'), f).toBe(1)
      }
      const v = await corpo('competitor_video_purge'); const k = await corpo('competitor_comments_purge'); const ch = await corpo('competitor_channel_purge')
      expect(conta(v, 'yt_watch_readings')).toBe(2)                                   // delete + chave do jsonb; o efeito entra uma vez
      expect(conta(v, 'delete from public.yt_watch_readings')).toBe(1)
      expect(conta(ch, 'delete from public.yt_watch_readings')).toBe(1)
      expect(conta(k, 'v_conta')).toBeGreaterThan(1)
      expect(conta(ch, 'obs_archive_channel_removals')).toBe(0)
      expect(ch).toContain('competitor_channel_remove(')
      // sem a função: m9_sem_e9
      await pg.query('savepoint s1')
      await pg.query(`drop function public.competitor_channel_purge(uuid,uuid,uuid,integer,text,text)`)
      expect(await tenta(pg, sql)).toMatchObject({ ok: false, message: 'm9_sem_e9' })
      await pg.query('rollback to savepoint s1')
      // corpo virgem com md5 diferente: m9_e9_mudou
      await pg.query('savepoint s2')
      const orig = (await pg.query(`select pg_get_functiondef('public.competitor_comments_purge(uuid,uuid,bigint[],uuid,text,text)'::regprocedure) as d`)).rows[0]!.d as string
      const virgem = orig.replace(/perform public\.obs_archive_item_capture\([^;]*;/, '')
      await pg.query(virgem)
      const mudado = virgem.replace('v_conta bigint;', 'v_conta bigint; v_extra integer;')
      await pg.query(mudado)
      expect(await tenta(pg, sql)).toMatchObject({ ok: false, message: 'm9_e9_mudou' })
      await pg.query('rollback to savepoint s2')
      // âncora ausente ou duplicada: m9_e9_ancora
      await pg.query('savepoint s3')
      const sem = virgem.replace('insert into public.competitor_removed_items as r', 'insert into public.competitor_removed_items  as r')
      await pg.query(sem)
      const md5sem = await escalar<string>(pg, `select md5(prosrc) from pg_proc where proname = 'competitor_comments_purge'`)
      const sqlSem = sql.replace(/('competitor_comments_purge', ')[0-9a-f]{32}(')/, `$1${md5sem}$2`)
      expect(await tenta(pg, sqlSem)).toMatchObject({ ok: false, message: 'm9_e9_ancora' })
      await pg.query('rollback to savepoint s3')
    })
  })

  const unidadesDoSite = async (c: Cena) => { await diaria(c, c.videos, ['2026-09-01']) }

  it('recusa: com unidades e M9 desligada, vídeo e comentário levantam m9_desligada e nada muda', async () => {
    await emTx(async c => {
      await sinal(c, c.videos[0]!)
      await unidadesDoSite(c)
      const k = await comentario(c, c.videos[1]!, '2026-09-10')
      const v = await apagarVideo(c)
      expect(v).toMatchObject({ ok: false, message: 'm9_desligada', code: 'P0001' })
      const m = await apagarComentarios(c, [k])
      expect(m).toMatchObject({ ok: false, message: 'm9_desligada' })
      expect(await escalar(pg, `select count(*)::int from public.competitor_videos where id = $1`, [c.videos[0]])).toBe(1)
      expect(await escalar(pg, `select count(*)::int from public.competitor_video_comments where id = $1`, [k])).toBe(1)
      expect(await alvos(c)).toHaveLength(0)
    })
  })

  it('recusa: M9 ligada apaga e captura; sem unidades apaga; o critério é o banco, não o env', async () => {
    await emTx(async c => {
      await sinal(c, c.videos[0]!)
      await unidadesDoSite(c)
      const env = process.env.OBS_ARQUIVO
      delete process.env.OBS_ARQUIVO
      try {
        expect(await apagarVideo(c)).toMatchObject({ ok: false, message: 'm9_desligada' })
      } finally { if (env !== undefined) process.env.OBS_ARQUIVO = env }
      await pg.query(`select public.obs_archive_m9_ligar($1, true)`, [c.site])
      const r = await apagarVideo(c)
      expect(r.ok, JSON.stringify(r)).toBe(true)
      expect((await alvos(c)).length).toBeGreaterThan(0)
    })
    await emTx(async c => {
      await sinal(c, c.videos[0]!)
      const r = await apagarVideo(c)                                                  // M3b fora do ar neste site: sem unidade, sem switch
      expect(r.ok, JSON.stringify(r)).toBe(true)
    })
  })

  it('recusa (emenda 24/10): switch armado ou first_month_at sem unidade recusa; switch de outro site não conta; mutante do critério', async () => {
    const switchDe = (site: string, col: string) => pg.query(`insert into public.obs_archive_switch (site_id, class, ${col}) values ($1, 'serie', now())`, [site])
    for (const col of ['armed_at', 'first_month_at']) {
      await emTx(async c => {
        await sinal(c, c.videos[0]!)
        await switchDe(c.site, col)
        expect(await apagarVideo(c)).toMatchObject({ ok: false, message: 'm9_desligada' })
        const k = await comentario(c, c.videos[1]!, '2026-09-10')
        expect(await apagarComentarios(c, [k])).toMatchObject({ ok: false, message: 'm9_desligada' })
      })
    }
    await emTx(async c => {
      await sinal(c, c.videos[0]!)
      await semearCanal(pg, { site: '00000000-0000-0000-0000-00000000a3b2', videos: 1 })
      await switchDe('00000000-0000-0000-0000-00000000a3b2', 'armed_at')
      const r = await apagarVideo(c)
      expect(r.ok, JSON.stringify(r)).toBe(true)
    })
    await emTx(async c => {
      await sinal(c, c.videos[0]!)
      await switchDe(c.site, 'armed_at')
      await pg.query(`create or replace function public.obs_archive_m9_pronto(p_site uuid) returns void language plpgsql volatile security definer set search_path = '' as $$
        begin if exists (select 1 from public.obs_archive_units x where x.site_id = p_site) and not public.obs_archive_m9_ligado(p_site) then raise exception 'm9_desligada' using errcode = 'P0001'; end if; end $$`)
      expect((await apagarVideo(c)).ok).toBe(true)                                    // o critério só-units deixa passar: o teste de cima cairia
    })
  })

  it('helper: o prosrc de obs_archive_m9_pronto cita obs_archive_switch, é volatile e mantém o lock', async () => {
    await emTx(async () => {
      const r = (await pg.query(`select prosrc, provolatile from pg_proc where proname = 'obs_archive_m9_pronto'`)).rows[0]!
      expect(r.prosrc).toContain('obs_archive_switch')
      expect(r.prosrc).toContain('lock table public.obs_archive_switch in share mode')
      expect(r.provolatile).toBe('v')
    })
  })
})

