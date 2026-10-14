// @vitest-environment node
/**
 * A5 · E6 (P4), MG16: soltar o backup do diário (`yt_own_video_daily_zeros_bkp`). O SQL do Apêndice B do plano, contra Postgres de verdade.
 * Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/a5-e6-p4-soltar-backup.test.ts --no-file-parallelism
 *
 * O SQL vem do ensaio (`.superpowers/sdd/a5-e6-p4/sql/mg16.sql`, fora do git) ou, se ele não existir, da migration
 * `*observatorio_a5_e6_p4_soltar_backup_do_diario*`. A função é criada DENTRO de cada transação desfeita (trecho entre as marcas
 * `-- >>> MG16 função` e `-- <<< MG16 função`); o bloco final (que chama com `now()`) só roda no caso do "arquivo inteiro", com backup vazio.
 * O backup, o diário, a cobertura e as execuções vivem só dentro de `begin; … rollback;`; só os sites persistem (apagados no `afterAll`).
 * O caso "lê o que a MG15 escreve de verdade" usa o SQL real da MG15 (ensaio `a5-e6-p3/sql/mg15.sql` ou a migration); se nenhum existir, FALHA.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { metricVersion } from '@/lib/youtube/coleta/metric-version'
import type { DiarioResumo } from '@/lib/youtube/coleta/diario-step'

vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url))

type Linha = Record<string, unknown>

function lerArquivo(ensaio: string, trechoMigration: string, faltando: string): string {
  if (existsSync(RAIZ + ensaio)) return readFileSync(RAIZ + ensaio, 'utf8')
  const dir = `${RAIZ}supabase/migrations/`
  const achado = readdirSync(dir).find(f => f.includes(trechoMigration))
  if (!achado) throw new Error(faltando)
  return readFileSync(dir + achado, 'utf8')
}
const lerMg16 = (): string => lerArquivo('.superpowers/sdd/a5-e6-p4/sql/mg16.sql', 'observatorio_a5_e6_p4_soltar_backup_do_diario', 'nem o arquivo de ensaio nem a migration existem (mg16.sql / observatorio_a5_e6_p4_soltar_backup_do_diario)')
const lerMg15 = (): string => lerArquivo('.superpowers/sdd/a5-e6-p3/sql/mg15.sql', 'observatorio_a5_e6_p3_apagar_linhas_vazias', 'falta o SQL da MG15')

function extrair(sql: string, prefixo: string, nome: string): string {
  const de = sql.indexOf(`-- >>> ${prefixo} ${nome} (início)`)
  const fim = sql.indexOf(`-- <<< ${prefixo} ${nome} (fim)`)
  if (de < 0 || fim < 0 || fim < de) throw new Error(`marca ${prefixo} ${nome} não achada no SQL`)
  const ate = sql.indexOf('\n', fim)
  return sql.slice(de, ate < 0 ? sql.length : ate)
}

/** O backup como o Apêndice A do plano P3 o cria (cópia fiel do trecho `MG15 backup`). */
const BACKUP_DDL = `
create table if not exists public.yt_own_video_daily_zeros_bkp (like public.yt_own_video_daily);
create unique index if not exists yt_own_video_daily_zeros_bkp_chave on public.yt_own_video_daily_zeros_bkp (youtube_video_id, day_pt);
alter table public.yt_own_video_daily_zeros_bkp enable row level security;
revoke all on table public.yt_own_video_daily_zeros_bkp from public, anon, authenticated, service_role;`

