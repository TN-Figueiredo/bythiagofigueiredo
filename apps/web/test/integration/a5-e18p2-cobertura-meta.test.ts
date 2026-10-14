// @vitest-environment node
/**
 * A5 · E18 parte 2, MG17a: cobertura de metadados (parte aditiva). O SQL do Apêndice A do plano, contra Postgres de verdade.
 * Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/a5-e18p2-cobertura-meta.test.ts --no-file-parallelism
 *
 * O SQL vem do arquivo de ensaio (`.superpowers/sdd/a5-e18p2/sql/mg17a.sql`, fora do git) ou, se ele não existir, do arquivo de
 * migration `*observatorio_a5_e18p2_cobertura_de_metadados*`. Tudo roda dentro de `begin; … rollback;`; só os sites são
 * persistentes (apagados no `afterAll`). Função sem EXECUTE nunca é CHAMADA como anon/authenticated: privilégio se confere por catálogo.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url))

type Linha = Record<string, unknown>

function lerSql(): string {
  const ensaio = `${RAIZ}.superpowers/sdd/a5-e18p2/sql/mg17a.sql`
  if (existsSync(ensaio)) return readFileSync(ensaio, 'utf8')
  const dir = `${RAIZ}supabase/migrations/`
  const achado = readdirSync(dir).find(f => f.includes('observatorio_a5_e18p2_cobertura_de_metadados'))
  if (!achado) throw new Error('nem o arquivo de ensaio nem a migration existem (mg17a.sql / observatorio_a5_e18p2_cobertura_de_metadados)')
  return readFileSync(dir + achado, 'utf8')
}

/** Do começo da marca `-- >>> MG17a <nome> (início)` ao fim da linha da marca `-- <<< MG17a <nome> (fim)`. */
function extrair(sql: string, nome: string): string {
  const de = sql.indexOf(`-- >>> MG17a ${nome} (início)`)
  const fim = sql.indexOf(`-- <<< MG17a ${nome} (fim)`)
  if (de < 0 || fim < 0 || fim < de) throw new Error(`marca MG17a ${nome} não achada no SQL`)
  const ate = sql.indexOf('\n', fim)
  return sql.slice(de, ate < 0 ? sql.length : ate)
}

