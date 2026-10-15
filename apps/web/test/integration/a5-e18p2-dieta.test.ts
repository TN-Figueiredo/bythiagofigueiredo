// @vitest-environment node
/**
 * A5 · E18 parte 2, MG17: a dieta de `yt_own_video_meta_daily` (parte DESTRUTIVA). O SQL do Apêndice C do plano, contra Postgres de verdade.
 * Banco: SÓ o `bythiago_int` (precisa da MG12 aplicada nele: `yt_own_versions_state` e `yt_own_video_versions`). Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/a5-e18p2-dieta.test.ts --no-file-parallelism
 *
 * O SQL vem dos arquivos de ensaio (`.superpowers/sdd/a5-e18p2/sql/mg17a.sql` e `mg17.sql`, fora do git) ou, se não existirem, das
 * migrations `*observatorio_a5_e18p2_cobertura_de_metadados*` e `*observatorio_a5_e18p2_dieta_de_metadados*`.
 * Tudo roda dentro de `begin; … rollback;`; só os sites são persistentes (apagados no `afterAll`). A MG17 NUNCA é aplicada de forma
 * persistente: as funções saem por marcas (`-- >>> MG17 <nome> (início)`) e vivem só na transação. Função sem EXECUTE nunca é CHAMADA como
 * anon/authenticated: privilégio se confere por catálogo.
 *
 * Plano: 2026-10-13-a5-e6-p4-e-e18-parte-2-dieta-final, Tarefa 6 (6a: testes 1 a 8b; 6b: 9 a 14, 19 e 20; 6c: 15 a 18).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

vi.setConfig({ testTimeout: 120_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url))

type Linha = Record<string, unknown>

function lerSql(ensaioRel: string, trecho: string): string {
  // `E18P2_MG17_SQL`: caminho de uma cópia mutada de mg17.sql (prova de que os testes mordem); ausente = o ensaio de sempre.
  const ensaio = ensaioRel === 'mg17.sql' && process.env.E18P2_MG17_SQL ? process.env.E18P2_MG17_SQL : `${RAIZ}.superpowers/sdd/a5-e18p2/sql/${ensaioRel}`
  if (existsSync(ensaio)) return readFileSync(ensaio, 'utf8')
  const dir = `${RAIZ}supabase/migrations/`
  const achado = readdirSync(dir).find(f => f.includes(trecho))
  if (!achado) throw new Error(`nem o arquivo de ensaio nem a migration existem (${ensaioRel} / ${trecho})`)
  return readFileSync(dir + achado, 'utf8')
}

/** Do começo da marca `-- >>> <pref> <nome> (início)` ao fim da linha da marca `-- <<< <pref> <nome> (fim)`. */
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
const ULTIMO = '2026-03-09' // D0 + 19 = o dia gravado ("ontem no Pacífico" de AGORA)