const AGORA = '2026-03-30T15:00:00Z'
const HOJE = '2026-03-30'
const DIA0 = '2026-01-01'
const COBERTO_ATE = '2026-03-29'
const mais = (dia: string, n: number): string => new Date(Date.parse(dia + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10)
const antes = (iso: string, ms: number): string => new Date(Date.parse(iso) - ms).toISOString()
const H = 3_600_000
const D = 86_400_000
const VAZIA = { views: 0, watch_time_minutes: 0, likes: 0, comments: 0, shares: 0, subscribers_gained: 0, subscribers_lost: 0 }

const BOM: DiarioResumo = {
  gravados: 12, tentativas: { ok: 36 }, pendentes: 0, ate: '2026-03-10', estendidas_recusadas: 0,
  apagadas: 0, intervalos: 35, estendidas_ausentes: 0, atrasados_antigos: 0, com_buraco: 0,
}

describe.skipIf(skipIfNoLocalDb())('A5 E6 P4, MG16: soltar o backup do diário (bythiago_int)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const sites: string[] = []
  let S1 = ''
  let S2 = ''
  let SQL = ''
  let FUNCAO = ''

  beforeAll(async () => {
    SQL = lerMg16()
    FUNCAO = extrair(SQL, 'MG16', 'função')
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

  const q = async (sql: string, params: unknown[] = []): Promise<Linha[]> => (await pg.query(sql, params)).rows as Linha[]
  const n = async (sql: string, params: unknown[] = []): Promise<number> => Number(Object.values((await q(sql, params))[0]!)[0])

  async function tx(fn: () => Promise<void>, o: { funcao?: string; backup?: boolean } = {}): Promise<void> {
    await pg.query('begin')
    try {
      await pg.query("set local lock_timeout = '5s'")
      if (o.backup !== false) await pg.query(BACKUP_DDL)
      await pg.query(o.funcao ?? FUNCAO)
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
  const chamar = (agora = AGORA) => tenta('select public.yt_own_daily_bkp_soltar($1::timestamptz) as r', [agora])
  async function solta(agora = AGORA): Promise<Linha> {
    const r = await chamar(agora)
    if (!r.ok) throw new Error('esperava soltar, recusou: ' + r.msg)
    return r.rows[0]!.r as Linha
  }
  async function recusa(trecho: string, agora = AGORA): Promise<void> {
    const antesN = await backupN()
    const r = await chamar(agora)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain(trecho)
    expect(await backupN()).toBe(antesN) // a tabela continua com as mesmas linhas
  }
  const backupN = (): Promise<number> => n('select count(*) from public.yt_own_video_daily_zeros_bkp')
  const tabelaExiste = async (): Promise<boolean> => (await q(`select to_regclass('public.yt_own_video_daily_zeros_bkp') is not null as e`))[0]!.e as boolean

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
  async function cob(c: Cena, i: number | null, yt: string | null, de: string, ate: string, coletada: string): Promise<void> {
    await pg.query(`insert into public.yt_own_video_coverage (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id, collected_at)
      values ($1, 'base', $2, $3, $4, $5, $6, $7)`, [yt ?? c.v[i!]!.yt, de, ate, c.site, i === null ? null : c.v[i]!.id, c.canal, coletada])
  }
  async function linha(c: Cena, i: number, dia: string, vals: Record<string, number | string | null>): Promise<void> {
    const cols = ['youtube_video_id', 'day_pt', 'site_id', 'video_id', 'channel_id', 'metric_version', ...Object.keys(vals)]
    const params: unknown[] = [c.v[i]!.yt, dia, c.site, c.v[i]!.id, c.canal, metricVersion(dia), ...Object.values(vals)]
    await pg.query(`insert into public.yt_own_video_daily (${cols.join(', ')}) values (${params.map((_, k) => '$' + (k + 1)).join(', ')})`, params)
  }
  const comentarioBackup = (mg15Em: string, json: unknown): Promise<unknown> =>
    pg.query(`comment on table public.yt_own_video_daily_zeros_bkp is '${`MG15 ${mg15Em} ${JSON.stringify(json)}`.replace(/'/g, "''")}'`)
  const marca = (dia = HOJE): Promise<unknown> => pg.query(`comment on table public.yt_own_video_daily is 'P4 armada em ${dia}'`)

  /**
   * Um vídeo, 40 dias: os 30 primeiros eram vazios (agora no backup e fora do diário), os 10 últimos têm atividade.
   * Cobertura base DIA0 até COBERTO_ATE gravada 3 horas antes de AGORA. Comentário e marca prontos, MG15 há 15 dias.
   */
  async function cenario(o: { site?: string; mg15Em?: string; json?: boolean; comentario?: boolean; marcar?: boolean } = {}): Promise<Cena> {
    const site = o.site ?? S1
    const c = await cena(site)
    await cob(c, 0, null, DIA0, COBERTO_ATE, antes(AGORA, 3 * H))
    for (let i = 0; i < 40; i++) {
      const dia = mais(DIA0, i)
      const extra = { source: i % 2 === 0 ? 'analytics_api' : 'reporting_api', collected_at: `2026-02-20T10:${String(i).padStart(2, '0')}:00Z` }
      await linha(c, 0, dia, i < 30 ? { ...VAZIA, ...extra } : { ...VAZIA, views: i - 29, likes: 1, ...extra })
    }
    // o que a MG15 faz: copia as 30 vazias para o backup e as tira do diário
    await pg.query(`insert into public.yt_own_video_daily_zeros_bkp select d.* from public.yt_own_video_daily d
      where d.site_id = $1 and d.views = 0 and coalesce(d.likes,0) = 0`, [site])
    await pg.query(`delete from public.yt_own_video_daily d where d.site_id = $1 and d.views = 0 and coalesce(d.likes,0) = 0`, [site])
    if (o.comentario !== false) await comentarioBackup(o.mg15Em ?? antes(AGORA, 15 * D), o.json === false ? [] : [{ site, estado: 'apagado', vazias: 30, apagadas: 30 }])
    if (o.marcar !== false) await marca()
    return c
  }

  it('1. tabela ausente: estado sem_tabela, nada muda (dado ausente)', async () => {
    await tx(async () => {
      const r = await solta()
      expect(r).toEqual({ estado: 'sem_tabela' })
    }, { backup: false })
  })

  it('2. backup vazio e sem comentário (CI, banco novo): solto_vazio, sem exigir marca nem prazo', async () => {
    await tx(async () => {
      expect(await solta()).toEqual({ estado: 'solto_vazio', linhas: 0 })
      expect(await tabelaExiste()).toBe(false)
    })
  })

  it('3. caminho feliz: solta, devolve linhas e bytes, e a tabela não existe mais', async () => {
    await tx(async () => {
      await cenario()
      const r = await solta()
      expect(r).toMatchObject({ estado: 'solto', linhas: 30, sites: 1, orfas: 0 })
      expect(Number(r.bytes)).toBeGreaterThan(0)
      expect(await tabelaExiste()).toBe(false)
    })
  })

  describe('4. recusas, uma por teste, e a tabela continua com as mesmas linhas', () => {
    it('13 dias e 23 horas recusa; 14 dias exatos passa (fronteira)', async () => {
      await tx(async () => {
        await cenario({ mg15Em: antes(AGORA, 13 * D + 23 * H) })
        await recusa('a MG15 foi aplicada em')
        await comentarioBackup(antes(AGORA, 14 * D), [{ site: S1, estado: 'apagado', vazias: 30, apagadas: 30 }])
        expect((await solta()).estado).toBe('solto')
      })
    })
    it('sem a marca', async () => { await tx(async () => { await cenario({ marcar: false }); await recusa('o CSV não foi conferido hoje') }) })
    it('marca de ontem', async () => {
      await tx(async () => { await cenario(); await marca(mais(HOJE, -1)); await recusa('o CSV não foi conferido hoje') })
    })
    it('comentário nulo com linhas', async () => { await tx(async () => { await cenario({ comentario: false }); await recusa('não é o que a MG15 anota') }) })
    it('comentário de outro formato', async () => {
      await tx(async () => { await cenario(); await pg.query(`comment on table public.yt_own_video_daily_zeros_bkp is 'feito à mão'`); await recusa('não é o que a MG15 anota') })
    })
    it('instante ilegível', async () => {
      await tx(async () => { await cenario({ mg15Em: 'ontemzinho' }); await recusa('não consegui ler o instante') })
    })
    it('linhas diferentes de apagadas', async () => {
      await tx(async () => {
        await cenario()
        await comentarioBackup(antes(AGORA, 15 * D), [{ site: S1, estado: 'apagado', vazias: 30, apagadas: 29 }])
        await recusa('Estado desconhecido')
      })
    })
    it('função que cita o backup', async () => {
      await tx(async () => {
        await cenario()
        await pg.query(`create function public.yt_teste_cita_backup() returns bigint language sql as $$ select count(*) from public.yt_own_video_daily_zeros_bkp $$`)
        await recusa('ainda há função que cita o backup')
      })
    })
    it('visão que cita o backup', async () => {
      await tx(async () => {
        await cenario()
        await pg.query(`create view public.yt_teste_cita_backup_v as select youtube_video_id from public.yt_own_video_daily_zeros_bkp`)
        await recusa('ainda há visão que cita o backup')
      })
    })
    it('dia do backup fora da cobertura base e sem linha no diário', async () => {
      await tx(async () => {
        await cenario()
        await pg.query(`update public.yt_own_video_coverage set covered_from = $1 where site_id = $2`, [mais(DIA0, 5), S1])
        await recusa('que a cobertura não recria')
      })
    })
    it('diário com mais linhas vazias do que a MG15 deixou', async () => {
      await tx(async () => {
        const c = await cenario()
        await linha(c, 0, mais(DIA0, 3), { ...VAZIA, source: 'analytics_api', collected_at: '2026-03-01T10:00:00Z' })
        await recusa('o diário voltou a ter linhas vazias')
      })
    })
    it('cobertura base gravada há 37 horas', async () => {
      await tx(async () => {
        await cenario()
        await pg.query(`update public.yt_own_video_coverage set collected_at = $1::timestamptz where site_id = $2`, [antes(AGORA, 37 * H), S1])
        await recusa('não foi gravada nas últimas 36 horas')
      })
    })
    it('cobertura base parada (covered_to de 6 dias atrás)', async () => {
      await tx(async () => {
        await cenario()
        await pg.query(`update public.yt_own_video_coverage set covered_to = $1 where site_id = $2`, [mais(HOJE, -6), S1])
        await recusa('não foi gravada nas últimas 36 horas')
      })
    })
  })

  it('5. dia do backup fora da cobertura mas que voltou a ter linha no diário: não recusa', async () => {
    await tx(async () => {
      const c = await cenario()
      await pg.query(`update public.yt_own_video_coverage set covered_from = $1 where site_id = $2`, [mais(DIA0, 5), S1])
      for (let i = 0; i < 5; i++) await linha(c, 0, mais(DIA0, i), { ...VAZIA, views: 3, source: 'analytics_api', collected_at: '2026-03-01T10:00:00Z' })
      expect((await solta()).estado).toBe('solto')
    })
  })

  it('6. site do backup já apagado: linhas órfãs contadas e soltas', async () => {
    await tx(async () => {
      await cenario()
      const orfao = randomUUID()
      await pg.query(`insert into public.yt_own_video_daily_zeros_bkp (youtube_video_id, day_pt, site_id, channel_id, views, metric_version, source, collected_at)
        values ('yorfao00001', '2026-01-02', $1, $2, 0, $3, 'analytics_api', '2026-02-20T10:00:00Z')`, [orfao, randomUUID(), metricVersion('2026-01-02')])
      await comentarioBackup(antes(AGORA, 15 * D), [
        { site: S1, estado: 'apagado', vazias: 30, apagadas: 30 }, { site: orfao, estado: 'apagado', vazias: 1, apagadas: 1 }])
      const r = await solta()
      expect(r).toMatchObject({ estado: 'solto', linhas: 31, sites: 1, orfas: 1 })
    })
  })

  it('7. mutação de site: dois sites no backup, o segundo com dia fora da cobertura dele: recusa; sem o filtro de site a cobertura do site A "cobriria" o do B', async () => {
    const montar = async (): Promise<void> => {
      const a = await cenario()
      const b = await cena(S2)
      // o site B tem cobertura recente (para a guarda das 36 horas passar), mas de OUTRO vídeo; o dia do backup dele, de um vídeo com o MESMO id do site A, não está coberto
      await cob(b, 0, null, DIA0, COBERTO_ATE, antes(AGORA, 3 * H))
      await pg.query(`insert into public.yt_own_video_daily_zeros_bkp (youtube_video_id, day_pt, site_id, channel_id, views, metric_version, source, collected_at)
        values ($1, '2026-02-15', $2, $3, 0, $4, 'analytics_api', '2026-02-20T10:00:00Z')`, [a.v[0]!.yt, S2, b.canal, metricVersion('2026-02-15')])
      await comentarioBackup(antes(AGORA, 15 * D), [
        { site: S1, estado: 'apagado', vazias: 30, apagadas: 30 }, { site: S2, estado: 'apagado', vazias: 1, apagadas: 1 }])
    }
    await tx(async () => { await montar(); await recusa('que a cobertura não recria') })
    const alvo = 'c.site_id = b.site_id and c.youtube_video_id = b.youtube_video_id'
    expect(FUNCAO).toContain(alvo)
    const mutada = FUNCAO.replace(alvo, 'c.youtube_video_id = b.youtube_video_id')
    await tx(async () => { await montar(); expect((await solta()).estado).toBe('solto') /* o teste acima falharia */ }, { funcao: mutada })
  })

  it('8. o arquivo inteiro, duas vezes: na segunda a tabela não existe e nada falha; a função auxiliar não sobra', async () => {
    await tx(async () => {
      await pg.query(SQL)
      expect(await tabelaExiste()).toBe(false)
      await pg.query(SQL)
      expect(await tabelaExiste()).toBe(false)
      expect(await n(`select count(*) from pg_proc where proname = 'yt_own_daily_bkp_soltar'`)).toBe(0)
    }, { funcao: 'select 1' })
  })

  it('9. as voltas depois do drop: B devolve um zero por dia do backup; C devolve as linhas originais; a A1 fecha com a de antes', async () => {
    const voltaB = readFileSync(RAIZ + 'docs/ops/sql/dieta-diario-volta-b-recriar-da-cobertura.sql', 'utf8')
    const voltaA = readFileSync(RAIZ + 'docs/ops/sql/dieta-diario-volta-a-restaurar-do-backup.sql', 'utf8')
    const a1 = (): Promise<Linha[]> => q(`select count(*) as t, coalesce(sum(views),0) as v, coalesce(sum(likes),0) as l, count(*) filter (where views = 0) as zeros from public.yt_own_video_daily where site_id = $1`, [S1])
    await tx(async () => {
      // diário COMPLETO primeiro (40 dias), a A1 de antes da P3, e só então o que a MG15 faria
      const c = await cena(S1)
      await cob(c, 0, null, DIA0, COBERTO_ATE, antes(AGORA, 3 * H))
      for (let i = 0; i < 40; i++) {
        await linha(c, 0, mais(DIA0, i), i < 30 ? { ...VAZIA, source: 'analytics_api', collected_at: `2026-02-20T10:${String(i).padStart(2, '0')}:00Z` } : { ...VAZIA, views: i - 29, likes: 1, source: 'analytics_api', collected_at: `2026-02-20T10:${String(i).padStart(2, '0')}:00Z` })
      }
      const a1Antes = await a1()
      await pg.query(`insert into public.yt_own_video_daily_zeros_bkp select d.* from public.yt_own_video_daily d where d.site_id = $1 and d.views = 0`, [S1])
      await pg.query(`delete from public.yt_own_video_daily where site_id = $1 and views = 0`, [S1])
      await comentarioBackup(antes(AGORA, 15 * D), [{ site: S1, estado: 'apagado', vazias: 30, apagadas: 30 }])
      await marca()
      // o que o dono guarda antes do drop (aqui: uma tabela temporária que faz as vezes do CSV do backup)
      await pg.query(`create temp table bkp_guardado on commit drop as select * from public.yt_own_video_daily_zeros_bkp`)
      const diasGuardados = (await q(`select youtube_video_id, day_pt::text as dia from bkp_guardado order by 1, 2`))
      expect(diasGuardados).toHaveLength(30)
      expect((await solta()).estado).toBe('solto')
      expect(await tabelaExiste()).toBe(false)
      expect(await n('select count(*) from public.yt_own_video_daily where site_id = $1', [S1])).toBe(10)

      // volta B: um zero (views 0, dia medido) para cada dia do backup
      await pg.query(voltaB.replace(/<UUID_DO_SITE>/g, S1))
      // a B recria um zero para TODO dia coberto sem linha (inclusive os que nunca tiveram linha); os 30 do backup estão entre eles
      const zeros = await q(`select youtube_video_id, day_pt::text as dia from public.yt_own_video_daily where site_id = $1 and views = 0 order by 1, 2`, [S1])
      const conjunto = new Set(zeros.map(z => `${z.youtube_video_id}|${z.dia}`))
      for (const g of diasGuardados) expect(conjunto.has(`${g.youtube_video_id}|${g.dia}`), `${g.dia}`).toBe(true)
      expect(zeros).toHaveLength(78) // 88 dias cobertos (01/01 a 29/03) menos os 10 com atividade
      // roda duas vezes sem erro e sem duplicar
      await pg.query(voltaB.replace(/<UUID_DO_SITE>/g, S1))
      expect(await n('select count(*) from public.yt_own_video_daily where site_id = $1', [S1])).toBe(88)

      // volta C: tira o que a B recriou e devolve as linhas ORIGINAIS a partir do que se guardou (a mesma inserção da volta A, contra a tabela guardada)
      await pg.query(`delete from public.yt_own_video_daily where site_id = $1 and views = 0`, [S1])
      await pg.query(voltaA.replace(/public\.yt_own_video_daily_zeros_bkp/g, 'bkp_guardado'))
      const originais = await q(`select to_jsonb(t)::text as j from bkp_guardado t order by youtube_video_id, day_pt`)
      const devolvidas = await q(`select to_jsonb(d)::text as j from public.yt_own_video_daily d join bkp_guardado b on b.youtube_video_id = d.youtube_video_id and b.day_pt = d.day_pt order by d.youtube_video_id, d.day_pt`)
      expect(devolvidas).toEqual(originais)
      expect(await a1()).toEqual(a1Antes)
    })
  })

  it('10. serie_coletada não muda com o drop (o backup nunca contou)', async () => {
    await tx(async () => {
      const c = await cenario()
      const impacto = async (): Promise<number> => {
        const r = await tenta('select public.youtube_channel_removal_impact($1::uuid, $2::uuid) as r', [S1, c.canal])
        if (!r.ok) throw new Error('youtube_channel_removal_impact falhou: ' + r.msg)
        return Number((r.rows[0]!.r as { serie_coletada?: number | string }).serie_coletada)
      }
      const com = await impacto()
      expect((await solta()).estado).toBe('solto')
      expect(await impacto()).toBe(com)
      expect(com).toBeGreaterThan(0)
    })
  })

  it('11. lê o que a MG15 escreve de verdade: o comentário e o backup produzidos pelo SQL real da MG15 são aceitos pela MG16', async () => {
    const mg15 = lerMg15()
    const backup15 = extrair(mg15, 'MG15', 'backup')
    const funcoes15 = extrair(mg15, 'MG15', 'funções')
    const T15 = '2026-03-10T15:00:00Z'
    await pg.query('begin')
    try {
      await pg.query("set local lock_timeout = '5s'")
      await pg.query(backup15)
      await pg.query(funcoes15)
      await pg.query(FUNCAO)
      const c = await cena(S1)
      await cob(c, 0, null, DIA0, '2026-03-09', antes(T15, 3 * H))
      for (let i = 0; i < 40; i++) {
        const dia = mais(DIA0, i)
        const extra = { source: i % 2 === 0 ? 'analytics_api' : 'reporting_api', collected_at: `2026-02-20T10:${String(i).padStart(2, '0')}:00Z` }
        await linha(c, 0, dia, i < 30 ? { ...VAZIA, ...extra } : { ...VAZIA, views: i - 29, avg_view_duration_seconds: 30, avg_view_percentage: 50, ...extra })
      }
      await pg.query(`delete from public.yt_own_collection_runs where ran_at > $1::timestamptz - interval '10 days' and ran_at <= $1::timestamptz`, [T15])
      for (const k of [51, 27, 3]) {
        await pg.query(`insert into public.yt_own_collection_runs (ran_at, ms_total, ms_existente, falhas, resumo) values ($1, 1, 1, '{}'::text[], $2::jsonb)`,
          [antes(T15, k * H), JSON.stringify({ diario: BOM })])
      }
      await pg.query(`comment on table public.yt_own_video_daily is 'P3 armada em 2026-03-10'`)
      const r = await q(`select public.yt_own_daily_diet_p3($1::uuid, $2::timestamptz) as r`, [S1, T15])
      const resp = r[0]!.r as { apagadas: number }
      expect(resp.apagadas).toBe(30)
      // o comentário, exatamente como o bloco final da MG15 o monta
      await pg.query(`select 1`) // (o bloco final usa now(); aqui o instante é T15)
      const tudo = JSON.stringify([resp])
      await pg.query(`comment on table public.yt_own_video_daily_zeros_bkp is '${`MG15 2026-03-10T15:00:00Z ${tudo}`.replace(/'/g, "''")}'`)
      // o bloco final da MG15 apaga as funções; sem isso a MG16 recusa (e é o que ela deve fazer)
      await pg.query('drop function public.yt_own_daily_diet_p3(uuid, timestamptz)')
      await pg.query('drop function public.yt_own_daily_diet_p3_contas(uuid)')
      await pg.query('drop function public.yt_own_daily_linha_vazia(public.yt_own_video_daily)')
      // 20 dias depois: cobertura fresca, marca de hoje
      await pg.query(`update public.yt_own_video_coverage set covered_to = $1, collected_at = $2::timestamptz where site_id = $3`, [COBERTO_ATE, antes(AGORA, 3 * H), S1])
      await marca()
      const fim = await solta()
      expect(fim).toMatchObject({ estado: 'solto', linhas: 30, sites: 1 })
    } finally {
      await pg.query('rollback')
    }
  })
})
