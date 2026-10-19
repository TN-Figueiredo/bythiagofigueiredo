// @vitest-environment node
/**
 * A5 · F1 do "Remover canal" (só banco). Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-remover-f1.test.ts --no-file-parallelism
 * Cada caso abre uma transação (MG6 + F1 reaplicadas) e termina em `rollback`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import {
  emTransacao, semearCena, pausarEEnvelhecer, registrar, exportarConferirConfirmar, q1, escalar, tenta, codigoE10, criarCanal, criarVideo, criarUsuario,
  semearWatchDoVideo, type Cena,
} from '../helpers/mg6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

describe.skipIf(skipIfNoLocalDb())('F1 §A: yt_watch no arquivo, remoção arquivada e pausa', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { try { await pg.query('rollback') } catch { /* nada aberto */ } await pg.end() })

  const ytDe = async (video: string) => (await q1(pg, `select video_id from public.competitor_videos where id = $1`, [video])).video_id as string
  const contaWatch = async (site: string, yt: string) => ({
    l: await escalar<number>(pg, `select count(*)::int from public.yt_watch_readings where site_id = $1 and youtube_video_id = $2`, [site, yt]),
    t: await escalar<number>(pg, `select count(*)::int from public.yt_watch_thumbs where site_id = $1 and youtube_video_id = $2`, [site, yt]),
    a: await escalar<number>(pg, `select count(*)::int from public.yt_watch_alvos where site_id = $1 and youtube_video_id = $2`, [site, yt]),
  })

  /** Cena sem a semente padrão da watch: 1 alvo, 1 miniatura e 3 leituras no vídeo A; 1 alvo e 1 leitura no vídeo B (controle). */
  async function cena(): Promise<{ c: Cena; ytA: string; ytB: string }> {
    const c = await semearCena(pg, { semWatch: true })
    const ytA = await ytDe(c.videoA)
    const ytB = await ytDe(c.videoB)
    await semearWatchDoVideo(pg, c.site, ytA, { leituras: 3, miniaturas: 1, alvo: true })
    await semearWatchDoVideo(pg, c.site, ytB, { leituras: 1, miniaturas: 0, alvo: true })
    return { c, ytA, ytB }
  }

  it('B1.1 o registro tem as 3 yt_watch na ordem e 30 entradas', async () => {
    await emTransacao(pg, async () => {
      const nomes = (await pg.query(`select table_name from public.obs_archive_registry()`)).rows.map((r: { table_name: string }) => r.table_name)
      expect(nomes).toHaveLength(30)
      for (const n of ['yt_watch_alvos', 'yt_watch_thumbs', 'yt_watch_readings']) expect(nomes).toContain(n)
      expect(nomes.indexOf('yt_watch_thumbs')).toBeLessThan(nomes.indexOf('yt_watch_readings'))
      expect(await escalar<unknown>(pg, `select public.obs_archive_uncovered()`)).toEqual([])
    })
  })

  it('B1.2 contagem por canal: o controle não entra', async () => {
    await emTransacao(pg, async () => {
      const { c } = await cena()
      const r = (await pg.query(`select table_name, sum(row_count)::int n from public.obs_archive_channel_counts($1) where table_name like 'yt_watch%' group by 1`, [c.canalA])).rows
      const m = Object.fromEntries(r.map((x: { table_name: string; n: number }) => [x.table_name, x.n]))
      expect(m).toEqual({ yt_watch_readings: 3, yt_watch_thumbs: 1, yt_watch_alvos: 1 })
    })
  })

  it('B1.3 ida e volta completa: remove o canal e a watch dele, o controle fica intacto', async () => {
    await emTransacao(pg, async () => {
      const { c, ytA, ytB } = await cena()
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-f1-b13')
      const r = (await q1(pg, `select public.competitor_channel_remove_archived($1, $2, $3) as r`, [c.site, c.canalA, c.admin])).r as { status: string; watch: Record<string, number> }
      expect(r.status).toBe('removido')
      expect(r.watch).toEqual({ readings: 3, thumbs: 1, alvos: 1 })
      expect(await contaWatch(c.site, ytA)).toEqual({ l: 0, t: 0, a: 0 })
      expect(await contaWatch(c.site, ytB)).toEqual({ l: 1, t: 0, a: 1 })
    })
  })

  it('B1.4 leitura nova depois do export recusa a remoção e nada some', async () => {
    await emTransacao(pg, async () => {
      const { c, ytA } = await cena()
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-f1-b14')
      await semearWatchDoVideo(pg, c.site, ytA, { leituras: 1, miniaturas: 0, alvo: false })
      const t = await tenta(pg, `select public.competitor_channel_remove_archived($1, $2, $3)`, [c.site, c.canalA, c.admin])
      expect(t.ok).toBe(false)
      if (!t.ok) expect(codigoE10(t.message)).toBe('banco_difere_do_manifesto')
    })
  })

  it('B1.4b troca de linha no mesmo mês recusa; miniatura com vistas+1 também', async () => {
    await emTransacao(pg, async () => {
      const { c, ytA } = await cena()
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-f1-b14b')
      await pg.query(`delete from public.yt_watch_readings where id = (select min(id) from public.yt_watch_readings where site_id = $1 and youtube_video_id = $2)`, [c.site, ytA])
      await pg.query(
        `insert into public.yt_watch_readings (site_id, youtube_video_id, lida_em, rodada_id, origem_rede, versao_leitor, http, idioma, titulo_oficial, titulo_oficial_fonte, renderers_presentes)
         select site_id, youtube_video_id, lida_em, $3, origem_rede, versao_leitor, http, idioma, titulo_oficial, titulo_oficial_fonte, renderers_presentes
           from public.yt_watch_readings where site_id = $1 and youtube_video_id = $2 limit 1`, [c.site, ytA, randomUUID()])
      let t = await tenta(pg, `select public.competitor_channel_remove_archived($1, $2, $3)`, [c.site, c.canalA, c.admin])
      expect(t.ok).toBe(false)
      if (!t.ok) expect(codigoE10(t.message)).toBe('banco_difere_do_manifesto')
    })
    await emTransacao(pg, async () => {
      const { c, ytA } = await cena()
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-f1-b14c')
      await pg.query(`update public.yt_watch_thumbs set vistas = vistas + 1 where site_id = $1 and youtube_video_id = $2`, [c.site, ytA])
      const t = await tenta(pg, `select public.competitor_channel_remove_archived($1, $2, $3)`, [c.site, c.canalA, c.admin])
      expect(t.ok).toBe(false)
      if (!t.ok) expect(codigoE10(t.message)).toBe('banco_difere_do_manifesto')
    })
  })

  it('B1.5 pausar tira os alvos da fila (só do canal); pausar de novo não mexe; despausar e conciliar reativa', async () => {
    await emTransacao(pg, async () => {
      const { c, ytA, ytB } = await cena()
      await pg.query(`select public.competitor_channel_pause($1, $2, $3)`, [c.site, c.canalA, c.admin])
      const a = await q1(pg, `select saiu_por, saiu_em from public.yt_watch_alvos where site_id = $1 and youtube_video_id = $2`, [c.site, ytA])
      expect(a.saiu_por).toBe('removido')
      expect(a.saiu_em).not.toBeNull()
      expect((await q1(pg, `select saiu_em from public.yt_watch_alvos where site_id = $1 and youtube_video_id = $2`, [c.site, ytB])).saiu_em).toBeNull()
      const antes = (await q1(pg, `select saiu_em::text s from public.yt_watch_alvos where site_id = $1 and youtube_video_id = $2`, [c.site, ytA])).s
      await pg.query(`select public.competitor_channel_pause($1, $2, $3)`, [c.site, c.canalA, c.admin])
      expect((await q1(pg, `select saiu_em::text s from public.yt_watch_alvos where site_id = $1 and youtube_video_id = $2`, [c.site, ytA])).s).toBe(antes)
      await pg.query(`select public.competitor_channel_unpause($1, $2, $3)`, [c.site, c.canalA, c.admin])
      const cand = JSON.stringify([{ site_id: c.site, youtube_video_id: ytA, tipo: 'concorrente', motivo_ate: 'janela_concorrente', coleta_ate: new Date(Date.now() + 20 * 86_400_000).toISOString(), hora_base_min: 60, rodadas_por_dia: 4 }])
      await pg.query(`select public.yt_watch_conciliar(now(), $1::jsonb)`, [cand])
      expect((await q1(pg, `select saiu_em from public.yt_watch_alvos where site_id = $1 and youtube_video_id = $2`, [c.site, ytA])).saiu_em).toBeNull()
    })
  })

  it('B1.6 alvo próprio com o mesmo id em outro site não é tocado', async () => {
    await emTransacao(pg, async () => {
      const { c, ytA } = await cena()
      const outro = await semearCena(pg, { semWatch: true })
      await semearWatchDoVideo(pg, outro.site, ytA, { leituras: 0, miniaturas: 0, alvo: true, tipo: 'proprio' })
      await pg.query(`select public.competitor_channel_pause($1, $2, $3)`, [c.site, c.canalA, c.admin])
      expect((await q1(pg, `select saiu_em from public.yt_watch_alvos where site_id = $1 and youtube_video_id = $2`, [outro.site, ytA])).saiu_em).toBeNull()
    })
  })

  it('B1.7 canal já pausado antes da migration: o backfill tira o alvo', async () => {
    await emTransacao(pg, async () => {
      const { c, ytA } = await cena()
      await pg.query(`alter table public.competitor_channels disable trigger competitor_channels_pausa_tira_watch`)
      await pg.query(`update public.competitor_channels set collection_paused_at = now() - interval '1 day' where id = $1`, [c.canalA])
      expect((await q1(pg, `select saiu_em from public.yt_watch_alvos where site_id = $1 and youtube_video_id = $2`, [c.site, ytA])).saiu_em).toBeNull()
      await pg.query(`alter table public.competitor_channels enable trigger competitor_channels_pausa_tira_watch`)
      const { lerSqlDaF1 } = await import('../helpers/f1-sql')
      await pg.query(lerSqlDaF1()!)
      expect((await q1(pg, `select saiu_por from public.yt_watch_alvos where site_id = $1 and youtube_video_id = $2`, [c.site, ytA])).saiu_por).toBe('removido')
    })
  })

  it('B1.8 vídeo compartilhado recusa no caminho 2 (outro canal ou alvo próprio)', async () => {
    await emTransacao(pg, async () => {
      const { c, ytA } = await cena()
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-f1-b18')
      await pg.query(`insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at, discovered_at) values ($1, $2, 'x', now(), now())`, [c.canalB, ytA])
      const t = await tenta(pg, `select public.competitor_channel_remove_archived($1, $2, $3)`, [c.site, c.canalA, c.admin])
      expect(t.ok).toBe(false)
      if (!t.ok) expect(codigoE10(t.message)).toBe('video_compartilhado')
      const r = await tenta(pg, `select public.competitor_channel_request_removal($1, $2, $3, 'teste')`, [c.site, c.canalA, c.admin])
      expect(r.ok).toBe(false)
      if (!r.ok) expect(codigoE10(r.message)).toBe('video_compartilhado')
      expect((await q1(pg, `select removal_requested_at from public.competitor_channels where id = $1`, [c.canalA])).removal_requested_at).toBeNull()
    })
    await emTransacao(pg, async () => {
      const { c, ytA } = await cena()
      await pg.query(`delete from public.yt_watch_alvos where site_id = $1 and youtube_video_id = $2`, [c.site, ytA])
      await semearWatchDoVideo(pg, c.site, ytA, { leituras: 0, miniaturas: 0, alvo: true, tipo: 'proprio' })
      const r = await tenta(pg, `select public.competitor_channel_request_removal($1, $2, $3, 'teste')`, [c.site, c.canalA, c.admin])
      expect(r.ok).toBe(false)
      if (!r.ok) expect(codigoE10(r.message)).toBe('video_compartilhado')
    })
  })
})

