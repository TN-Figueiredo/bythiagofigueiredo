// @vitest-environment node
/**
 * A5 · E4 (Tarefa 9): a MG4 (marcas de idade 1, 7 e 30 dias e o registro do que não pôde ser medido) e as três funções dela,
 * contra Postgres de verdade. Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e4-migration.test.ts --no-file-parallelism
 *
 * A MG4 NÃO está aplicada de vez (a migration ainda não existe em `supabase/migrations/`; é do controlador). Cada teste abre uma
 * transação, aplica a MG6 (ensaio da E10, de que a MG4 depende: pausa de coleta) e o ensaio da MG4 (`test/fixtures/sql/a5-e4-mg4.sql`),
 * semeia o SEU site, o SEU canal e os SEUS vídeos e termina em `rollback`: nada fica gravado e nenhum teste supõe a MG4 aplicada
 * (pende aplicação do controlador: só o teste `com a MG6 no banco, o registro do export cobre as duas tabelas`, que exige as duas
 * migrations aplicadas de vez e por isso pula, dizendo por quê, enquanto `obs_archive_uncovered()` não existir fora do ensaio).
 * Nenhum instante é do relógio: tudo parte de ANCORA (passado fixo) e `p_now` é derivado dela. Os cenários S0 a S13 e a aplicação
 * duas vezes ficam também no roteiro psql (`.superpowers/sdd/a5-e4/prova-mg4.sql`).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { garantirMg6, tenta, q1, escalar, criarSite, criarCanal } from '../helpers/mg6'
import { decidirMarca, type PendenteDeMarca } from '@/lib/youtube/observatorio/medidas/m1'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { FALTAS_DE_MARCA } from '@/lib/youtube/observatorio/medidas/tipos'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
export const MG4_FIXTURE = fileURLToPath(new URL('../fixtures/sql/a5-e4-mg4.sql', import.meta.url))
const MG4_SQL = (): string => readFileSync(process.env.E4_MG4_ARQUIVO && process.env.E4_MG4_ARQUIVO.length > 0 ? process.env.E4_MG4_ARQUIVO : MG4_FIXTURE, 'utf8')

const H = 36e5
const DAY = 24 * H
/** Publicação dos vídeos de teste (passado fixo; nenhum teste olha para o relógio). */
const ANCORA = Date.UTC(2026, 7, 3, 10, 0)
const iso = (ms: number): string => new Date(ms).toISOString()
const G1 = MEASURE_RULES.maxGapHoursDay1
const G = MEASURE_RULES.maxGapHours
const LEVES = `${G1}, ${G}`

const dormir = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))

interface Item { video_id: string; site_id: string; age_days: number; base_at: string; target_at: string; discovered_at: string | null; series_tier: string | null; prev_reason: string | null; missing_since: string | null; first_reading_at: string | null; last_reading_at: string | null; gap_crossed_pause: boolean; readings: Array<{ t: string; views: number; likes: number | null; comments: number | null }> }
interface Pending { total_pendentes: number; pares_em_pausa: number; itens: Item[] }

