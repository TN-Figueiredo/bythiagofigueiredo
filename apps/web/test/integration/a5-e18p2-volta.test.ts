// @vitest-environment node
/**
 * A5 · E18 parte 2, Tarefa 7: os quatro roteiros da MG17 (desligar, religar, volta B, retirar um dia da cobertura), contra Postgres de verdade.
 * Banco: SÓ o `bythiago_int` (precisa da MG12 aplicada nele: `yt_own_versions_state` e `yt_own_video_versions`). Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/a5-e18p2-volta.test.ts --no-file-parallelism
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

const ROTEIROS = `${RAIZ}docs/ops/sql/`
const roteiro = (nome: string): string => readFileSync(`${ROTEIROS}${nome}`, 'utf8')
/** O que fica entre a linha da marca de início e a da marca de fim. */
const interior = (bloco: string): string => bloco.split('\n').slice(1, -1).map(l => l.trimEnd()).join('\n')

const D0 = '2026-02-18'
const mais = (dia: string, n: number): string => new Date(Date.parse(dia + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10)
const AGORA = '2026-03-10T15:00:00Z'
const ULTIMO = '2026-03-09' // D0 + 19 = o dia gravado ("ontem no Pacífico" de AGORA)

describe.skipIf(skipIfNoLocalDb())('A5 E18 P2, T7: os roteiros da MG17 (bythiago_int)', () => {
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
      // a marca que o fim da MG17 grava e o roteiro de religar exige (revisão N9, Phil I-2)
      await pg.query("comment on function public.yt_own_meta_linhas_do_meio(uuid, uuid, date) is 'MG17 aplicada em teste'")
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

  // ───────────────────────── os roteiros ─────────────────────────
  const DESLIGAR = (): string => roteiro('dieta-meta-desligar-compactacao.sql')
  const RELIGAR = (): string => roteiro('dieta-meta-religar-compactacao.sql')
  const VOLTA_B = (site: string): string => roteiro('dieta-meta-volta-b-recriar-da-cobertura.sql').replace(/<UUID_DO_SITE>/g, site)
  const RETIRAR = (site: string, video: string, conjunto: string, dia: string): string =>
    roteiro('dieta-meta-retirar-dia-da-cobertura.sql')
      .replace(/<UUID_DO_SITE>/g, site).replace(/<VIDEO>/g, video).replace(/<CONJUNTO>/g, conjunto).replace(/<DIA>/g, dia)
      // o roteiro do dono tem begin/commit; dentro da transação desfeita do teste o commit COMMITARIA tudo
      .replace(/^begin;$/m, '').replace(/^commit;$/m, '')
  const COVER17A = (): string => extrair(SQL17A, 'MG17a', 'yt_own_meta_cover')
  const comp = async (c: Cena, compactar: boolean, dia = ULTIMO): Promise<Json> =>
    (await q(`select public.yt_own_meta_cover($1::uuid, $2::uuid, $3::date, $4::boolean) as r`, [c.site, c.canal, dia, compactar]))[0]!.r as Json
  /** Cópia do diário por conteúdo (todas as colunas menos o instante da captura), ordenada. */
  const conteudo = async (c: Cena): Promise<string[]> =>
    (await q(`select (to_jsonb(m) - 'captured_at')::text as j from public.yt_own_video_meta_daily m where m.channel_id = $1 order by m.youtube_video_id, m.day_pt`, [c.canal])).map(x => String(x.j))

  it('0. os quatro arquivos existem e trazem "(você roda)" no topo; o de retirar e o de volta B nomeiam o que trocar', () => {
    for (const f of ['dieta-meta-desligar-compactacao.sql', 'dieta-meta-religar-compactacao.sql', 'dieta-meta-volta-b-recriar-da-cobertura.sql', 'dieta-meta-retirar-dia-da-cobertura.sql']) {
      expect(roteiro(f), f).toContain('(você roda)')
    }
    expect(roteiro('dieta-meta-volta-b-recriar-da-cobertura.sql')).toContain('<UUID_DO_SITE>')
    for (const p of ['<UUID_DO_SITE>', '<VIDEO>', '<CONJUNTO>', '<DIA>']) expect(roteiro('dieta-meta-retirar-dia-da-cobertura.sql')).toContain(p)
  })

  it('1. o roteiro de desligar é o corpo da MG17a, letra por letra, salvo o literal \'indisponivel\' trocado por \'desligada\' (que aparece uma vez só na resposta)', () => {
    const esperado = interior(COVER17A()).replace(/'indisponivel'/g, "'desligada'")
    expect(interior(extrair(DESLIGAR(), 'MG17a', 'yt_own_meta_cover'))).toBe(esperado)
    expect(DESLIGAR()).not.toContain('indisponivel')
    expect(DESLIGAR().match(/'compactacao', 'desligada'/g)).toHaveLength(1)
  })

  it('2. depois de desligar, p_compactar verdadeiro devolve desligada e nada sai', async () => {
    await tx(async () => {
      const c = await semear(S1)
      await pg.query(COVER_SQL) // o corpo novo da MG17 já estava ligado
      await pg.query(DESLIGAR())
      expect(await comp(c, true)).toMatchObject({ compactacao: 'desligada', compactadas: 0 })
      expect(await linhasDe(c)).toBe(118)
      // idempotente
      await pg.query(DESLIGAR())
      expect(await comp(c, true)).toMatchObject({ compactacao: 'desligada', compactadas: 0 })
    })
  })

  /** A semente depois da dieta (corpo novo + uma compactação), com o diário original guardado numa tabela temporária. */
  async function dietaFeita(): Promise<{ c: Cena; original: string[] }> {
    const c = await semear(S1)
    const original = await conteudo(c)
    await pg.query(COVER_SQL)
    expect(await comp(c, true)).toMatchObject({ compactacao: 'feita', compactadas: 79 })
    expect(await linhasDe(c)).toBe(39)
    return { c, original }
  }

  it('3. volta B devolve uma linha por dia apagado, idêntica à original em todas as colunas menos captured_at', async () => {
    await tx(async () => {
      const { c, original } = await dietaFeita()
      await pg.query(DESLIGAR())
      const resp = await pg.query(VOLTA_B(S1))
      expect(resp.rows).toEqual([{ linhas_recriadas: '79' }]) // o roteiro mostra o que fez
      expect(await linhasDe(c)).toBe(118)
      expect(await conteudo(c)).toEqual(original)
      // o instante da linha recriada é a hora nominal do cron (12:00 UTC do dia seguinte)
      const recriadas = await q(`select count(*)::int as n from public.yt_own_video_meta_daily where channel_id = $1 and captured_at = (day_pt + 1)::timestamp at time zone 'utc' + interval '12 hours'`, [c.canal])
      expect(Number(recriadas[0]!.n)).toBe(79)
    })
  })

  it('4. volta B roda duas vezes sem erro e não passa por cima de linha que existe', async () => {
    await tx(async () => {
      const { c } = await dietaFeita()
      await pg.query(DESLIGAR())
      await pg.query(VOLTA_B(S1))
      await pg.query(`update public.yt_own_video_meta_daily set title = 'EDITADA' where youtube_video_id = $1 and day_pt = $2`, [c.v[0]!.yt, mais(D0, 18)])
      const antes = await conteudo(c)
      await pg.query(VOLTA_B(S1))
      expect(await conteudo(c)).toEqual(antes)
      expect(await n(`select count(*) from public.yt_own_video_meta_daily where title = 'EDITADA'`)).toBe(1)
    })
  })

  it('5. volta B não recria dia sem cobertura (o buraco continua buraco) nem dia entre vizinhas diferentes', async () => {
    await tx(async () => {
      const { c } = await dietaFeita()
      await pg.query(DESLIGAR())
      // v2 (título A, B, A): tira a linha de início do bloco B (dia 8): os dias 8 a 10 ficam cobertos, sem linha, entre A (dia 7) e B (dia 11)
      await pg.query(`delete from public.yt_own_video_meta_daily where youtube_video_id = $1 and day_pt = $2`, [c.v[1]!.yt, mais(D0, 8)])
      await pg.query(VOLTA_B(S1))
      expect(await n(`select count(*) from public.yt_own_video_meta_daily where youtube_video_id = $1 and day_pt between $2 and $3`, [c.v[1]!.yt, mais(D0, 8), mais(D0, 10)])).toBe(0)
      // v6: o buraco real (dias 9 e 10) nunca foi coberto: continua buraco, mesmo entre vizinhas idênticas (dias 8 e 11 nem existem mais depois da dieta, e voltam)
      expect(await n(`select count(*) from public.yt_own_video_meta_daily where youtube_video_id = $1 and day_pt in ($2, $3)`, [c.v[5]!.yt, mais(D0, 9), mais(D0, 10)])).toBe(0)
      expect(await n(`select count(*) from public.yt_own_video_meta_daily where youtube_video_id = $1`, [c.v[5]!.yt])).toBe(18)
    })
  })

  it('6. volta B sem o roteiro de desligar aplicado: a execução seguinte da função reapaga (por isso a ordem)', async () => {
    await tx(async () => {
      const { c } = await dietaFeita()
      await pg.query(VOLTA_B(S1)) // sem DESLIGAR
      expect(await linhasDe(c)).toBe(118)
      expect(await comp(c, true)).toMatchObject({ compactacao: 'feita', compactadas: 79 })
      expect(await linhasDe(c)).toBe(39)
    })
  })

  it('7. mutação de site: o roteiro com o uuid de outro site não insere nada neste', async () => {
    await tx(async () => {
      const { c } = await dietaFeita()
      await pg.query(DESLIGAR())
      await pg.query(VOLTA_B(S2))
      expect(await linhasDe(c)).toBe(39)
      expect(await q(`select 1 from public.yt_own_video_meta_daily where site_id = $1 limit 1`, [S2])).toHaveLength(0)
    })
  })

  it.todo('8. depois da volta B, a derivação refeita dá as mesmas versões (pendente: depende do caso 1 da Tarefa 8, que precisa do passo de versões contra o banco; registrado no relatório)')

  it('9. o roteiro de religar é o corpo novo da MG17, letra por letra, seguido do revoke e do grant da migration', () => {
    expect(interior(extrair(RELIGAR(), 'MG17', 'yt_own_meta_cover'))).toBe(interior(COVER))
    expect(RELIGAR()).toContain('grant execute on function public.yt_own_meta_cover(uuid, uuid, date, boolean) to service_role;')
    expect(RELIGAR()).toContain('revoke all on function public.yt_own_meta_cover(uuid, uuid, date, boolean) from public, anon, authenticated;')
  })

  it('10. desligar, três dias de linhas novas, religar: p_compactar verdadeiro enxuga o acumulado de uma vez, sem_explicacao 0, privilégios por catálogo', async () => {
    await tx(async () => {
      const c = await cena(S1, 1)
      for (let d = 0; d < 20; d++) await meta(c, 0, d, { priv: d === 0 ? null : 'public' })
      await cobrir(c, ULTIMO); await estado(c, ULTIMO)
      await pg.query(COVER_SQL)
      await pg.query(DESLIGAR())
      expect(await comp(c, true)).toMatchObject({ compactacao: 'desligada' })
      for (let d = 20; d < 23; d++) await meta(c, 0, d)
      await cobrir(c, mais(D0, 22)); await estado(c, mais(D0, 22))
      expect(await linhasDe(c)).toBe(23)
      await pg.query(RELIGAR())
      expect(await comp(c, true, mais(D0, 22))).toMatchObject({ compactacao: 'feita', compactadas: 19, sem_explicacao: 0, descobertas: 0 })
      expect(await linhasDe(c)).toBe(4)
      const p = (await q(`select has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as auth,
        has_function_privilege('service_role', p.oid, 'execute') as srv from pg_proc p where p.proname = 'yt_own_meta_cover'`))[0]!
      expect(p).toEqual({ anon: false, auth: false, srv: true })
    })
  })

  it('11. religar num banco sem a função do critério (só a MG17a): o roteiro se recusa, e o corpo da MG17a continua', async () => {
    await pg.query('begin')
    try {
      await pg.query("set local lock_timeout = '5s'")
      await pg.query(SQL17A)
      const msg = await recusa(RELIGAR())
      expect(msg).toMatch(/religar recusado/)
      const corpo = await q(`select p.prosrc like '%yt_own_meta_linhas_do_meio%' as enxuga from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'yt_own_meta_cover'`)
      expect(corpo).toEqual([{ enxuga: false }])
    } finally {
      await pg.query('rollback')
    }
  })

  it('11b. a função do critério existe mas sem a marca (recusa deixou o critério para trás): religar recusa, corpo sem o enxugamento; com a marca, passa e responde enxuga true', async () => {
    await pg.query('begin')
    try {
      await pg.query("set local lock_timeout = '5s'")
      await pg.query(SQL17A)
      await pg.query(LINHAS_DO_MEIO) // só o bloco 1 da MG17, sem o do que grava a marca
      const msg = await recusa(RELIGAR())
      expect(msg).toMatch(/religar recusado/)
      const corpo = await q(`select p.prosrc like '%yt_own_meta_linhas_do_meio%' as enxuga from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'yt_own_meta_cover'`)
      expect(corpo).toEqual([{ enxuga: false }])
      await pg.query("comment on function public.yt_own_meta_linhas_do_meio(uuid, uuid, date) is 'MG17 aplicada em 2026-01-01T00:00:00Z'")
      const rs = await pg.query(RELIGAR())
      expect(Array.isArray(rs) ? rs.at(-1)!.rows : []).toEqual([{ enxuga: true }])
    } finally {
      await pg.query('rollback')
    }
  })

  describe('12. retirar um dia da cobertura', () => {
    interface Cob { video: string; de: string; ate: string }
    const intervalos = async (video: string, conjunto = 'meta_texto'): Promise<string[]> =>
      (await q(`select covered_from::text || '..' || covered_to::text as i from public.yt_own_video_coverage where youtube_video_id = $1 and metric_set = $2 order by covered_from`, [video, conjunto])).map(x => String(x.i))
    const somaDias = (video: string): Promise<number> =>
      n(`select coalesce(sum(covered_to - covered_from + 1), 0) from public.yt_own_video_coverage where youtube_video_id = $1 and metric_set = 'meta_texto'`, [video])
    const sobrepostos = (video: string): Promise<number> =>
      n(`select count(*) from public.yt_own_video_coverage a join public.yt_own_video_coverage b on a.youtube_video_id = b.youtube_video_id and a.metric_set = b.metric_set
         and a.covered_from < b.covered_from and b.covered_from <= a.covered_to where a.youtube_video_id = $1`, [video])
    async function cobrirIntervalo(c: Cena, i: number, de: string, ate: string): Promise<void> {
      await pg.query(`insert into public.yt_own_video_coverage (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id, source, collected_at)
        values ($1, 'meta_texto', $2, $3, $4, $5, $6, 'data_api', now())`, [c.v[i]!.yt, de, ate, c.site, c.v[i]!.id, c.canal])
    }

    it('as quatro posições (primeiro dia, último, meio, intervalo de um dia só): a soma dos dias cai exatamente 1 e nenhum intervalo se sobrepõe', async () => {
      await tx(async () => {
        const c = await cena(S1, 4)
        const a = mais(D0, 2), b = mais(D0, 8)
        await cobrirIntervalo(c, 0, a, b) // primeiro dia: retira `a`
        await cobrirIntervalo(c, 1, a, b) // último dia: retira `b`
        await cobrirIntervalo(c, 2, a, b) // meio: retira a + 3
        await cobrirIntervalo(c, 3, a, a) // intervalo de um dia só
        const casos: Array<[number, string, string[]]> = [
          [0, a, [`${mais(D0, 3)}..${b}`]],
          [1, b, [`${a}..${mais(D0, 7)}`]],
          [2, mais(D0, 5), [`${a}..${mais(D0, 4)}`, `${mais(D0, 6)}..${b}`]],
          [3, a, []],
        ]
        for (const [i, dia, esperado] of casos) {
          const antes = await somaDias(c.v[i]!.yt)
          await pg.query(RETIRAR(S1, c.v[i]!.yt, 'meta_texto', dia))
          expect(await somaDias(c.v[i]!.yt), `vídeo ${i}`).toBe(antes - 1)
          expect(await intervalos(c.v[i]!.yt), `vídeo ${i}`).toEqual(esperado)
          expect(await sobrepostos(c.v[i]!.yt)).toBe(0)
        }
      })
    })

    it('o sem_explicacao do canal cai exatamente 1 (dia coberto, sem linha, entre vizinhas diferentes)', async () => {
      await tx(async () => {
        const c = await cena(S1, 1)
        for (const d of [0, 1, 2]) await meta(c, 0, d, { title: 'A' })
        for (const d of [4, 5, 6]) await meta(c, 0, d, { title: 'B' })
        await cobrir(c, mais(D0, 6))
        await cobrirIntervalo(c, 0, mais(D0, 3), mais(D0, 3)) // o dia 3 coberto sem linha, entre A e B
        const prova = async (): Promise<number> => Number(((await q(`select public.yt_own_meta_prova($1::uuid, $2::uuid, $3::date) as p`, [c.site, c.canal, mais(D0, 6)]))[0]!.p as Json).sem_explicacao)
        expect(await prova()).toBe(1)
        await pg.query(RETIRAR(S1, c.v[0]!.yt, 'meta_texto', mais(D0, 3)))
        expect(await prova()).toBe(0)
      })
    })

    it('dia fora de qualquer intervalo: nada muda (dado ausente)', async () => {
      await tx(async () => {
        const c = await cena(S1, 1)
        await cobrirIntervalo(c, 0, mais(D0, 2), mais(D0, 4))
        await pg.query(RETIRAR(S1, c.v[0]!.yt, 'meta_texto', mais(D0, 9)))
        expect(await intervalos(c.v[0]!.yt)).toEqual([`${mais(D0, 2)}..${mais(D0, 4)}`])
      })
    })

    it('mutação de site: com o uuid de outro site nada muda neste', async () => {
      await tx(async () => {
        const c = await cena(S1, 1)
        await cobrirIntervalo(c, 0, mais(D0, 2), mais(D0, 8))
        await pg.query(RETIRAR(S2, c.v[0]!.yt, 'meta_texto', mais(D0, 5)))
        expect(await intervalos(c.v[0]!.yt)).toEqual([`${mais(D0, 2)}..${mais(D0, 8)}`])
      })
    })
  })
})
