// @vitest-environment node
/**
 * A5 · E9 (Tarefa 2): a MG18 (`observatorio_a5_e9_apagar_o_que_saiu`), função por função, contra Postgres de verdade.
 * Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e9-migration.test.ts --no-file-parallelism
 *
 * A migration tem de estar aplicada no banco (o controlador a aplica; nunca `db:reset`). Cada teste abre uma transação, semeia o SEU
 * site e termina em `rollback`. Os cenários que pedem DDL (`tabela nova entra sozinha`, `nível 3 lança`, `chave composta lança`) e
 * `aplica duas vezes` / `recusa sem a MG1` ficam no roteiro psql (`.superpowers/sdd/a5-e9/sql/prova-saida.txt`).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { tenta, q1, escalar, semearCena, criarSite, criarCanal, criarVideo, criarUsuario, type Cena } from '../helpers/mg6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const TITULO = 'TITULO-SEMEADO-NAO-PODE-VAZAR'

describe.skipIf(skipIfNoLocalDb())('A5 E9 Tarefa 2: a MG18, função por função (banco local, cada teste desfeito)', () => {
  let pg: Client

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
    const ok = await escalar<boolean>(pg, `select to_regprocedure('public.competitor_video_purge(uuid,uuid,uuid,integer,text,text)') is not null`)
    if (!ok) throw new Error('MG18 não aplicada no banco de integração (aplique o arquivo da migration; nunca db:reset)')
  })
  afterAll(async () => {
    try { await pg.query('rollback') } catch { /* sem transação aberta */ }
    await pg.end()
  })

  async function dentro<T>(fn: () => Promise<T>): Promise<T> {
    await pg.query('begin')
    try { return await fn() } finally { await pg.query('rollback') }
  }
  const rpc = async (nome: string, args: unknown[]): Promise<Record<string, unknown>> => {
    const marcas = args.map((_, i) => `$${i + 1}`).join(', ')
    return (await escalar<Record<string, unknown>>(pg, `select public.${nome}(${marcas})`, args))
  }
  const ausente = (tabela: 'competitor_videos' | 'competitor_channels' | 'competitor_video_comments', id: string, dias = 5) =>
    pg.query(`update public.${tabela} set missing_since = (now() at time zone 'America/Sao_Paulo')::date - $2::int where id = $1`, [id, dias])
  const n = (tabela: string, col: string, id: string) =>
    escalar<number>(pg, `select count(*)::int from public.${tabela} where ${col} = $1`, [id])
  const TABELAS_DO_VIDEO = ['competitor_video_daily', 'competitor_video_versions', 'competitor_field_versions', 'competitor_changes',
    'competitor_video_early', 'competitor_video_hourly', 'competitor_hour_fold_log', 'competitor_video_comment_snaps', 'competitor_video_tier_spans',
    'competitor_video_comments', 'competitor_readings', 'youtube_intelligence_tasks'] as const
  const COLUNA_VIDEO: Record<string, string> = { competitor_changes: 'video_id', youtube_intelligence_tasks: 'target_video_id' }

  async function cena(): Promise<Cena & { admin: string }> {
    const c = await semearCena(pg)
    await pg.query(`update public.competitor_videos set title = $2 where id = $1`, [c.videoA, TITULO])
    return c
  }
  const comentarios = async (video: string) =>
    (await pg.query(`select id, parent_id from public.competitor_video_comments where video_id = $1 order by id`, [video])).rows as Array<{ id: string; parent_id: string | null }>

  // ───────────────────────── contagem ─────────────────────────

  it('contagem de vídeo = o que some; comentário com resposta não conta duas vezes', async () => {
    await dentro(async () => {
      const c = await cena()
      const prev = await rpc('competitor_purge_preview', [c.site, 'video', c.videoA, 30])
      expect(prev.status).toBe('ok')
      const rows = prev.rows as Record<string, number>
      expect(rows.competitor_videos).toBe(1)
      expect(rows.competitor_video_daily).toBe(3)
      expect(rows.competitor_video_versions).toBe(2)
      expect(rows.competitor_video_comments).toBe(2) // o comentário e a resposta do criador: uma vez cada
      const antes: Record<string, number> = {}
      for (const t of TABELAS_DO_VIDEO) antes[t] = await n(t, COLUNA_VIDEO[t] ?? 'video_id', c.videoA)
      await ausente('competitor_videos', c.videoA)
      const r = await rpc('competitor_video_purge', [c.site, c.videoA, c.admin, 30, null, null])
      expect(r.status).toBe('apagado')
      for (const t of TABELAS_DO_VIDEO) {
        expect(await n(t, COLUNA_VIDEO[t] ?? 'video_id', c.videoA), t).toBe(0)
        if (antes[t]) expect(rows[t], t).toBe(antes[t])
      }
      // prévia = apagado, chave a chave
      expect(r.rows_deleted).toEqual(prev.rows)
    })
  })

  // ───────────────────────── apagar vídeo ─────────────────────────

  it('apagar vídeo: tudo ou nada, linha sem conteúdo, auditoria sem título', async () => {
    await dentro(async () => {
      const c = await cena()
      await ausente('competitor_videos', c.videoA, 7)
      const yt = await escalar<string>(pg, `select video_id from public.competitor_videos where id = $1`, [c.videoA])
      const r = await rpc('competitor_video_purge', [c.site, c.videoA, c.admin, 30, '203.0.113.9', 'agente-de-teste'])
      expect(r.status).toBe('apagado')
      expect(r.purge_count).toBe(1)
      expect(await n('competitor_videos', 'id', c.videoA)).toBe(0)
      const item = await q1(pg, `select * from public.competitor_removed_items where site_id = $1 and kind = 'video'`, [c.site])
      expect(item.youtube_id).toBe(yt)
      expect((item.blobs_pending as string[]).filter(b => b.startsWith('https://'))).toHaveLength(2)
      expect((item.blobs_pending as string[]).filter(b => b.endsWith('/'))).toEqual([`observatorio/thumbs/${c.videoA}/`])
      expect(item.purge_count).toBe(1)
      const aud = await q1(pg, `select * from public.audit_log where site_id = $1 and action = 'competitor_missing_purge'`, [c.site])
      expect(aud.org_id).toBe(c.org)
      expect(JSON.stringify(aud.after_data)).not.toContain(TITULO)
      const tudo = await escalar<number>(pg,
        `select count(*)::int from public.audit_log a where a::text like $1 or exists (select 1 from public.competitor_removed_items i where i::text like $1)`, [`%${TITULO}%`])
      expect(tudo).toBe(0)
      expect(await n('competitor_videos', 'id', c.videoB)).toBe(1) // o outro canal do site, intacto
    })
  })

  it('apagar vídeo: no ar, outro site, janela inválida e IP inválido não apagam', async () => {
    await dentro(async () => {
      const c = await cena()
      expect((await rpc('competitor_video_purge', [c.site, c.videoA, c.admin, 30, null, null])).status).toBe('no_ar')
      await ausente('competitor_videos', c.videoA)
      const outro = await criarSite(pg)
      expect((await rpc('competitor_video_purge', [outro.site, c.videoA, c.admin, 30, null, null])).status).toBe('not_found')
      for (const janela of [0, 241, null]) {
        const t = await tenta(pg, `select public.competitor_video_purge($1,$2,$3,$4,null,null)`, [c.site, c.videoA, c.admin, janela])
        expect(t.ok, `janela ${String(janela)}`).toBe(false)
      }
      const ip = await tenta(pg, `select public.competitor_video_purge($1,$2,$3,30,'abc',null)`, [c.site, c.videoA, c.admin])
      expect(ip.ok).toBe(false)
      expect(await n('competitor_videos', 'id', c.videoA)).toBe(1)
      expect(await n('competitor_removed_items', 'site_id', c.site)).toBe(0)
    })
  })

  it('recusa com tarefa running recente (e sem started_at); pending e running velha não bloqueiam', async () => {
    await dentro(async () => {
      const c = await cena()
      await ausente('competitor_videos', c.videoA)
      const tarefa = await escalar<string>(pg, `select id from public.youtube_intelligence_tasks where target_video_id = $1`, [c.videoA])
      for (const [sql, esperado] of [
        [`status = 'running', started_at = now() - interval '5 minutes'`, 'forja_em_andamento'],
        [`status = 'running', started_at = null`, 'forja_em_andamento'],
      ] as const) {
        await pg.query(`update public.youtube_intelligence_tasks set ${sql} where id = $1`, [tarefa])
        const prev = await rpc('competitor_purge_preview', [c.site, 'video', c.videoA, 30])
        expect(prev.forja_em_andamento).toBe(true)
        expect((await rpc('competitor_video_purge', [c.site, c.videoA, c.admin, 30, null, null])).status).toBe(esperado)
        expect(await n('competitor_videos', 'id', c.videoA)).toBe(1)
        expect(await n('youtube_intelligence_tasks', 'id', tarefa)).toBe(1)
      }
      await pg.query(`update public.youtube_intelligence_tasks set status = 'running', started_at = now() - interval '31 minutes' where id = $1`, [tarefa])
      expect((await rpc('competitor_video_purge', [c.site, c.videoA, c.admin, 30, null, null])).status).toBe('apagado')
      expect(await n('youtube_intelligence_tasks', 'id', tarefa)).toBe(0)
    })
  })

  it('apagar duas vezes soma: purge_count 2, rows_deleted somado, volta zerada', async () => {
    await dentro(async () => {
      const c = await cena()
      await ausente('competitor_videos', c.videoA)
      const yt = await escalar<string>(pg, `select video_id from public.competitor_videos where id = $1`, [c.videoA])
      const a = await rpc('competitor_video_purge', [c.site, c.videoA, c.admin, 30, null, null])
      await pg.query(`update public.competitor_removed_items set returned_seen_at = now(), return_decision = 'voltar', return_decided_at = now() where site_id = $1`, [c.site])
      const novo = (await q1(pg,
        `insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at, discovered_at, missing_since)
         values ($1, $2, 'sintético', now(), now(), current_date - 1) returning id`, [c.canalA, yt])).id as string
      const b = await rpc('competitor_video_purge', [c.site, novo, c.admin, 30, null, null])
      expect(b.purge_count).toBe(2)
      const item = await q1(pg, `select * from public.competitor_removed_items where site_id = $1 and kind = 'video'`, [c.site])
      const soma = item.rows_deleted as Record<string, number>
      const ra = a.rows_deleted as Record<string, number>
      const rb = b.rows_deleted as Record<string, number>
      for (const k of Object.keys(ra)) expect(soma[k], k).toBe(ra[k]! + (rb[k] ?? 0))
      expect([item.returned_seen_at, item.return_decision, item.return_decided_at]).toEqual([null, null, null])
      const pend = item.blobs_pending as string[]
      expect(new Set(pend).size).toBe(pend.length)
    })
  })

  // ───────────────────────── apagar canal ─────────────────────────

  it('apagar canal: um item, prefixo por vídeo, nenhuma linha kind video; sem a M3b o delete direto vale', async () => {
    await dentro(async () => {
      const c = await cena()
      await ausente('competitor_channels', c.canalA)
      const prev = await rpc('competitor_purge_preview', [c.site, 'canal', c.canalA, 30])
      const r = await rpc('competitor_channel_purge', [c.site, c.canalA, c.admin, 30, null, null])
      expect(r.status).toBe('apagado')
      expect(r.rows_deleted).toEqual(prev.rows)
      expect(await n('competitor_channels', 'id', c.canalA)).toBe(0)
      expect(await n('competitor_videos', 'competitor_channel_id', c.canalA)).toBe(0)
      expect(await n('competitor_channels', 'id', c.canalB)).toBe(1)
      expect(await escalar<number>(pg, `select count(*)::int from public.competitor_removed_items where site_id = $1 and kind = 'video'`, [c.site])).toBe(0)
      const item = await q1(pg, `select * from public.competitor_removed_items where site_id = $1 and kind = 'canal'`, [c.site])
      expect((item.blobs_pending as string[]).filter(b => b.endsWith('/'))).toHaveLength(2) // videoA e videoA2
    })
  })

  it('apagar canal chama competitor_channel_remove(..., apagar, fila, ator) quando ela existe (aviso M9); ator e canal certos', async () => {
    await dentro(async () => {
      const c = await cena()
      await ausente('competitor_channels', c.canalA)
      // dublê da função da M3b (a verdadeira vive em rascunho): registra a chamada e apaga o canal, como a original
      await pg.query(`create temp table t_m9_chamadas (site uuid, canal uuid, destino text, via text, ator uuid) on commit drop`)
      await pg.query(`
        create or replace function public.competitor_channel_remove(p_site uuid, p_channel uuid, p_destino text, p_via text, p_actor uuid)
        returns void language plpgsql as $f$ begin
          insert into pg_temp.t_m9_chamadas values (p_site, p_channel, p_destino, p_via, p_actor);
          delete from public.competitor_channels where id = p_channel;
        end $f$`)
      const r = await rpc('competitor_channel_purge', [c.site, c.canalA, c.admin, 30, null, null])
      expect(r.status).toBe('apagado')
      const chamada = await q1(pg, `select * from pg_temp.t_m9_chamadas`)
      expect(chamada).toEqual({ site: c.site, canal: c.canalA, destino: 'apagar', via: 'fila', ator: c.admin })
      expect(await n('competitor_channels', 'id', c.canalA)).toBe(0)
      // o corpo da E9 continua depois do perform: linha sem conteúdo e auditoria
      expect(await escalar<number>(pg, `select count(*)::int from public.competitor_removed_items where site_id = $1 and kind = 'canal'`, [c.site])).toBe(1)
      expect(await escalar<number>(pg, `select count(*)::int from public.audit_log where site_id = $1 and action = 'competitor_missing_purge'`, [c.site])).toBe(1)
    })
  })

  it('apagar canal: recusa com tarefa em andamento num dos vídeos; no ar e outro site não mudam nada', async () => {
    await dentro(async () => {
      const c = await cena()
      expect((await rpc('competitor_channel_purge', [c.site, c.canalA, c.admin, 30, null, null])).status).toBe('no_ar')
      await ausente('competitor_channels', c.canalA)
      await pg.query(`update public.youtube_intelligence_tasks set status = 'running', started_at = now() - interval '2 minutes' where target_video_id = $1`, [c.videoA])
      expect((await rpc('competitor_channel_purge', [c.site, c.canalA, c.admin, 30, null, null])).status).toBe('forja_em_andamento')
      const outro = await criarSite(pg)
      expect((await rpc('competitor_channel_purge', [outro.site, c.canalA, c.admin, 30, null, null])).status).toBe('not_found')
      expect(await n('competitor_channels', 'id', c.canalA)).toBe(1)
    })
  })

  it('lotes_exportados: conta lotes (distintos) do canal; canal sem lote 0; apagar canal encerra os lotes dele e não os de outro', async () => {
    await dentro(async () => {
      const c = await cena()
      const lote = (canal: string, batch: string, tabela: string) => pg.query(
        `insert into public.obs_archive_batches (site_id, batch, kind, table_name, channel_ref, period_start, period_end, row_count, file_sha256, csv_sha256, exported_at)
         values ($1, $2, 'canal', $3, $4, current_date - 30, current_date - 1, 1, repeat('a',64), repeat('b',64), now())`, [c.site, batch, tabela, canal])
      for (const b of ['lote-um', 'lote-dois']) for (const t of ['competitor_video_daily', 'competitor_video_versions', 'competitor_changes']) await lote(c.canalA, b, t)
      await lote(c.canalB, 'lote-tres', 'competitor_video_daily')
      expect((await rpc('competitor_purge_preview', [c.site, 'canal', c.canalA, 30])).lotes_exportados).toBe(2)
      expect((await rpc('competitor_purge_preview', [c.site, 'canal', c.canalB, 30])).lotes_exportados).toBe(1)
      await ausente('competitor_channels', c.canalA)
      const r = await rpc('competitor_channel_purge', [c.site, c.canalA, c.admin, 30, null, null])
      expect(r.lotes_exportados).toBe(2)
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_batches where channel_ref = $1 and closed_reason = 'canal_apagado'`, [c.canalA])).toBe(6)
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_batches where channel_ref = $1 and closed_at is null`, [c.canalB])).toBe(1)
    })
  })

  it('lotes_exportados é null (nunca 0) quando a tabela de lotes não existe', async () => {
    await dentro(async () => {
      const c = await cena()
      await pg.query(`alter table public.obs_archive_batches rename to obs_archive_batches_off`)
      expect((await rpc('competitor_purge_preview', [c.site, 'video', c.videoA, 30])).lotes_exportados).toBeNull()
      await ausente('competitor_channels', c.canalA)
      const r = await rpc('competitor_channel_purge', [c.site, c.canalA, c.admin, 30, null, null])
      expect(r.status).toBe('apagado')
      expect(r.lotes_exportados).toBeNull()
    })
  })

  // ───────────────────────── comentários ─────────────────────────

  it('apagar comentários: o pedido e a resposta do criador; uma linha por comentário; auditoria sem id', async () => {
    await dentro(async () => {
      const c = await cena()
      const cs = await comentarios(c.videoA)
      const raiz = cs.find(x => x.parent_id === null)!.id
      await ausente('competitor_video_comments', raiz)
      const prev = await rpc('competitor_comments_preview', [c.site, c.canalA, [raiz]])
      expect(prev).toMatchObject({ status: 'ok', encontrados: 1, respostas: 1 })
      const r = await rpc('competitor_comments_purge', [c.site, c.canalA, [raiz], c.admin, null, null])
      expect(r).toMatchObject({ status: 'apagado', comentarios: 2 })
      expect(r.rows_deleted).toEqual(prev.rows)
      expect(await comentarios(c.videoA)).toHaveLength(0)
      expect(await escalar<number>(pg, `select count(*)::int from public.competitor_removed_items where site_id = $1 and kind = 'comentario'`, [c.site])).toBe(2)
      expect(await n('competitor_videos', 'id', c.videoA)).toBe(1)
      const aud = await q1(pg, `select after_data::text as t from public.audit_log where site_id = $1 and action = 'competitor_missing_purge'`, [c.site])
      for (const id of cs.map(x => String(x.id))) expect(String(aud.t)).not.toMatch(new RegExp(`"${id}"`))
      const grupos = (await rpc('competitor_removed_comment_groups', [c.site])) as unknown as Array<Record<string, unknown>>
      expect(grupos).toHaveLength(1)
      expect(grupos[0]).toMatchObject({ competitor_channel_id: c.canalA, comentarios: 2 })
      const outro = await criarSite(pg)
      expect(await rpc('competitor_removed_comment_groups', [outro.site])).toEqual([])
    })
  })

  it('apagar comentários: a lista mudou, canal ou site errado, 501 ids e lista vazia', async () => {
    await dentro(async () => {
      const c = await cena()
      const cs = await comentarios(c.videoA)
      const raiz = cs.find(x => x.parent_id === null)!.id
      const noAr = cs.find(x => x.parent_id !== null)!.id
      await ausente('competitor_video_comments', raiz)
      const mudou = await rpc('competitor_comments_purge', [c.site, c.canalA, [raiz, noAr], c.admin, null, null])
      expect(mudou).toMatchObject({ status: 'mudou', pedidos: 2, encontrados: 1 })
      expect((await rpc('competitor_comments_purge', [c.site, c.canalB, [raiz], c.admin, null, null])).status).toBe('not_found')
      const outro = await criarSite(pg)
      expect((await rpc('competitor_comments_purge', [outro.site, c.canalA, [raiz], c.admin, null, null])).status).toBe('not_found')
      for (const ids of [Array.from({ length: 501 }, (_, i) => i + 1), []]) {
        expect((await tenta(pg, `select public.competitor_comments_purge($1,$2,$3::bigint[],$4,null,null)`, [c.site, c.canalA, ids, c.admin])).ok).toBe(false)
      }
      expect(await comentarios(c.videoA)).toHaveLength(2)
    })
  })

  // ───────────────────────── manter, voltar, Blob ─────────────────────────

  it('manter: só o ausente sem decisão do site; o já mantido não muda; auditoria por item', async () => {
    await dentro(async () => {
      const c = await cena()
      await ausente('competitor_videos', c.videoA)
      await ausente('competitor_videos', c.videoA2)
      await pg.query(`update public.competitor_videos set removal_decision = 'manter', removal_decided_at = now() - interval '3 days' where id = $1`, [c.videoA2])
      const antes = await escalar<string>(pg, `select removal_decided_at::text from public.competitor_videos where id = $1`, [c.videoA2])
      const r = await rpc('competitor_missing_keep', [c.site, 'video', [c.videoA, c.videoA2, c.videoB], null, c.admin, null, null])
      expect(r).toMatchObject({ status: 'mantido', mantidos: 1 }) // videoB está no ar
      expect(await escalar<string>(pg, `select removal_decided_at::text from public.competitor_videos where id = $1`, [c.videoA2])).toBe(antes)
      expect(await escalar<number>(pg, `select count(*)::int from public.audit_log where site_id = $1 and action = 'competitor_missing_keep'`, [c.site])).toBe(1)
      const outro = await criarSite(pg)
      expect(await rpc('competitor_missing_keep', [outro.site, 'video', [c.videoA], null, c.admin, null, null])).toMatchObject({ status: 'nada', mantidos: 0 })
    })
  })

  it('voltar e ignorar; pendência do Blob', async () => {
    await dentro(async () => {
      const c = await cena()
      const ins = async (kind: string, yt: string, extra = '') => (await q1(pg,
        `insert into public.competitor_removed_items (site_id, kind, youtube_id, decided_by, rows_deleted, blobs_pending ${extra ? ', returned_seen_at' : ''})
         values ($1, $2, $3, $4, '{}'::jsonb, '{a,b,c}'::text[] ${extra ? ', now()' : ''}) returning id`, [c.site, kind, yt, c.admin])).id as string
      const v = await ins('video', 'vid-x', 'visto')
      const cm = await ins('comentario', 'cm-x', 'visto')
      expect(await rpc('competitor_return_decide', [c.site, v, 'voltar', c.admin, null, null])).toMatchObject({ status: 'ok', decision: 'voltar' })
      expect(await rpc('competitor_return_decide', [c.site, v, 'voltar', c.admin, null, null])).toMatchObject({ status: 'nada' })
      expect(await rpc('competitor_return_decide', [c.site, cm, 'voltar', c.admin, null, null])).toMatchObject({ status: 'nada' })
      expect((await tenta(pg, `select public.competitor_return_decide($1,$2,'talvez',$3,null,null)`, [c.site, cm, c.admin])).ok).toBe(false)
      const aud = await q1(pg, `select after_data::text as t from public.audit_log where site_id = $1 and action = 'competitor_return_follow'`, [c.site])
      expect(String(aud.t)).toContain('vid-x')
      // Blob: 3 pendentes, 2 confirmados e 1 que não existe
      expect(await rpc('competitor_removed_blobs_done', [c.site, v, ['a', 'b', 'zzz']])).toMatchObject({ status: 'ok', restam: 1 })
      const outro = await criarSite(pg)
      expect((await rpc('competitor_removed_blobs_done', [outro.site, v, ['c']])).status).toBe('not_found')
      expect(await escalar<string[]>(pg, `select blobs_pending from public.competitor_removed_items where id = $1`, [v])).toEqual(['c'])
    })
  })

  // ───────────────────────── prova e contador ─────────────────────────

  it('prova: fila vazia, piso uma vez, queda acusa, volta ao ar sai, canal ausente entra, outro site não entra', async () => {
    await dentro(async () => {
      const c = await cena()
      const agora = new Date().toISOString()
      const vazia = await rpc('competitor_missing_proof', [c.site, agora])
      expect(vazia).toMatchObject({ videos_ausentes: 0, ausentes_com_queda: 0, pisos_novos: 0, esperando: 0, apagando: 0, mais_antigo_dias: null })
      await ausente('competitor_videos', c.videoA, 3)
      await ausente('competitor_videos', c.videoA2, 9)
      expect(await rpc('competitor_missing_proof', [c.site, agora])).toMatchObject({ videos_ausentes: 2, pisos_novos: 2, ausentes_com_queda: 0, esperando: 2, mais_antigo_dias: 9 })
      expect(await rpc('competitor_missing_proof', [c.site, agora])).toMatchObject({ pisos_novos: 0, ausentes_com_queda: 0 })
      await pg.query(`delete from public.competitor_video_daily where video_id = $1 and snap_date = current_date - 1`, [c.videoA])
      expect(await rpc('competitor_missing_proof', [c.site, agora])).toMatchObject({ ausentes_com_queda: 1 })
      await pg.query(`update public.competitor_videos set missing_since = null where id = $1`, [c.videoA])
      expect(await rpc('competitor_missing_proof', [c.site, agora])).toMatchObject({ ausentes_com_queda: 0, videos_ausentes: 1 })
      await ausente('competitor_channels', c.canalB, 2)
      expect(await rpc('competitor_missing_proof', [c.site, agora])).toMatchObject({ videos_ausentes: 2, pisos_novos: 1 }) // o vídeo do canal ausente ganha piso
      const outro = await criarSite(pg)
      expect(await rpc('competitor_missing_proof', [outro.site, agora])).toMatchObject({ videos_ausentes: 0 })
      for (const args of [[null, agora], [c.site, null]]) expect((await tenta(pg, `select public.competitor_missing_proof($1,$2)`, args)).ok).toBe(false)
    })
  })

  it('prova: apagando e apagando_ha_mais_de_1d olham só o Blob (aviso M9); contador conta cada linha uma vez', async () => {
    await dentro(async () => {
      const c = await cena()
      const ins = (yt: string, horas: number, blobs: string, extra = '') => pg.query(
        `insert into public.competitor_removed_items (site_id, kind, youtube_id, decided_by, rows_deleted, blobs_pending, decided_at ${extra ? ', returned_seen_at' : ''}, archive_pending)
         values ($1, 'video', $2, $3, '{}'::jsonb, $4::text[], now() - make_interval(hours => $5) ${extra ? ', now()' : ''}, false)`, [c.site, yt, c.admin, blobs, horas])
      await ins('antigo', 25, '{x}')
      await ins('novo', 2, '{y}')
      expect(await rpc('competitor_missing_proof', [c.site, new Date().toISOString()])).toMatchObject({ apagando: 2, apagando_ha_mais_de_1d: 1 })
      // só o arquivo pendente (sem Blob): apagando conta, mas o vermelho de 24 h não
      await pg.query(`update public.competitor_removed_items set blobs_pending = '{}', archive_pending = true where site_id = $1 and youtube_id = 'antigo'`, [c.site])
      expect(await rpc('competitor_missing_proof', [c.site, new Date().toISOString()])).toMatchObject({ apagando: 2, apagando_ha_mais_de_1d: 0 })
      // contador
      await ins('apagando-e-voltou', 3, '{z}', 'visto')
      await ins('voltou-limpo', 3, '{}', 'visto')
      for (let i = 0; i < 7; i++) {
        await pg.query(`insert into public.competitor_removed_items (site_id, kind, youtube_id, competitor_channel_id, decided_by, rows_deleted, returned_seen_at)
                        values ($1, 'comentario', $2, $3, $4, '{}'::jsonb, now())`, [c.site, `cm-${i}`, c.canalA, c.admin])
      }
      const cont = await rpc('competitor_missing_count', [c.site])
      expect(cont).toMatchObject({ apagando: 3, voltaram: 2 }) // o vídeo sem pendência e o grupo de comentários
    })
  })

  // ───────────────────────── definição ─────────────────────────

  it('as duas funções de apagar não são security definer e carregam o teto de 30 s na definição', async () => {
    const r = await pg.query(`select proname, proconfig, prosecdef from pg_proc where proname in ('competitor_video_purge','competitor_channel_purge') and pronamespace = 'public'::regnamespace order by 1`)
    expect(r.rows).toHaveLength(2)
    for (const l of r.rows as Array<{ proconfig: string[]; prosecdef: boolean }>) {
      expect(l.proconfig).toContain('statement_timeout=30s')
      expect(l.prosecdef).toBe(false)
    }
  })

  // Medido em 15/10 (n6b): o `set statement_timeout` da definição VALE pela API. Função de 12 s com `set ... '30s'` passa pelo PostgREST;
  // a mesma sem o `set` cai em 8 s (teto do authenticator) com 57014. O teste prova o comportamento, não o texto da migration.
  // Sem API local configurada (só SUPABASE_DB_URL), o caso aparece como pulado, nunca verde sem provar nada.
  it.skipIf(!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)('pela API (PostgREST), o teto da definição vale: 12 s com set 30 s passa; sem o set, o authenticator corta em 8 s', async () => {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const chave = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const teto = (await pg.query(`select p.proconfig from pg_proc p where p.proname = 'competitor_channel_purge' and p.pronamespace = 'public'::regnamespace`)).rows[0].proconfig as string[]
    const valor = teto.find((c) => c.startsWith('statement_timeout='))!.split('=')[1]
    try {
      await pg.query(`create or replace function public.zz_teto_com() returns int language plpgsql set statement_timeout = '${valor}' as $$ begin perform pg_sleep(11); return 1; end $$`)
      await pg.query(`create or replace function public.zz_teto_sem() returns int language plpgsql as $$ begin perform pg_sleep(11); return 1; end $$`)
      await pg.query(`grant execute on function public.zz_teto_com(), public.zz_teto_sem() to service_role`)
      await pg.query(`notify pgrst, 'reload schema'`)
      await new Promise((r) => setTimeout(r, 1500))
      const chama = async (f: string) => {
        const t0 = Date.now()
        const res = await fetch(`${base}/rest/v1/rpc/${f}`, { method: 'POST', headers: { apikey: chave, Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' }, body: '{}' })
        return { status: res.status, corpo: await res.json() as unknown, ms: Date.now() - t0 }
      }
      const sem = await chama('zz_teto_sem')
      expect(sem.status).toBeGreaterThanOrEqual(400)
      expect(JSON.stringify(sem.corpo)).toContain('57014')
      expect(sem.ms).toBeLessThan(10_000)
      const com = await chama('zz_teto_com')
      expect(com.status).toBe(200)
      expect(com.corpo).toBe(1)
      expect(com.ms).toBeGreaterThan(10_000)
    } finally {
      await pg.query(`drop function if exists public.zz_teto_com(); drop function if exists public.zz_teto_sem()`)
    }
  }, 40_000)

  it('as chaves estrangeiras de competitor_videos que apagam em cascata têm índice com a coluna na frente (tarefas da forja e leituras)', async () => {
    const r = await pg.query(`select c.conrelid::regclass::text as tabela, a.attname as coluna
      from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f' and c.confdeltype = 'c' and c.conparentid = 0 and c.confrelid = 'public.competitor_videos'::regclass
        and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])`)
    expect(r.rows).toEqual([])
  })

  it('contagem: tabela filha PARTICIONADA conta uma vez (a mãe), sem as chaves das partições', async () => {
    await dentro(async () => {
      const c = await cena()
      await pg.query(`create table public.zz_part (video_id uuid not null references public.competitor_videos(id) on delete cascade, dia int not null) partition by list (dia)`)
      await pg.query(`create table public.zz_part_a partition of public.zz_part for values in (1)`)
      await pg.query(`create table public.zz_part_b partition of public.zz_part for values in (2)`)
      await pg.query(`insert into public.zz_part values ($1, 1), ($1, 2)`, [c.videoA])
      const prev = await rpc('competitor_cascade_counts', ['video', c.videoA])
      expect(prev.zz_part).toBe(2)
      expect(Object.keys(prev).filter((k) => k.startsWith('zz_part_'))).toEqual([])
    })
  })

  it('o usuário criado só serve para o ator: criarUsuario/criarCanal/criarVideo continuam disponíveis para as semeaduras', async () => {
    await dentro(async () => {
      const { site } = await criarSite(pg)
      const canal = await criarCanal(pg, site)
      const video = await criarVideo(pg, canal, 1)
      const ator = await criarUsuario(pg, randomUUID())
      expect((await rpc('competitor_video_purge', [site, video, ator, 30, null, null])).status).toBe('no_ar')
    })
  })
})
