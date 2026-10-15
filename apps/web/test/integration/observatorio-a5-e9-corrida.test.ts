// @vitest-environment node
/**
 * A5 · E9 (Tarefa 2): corridas da MG18 com DUAS conexões `pg` (a C0.12 deixou isto como "não verificado"). SÓ o `bythiago_int`.
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e9-corrida.test.ts --no-file-parallelism
 *
 * Diferente dos outros arquivos, aqui há COMMIT de verdade (duas conexões não se enxergam dentro de uma transação). Cada teste
 * semeia o SEU site, e `afterAll` apaga tudo o que ele criou (site, organização, usuário). Banco ocupado: o teste falha dizendo.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { criarSite, criarUsuario, criarCanal, criarVideo, q1, escalar } from '../helpers/mg6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const dormir = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))

interface Semente { org: string; site: string; ator: string; canal: string; video: string; tarefa: string }

describe.skipIf(skipIfNoLocalDb())('A5 E9 Tarefa 2: corridas (duas conexões, commit de verdade, limpeza no fim)', () => {
  let a: Client
  let b: Client
  const criados: Semente[] = []

  beforeAll(async () => {
    a = new Client({ connectionString: PG_URL }); b = new Client({ connectionString: PG_URL })
    await a.connect(); await b.connect()
  })
  afterAll(async () => {
    for (const c of [a, b]) { try { await c.query('rollback') } catch { /* nada aberto */ } }
    for (const s of criados) {
      try {
        await a.query(`delete from public.audit_log where site_id = $1`, [s.site])
        await a.query(`delete from public.competitor_removed_items where site_id = $1`, [s.site])
        await a.query(`delete from public.youtube_intelligence_tasks where site_id = $1`, [s.site])
        await a.query(`delete from public.youtube_niches where site_id = $1`, [s.site])
        await a.query(`delete from public.competitor_channels where site_id = $1`, [s.site])
        await a.query(`delete from public.sites where id = $1`, [s.site])
        await a.query(`delete from public.organizations where id = $1`, [s.org])
        await a.query(`delete from auth.users where id = $1`, [s.ator])
      } catch (e) { console.error('limpeza da corrida falhou', s.site, e instanceof Error ? e.message : e) }
    }
    await a.end(); await b.end()
  })

  async function semeia(): Promise<Semente> {
    const { org, site } = await criarSite(a)
    const ator = await criarUsuario(a)
    const canal = await criarCanal(a, site)
    const video = await criarVideo(a, canal, 3)
    await a.query(`update public.competitor_videos set missing_since = current_date - 4 where id = $1`, [video])
    await a.query(`insert into public.youtube_niches (site_id, slug, label, color_dark, color_light) values ($1, 'corrida', 'C', '#AAB4C0', '#4B5563')`, [site])
    const tarefa = (await q1(a,
      `insert into public.youtube_intelligence_tasks (id, site_id, task_type, target_niche, target_video_id, trigger_type, status)
       values ($1, $2, 'leitura-video', 'corrida', $3, 'manual', 'pending') returning id`, [randomUUID(), site, video])).id as string
    const s = { org, site, ator, canal, video, tarefa }
    criados.push(s)
    return s
  }
  const purge = (c: Client, s: Semente) =>
    c.query(`select public.competitor_video_purge($1,$2,$3,30,null,null) as r`, [s.site, s.video, s.ator]).then(r => (r.rows[0] as { r: { status: string } }).r)
  const claim = (c: Client, s: Semente) =>
    c.query(`update public.youtube_intelligence_tasks set status = 'running', started_at = now() where id = $1 and status = 'pending'`, [s.tarefa])

  it('claim que chega primeiro faz o apagar recusar', async () => {
    const s = await semeia()
    await claim(a, s) // autocommit
    expect((await purge(b, s)).status).toBe('forja_em_andamento')
    expect(await escalar<number>(a, `select count(*)::int from public.competitor_videos where id = $1`, [s.video])).toBe(1)
  })

  it('apagar que chega primeiro faz o claim não achar a tarefa', async () => {
    const s = await semeia()
    await a.query('begin')
    expect((await purge(a, s)).status).toBe('apagado')
    await b.query(`set statement_timeout = '3s'`)
    const espera = claim(b, s)
    await dormir(400) // o claim tem de estar esperando o lock da linha da tarefa
    await a.query('commit')
    const r = await espera
    await b.query('reset statement_timeout')
    expect(r.rowCount).toBe(0)
  })

  it('dois apagar do mesmo vídeo ao mesmo tempo: um apagado, o outro not_found; uma linha, purge_count 1', async () => {
    const s = await semeia()
    await a.query('begin')
    expect((await purge(a, s)).status).toBe('apagado')
    const espera = purge(b, s)
    await dormir(400)
    await a.query('commit')
    expect((await espera).status).toBe('not_found')
    const item = await q1(a, `select count(*)::int as n, max(purge_count)::int as p from public.competitor_removed_items where site_id = $1`, [s.site])
    expect([item.n, item.p]).toEqual([1, 1])
  })

  it('inserção de filha durante o apagar espera e depois falha por chave estrangeira; nenhuma linha órfã', async () => {
    const s = await semeia()
    await a.query('begin')
    expect((await purge(a, s)).status).toBe('apagado')
    const insercao = b.query(`insert into public.competitor_video_daily (video_id, snap_date, views, taken_at) values ($1, current_date, 1, now())`, [s.video])
      .then(() => ({ ok: true as const }), (e: { code?: string }) => ({ ok: false as const, code: e.code }))
    await dormir(400)
    await a.query('commit')
    expect(await insercao).toEqual({ ok: false, code: '23503' })
    expect(await escalar<number>(a, `select count(*)::int from public.competitor_video_daily where video_id = $1`, [s.video])).toBe(0)
  })

  it('a prova que cruza com um apagar não fica vermelha: devolve as dez chaves e o vídeo apagado não ganha piso', async () => {
    const s = await semeia()
    await a.query('begin')
    expect((await purge(a, s)).status).toBe('apagado')
    const prova = b.query(`select public.competitor_missing_proof($1, now()) as r`, [s.site]).then(r => (r.rows[0] as { r: Record<string, unknown> }).r)
    await dormir(400)
    await a.query('commit')
    const r = await prova
    expect(Object.keys(r).sort()).toEqual(['apagando', 'apagando_ha_mais_de_1d', 'ausentes_com_queda', 'esperando', 'linhas_de_ausentes',
      'mais_antigo_dias', 'miniaturas_de_ausentes', 'pisos_novos', 'videos_ausentes', 'voltaram_sem_resposta'])
    expect(r.videos_ausentes).toBe(0)
    expect(await escalar<number>(a, `select count(*)::int from public.competitor_missing_baseline where site_id = $1`, [s.site])).toBe(0)
  })

  it('o piso é inserido em ordem de id e a prova trata impasse (leitura de prosrc)', async () => {
    const src = await escalar<string>(a, `select prosrc from pg_proc where proname = 'competitor_missing_proof' and pronamespace = 'public'::regnamespace`)
    expect(src).toMatch(/order by a\.id/)
    expect(src).toMatch(/deadlock_detected/)
  })
})
