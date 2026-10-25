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
import { emTransacao, semearCena, semearWatchDoVideo, pausarEEnvelhecer, q1, escalar } from '../helpers/mg6'
import { exportarCanal, type Disco } from '@/lib/youtube/observatorio/arquivo/exportar'
import { conferirLote } from '@/lib/youtube/observatorio/arquivo/conferir'
import { colunasDaSoma, type ClienteSql } from '@/lib/youtube/observatorio/arquivo/sessao'
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

  it('a soma do manifesto e a da conferência = sum(<expressão do registro>) no banco; a expressão é composta', async () => {
    await emTransacao(pg, async () => {
      const c = await semearCena(pg, { semWatch: true })
      const yt = (await q1(pg, `select video_id from public.competitor_videos where id = $1`, [c.videoA])).video_id as string
      await semearWatchDoVideo(pg, c.site, yt, { leituras: 0, miniaturas: 3, alvo: false })
      const reg = (await q1(pg, `select sum_sql, filter_sql from public.obs_archive_registry() where table_name = 'yt_watch_thumbs'`))
      const expressao = reg.sum_sql as string
      expect(colunasDaSoma(expressao)?.length, 'o registro precisa dar soma composta (2+ colunas)').toBeGreaterThanOrEqual(2)
      const esperado = await escalar<string>(pg, `select coalesce(sum(${expressao}), 0)::text from public.yt_watch_thumbs t where ${reg.filter_sql as string}`, [c.canalA])
      expect(BigInt(esperado)).toBeGreaterThan(BigInt(0))
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
      const doManifesto = v.valor.arquivos.filter(a => a.tabela === 'yt_watch_thumbs')
      expect(doManifesto.length).toBeGreaterThan(0)
      expect(doManifesto.reduce((s, a) => s + BigInt(a.soma ?? 'x'), BigInt(0)).toString()).toBe(esperado)
      // a conferência (conferir.ts:120) refaz a soma do CSV pelas mesmas colunas e aceita
      const conf = await conferirLote({ sql: clienteDoTeste(pg), disco: discoReal(), pastaRaiz: raiz, lote: LOTE, siteId: c.site, canalId: c.canalA })
      expect(conf.ok, JSON.stringify(conf)).toBe(true)
    })
  })
})