describe.skipIf(skipIfNoLocalDb())('A5 E18 P2, MG17: a dieta dos metadados diários (bythiago_int)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const sites: string[] = []
  let S1 = ''
  let S2 = ''
  let SQL17A = ''
  let SQL17 = ''
  let LINHAS_DO_MEIO = ''
  let AUX = ''
  let COVER = ''
  let COVER_SQL = ''

  beforeAll(async () => {
    SQL17A = lerSql('mg17a.sql', 'observatorio_a5_e18p2_cobertura_de_metadados')
    SQL17 = lerSql('mg17.sql', 'observatorio_a5_e18p2_dieta_de_metadados')
    LINHAS_DO_MEIO = extrair(SQL17, 'MG17', 'yt_own_meta_linhas_do_meio')
    AUX = extrair(SQL17, 'MG17', 'auxiliares')
    COVER = extrair(SQL17, 'MG17', 'yt_own_meta_cover')
    COVER_SQL = COVER + '\n;'
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    S1 = (await seedSite(sb)).siteId; sites.push(S1)
    S2 = (await seedSite(sb)).siteId; sites.push(S2)
  })
  afterAll(async () => {
    try {
      if (pg && sites.length > 0) await pg.query('delete from public.sites where id = any($1::uuid[])', [sites])
    } finally {
      if (pg) await pg.end()
    }
  })

  // ───────────────────────── infraestrutura ─────────────────────────
  const q = async (sql: string, params: unknown[] = []): Promise<Linha[]> => (await pg.query(sql, params)).rows as Linha[]
  const n = async (sql: string, params: unknown[] = []): Promise<number> => Number(Object.values((await q(sql, params))[0]!)[0])

  /** Tudo dentro de uma transação desfeita. Por padrão aplica a MG17a e instala as funções da MG17 (critério e auxiliares). */
  async function tx(fn: () => Promise<void>, o: { aux?: boolean } = {}): Promise<void> {
    await pg.query('begin')
    try {
      await pg.query("set local lock_timeout = '5s'")
      await pg.query(SQL17A)
      await pg.query(LINHAS_DO_MEIO)
      if (o.aux !== false) await pg.query(AUX)
      await fn()
    } finally {
      await pg.query('rollback')
    }
  }
  async function tenta(sql: string, params: unknown[] = []): Promise<{ ok: true; rows: Linha[] } | { ok: false; msg: string }> {
    await pg.query('savepoint s_tenta')
    try {
      const r = await pg.query(sql, params)
      await pg.query('release savepoint s_tenta')
      return { ok: true, rows: r.rows as Linha[] }
    } catch (e) {
      await pg.query('rollback to savepoint s_tenta')
      return { ok: false, msg: e instanceof Error ? e.message : String(e) }
    }
  }
  async function recusa(sql: string, params: unknown[] = []): Promise<string> {
    const r = await tenta(sql, params)
    if (r.ok) throw new Error('esperava recusa e a chamada passou')
    return r.msg
  }

  interface Cena { site: string; canal: string; slug: string; v: Array<{ id: string; yt: string }> }
  async function cena(site: string, nVideos = 1): Promise<Cena> {
    const slug = 'teste-' + randomUUID().replace(/-/g, '').slice(0, 8)
    const c = await q(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`,
      [site, 'UC' + randomUUID().replace(/-/g, '').slice(0, 22), '@' + slug, 'UU' + randomUUID().replace(/-/g, '').slice(0, 22), slug])
    const canal = String(c[0]!.id)
    const v: Cena['v'] = []
    for (let i = 0; i < nVideos; i++) {
      const yt = 'y' + randomUUID().replace(/-/g, '').slice(0, 10)
      const r = await q(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at)
        values ($1, $2, $3, 'Teste', '2025-01-01T12:00:00Z') returning id`, [site, canal, yt])
      v.push({ id: String(r[0]!.id), yt })
    }
    return { site, canal, slug, v }
  }

  interface OpLinha {
    priv?: string | null; dhash?: string | null; title?: string; desc?: string | null; tags?: string[] | null
    ab?: string | null; sec?: number | null; tituloCap?: string | null
  }
  /** Linha de metadados do dia `d` (índice a partir de D0). `priv` e `dhash` nulos = a captura não aconteceu naquele dia. */
  async function meta(c: Cena, i: number, d: number, o: OpLinha = {}): Promise<void> {
    const priv = o.priv === undefined ? 'public' : o.priv
    const dhash = o.dhash === undefined ? `h${i}` : o.dhash
    const title = o.title ?? 'T'
    await pg.query(`insert into public.yt_own_video_meta_daily
      (youtube_video_id, day_pt, site_id, video_id, channel_id, title, title_at_capture, description_text, description_sha256, tags, privacy_status,
       thumbnail_dhash, ab_test_id, seconds_on_air_analytics, captured_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [c.v[i]!.yt, mais(D0, d), c.site, c.v[i]!.id, c.canal, title, o.tituloCap === undefined ? title : o.tituloCap,
        o.desc === undefined ? 'desc' : o.desc, o.desc === undefined ? 'dd' : o.desc === null ? null : 'x' + o.desc,
        o.tags ?? null, priv, dhash, o.ab ?? null, o.sec ?? null, mais(D0, d) + 'T15:00:00Z'])
  }
  async function estado(c: Cena, ate: string): Promise<void> {
    await pg.query(`insert into public.yt_own_versions_state (channel_id, site_id, tracking_since, derived_through) values ($1, $2, $3, $4)
      on conflict (channel_id) do update set derived_through = excluded.derived_through`, [c.canal, c.site, D0, ate])
  }
  async function cobrir(c: Cena, ate: string): Promise<void> {
    await pg.query('select public.yt_own_meta_cover($1::uuid, $2::uuid, $3::date, false)', [c.site, c.canal, ate])
  }
  async function meio(c: Cena, pDay = ULTIMO): Promise<Array<{ yt: string; dia: string; coberta: boolean; derivada: boolean }>> {
    const r = await q(`select youtube_video_id as yt, day_pt::text as dia, coberta, derivada from public.yt_own_meta_linhas_do_meio($1::uuid, $2::uuid, $3::date) order by 1, 2`,
      [c.site, c.canal, pDay])
    return r.map(x => ({ yt: String(x.yt), dia: String(x.dia), coberta: Boolean(x.coberta), derivada: Boolean(x.derivada) }))
  }
  const dias = (l: Array<{ yt: string; dia: string }>, c: Cena, i: number): number[] =>
    l.filter(x => x.yt === c.v[i]!.yt).map(x => Math.round((Date.parse(x.dia) - Date.parse(D0)) / 86_400_000))
  const faixa = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, k) => a + k)
  const linhasDe = (c: Cena): Promise<number> => n(`select count(*) from public.yt_own_video_meta_daily where channel_id = $1`, [c.canal])

  // ───── as 14 execuções limpas ─────
  type Json = Record<string, unknown>
  function resumoLimpo(canal: string): Json {
    return {
      metadados: {
        gravados: 5, pendentes: 0, tentativas: { ok: 2 }, dias_sem_meta: { [canal]: 0 },
        cobertura: { canais: 1, ok: 1, falhas: 0, sem_tempo: false, descobertas: 0, sem_explicacao: 0 },
      },
      versoes: { desligado: false, sem_tempo: false, atraso_dias: { [canal]: 0 }, recuperando: {}, atraso_desconhecido: [], dia_sem_resposta: [], confirmadas: 3, dias_derivados: 1 },
    }
  }
  const clone = (o: Json): Json => JSON.parse(JSON.stringify(o)) as Json
  /** Apaga a faixa que a função lê (yt_own_collection_runs não tem site) e põe 14 execuções, uma por dia, a última em AGORA (mesmo dia). */
  async function execucoes(canal: string, agora = AGORA, mudar: (k: number, r: Json) => Json = (_k, r) => r, hora = '12:30:00'): Promise<void> {
    await pg.query(`delete from public.yt_own_collection_runs where ran_at > $1::timestamptz - interval '20 days' and ran_at <= $1::timestamptz`, [agora])
    const dia0 = agora.slice(0, 10)
    for (let k = 0; k < 14; k++) {
      await run(mais(dia0, -k) + `T${hora}Z`, mudar(k, resumoLimpo(canal)))
    }
  }
  async function run(quando: string, resumo: Json, falhas: string[] = []): Promise<void> {
    await pg.query(`insert into public.yt_own_collection_runs (ran_at, ms_total, ms_existente, ms_passos, falhas, acao_do_dono, resumo)
      values ($1, 1000, 500, '{}'::jsonb, $2::text[], '{}'::text[], $3::jsonb)`, [quando, falhas, JSON.stringify(resumo)])
  }
  const marca = (dia: string): Promise<unknown> => pg.query(`comment on table public.yt_own_video_meta_daily is 'E18P2 armada em ${dia}'`)

  /** A semente do plano: 6 vídeos x 20 dias, cobertos, com estado de versões e 14 execuções boas. */
  async function semear(site: string): Promise<Cena> {
    const c = await cena(site, 6)
    for (let d = 0; d < 20; d++) {
      // v1: igual todos os dias (o dia 0 sem privacidade, como a linha de 07/10 de produção)
      await meta(c, 0, d, { priv: d === 0 ? null : 'public' })
      // v2: título A (1 a 7), B (8 a 11), A de novo (12 a 19)
      await meta(c, 1, d, { priv: d === 0 ? null : 'public', title: d >= 8 && d <= 11 ? 'B' : 'A' })
      // v3: duas capturas que falharam (dias 5 e 6)
      if (d === 5 || d === 6) await meta(c, 2, d, { priv: null, dhash: null, tituloCap: null })
      else await meta(c, 2, d, { priv: d === 0 ? null : 'public' })
      // v4: cinco dias de teste A/B (10 a 14), segundos diferentes a cada dia
      if (d >= 10 && d <= 14) await meta(c, 3, d, { ab: '00000000-0000-4000-8000-000000000001', sec: 100 + d })
      else await meta(c, 3, d, { priv: d === 0 ? null : 'public' })
      // v5: privado, sem thumbnail
      await meta(c, 4, d, { priv: d === 0 ? null : 'private', dhash: null })
      // v6: buraco de dois dias (9 e 10)
      if (d !== 9 && d !== 10) await meta(c, 5, d, { priv: d === 0 ? null : 'public' })
    }
    await cobrir(c, ULTIMO)
    await estado(c, ULTIMO)
    await execucoes(c.canal)
    await marca('2026-03-10')
    return c
  }
  /** As linhas do meio que a semente tem, escritas à mão (índice de dia a partir de D0). */
  const ESPERADO_SEMENTE: number[][] = [
    faixa(2, 17), // v1
    [...faixa(2, 6), 9, 10, ...faixa(13, 17)], // v2
    [2, 3, ...faixa(8, 17)], // v3
    [...faixa(2, 8), 16, 17], // v4
    faixa(2, 17), // v5
    [...faixa(2, 8), ...faixa(11, 17)], // v6
  ]

  async function dieta(site: string, agora = AGORA): Promise<Json> {
    const r = await tenta('select public.yt_own_meta_diet($1::uuid, $2::timestamptz) as r', [site, agora])
    if (!r.ok) throw new Error('yt_own_meta_diet recusou: ' + r.msg)
    return r.rows[0]!.r as Json
  }
  const dieta$ = (site: string, agora = AGORA): Promise<string> => recusa('select public.yt_own_meta_diet($1::uuid, $2::timestamptz)', [site, agora])

  // ═════════════════════════ 6a: o critério ═════════════════════════
  it('1. critério: só sai linha idêntica às duas vizinhas (a semente contra uma lista escrita à mão)', async () => {
    await tx(async () => {
      const c = await semear(S1)
      const l = await meio(c)
      ESPERADO_SEMENTE.forEach((esperado, i) => expect(dias(l, c, i), `vídeo ${i + 1}`).toEqual(esperado))
      expect(l).toHaveLength(79)
      // todas cobertas e derivadas na semente
      expect(l.every(x => x.coberta && x.derivada)).toBe(true)
    })
  })

  it('2. as duas linhas mais recentes de cada vídeo nunca saem (fronteira da regra 3: com p_day um dia menor, a antepenúltima também fica)', async () => {
    await tx(async () => {
      const c = await semear(S1)
      const a = await meio(c, ULTIMO)
      const b = await meio(c, mais(ULTIMO, -1))
      expect(dias(a, c, 0)).toContain(17)
      expect(dias(a, c, 0)).not.toContain(18)
      expect(dias(a, c, 0)).not.toContain(19)
      expect(dias(b, c, 0)).not.toContain(17)
      expect(dias(b, c, 0)).toEqual(faixa(2, 16))
    })
  })

  it('3. linha sem privacidade nunca sai, mesmo idêntica às vizinhas', async () => {
    await tx(async () => {
      const c = await cena(S1, 2)
      for (let d = 0; d < 10; d++) {
        await meta(c, 0, d, { priv: null, dhash: null, tituloCap: null })
        await meta(c, 1, d) // controle: com privacidade, as do meio saem
      }
      await cobrir(c, mais(D0, 9)); await estado(c, mais(D0, 9))
      const l = await meio(c, mais(D0, 9))
      expect(dias(l, c, 0)).toEqual([])
      expect(dias(l, c, 1)).toEqual(faixa(1, 7))
    })
  })

  it('4. linha de dia de teste A/B nunca sai: nem com segundos diferentes (C-1), nem com segundos iguais nos três dias (regra 8); a linha sem teste ao lado sai', async () => {
    await tx(async () => {
      const c = await cena(S1, 3)
      const AB = '00000000-0000-4000-8000-0000000000aa'
      for (let d = 0; d < 10; d++) {
        // v1: três dias de teste com os MESMOS segundos: o dia 4 é idêntico às duas vizinhas, só o teste o segura
        await meta(c, 0, d, d >= 3 && d <= 5 ? { ab: AB, sec: 500 } : {})
        // v2: segundos diferentes a cada dia
        await meta(c, 1, d, d >= 3 && d <= 5 ? { ab: AB, sec: 100 + d } : {})
        // v3: controle, nenhum dia de teste
        await meta(c, 2, d)
      }
      await cobrir(c, mais(D0, 9)); await estado(c, mais(D0, 9))
      const l = await meio(c, mais(D0, 9))
      expect(dias(l, c, 0)).not.toContain(4)
      expect(dias(l, c, 1)).not.toContain(4)
      for (const i of [0, 1]) for (const d of [3, 4, 5]) expect(dias(l, c, i)).not.toContain(d)
      expect(dias(l, c, 2)).toEqual(faixa(1, 7))
      // sem o teste, o dia 4 do v1 sairia (a mutação que o teste pega): confere pelo controle com a coluna zerada
      await pg.query(`update public.yt_own_video_meta_daily set ab_test_id = null where youtube_video_id = $1`, [c.v[0]!.yt])
      expect(dias(await meio(c, mais(D0, 9)), c, 0)).toContain(4)
    })
  })

  it('5. linha com description_text ou tags diferentes das vizinhas nunca sai', async () => {
    await tx(async () => {
      const c = await cena(S1, 2)
      for (let d = 0; d < 10; d++) {
        await meta(c, 0, d, { desc: d < 5 ? 'a' : 'b' })
        await meta(c, 1, d, { tags: d < 5 ? ['x'] : ['y'] })
      }
      await cobrir(c, mais(D0, 9)); await estado(c, mais(D0, 9))
      const l = await meio(c, mais(D0, 9))
      expect(dias(l, c, 0)).toEqual([1, 2, 3, 6, 7])
      expect(dias(l, c, 1)).toEqual([1, 2, 3, 6, 7])
    })
  })

  it('6. linha sem cobertura meta_texto volta com coberta falsa; com dHash e sem meta_thumb, idem', async () => {
    await tx(async () => {
      const c = await cena(S1, 2)
      for (let d = 0; d < 10; d++) { await meta(c, 0, d); await meta(c, 1, d) }
      const ate = mais(D0, 9)
      await cobrir(c, ate); await estado(c, ate)
      // v1: tira a cobertura meta_texto do dia 4 (parte o intervalo)
      await pg.query(`delete from public.yt_own_video_coverage where youtube_video_id = $1 and metric_set = 'meta_texto'`, [c.v[0]!.yt])
      await pg.query(`insert into public.yt_own_video_coverage (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id, source, collected_at)
        values ($1, 'meta_texto', $2, $3, $4, $5, $6, 'data_api', now()), ($1, 'meta_texto', $7, $8, $4, $5, $6, 'data_api', now())`,
        [c.v[0]!.yt, D0, mais(D0, 3), c.site, c.v[0]!.id, c.canal, mais(D0, 5), ate])
      // v2: tira a cobertura meta_thumb do dia 6
      await pg.query(`delete from public.yt_own_video_coverage where youtube_video_id = $1 and metric_set = 'meta_thumb'`, [c.v[1]!.yt])
      await pg.query(`insert into public.yt_own_video_coverage (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id, source, collected_at)
        values ($1, 'meta_thumb', $2, $3, $4, $5, $6, 'imagem', now()), ($1, 'meta_thumb', $7, $8, $4, $5, $6, 'imagem', now())`,
        [c.v[1]!.yt, D0, mais(D0, 5), c.site, c.v[1]!.id, c.canal, mais(D0, 7), ate])
      const l = await meio(c, ate)
      const sem = (i: number): number[] => l.filter(x => x.yt === c.v[i]!.yt && !x.coberta).map(x => Math.round((Date.parse(x.dia) - Date.parse(D0)) / 86_400_000))
      expect(sem(0)).toEqual([4])
      expect(sem(1)).toEqual([6])
      // a linha sem dHash só precisa do meta_texto: sem dhash e sem meta_thumb, coberta continua verdadeira
      await pg.query(`update public.yt_own_video_meta_daily set thumbnail_dhash = null where youtube_video_id = $1`, [c.v[1]!.yt])
      expect((await meio(c, ate)).filter(x => x.yt === c.v[1]!.yt && !x.coberta)).toEqual([])
    })
  })

  it('7. linha além de derived_through volta com derivada falsa; canal sem estado: todas com derivada falsa', async () => {
    await tx(async () => {
      const c = await cena(S1)
      for (let d = 0; d < 10; d++) await meta(c, 0, d)
      const ate = mais(D0, 9)
      await cobrir(c, ate)
      expect((await meio(c, ate)).every(x => !x.derivada)).toBe(true) // sem estado
      expect((await meio(c, ate)).length).toBeGreaterThan(0)
      await estado(c, mais(D0, 4))
      const l = await meio(c, ate)
      expect(l.filter(x => x.derivada).map(x => x.dia)).toEqual(faixa(1, 4).map(k => mais(D0, k)))
      expect(l.filter(x => !x.derivada).map(x => x.dia)).toEqual(faixa(5, 7).map(k => mais(D0, k)))
    })
  })

  it('8. mutação de site e de canal: linhas do mesmo vídeo em outro site no meio da sequência; dois canais no mesmo site', async () => {
    await tx(async () => {
      const a = await cena(S1, 2)
      const ate = mais(D0, 9)
      // o mesmo youtube_video_id nos dois sites, em dias alternados e com conteúdo diferente
      const b = await cena(S2, 0)
      for (let d = 0; d < 10; d += 2) await meta(a, 0, d)
      for (let d = 1; d < 10; d += 2) {
        await pg.query(`insert into public.yt_own_video_meta_daily (youtube_video_id, day_pt, site_id, channel_id, title, privacy_status, captured_at)
          values ($1, $2, $3, $4, 'OUTRO', 'public', $5)`, [a.v[0]!.yt, mais(D0, d), b.site, b.canal, mais(D0, d) + 'T15:00:00Z'])
      }
      // dois canais no mesmo site: o segundo canal tem linhas idênticas e não pode aparecer no resultado do primeiro
      const a2 = await cena(S1, 1)
      for (let d = 0; d < 10; d++) { await meta(a, 1, d); await meta(a2, 0, d) }
      await cobrir(a, ate); await cobrir(a2, ate)
      await estado(a, ate); await estado(a2, ate)
      const l = await meio(a, ate)
      // no site A, o vídeo 1 só tem linhas nos dias pares (as vizinhas de outro site não contam): 2, 4, 6 saem
      expect(dias(l, a, 0)).toEqual([2, 4, 6])
      // o canal a2 não aparece no resultado do canal a
      expect(l.some(x => x.yt === a2.v[0]!.yt)).toBe(false)
      expect(dias(l, a, 1)).toEqual(faixa(1, 7))
    })
  })

  it('8b. linha que é first_day_pt de versão fora do pré-registro, ou last_day_pt de versão não corrente, não sai; pré-registro e última de versão corrente não seguram; outro site não segura', async () => {
    await tx(async () => {
      const c = await cena(S1, 3)
      const ate = mais(D0, 9)
      for (let d = 0; d < 10; d++) for (let i = 0; i < 3; i++) await meta(c, i, d)
      await cobrir(c, ate); await estado(c, ate)
      const versao = async (site: string, canal: string, i: number, o: { first: number; last: number; corrente: boolean; pre?: boolean }, yt = c.v[i]!.yt): Promise<void> => {
        await pg.query(`insert into public.yt_own_video_versions
          (youtube_video_id, site_id, channel_id, field, value_text, value_hash, first_day_pt, last_day_pt, first_seen_at, last_seen_at,
           window_precision, window_start, window_end, origin, ab_event, pre_registro, is_current)
          values ($1, $2, $3, 'title', 'T', $4, $5, $6, $7, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [yt, site, canal, 'a'.repeat(16) + String(i), mais(D0, o.first), mais(D0, o.last), mais(D0, o.last) + 'T15:00:00Z',
            o.pre ? 'min' : '1d', mais(D0, o.first) + 'T00:00:00Z', mais(D0, o.first) + 'T10:00:00Z',
            o.pre ? 'ab_lab' : 'nao_se_sabe', o.pre ? 'rotacao' : null, Boolean(o.pre), o.corrente])
      }
      // v1: versão fora do pré-registro que ABRE no dia 4; outra, não corrente, que TERMINA no dia 6
      await versao(c.site, c.canal, 0, { first: 4, last: 5, corrente: false })
      await versao(c.site, c.canal, 0, { first: 6, last: 6, corrente: true })
      // v2: pré-registro no dia 4 e versão corrente cujo last_day_pt é o dia 6: não seguram
      await versao(c.site, c.canal, 1, { first: 4, last: 4, corrente: false, pre: true })
      // v3: versão corrente com last_day_pt no dia 5 (não segura), e a mesma versão de v1 em OUTRO site (mutação de site: não segura)
      await versao(c.site, c.canal, 2, { first: 0, last: 5, corrente: true })
      const b = await cena(S2, 0)
      await versao(S2, b.canal, 2, { first: 4, last: 5, corrente: false }, c.v[2]!.yt)
      const l = await meio(c, ate)
      expect(dias(l, c, 0)).not.toContain(4) // first_day_pt de versão
      expect(dias(l, c, 0)).not.toContain(5) // last_day_pt de versão não corrente
      expect(dias(l, c, 0)).not.toContain(6) // first_day_pt da corrente
      expect(dias(l, c, 1)).toContain(4) // pré-registro não segura
      expect(dias(l, c, 2)).toEqual(faixa(1, 7)) // nada seguro (versão de outro site não conta)
    })
  })

  // ═════════════════════════ 6b: as guardas e as contas ═════════════════════════
  it('9. yt_own_meta_diet apaga, e as oito igualdades fecham (o objeto devolvido, campo a campo; sem_explicacao 0 depois)', async () => {
    await tx(async () => {
      const c = await semear(S1)
      const antes = await linhasDe(c)
      expect(antes).toBe(118)
      const r = await dieta(S1) as { estado: string; apagadas: number; antes: Json; depois: Json }
      expect(r.estado).toBe('apagado')
      expect(r.apagadas).toBe(79)
      expect(await linhasDe(c)).toBe(39)
      expect(r.antes).toMatchObject({ t: 118, videos: 6, do_meio: 79, candidatas: 79, descobertas: 0, sem_explicacao: 0, versoes_sem_linha: 0 })
      expect(r.depois).toMatchObject({ t: 39, videos: 6, do_meio: 0, descobertas: 0, sem_explicacao: 0, versoes_sem_linha: 0 })
      for (const k of ['videos', 'sequencias', 'retrato_sequencias', 'retrato_situacao', 'sem_privacidade', 'c_texto', 'c_thumb']) {
        expect(r.depois[k], k).toEqual(r.antes[k])
      }
      expect(Number(r.depois.com_texto)).toBe(Number(r.antes.com_texto) - 79)
      expect(Number(r.depois.com_thumb)).toBe(Number(r.antes.com_thumb) - Number(r.antes.candidatas_com_dhash))
      // a prova diária, pela função da MG17a
      const p = (await q(`select public.yt_own_meta_prova($1::uuid, $2::uuid, $3::date) as p`, [c.site, c.canal, ULTIMO]))[0]!.p as Json
      expect(p).toMatchObject({ linhas: 39, descobertas: 0, sem_explicacao: 0 })
    })
  })

  it('10. dado ausente: site sem linhas, site sem linha do meio com e sem o corpo novo, e o bloco do inteiro não deixa o corpo trocado na recusa', async () => {
    await tx(async () => {
      // (a) site sem nenhuma linha: nada_a_apagar com motivo sem_linhas, sem exigir marca, hora nem execuções
      await pg.query(`delete from public.yt_own_collection_runs where ran_at > $1::timestamptz - interval '20 days' and ran_at <= $1::timestamptz`, [AGORA])
      const r = await dieta(S2, '2026-03-10T12:00:00Z') // até dentro da janela do cron
      expect(r).toMatchObject({ estado: 'nada_a_apagar', motivo: 'sem_linhas', guardas: false, apagadas: 0, linhas: 0 })
    })
    await tx(async () => {
      // (b) site com linhas, sem linha do meio e com o corpo da MG17a: sem a marca RECUSA e o corpo continua o da MG17a
      const c = await cena(S1, 1)
      await meta(c, 0, 0, { priv: null }); await meta(c, 0, 1); await meta(c, 0, 2, { title: 'Z' })
      for (let d = 3; d < 20; d++) await meta(c, 0, d, { title: `Z${d}` })
      await cobrir(c, ULTIMO); await estado(c, ULTIMO); await execucoes(c.canal)
      expect((await meio(c)).length).toBe(0)
      await pg.query(`comment on table public.yt_own_video_meta_daily is null`)
      const msg = await dieta$(S1)
      expect(msg).toContain('ritual do CSV')
      expect(await n(`select count(*) from pg_proc where proname = 'yt_own_meta_cover' and prosrc like '%yt_own_meta_linhas_do_meio%'`)).toBe(0)
      // com a marca, a hora e as 14 execuções: nada_a_apagar com guardas verdadeiras
      await marca('2026-03-10')
      const r = await dieta(S1)
      expect(r).toMatchObject({ estado: 'nada_a_apagar', motivo: 'sem_linha_do_meio', guardas: true, apagadas: 0 })
    })
    await tx(async () => {
      // (c) o mesmo site com o corpo novo já instalado: ja_ligada, sem exigir nada
      const c = await cena(S1, 1)
      for (let d = 0; d < 20; d++) await meta(c, 0, d, { title: `Z${d}` })
      await cobrir(c, ULTIMO); await estado(c, ULTIMO)
      await pg.query(COVER_SQL)
      await pg.query(`delete from public.yt_own_collection_runs where ran_at > $1::timestamptz - interval '20 days' and ran_at <= $1::timestamptz`, [AGORA])
      await pg.query(`comment on table public.yt_own_video_meta_daily is null`)
      const r = await dieta(S1, '2026-03-10T12:00:00Z')
      expect(r).toMatchObject({ estado: 'nada_a_apagar', motivo: 'ja_ligada', guardas: false, apagadas: 0 })
    })
    // (d) o arquivo inteiro numa tabela com linhas e sem a marca: recusa, e o corpo antigo (da MG17a) fica
    await pg.query('begin')
    try {
      await pg.query("set local lock_timeout = '5s'")
      await pg.query(SQL17A)
      const c = await cena(S1, 1)
      for (let d = 0; d < 20; d++) await meta(c, 0, d, { title: 'Z' })
      await cobrir(c, ULTIMO); await estado(c, ULTIMO)
      await pg.query(`comment on table public.yt_own_video_meta_daily is null`)
      const msg = await recusa(SQL17)
      expect(msg).toMatch(/MG17 recusada/)
      expect(await n(`select count(*) from pg_proc where proname = 'yt_own_meta_cover' and prosrc like '%yt_own_meta_linhas_do_meio%'`)).toBe(0)
    } finally {
      await pg.query('rollback')
    }
  })

  describe('11. recusas, uma por teste, cada uma com a mensagem e a contagem intacta', () => {
    const recusaCom = async (agora: string, trecho: RegExp | string, ajuste?: (c: Cena) => Promise<void>, dia = agora.slice(0, 10)): Promise<void> => {
      await tx(async () => {
        const c = await semear(S1)
        await marca(dia)
        if (ajuste) await ajuste(c)
        const antes = await linhasDe(c)
        const msg = await dieta$(S1, agora)
        expect(msg).toMatch(trecho)
        expect(await linhasDe(c)).toBe(antes)
      })
    }
    it('janela do cron: 11:30 e 12:59 recusam; 11:29 e 13:00 passam', async () => {
      await recusaCom('2026-03-10T11:30:00Z', /entre 11:30 e 13:00 UTC/)
      await recusaCom('2026-03-10T12:59:00Z', /entre 11:30 e 13:00 UTC/)
      for (const h of ['11:29:00', '13:00:00']) {
        await tx(async () => {
          const c = await semear(S1)
          const agora = `2026-03-10T${h}Z`
          await execucoes(c.canal, agora, undefined, h === '11:29:00' ? '06:00:00' : '12:30:00')
          const r = await dieta(S1, agora)
          expect(r.estado, h).toBe('apagado')
        })
      }
    })
    it('sem a marca', async () => { await recusaCom(AGORA, /ritual do CSV não foi feito hoje/, async () => { await pg.query('comment on table public.yt_own_video_meta_daily is null') }) })
    it('marca de ontem', async () => { await recusaCom(AGORA, /ritual do CSV não foi feito hoje/, async () => { await marca('2026-03-09') }, '2026-03-09') })
    it('última linha com 3 dias', async () => {
      await tx(async () => {
        const c = await semear(S1)
        const agora = '2026-03-13T15:00:00Z'
        await marca('2026-03-13'); await execucoes(c.canal, agora)
        const antes = await linhasDe(c)
        expect(await dieta$(S1, agora)).toMatch(/a última linha de metadados do site é de 2026-03-09/)
        expect(await linhasDe(c)).toBe(antes)
      })
    })
    it('13 dias de execução', async () => {
      await recusaCom(AGORA, /preciso de 14 dias limpos seguidos/, async () => {
        await pg.query(`delete from public.yt_own_collection_runs where ran_at = $1::timestamptz`, ['2026-02-25T12:30:00Z'])
      })
    })
    it('14 dias com um buraco', async () => {
      await recusaCom(AGORA, /preciso de 14 dias limpos seguidos/, async () => {
        await pg.query(`delete from public.yt_own_collection_runs where ran_at = $1::timestamptz`, ['2026-03-01T12:30:00Z'])
        await run('2026-02-24T12:30:00Z', resumoLimpo('x'))
      })
    })
    it('última execução há 25 horas recusa; há 23 horas passa', async () => {
      await tx(async () => {
        const c = await semear(S1)
        const agora = '2026-03-11T13:30:00Z'
        await marca('2026-03-11')
        const antes = await linhasDe(c)
        expect(await dieta$(S1, agora)).toMatch(/última execução há menos de 24 horas/)
        expect(await linhasDe(c)).toBe(antes)
      })
      await tx(async () => {
        const c = await semear(S1)
        const agora = '2026-03-11T11:29:00Z'
        await marca('2026-03-11')
        expect((await dieta(S1, agora)).estado).toBe('apagado')
        expect(await linhasDe(c)).toBe(39)
      })
    })
  })

  describe('12. execução não limpa: cada teste troca UMA das 14', () => {
    const DIA_SUJO = '2026-03-05' // k = 5
    const mutar = (nome: string, f: (r: Json, canal: string) => void, falhas?: string[]): void => {
      it(nome, async () => {
        await tx(async () => {
          const c = await semear(S1)
          await execucoes(c.canal, AGORA, (k, r) => {
            if (k === 5) f(r, c.canal)
            return r
          })
          // as falhas vão na coluna própria: reinsere a execução de k = 5 com elas
          const f5 = falhas ?? []
          await pg.query(`update public.yt_own_collection_runs set falhas = $2::text[] where ran_at = $1::timestamptz`, [`${DIA_SUJO}T12:30:00Z`, f5])
          const antes = await linhasDe(c)
          const msg = await dieta$(S1)
          expect(msg).toMatch(/preciso de 14 dias limpos seguidos/)
          expect(msg).toContain(DIA_SUJO)
          expect(await linhasDe(c)).toBe(antes)
        })
      })
    }
    const meta_ = (r: Json): Json => r.metadados as Json
    const cob = (r: Json): Json => meta_(r).cobertura as Json
    const ver = (r: Json): Json => r.versoes as Json
    mutar('sem a chave metadados', r => { delete r.metadados })
    mutar('sem cobertura', r => { delete meta_(r).cobertura })
    mutar('cobertura.canais 0', r => { cob(r).canais = 0; cob(r).ok = 0 })
    mutar('cobertura.ok menor que canais', r => { cob(r).ok = 0 })
    mutar('cobertura.descobertas 1', r => { cob(r).descobertas = 1 })
    mutar('cobertura.sem_tempo verdadeiro', r => { cob(r).sem_tempo = true })
    mutar('tentativas sem ok', r => { meta_(r).tentativas = {} })
    mutar('tentativas.sem_autorizacao 1', r => { meta_(r).tentativas = { ok: 2, sem_autorizacao: 1 } })
    mutar('pendentes 1', r => { meta_(r).pendentes = 1 })
    mutar('dias_sem_meta com um canal em 2', (r, canal) => { meta_(r).dias_sem_meta = { [canal]: 2 } })
    mutar('dias_sem_meta vazio', r => { meta_(r).dias_sem_meta = {} })
    mutar('sem a chave versoes', r => { delete r.versoes })
    mutar('versoes.desligado verdadeiro', r => { ver(r).desligado = true })
    mutar('versoes.recuperando não vazio', (r, canal) => { ver(r).recuperando = { [canal]: 3 } })
    mutar('versoes.atraso_dias com 1', (r, canal) => { ver(r).atraso_dias = { [canal]: 1 } })
    mutar('versoes.confirmadas 0 com dias_derivados 2', r => { ver(r).confirmadas = 0; ver(r).dias_derivados = 2 })
    mutar('nota metadados', () => undefined, ['metadados: Canal sem linha'])
    mutar('nota versões', () => undefined, ['versões: Canal sem nenhuma linha diária em 2026-03-01'])
    mutar('nota schema_ausente: yt_own_versions_state', () => undefined, ['schema_ausente: yt_own_versions_state'])

    it('nota de outro passo (relatórios: …) não suja o dia', async () => {
      await tx(async () => {
        const c = await semear(S1)
        await pg.query(`update public.yt_own_collection_runs set falhas = array['relatórios: lento'] where ran_at = $1::timestamptz`, [`${DIA_SUJO}T12:30:00Z`])
        expect((await dieta(S1)).estado).toBe('apagado')
        expect(await linhasDe(c)).toBe(39)
      })
    })

    describe('dia com mais de uma execução (D-I-3, S-I-2)', () => {
      const reexecucao = (canal: string): Json => {
        const r = resumoLimpo(canal)
        ;(r.versoes as Json).confirmadas = 0
        ;(r.versoes as Json).dias_derivados = 0
        return r
      }
      it('execução limpa seguida de reexecução sem dia novo e sem nota: dia limpo', async () => {
        await tx(async () => {
          const c = await semear(S1)
          await run(`${DIA_SUJO}T18:00:00Z`, reexecucao(c.canal))
          expect((await dieta(S1)).estado).toBe('apagado')
        })
      })
      it('execução limpa seguida de reexecução com nota de metadados: dia sujo', async () => {
        await tx(async () => {
          const c = await semear(S1)
          await run(`${DIA_SUJO}T18:00:00Z`, reexecucao(c.canal), ['metadados: x'])
          const msg = await dieta$(S1)
          expect(msg).toContain(DIA_SUJO)
        })
      })
      it('reexecução com nota ANTES da execução limpa, no mesmo dia: dia sujo', async () => {
        await tx(async () => {
          const c = await semear(S1)
          await run(`${DIA_SUJO}T08:00:00Z`, reexecucao(c.canal), ['metadados: x'])
          expect(await dieta$(S1)).toContain(DIA_SUJO)
        })
      })
      it('dia que só tem a reexecução sem dia novo: não é limpo', async () => {
        await tx(async () => {
          const c = await semear(S1)
          await pg.query(`delete from public.yt_own_collection_runs where ran_at = $1::timestamptz`, [`${DIA_SUJO}T12:30:00Z`])
          await run(`${DIA_SUJO}T18:00:00Z`, reexecucao(c.canal))
          expect(await dieta$(S1)).toContain(DIA_SUJO)
        })
      })
    })

    it('a mensagem de recusa traz as datas dos dias não limpos (dois dias)', async () => {
      await tx(async () => {
        const c = await semear(S1)
        await execucoes(c.canal, AGORA, (k, r) => { if (k === 2 || k === 9) (r.metadados as Json).pendentes = 1; return r })
        const msg = await dieta$(S1)
        expect(msg).toContain('2026-03-01, 2026-03-08')
      })
    })
  })

  it('13. estado desconhecido: dia coberto sem explicação, canal sem estado de versões, versão cujo first_day_pt não tem linha: recusa e nada sai', async () => {
    // (o caso "linha do meio sem cobertura" não existe aqui: o passo (0) da função cobre antes de qualquer conta; ver o relatório)
    await tx(async () => {
      const c = await semear(S1)
      // o v6 deixa de ter vizinhas idênticas em volta do buraco (dia 11 muda), e o dia 9 passa a ser coberto sem linha e sem explicação
      await pg.query(`update public.yt_own_video_meta_daily set title = 'Q', title_at_capture = 'Q' where youtube_video_id = $1 and day_pt = $2`, [c.v[5]!.yt, mais(D0, 11)])
      // cobertura à mão para o buraco do v6 (dia 9): dia coberto sem linha, fora de duas linhas idênticas
      await pg.query(`insert into public.yt_own_video_coverage (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id, source, collected_at)
        values ($1, 'meta_texto', $2, $2, $3, $4, $5, 'data_api', now())`, [c.v[5]!.yt, mais(D0, 9), c.site, c.v[5]!.id, c.canal])
      const antes = await linhasDe(c)
      expect(await dieta$(S1)).toMatch(/dias cobertos sem explicação: [1-9]/)
      expect(await linhasDe(c)).toBe(antes)
    })
    await tx(async () => {
      const c = await semear(S1)
      await pg.query(`delete from public.yt_own_versions_state where channel_id = $1`, [c.canal])
      const antes = await linhasDe(c)
      expect(await dieta$(S1)).toMatch(/linhas do meio que o passo de versões ainda não derivou: [1-9]/)
      expect(await linhasDe(c)).toBe(antes)
    })
    await tx(async () => {
      const c = await semear(S1)
      // versão aberta num dia em que o vídeo não tem linha (o buraco do v6, dia 9)
      await pg.query(`insert into public.yt_own_video_versions
        (youtube_video_id, site_id, channel_id, field, value_text, value_hash, first_day_pt, last_day_pt, first_seen_at, last_seen_at, window_precision, window_start, window_end, origin, is_current)
        values ($1, $2, $3, 'title', 'T', $4, $5, $5, now(), now(), '1d', now(), now(), 'nao_se_sabe', true)`,
        [c.v[5]!.yt, c.site, c.canal, 'c'.repeat(16), mais(D0, 9)])
      const antes = await linhasDe(c)
      expect(await dieta$(S1)).toMatch(/versões sem a sua linha: [1-9]/)
      expect(await linhasDe(c)).toBe(antes)
    })
  })

  it('14. as contas não fecham: um gatilho que insere uma linha durante o delete faz a função lançar MG17 desfeita, e a contagem volta', async () => {
    await tx(async () => {
      const c = await semear(S1)
      await pg.query(`create function public.zz_n9_gatilho() returns trigger language plpgsql as $$
        begin
          insert into public.yt_own_video_meta_daily (youtube_video_id, day_pt, site_id, channel_id, privacy_status, captured_at)
          values ('zzzzzzzzzzz', '2026-03-09', '${c.site}', '${c.canal}', 'public', now()) on conflict do nothing;
          return null;
        end $$`)
      await pg.query(`create trigger zz_n9_gatilho after delete on public.yt_own_video_meta_daily for each statement execute function public.zz_n9_gatilho()`)
      const antes = await linhasDe(c)
      const msg = await dieta$(S1)
      expect(msg).toMatch(/MG17 desfeita: as contas não fecham/)
      expect(await linhasDe(c)).toBe(antes)
    })
  })

  // ═════════════════════════ 6c: os leitores e o corpo novo ═════════════════════════
  it('15. depois da troca de corpo, p_compactar verdadeiro enxuga um dia; falso não; sem estado devolve sem_estado e não apaga', async () => {
    await tx(async () => {
      const c = await cena(S1, 1)
      for (let d = 0; d < 20; d++) await meta(c, 0, d, { priv: d === 0 ? null : 'public' })
      await cobrir(c, ULTIMO); await estado(c, ULTIMO)
      await pg.query(COVER_SQL)
      const chama = async (compactar: boolean, dia = ULTIMO): Promise<Json> =>
        (await q(`select public.yt_own_meta_cover($1::uuid, $2::uuid, $3::date, $4::boolean) as r`, [c.site, c.canal, dia, compactar]))[0]!.r as Json
      // falso: não apaga
      expect(await chama(false)).toMatchObject({ compactacao: 'desligada', compactadas: 0 })
      expect(await linhasDe(c)).toBe(20)
      // sem estado: não apaga
      await pg.query(`delete from public.yt_own_versions_state where channel_id = $1`, [c.canal])
      expect(await chama(true)).toMatchObject({ compactacao: 'sem_estado', compactadas: 0 })
      expect(await linhasDe(c)).toBe(20)
      // verdadeiro, com estado: enxuga o acumulado (dias 2 a 17)
      await estado(c, ULTIMO)
      expect(await chama(true)).toMatchObject({ compactacao: 'feita', compactadas: 16, descobertas: 0, sem_explicacao: 0 })
      expect(await linhasDe(c)).toBe(4)
      // dois dias novos: o que o dia 21 libera (18 e 19, que eram "passado" só agora) sai
      await meta(c, 0, 20); await meta(c, 0, 21)
      await cobrir(c, mais(D0, 21)); await estado(c, mais(D0, 21))
      expect(await chama(true, mais(D0, 21))).toMatchObject({ compactacao: 'feita', compactadas: 2, sem_explicacao: 0 })
      expect(await linhasDe(c)).toBe(4)
    })
  })

  it('16. segunda execução do dia não desfaz: reescrever a linha do dia depois de compactar mantém sem_explicacao em 0', async () => {
    await tx(async () => {
      const c = await cena(S1, 1)
      for (let d = 0; d < 20; d++) await meta(c, 0, d, { priv: d === 0 ? null : 'public' })
      await cobrir(c, ULTIMO); await estado(c, ULTIMO)
      await pg.query(COVER_SQL)
      await q(`select public.yt_own_meta_cover($1::uuid, $2::uuid, $3::date, true)`, [c.site, c.canal, ULTIMO])
      // a "segunda execução do dia" completa a linha do dia com outro título
      await pg.query(`update public.yt_own_video_meta_daily set title = 'OUTRO', title_at_capture = 'OUTRO' where youtube_video_id = $1 and day_pt = $2`, [c.v[0]!.yt, ULTIMO])
      const r = (await q(`select public.yt_own_meta_cover($1::uuid, $2::uuid, $3::date, true) as r`, [c.site, c.canal, ULTIMO]))[0]!.r as Json
      expect(r).toMatchObject({ compactacao: 'feita', compactadas: 0, sem_explicacao: 0, descobertas: 0 })
      // o dia anterior (18) continua guardado: era a vizinha de depois do dia 17 e é "passado"
      expect(await n(`select count(*) from public.yt_own_video_meta_daily where youtube_video_id = $1 and day_pt = $2`, [c.v[0]!.yt, mais(D0, 18)])).toBe(1)
    })
  })

  it('17. os leitores respondem o mesmo antes e depois da dieta (seis leituras sobre a semente)', async () => {
    await tx(async () => {
      const c = await semear(S1)
      await pg.query(COVER_SQL)
      const leituras = async (): Promise<Record<string, string>> => {
        const o: Record<string, string> = {}
        // (1) criteria.ts: linhas do dia, por canal
        o.linhas_do_dia = String(await n(`select count(*) from public.yt_own_video_meta_daily where channel_id = $1 and day_pt = $2`, [c.canal, ULTIMO]))
        // (2) meta-step.ts: o max(day_pt) anterior ao dia, por canal (dias_sem_meta)
        o.max_anterior = String((await q(`select max(day_pt)::text as d from public.yt_own_video_meta_daily where channel_id = $1 and day_pt < $2`, [c.canal, ULTIMO]))[0]!.d)
        // (3) meta-step.ts:292: a linha anterior de cada vídeo (as sete colunas)
        o.linha_anterior = JSON.stringify(await q(`select distinct on (youtube_video_id) youtube_video_id, day_pt::text, description_sha256, tags_sha256, thumbnail_dhash, thumbnail_blob_url, is_short, duration_seconds
          from public.yt_own_video_meta_daily where channel_id = $1 and day_pt < $2 order by youtube_video_id, day_pt desc`, [c.canal, ULTIMO]))
        // (4) criteria-cobertura.ts: a privacidade do dia mais recente de cada vídeo
        o.privacidade = JSON.stringify(await q(`select distinct on (youtube_video_id) youtube_video_id, privacy_status from public.yt_own_video_meta_daily where channel_id = $1 order by youtube_video_id, day_pt desc`, [c.canal]))
        // (5) gravar.ts: as linhas com privacidade dos últimos 3 dias, reduzidas à mais recente por vídeo
        o.tres_dias = JSON.stringify(await q(`select distinct on (youtube_video_id) youtube_video_id, day_pt::text, privacy_status from public.yt_own_video_meta_daily
          where privacy_status is not null and day_pt >= $2::date - 3 and channel_id = $1 order by youtube_video_id, day_pt desc`, [c.canal, ULTIMO]))
        // (6) competitor_hourly_health em três instantes
        for (const [nome, inst] of [['saude_antes', '2026-03-10T11:30:00Z'], ['saude_depois', '2026-03-10T13:30:00Z'], ['saude_30h', '2026-03-11T19:00:00Z']]) {
          o[nome!] = JSON.stringify((await q(`select public.competitor_hourly_health($1::uuid, $2::timestamptz, 14, 25) as h`, [c.site, inst]))[0]!.h)
        }
        return o
      }
      const antes = await leituras()
      expect((await q(`select public.yt_own_meta_cover($1::uuid, $2::uuid, $3::date, true) as r`, [c.site, c.canal, ULTIMO]))[0]!.r).toMatchObject({ compactacao: 'feita' })
      expect(await linhasDe(c)).toBeLessThan(118)
      const depois = await leituras()
      expect(depois).toEqual(antes)
      expect(antes.linhas_do_dia).toBe('6') // os seis vídeos têm linha no último dia
    })
  })

  it('18. youtube_channel_removal_impact continua maior que zero e a remoção do canal continua recusada pela chave estrangeira', async () => {
    await tx(async () => {
      const c = await semear(S1)
      await pg.query(COVER_SQL)
      const impacto = async (): Promise<number> => {
        const r = (await q(`select public.youtube_channel_removal_impact($1::uuid, $2::uuid) as r`, [c.site, c.canal]))[0]!.r as Json
        expect(r.status).toBe('ok')
        return Number(Object.entries(r).filter(([k]) => ['videos', 'comments'].indexOf(k) < 0 && typeof r[k] === 'number').reduce((s, [, v]) => s + Number(v), 0))
      }
      expect(await impacto()).toBeGreaterThan(0)
      expect(await recusa(`delete from public.youtube_channels where id = $1`, [c.canal])).toMatch(/violates foreign key|restrict/i)
      await q(`select public.yt_own_meta_cover($1::uuid, $2::uuid, $3::date, true)`, [c.site, c.canal, ULTIMO])
      expect(await impacto()).toBeGreaterThan(0)
      expect(await recusa(`delete from public.youtube_channels where id = $1`, [c.canal])).toMatch(/violates foreign key|restrict/i)
    })
  })

  it('19. privilégios por catálogo da função nova; as duas auxiliares não existem depois do arquivo inteiro (tabela vazia)', async () => {
    await pg.query('begin')
    try {
      await pg.query("set local lock_timeout = '5s'")
      await pg.query(SQL17A)
      await pg.query('delete from public.yt_own_video_meta_daily') // desfeito no rollback: o arquivo inteiro com a tabela vazia
      await pg.query(SQL17)
      expect(await n(`select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname in ('yt_own_meta_diet', 'yt_own_meta_diet_contas')`)).toBe(0)
      const priv = await q(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as auth,
        has_function_privilege('service_role', p.oid, 'execute') as srv, p.prosrc like '%yt_own_meta_linhas_do_meio%' as novo
        from pg_proc p join pg_namespace s on s.oid = p.pronamespace
        where s.nspname = 'public' and p.proname in ('yt_own_meta_cover_set', 'yt_own_meta_prova', 'yt_own_meta_cover', 'yt_own_meta_linhas_do_meio') order by 1`)
      expect(priv.map(x => x.proname)).toEqual(['yt_own_meta_cover', 'yt_own_meta_cover_set', 'yt_own_meta_linhas_do_meio', 'yt_own_meta_prova'])
      for (const x of priv) { expect(x.anon, String(x.proname)).toBe(false); expect(x.auth, String(x.proname)).toBe(false); expect(x.srv, String(x.proname)).toBe(true) }
      expect(priv.find(x => x.proname === 'yt_own_meta_cover')!.novo).toBe(true) // o corpo novo foi instalado
      // rodado de novo, sem erro (idempotente)
      await pg.query(SQL17)
    } finally {
      await pg.query('rollback')
    }
  })

  it('20. a consulta AD do plano dá os mesmos números que yt_own_meta_diet_contas (campos em comum, antes e depois); cp14.sql traz a expressão "limpa" letra por letra', async () => {
    // A consulta AD (seção 11 do plano), copiada para o ensaio fora do git (como mg17.sql e cp14.sql).
    const AD = readFileSync(`${RAIZ}.superpowers/sdd/a5-e18p2/sql/ad.sql`, 'utf8')
    await tx(async () => {
      const c = await semear(S1)
      await pg.query(COVER_SQL)
      const comuns = ['t', 'videos', 'com_texto', 'com_thumb', 'sem_privacidade', 'c_texto', 'c_thumb', 'sequencias', 'retrato_sequencias', 'retrato_situacao']
      const confere = async (): Promise<void> => {
        const ad = (await q(AD.replace(/:site/g, `'${c.site}'::uuid`)))[0]!
        const fn = (await q(`select public.yt_own_meta_diet_contas($1::uuid) as r`, [c.site]))[0]!.r as Json
        for (const k of comuns) expect(String(ad[k]), k).toBe(String(fn[k]))
      }
      await confere()
      await q(`select public.yt_own_meta_cover($1::uuid, $2::uuid, $3::date, true)`, [c.site, c.canal, ULTIMO])
      await confere()
    })
    // cp14.sql (fora do git): o trecho entre as marcas é o do ensaio, com p_agora trocado por now()
    const cp14 = `${RAIZ}.superpowers/sdd/a5-e18p2/sql/cp14.sql`
    if (existsSync(cp14)) {
      const interior = (bloco: string): string => bloco.split('\n').slice(1, -1).map(l => l.trimEnd()).join('\n').replace(/p_agora/g, 'now()')
      expect(interior(extrair(readFileSync(cp14, 'utf8'), 'MG17', 'limpa'))).toBe(interior(extrair(AUX, 'MG17', 'limpa')))
    }
  })
})
