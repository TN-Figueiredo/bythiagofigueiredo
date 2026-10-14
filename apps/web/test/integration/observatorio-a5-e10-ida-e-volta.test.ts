// @vitest-environment node
/**
 * A5 · E10 (Tarefa 6): a ida e a volta do export contra Postgres de verdade. Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e10-ida-e-volta.test.ts --no-file-parallelism
 *
 * A MG6 não está aplicada de vez: cada teste abre uma transação, aplica o ensaio (`garantirMg6`), semeia o SEU site e termina em
 * `rollback`. O export e a conferência falam com o banco por um `ClienteSql` que EXECUTA tudo menos `begin`/`commit`/`rollback`
 * (a transação externa é do teste); o resto (cursor, `set local`, `format_type`, o registro) roda de verdade. Disco: pasta
 * temporária do sistema. Miniaturas: um `baixar` falso.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { mkdtemp, rm, mkdir, writeFile, readFile, unlink, access, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { emTransacao, semearCena, pausarEEnvelhecer, q1, escalar, tenta, type Cena } from '../helpers/mg6'
import { exportarCanal, type Disco, type ResultadoExport } from '@/lib/youtube/observatorio/arquivo/exportar'
import { conferirLote } from '@/lib/youtube/observatorio/arquivo/conferir'
import { lerCsv } from '@/lib/youtube/observatorio/arquivo/csv'
import { lerRegistro, type ClienteSql } from '@/lib/youtube/observatorio/arquivo/sessao'
import { validarManifesto, type Manifesto } from '@/lib/youtube/observatorio/arquivo/manifesto'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const LOTE = 'canal-teste-ida-e-volta'

/** Executa tudo, menos o controle de transação: a transação externa (MG6 + semente) é do teste e termina em rollback. */
function clienteDoTeste(pg: Client): ClienteSql {
  return {
    async query(texto, valores) {
      if (/^\s*(begin|commit|rollback)\b/i.test(texto)) return { rows: [] }
      const r = await pg.query(texto, valores)
      return { rows: r.rows as Array<Record<string, unknown>> }
    },
  }
}

function discoReal(): Disco {
  const existe = async (p: string): Promise<boolean> => access(p).then(() => true, () => false)
  const listarDe = async (base: string, rel: string): Promise<string[]> => {
    const out: string[] = []
    for (const e of await readdir(join(base, rel), { withFileTypes: true }).catch(() => [])) {
      const r = rel === '' ? e.name : `${rel}/${e.name}`
      if (e.isDirectory()) out.push(...(await listarDe(base, r)))
      else out.push(r)
    }
    return out
  }
  return {
    existe,
    listar: p => listarDe(p, ''),
    criarPasta: async (p, modo) => { await mkdir(p, { recursive: true, mode: modo }) },
    gravar: async (p, d) => { await writeFile(p, d) },
    ler: async p => new Uint8Array(await readFile(p)),
    apagar: async p => { await unlink(p).catch(() => undefined) },
    dentroDeRepositorio: async p => {
      let atual = dirname(p)
      for (let i = 0; i < 40; i++) {
        if (await existe(join(atual, '.git'))) return true
        const pai = dirname(atual)
        if (pai === atual) break
        atual = pai
      }
      return false
    },
  }
}

