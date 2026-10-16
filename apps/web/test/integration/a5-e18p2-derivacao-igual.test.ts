// @vitest-environment node
/**
 * A5 · E18 parte 2, Tarefa 8: o item 202 de ponta a ponta. O passo `versoes` REAL (`passoVersoes`), contra Postgres de verdade, sobre a tabela
 * inteira e sobre a tabela depois da dieta: as versões têm de sair IGUAIS, coluna a coluna.
 * Banco: SÓ o `bythiago_int` (precisa da MG12 nele). Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/a5-e18p2-derivacao-igual.test.ts --no-file-parallelism
 *
 * Tudo dentro de `begin; … rollback;`: a MG17a e as funções da MG17 vivem só na transação (nunca persistentes). O passo roda sobre o
 * `pgSupabase` (test/helpers/pg-supabase.ts), que usa a MESMA conexão da transação. O SQL vem dos arquivos de ensaio (fora do git) ou das
 * migrations, como em `a5-e18p2-dieta.test.ts` (sem a migration da MG17 no repositório, este arquivo fica vermelho até ela existir).
 *
 * Caso 5 (R2, o ensaio com o CSV real): só com `E18P2_ENSAIO=1`. O controlador carrega o CSV do dono em `public.e18p2_ensaio_csv`
 * (`create table public.e18p2_ensaio_csv (like public.yt_own_video_meta_daily)`, RLS ligada, sem policy, `revoke all`; depois `\copy`), roda o teste e
 * SEMPRE solta a tabela (`drop table if exists public.e18p2_ensaio_csv`, fora de condição, também quando o teste falha). O teste não imprime título,
 * descrição nem URL: só contagens e md5.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { pgSupabase } from '../helpers/pg-supabase'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { passoVersoes, type VersoesResumo } from '@/lib/youtube/coleta/versoes-step'
import type { ColetaChannel } from '@/lib/youtube/coleta/types'

vi.setConfig({ testTimeout: 180_000 })
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url))

type Linha = Record<string, unknown>
type Json = Record<string, unknown>

function lerSql(ensaioRel: string, trecho: string): string {
  const ensaio = `${RAIZ}.superpowers/sdd/a5-e18p2/sql/${ensaioRel}`
  if (existsSync(ensaio)) return readFileSync(ensaio, 'utf8')
  const dir = `${RAIZ}supabase/migrations/`
  const achado = readdirSync(dir).find(f => f.includes(trecho))
  if (!achado) throw new Error(`nem o arquivo de ensaio nem a migration existem (${ensaioRel} / ${trecho})`)
  return readFileSync(dir + achado, 'utf8')
}
function extrair(sql: string, pref: string, nome: string): string {
  const de = sql.indexOf(`-- >>> ${pref} ${nome} (início)`)
  const fim = sql.indexOf(`-- <<< ${pref} ${nome} (fim)`)
  if (de < 0 || fim < 0 || fim < de) throw new Error(`marca ${pref} ${nome} não achada no SQL`)
  const ate = sql.indexOf('\n', fim)
  return sql.slice(de, ate < 0 ? sql.length : ate)
}

const D0 = '2026-02-18'
const mais = (dia: string, n: number): string => new Date(Date.parse(dia + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10)
const AGORA = '2026-03-10T15:00:00Z'
const ULTIMO = '2026-03-09' // D0 + 19

describe.skipIf(skipIfNoLocalDb())('A5 E18 P2, T8: a derivação inteira é igual à derivação depois da dieta (bythiago_int)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const sites: string[] = []
  let S1 = ''
  let SQL17A = ''
  let SQL17 = ''
  let LINHAS_DO_MEIO = ''
  let AUX = ''
  let COVER = ''

  beforeAll(async () => {
    SQL17A = lerSql('mg17a.sql', 'observatorio_a5_e18p2_cobertura_de_metadados')
    SQL17 = lerSql('mg17.sql', 'observatorio_a5_e18p2_dieta_de_metadados')
    LINHAS_DO_MEIO = extrair(SQL17, 'MG17', 'yt_own_meta_linhas_do_meio')
    AUX = extrair(SQL17, 'MG17', 'auxiliares')
    COVER = extrair(SQL17, 'MG17', 'yt_own_meta_cover') + '\n;'
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    S1 = (await seedSite(sb)).siteId; sites.push(S1)
  })
  afterAll(async () => {
    try {
      if (pg && sites.length > 0) await pg.query('delete from public.sites where id = any($1::uuid[])', [sites])
    } finally {
      if (pg) await pg.end()
    }
  })

  const q = async (sql: string, params: unknown[] = []): Promise<Linha[]> => (await pg.query(sql, params)).rows as Linha[]

  /** Tudo dentro de uma transação desfeita, com a MG17a e as funções da MG17 (critério, auxiliares e o corpo novo de `yt_own_meta_cover`). */
  async function tx(fn: () => Promise<void>): Promise<void> {
    await pg.query('begin')
    try {
      await pg.query("set local lock_timeout = '5s'")
      await pg.query(SQL17A)
      await pg.query(LINHAS_DO_MEIO)
      await pg.query(AUX)
      await pg.query(COVER)
      await fn()
    } finally {
      await pg.query('rollback')
    }
  }

  interface Cena { site: string; canal: string; uc: string; nome: string; v: Array<{ id: string; yt: string }> }
  async function cena(site: string, nVideos: number): Promise<Cena> {
    const slug = 'teste-' + randomUUID().replace(/-/g, '').slice(0, 8)
    const uc = 'UC' + randomUUID().replace(/-/g, '').slice(0, 22)
    const c = await q(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [site, uc, '@' + slug, 'UU' + randomUUID().replace(/-/g, '').slice(0, 22), slug])
    const canal = String(c[0]!.id)
    const v: Cena['v'] = []
    for (let i = 0; i < nVideos; i++) {
      const yt = 'y' + randomUUID().replace(/-/g, '').slice(0, 10)
      const r = await q(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at)
        values ($1, $2, $3, 'Teste', '2025-01-01T12:00:00Z') returning id`, [site, canal, yt])
      v.push({ id: String(r[0]!.id), yt })
    }
    return { site, canal, uc, nome: 'Teste', v }
  }
  interface OpLinha { priv?: string | null; dhash?: string | null; title?: string; tituloCap?: string | null; ab?: string | null; sec?: number | null }
  async function meta(c: Cena, i: number, d: number, o: OpLinha = {}): Promise<void> {
    const priv = o.priv === undefined ? 'public' : o.priv
    const dhash = o.dhash === undefined ? '0'.repeat(15) + String(i) : o.dhash
    const title = o.title ?? 'T'
    await pg.query(`insert into public.yt_own_video_meta_daily
      (youtube_video_id, day_pt, site_id, video_id, channel_id, title, title_at_capture, description_text, description_sha256, privacy_status,
       thumbnail_dhash, ab_test_id, seconds_on_air_analytics, captured_at)
      values ($1, $2, $3, $4, $5, $6, $7, 'desc', $13, $8, $9, $10, $11, $12)`,
      [c.v[i]!.yt, mais(D0, d), c.site, c.v[i]!.id, c.canal, title, o.tituloCap === undefined ? title : o.tituloCap, priv, dhash, o.ab ?? null, o.sec ?? null, mais(D0, d) + 'T15:00:00Z', 'd'.repeat(64)])
  }
  async function cobrir(c: Cena, ate: string): Promise<void> {
    await pg.query('select public.yt_own_meta_cover($1::uuid, $2::uuid, $3::date, false)', [c.site, c.canal, ate])
  }
  async function run(quando: string, resumo: Json): Promise<void> {
    await pg.query(`insert into public.yt_own_collection_runs (ran_at, ms_total, ms_existente, ms_passos, falhas, acao_do_dono, resumo)
      values ($1, 1000, 500, '{}'::jsonb, '{}'::text[], '{}'::text[], $2::jsonb)`, [quando, JSON.stringify(resumo)])
  }
  function resumoLimpo(canal: string): Json {
    return {
      metadados: {
        gravados: 5, pendentes: 0, tentativas: { ok: 2 }, dias_sem_meta: { [canal]: 0 },
        cobertura: { canais: 1, ok: 1, falhas: 0, sem_tempo: false, descobertas: 0, sem_explicacao: 0 },
      },
      versoes: { desligado: false, sem_tempo: false, atraso_dias: { [canal]: 0 }, recuperando: {}, atraso_desconhecido: [], dia_sem_resposta: [], confirmadas: 3, dias_derivados: 1 },
    }
  }
  /** Apaga a faixa que a função lê e põe 14 execuções limpas, uma por dia, a última em `agora`. */
  async function execucoes(canal: string, agora: string): Promise<void> {
    await pg.query(`delete from public.yt_own_collection_runs where ran_at > $1::timestamptz - interval '20 days' and ran_at <= $1::timestamptz`, [agora])
    for (let k = 0; k < 14; k++) await run(mais(agora.slice(0, 10), -k) + 'T12:30:00Z', resumoLimpo(canal))
  }
  const marca = (dia: string): Promise<unknown> => pg.query(`comment on table public.yt_own_video_meta_daily is 'E18P2 armada em ${dia}'`)

  /** A semente do plano, com 40 dias por vídeo? Não: a da Tarefa 6 (6 vídeos x 20 dias, com troca de título, dia sem captura, dia de teste A/B e buraco). */
  async function semear(site: string): Promise<Cena> {
    const c = await cena(site, 6)
    for (let d = 0; d < 20; d++) {
      await meta(c, 0, d, { priv: d === 0 ? null : 'public' })
      await meta(c, 1, d, { priv: d === 0 ? null : 'public', title: d >= 8 && d <= 11 ? 'B' : 'A' })
      if (d === 5 || d === 6) await meta(c, 2, d, { priv: null, dhash: null, tituloCap: null })
      else await meta(c, 2, d, { priv: d === 0 ? null : 'public' })
      if (d >= 10 && d <= 14) await meta(c, 3, d, { ab: '00000000-0000-4000-8000-000000000001', sec: 100 + d })
      else await meta(c, 3, d, { priv: d === 0 ? null : 'public' })
      await meta(c, 4, d, { priv: d === 0 ? null : 'private', dhash: null })
      if (d !== 9 && d !== 10) await meta(c, 5, d, { priv: d === 0 ? null : 'public' })
    }
    await cobrir(c, ULTIMO)
    return c
  }

  const canalDe = (c: Cena): ColetaChannel => ({ id: c.canal, channel_id: c.uc, site_id: c.site, name: c.nome, sync_enabled: true, collection_status: 'ok', video_count: null })
  async function passo(c: Cena, ontem: string): Promise<{ r: VersoesResumo; falhas: string[] }> {
    const falhas: string[] = []
    const r = await passoVersoes({ supabase: pgSupabase(pg), channels: [canalDe(c)], deadline: Date.now() + 120_000, falhas, tentativas: [], ontem })
    return { r, falhas }
  }
  /** Todas as colunas das versões, menos `id` e `created_at`, em ordem estável. */
  const versoes = (c: Cena): Promise<Linha[]> =>
    q(`select to_jsonb(v) - 'id' - 'created_at' as j from public.yt_own_video_versions v where site_id = $1 and channel_id = $2
       order by youtube_video_id, field, first_seen_at, first_day_pt, value_hash`, [c.site, c.canal]).then(r => r.map(x => x.j as Linha))
  const apagarDerivacao = async (c: Cena): Promise<void> => {
    await pg.query('delete from public.yt_own_video_versions where site_id = $1 and channel_id = $2', [c.site, c.canal])
    await pg.query('delete from public.yt_own_versions_state where site_id = $1 and channel_id = $2', [c.site, c.canal])
  }
  const linhasDe = async (c: Cena): Promise<number> => Number((await q('select count(*)::int as n from public.yt_own_video_meta_daily where channel_id = $1', [c.canal]))[0]!.n)
  const dietaDe = async (site: string, agora: string): Promise<Json> => {
    const r = await q('select public.yt_own_meta_diet($1::uuid, $2::timestamptz) as r', [site, agora])
    return r[0]!.r as Json
  }
  const md5 = (x: unknown): string => createHash('md5').update(JSON.stringify(x)).digest('hex')

  /** Deriva a tabela inteira, emagrece pela função e deriva de novo (estado e versões do canal do teste apagados). */
  async function ida(c: Cena, ontem: string, agora: string): Promise<{ inteira: Linha[]; depois: Linha[]; apagadas: number; r2: VersoesResumo; falhas2: string[] }> {
    const a = await passo(c, ontem)
    expect(a.falhas, 'derivação inteira sem nota').toEqual([])
    const inteira = await versoes(c)
    const antes = await linhasDe(c)
    await execucoes(c.canal, agora)
    await marca(agora.slice(0, 10))
    await dietaDe(c.site, agora)
    const apagadas = antes - (await linhasDe(c))
    await apagarDerivacao(c)
    const b = await passo(c, ontem)
    return { inteira, depois: await versoes(c), apagadas, r2: b.r, falhas2: b.falhas }
  }

  it('1. semente: derivação inteira = derivação depois da dieta, linha a linha', async () => {
    await tx(async () => {
      const c = await semear(S1)
      const { inteira, depois, apagadas, falhas2 } = await ida(c, ULTIMO, AGORA)
      expect(apagadas, 'a dieta tem de ter apagado linhas, senão o teste não prova nada').toBeGreaterThan(0)
      expect(inteira.length).toBeGreaterThan(6)
      expect(falhas2.filter(f => f.includes('abriria versão'))).toEqual([])
      expect(depois).toEqual(inteira)
    })
  })

  it('2. no meio da derivação refeita, dia coberto sem linha avança last_day_pt', async () => {
    await tx(async () => {
      const c = await semear(S1)
      const a = await passo(c, ULTIMO)
      expect(a.falhas).toEqual([])
      await execucoes(c.canal, AGORA); await marca('2026-03-10'); await dietaDe(c.site, AGORA)
      await apagarDerivacao(c)
      const meio = mais(D0, 5) // v1 (índice 0) não tem mais linha neste dia: ficou só a cobertura
      expect(Number((await q('select count(*)::int as n from public.yt_own_video_meta_daily where youtube_video_id = $1 and day_pt = $2', [c.v[0]!.yt, meio]))[0]!.n)).toBe(0)
      const { r } = await passo(c, meio)
      expect(r.cobertos_sem_linha).toBeGreaterThan(0)
      const cur = await q(`select field, last_day_pt::text as d from public.yt_own_video_versions where youtube_video_id = $1 and is_current`, [c.v[0]!.yt])
      expect(cur).toHaveLength(3)
      expect(cur.every(x => x.d === meio)).toBe(true)
    })
  })

  it('3. dia sem linha e sem cobertura não avança (o buraco do vídeo 6, dias 9 e 10)', async () => {
    await tx(async () => {
      const c = await semear(S1)
      await passo(c, ULTIMO)
      await execucoes(c.canal, AGORA); await marca('2026-03-10'); await dietaDe(c.site, AGORA)
      await apagarDerivacao(c)
      const { r } = await passo(c, mais(D0, 10))
      expect(r.dias_derivados).toBeGreaterThan(0)
      const cur6 = await q(`select max(last_day_pt)::text as d from public.yt_own_video_versions where youtube_video_id = $1 and is_current`, [c.v[5]!.yt])
      const cur1 = await q(`select max(last_day_pt)::text as d from public.yt_own_video_versions where youtube_video_id = $1 and is_current`, [c.v[0]!.yt])
      expect(cur6[0]!.d).toBe(mais(D0, 8)) // o último dia com fato do vídeo 6
      expect(cur1[0]!.d).toBe(mais(D0, 10))
    })
  })

  it('4. depois da dieta, o caminho de todo dia não encontra dia coberto sem linha (um dia novo gravado, coberto e derivado)', async () => {
    await tx(async () => {
      const c = await semear(S1)
      await passo(c, ULTIMO)
      await execucoes(c.canal, AGORA); await marca('2026-03-10'); await dietaDe(c.site, AGORA)
      for (let i = 0; i < 6; i++) await meta(c, i, 20, { priv: 'public' })
      await cobrir(c, '2026-03-10')
      const antes = (await passo(c, '2026-03-10')).r
      // o dia novo tem linha real para todo vídeo com captura; os dias antigos já estavam derivados
      expect(antes.ja_derivado + antes.dias_derivados).toBeGreaterThan(0)
      expect(antes.cobertos_sem_linha).toBe(0)
    })
  })

  // ───────────────────────── R2: o ensaio com o CSV real (só com E18P2_ENSAIO=1) ─────────────────────────
  it.skipIf(!process.env.E18P2_ENSAIO)('5. R2, o CSV real: derivação inteira = derivação depois da dieta (só contagens e md5 saem)', async () => {
    try {
      await tx(async () => {
        const ex = await q(`select to_regclass('public.e18p2_ensaio_csv')::text as t`)
        if (!ex[0]!.t) throw new Error('public.e18p2_ensaio_csv não existe: carregar o CSV antes (\\copy)')
        const c = await cena(S1, 0)
        const ontem = String((await q('select max(day_pt)::text as d from public.e18p2_ensaio_csv'))[0]!.d)
        // as linhas reais vão para o site e o canal do teste, com `video_id` anulado (cada vídeo real vira um id de 11 caracteres no mesmo texto)
        await pg.query(`insert into public.yt_own_video_meta_daily select (jsonb_populate_record(null::public.yt_own_video_meta_daily,
          to_jsonb(e) || jsonb_build_object('site_id', $1::uuid, 'channel_id', $2::uuid, 'video_id', null))).* from public.e18p2_ensaio_csv e`, [c.site, c.canal])
        await pg.query(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at)
          select distinct $1::uuid, $2::uuid, youtube_video_id, 'Teste', '2020-01-01T12:00:00Z' from public.yt_own_video_meta_daily where channel_id = $2::uuid`, [c.site, c.canal])
        await cobrir(c, ontem)
        const agora = mais(ontem, 1) + 'T15:00:00Z'
        const { inteira, depois, apagadas } = await ida(c, ontem, agora)
        console.log(`R2: versões=${inteira.length} linhas_apagadas=${apagadas} md5_inteira=${md5(inteira)} md5_depois=${md5(depois)}`)
        expect(depois).toEqual(inteira)
      })
    } finally {
      await pg.query('drop table if exists public.e18p2_ensaio_csv') // fora de qualquer condição; a tabela guarda título e descrição de vídeo privado
      const r = await q(`select to_regclass('public.e18p2_ensaio_csv')::text as t`)
      console.log(`to_regclass('public.e18p2_ensaio_csv') = ${String(r[0]!.t)}`)
    }
  })
})