const DIA0 = '2026-01-01'
const mais = (dia: string, n: number): string => new Date(Date.parse(dia + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10)
const md5 = (s: string): string => createHash('md5').update(s).digest('hex')

const ASSINATURAS = [
  'public.yt_own_meta_cover_set(text, text, date[], uuid, uuid, uuid, timestamptz)',
  'public.yt_own_meta_prova(uuid, uuid, date)',
  'public.yt_own_meta_cover(uuid, uuid, date, boolean)',
]

describe.skipIf(skipIfNoLocalDb())('A5 E18 P2, MG17a: cobertura de metadados (bythiago_int)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const sites: string[] = []
  let S1 = ''
  let S2 = ''
  let SQL = ''
  let COVER = ''

  beforeAll(async () => {
    SQL = lerSql()
    COVER = extrair(SQL, 'yt_own_meta_cover')
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

  /** Tudo dentro de uma transação desfeita. `aplicar: false` deixa o arquivo para o teste aplicar depois de semear. */
  async function tx(fn: () => Promise<void>, o: { aplicar?: boolean; sql?: string } = {}): Promise<void> {
    await pg.query('begin')
    try {
      await pg.query("set local lock_timeout = '5s'")
      if (o.aplicar !== false) await pg.query(o.sql ?? SQL)
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
  async function cobrir(site: string, canal: string, dia: string, compactar = false): Promise<Linha> {
    const r = await tenta('select public.yt_own_meta_cover($1::uuid, $2::uuid, $3::date, $4::boolean) as r', [site, canal, dia, compactar])
    if (!r.ok) throw new Error('yt_own_meta_cover recusou: ' + r.msg)
    return r.rows[0]!.r as Linha
  }
  async function prova(site: string, canal: string, dia: string): Promise<Linha> {
    const r = await tenta('select public.yt_own_meta_prova($1::uuid, $2::uuid, $3::date) as r', [site, canal, dia])
    if (!r.ok) throw new Error('yt_own_meta_prova falhou: ' + r.msg)
    return r.rows[0]!.r as Linha
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
  /** Linha de metadados do dia. `priv` e `dhash` nulos = a captura não aconteceu naquele dia. */
  async function meta(c: Cena, i: number, dia: string, o: { priv?: string | null; dhash?: string | null; title?: string } = {}): Promise<void> {
    const priv = o.priv === undefined ? 'public' : o.priv
    const dhash = o.dhash === undefined ? 'abcd' : o.dhash
    await pg.query(`insert into public.yt_own_video_meta_daily
      (youtube_video_id, day_pt, site_id, video_id, channel_id, title, privacy_status, thumbnail_dhash, captured_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [c.v[i]!.yt, dia, c.site, c.v[i]!.id, c.canal, o.title ?? 'T', priv, dhash, dia + 'T15:00:00Z'])
  }
  async function cob(c: Cena, i: number, set: string, de: string, ate: string): Promise<void> {
    await pg.query(`insert into public.yt_own_video_coverage (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id, source, collected_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8, '2026-02-01T00:00:00Z')`,
      [c.v[i]!.yt, set, de, ate, c.site, c.v[i]!.id, c.canal, set === 'meta_thumb' ? 'imagem' : 'data_api'])
  }
  async function intervalos(c: Cena, i: number, set: string): Promise<string[]> {
    const r = await q(`select covered_from::text as de, covered_to::text as ate from public.yt_own_video_coverage
      where youtube_video_id = $1 and metric_set = $2 order by covered_from`, [c.v[i]!.yt, set])
    return r.map(x => `${x.de}..${x.ate}`)
  }
  const diasN = async (c: Cena, set: string): Promise<number> =>
    n(`select coalesce(sum(covered_to - covered_from + 1), 0) from public.yt_own_video_coverage where channel_id = $1 and metric_set = $2`, [c.canal, set])
  const diasVideo = async (c: Cena, i: number): Promise<number> =>
    n(`select count(*) from public.yt_own_video_coverage where youtube_video_id = $1 and metric_set like 'meta_%'`, [c.v[i]!.yt])
  const diarioMd5 = async (): Promise<string> =>
    md5(String((await q(`select coalesce(string_agg(to_jsonb(m)::text, '|' order by m.youtube_video_id, m.day_pt), '') as t from public.yt_own_video_meta_daily m`))[0]!.t))

  // ───────────────────────── os 16 testes ─────────────────────────
  it('1. aplica duas vezes sem erro e deixa o check de source com os quatro valores', async () => {
    await tx(async () => {
      await pg.query(SQL)
      const defs = await q(`select pg_get_constraintdef(k.oid) as d from pg_constraint k
        where k.conrelid = 'public.yt_own_video_coverage'::regclass and k.contype = 'c' and pg_get_constraintdef(k.oid) like '%analytics_api%'`)
      expect(defs).toHaveLength(1)
      for (const v of ['analytics_api', 'reporting_api', 'data_api', 'imagem']) expect(String(defs[0]!.d)).toContain(v)
      // o check de metric_set continua lá
      expect(await n(`select count(*) from pg_constraint k where k.conrelid = 'public.yt_own_video_coverage'::regclass and k.contype = 'c' and pg_get_constraintdef(k.oid) like '%meta_texto%'`)).toBe(1)
    })
  })

  it('2. tabela diária vazia do canal: não cobre nada e avisa (linhas 0, não "tudo certo")', async () => {
    await tx(async () => {
      const c = await cena(S1)
      const r = await cobrir(S1, c.canal, mais(DIA0, 5))
      expect(r).toMatchObject({ resultado: 'ok', texto: 0, thumb: 0, linhas: 0, descobertas: 0, sem_explicacao: 0, compactacao: 'indisponivel', compactadas: 0 })
      expect(await n(`select count(*) from public.yt_own_video_coverage where channel_id = $1 and metric_set like 'meta_%'`, [c.canal])).toBe(0)
    })
  })

  it('3. carga: dias cobertos = linhas com captura, por vídeo e conjunto (3 vídeos x 10 dias, sem privacidade no dia 0, sem dHash num dia, buraco de dois dias)', async () => {
    await tx(async () => {
      const c = await cena(S1, 3)
      for (let d = 0; d < 10; d++) {
        await meta(c, 0, mais(DIA0, d), { priv: d === 0 ? null : 'public' })
        await meta(c, 1, mais(DIA0, d), { priv: d === 0 ? null : 'public', dhash: d === 5 ? null : 'abcd' })
        if (d !== 4 && d !== 5) await meta(c, 2, mais(DIA0, d), { priv: d === 0 ? null : 'public' })
      }
      await pg.query(SQL) // a carga do arquivo cobre o que já existe
      expect(await intervalos(c, 0, 'meta_texto')).toEqual([`${mais(DIA0, 1)}..${mais(DIA0, 9)}`])
      expect(await intervalos(c, 1, 'meta_texto')).toEqual([`${mais(DIA0, 1)}..${mais(DIA0, 9)}`])
      expect(await intervalos(c, 2, 'meta_texto')).toEqual([`${mais(DIA0, 1)}..${mais(DIA0, 3)}`, `${mais(DIA0, 6)}..${mais(DIA0, 9)}`])
      expect(await intervalos(c, 0, 'meta_thumb')).toEqual([`${DIA0}..${mais(DIA0, 9)}`])
      expect(await intervalos(c, 1, 'meta_thumb')).toEqual([`${DIA0}..${mais(DIA0, 4)}`, `${mais(DIA0, 6)}..${mais(DIA0, 9)}`])
      expect(await intervalos(c, 2, 'meta_thumb')).toEqual([`${DIA0}..${mais(DIA0, 3)}`, `${mais(DIA0, 6)}..${mais(DIA0, 9)}`])
      // total: dias cobertos = linhas com a captura
      expect(await diasN(c, 'meta_texto')).toBe(await n(`select count(*) from public.yt_own_video_meta_daily where channel_id = $1 and privacy_status is not null`, [c.canal]))
      expect(await diasN(c, 'meta_thumb')).toBe(await n(`select count(*) from public.yt_own_video_meta_daily where channel_id = $1 and thumbnail_dhash is not null`, [c.canal]))
      const p = await prova(S1, c.canal, mais(DIA0, 9))
      expect(p).toMatchObject({ linhas: 28, descobertas: 0, sem_explicacao: 0 })
    }, { aplicar: false })
  })

  it('4. linha sem privacidade nunca entra em meta_texto; linha sem dHash nunca entra em meta_thumb (fronteira)', async () => {
    await tx(async () => {
      const c = await cena(S1)
      await meta(c, 0, DIA0, { priv: null, dhash: 'abcd' })
      await meta(c, 0, mais(DIA0, 1), { priv: 'private', dhash: null })
      const r = await cobrir(S1, c.canal, mais(DIA0, 1))
      expect(r).toMatchObject({ texto: 1, thumb: 1, linhas: 2, descobertas: 0 })
      expect(await intervalos(c, 0, 'meta_texto')).toEqual([`${mais(DIA0, 1)}..${mais(DIA0, 1)}`])
      expect(await intervalos(c, 0, 'meta_thumb')).toEqual([`${DIA0}..${DIA0}`])
    })
  })

  it('5. yt_own_meta_cover é idempotente: texto 0, thumb 0 e collected_at intacto', async () => {
    await tx(async () => {
      const c = await cena(S1)
      for (let d = 0; d < 3; d++) await meta(c, 0, mais(DIA0, d))
      const a = await cobrir(S1, c.canal, mais(DIA0, 2))
      expect(a).toMatchObject({ texto: 3, thumb: 3 })
      const antes = await q(`select metric_set, covered_from::text, collected_at::text from public.yt_own_video_coverage where channel_id = $1 and metric_set like 'meta_%' order by 1, 2`, [c.canal])
      const b = await cobrir(S1, c.canal, mais(DIA0, 2))
      expect(b).toMatchObject({ texto: 0, thumb: 0 })
      const depois = await q(`select metric_set, covered_from::text, collected_at::text from public.yt_own_video_coverage where channel_id = $1 and metric_set like 'meta_%' order by 1, 2`, [c.canal])
      expect(depois).toEqual(antes)
    })
  })

  it('6. cobre o que ficou para trás: três dias sem cobertura, uma chamada no terceiro cobre os três', async () => {
    await tx(async () => {
      const c = await cena(S1)
      for (let d = 0; d < 3; d++) await meta(c, 0, mais(DIA0, d))
      const r = await cobrir(S1, c.canal, mais(DIA0, 2))
      expect(r).toMatchObject({ texto: 3, thumb: 3 })
      expect(await intervalos(c, 0, 'meta_texto')).toEqual([`${DIA0}..${mais(DIA0, 2)}`])
    })
  })

  it('7. p_day limita: linha de dia posterior não é coberta', async () => {
    await tx(async () => {
      const c = await cena(S1)
      await meta(c, 0, DIA0)
      await meta(c, 0, mais(DIA0, 3))
      const r = await cobrir(S1, c.canal, mais(DIA0, 1))
      expect(r).toMatchObject({ texto: 1, thumb: 1, linhas: 1 })
      expect(await intervalos(c, 0, 'meta_texto')).toEqual([`${DIA0}..${DIA0}`])
    })
  })

  it('8. funde com o vizinho e não cria intervalo picado: [1,3] e [5,7] + dia 4 = [1,7], uma linha', async () => {
    await tx(async () => {
      const c = await cena(S1)
      await cob(c, 0, 'meta_texto', mais(DIA0, 1), mais(DIA0, 3))
      await cob(c, 0, 'meta_texto', mais(DIA0, 5), mais(DIA0, 7))
      await meta(c, 0, mais(DIA0, 4), { dhash: null })
      const r = await cobrir(S1, c.canal, mais(DIA0, 7))
      expect(r).toMatchObject({ texto: 1 })
      expect(await intervalos(c, 0, 'meta_texto')).toEqual([`${mais(DIA0, 1)}..${mais(DIA0, 7)}`])
    })
  })

  it('9. mutação de site: canal de outro site com p_site_id deste = canal_fora_do_site; sem a conferência o teste acusa', async () => {
    const chamarFora = async (): Promise<{ ok: true } | { ok: false; msg: string }> => {
      const c2 = await cena(S2)
      const r = await tenta('select public.yt_own_meta_cover($1::uuid, $2::uuid, $3::date, false) as r', [S1, c2.canal, DIA0])
      return r.ok ? { ok: true } : r
    }
    await tx(async () => {
      const r = await chamarFora()
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.msg).toContain('canal_fora_do_site')
    })
    const mutado = COVER.replace('where c.id = p_channel_id and c.site_id = p_site_id)', 'where c.id = p_channel_id)')
    expect(mutado).not.toBe(COVER)
    await tx(async () => {
      await pg.query(mutado)
      expect((await chamarFora()).ok).toBe(true) // o teste acima falharia: a conferência é o que o mantém
    })
  })

  it('10. mutação de canal: cobrir o canal A não cria cobertura de vídeo do canal B; sem o filtro de canal o teste acusa', async () => {
    const cenaDois = async (): Promise<{ a: Cena; b: Cena }> => {
      const a = await cena(S1); const b = await cena(S1)
      await meta(a, 0, DIA0); await meta(b, 0, DIA0)
      return { a, b }
    }
    await tx(async () => {
      const { a, b } = await cenaDois()
      await cobrir(S1, a.canal, DIA0)
      expect(await diasVideo(b, 0)).toBe(0)
      expect(await diasN(a, 'meta_texto')).toBe(1)
    })
    const alvo = 'where m.site_id = p_site_id and m.channel_id = p_channel_id and m.day_pt <= p_day\n      ) x'
    expect(COVER).toContain(alvo)
    const mutado = COVER.replace(alvo, 'where m.site_id = p_site_id and m.day_pt <= p_day\n      ) x')
    await tx(async () => {
      await pg.query(mutado)
      const { a, b } = await cenaDois()
      await cobrir(S1, a.canal, DIA0)
      expect(await diasVideo(b, 0)).toBeGreaterThan(0) // o teste acima falharia
    })
  })

  it('11. prova: descobertas sobe com linha capturada sem cobertura; não sobe sem captura; tabela vazia devolve linhas 0', async () => {
    await tx(async () => {
      const c = await cena(S1)
      expect(await prova(S1, c.canal, mais(DIA0, 5))).toMatchObject({ linhas: 0, descobertas: 0, sem_explicacao: 0 })
      await meta(c, 0, DIA0, { priv: 'public', dhash: null }) // texto capturado, sem cobertura
      expect(await prova(S1, c.canal, DIA0)).toMatchObject({ linhas: 1, descobertas: 1 })
      await meta(c, 0, mais(DIA0, 1), { priv: null, dhash: 'abcd' }) // thumb capturado, sem cobertura
      expect(await prova(S1, c.canal, mais(DIA0, 1))).toMatchObject({ linhas: 2, descobertas: 2 })
      const c2 = await cena(S1)
      await meta(c2, 0, DIA0, { priv: null, dhash: null }) // nada capturado
      expect(await prova(S1, c2.canal, DIA0)).toMatchObject({ linhas: 1, descobertas: 0 })
    })
  })

  it('12. prova: sem_explicacao sobe com dia coberto sem linha entre vizinhas diferentes e depois da última; não sobe entre idênticas nem sem cobertura', async () => {
    await tx(async () => {
      const dif = await cena(S1)
      await meta(dif, 0, DIA0, { title: 'A' }); await meta(dif, 0, mais(DIA0, 2), { title: 'B' })
      await cob(dif, 0, 'meta_texto', DIA0, mais(DIA0, 2))
      expect(await prova(S1, dif.canal, mais(DIA0, 2))).toMatchObject({ sem_explicacao: 1 })

      const dep = await cena(S1)
      await meta(dep, 0, DIA0); await cob(dep, 0, 'meta_texto', DIA0, mais(DIA0, 1))
      expect(await prova(S1, dep.canal, mais(DIA0, 1))).toMatchObject({ sem_explicacao: 1 })

      const igual = await cena(S1)
      await meta(igual, 0, DIA0); await meta(igual, 0, mais(DIA0, 2))
      await cob(igual, 0, 'meta_texto', DIA0, mais(DIA0, 2))
      expect(await prova(S1, igual.canal, mais(DIA0, 2))).toMatchObject({ sem_explicacao: 0 })

      const sem = await cena(S1)
      await meta(sem, 0, DIA0, { title: 'A' }); await meta(sem, 0, mais(DIA0, 2), { title: 'B' })
      expect(await prova(S1, sem.canal, mais(DIA0, 2))).toMatchObject({ sem_explicacao: 0 })
    })
  })

  it('13. compactação é indisponível e nenhuma linha sai, mesmo com p_compactar verdadeiro', async () => {
    await tx(async () => {
      const c = await cena(S1)
      for (let d = 0; d < 6; d++) await meta(c, 0, mais(DIA0, d))
      const antes = await n('select count(*) from public.yt_own_video_meta_daily where channel_id = $1', [c.canal])
      const r = await cobrir(S1, c.canal, mais(DIA0, 5), true)
      expect(r).toMatchObject({ compactacao: 'indisponivel', compactadas: 0 })
      expect(await n('select count(*) from public.yt_own_video_meta_daily where channel_id = $1', [c.canal])).toBe(antes)
    })
  })

  it('14. privilégios por catálogo: sem execute para anon e authenticated, com para service_role; search_path vazio', async () => {
    await tx(async () => {
      for (const f of ASSINATURAS) {
        expect((await q(`select has_function_privilege('anon', $1, 'execute') as p`, [f]))[0]!.p).toBe(false)
        expect((await q(`select has_function_privilege('authenticated', $1, 'execute') as p`, [f]))[0]!.p).toBe(false)
        expect((await q(`select has_function_privilege('service_role', $1, 'execute') as p`, [f]))[0]!.p).toBe(true)
        const cfg = (await q(`select proconfig from pg_proc where oid = $1::regprocedure`, [f]))[0]!.proconfig as string[] | null
        expect((cfg ?? []).some(x => x.startsWith('search_path=') && x.includes('""'))).toBe(true)
      }
    })
  })

  it('15. a tabela diária não muda: md5 de todas as linhas igual antes e depois do arquivo', async () => {
    await tx(async () => {
      const c = await cena(S1, 2)
      for (let d = 0; d < 4; d++) { await meta(c, 0, mais(DIA0, d)); await meta(c, 1, mais(DIA0, d), { priv: null }) }
      const antes = await diarioMd5()
      await pg.query(SQL)
      expect(await diarioMd5()).toBe(antes)
    }, { aplicar: false })
  })

  it('16. serie_coletada conta a cobertura de metadados, e a remoção do canal continua recusada', async () => {
    await tx(async () => {
      const c = await cena(S1)
      await meta(c, 0, DIA0)
      const impacto = async (): Promise<number> => {
        const r = await tenta('select public.youtube_channel_removal_impact($1::uuid, $2::uuid) as r', [S1, c.canal])
        if (!r.ok) throw new Error('youtube_channel_removal_impact falhou: ' + r.msg)
        return Number((r.rows[0]!.r as { serie_coletada?: number | string }).serie_coletada)
      }
      const semCobertura = await impacto()
      await cobrir(S1, c.canal, DIA0)
      expect(await diasN(c, 'meta_texto')).toBe(1)
      expect(await impacto()).toBeGreaterThan(semCobertura)
      const rem = await tenta('select public.youtube_channel_remove($1::uuid, $2::uuid, $3::text) as r', [S1, c.canal, c.slug])
      if (!rem.ok) throw new Error('youtube_channel_remove falhou: ' + rem.msg)
      expect((rem.rows[0]!.r as { status?: string }).status).toBe('serie_coletada')
    })
  })
})