describe.skipIf(skipIfNoLocalDb())('F1 §B: remoção pedida e Desfazer', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { try { await pg.query('rollback') } catch { /* nada aberto */ } await pg.end() })

  const pedir = (c: Cena, canal: string, motivo: string | null = 'entrou_por_engano') =>
    q1(pg, `select public.competitor_channel_request_removal($1, $2, $3, $4) as r`, [c.site, canal, c.admin, motivo]).then(x => x.r as Record<string, unknown>)
  const cancelar = (c: Cena, canal: string) =>
    q1(pg, `select public.competitor_channel_cancel_removal($1, $2, $3) as r`, [c.site, canal, c.admin]).then(x => x.r as Record<string, unknown>)
  const canal = (id: string) => q1(pg, `select * from public.competitor_channels where id = $1`, [id])
  const ytDe = async (video: string) => (await q1(pg, `select video_id from public.competitor_videos where id = $1`, [video])).video_id as string

  it('B2.1 pedir pausa e marca; alvos saem da fila; auditoria', async () => {
    await emTransacao(pg, async () => {
      const c = await semearCena(pg)
      const r = await pedir(c, c.canalA)
      expect(r.status).toBe('pedido')
      const l = await canal(c.canalA)
      expect(l.collection_paused_at).not.toBeNull()
      expect(l.removal_requested_at).not.toBeNull()
      expect(l.removal_was_paused).toBe(false)
      expect(l.removal_reason).toBe('entrou_por_engano')
      expect(await escalar<number>(pg, `select count(*)::int from public.competitor_collection_pauses where competitor_channel_id = $1`, [c.canalA])).toBe(1)
      expect(await escalar<number>(pg, `select count(*)::int from public.yt_watch_alvos where site_id = $1 and youtube_video_id = $2 and saiu_por = 'removido'`, [c.site, await ytDe(c.videoA)])).toBe(1)
      const a = await q1(pg, `select after_data from public.audit_log where site_id = $1 and action = 'observatorio_remocao_pedida'`, [c.site])
      expect(a.after_data).toMatchObject({ motivo: 'entrou_por_engano', ja_pausado: false })
    })
  })

  it('B2.2 pedir de novo: ja_pedido, sem 2ª pausa nem 2ª auditoria', async () => {
    await emTransacao(pg, async () => {
      const c = await semearCena(pg)
      await pedir(c, c.canalA)
      expect((await pedir(c, c.canalA)).status).toBe('ja_pedido')
      expect(await escalar<number>(pg, `select count(*)::int from public.competitor_collection_pauses where competitor_channel_id = $1`, [c.canalA])).toBe(1)
      expect(await escalar<number>(pg, `select count(*)::int from public.audit_log where site_id = $1 and action = 'observatorio_remocao_pedida'`, [c.site])).toBe(1)
    })
  })

  it('B2.3 canal já pausado: o Desfazer não despausa', async () => {
    await emTransacao(pg, async () => {
      const c = await semearCena(pg)
      await pg.query(`select public.competitor_channel_pause($1, $2, $3)`, [c.site, c.canalA, c.admin])
      await pedir(c, c.canalA)
      expect((await canal(c.canalA)).removal_was_paused).toBe(true)
      const r = await cancelar(c, c.canalA)
      expect(r.despausado).toBe(false)
      expect((await canal(c.canalA)).collection_paused_at).not.toBeNull()
    })
  })

  it('B2.4 Desfazer despausa, zera as colunas, audita; lote aberto é invalidado', async () => {
    await emTransacao(pg, async () => {
      const c = await semearCena(pg)
      await pedir(c, c.canalA)
      await pg.query(`update public.competitor_channels set collection_paused_at = collection_paused_at - interval '10 minutes' where id = $1`, [c.canalA])
      await pg.query(`update public.competitor_collection_pauses set paused_at = paused_at - interval '10 minutes' where competitor_channel_id = $1`, [c.canalA])
      await registrar(pg, c, c.canalA, 'lote-f1-b24')
      await pg.query(`select public.obs_archive_verify($1, 'lote-f1-b24', $2)`, [c.site, c.canalA])
      const r = await cancelar(c, c.canalA)
      expect(r).toMatchObject({ status: 'cancelado', despausado: true })
      expect(Number(r.arquivos_invalidados)).toBeGreaterThan(0)
      const l = await canal(c.canalA)
      expect([l.collection_paused_at, l.removal_requested_at, l.removal_requested_by, l.removal_was_paused, l.removal_reason]).toEqual([null, null, null, null, null])
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_batches where batch = 'lote-f1-b24' and closed_reason = 'despausado'`)).toBeGreaterThan(0)
      expect(await escalar<number>(pg, `select count(*)::int from public.audit_log where site_id = $1 and action = 'observatorio_remocao_cancelada'`, [c.site])).toBe(1)
    })
  })

  it('B2.5 Desfazer sem vaga recusa; B2.5b na fronteira aceita', async () => {
    await emTransacao(pg, async () => {
      const c = await semearCena(pg)
      await pg.query(`insert into public.competitor_settings (site_id, channel_limit) values ($1, 2) on conflict (site_id) do update set channel_limit = 2`, [c.site])
      await pedir(c, c.canalA)
      await criarCanal(pg, c.site, 'Canal C')
      const t = await tenta(pg, `select public.competitor_channel_cancel_removal($1, $2, $3)`, [c.site, c.canalA, c.admin])
      expect(t.ok).toBe(false)
      if (!t.ok) expect(codigoE10(t.message)).toBe('sem_vaga')
      expect((await canal(c.canalA)).removal_requested_at).not.toBeNull()
      expect((await canal(c.canalA)).collection_paused_at).not.toBeNull()
    })
    await emTransacao(pg, async () => {
      const c = await semearCena(pg)
      await pg.query(`insert into public.competitor_settings (site_id, channel_limit) values ($1, 2) on conflict (site_id) do update set channel_limit = 2`, [c.site])
      await pedir(c, c.canalA)
      expect((await cancelar(c, c.canalA)).status).toBe('cancelado')
    })
  })

  it('B2.6 travas: editor, outro site, saiu do YouTube, sem pedido, parâmetros', async () => {
    await emTransacao(pg, async () => {
      const c = await semearCena(pg)
      const outro = await semearCena(pg)
      for (const f of ['request_removal', 'cancel_removal']) {
        const extra = f === 'request_removal' ? ", 'x'" : ''
        const t = await tenta(pg, `select public.competitor_channel_${f}($1, $2, $3${extra})`, [c.site, c.canalA, c.comum])
        expect(t.ok).toBe(false)
        if (!t.ok) expect(codigoE10(t.message)).toBe('sem_direito')
        const o = await tenta(pg, `select public.competitor_channel_${f}($1, $2, $3${extra})`, [c.site, outro.canalA, c.admin])
        expect(o.ok).toBe(false)
        if (!o.ok) expect(codigoE10(o.message)).toBe('canal_nao_encontrado')
      }
      await pg.query(`update public.competitor_channels set missing_since = current_date where id = $1`, [c.canalB])
      const s = await tenta(pg, `select public.competitor_channel_request_removal($1, $2, $3, 'x')`, [c.site, c.canalB, c.admin])
      expect(s.ok).toBe(false)
      if (!s.ok) expect(codigoE10(s.message)).toBe('saiu_do_youtube')
      expect((await cancelar(c, c.canalA)).status).toBe('nao_pedido')
      for (const m of [null, 'Com Espaço']) {
        const t = await tenta(pg, `select public.competitor_channel_request_removal($1, $2, $3, $4)`, [c.site, c.canalA, c.admin, m])
        expect(t.ok).toBe(false)
        if (!t.ok) expect(codigoE10(t.message)).toBe('parametro_nulo')
      }
    })
  })

  it('B2.7 remoção arquivada de canal pedido: o diff bate com as colunas novas no CSV', async () => {
    await emTransacao(pg, async () => {
      const c = await semearCena(pg)
      await pedir(c, c.canalA)
      await pg.query(`update public.competitor_channels set collection_paused_at = collection_paused_at - interval '10 minutes' where id = $1`, [c.canalA])
      await pg.query(`update public.competitor_collection_pauses set paused_at = paused_at - interval '10 minutes' where competitor_channel_id = $1`, [c.canalA])
      await registrar(pg, c, c.canalA, 'lote-f1-b27')
      await pg.query(`select public.obs_archive_verify($1, 'lote-f1-b27', $2)`, [c.site, c.canalA])
      await pg.query(`select public.obs_archive_confirm_nas($1, 'lote-f1-b27', $2, $3)`, [c.site, c.canalA, c.admin])
      const r = (await q1(pg, `select public.competitor_channel_remove_archived($1, $2, $3) as r`, [c.site, c.canalA, c.admin])).r as { status: string }
      expect(r.status).toBe('removido')
    })
  })

  it('B2.8 o pedido segura a poda da watch; o Desfazer a solta; B2.8b alvo existente após o pedido não é tocado fora do canal', async () => {
    await emTransacao(pg, async () => {
      const c = await semearCena(pg, { semWatch: true })
      const ytA = await ytDe(c.videoA)
      const ytB = await ytDe(c.videoB)
      for (const yt of [ytA, ytB]) {
        await semearWatchDoVideo(pg, c.site, yt, { leituras: 2, miniaturas: 0, alvo: true })
        await pg.query(`update public.yt_watch_alvos set saiu_em = now() - interval '40 days', saiu_por = 'janela' where site_id = $1 and youtube_video_id = $2`, [c.site, yt])
      }
      const r = await pedir(c, c.canalA)
      expect(Number(r.retido_ate_exportar)).toBeGreaterThanOrEqual(1)
      await pg.query(`select public.yt_watch_poda(now() + interval '31 days', 1000)`)
      const n = (yt: string) => escalar<number>(pg, `select count(*)::int from public.yt_watch_readings where site_id = $1 and youtube_video_id = $2`, [c.site, yt])
      expect(await n(ytA)).toBe(2)
      expect(await n(ytB)).toBe(0) // controle: podado
      await cancelar(c, c.canalA)
      await pg.query(`select public.yt_watch_poda(now() + interval '31 days', 1000)`)
      expect(await n(ytA)).toBe(0)
    })
  })
})

describe.skipIf(skipIfNoLocalDb())('F1 §C: apagar sem guardar', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { try { await pg.query('rollback') } catch { /* nada aberto */ } await pg.end() })

  const URL_BLOB = (id: string) => `https://x.public.blob.vercel-storage.com/observatorio/thumbs/${id}/a.jpg`
  const ytDe = async (video: string) => (await q1(pg, `select video_id from public.competitor_videos where id = $1`, [video])).video_id as string
  const apagar = (c: Cena, canal: string, nome: string | null, motivo: string | null = 'entrou_por_engano', ator?: string) =>
    tenta(pg, `select public.competitor_channel_delete_unarchived($1, $2, $3, $4, $5) as r`, [c.site, canal, ator ?? c.admin, nome, motivo])
  const erro = (t: Awaited<ReturnType<typeof tenta>>): string | null => (t.ok ? null : codigoE10(t.message))

  /** Canal A com 10 dias, 2 vídeos, 1 URL de miniatura, e a watch (1 alvo, 1 miniatura, 3 leituras); B é o controle. */
  async function cena() {
    const c = await semearCena(pg, { semWatch: true })
    await pg.query(`update public.competitor_channels set added_at = now() - interval '10 days', channel_name = 'Canal de teste' where id = $1`, [c.canalA])
    await pg.query(`update public.competitor_video_versions set thumb_blob_url = $2 where video_id = $1 and is_current`, [c.videoA, URL_BLOB(c.videoA)])
    const ytA = await ytDe(c.videoA)
    const ytB = await ytDe(c.videoB)
    await semearWatchDoVideo(pg, c.site, ytA, { leituras: 3, miniaturas: 1, alvo: true })
    await semearWatchDoVideo(pg, c.site, ytB, { leituras: 1, miniaturas: 0, alvo: true })
    return { c, ytA, ytB }
  }

  it('B3.1 apaga tudo e registra; contagens medidas = retrato de antes; watch sempre no retorno', async () => {
    await emTransacao(pg, async () => {
      const { c, ytA, ytB } = await cena()
      const antes = (await pg.query(`select table_name, sum(row_count)::int n from public.obs_archive_channel_counts($1) group by 1`, [c.canalA])).rows
      const t = await apagar(c, c.canalA, 'Canal de teste')
      expect(t.ok, JSON.stringify(t)).toBe(true)
      const r = (await q1(pg, `select 1`)) && undefined
      void r
      const reg = await q1(pg, `select * from public.obs_unarchived_deletions where site_id = $1`, [c.site])
      expect(reg.reason).toBe('entrou_por_engano')
      expect(reg.channel_name).toBe('Canal de teste')
      expect((reg.youtube_video_ids as string[]).includes(ytA)).toBe(true)
      expect(reg.blob_urls_pending).toContain(URL_BLOB(c.videoA))
      const rows = reg.rows_deleted as Record<string, number>
      for (const a of antes as Array<{ table_name: string; n: number }>) expect(rows[a.table_name], a.table_name).toBe(a.n)
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_channel_counts($1)`, [c.canalA])).toBe(0)
      expect(await escalar<number>(pg, `select count(*)::int from public.yt_watch_readings where site_id = $1 and youtube_video_id = $2`, [c.site, ytA])).toBe(0)
      expect(await escalar<number>(pg, `select count(*)::int from public.yt_watch_readings where site_id = $1 and youtube_video_id = $2`, [c.site, ytB])).toBe(1)
      const a = await q1(pg, `select before_data, after_data from public.audit_log where site_id = $1 and action = 'observatorio_canal_apagado_sem_arquivo'`, [c.site])
      expect(a.before_data).toMatchObject({ channel_name: 'Canal de teste' })
      expect(a.after_data).toMatchObject({ motivo: 'entrou_por_engano', watch: { readings: 3, thumbs: 1, alvos: 1 } })
    })
  })

  it('B3.1b retorno: linhas e watch com as três chaves, mesmo com zero', async () => {
    await emTransacao(pg, async () => {
      const c = await semearCena(pg, { semWatch: true })
      await pg.query(`update public.competitor_channels set added_at = now() - interval '1 day', channel_name = 'Sem watch' where id = $1`, [c.canalA])
      const r = (await q1(pg, `select public.competitor_channel_delete_unarchived($1, $2, $3, 'Sem watch', 'outro') as r`, [c.site, c.canalA, c.admin])).r as {
        videos: number; linhas: Record<string, number>; watch: Record<string, number>; blob_urls: string[] }
      expect(r.videos).toBe(2)
      expect(r.watch).toEqual({ readings: 0, thumbs: 0, alvos: 0 })
      expect(r.linhas).toMatchObject({ yt_watch_readings: 0, yt_watch_thumbs: 0, yt_watch_alvos: 0 })
      expect(r.linhas.competitor_videos).toBe(2)
    })
  })

  it('B3.1c cascata fora do registro e track_counts desligado recusam', async () => {
    await emTransacao(pg, async () => {
      const { c } = await cena()
      await pg.query(`create table public.f1_filha_teste (id serial primary key, video_id uuid not null references public.competitor_videos(id) on delete cascade)`)
      await pg.query(`insert into public.f1_filha_teste (video_id) values ($1)`, [c.videoA])
      expect(erro(await apagar(c, c.canalA, 'Canal de teste'))).not.toBeNull()
    })
    // `set track_counts` exige superusuário (o papel do teste não é): o guarda é provado pelo texto da função instalada
    const src = await escalar<string>(pg, `select prosrc from pg_proc where proname = 'competitor_channel_delete_unarchived'`)
    expect(src).toMatch(/current_setting\('track_counts'\) <> 'on'[\s\S]*apagou_alem_do_arquivo/)
  })

  it('B3.2 30 dias: 31 dias recusa, 30 dias menos 1 minuto apaga', async () => {
    await emTransacao(pg, async () => {
      const { c } = await cena()
      await pg.query(`update public.competitor_channels set added_at = now() - interval '31 days' where id = $1`, [c.canalA])
      expect(erro(await apagar(c, c.canalA, 'Canal de teste'))).toBe('canal_antigo')
      expect(await escalar<number>(pg, `select count(*)::int from public.competitor_channels where id = $1`, [c.canalA])).toBe(1)
      await pg.query(`update public.competitor_channels set added_at = now() - (interval '30 days' - interval '1 minute') where id = $1`, [c.canalA])
      expect((await apagar(c, c.canalA, 'Canal de teste')).ok).toBe(true)
    })
  })

  it('B3.3 nome: pontas, caixa e NBSP aceitam; letra a menos, controle e acento diferente recusam', async () => {
    await emTransacao(pg, async () => {
      const { c } = await cena()
      await pg.query(`update public.competitor_channels set channel_name = 'Ryan Otis' where id = $1`, [c.canalA])
      for (const ruim of ['ryan oti', 'Ryan Otis\u0007', 'Ryan Otiz']) expect(erro(await apagar(c, c.canalA, ruim)), ruim).toBe('nome_nao_confere')
      for (const nulo of [null, '   ']) expect(erro(await apagar(c, c.canalA, nulo)), String(nulo)).toBe('parametro_nulo')
      expect(erro(await apagar(c, c.canalA, 'Ryan Otis', null))).toBe('parametro_nulo')
      expect(erro(await apagar(c, c.canalA, 'Ryan Otis', 'Com Espaço'))).toBe('parametro_nulo')
      expect(await escalar<number>(pg, `select count(*)::int from public.competitor_channels where id = $1`, [c.canalA])).toBe(1)
      expect((await apagar(c, c.canalA, 'RYAN otis')).ok).toBe(true)
    })
    await emTransacao(pg, async () => {
      const { c } = await cena()
      await pg.query(`update public.competitor_channels set channel_name = 'Canal  de teste ' where id = $1`, [c.canalA])
      expect((await apagar(c, c.canalA, '  Canal\u00a0de\u00a0teste\u00a0')).ok).toBe(true)
    })
    await emTransacao(pg, async () => {
      const { c } = await cena()
      await pg.query(`update public.competitor_channels set channel_name = 'São Paulo' where id = $1`, [c.canalA])
      expect(erro(await apagar(c, c.canalA, 'Sao Paulo'))).toBe('nome_nao_confere')
      expect((await apagar(c, c.canalA, 'são paulo')).ok).toBe(true)
    })
  })

  it('B3.3b obs_nome_normalizado: regra exposta para a tela', async () => {
    await emTransacao(pg, async () => {
      const n = (t: string) => escalar<string>(pg, `select public.obs_nome_normalizado($1)`, [t])
      expect(await n('  Canal\u00a0\u00a0de\u2009teste\u00a0')).toBe('canal de teste')
      expect(await n('São')).toBe('são')
      expect(await n('SÃO')).toBe('são')
      expect(await n('\ufeffSão')).toBe('são')
      expect(await n('A\u00a0\u00a0B')).toBe('a b')
      expect(await n('A\u0007')).toBe('a\u0007')
      expect(await escalar<string>(pg, `select provolatile::text from pg_proc where proname = 'obs_nome_normalizado'`)).toBe('i')
    })
  })

  it('B3.4 compartilhado: outro canal ou alvo próprio recusa', async () => {
    await emTransacao(pg, async () => {
      const { c, ytA } = await cena()
      await pg.query(`insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at, discovered_at) values ($1, $2, 'x', now(), now())`, [c.canalB, ytA])
      expect(erro(await apagar(c, c.canalA, 'Canal de teste'))).toBe('video_compartilhado')
    })
    await emTransacao(pg, async () => {
      const { c, ytA } = await cena()
      await pg.query(`update public.yt_watch_alvos set tipo = 'proprio', motivo_ate = 'janela_propria' where site_id = $1 and youtube_video_id = $2`, [c.site, ytA])
      expect(erro(await apagar(c, c.canalA, 'Canal de teste'))).toBe('video_compartilhado')
    })
  })

  it('B3.5 travas de direito e estado', async () => {
    await emTransacao(pg, async () => {
      const { c } = await cena()
      expect(erro(await apagar(c, c.canalA, 'Canal de teste', 'x', c.comum))).toBe('sem_direito')
      const outro = await semearCena(pg)
      expect(erro(await apagar(outro, c.canalA, 'Canal de teste'))).toBe('canal_nao_encontrado')
      await pg.query(`insert into public.youtube_intelligence_tasks (id, site_id, task_type, target_niche, target_video_id, trigger_type, status, started_at)
                      values ($1, $2, 'leitura-video', 'sint', $3, 'manual', 'running', now())`, [randomUUID(), c.site, c.videoA])
      expect(erro(await apagar(c, c.canalA, 'Canal de teste'))).toBe('forja_em_andamento')
      await pg.query(`update public.youtube_intelligence_tasks set status = 'completed' where target_video_id = $1`, [c.videoA])
      await pg.query(`update public.competitor_channels set missing_since = current_date where id = $1`, [c.canalA])
      expect(erro(await apagar(c, c.canalA, 'Canal de teste'))).toBe('saiu_do_youtube')
    })
  })

  it('B3.6 com pedido e lote aberto: apaga e encerra o lote com apagado_sem_arquivo', async () => {
    await emTransacao(pg, async () => {
      const { c } = await cena()
      await pg.query(`select public.competitor_channel_request_removal($1, $2, $3, 'entrou_por_engano')`, [c.site, c.canalA, c.admin])
      await pg.query(`update public.competitor_channels set collection_paused_at = collection_paused_at - interval '10 minutes' where id = $1`, [c.canalA])
      await pg.query(`update public.competitor_collection_pauses set paused_at = paused_at - interval '10 minutes' where competitor_channel_id = $1`, [c.canalA])
      await registrar(pg, c, c.canalA, 'lote-f1-b36')
      expect((await apagar(c, c.canalA, 'Canal de teste')).ok).toBe(true)
      const l = await q1(pg, `select closed_reason, closed_at from public.obs_archive_batches where batch = 'lote-f1-b36' limit 1`)
      expect(l.closed_reason).toBe('apagado_sem_arquivo')
      expect(l.closed_at).not.toBeNull()
    })
  })

  it('B3.7 baixa do Blob: zera a pendência; outro site não toca', async () => {
    await emTransacao(pg, async () => {
      const { c } = await cena()
      expect((await apagar(c, c.canalA, 'Canal de teste')).ok).toBe(true)
      const reg = await q1(pg, `select id, blob_urls_pending from public.obs_unarchived_deletions where site_id = $1`, [c.site])
      const outro = await semearCena(pg)
      expect(await escalar<number | null>(pg, `select public.obs_unarchived_blobs_done($1, $2, $3::text[])`, [outro.site, reg.id, reg.blob_urls_pending])).toBeNull()
      expect(await escalar<number>(pg, `select public.obs_unarchived_blobs_done($1, $2, $3::text[])`, [c.site, reg.id, reg.blob_urls_pending])).toBe(0)
      expect((await q1(pg, `select blob_urls_pending from public.obs_unarchived_deletions where id = $1`, [reg.id])).blob_urls_pending).toEqual([])
    })
  })

  it('B3.8 disparo em voo depois do apagar: o sweep varre; B3.9 poupa o vídeo que voltou e o apagamento antigo', async () => {
    await emTransacao(pg, async () => {
      const { c, ytA } = await cena()
      expect((await apagar(c, c.canalA, 'Canal de teste')).ok).toBe(true)
      await semearWatchDoVideo(pg, c.site, ytA, { leituras: 1, miniaturas: 1, alvo: false })
      expect(await escalar<number>(pg, `select public.obs_unarchived_watch_sweep(now())`)).toBe(2)
      expect(await escalar<number>(pg, `select count(*)::int from public.yt_watch_readings where site_id = $1 and youtube_video_id = $2`, [c.site, ytA])).toBe(0)
    })
    await emTransacao(pg, async () => {
      const { c, ytA } = await cena()
      expect((await apagar(c, c.canalA, 'Canal de teste')).ok).toBe(true)
      await semearWatchDoVideo(pg, c.site, ytA, { leituras: 1, miniaturas: 1, alvo: false })
      await pg.query(`insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at, discovered_at) values ($1, $2, 'volta', now(), now())`, [c.canalB, ytA])
      expect(await escalar<number>(pg, `select public.obs_unarchived_watch_sweep(now())`)).toBe(0)
    })
    await emTransacao(pg, async () => {
      const { c, ytA } = await cena()
      expect((await apagar(c, c.canalA, 'Canal de teste')).ok).toBe(true)
      await semearWatchDoVideo(pg, c.site, ytA, { leituras: 1, miniaturas: 0, alvo: false })
      expect(await escalar<number>(pg, `select public.obs_unarchived_watch_sweep(now() + interval '3 days')`)).toBe(0)
    })
  })

  it('B3.10 contagem da watch por canal (janela): três números, canal de outro site recusa', async () => {
    await emTransacao(pg, async () => {
      const { c } = await cena()
      const r = (await q1(pg, `select public.competitor_channel_removal_extra($1, $2) as r`, [c.site, c.canalA])).r
      expect(r).toEqual({ readings: 3, thumbs: 1, alvos: 1 })
      const vazio = (await q1(pg, `select public.competitor_channel_removal_extra($1, $2) as r`, [c.site, c.canalB])).r
      expect(vazio).toEqual({ readings: 1, thumbs: 0, alvos: 1 })
      const outro = await semearCena(pg)
      const t = await tenta(pg, `select public.competitor_channel_removal_extra($1, $2)`, [outro.site, c.canalA])
      expect(erro(t)).toBe('canal_nao_encontrado')
    })
  })
})

describe.skipIf(skipIfNoLocalDb())('F1 §E: E9 x watch (prova da decisão P6, sem código novo)', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { try { await pg.query('rollback') } catch { /* nada aberto */ } await pg.end() })

  it('B7 vídeo apagado pela E9 tira o alvo na conciliação e a poda leva as leituras', async () => {
    await emTransacao(pg, async () => {
      const c = await semearCena(pg, { semWatch: true })
      const yt = (await q1(pg, `select video_id from public.competitor_videos where id = $1`, [c.videoA])).video_id as string
      await semearWatchDoVideo(pg, c.site, yt, { leituras: 2, miniaturas: 0, alvo: true })
      await pg.query(`update public.competitor_videos set missing_since = current_date - 10 where id = $1`, [c.videoA])
      const p = await q1(pg, `select public.competitor_video_purge($1, $2, $3, 30, null, null) as r`, [c.site, c.videoA, c.admin])
      expect(p.r).toBeTruthy()
      await pg.query(`select public.yt_watch_conciliar(now(), '[]'::jsonb)`)
      expect((await q1(pg, `select saiu_por from public.yt_watch_alvos where site_id = $1 and youtube_video_id = $2`, [c.site, yt])).saiu_por).toBe('removido')
      expect(await escalar<number>(pg, `select count(*)::int from public.yt_watch_readings where site_id = $1 and youtube_video_id = $2`, [c.site, yt])).toBe(2)
      await pg.query(`select public.yt_watch_poda(now() + interval '31 days', 1000)`)
      expect(await escalar<number>(pg, `select count(*)::int from public.yt_watch_readings where site_id = $1 and youtube_video_id = $2`, [c.site, yt])).toBe(0)
    })
  })
})
