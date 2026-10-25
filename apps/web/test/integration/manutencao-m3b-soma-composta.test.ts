// @vitest-environment node
/**
 * M3b, item 1 da noite 25/10: a soma composta do registro (`t.id + t.vistas` da yt_watch_thumbs) chega ao export pelo `colunasDaSoma`
 * de `exportarCanal`. As yt_watch_* ficam ONLINE (fora de obs_archive_policy), então não há hash SQL para comparar: compara-se com
 * `select sum(<expressão do registro>)` direto no banco. Banco: SÓ o `bythiago_int` (54422); tudo em rollback.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { mkdtemp, rm, mkdir, writeFile, readFile, unlink, access, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { emTransacao, garantirComT13, semearCena, semearWatchDoVideo, pausarEEnvelhecer, q1, escalar } from '../helpers/mg6'
import { exportarCanal, type Disco } from '@/lib/youtube/observatorio/arquivo/exportar'
import { conferirLote } from '@/lib/youtube/observatorio/arquivo/conferir'
import { colunasDaSoma, consultaDoArquivo, lerLinhasDoBanco, type ClienteSql } from '@/lib/youtube/observatorio/arquivo/sessao'
import { validarManifesto } from '@/lib/youtube/observatorio/arquivo/manifesto'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const LOTE = 'canal-teste-soma'

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

describe.skipIf(skipIfNoLocalDb())('M3b item 1: soma composta do registro no export e na conferência (yt_watch_thumbs)', () => {
  let pg: Client
  const pastas: string[] = []
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => {
    try { await pg.query('rollback') } catch { /* nada aberto */ }
    await pg.end()
    for (const p of pastas) await rm(p, { recursive: true, force: true })
  })

  it('toda soma composta do registro (alvos, thumbs, ab_native_observados): manifesto e conferência = sum(<expressão>) do banco; a 2ª coluna pesa', async () => {
    await emTransacao(pg, async () => {
      await garantirComT13(pg)   // ab_native_observados entra no registro (32) pela T13, só dentro da transação
      const c = await semearCena(pg, { semWatch: true })
      const yt = (await q1(pg, `select video_id from public.competitor_videos where id = $1`, [c.videoA])).video_id as string
      await semearWatchDoVideo(pg, c.site, yt, { leituras: 0, miniaturas: 3, alvo: true })
      // valores variados na 2ª coluna: um mutante "id + contagem de linhas" (ou "só o id") não pode empatar com o certo (Phil M1)
      await pg.query(`update public.yt_watch_thumbs set vistas = vistas + (id % 7) * 13 + 4 where site_id = $1`, [c.site])
      await pg.query(`update public.yt_watch_alvos set rodadas = 9 where site_id = $1`, [c.site])
      for (const [campo, n] of [['titulo', 3], ['miniatura', 11]] as const) {
        await pg.query(
          `insert into public.ab_native_observados (site_id, youtube_video_id, campo, tipo_troca, veredito, versao_regra, trocas, n_versoes, ficou_estado, primeira_troca_em)
           values ($1, $2, $3, 'sequencial', 'troca_observada', 1, '[]'::jsonb, $4, 'estavel', now() - interval '3 days')`, [c.site, yt, campo, n])
      }
      const compostas = (await pg.query(`select table_name, sum_sql, filter_sql, period_sql, order_sql from public.obs_archive_registry() where sum_sql like '%+%' order by 1`)).rows as Array<{ table_name: string; sum_sql: string; filter_sql: string; period_sql: string | null; order_sql: string }>
      expect(compostas.map(r => r.table_name)).toEqual(['ab_native_observados', 'yt_watch_alvos', 'yt_watch_thumbs'])
      const esperados = new Map<string, string>()
      for (const reg of compostas) {
        const cols = colunasDaSoma(reg.sum_sql)
        expect(cols?.length, `${reg.table_name}: soma composta (2+ colunas)`).toBeGreaterThanOrEqual(2)
        // Phil M3: o TypeScript ignora o nulo coluna a coluna, o SQL descarta a linha; só dá igual com colunas not null
        for (const col of cols ?? []) {
          expect(await escalar<boolean>(pg, `select attnotnull from pg_attribute where attrelid = ('public.' || $1)::regclass and attname = $2`, [reg.table_name, col.replace(/^t\./, '')]), `${reg.table_name}.${col} not null`).toBe(true)
        }
        const q = await q1(pg, `select coalesce(sum(${reg.sum_sql}), 0)::text as soma, (coalesce(sum(${reg.sum_sql}), 0) - coalesce(sum(t.id), 0))::text as so_2a, count(*)::text as n from public.${reg.table_name} t where ${reg.filter_sql}`, [c.canalA])
        expect(BigInt(q.soma as string), reg.table_name).toBeGreaterThan(BigInt(0))
        expect(q.so_2a, `${reg.table_name}: a 2ª coluna não pode empatar com a contagem de linhas`).not.toBe(q.n)
        esperados.set(reg.table_name, q.soma as string)
      }
      await pausarEEnvelhecer(pg, c, c.canalA)
      const raiz = await mkdtemp(join(tmpdir(), 'obs-soma-teste-')); pastas.push(raiz)
      const r = await exportarCanal({
        sql: clienteDoTeste(pg), disco: discoReal(), baixar: async u => ({ status: 200, corpo: new Uint8Array(Buffer.from('img:' + u)) }),
        pastaRaiz: raiz, lote: LOTE, siteId: c.site, canalId: c.canalA, aceitarMiniaturasAusentes: false, refazer: false, porIdade: false,
        agora: () => new Date(), versaoDoScript: 'teste-soma',
      })
      expect(r.ok, JSON.stringify(r)).toBe(true)
      const v = validarManifesto(JSON.parse(await readFile(join(raiz, LOTE, 'manifesto.json'), 'utf8')))
      if (!('valor' in v)) throw new Error(v.porque)
      // k.soma (SQL) = esperado; o TS se prova também direto, abaixo, e pelo r.ok e pelo conferirLote
      for (const reg of compostas) {
        const colunas = ((await pg.query(`select attname::text as n from pg_attribute where attrelid = ('public.' || $1)::regclass and attnum > 0 and not attisdropped order by attnum`, [reg.table_name])).rows as Array<{ n: string }>).map(x => x.n)
        const consulta = consultaDoArquivo({ tabela: reg.table_name, filtro: reg.filter_sql, periodo: reg.period_sql, ordem: reg.order_sql, colunas })
        const meses = reg.period_sql === null ? [null] : ((await pg.query(`select period_start::text as i from public.obs_archive_channel_counts($1) where table_name = $2`, [c.canalA, reg.table_name])).rows as Array<{ i: string }>).map(x => x.i)
        let total = BigInt(0)
        for (const mes of meses) {
          const lido = await lerLinhasDoBanco(clienteDoTeste(pg), { consulta, parametros: mes === null ? [c.canalA] : [c.canalA, mes], colunas, colunaDaSoma: colunasDaSoma(reg.sum_sql) })
          total += BigInt(lido.soma ?? 'x')
        }
        expect(total.toString(), `${reg.table_name}: soma do TypeScript = esperado`).toBe(esperados.get(reg.table_name))
      }
      for (const [tabela, esperado] of esperados) {
        const doManifesto = v.valor.arquivos.filter(a => a.tabela === tabela)
        expect(doManifesto.length, tabela).toBeGreaterThan(0)
        expect(doManifesto.reduce((s, a) => s + BigInt(a.soma ?? 'x'), BigInt(0)).toString(), tabela).toBe(esperado)
      }
      // a conferência (conferir.ts:120) refaz a soma do CSV pelas mesmas colunas e aceita
      const conf = await conferirLote({ sql: clienteDoTeste(pg), disco: discoReal(), pastaRaiz: raiz, lote: LOTE, siteId: c.site, canalId: c.canalA })
      expect(conf.ok, JSON.stringify(conf)).toBe(true)
    })
  })
})
