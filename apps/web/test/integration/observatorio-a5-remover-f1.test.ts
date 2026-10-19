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
      expect(r.watch).toEqual({ leituras: 3, miniaturas: 1, alvos: 1 })
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