describe.skipIf(skipIfNoLocalDb())('A5 E4 Tarefa 9: a MG4, função por função (banco local, ensaio dentro de transação desfeita)', () => {
  let pg: Client

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
  })
  afterAll(async () => {
    try { await pg.query('rollback') } catch { /* sem transação aberta */ }
    await pg.end()
  })

  /** `begin; MG6; MG4; fn; rollback`. Banco ocupado (55P03, 40P01): espera e repete até 3 vezes. */
  async function dentro<T>(fn: () => Promise<T>): Promise<T> {
    for (let t = 0; ; t++) {
      await pg.query('begin')
      try {
        await garantirMg6(pg)
        await pg.query(MG4_SQL())
        break
      } catch (e) {
        await pg.query('rollback')
        const cod = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : ''
        if (t < 2 && (cod === '55P03' || cod === '40P01')) { await dormir(5_000 * (t + 1)); continue }
        throw e
      }
    }
    try { return await fn() } finally { await pg.query('rollback') }
  }

  interface Cena { site: string; canal: string }
  async function cena(): Promise<Cena> {
    const { site } = await criarSite(pg)
    return { site, canal: await criarCanal(pg, site) }
  }

  interface VideoOpc { publicado?: number | null; descoberto?: number | null; estreia?: number | null; estado?: string | null; faixa?: string | null; viewsOcultas?: boolean | null; ausenteDesde?: string | null }
  async function video(c: Cena, o: VideoOpc = {}, canal: string = c.canal): Promise<string> {
    const pub = o.publicado === undefined ? ANCORA : o.publicado
    return (await q1(pg,
      `insert into public.competitor_videos (competitor_channel_id, video_id, published_at, discovered_at, live_actual_start_at, live_broadcast_content, series_tier, views_hidden, missing_since)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [canal, 'e4m' + randomUUID().replace(/-/g, '').slice(0, 12), pub === null ? null : iso(pub),
        o.descoberto === undefined ? (pub === null ? null : iso(pub + H)) : (o.descoberto === null ? null : iso(o.descoberto)),
        o.estreia == null ? null : iso(o.estreia), o.estado ?? null, o.faixa ?? null, o.viewsOcultas ?? null, o.ausenteDesde ?? null])).id as string
  }
  async function diaria(v: string, quando: number, views: number, likes: number | null = null, comments: number | null = null): Promise<void> {
    await pg.query(`insert into public.competitor_video_daily (video_id, snap_date, views, likes, comments, taken_at) values ($1, $2::timestamptz::date, $3, $4, $5, $6)`, [v, iso(quando), views, likes, comments, iso(quando)])
  }
  async function cedo(c: Cena, v: string, quando: number, views: number, likes: number | null = null): Promise<void> {
    await pg.query(`insert into public.competitor_video_early (video_id, taken_at, site_id, views, likes, comments) values ($1, $2, $3, $4, $5, null)`, [v, iso(quando), c.site, views, likes])
  }

  const pendentes = async (agora: number, ver = 1, limite = 500): Promise<Pending> =>
    (await escalar<Pending>(pg, `select public.competitor_marks_pending($1, $2, $3, ${LEVES})`, [iso(agora), ver, limite]))
  const paresDe = (p: Pending, v: string): Item[] => p.itens.filter(i => i.video_id === v)
  const idadesDe = (p: Pending, v: string): number[] => paresDe(p, v).map(i => i.age_days).sort((a, b) => a - b)

  interface Marca { video_id: string; age_days: number; base_at: string; views: number; likes?: number | null; comments?: number | null; likes_hidden?: boolean | null; comments_disabled?: boolean | null; read_before_at: string; read_after_at: string }
  interface Falta { video_id: string; age_days: number; base_at: string; reason: string; since_at?: string | null }
  const marca = (v: string, idade: number, base: number, antes: number, depois: number, views = 100, extra: Partial<Marca> = {}): Marca =>
    ({ video_id: v, age_days: idade, base_at: iso(base), views, likes: null, comments: null, likes_hidden: null, comments_disabled: null, read_before_at: iso(antes), read_after_at: iso(depois), ...extra })
  const falta = (v: string, idade: number, base: number, reason = 'leitura_comecou_depois', since: number | null = null): Falta =>
    ({ video_id: v, age_days: idade, base_at: iso(base), reason, since_at: since === null ? null : iso(since) })
  type Apply = { marcas: number; marcas_recusadas: number; faltas: number; faltas_limpas: number; faltas_recusadas: number; refeitas_por_base: number; saude: Record<string, number> }
  const aplicar = async (marcas: unknown[], faltas: unknown[], agora: number, ver = 1): Promise<Apply> =>
    (await escalar<Apply>(pg, `select public.competitor_marks_apply($1::jsonb, $2::jsonb, $3, $4, ${LEVES})`, [JSON.stringify(marcas), JSON.stringify(faltas), ver, iso(agora)]))
  const saude = async (agora: number): Promise<Record<string, number>> => escalar<Record<string, number>>(pg, `select public.competitor_marks_health($1, ${LEVES})`, [iso(agora)])
  const linhas = (tabela: 'competitor_video_marks' | 'competitor_video_mark_misses', v: string): Promise<Record<string, unknown>[]> =>
    pg.query(`select * from public.${tabela} where video_id = $1 order by age_days`, [v]).then(r => r.rows as Record<string, unknown>[])
  /** Quantas linhas de atrasadas são deste vídeo: a prova é do banco inteiro, o teste só olha o que criou. */
  const atrasadasDe = async (v: string, agora: number): Promise<number> => {
    // o banco devolve o total; para isolar o vídeo, compara com e sem ele (apaga e relê dentro da transação)
    const antes = (await saude(agora)).atrasadas
    await pg.query('savepoint sem'); await pg.query(`update public.competitor_videos set published_at = null where id = $1`, [v])
    const depois = (await saude(agora)).atrasadas
    await pg.query('rollback to savepoint sem'); await pg.query('release savepoint sem')
    return antes - depois
  }

  // ───────────────────────── aplicação ─────────────────────────

  it('aplicada: V1 e V2', async () => {
    await dentro(async () => {
      const v1 = await q1(pg, `select
        (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity and c.relname in ('competitor_video_marks', 'competitor_video_mark_misses'))::int as tabelas,
        (select count(*) from pg_policies where schemaname = 'public' and tablename in ('competitor_video_marks', 'competitor_video_mark_misses') and cmd = 'SELECT' and qual like '%can_view_site(site_id)%')::int as policies,
        (select count(*) from pg_indexes where schemaname = 'public' and indexname in ('idx_cvm_site', 'idx_cvmm_site'))::int as indices,
        (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('competitor_marks_pending', 'competitor_marks_apply', 'competitor_marks_health')
            and not has_function_privilege('anon', p.oid, 'execute') and not has_function_privilege('authenticated', p.oid, 'execute') and has_function_privilege('service_role', p.oid, 'execute'))::int as funcoes,
        (select count(*) from pg_policies where schemaname = 'public' and tablename in ('competitor_video_marks', 'competitor_video_mark_misses') and cmd <> 'SELECT')::int as escrita`)
      expect([v1.tabelas, v1.policies, v1.indices, v1.funcoes, v1.escrita]).toEqual([2, 2, 2, 3, 0])
      const v2 = await q1(pg, `select has_table_privilege('anon', 'public.competitor_video_marks', 'select') as a, has_table_privilege('authenticated', 'public.competitor_video_marks', 'select') as b,
        has_table_privilege('authenticated', 'public.competitor_video_marks', 'insert') as c, has_table_privilege('authenticated', 'public.competitor_video_mark_misses', 'delete') as d`)
      expect([v2.a, v2.b, v2.c, v2.d]).toEqual([false, true, false, false])
    })
  })

  it('MG4 sem a coluna collection_paused_at recusa com "MG4 depende da MG6" e não cria nada', async () => {
    await pg.query('begin')
    try {
      // sem a MG6 aplicada (o banco de integração não a tem de vez): a guarda é a primeira instrução do arquivo
      const sem = await escalar<number>(pg, `select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'competitor_channels' and column_name = 'collection_paused_at'`)
      if (sem !== 0) { await pg.query('rollback'); return } // MG6 já aplicada de vez neste banco: o cenário não existe aqui
      const t = await tenta(pg, MG4_SQL())
      expect(t.ok).toBe(false)
      expect(!t.ok && t.message).toContain('MG4 depende da MG6')
    } finally {
      try { await pg.query('rollback') } catch { /* nada aberto */ }
    }
    expect(await escalar<string | null>(pg, `select to_regclass('public.competitor_video_marks')::text`)).toBeNull()
  })

  it('o ensaio se aplica duas vezes sem erro', async () => {
    await dentro(async () => { await pg.query(MG4_SQL()) })
  })

  // ───────────────────────── pendentes ─────────────────────────

  it('pendentes: só idade fechada há 30 minutos', async () => {
    await dentro(async () => {
      const c = await cena()
      const agora = ANCORA + 30 * DAY
      const antes = await video(c, { publicado: agora - 7 * DAY + 29 * 60_000 })
      const depois = await video(c, { publicado: agora - 7 * DAY - 31 * 60_000 })
      const p = await pendentes(agora)
      expect(idadesDe(p, antes)).toEqual([1])
      expect(idadesDe(p, depois)).toEqual([1, 7])
    })
  })

  it('pendentes: vídeo sem data não aparece', async () => {
    await dentro(async () => {
      const c = await cena()
      const v = await video(c, { publicado: null })
      expect(paresDe(await pendentes(ANCORA + 30 * DAY), v)).toEqual([])
    })
  })

  it('pendentes: a base é a estreia quando ela é posterior', async () => {
    await dentro(async () => {
      const c = await cena()
      const v = await video(c, { estreia: ANCORA + 2 * DAY })
      const itens = paresDe(await pendentes(ANCORA + 3 * DAY + 2 * H), v)
      expect(itens.map(i => i.age_days)).toEqual([1])
      expect(Date.parse(itens[0]!.base_at)).toBe(ANCORA + 2 * DAY)
      expect(Date.parse(itens[0]!.target_at)).toBe(ANCORA + 3 * DAY)
    })
  })

  it('pendentes: as leituras são as da vizinhança, das duas tabelas, em ordem', async () => {
    await dentro(async () => {
      const c = await cena()
      const v = await video(c)
      for (let d = 0; d <= 12; d++) await diaria(v, ANCORA - 7 * H + d * DAY, 100 * d)
      for (const h of [2, 8, 14, 20, 26]) await cedo(c, v, ANCORA + h * H, h)
      const p = await pendentes(ANCORA + 12 * DAY)
      const i7 = paresDe(p, v).find(i => i.age_days === 7)!
      expect(i7.readings.map(r => r.views)).toEqual([600, 700, 800])
      const i1 = paresDe(p, v).find(i => i.age_days === 1)!
      // alvo 1 dia depois da base (ANCORA + 24 h), limite 8 h, mais 1 h de folga: primeiras horas em +20 e +26 e a diária de +17 h (0 a 1)
      expect(i1.readings.length).toBeGreaterThanOrEqual(3)
      expect(i1.readings.map(r => Date.parse(r.t))).toEqual([...i1.readings.map(r => Date.parse(r.t))].sort((a, b) => a - b))
      expect(i1.readings.some(r => r.views === 20) && i1.readings.some(r => r.views === 26)).toBe(true)
    })
  })

  it('pendentes: primeira e última leitura do vídeo', async () => {
    await dentro(async () => {
      const c = await cena()
      const v = await video(c)
      await diaria(v, ANCORA + 9 * DAY, 900)
      await diaria(v, ANCORA + 10 * DAY, 1000)
      const i7 = paresDe(await pendentes(ANCORA + 12 * DAY), v).find(i => i.age_days === 7)!
      expect(Date.parse(i7.first_reading_at!)).toBe(ANCORA + 9 * DAY)
      expect(Date.parse(i7.last_reading_at!)).toBe(ANCORA + 10 * DAY)
      expect(i7.readings).toEqual([])
    })
  })

  it('pendentes: vídeo sem leitura nenhuma', async () => {
    await dentro(async () => {
      const c = await cena()
      const v = await video(c)
      const i = paresDe(await pendentes(ANCORA + 12 * DAY), v)[0]!
      expect(i.first_reading_at).toBeNull()
      expect(i.last_reading_at).toBeNull()
    })
  })

  it('pendentes: limite e total', async () => {
    await dentro(async () => {
      const c = await cena()
      const vs: string[] = []
      for (let k = 0; k < 3; k++) vs.push(await video(c, { publicado: ANCORA - k * H }))
      const p = await pendentes(ANCORA + 12 * DAY, 1, 2)
      expect(p.itens).toHaveLength(2)
      // o total é do banco inteiro: nunca menor que os 9 pares (3 vídeos × 3 idades fechadas? só 1 e 7 fecham em 12 dias) deste teste
      expect(p.total_pendentes).toBeGreaterThanOrEqual(6)
      const todos = await pendentes(ANCORA + 12 * DAY, 1, 2000)
      expect(todos.itens.filter(i => vs.includes(i.video_id))).toHaveLength(6)
    })
  })

  it('pendentes: o site é o do canal (mutação)', async () => {
    await dentro(async () => {
      const a = await cena(), b = await cena()
      const va = await video(a), vb = await video(b)
      const p = await pendentes(ANCORA + 12 * DAY, 1, 2000)
      expect(paresDe(p, va).every(i => i.site_id === a.site)).toBe(true)
      expect(paresDe(p, vb).every(i => i.site_id === b.site)).toBe(true)
    })
  })

  it('pendentes: devolvem o motivo anterior do par e a faixa do vídeo', async () => {
    await dentro(async () => {
      const c = await cena()
      const v = await video(c, { faixa: 'semanal' })
      const w = await video(c, { publicado: ANCORA + 3 * DAY })
      const agora = ANCORA + 15 * DAY
      await aplicar([], [falta(v, 7, ANCORA, 'leituras_distantes'), falta(w, 7, ANCORA + 3 * DAY - DAY)], agora) // w: base antiga (outra base): não vale
      const p = await pendentes(agora, 2, 2000)
      expect(paresDe(p, v).find(i => i.age_days === 7)!.prev_reason).toBe('leituras_distantes')
      expect(paresDe(p, v).find(i => i.age_days === 1)!.prev_reason).toBeNull()
      expect(paresDe(p, w).find(i => i.age_days === 7)!.prev_reason).toBeNull()
      expect(paresDe(p, v)[0]!.series_tier).toBe('semanal')
    })
  })

  it('pendentes: p_now nulo devolve zero itens', async () => {
    await dentro(async () => {
      const r = await escalar<Pending>(pg, `select public.competitor_marks_pending(null, 1, 500, ${LEVES})`)
      expect(r.itens).toEqual([])
      expect(r.total_pendentes).toBe(0)
      expect(r.pares_em_pausa).toBe(0)
    })
  })

  // ───────────────────────── gravar ─────────────────────────

  /** Vídeo com leituras diárias em volta do alvo da idade 7, e `p_now` depois do fecho. */
  async function comMarcaPossivel(c: Cena): Promise<{ v: string; antes: number; depois: number; agora: number }> {
    const v = await video(c)
    const alvo = ANCORA + 7 * DAY
    const antes = alvo - 7 * H, depois = alvo + 17 * H
    await diaria(v, antes, 700, 70)
    await diaria(v, depois, 800, 80)
    return { v, antes, depois, agora: ANCORA + 12 * DAY }
  }

  it('gravar: a marca entra com site, base e distância do banco', async () => {
    await dentro(async () => {
      const c = await cena()
      const { v, antes, depois, agora } = await comMarcaPossivel(c)
      const r = await aplicar([marca(v, 7, ANCORA, antes, depois, 731, { likes: 73, likes_hidden: false })], [], agora)
      expect(r.marcas).toBe(1)
      const [m] = await linhas('competitor_video_marks', v)
      expect(m).toMatchObject({ site_id: c.site, views: '731', gap_hours: '24.000', rule_version: 1 })
      expect(Date.parse(String(m!.age_base_at))).toBe(ANCORA)
    })
  })

  it('gravar: o chamador não escolhe o site (mutação)', async () => {
    await dentro(async () => {
      const a = await cena(), b = await cena()
      const { v, antes, depois, agora } = await comMarcaPossivel(b)
      void a
      await aplicar([marca(v, 7, ANCORA, antes, depois, 731, { site_id: a.site } as Partial<Marca>)], [], agora)
      const [m] = await linhas('competitor_video_marks', v)
      expect(m!.site_id).toBe(b.site)
      expect((await saude(agora)).site_divergente).toBe(0)
    })
  })

  it('gravar: marca cujas leituras não cercam o alvo é recusada', async () => {
    await dentro(async () => {
      const c = await cena()
      const { v, depois, agora } = await comMarcaPossivel(c)
      const r = await aplicar([marca(v, 7, ANCORA, ANCORA + 7 * DAY + H, depois)], [], agora)
      expect(r.marcas_recusadas).toBe(1)
      expect(await linhas('competitor_video_marks', v)).toEqual([])
    })
  })

  it('gravar: marca com distância acima do limite é recusada; exatamente no limite entra', async () => {
    await dentro(async () => {
      const c = await cena()
      const v = await video(c)
      const a7 = ANCORA + 7 * DAY, a1 = ANCORA + DAY
      const agora = ANCORA + 12 * DAY
      const r1 = await aplicar([marca(v, 7, ANCORA, a7 - 24 * H, a7 + 24 * H), marca(v, 1, ANCORA, a1 - 5 * H, a1 + 4 * H + 60_000)], [], agora)
      expect(r1.marcas_recusadas).toBe(2)
      const r2 = await aplicar([marca(v, 7, ANCORA, a7 - 12 * H, a7 + 24 * H), marca(v, 1, ANCORA, a1 - 4 * H, a1 + 4 * H)], [], agora)
      expect(r2.marcas).toBe(2)
    })
  })

  it('gravar: a mesma marca de novo, com outro número, não regrava', async () => {
    await dentro(async () => {
      const c = await cena()
      const { v, antes, depois, agora } = await comMarcaPossivel(c)
      await aplicar([marca(v, 7, ANCORA, antes, depois, 731)], [], agora)
      const r = await aplicar([marca(v, 7, ANCORA, antes, depois, 999)], [], agora)
      expect(r.marcas).toBe(0)
      expect((await linhas('competitor_video_marks', v))[0]!.views).toBe('731')
    })
  })

  it('gravar: motivo de par que já tem marca não entra', async () => {
    await dentro(async () => {
      const c = await cena()
      const { v, antes, depois, agora } = await comMarcaPossivel(c)
      await aplicar([marca(v, 7, ANCORA, antes, depois)], [], agora)
      const r = await aplicar([], [falta(v, 7, ANCORA, 'leituras_distantes')], agora)
      expect(r.faltas).toBe(0)
      expect(await linhas('competitor_video_mark_misses', v)).toEqual([])
    })
  })

  it('gravar: motivo e depois a marca do mesmo par: o motivo sai', async () => {
    await dentro(async () => {
      const c = await cena()
      const { v, antes, depois, agora } = await comMarcaPossivel(c)
      expect((await aplicar([], [falta(v, 7, ANCORA, 'leituras_distantes')], agora)).faltas).toBe(1)
      const r = await aplicar([marca(v, 7, ANCORA, antes, depois)], [], agora)
      expect(r.faltas_limpas).toBe(1)
      expect(await linhas('competitor_video_mark_misses', v)).toEqual([])
      expect(await linhas('competitor_video_marks', v)).toHaveLength(1)
    })
  })

  it('gravar: motivo da mesma versão não troca; de versão maior troca; versão maior reabre os motivos, as marcas não', async () => {
    await dentro(async () => {
      const c = await cena()
      const { v, antes, depois, agora } = await comMarcaPossivel(c)
      const w = await video(c)
      await aplicar([marca(v, 7, ANCORA, antes, depois)], [falta(w, 7, ANCORA, 'leitura_comecou_depois', ANCORA + DAY)], agora)
      expect((await aplicar([], [falta(w, 7, ANCORA, 'sem_leitura')], agora)).faltas).toBe(0)
      expect((await linhas('competitor_video_mark_misses', w))[0]).toMatchObject({ reason: 'leitura_comecou_depois', rule_version: 1 })
      const p2 = await pendentes(agora, 2, 2000)
      expect(idadesDe(p2, w)).toContain(7)
      expect(idadesDe(p2, v)).not.toContain(7)
      expect((await aplicar([], [falta(w, 7, ANCORA, 'sem_leitura')], agora, 2)).faltas).toBe(1)
      expect((await linhas('competitor_video_mark_misses', w))[0]).toMatchObject({ reason: 'sem_leitura', rule_version: 2 })
    })
  })

  it('gravar: motivo fora do catálogo e idade fora de 1, 7 e 30 lançam, e nada é gravado', async () => {
    await dentro(async () => {
      const c = await cena()
      const v = await video(c)
      const agora = ANCORA + 12 * DAY
      await pg.query('savepoint a')
      const t1 = await tenta(pg, `select public.competitor_marks_apply('[]'::jsonb, $1::jsonb, 1, $2, ${LEVES})`, [JSON.stringify([falta(v, 7, ANCORA, 'palpite')]), iso(agora)])
      await pg.query('rollback to savepoint a')
      const t2 = await tenta(pg, `select public.competitor_marks_apply('[]'::jsonb, $1::jsonb, 1, $2, ${LEVES})`, [JSON.stringify([falta(v, 14, ANCORA)]), iso(ANCORA + 40 * DAY)])
      await pg.query('rollback to savepoint a')
      expect(t1.ok).toBe(false)
      expect(t2.ok).toBe(false)
      expect(await linhas('competitor_video_mark_misses', v)).toEqual([])
    })
  })

  it('o check de motivo aceita exatamente os seis códigos de FALTAS_DE_MARCA', async () => {
    await dentro(async () => {
      const def = await escalar<string>(pg, `select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.competitor_video_mark_misses'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%reason%'`)
      const codigos = [...def.matchAll(/'([a-z_]+)'::text/g)].map(m => m[1]!).sort()
      expect(codigos).toEqual([...FALTAS_DE_MARCA].sort())
    })
  })

  it('gravar: lista nula lança; vídeo que não existe é contado como recusado, sem lançar', async () => {
    await dentro(async () => {
      const agora = ANCORA + 12 * DAY
      await pg.query('savepoint a')
      expect((await tenta(pg, `select public.competitor_marks_apply(null, '[]'::jsonb, 1, $1, ${LEVES})`, [iso(agora)])).ok).toBe(false)
      await pg.query('rollback to savepoint a')
      const r = await aplicar([marca(randomUUID(), 7, ANCORA, ANCORA, ANCORA + H)], [falta(randomUUID(), 7, ANCORA)], agora)
      expect(r.marcas_recusadas).toBe(1)
      expect(r.faltas_recusadas).toBe(1)
    })
  })

  // ───────────────────────── a prova ─────────────────────────

  it('prova: tabelas vazias não é verde', async () => {
    await dentro(async () => {
      const c = await cena()
      const v = await video(c, { publicado: ANCORA })
      expect(await atrasadasDe(v, ANCORA + 10 * DAY)).toBeGreaterThanOrEqual(1)
    })
  })

  it('prova: não sobe antes do prazo, sobe no prazo', async () => {
    await dentro(async () => {
      const c = await cena()
      const v = await video(c, { publicado: ANCORA })
      const prazo = ANCORA + 7 * DAY + 36 * H + 48 * H
      expect(await atrasadasDe(v, prazo - 60_000)).toBe(1) // só a idade 1 (a 7 ainda não)
      expect(await atrasadasDe(v, prazo)).toBe(2)
    })
  })

  it('prova: não sobe por par com marca nem por par com motivo, nem por vídeo sem data', async () => {
    await dentro(async () => {
      const c = await cena()
      const { v, antes, depois } = await comMarcaPossivel(c)
      const agora = ANCORA + 30 * DAY
      const sem = await video(c, { publicado: null })
      await aplicar([marca(v, 7, ANCORA, antes, depois), marca(v, 1, ANCORA, ANCORA + DAY - 2 * H, ANCORA + DAY + 2 * H)], [falta(v, 30, ANCORA + 0, 'leituras_distantes')], agora)
      void sem
      expect(await atrasadasDe(v, agora)).toBe(0)
      expect(await atrasadasDe(sem, agora)).toBe(0)
    })
  })

  it('prova: par nas duas tabelas e site divergente', async () => {
    await dentro(async () => {
      const a = await cena(), b = await cena()
      const v = await video(a)
      const agora = ANCORA + 12 * DAY
      const antes0 = await saude(agora)
      await pg.query(`insert into public.competitor_video_marks (video_id, age_days, site_id, views, gap_hours, age_base_at, read_before_at, read_after_at) values ($1, 7, $2, 1, 1, $3, $3, $3)`, [v, a.site, iso(ANCORA)])
      await pg.query(`insert into public.competitor_video_mark_misses (video_id, age_days, site_id, reason, rule_version, age_base_at) values ($1, 7, $2, 'sem_leitura', 1, $3)`, [v, a.site, iso(ANCORA)])
      const s1 = await saude(agora)
      expect(s1.em_duas_tabelas - antes0.em_duas_tabelas).toBe(1)
      await pg.query(`update public.competitor_video_marks set site_id = $2 where video_id = $1`, [v, b.site])
      const s2 = await saude(agora)
      expect(s2.site_divergente - antes0.site_divergente).toBe(1)
    })
  })

  it('prova: parâmetro nulo ou limite zero lança', async () => {
    await dentro(async () => {
      const t = async (sql: string, p: unknown[]): Promise<boolean> => { await pg.query('savepoint a'); const r = await tenta(pg, sql, p); await pg.query('rollback to savepoint a'); return r.ok }
      expect(await t(`select public.competitor_marks_health(null, ${LEVES})`, [])).toBe(false)
      expect(await t(`select public.competitor_marks_health($1, 0, ${G})`, [iso(ANCORA)])).toBe(false)
      expect(await t(`select public.competitor_marks_health($1, ${G1}, null)`, [iso(ANCORA)])).toBe(false)
    })
  })

  it('cascata: apagar o vídeo leva marcas e motivos; apagar o canal também', async () => {
    await dentro(async () => {
      const c = await cena()
      const { v, antes, depois, agora } = await comMarcaPossivel(c)
      const w = await video(c)
      await aplicar([marca(v, 7, ANCORA, antes, depois)], [falta(w, 7, ANCORA, 'sem_leitura')], agora)
      await pg.query(`delete from public.competitor_videos where id = $1`, [v])
      expect(await linhas('competitor_video_marks', v)).toEqual([])
      await pg.query(`delete from public.competitor_channels where id = $1`, [c.canal])
      expect(await linhas('competitor_video_mark_misses', w)).toEqual([])
    })
  })

  // ───────────────────────── agendado, base que anda ─────────────────────────

  it('agendado: vídeo upcoming ou live não é pendente nem atrasado; nulo conta como nem agendado nem no ar', async () => {
    await dentro(async () => {
      const c = await cena()
      const agora = ANCORA + 30 * DAY
      const up = await video(c, { estado: 'upcoming' }), live = await video(c, { estado: 'live' }), nulo = await video(c, { estado: null })
      const p = await pendentes(agora, 1, 2000)
      expect(paresDe(p, up)).toEqual([])
      expect(paresDe(p, live)).toEqual([])
      expect(paresDe(p, nulo).length).toBeGreaterThan(0)
      expect(await atrasadasDe(up, agora)).toBe(0)
      expect(await atrasadasDe(live, agora)).toBe(0)
    })
  })

  it('agendado: gravar recusa marca e motivo de vídeo upcoming', async () => {
    await dentro(async () => {
      const c = await cena()
      const v = await video(c, { estado: 'upcoming' })
      const a1 = ANCORA + DAY
      const r = await aplicar([marca(v, 1, ANCORA, a1 - H, a1 + H)], [falta(v, 7, ANCORA)], ANCORA + 12 * DAY)
      expect([r.marcas_recusadas, r.faltas_recusadas]).toEqual([1, 1])
      expect(await linhas('competitor_video_marks', v)).toEqual([])
    })
  })

  it('a transmissão começou: o par aparece com a base nova', async () => {
    await dentro(async () => {
      const c = await cena()
      const v = await video(c, { estado: 'upcoming' })
      const agora = ANCORA + 3 * DAY
      expect(paresDe(await pendentes(agora, 1, 2000), v)).toEqual([])
      await pg.query(`update public.competitor_videos set live_broadcast_content = 'none', live_actual_start_at = $2 where id = $1`, [v, iso(ANCORA + 2 * DAY - 2 * H)])
      const itens = paresDe(await pendentes(agora, 1, 2000), v)
      expect(itens.map(i => i.age_days)).toEqual([1])
      expect(Date.parse(itens[0]!.base_at)).toBe(ANCORA + 2 * DAY - 2 * H)
    })
  })

  it('base que anda: a prova conta, o par volta, gravar apaga a linha velha; a marca nova entra na mesma chamada', async () => {
    await dentro(async () => {
      const c = await cena()
      const v = await video(c)
      const agora = ANCORA + 15 * DAY
      const a7 = ANCORA + 7 * DAY, a1 = ANCORA + DAY
      await diaria(v, a7 - 5 * H, 700); await diaria(v, a7 + 15 * H, 800)
      await aplicar([marca(v, 7, ANCORA, a7 - 5 * H, a7 + 15 * H, 731)], [falta(v, 1, ANCORA, 'leituras_distantes')], agora)
      const antes0 = (await saude(agora)).base_divergente
      await pg.query(`update public.competitor_videos set live_actual_start_at = $2 where id = $1`, [v, iso(ANCORA + DAY)])
      expect((await saude(agora)).base_divergente - antes0).toBe(2)
      const novos = idadesDe(await pendentes(agora, 1, 2000), v)
      expect(novos).toContain(7)
      const novaBase = ANCORA + DAY
      const r = await aplicar([marca(v, 7, novaBase, a7 + DAY - 5 * H, a7 + DAY + 15 * H, 929)], [], agora)
      expect(r.refeitas_por_base).toBe(2)
      expect(r.marcas).toBe(1)
      expect((await saude(agora)).base_divergente - antes0).toBe(0)
      expect((await linhas('competitor_video_marks', v))[0]).toMatchObject({ views: '929' })
      void a1
    })
  })

  it('base igual: gravar de novo não apaga nada', async () => {
    await dentro(async () => {
      const c = await cena()
      const { v, antes, depois, agora } = await comMarcaPossivel(c)
      await aplicar([marca(v, 7, ANCORA, antes, depois, 731)], [], agora)
      const antesLinha = (await linhas('competitor_video_marks', v))[0]
      const r = await aplicar([], [], agora)
      expect(r.refeitas_por_base).toBe(0)
      expect((await linhas('competitor_video_marks', v))[0]).toEqual(antesLinha)
    })
  })

  it('gravar: motivo antes de alvo + limite + 1 hora é recusado; no minuto exato entra', async () => {
    await dentro(async () => {
      const c = await cena()
      const v = await video(c)
      const a7 = ANCORA + 7 * DAY, a1 = ANCORA + DAY
      expect((await aplicar([], [falta(v, 7, ANCORA, 'leituras_distantes')], a7 + 36 * H + 59 * 60_000)).faltas_recusadas).toBe(1)
      expect((await aplicar([], [falta(v, 7, ANCORA, 'leituras_distantes')], a7 + 37 * H)).faltas).toBe(1)
      expect((await aplicar([], [falta(v, 1, ANCORA, 'leituras_distantes')], a1 + 8 * H + 59 * 60_000)).faltas_recusadas).toBe(1)
      expect((await aplicar([], [falta(v, 1, ANCORA, 'leituras_distantes')], a1 + 9 * H)).faltas).toBe(1)
    })
  })

  it('gravar: a borda do banco é a mesma de decidirMarca', async () => {
    await dentro(async () => {
      const c = await cena()
      const v = await video(c)
      const a7 = ANCORA + 7 * DAY
      const p = (over: Partial<PendenteDeMarca> = {}): PendenteDeMarca => ({
        videoId: v, siteId: c.site, idadeDias: 7, baseAt: ANCORA, baseAtIso: iso(ANCORA), seriesTier: null, motivoAnterior: null, alvoAt: a7, discoveredAt: ANCORA + H,
        missingSince: null, viewsHidden: null, likesHidden: null, commentsDisabled: null, primeiraLeituraAt: a7 - H, ultimaLeituraAt: a7 - H, cruzouPausa: false, leituras: [], ...over })
      for (const [quando, banco] of [[a7 + 36 * H + 59 * 60_000, 'recusa'], [a7 + 37 * H, 'aceita']] as const) {
        const d = decidirMarca(p(), quando)
        const r = await aplicar([], [falta(v, 7, ANCORA, 'leituras_distantes')], quando)
        if (banco === 'recusa') { expect(d.tipo).toBe('aguardar'); expect(r.faltas_recusadas).toBe(1) } else { expect(d.tipo).toBe('falta'); expect(r.faltas).toBe(1) }
      }
    })
  })

  it('gravar: motivo de idade que ainda não fechou é recusado', async () => {
    await dentro(async () => {
      const c = await cena()
      const v = await video(c)
      expect((await aplicar([], [falta(v, 7, ANCORA, 'sem_leitura')], ANCORA + 3 * DAY)).faltas_recusadas).toBe(1)
    })
  })

  it('gravar: marca ou motivo calculado para a base velha é recusado, mesmo com as leituras cercando o alvo novo', async () => {
    await dentro(async () => {
      const c = await cena()
      const v = await video(c)
      const agora = ANCORA + 12 * DAY
      await pg.query(`update public.competitor_videos set live_actual_start_at = $2 where id = $1`, [v, iso(ANCORA + 2 * H)]) // a base andou 2 h
      const a1 = ANCORA + DAY
      const velha = await aplicar([marca(v, 1, ANCORA, a1 - 2 * H + 3 * H, a1 + 5 * H, 150)], [falta(v, 7, ANCORA)], agora)
      expect([velha.marcas_recusadas, velha.faltas_recusadas]).toEqual([1, 1])
      expect(await linhas('competitor_video_marks', v)).toEqual([])
      const nova = await aplicar([marca(v, 1, ANCORA + 2 * H, a1 - 2 * H + 3 * H, a1 + 5 * H, 160)], [], agora)
      expect(nova.marcas).toBe(1)
      expect(Date.parse(String((await linhas('competitor_video_marks', v))[0]!.age_base_at))).toBe(ANCORA + 2 * H)
    })
  })

  it('gravar: item sem base_at é recusado', async () => {
    await dentro(async () => {
      const c = await cena()
      const { v, antes, depois, agora } = await comMarcaPossivel(c)
      const m = { ...marca(v, 7, ANCORA, antes, depois) } as Partial<Marca>
      delete m.base_at
      const f = { ...falta(v, 30, ANCORA) } as Partial<Falta>
      delete f.base_at
      const r = await aplicar([m], [f], ANCORA + 40 * DAY)
      expect([r.marcas_recusadas, r.faltas_recusadas]).toEqual([1, 1])
      void agora
    })
  })

  it('gravar: base_at com microssegundos, devolvido como veio, entra', async () => {
    await dentro(async () => {
      const c = await cena()
      const pub = '2026-08-03T10:00:00.123456+00'
      const v = (await q1(pg, `insert into public.competitor_videos (competitor_channel_id, video_id, published_at, discovered_at) values ($1, $2, $3, $3) returning id`, [c.canal, 'e4us' + randomUUID().slice(0, 8), pub])).id as string
      const base = Date.parse('2026-08-03T10:00:00.123Z')
      const a7 = base + 7 * DAY
      await diaria(v, a7 - 5 * H, 700); await diaria(v, a7 + 15 * H, 800)
      const agora = base + 12 * DAY
      const item = paresDe(await pendentes(agora, 1, 2000), v).find(i => i.age_days === 7)!
      expect(item.base_at).toContain('.123456')
      const r = await escalar<Apply>(pg, `select public.competitor_marks_apply($1::jsonb, '[]'::jsonb, 1, $2, ${LEVES})`, [
        JSON.stringify([{ video_id: v, age_days: 7, base_at: item.base_at, views: 731, likes: null, comments: null, likes_hidden: null, comments_disabled: null, read_before_at: iso(a7 - 5 * H), read_after_at: iso(a7 + 15 * H) }]), iso(agora)])
      expect(r.marcas).toBe(1)
    })
  })

  it('agendado depois da decisão: gravar apaga a linha; não agendado: gravar não apaga nada', async () => {
    await dentro(async () => {
      const c = await cena()
      const { v, antes, depois, agora } = await comMarcaPossivel(c)
      await aplicar([marca(v, 7, ANCORA, antes, depois)], [falta(v, 30, ANCORA, 'leituras_distantes')], ANCORA + 40 * DAY)
      for (const estado of ['none', null]) {
        await pg.query(`update public.competitor_videos set live_broadcast_content = $2 where id = $1`, [v, estado])
        expect((await aplicar([], [], agora)).refeitas_por_base).toBe(0)
      }
      await pg.query(`update public.competitor_videos set live_broadcast_content = 'upcoming' where id = $1`, [v])
      expect((await aplicar([], [], agora)).refeitas_por_base).toBe(2)
      expect(await linhas('competitor_video_marks', v)).toEqual([])
      expect(await linhas('competitor_video_mark_misses', v)).toEqual([])
    })
  })

  it('prova: vídeo que perdeu a data não conta em base_divergente, e gravar não apaga a linha dele', async () => {
    await dentro(async () => {
      const c = await cena()
      const v = await video(c)
      await aplicar([], [falta(v, 1, ANCORA, 'sem_leitura')], ANCORA + 12 * DAY)
      const antes0 = (await saude(ANCORA + 12 * DAY)).base_divergente
      await pg.query(`update public.competitor_videos set published_at = null where id = $1`, [v])
      expect((await saude(ANCORA + 12 * DAY)).base_divergente).toBe(antes0)
      expect((await aplicar([], [], ANCORA + 12 * DAY)).refeitas_por_base).toBe(0)
      expect(await linhas('competitor_video_mark_misses', v)).toHaveLength(1)
    })
  })

  // ───────────────────────── a pausa de coleta (tarefa 8b) ─────────────────────────

  async function pausa(c: Cena, de: number, ate: number | null): Promise<void> {
    await pg.query(`insert into public.competitor_collection_pauses (site_id, competitor_channel_id, paused_at, paused_by, resumed_at) values ($1, $2, $3, $4, $5)`,
      [c.site, c.canal, iso(de), randomUUID(), ate === null ? null : iso(ate)])
  }
  const cruza = async (v: string, idade: number, agora: number): Promise<boolean | undefined> =>
    paresDe(await pendentes(agora, 1, 2000), v).find(i => i.age_days === idade)?.gap_crossed_pause

  /** Vídeo G: leituras só em ANCORA − 7 h e ANCORA + 5 d − 7 h (idade 1: buraco de 120 h em volta do alvo; idade 7: buraco até p_now). */
  async function videoComBuraco(c: Cena): Promise<{ v: string; agora: number; ini: number; fim: number }> {
    const v = await video(c)
    const ini = ANCORA - 7 * H, fim = ini + 5 * DAY
    await diaria(v, ini, 100); await diaria(v, fim, 500)
    return { v, agora: ANCORA + 11 * DAY, ini, fim }
  }

  it('canal pausado: competitor_marks_pending não devolve par dele', async () => {
    await dentro(async () => {
      const c = await cena()
      const v = await video(c)
      const agora = ANCORA + 12 * DAY
      expect(paresDe(await pendentes(agora, 1, 2000), v).length).toBeGreaterThan(0)
      await pg.query(`update public.competitor_channels set collection_paused_at = $2 where id = $1`, [c.canal, iso(agora - H)])
      expect(paresDe(await pendentes(agora, 1, 2000), v)).toEqual([])
    })
  })

  it('canal pausado: a prova conta o par em pares_em_pausa, e não em total_pendentes nem em atrasadas', async () => {
    await dentro(async () => {
      const c = await cena()
      const v = await video(c)
      const agora = ANCORA + 12 * DAY
      const antes0 = await pendentes(agora, 1, 1)
      const atr0 = (await saude(agora)).atrasadas
      await pg.query(`update public.competitor_channels set collection_paused_at = $2 where id = $1`, [c.canal, iso(agora - H)])
      const depois = await pendentes(agora, 1, 1)
      expect(depois.pares_em_pausa - antes0.pares_em_pausa).toBe(2) // idades 1 e 7
      expect(antes0.total_pendentes - depois.total_pendentes).toBe(2)
      expect(atr0 - (await saude(agora)).atrasadas).toBe(2)
      expect(Object.keys(await saude(agora)).sort()).toEqual(['atrasadas', 'base_divergente', 'em_duas_tabelas', 'faltas', 'marcas', 'site_divergente'])
      void v
    })
  })

  it('despausado: par cujo buraco cruza uma pausa registrada devolve gap_crossed_pause verdadeiro', async () => {
    await dentro(async () => {
      const c = await cena()
      const { v, agora, ini, fim } = await videoComBuraco(c)
      expect(await cruza(v, 1, agora)).toBe(false)
      await pausa(c, ini, fim - 8 * H) // 112 h de 120: sobram exatamente 8 h (o limite da idade 1)
      expect(await cruza(v, 1, agora)).toBe(true)
      expect(await cruza(v, 7, agora)).toBe(false) // a pausa não toca o buraco da idade 7
    })
  })

  it('despausado: par com buraco fora de qualquer pausa continua em perdidas (gap_crossed_pause falso)', async () => {
    await dentro(async () => {
      const c = await cena()
      const { v, agora, fim } = await videoComBuraco(c)
      await pausa(c, fim + 2 * H, fim + 3 * H)
      expect(await cruza(v, 1, agora)).toBe(false)
    })
  })

  it('despausado: pausa curta dentro de buraco longo continua em perdidas', async () => {
    await dentro(async () => {
      const c = await cena()
      const { v, agora, ini } = await videoComBuraco(c)
      await pausa(c, ini + 40 * H, ini + 40 * H + 20 * 60_000)
      expect(await cruza(v, 1, agora)).toBe(false)
    })
  })

  it('despausado: um minuto a menos de pausa (sobram 8 h 01 min) não cruza', async () => {
    await dentro(async () => {
      const c = await cena()
      const { v, agora, ini, fim } = await videoComBuraco(c)
      await pausa(c, ini + 60_000, fim - 8 * H)
      expect(await cruza(v, 1, agora)).toBe(false)
    })
  })

  it('despausado: pausas sobrepostas contam uma vez', async () => {
    await dentro(async () => {
      const c = await cena()
      const { v, agora, ini } = await videoComBuraco(c)
      await pausa(c, ini + H, ini + 105 * H) // 104 h
      await pausa(c, ini + 49 * H, ini + 105 * H) // 56 h, toda dentro da primeira: a soma (160 h) passaria do buraco, a união (104 h) deixa 16 h
      expect(await cruza(v, 1, agora)).toBe(false)
    })
  })

  it('cada item de competitor_marks_pending traz gap_crossed_pause booleano, nunca nulo', async () => {
    await dentro(async () => {
      const c = await cena()
      await video(c); await videoComBuraco(c)
      const p = await pendentes(ANCORA + 40 * DAY, 1, 2000)
      expect(p.itens.length).toBeGreaterThan(0)
      expect(p.itens.every(i => typeof i.gap_crossed_pause === 'boolean')).toBe(true)
    })
  })

  it('canal nunca pausado: a saída é a de antes, mais pares_em_pausa 0', async () => {
    await dentro(async () => {
      const c = await cena()
      const v = await video(c)
      const p = await pendentes(ANCORA + 12 * DAY, 1, 2000)
      expect(paresDe(p, v)).toHaveLength(2)
      expect(paresDe(p, v).every(i => i.gap_crossed_pause === false)).toBe(true)
      expect(typeof p.pares_em_pausa).toBe('number')
    })
  })

  // ───────────────────────── com a MG6 no banco ─────────────────────────

  it('com a MG6 no banco, o registro do export cobre as duas tabelas da MG4', async () => {
    await dentro(async () => {
      const tem = await escalar<string | null>(pg, `select to_regprocedure('public.obs_archive_uncovered()')::text`)
      if (tem === null) { console.warn('pulado: obs_archive_uncovered() não existe neste banco (MG6 não está aplicada de vez)'); return }
      const c = await cena()
      const { v, antes, depois, agora } = await comMarcaPossivel(c)
      const w = await video(c)
      await aplicar([marca(v, 7, ANCORA, antes, depois)], [falta(w, 7, ANCORA, 'sem_leitura')], agora)
      expect(await escalar<number>(pg, `select coalesce(cardinality(public.obs_archive_uncovered()), 0)::int`)).toBe(0)
      const cont = await pg.query(`select table_name from public.obs_archive_channel_counts($1) where table_name in ('competitor_video_marks', 'competitor_video_mark_misses') order by 1`, [c.canal])
      expect(cont.rows.map(r => r.table_name)).toEqual(['competitor_video_mark_misses', 'competitor_video_marks'])
    })
  })
})
