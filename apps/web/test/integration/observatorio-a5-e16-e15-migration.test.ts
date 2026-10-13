// @vitest-environment node
/**
 * A5 · E16 parte 1 (MG10, a agenda) e E15 parte 1 (MG9, a leitura horária): as funções e tabelas, contra Postgres de verdade.
 * Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e16-e15-migration.test.ts --no-file-parallelism
 *
 * O banco é dividido com outras etapas: cada teste cria o SEU site, os SEUS canais/vídeos e as SUAS tarefas (`teste-<uuid>`),
 * e só olha para eles. `p_now` das provas é sempre um instante fixo no passado (P), e as sementes são relativas a ele.
 * Função sem EXECUTE nunca é CHAMADA aqui como anon/authenticated (derruba este Postgres): isso é do arquivo de RLS.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { lerEstado, tomar, fechar, esgotar, adiar } from '@/lib/youtube/agenda/estado'
import { lerProvaHoraria } from '@/lib/youtube/horaria/prova'
import { lerCandidatos } from '@/lib/youtube/horaria/gravar'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const HORA = 3_600_000
const DIA = 24 * HORA
/** P: o "agora" das provas. Uma hora cheia, 10 dias atrás: nada aqui depende do relógio de parede. */
const P = Math.floor((Date.now() - 10 * DIA) / HORA) * HORA
const iso = (ms: number): string => new Date(ms).toISOString()
const dia = (ms: number): string => iso(ms).slice(0, 10)
/** As últimas `n` horas cheias até P (P inclusive), menos as posições `sem` (k = 0 é P). */
const ultimas = (n: number, sem: readonly number[] = []): number[] =>
  Array.from({ length: n }, (_, k) => k).filter(k => !sem.includes(k)).map(k => P - k * HORA)
const dormir = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))

type Linha = Record<string, unknown>
type Prova = Record<string, number | string | null>