describe.skipIf(skipIfNoLocalDb())('A5 E10 Tarefa 6: ida e volta do export (banco local, ensaio dentro de transação desfeita)', () => {
  let pg: Client
  const pastas: string[] = []

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
  })
  afterAll(async () => {
    try { await pg.query('rollback') } catch { /* nada aberto */ }
    await pg.end()
    for (const p of pastas) await rm(p, { recursive: true, force: true })
  })

  /** Linhas com o que costuma estragar um CSV: vírgula, aspas, quebra de linha, vazio e nulo na mesma coluna, unicode, arrays, jsonb, instante com microssegundos, bigint acima de 2^53. */
  async function semearCasosDificeis(c: Cena): Promise<void> {
    await pg.query(
      `insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at, tags, view_count, discovered_at) values
         ($1, 'dificil1', 'vírgula, "aspas" e
quebra de linha', now() - interval '3 days', '{a,"b,c","d e",""}', 9007199254740993, now() - interval '3 days'),
         ($1, 'dificil2', '', now() - interval '4 days', '{}', 1, now() - interval '4 days'),
         ($1, 'dificil3', null, now() - interval '5 days', null, null, now() - interval '5 days'),
         ($1, 'dificil4', 'ação, ñ, 中文, 🎬', now() - interval '6 days', '{x}', 2, now() - interval '6 days')`, [c.canalA])
    await pg.query(
      `insert into public.competitor_raw (site_id, competitor_channel_id, raw_sha256, first_seen_at, last_seen_at, raw)
       values ($1, $2, 'h', '2026-09-01 10:00:00.123456+00', now(), $3::jsonb)`,
      [c.site, c.canalA, JSON.stringify({ a: 'x,y "z"', b: [1, 2.50, { c: null }], u: 'ação 中文', n: 1e-5, v: 9007199254740993 })])
    // 168 horas por vetor (a restrição da tabela); os primeiros valores não têm representação decimal curta
    await pg.query(
      `insert into public.competitor_channel_hour_map (competitor_channel_id, month, format, phase, site_id, views_sum, likes_sum, comments_sum, views_share, likes_share, comments_share, n_intervals)
       values ($1, date_trunc('month', now() - interval '40 days')::date, 'longo', 'depois', $2,
         array[9007199254740993::bigint] || array_fill(1::bigint, array[167]), array_fill(2, array[168]), array_fill(3, array[168]),
         array[0.1::real, 0.30000001::real, 1e-05::real] || array_fill(0.5::real, array[165]), array_fill(0.25::real, array[168]), array_fill(0.125::real, array[168]), array_fill(1, array[168]))`,
      [c.canalA, c.site])
    await pg.query(
      `insert into public.competitor_video_hourly (video_id, hour_slot, taken_at, site_id, views)
       values ($1, date_trunc('hour', now()) - interval '2 hours', now() - interval '110 minutes' + interval '0.123456 seconds', $2, 100)`, [c.videoA, c.site])
  }

  async function exportar(c: Cena, raiz: string, extra: { refazer?: boolean; baixar?: (u: string) => Promise<{ status: number; corpo: Uint8Array | null }> } = {}): Promise<ResultadoExport> {
    return exportarCanal({
      sql: clienteDoTeste(pg), disco: discoReal(), baixar: extra.baixar ?? (async u => ({ status: 200, corpo: new Uint8Array(Buffer.from('img:' + u)) })),
      pastaRaiz: raiz, lote: LOTE, siteId: c.site, canalId: c.canalA, aceitarMiniaturasAusentes: false, refazer: extra.refazer ?? false, porIdade: false,
      agora: () => new Date(), versaoDoScript: 'teste-integracao',
    })
  }
  const conferir = (c: Cena, raiz: string) => conferirLote({ sql: clienteDoTeste(pg), disco: discoReal(), pastaRaiz: raiz, lote: LOTE, siteId: c.site, canalId: c.canalA })
  async function pastaTemporaria(): Promise<string> {
    const p = await mkdtemp(join(tmpdir(), 'obs-arquivo-teste-'))
    pastas.push(p)
    return p
  }
  async function manifestoDe(raiz: string): Promise<Manifesto> {
    const v = validarManifesto(JSON.parse(await readFile(join(raiz, LOTE, 'manifesto.json'), 'utf8')))
    if (!('valor' in v)) throw new Error(v.porque)
    return v.valor
  }

  it('ida e volta: cada arquivo recarregado numa tabela temporária é igual ao original, nos dois sentidos', async () => {
    await emTransacao(pg, async () => {
      const c = await semearCena(pg)
      await semearCasosDificeis(c)
      await pausarEEnvelhecer(pg, c, c.canalA)
      const raiz = await pastaTemporaria()
      const r = await exportar(c, raiz)
      expect(r, JSON.stringify(r)).toMatchObject({ ok: true })
      const m = await manifestoDe(raiz)
      expect(m.arquivos.length).toBeGreaterThan(8)
      const registro = await lerRegistro(clienteDoTeste(pg))
      let comparadas = 0
      for (const a of m.arquivos) {
        const e = registro.find(x => x.tabela === a.tabela)!
        const { colunas, linhas } = lerCsv(gunzipSync(await readFile(join(raiz, LOTE, a.caminho))).toString('utf8'))
        expect(linhas).toHaveLength(a.linhas)
        await pg.query('drop table if exists pg_temp.recarga')
        await pg.query(`create temp table recarga (like public."${a.tabela}")`)
        const tipos = new Map(a.colunas.map(x => [x.nome, x.tipo]))
        const lista = colunas.map(n => `"${n}"`).join(', ')
        const valores = colunas.map((n, i) => `$${i + 1}::${tipos.get(n)!}`).join(', ')
        for (const l of linhas) await pg.query(`insert into pg_temp.recarga (${lista}) values (${valores})`, l)
        const onde = e.periodo === null ? e.filtro : `${e.filtro} and date_trunc('month', (${e.periodo})::timestamp)::date = $2::date`
        const parametros = e.periodo === null ? [c.canalA] : [c.canalA, a.periodStart]
        const sentido1 = await escalar<number>(pg, `select count(*)::int from (select * from public."${a.tabela}" t where ${onde} except select * from pg_temp.recarga) x`, parametros.slice(0, e.periodo === null ? 1 : 2))
        const sentido2 = await escalar<number>(pg, `select count(*)::int from (select * from pg_temp.recarga except select * from public."${a.tabela}" t where ${onde}) x`, parametros)
        expect([a.tabela, a.periodo, sentido1, sentido2]).toEqual([a.tabela, a.periodo, 0, 0])
        comparadas++
      }
      expect(comparadas).toBe(m.arquivos.length)
      // (revisão Phil 14/10, I-1) o laço acima só vê o que o manifesto gerou: com o filtro de uma tabela quebrado não nasce arquivo e ele passa
      // vazio. Toda tabela do registro que a semente cobre TEM de ter arquivo (as da MG4 e da MG18 ainda não existem e não têm semente).
      const semSemente = ['competitor_video_marks', 'competitor_video_mark_misses', 'competitor_missing_baseline']
      const comArquivo = new Set(m.arquivos.map(x => x.tabela))
      for (const e of registro) if (!semSemente.includes(e.tabela)) expect(comArquivo.has(e.tabela), `a tabela ${e.tabela} foi semeada e tem de ter arquivo no manifesto`).toBe(true)
      // o vazio e o nulo sobreviveram na mesma coluna, e o bigint acima de 2^53 saiu inteiro
      const v = m.arquivos.find(a => a.tabela === 'competitor_videos')!
      const csv = lerCsv(gunzipSync(await readFile(join(raiz, LOTE, v.caminho))).toString('utf8'))
      const iTitulo = csv.colunas.indexOf('title')
      const iView = csv.colunas.indexOf('view_count')
      const titulos = csv.linhas.map(l => l[iTitulo])
      expect(titulos).toContain('')
      expect(titulos).toContain(null)
      expect(titulos).toContain('vírgula, "aspas" e\nquebra de linha')
      expect(csv.linhas.map(l => l[iView])).toContain('9007199254740993')
    })
  })

  it('conferir marca o lote; trocar um byte de um CSV faz conferir parar e não marca', async () => {
    await emTransacao(pg, async () => {
      const c = await semearCena(pg)
      await pausarEEnvelhecer(pg, c, c.canalA)
      const raiz = await pastaTemporaria()
      expect(await exportar(c, raiz)).toMatchObject({ ok: true })
      const m = await manifestoDe(raiz)
      const marcados = (): Promise<number> => escalar<number>(pg, `select count(verified_at)::int from public.obs_archive_batches where channel_ref = $1`, [c.canalA])
      expect(await marcados()).toBe(0)
      // um byte trocado
      const alvo = join(raiz, LOTE, m.arquivos[1]!.caminho)
      const original = await readFile(alvo)
      const trocado = Buffer.from(original)
      trocado[trocado.length - 2] = trocado[trocado.length - 2]! ^ 0xff
      await writeFile(alvo, trocado)
      const ruim = await conferir(c, raiz)
      expect(ruim).toMatchObject({ ok: false, codigo: 'sha256_diferente' })
      expect(await marcados()).toBe(0)
      // desfeito, tudo certo, e então marca todos os arquivos
      await writeFile(alvo, original)
      const bom = await conferir(c, raiz)
      expect(bom, JSON.stringify(bom)).toMatchObject({ ok: true, arquivos: m.arquivos.length })
      expect(await marcados()).toBe(m.arquivos.length)
    })
  })

  it('o banco mudou depois do export: conferir recusa com a tabela e o mês e não marca', async () => {
    await emTransacao(pg, async () => {
      const c = await semearCena(pg)
      await pausarEEnvelhecer(pg, c, c.canalA)
      const raiz = await pastaTemporaria()
      expect(await exportar(c, raiz)).toMatchObject({ ok: true })
      await pg.query(`insert into public.competitor_video_daily (video_id, snap_date, views, taken_at) values ($1, current_date - 1, 1, now())  on conflict do nothing`, [c.videoA])
      await pg.query(`update public.competitor_video_daily set views = views + 1 where video_id = $1 and snap_date = current_date - 2`, [c.videoA])
      const r = await conferir(c, raiz)
      expect(r).toMatchObject({ ok: false, codigo: 'banco_mudou' })
      expect(await escalar<number>(pg, `select count(verified_at)::int from public.obs_archive_batches where channel_ref = $1`, [c.canalA])).toBe(0)
    })
  })

  it('reexportar zera verified_at e nas_confirmed_at (e --refazer troca os arquivos)', async () => {
    await emTransacao(pg, async () => {
      const c = await semearCena(pg)
      await pausarEEnvelhecer(pg, c, c.canalA)
      const raiz = await pastaTemporaria()
      expect(await exportar(c, raiz)).toMatchObject({ ok: true })
      expect(await conferir(c, raiz)).toMatchObject({ ok: true })
      await pg.query(`select public.obs_archive_confirm_nas($1, $2, $3, $4)`, [c.site, LOTE, c.canalA, c.admin])
      expect(await escalar<number>(pg, `select count(nas_confirmed_at)::int from public.obs_archive_batches where channel_ref = $1`, [c.canalA])).toBeGreaterThan(0)
      const semRefazer = await exportar(c, raiz)
      expect(semRefazer).toMatchObject({ ok: false, codigo: 'pasta_nao_vazia' })
      expect(await exportar(c, raiz, { refazer: true })).toMatchObject({ ok: true })
      const l = await q1(pg, `select count(*)::int as n, count(verified_at)::int as conferidos, count(nas_confirmed_at)::int as confirmados from public.obs_archive_batches where channel_ref = $1`, [c.canalA])
      expect([l.conferidos, l.confirmados]).toEqual([0, 0])
      expect(Number(l.n)).toBeGreaterThan(0)
    })
  })

  it('blob_count e blob_bytes batem com as miniaturas baixadas (uma linha da tabela de versões leva o total)', async () => {
    await emTransacao(pg, async () => {
      const c = await semearCena(pg)
      await pausarEEnvelhecer(pg, c, c.canalA)
      const raiz = await pastaTemporaria()
      expect(await exportar(c, raiz, { baixar: async u => ({ status: 200, corpo: new Uint8Array(Buffer.from('x'.repeat(10 + u.length))) }) })).toMatchObject({ ok: true, miniaturas: 2, miniaturasAusentes: 0 })
      const m = await manifestoDe(raiz)
      const esperado = m.miniaturas.reduce((s, x) => s + (x.bytes ?? 0), 0)
      const l = await q1(pg, `select sum(blob_count)::int as n, sum(blob_bytes)::int as bytes, sum(blob_missing)::int as faltam, count(blob_count)::int as linhas
        from public.obs_archive_batches where channel_ref = $1 and table_name = 'competitor_video_versions'`, [c.canalA])
      expect([l.n, Number(l.bytes), l.faltam]).toEqual([2, esperado, 0])
      expect(Number(l.linhas)).toBeGreaterThan(0)
      // e as outras tabelas não têm contagem de miniatura
      expect(await escalar<number>(pg, `select count(blob_count)::int from public.obs_archive_batches where channel_ref = $1 and table_name <> 'competitor_video_versions'`, [c.canalA])).toBe(0)
    })
  })

  it('o fluxo inteiro termina em removido, mesmo com vídeo de 40 dias sem marca (a idade fechada não bloqueia a remoção)', async () => {
    await emTransacao(pg, async () => {
      const c = await semearCena(pg)
      await pg.query(`insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at, discovered_at) values ($1, 'antigo40', 'sem marca', now() - interval '40 days', now() - interval '40 days')`, [c.canalA])
      await pausarEEnvelhecer(pg, c, c.canalA)
      const raiz = await pastaTemporaria()
      expect(await exportar(c, raiz)).toMatchObject({ ok: true })
      expect(await conferir(c, raiz)).toMatchObject({ ok: true })
      await pg.query(`select public.obs_archive_confirm_nas($1, $2, $3, $4)`, [c.site, LOTE, c.canalA, c.admin])
      const r = (await q1(pg, `select public.competitor_channel_remove_archived($1, $2, $3) as r`, [c.site, c.canalA, c.admin])).r as { status: string }
      expect(r.status).toBe('removido')
      expect(await escalar<number>(pg, `select count(*)::int from public.competitor_channels where id = $1`, [c.canalA])).toBe(0)
    })
  })

  it('o export recusa canal não pausado e canal de outro site, sem criar a pasta', async () => {
    await emTransacao(pg, async () => {
      const c = await semearCena(pg)
      const raiz = await pastaTemporaria()
      expect(await exportar(c, raiz)).toMatchObject({ ok: false, codigo: 'nao_pausado' })
      await expect(access(join(raiz, LOTE))).rejects.toBeTruthy()
      await pausarEEnvelhecer(pg, c, c.canalA)
      const outro = await exportarCanal({
        sql: clienteDoTeste(pg), disco: discoReal(), baixar: async () => ({ status: 200, corpo: new Uint8Array([1]) }), pastaRaiz: raiz, lote: LOTE,
        siteId: '00000000-0000-4000-8000-000000000000', canalId: c.canalA, aceitarMiniaturasAusentes: false, refazer: false, porIdade: false, agora: () => new Date(), versaoDoScript: 't',
      })
      expect(outro).toMatchObject({ ok: false, codigo: 'canal_nao_encontrado' })
      await expect(access(join(raiz, LOTE))).rejects.toBeTruthy()
      // pausa de 2 minutos: o banco recusa antes de criar a pasta
      await pg.query(`update public.competitor_channels set collection_paused_at = now() - interval '2 minutes' where id = $1`, [c.canalA])
      expect(await exportar(c, raiz)).toMatchObject({ ok: false, codigo: 'pausa_recente' })
      expect((await tenta(pg, 'select 1')).ok).toBe(true)
    })
  })

  it.todo('com a sincronização rodando no meio a contagem não muda (item 229): pende a Tarefa 4a (a pausa na sincronização), que só nasce com a MG6 em produção')
})