describe.skipIf(skipIfNoLocalDb())('A5 E16 e E15 parte 1: SQL da agenda e da leitura horária (banco local)', () => {
  let pg: Client
  let pg2: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const sites: string[] = []
  const tarefas: string[] = []
  const leases: string[] = []

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    pg2 = new Client({ connectionString: PG_URL }); await pg2.connect()
  })
  afterAll(async () => {
    // roda também depois de falha: ordem das FKs "restrict" (canal do dono) primeiro, depois o site (cascata do resto)
    try {
      if (sites.length > 0) {
        for (const t of ['yt_own_public_hour_fold_log', 'yt_own_public_hour_map', 'yt_own_public_video_early', 'yt_own_public_video_hourly', 'yt_own_video_meta_daily', 'youtube_videos', 'youtube_channels', 'youtube_quota_usage']) {
          await pg.query(`delete from public.${t} where site_id = any($1::uuid[])`, [sites])
        }
        await pg.query('delete from public.sites where id = any($1::uuid[])', [sites])
      }
      if (tarefas.length > 0) await pg.query('delete from public.competitor_agenda_runs where task = any($1::text[])', [tarefas])
      if (leases.length > 0) await pg.query('delete from public.competitor_agenda_lease where name = any($1::text[])', [leases])
    } finally {
      await pg.end()
      await pg2.end()
    }
  })

  // ───────────────────────── semeadura ─────────────────────────
  const tarefa = (): string => { const t = 'teste-' + randomUUID(); tarefas.push(t); return t }
  const novoSite = async (): Promise<string> => { const s = (await seedSite(sb)).siteId; sites.push(s); return s }
  const q = async (c: Client, sql: string, params: unknown[] = []): Promise<Linha[]> => (await c.query(sql, params)).rows as Linha[]

  async function canalConc(siteId: string, o: { ausente?: boolean } = {}): Promise<string> {
    const r = await q(pg, `insert into public.competitor_channels (site_id, channel_id, channel_name, missing_since) values ($1, $2, 'Teste', $3) returning id`,
      [siteId, 'UC' + randomUUID().replace(/-/g, '').slice(0, 20), o.ausente ? dia(P - 5 * DIA) : null])
    return String(r[0]!.id)
  }
  interface OpcVideo { pub?: number | null; descoberto?: number | null; lbc?: string; fimAoVivo?: number; oculto?: boolean; falta?: number; ausente?: boolean }
  async function videoConc(canalId: string, o: OpcVideo = {}): Promise<string> {
    const pub = o.pub === undefined ? P - 5 * DIA : o.pub
    const r = await q(pg, `insert into public.competitor_videos (competitor_channel_id, video_id, published_at, discovered_at, live_broadcast_content, live_actual_end_at, views_hidden, miss_streak, missing_since)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [canalId, 'v' + randomUUID().replace(/-/g, '').slice(0, 10), pub === null ? null : iso(pub), o.descoberto == null ? null : iso(o.descoberto),
        o.lbc ?? null, o.fimAoVivo == null ? null : iso(o.fimAoVivo), o.oculto ?? null, o.falta ?? 0, o.ausente ? dia(P - 2 * DIA) : null])
    return String(r[0]!.id)
  }
  async function lerConc(videoId: string, siteId: string, slots: readonly number[]): Promise<void> {
    if (slots.length === 0) return
    await pg.query(`insert into public.competitor_video_hourly (video_id, hour_slot, taken_at, site_id, views)
      select $1::uuid, s, s + interval '10 minutes', $3::uuid, 100 from unnest($2::timestamptz[]) as s`, [videoId, slots.map(iso), siteId])
  }
  async function canalDono(siteId: string): Promise<string> {
    const n = randomUUID().replace(/-/g, '')
    const r = await q(pg, `insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [siteId, 'UC' + n.slice(0, 20), '@t' + n.slice(0, 8), 'UU' + n.slice(0, 20), 'teste-' + n.slice(0, 8)])
    return String(r[0]!.id)
  }
  interface OpcDono { pub?: number; criado?: number; privacidade?: 'public' | 'unlisted' | 'nulo' | 'semCaptura'; captura?: number; diaPt?: string }
  async function videoDono(siteId: string, canalId: string, o: OpcDono = {}): Promise<{ id: string; yt: string; canal: string }> {
    const yt = 'y' + randomUUID().replace(/-/g, '').slice(0, 10)
    const r = await q(pg, `insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at, created_at)
      values ($1, $2, $3, 'Teste', $4, $5) returning id`, [siteId, canalId, yt, iso(o.pub ?? P - 5 * DIA), iso(o.criado ?? P - 4 * DIA)])
    const priv = o.privacidade ?? 'public'
    if (priv !== 'semCaptura') {
      const cap = o.captura ?? P - 2 * DIA
      await pg.query(`insert into public.yt_own_video_meta_daily (youtube_video_id, day_pt, site_id, channel_id, privacy_status, captured_at) values ($1, $2, $3, $4, $5, $6)`,
        [yt, o.diaPt ?? dia(cap - DIA), siteId, canalId, priv === 'nulo' ? null : priv, iso(cap)])
    }
    return { id: String(r[0]!.id), yt, canal: canalId }
  }
  async function lerDono(siteId: string, v: { id: string; yt: string; canal: string }, slots: readonly number[]): Promise<void> {
    if (slots.length === 0) return
    await pg.query(`insert into public.yt_own_public_video_hourly (youtube_video_id, hour_slot, taken_at, site_id, video_id, channel_id, views)
      select $1, s, s + interval '10 minutes', $3::uuid, $4::uuid, $5::uuid, 100 from unnest($2::timestamptz[]) as s`, [v.yt, slots.map(iso), siteId, v.id, v.canal])
  }
  async function prova(siteId: string, agora: number = P): Promise<Prova> {
    const r = await q(pg, 'select public.competitor_hourly_health($1::uuid, $2::timestamptz, 14, 25) as r', [siteId, iso(agora)])
    return r[0]!.r as Prova
  }

  // ───────────────────────── a agenda: funções ─────────────────────────
  const claim = async (c: Client, t: string, k: string, max: number | null = 3, stale = '10 minutes', reopen = false): Promise<boolean> =>
    (await q(c, 'select public.competitor_agenda_claim($1::text, $2::text, $3::smallint, $4::interval, $5::boolean) as r', [t, k, max, stale, reopen]))[0]!.r as boolean
  const fim = async (t: string, k: string, status: string, done: number | null, left: number | null, reason: string | null = null, detail: unknown = null): Promise<boolean> =>
    (await q(pg, 'select public.competitor_agenda_finish($1::text, $2::text, $3::text, $4::integer, $5::integer, $6::text, 100, $7::jsonb) as r',
      [t, k, status, done, left, reason, detail === null ? null : JSON.stringify(detail)]))[0]!.r as boolean
  const defer = async (t: string, k: string, reason: string): Promise<boolean> =>
    (await q(pg, 'select public.competitor_agenda_defer($1::text, $2::text, $3::text) as r', [t, k, reason]))[0]!.r as boolean
  const exaust = async (t: string, k: string, max: number | null, stale = '10 minutes'): Promise<boolean> =>
    (await q(pg, 'select public.competitor_agenda_exhaust($1::text, $2::text, $3::smallint, $4::interval) as r', [t, k, max, stale]))[0]!.r as boolean
  const linha = async (t: string, k: string): Promise<Linha> => {
    const r = await q(pg, 'select * from public.competitor_agenda_runs where task = $1 and period_key = $2', [t, k])
    expect(r, `linha ${t}/${k}`).toHaveLength(1)
    return r[0]!
  }
  /** Semeia uma linha direto (superusuário); `iniciouHaMin` é relativo ao relógio do banco. */
  async function semear(t: string, k: string, status: string, o: { attempts?: number; iniciouHaMin?: number; doneN?: number | null } = {}): Promise<void> {
    await pg.query(`insert into public.competitor_agenda_runs (task, period_key, status, attempts, started_at, done_n)
      values ($1, $2, $3, $4, now() - ($5::numeric * interval '1 minute'), $6)`, [t, k, status, o.attempts ?? 1, o.iniciouHaMin ?? 60, o.doneN ?? null])
  }

  it('o SQL aplicado de novo não dá erro (a tentativa roda numa transação que é desfeita: nada fica no banco)', async () => {
    // As funções e as tabelas que o SQL cria ou recria; a definição de cada função antes e depois tem de ser a mesma.
    const defs = async (c: Client): Promise<string> => JSON.stringify(await q(c, `select p.oid::regprocedure::text as f, md5(pg_get_functiondef(p.oid)) as m, p.proacl::text as acl
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like 'competitor\\_agenda\\_%' or p.proname in ('competitor_hourly_health', 'competitor_channel_removal_impact', 'youtube_channel_removal_impact', 'competitor_capture_health')) order by 1`))
    const antes = await defs(pg)
    const aqui = fileURLToPath(new URL('.', import.meta.url))
    for (const arq of ['20261013000001_observatorio_a5_e16_agenda_despacho.sql', '20261013000002_observatorio_a5_e15_leitura_horaria.sql']) {
      const sql = readFileSync(new URL(`../../../../supabase/migrations/${arq}`, import.meta.url), 'utf8')
      expect(sql.length, `${arq} lido de ${aqui}`).toBeGreaterThan(1000)
      await pg.query('begin')
      try {
        await pg.query(sql)       // duas vezes: o segundo é o "de novo"
        await pg.query(sql)
      } finally {
        await pg.query('rollback')
      }
    }
    expect(await defs(pg)).toBe(antes)
  }, 60_000)

  it('tomada: dois clientes ao mesmo tempo, linha inexistente', async () => {
    const t = tarefa()
    const r = await Promise.all([claim(pg, t, '2026-01-01T10'), claim(pg2, t, '2026-01-01T10')])
    expect(r.filter(Boolean)).toHaveLength(1)
    const rows = await q(pg, 'select attempts, runs, status from public.competitor_agenda_runs where task = $1', [t])
    expect(rows).toEqual([{ attempts: 1, runs: 1, status: 'rodando' }])
  })

  it('tomada: dois clientes sobre parcial, erro e rodando de 11 minutos', async () => {
    const t = tarefa()
    await semear(t, 'parcial', 'parcial', { doneN: 0 })
    await semear(t, 'erro', 'erro')
    await semear(t, 'velha', 'rodando', { iniciouHaMin: 11 })
    for (const k of ['parcial', 'erro', 'velha']) {
      const r = await Promise.all([claim(pg, t, k), claim(pg2, t, k)])
      expect(r.filter(Boolean), k).toHaveLength(1)
    }
  })

  it('tomada: ok e rodando de 1 minuto recusam os dois', async () => {
    const t = tarefa()
    await semear(t, 'ok', 'ok')
    await semear(t, 'fresca', 'rodando', { iniciouHaMin: 1 })
    for (const k of ['ok', 'fresca']) expect(await Promise.all([claim(pg, t, k), claim(pg2, t, k)]), k).toEqual([false, false])
  })

  it('tomada com teto nulo: a primeira vale, a retomada recusa e a linha nunca esgota', async () => {
    const t = tarefa()
    expect(await claim(pg, t, 'k', null)).toBe(true)
    expect(await fim(t, 'k', 'erro', 0, null, 'api_falhou')).toBe(true)
    expect(await claim(pg, t, 'k', null)).toBe(false)
    expect(await exaust(t, 'k', null)).toBe(false)
    expect(await linha(t, 'k')).toMatchObject({ status: 'erro', attempts: 1 })
  })

  it('reabertura: dois clientes sobre ok com p_reopen', async () => {
    const t = tarefa()
    await semear(t, 'ok', 'ok', { attempts: 2 })
    const r = await Promise.all([claim(pg, t, 'ok', 3, '10 minutes', true), claim(pg2, t, 'ok', 3, '10 minutes', true)])
    expect(r.filter(Boolean)).toHaveLength(1)
    expect(await linha(t, 'ok')).toMatchObject({ status: 'rodando', attempts: 2 })
  })

  it('parcial com progresso cinco vezes não gasta tentativa', async () => {
    const t = tarefa()
    expect(await claim(pg, t, 'k')).toBe(true)
    for (let i = 0; i < 5; i++) {
      expect(await fim(t, 'k', 'parcial', 4, 10, 'sobrou')).toBe(true)
      expect(await claim(pg, t, 'k'), `retomada ${i + 1}`).toBe(true)
      expect((await linha(t, 'k')).attempts).toBe(1)
    }
    expect(await fim(t, 'k', 'parcial', 4, 10, 'sobrou')).toBe(true)
    expect(await claim(pg, t, 'k'), 'a 6ª tomada').toBe(true)
    expect(await linha(t, 'k')).toMatchObject({ attempts: 1, runs: 7 })
  })

  it('parcial sem progresso e erro batem o teto da faixa', async () => {
    const t = tarefa()
    expect(await claim(pg, t, 'k', 9)).toBe(true)
    let tomadas = 1
    for (;;) {
      expect(await fim(t, 'k', tomadas % 2 === 0 ? 'erro' : 'parcial', 0, 5, 'sobrou')).toBe(true)
      if (!(await claim(pg, t, 'k', 9))) break
      tomadas++
    }
    expect(tomadas).toBe(9)
    expect((await linha(t, 'k')).attempts).toBe(9)
    expect(await exaust(t, 'k', 9)).toBe(true)
    expect(await exaust(t, 'k', 9)).toBe(false)
    expect((await linha(t, 'k')).status).toBe('esgotada')
  })

  it('parcial com progresso depois de dois erros esgota no teto 3', async () => {
    const t = tarefa()
    for (let i = 0; i < 2; i++) {
      expect(await claim(pg, t, 'k', 3)).toBe(true)
      expect(await fim(t, 'k', 'erro', 0, null, 'api_falhou')).toBe(true)
    }
    expect(await claim(pg, t, 'k', 3)).toBe(true)
    expect(await fim(t, 'k', 'parcial', 10, 5, 'sobrou')).toBe(true)
    expect((await linha(t, 'k')).attempts).toBe(3)
    expect(await claim(pg, t, 'k', 3)).toBe(false)
    expect(await exaust(t, 'k', 3)).toBe(true)
  })

  it('hora que falha sempre: três tentativas e esgotada', async () => {
    const t = tarefa()
    for (let i = 0; i < 3; i++) {
      expect(await claim(pg, t, 'k', 3), `tentativa ${i + 1}`).toBe(true)
      expect(await fim(t, 'k', 'erro', 0, null, 'api_falhou')).toBe(true)
    }
    expect(await claim(pg, t, 'k', 3)).toBe(false)
    expect(await exaust(t, 'k', 3)).toBe(true)
    expect(await linha(t, 'k')).toMatchObject({ status: 'esgotada', attempts: 3 })
  })

  it('adiada não gasta tentativa', async () => {
    const t = tarefa()
    expect(await defer(t, 'k', 'sem_tempo')).toBe(true)
    expect(await linha(t, 'k')).toMatchObject({ status: 'adiada', attempts: 0, runs: 0 })
    expect(await claim(pg, t, 'k')).toBe(true)
    expect(await linha(t, 'k')).toMatchObject({ status: 'rodando', attempts: 1, runs: 1 })
  })

  it('adiar não mexe em rodando, ok nem esgotada', async () => {
    const t = tarefa()
    await semear(t, 'rodando', 'rodando', { iniciouHaMin: 1 })
    await semear(t, 'ok', 'ok')
    await semear(t, 'esgotada', 'esgotada', { attempts: 3 })
    for (const k of ['rodando', 'ok', 'esgotada']) {
      const antes = JSON.stringify(await linha(t, k))
      expect(await defer(t, k, 'sem_tempo'), k).toBe(false)
      expect(JSON.stringify(await linha(t, k)), k).toBe(antes)
    }
  })

  it('adiar uma linha em erro guarda o motivo e o instante do fecho', async () => {
    const t = tarefa()
    expect(await claim(pg, t, 'k')).toBe(true)
    expect(await fim(t, 'k', 'erro', 0, null, 'api_falhou')).toBe(true)
    const antes = await linha(t, 'k')
    expect(await defer(t, 'k', 'uma_pesada_por_disparo')).toBe(true)
    const depois = await linha(t, 'k')
    expect(depois).toMatchObject({ status: 'erro', reason: 'api_falhou' })
    expect((depois.finished_at as Date).getTime()).toBe((antes.finished_at as Date).getTime())
  })

  it('adiar uma parcial por falta de tempo guarda o motivo dela e soma em unfinished_n', async () => {
    const t = tarefa()
    expect(await claim(pg, t, 'k')).toBe(true)
    expect(await fim(t, 'k', 'parcial', 3, 4, 'sobrou')).toBe(true)
    expect((await linha(t, 'k')).unfinished_n).toBe(1)
    expect(await defer(t, 'k', 'sem_tempo')).toBe(true)
    expect(await linha(t, 'k')).toMatchObject({ status: 'parcial', reason: 'sobrou', unfinished_n: 2 })
  })

  it('adiar uma adiada troca o motivo', async () => {
    const t = tarefa()
    expect(await defer(t, 'k', 'uma_pesada_por_disparo')).toBe(true)
    expect(await linha(t, 'k')).toMatchObject({ reason: 'uma_pesada_por_disparo', unfinished_n: 0 })
    expect(await defer(t, 'k', 'sem_tempo')).toBe(true)
    expect(await linha(t, 'k')).toMatchObject({ status: 'adiada', reason: 'sem_tempo', attempts: 0, unfinished_n: 1 })
  })

  it('motivo que não é código nunca é gravado', async () => {
    const t = tarefa()
    expect(await claim(pg, t, 'a')).toBe(true)
    expect(await fim(t, 'a', 'erro', 0, null, 'Key (author_channel_id)=(UCxyz) already exists')).toBe(true)
    expect((await linha(t, 'a')).reason).toBe('motivo_invalido')
    expect(await defer(t, 'b', 'Texto Livre')).toBe(true)
    expect((await linha(t, 'b')).reason).toBe('motivo_invalido')
    await expect(pg.query(`insert into public.competitor_agenda_runs (task, period_key, status, reason) values ($1, 'c', 'erro', 'Texto Livre')`, [t]))
      .rejects.toMatchObject({ code: '23514' })
  })

  it('fecho com motivo nulo grava nulo', async () => {
    const t = tarefa()
    expect(await claim(pg, t, 'k')).toBe(true)
    expect(await fim(t, 'k', 'ok', 5, null, null, { lidos: 5 })).toBe(true)
    expect(await linha(t, 'k')).toMatchObject({ status: 'ok', reason: null, done_n: 5, left_n: null, detail: { lidos: 5 } })
  })

  it('fecho atrasado não desfaz', async () => {
    const t = tarefa()
    expect(await claim(pg, t, 'k')).toBe(true)
    expect(await fim(t, 'k', 'ok', 1, 0)).toBe(true)
    expect(await fim(t, 'k', 'erro', 0, null, 'api_falhou')).toBe(false)
    expect((await linha(t, 'k')).status).toBe('ok')
  })

  it('arrendamento: tomado e nunca solto, é tomado depois de vencer', async () => {
    const nome = 'teste-' + randomUUID(); leases.push(nome)
    const tomar2 = async (): Promise<boolean> => (await q(pg, `select public.competitor_agenda_lease_take($1::text, $2::uuid, interval '2 seconds') as r`, [nome, randomUUID()]))[0]!.r as boolean
    expect(await tomar2()).toBe(true)
    expect(await tomar2()).toBe(false)
    await dormir(2100)
    expect(await tomar2()).toBe(true)
  }, 20_000)

  it('arrendamento: quem não é o dono não solta', async () => {
    const nome = 'teste-' + randomUUID(); leases.push(nome)
    const a = randomUUID(); const b = randomUUID()
    const tomarComo = async (h: string): Promise<boolean> => (await q(pg, `select public.competitor_agenda_lease_take($1::text, $2::uuid, interval '1 second') as r`, [nome, h]))[0]!.r as boolean
    expect(await tomarComo(a)).toBe(true)
    await dormir(1100)
    expect(await tomarComo(b)).toBe(true)
    expect((await q(pg, 'select public.competitor_agenda_lease_release($1::text, $2::uuid) as r', [nome, a]))[0]!.r).toBe(false)
    expect((await q(pg, 'select holder from public.competitor_agenda_lease where name = $1', [nome]))[0]!.holder).toBe(b)
    expect((await q(pg, 'select public.competitor_agenda_lease_release($1::text, $2::uuid) as r', [nome, b]))[0]!.r).toBe(true)
  }, 20_000)

  it('arrendamento e tomada com parâmetro nulo dão erro, não true', async () => {
    const nome = 'teste-' + randomUUID(); leases.push(nome)
    await expect(pg.query(`select public.competitor_agenda_lease_take($1::text, $2::uuid, null::interval)`, [nome, randomUUID()])).rejects.toMatchObject({ code: '23502' })
    await expect(pg.query(`select public.competitor_agenda_claim(null::text, 'k', 3::smallint, interval '10 minutes', false)`)).rejects.toMatchObject({ code: '23502' })
  })

  it('estado: tarefa sem linha devolve nulos, nunca zero', async () => {
    const [a, b] = [tarefa(), tarefa()]
    const r = (await q(pg, 'select public.competitor_agenda_state($1::text[], $2::text[]) as r', [[a, b], ['k1', 'k2']]))[0]!.r as { desde: unknown; tarefas: Linha[] }
    expect(r.desde).toBeNull()
    expect(r.tarefas).toHaveLength(2)
    for (const x of r.tarefas) expect(x).toMatchObject({ status: null, attempts: null, runs: null, unfinished_n: null, last_ok_at: null, last_run_status: null, last_run_done_n: null })
  })

  it('estado: desde só olha as tarefas pedidas', async () => {
    const [a, outra, c] = [tarefa(), tarefa(), tarefa()]
    const comeco = iso(P - 3 * HORA)
    await pg.query(`insert into public.competitor_agenda_runs (task, period_key, status, started_at) values ($1, 'k', 'ok', $2), ($3, 'k', 'ok', $4)`, [a, comeco, outra, iso(P - 30 * DIA)])
    const r = (await q(pg, 'select public.competitor_agenda_state($1::text[], $2::text[]) as r', [[a, c], ['k', 'k']]))[0]!.r as { desde: string; tarefas: Linha[] }
    expect(Date.parse(r.desde)).toBe(Date.parse(comeco))
    expect(r.tarefas[0]).toMatchObject({ status: 'ok', attempts: 1 })
    expect(r.tarefas[1]).toMatchObject({ status: null, attempts: null })
  })

  // ───────────────────────── a prova horária ─────────────────────────
  it('prova: parâmetro nulo devolve nulo', async () => {
    const site = await novoSite()
    const chamar = async (a: [string | null, string | null, number | null, number | null]): Promise<unknown> =>
      (await q(pg, 'select public.competitor_hourly_health($1::uuid, $2::timestamptz, $3::integer, $4::integer) as r', a))[0]!.r
    const base: [string, string, number, number] = [site, iso(P), 14, 25]
    expect(await chamar(base)).not.toBeNull()
    for (let i = 0; i < 4; i++) {
      const a: [string | null, string | null, number | null, number | null] = [...base]
      a[i] = null
      expect(await chamar(a), `parâmetro ${i + 1} nulo`).toBeNull()
    }
  })

  it('prova: site sem nada', async () => {
    const r = await prova(await novoSite())
    expect(r).toEqual({
      desde: null, ultima_leitura: null, horas_lidas_24h: 0, videos_na_lista: 0, videos_fora_do_teto: 0, videos_cobrados: 0, videos_abaixo_de_22h: 0, videos_abaixo_do_lido: 0,
      proprios_desde: null, proprios_ultima_leitura: null, proprios_na_lista: 0, proprios_fora_do_teto: 0, proprios_sem_captura: 0, proprios_cobrados: 0,
      proprios_abaixo_de_22h: 0, proprios_abaixo_do_lido: 0, proprios_em_competitor: 0,
    })
  })

  it('prova: sobe com vídeo de 5 dias sem leitura', async () => {
    const site = await novoSite()
    await videoConc(await canalConc(site))
    expect(await prova(site)).toMatchObject({ videos_cobrados: 1, videos_abaixo_de_22h: 1, videos_na_lista: 1 })
  })

  it('prova: não sobe com 22 leituras; sobe com 21 quando as 24 horas foram lidas', async () => {
    const site = await novoSite()
    const ch = await canalConc(site)
    const a = await videoConc(ch, { pub: P - 5 * DIA }); const b = await videoConc(ch, { pub: P - 5 * DIA - HORA })
    await lerConc(a, site, ultimas(24)); await lerConc(b, site, ultimas(22))
    expect(await prova(site)).toMatchObject({ horas_lidas_24h: 24, videos_cobrados: 2, videos_abaixo_do_lido: 0, videos_abaixo_de_22h: 0 })
    await pg.query('delete from public.competitor_video_hourly where video_id = $1 and hour_slot = $2', [b, iso(P - 21 * HORA)])
    expect(await prova(site)).toMatchObject({ horas_lidas_24h: 24, videos_abaixo_do_lido: 1, videos_abaixo_de_22h: 1 })
  })

  it('prova: buraco geral de 3 horas já encerrado não acusa vídeo nenhum', async () => {
    const site = await novoSite()
    const ch = await canalConc(site)
    for (let i = 0; i < 25; i++) await lerConc(await videoConc(ch, { pub: P - 5 * DIA - i * 60_000 }), site, ultimas(24, [5, 6, 7]))
    expect(await prova(site)).toMatchObject({ horas_lidas_24h: 21, videos_cobrados: 25, videos_abaixo_de_22h: 25, videos_abaixo_do_lido: 0 })
  })

  it('prova: com buraco geral, o vídeo com falha própria continua acusado', async () => {
    const site = await novoSite()
    const ch = await canalConc(site)
    for (let i = 0; i < 24; i++) await lerConc(await videoConc(ch, { pub: P - 5 * DIA - i * 60_000 }), site, ultimas(24, [5, 6, 7]))
    await lerConc(await videoConc(ch, { pub: P - 6 * DIA }), site, ultimas(24, [5, 6, 7, 8, 9, 10, 11]))
    expect(await prova(site)).toMatchObject({ horas_lidas_24h: 21, videos_cobrados: 25, videos_abaixo_do_lido: 1 })
  })

  it('prova: a janela é (agora − 24 h, agora]', async () => {
    const site = await novoSite()
    const v = await videoConc(await canalConc(site))
    await lerConc(v, site, [P - 24 * HORA])
    expect((await prova(site)).horas_lidas_24h).toBe(0)
    await lerConc(v, site, [P + HORA])
    expect((await prova(site)).horas_lidas_24h).toBe(0)
    await lerConc(v, site, [P])
    expect(await prova(site)).toMatchObject({ horas_lidas_24h: 1, ultima_leitura: expect.any(String) })
  })

  it('prova: não sobe com vídeo faltoso, sem contagem, descoberto há 3 h, ao vivo, ao vivo que acabou há 5 h, estreia, de 12 h, de 13,5 dias, ausente e de canal ausente', async () => {
    const site = await novoSite()
    const ch = await canalConc(site)
    await videoConc(ch, { falta: 1 })
    await videoConc(ch, { oculto: true })
    await videoConc(ch, { pub: P - 5 * DIA, descoberto: P - 3 * HORA })
    await videoConc(ch, { lbc: 'live' })
    await videoConc(ch, { lbc: 'none', fimAoVivo: P - 5 * HORA })
    await videoConc(ch, { lbc: 'upcoming' })
    await videoConc(ch, { pub: P - 12 * HORA })
    await videoConc(ch, { pub: P - 13.5 * DIA })
    await videoConc(ch, { ausente: true })
    await videoConc(await canalConc(site, { ausente: true }))
    expect(await prova(site)).toMatchObject({ videos_cobrados: 0, videos_abaixo_de_22h: 0 })
    await videoConc(ch)                         // o controle: um vídeo comum entra
    expect(await prova(site)).toMatchObject({ videos_cobrados: 1, videos_abaixo_de_22h: 1 })
  })

  it('prova: o 26º vídeo do canal não é cobrado e é contado fora do teto', async () => {
    const site = await novoSite()
    const ch = await canalConc(site)
    for (let i = 0; i < 27; i++) await videoConc(ch, { pub: P - 3 * DIA - i * 60_000 })
    expect(await prova(site)).toMatchObject({ videos_na_lista: 25, videos_fora_do_teto: 2, videos_cobrados: 25 })
  })

  it('prova: as leituras de um site não entram na conta de outro', async () => {
    const [a, b] = [await novoSite(), await novoSite()]
    await lerConc(await videoConc(await canalConc(a)), a, ultimas(24))
    await videoConc(await canalConc(b))
    expect(await prova(a)).toMatchObject({ horas_lidas_24h: 24 })
    expect(await prova(b)).toMatchObject({ horas_lidas_24h: 0, ultima_leitura: null, desde: null, videos_cobrados: 1, videos_abaixo_de_22h: 1 })
  })

  // o dono: dia D às 00:00 UTC; publicado às 18:00; cadastrado e capturado às 05:00 do dia seguinte
  const D0 = Math.floor(P / DIA) * DIA
  const PUB_DONO = D0 + 18 * HORA
  const CAP_DONO = D0 + 29 * HORA
  async function donoNovo(siteId: string, leituras: number): Promise<{ id: string; yt: string; canal: string }> {
    const ch = await canalDono(siteId)
    const v = await videoDono(siteId, ch, { pub: PUB_DONO, criado: CAP_DONO, captura: CAP_DONO, diaPt: dia(D0) })
    await lerDono(siteId, v, Array.from({ length: leituras }, (_, k) => CAP_DONO + k * HORA))
    return v
  }

  /** De 22:00 de D+1 até 10:00 de D+2, a cada hora (+ `folgaMs`): 13 provas. A 26 horas da captura é a de k = 9. */
  async function horaAHora(folgaMs: number): Promise<{ cobrados: number[]; abaixo: number[] }> {
    const site = await novoSite()
    await donoNovo(site, 41)
    const cobrados: number[] = []; const abaixo: number[] = []
    for (let k = 0; k < 13; k++) {
      const r = await prova(site, D0 + 46 * HORA + k * HORA + folgaMs)
      cobrados.push(Number(r.proprios_cobrados)); abaixo.push(Number(r.proprios_abaixo_de_22h))
    }
    return { cobrados, abaixo }
  }
  const SOBE_EM_K9 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1]

  // Fronteira das 26 h: a MG9 escreve `m.captured_at < p_now - interval '26 hours'` (estrito), então o vídeo passa a ser cobrado
  // DEPOIS de 26 h (às 26 h exatas ainda não). Decisão do portão final (ruling, 13/10): fica assim; os dois `it.fails` que escreviam
  // "26 h exatas" saíram e valem os pares com 1 s de folga abaixo.
  it('prova do dono: vídeo novo com leitura completa nunca sobe, hora a hora (com 1 s de folga depois das 26 h)', async () => {
    const r = await horaAHora(1000)
    expect(r.abaixo).toEqual(Array(13).fill(0))
    expect(r.cobrados).toEqual(SOBE_EM_K9)
  })

  it('prova do dono: sobe às 26 horas da captura, não antes (com 1 s de folga)', async () => {
    const site = await novoSite()
    await donoNovo(site, 2)
    expect(await prova(site, CAP_DONO + 26 * HORA - 60_000)).toMatchObject({ proprios_cobrados: 0 })
    expect(await prova(site, CAP_DONO + 26 * HORA)).toMatchObject({ proprios_cobrados: 0 })   // o ACHADO: 26 h exatas ainda não
    expect(await prova(site, CAP_DONO + 26 * HORA + 1000)).toMatchObject({ proprios_cobrados: 1, proprios_abaixo_de_22h: 1 })
  })

  it('prova do dono: o teto de 25 por canal', async () => {
    const site = await novoSite()
    const ch = await canalDono(site)
    for (let i = 0; i < 27; i++) {
      const v = await videoDono(site, ch, { pub: P - 5 * DIA - i * 60_000 })
      if (i < 25) await lerDono(site, v, ultimas(24))
    }
    expect(await prova(site)).toMatchObject({ proprios_na_lista: 25, proprios_fora_do_teto: 2, proprios_cobrados: 25, proprios_abaixo_de_22h: 0 })
  })

  it('prova do dono: não listado, sem captura e captura com estado nulo não são cobrados', async () => {
    const site = await novoSite()
    const ch = await canalDono(site)
    await videoDono(site, ch, { privacidade: 'unlisted' })
    await videoDono(site, ch, { privacidade: 'semCaptura' })
    await videoDono(site, ch, { privacidade: 'nulo' })
    await videoDono(site, ch, { privacidade: 'semCaptura', pub: P - 3 * DIA, criado: P - 2 * HORA })   // cadastrado há 2 h: ainda não conta
    expect(await prova(site)).toMatchObject({ proprios_cobrados: 0, proprios_sem_captura: 2, proprios_na_lista: 4 })
  })

  it('prova: canal do dono dentro de competitor_channels', async () => {
    const [a, b] = [await novoSite(), await novoSite()]
    const yt = 'UC' + randomUUID().replace(/-/g, '').slice(0, 20)
    await pg.query(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug) values ($1, $2, 'pt', $3, 'T', 'UUx', $4)`, [a, yt, '@t' + yt.slice(2, 10), 'teste-' + yt.slice(2, 10)])
    await pg.query(`insert into public.competitor_channels (site_id, channel_id, channel_name) values ($1, $2, 'T')`, [a, yt])
    expect((await prova(a)).proprios_em_competitor).toBe(1)
    expect((await prova(b)).proprios_em_competitor).toBe(0)
  })

  it('prova da captura: a cota da leitura horária não esconde a cota do sync', async () => {
    const site = await novoSite()
    const diaPacifico = (await q(pg, `select ($1::timestamptz at time zone 'America/Los_Angeles')::date::text as d`, [iso(P)]))[0]!.d as string
    const saude = async (): Promise<Record<string, unknown>> => (await q(pg, 'select public.competitor_capture_health($1::uuid, $2::timestamptz) as r', [site, iso(P)]))[0]!.r as Record<string, unknown>
    const semCota = (o: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'cota_dia_pacifico'))
    await pg.query(`insert into public.youtube_quota_usage (site_id, date, units_used, operations) values ($1, $2, 5, '{"horario": 5}')`, [site, diaPacifico])
    const l1 = await saude()
    await pg.query(`select public.youtube_quota_add($1::uuid, $2::date, 7, '{"competitors": 7}'::jsonb, '{}'::jsonb)`, [site, diaPacifico])
    const l2 = await saude()
    await pg.query(`update public.youtube_quota_usage set operations = '{"competitors": "muitos"}' where site_id = $1`, [site])
    const l3 = await saude()
    await pg.query('delete from public.youtube_quota_usage where site_id = $1', [site])
    const l4 = await saude()
    expect([l1.cota_dia_pacifico, l2.cota_dia_pacifico, l3.cota_dia_pacifico, l4.cota_dia_pacifico]).toEqual([0, 7, 0, 0])
    expect(Object.keys(l1)).toHaveLength(9)
    for (const l of [l2, l3, l4]) expect(semCota(l)).toEqual(semCota(l1))
  })

  // ───────────────────────── as tabelas ─────────────────────────
  it('a hora cheia: hour_slot diferente da hora de taken_at é recusado', async () => {
    const site = await novoSite()
    const v = await videoConc(await canalConc(site))
    await expect(pg.query(`insert into public.competitor_video_hourly (video_id, hour_slot, taken_at, site_id, views) values ($1, $2, $3, $4, 1)`,
      [v, iso(P - HORA), iso(P + 10 * 60_000), site])).rejects.toMatchObject({ code: '23514' })
  })

  it('duas leituras na mesma hora: uma linha, a primeira', async () => {
    const site = await novoSite()
    const v = await videoConc(await canalConc(site))
    for (const [min, views] of [[5, 111], [40, 222]] as const) {
      await pg.query(`insert into public.competitor_video_hourly (video_id, hour_slot, taken_at, site_id, views) values ($1, $2, $3, $4, $5) on conflict do nothing`,
        [v, iso(P), iso(P + min * 60_000), site, views])
    }
    const rows = await q(pg, 'select views from public.competitor_video_hourly where video_id = $1', [v])
    expect(rows).toEqual([{ views: '111' }])
  })

  it('as duas tabelas do mapa têm as mesmas colunas', async () => {
    const cols = async (tabela: string, chave: string): Promise<string[]> =>
      (await q(pg, `select column_name || ' ' || data_type || ' ' || is_nullable || ' ' || coalesce(column_default, '') as c from information_schema.columns
        where table_schema = 'public' and table_name = $1 and column_name <> $2 order by column_name`, [tabela, chave])).map(r => String(r.c))
    const a = await cols('competitor_channel_hour_map', 'competitor_channel_id')
    const b = await cols('yt_own_public_hour_map', 'channel_id')
    expect(a.length).toBeGreaterThan(20)
    expect(a.filter(x => !b.includes(x))).toEqual([])
    expect(b.filter(x => !a.includes(x))).toEqual([])
  })

  async function semearMapaEFold(site: string, canal: string, video: string): Promise<void> {
    await pg.query(`insert into public.competitor_channel_hour_map (competitor_channel_id, month, format, phase, site_id, views_sum, likes_sum, comments_sum, views_share, likes_share, comments_share, n_intervals)
      values ($1, '2026-01-01', 'longo', 'lancamento', $2, array_fill(0::bigint, array[168]), array_fill(0, array[168]), array_fill(0, array[168]),
              array_fill(0::real, array[168]), array_fill(0::real, array[168]), array_fill(0::real, array[168]), array_fill(0, array[168]))`, [canal, site])
    await pg.query(`insert into public.competitor_hour_fold_log (video_id, day, site_id, intervals_clean, intervals_long) values ($1, '2026-01-01', $2, 1, 0)`, [video, site])
  }

  it('impacto da remoção do concorrente conta as três tabelas novas', async () => {
    const site = await novoSite()
    const ch = await canalConc(site)
    const v = await videoConc(ch)
    await lerConc(v, site, ultimas(3))
    await semearMapaEFold(site, ch, v)
    const r = (await q(pg, 'select public.competitor_channel_removal_impact($1::uuid, $2::uuid) as r', [site, ch]))[0]!.r as Record<string, unknown>
    expect(r).toMatchObject({ status: 'ok', name: 'Teste', videos: 1, hourly: 3, hour_map: 1, hour_fold_log: 1 })
    for (const k of ['status', 'name', 'videos', 'pinned', 'versions', 'daily_days', 'bookmarks', 'field_versions', 'raw', 'early', 'tier_spans']) expect(r, k).toHaveProperty(k)
  })

  it('remover o canal de concorrente zera as leituras dele', async () => {
    const site = await novoSite()
    const ch = await canalConc(site)
    const v = await videoConc(ch)
    await lerConc(v, site, ultimas(3))
    await semearMapaEFold(site, ch, v)
    await pg.query('delete from public.competitor_channels where id = $1', [ch])
    for (const [t, c] of [['competitor_video_hourly', 'video_id'], ['competitor_channel_hour_map', 'competitor_channel_id'], ['competitor_hour_fold_log', 'video_id']] as const) {
      const n = (await q(pg, `select count(*)::int as n from public.${t} where site_id = $1`, [site]))[0]!.n
      expect(n, `${t}.${c}`).toBe(0)
    }
  })

  it('canal do dono com leitura horária não é apagado; serie_coletada soma', async () => {
    const site = await novoSite()
    const ch = await canalDono(site)
    const v = await videoDono(site, ch)
    await lerDono(site, v, ultimas(24))
    await expect(pg.query('delete from public.youtube_channels where id = $1', [ch])).rejects.toMatchObject({ code: '23503' })
    const r = (await q(pg, 'select public.youtube_channel_removal_impact($1::uuid, $2::uuid) as r', [site, ch]))[0]!.r as Record<string, unknown>
    expect(r).toMatchObject({ status: 'ok', videos: 1 })
    // as 24 leituras horárias, mais a linha da captura diária de privacidade (outra tabela do dono com a mesma FK "restrict")
    const meta = (await q(pg, 'select count(*)::int as n from public.yt_own_video_meta_daily where channel_id = $1', [ch]))[0]!.n as number
    expect(r.serie_coletada).toBe(24 + meta)
  })

  it('impacto do canal próprio soma tabela de outra etapa criada antes ou depois', async () => {
    const site = await novoSite()
    const ch = await canalDono(site)
    const impacto = async (): Promise<number> => ((await q(pg, 'select public.youtube_channel_removal_impact($1::uuid, $2::uuid) as r', [site, ch]))[0]!.r as { serie_coletada: number }).serie_coletada
    const antes = await impacto()
    const tabela = 'teste_' + randomUUID().replace(/-/g, '')
    await pg.query('begin')
    try {
      await pg.query(`create table public.${tabela} (id serial primary key, channel_id uuid not null references public.youtube_channels(id) on delete restrict)`)
      await pg.query(`insert into public.${tabela} (channel_id) values ($1), ($1)`, [ch])
      expect(await impacto()).toBe(antes + 2)
    } finally {
      await pg.query('rollback')
    }
    expect(await impacto()).toBe(antes)
  })

  it('impacto do canal próprio: site errado e site nulo', async () => {
    const [a, b] = [await novoSite(), await novoSite()]
    const ch = await canalDono(a)
    const f = async (s: string | null): Promise<unknown> => (await q(pg, 'select public.youtube_channel_removal_impact($1::uuid, $2::uuid) as r', [s, ch]))[0]!.r
    expect(await f(b)).toEqual({ status: 'not_found' })
    expect(await f(null)).toEqual({ status: 'not_found' })
    expect(await f(a)).toMatchObject({ status: 'ok' })
  })

  // ───────────────────────── contra os módulos TypeScript ─────────────────────────
  // O que o BANCO devolve tem de casar com o que `agenda/estado.ts` e `horaria/*.ts` esperam (nomes de parâmetro, forma, tipos).
  describe('contrato com os módulos TypeScript (chamados pelo PostgREST real)', () => {
    it('tomar, fechar, esgotar e adiar: nomes de parâmetro e booleanos', async () => {
      const t = tarefa()
      expect(await tomar(sb, { task: t, period_key: 'k', teto: 3, reabrir: false })).toEqual({ valor: true })
      expect(await tomar(sb, { task: t, period_key: 'k', teto: 3, reabrir: false })).toEqual({ valor: false })
      expect(await fechar(sb, { task: t, period_key: 'k', estado: 'erro', feitas: 0, deixadas: null, motivo: 'api_falhou', ms: 12.4, detalhe: { lidos: 3 } })).toEqual({ valor: true })
      expect(await linha(t, 'k')).toMatchObject({ status: 'erro', reason: 'api_falhou', duration_ms: 12, detail: { lidos: 3 }, left_n: null })
      expect(await fechar(sb, { task: t, period_key: 'k', estado: 'ok', feitas: 1, deixadas: 0, ms: 1 })).toEqual({ valor: false })
      // texto livre como motivo: a barreira do módulo troca por 'motivo_invalido' antes de chegar ao banco
      const u = tarefa()
      expect(await tomar(sb, { task: u, period_key: 'k', teto: 3, reabrir: false })).toEqual({ valor: true })
      expect(await fechar(sb, { task: u, period_key: 'k', estado: 'erro', feitas: 0, deixadas: null, motivo: 'Texto Livre', ms: 1 })).toEqual({ valor: true })
      expect((await linha(u, 'k')).reason).toBe('motivo_invalido')
      expect(await tomar(sb, { task: t, period_key: 'k', teto: 3, reabrir: false })).toEqual({ valor: true })
      await fechar(sb, { task: t, period_key: 'k', estado: 'erro', feitas: 0, deixadas: null, motivo: 'api_falhou', ms: 1 })
      expect(await tomar(sb, { task: t, period_key: 'k', teto: 2, reabrir: false })).toEqual({ valor: false })
      expect(await esgotar(sb, { task: t, period_key: 'k', teto: 2 })).toEqual({ valor: true })
      expect((await linha(t, 'k')).status).toBe('esgotada')
      await adiar(sb, { task: tarefa(), period_key: 'k', motivo: 'sem_tempo' })
      const d = tarefa()
      await adiar(sb, { task: d, period_key: 'k', motivo: 'uma_pesada_por_disparo' })
      expect(await linha(d, 'k')).toMatchObject({ status: 'adiada', reason: 'uma_pesada_por_disparo', attempts: 0 })
    })

    it('tomar com reabrir reabre uma linha ok', async () => {
      const t = tarefa()
      await semear(t, 'k', 'ok')
      expect(await tomar(sb, { task: t, period_key: 'k', teto: 3, reabrir: true })).toEqual({ valor: true })
      expect(await linha(t, 'k')).toMatchObject({ status: 'rodando', attempts: 1 })
    })

    it('arrendamento: os nomes de parâmetro que o módulo usa (com um nome de teste, nunca o "despachante")', async () => {
      const nome = 'teste-' + randomUUID(); leases.push(nome)
      const holder = randomUUID()
      const a = await sb.rpc('competitor_agenda_lease_take', { p_name: nome, p_holder: holder, p_ttl: '290 seconds' })
      expect(a.error).toBeNull(); expect(a.data).toBe(true)
      const b = await sb.rpc('competitor_agenda_lease_take', { p_name: nome, p_holder: randomUUID(), p_ttl: '290 seconds' })
      expect(b.data).toBe(false)
      const c = await sb.rpc('competitor_agenda_lease_release', { p_name: nome, p_holder: holder })
      expect(c.error).toBeNull(); expect(c.data).toBe(true)
    })

    it('lerEstado: a forma do banco passa na conferência do módulo, com tarefa sem linha e com linha', async () => {
      const [com, sem] = [tarefa(), tarefa()]
      expect(await tomar(sb, { task: com, period_key: 'k', teto: 3, reabrir: false })).toEqual({ valor: true })
      expect(await fechar(sb, { task: com, period_key: 'k', estado: 'ok', feitas: 4, deixadas: null, ms: 5 })).toEqual({ valor: true })
      const r = await lerEstado(sb, [{ task: com, period_key: 'k' }, { task: sem, period_key: 'k' }])
      expect(r, JSON.stringify(r)).toHaveProperty('valor')
      if (!('valor' in r)) return
      expect(r.valor.desde).not.toBeNull()
      expect(r.valor.tarefas[0]).toMatchObject({ task: com, status: 'ok', attempts: 1, runs: 1, unfinished_n: 0, done_n: 4, left_n: null, reason: null, last_run_status: 'ok', last_run_done_n: 4 })
      expect(r.valor.tarefas[0]!.last_ok_at).not.toBeNull()
      expect(r.valor.tarefas[1]).toMatchObject({ task: sem, status: null, attempts: null, last_ok_at: null, last_run_status: null })
      // sem nenhuma linha em todo o pedido: desde nulo (e não "não li")
      const vazio = await lerEstado(sb, [{ task: sem, period_key: 'k' }])
      expect(vazio, JSON.stringify(vazio)).toHaveProperty('valor')
      if ('valor' in vazio) expect(vazio.valor.desde).toBeNull()
    })

    it('lerProvaHoraria: a forma da prova passa na conferência do módulo e os números são os do banco', async () => {
      const site = await novoSite()
      await lerConc(await videoConc(await canalConc(site)), site, ultimas(24))
      const r = await lerProvaHoraria(sb, site, iso(P))
      expect(r, JSON.stringify(r)).toHaveProperty('valor')
      if (!('valor' in r)) return
      const direto = await prova(site)
      expect(r.valor).toMatchObject({ horas_lidas_24h: 24, videos_cobrados: 1, videos_abaixo_de_22h: 0, proprios_cobrados: 0, proprios_em_competitor: 0 })
      expect(Date.parse(String(r.valor.ultima_leitura))).toBe(Date.parse(String(direto.ultima_leitura)))
      expect(Date.parse(String(r.valor.desde))).toBe(Date.parse(String(direto.desde)))
      // site sem nada: todas as contagens zero e datas nulas, continua uma prova válida
      const vazia = await lerProvaHoraria(sb, await novoSite(), iso(P))
      expect(vazia, JSON.stringify(vazia)).toHaveProperty('valor')
    })

    it('lerCandidatos: o filtro composto do PostgREST (.or com published_at nulo e descoberta na janela) funciona contra o PostgREST real', async () => {
      const site = await novoSite()
      const ch = await canalConc(site)
      const normal = await videoConc(ch, { pub: P - 2 * DIA })
      const nuloRecente = await videoConc(ch, { pub: null, descoberto: P - 2 * DIA })
      const nuloAntigo = await videoConc(ch, { pub: null, descoberto: P - 30 * DIA })
      const antigo = await videoConc(ch, { pub: P - 30 * DIA })
      const dono = await canalDono(site)
      const meu = await videoDono(site, dono, { pub: P - 3 * DIA })
      const meuAntigo = await videoDono(site, dono, { pub: P - 40 * DIA })
      const r = await lerCandidatos(sb, P)
      const meus = r.conc.filter(c => c.siteId === site)
      expect(meus.map(c => c.id).sort()).toEqual([normal, nuloRecente].sort())
      expect(meus.find(c => c.id === nuloRecente)).toMatchObject({ publishedAt: null })
      expect(meus.find(c => c.id === normal)?.canalAusente).toBe(false)
      expect(r.conc.some(c => c.id === nuloAntigo || c.id === antigo)).toBe(false)
      expect(r.prop.filter(c => c.siteId === site).map(c => c.id)).toEqual([meu.id])
      expect(r.prop.some(c => c.id === meuAntigo.id)).toBe(false)
    }, 60_000)
  })
})
