// @vitest-environment node
/**
 * A5 · X3 (Tarefa 2): export, remoção e recarga da E10 com as cinco tabelas de playlists. Só o `bythiago_int`, tudo dentro de
 * `begin … rollback` (a MG6 e a X3 são aplicadas na transação; nada fica gravado). Rodar com a trava /tmp/claude-501/int-db.lock:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-x3-arquivo.test.ts --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { mkdtemp, rm, mkdir, writeFile, readFile, unlink, access, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { iniciarComMg6, semearCena, pausarEEnvelhecer, q1, escalar, tenta, codigoE10, tabelasComIdentidade, type Cena } from '../helpers/mg6'
import { garantirX3, emTransacaoComX3 } from '../helpers/x3'
import { exportarCanal, type Disco } from '@/lib/youtube/observatorio/arquivo/exportar'
import { conferirLote } from '@/lib/youtube/observatorio/arquivo/conferir'
import { lerCsv } from '@/lib/youtube/observatorio/arquivo/csv'
import { lerRegistro, consultaDoArquivo, lerCsvDoBanco, colunasDaExpressao, type ClienteSql } from '@/lib/youtube/observatorio/arquivo/sessao'
import { comandosDeRecarga } from '@/lib/youtube/observatorio/arquivo/cli'
import { validarManifesto, type Manifesto } from '@/lib/youtube/observatorio/arquivo/manifesto'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const LOTE = 'canal-teste-x3'
const CINCO = ['competitor_playlist_reads', 'competitor_playlists', 'competitor_playlist_versions', 'competitor_playlist_items', 'competitor_channel_sections']

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


describe.skipIf(skipIfNoLocalDb())('A5 X3 Tarefa 2: E10 com as tabelas de playlists (banco local, tudo dentro de rollback)', () => {
  let pg: Client
  const pastas: string[] = []
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => {
    try { await pg.query('rollback') } catch { /* nada aberto */ }
    await pg.end()
    for (const p of pastas) await rm(p, { recursive: true, force: true })
  })

  async function pastaTemporaria(): Promise<string> {
    const p = await mkdtemp(join(tmpdir(), 'obs-x3-teste-'))
    pastas.push(p)
    return p
  }
  const exportar = (c: Cena, raiz: string) => exportarCanal({
    sql: clienteDoTeste(pg), disco: discoReal(), baixar: async u => ({ status: 200, corpo: new Uint8Array(Buffer.from('img:' + u)) }),
    pastaRaiz: raiz, lote: LOTE, siteId: c.site, canalId: c.canalA, aceitarMiniaturasAusentes: false, refazer: false, porIdade: false,
    agora: () => new Date(), versaoDoScript: 'teste-integracao-x3',
  })
  const conferir = (c: Cena, raiz: string) => conferirLote({ sql: clienteDoTeste(pg), disco: discoReal(), pastaRaiz: raiz, lote: LOTE, siteId: c.site, canalId: c.canalA })
  async function manifestoDe(raiz: string): Promise<Manifesto> {
    const v = validarManifesto(JSON.parse(await readFile(join(raiz, LOTE, 'manifesto.json'), 'utf8')))
    if (!('valor' in v)) throw new Error(v.porque)
    return v.valor
  }

  /** 2 playlists, 3 itens, 1 versão por playlist, 1 seção e a linha de leitura, para o canal dado. */
  async function semearX3(c: Cena, canal: string): Promise<void> {
    const rows = [1, 2].map(i => ({ playlist_id: 'PLx3' + i + canal.slice(0, 6), title: 'T' + i, published_at: '2025-01-01T00:00:00Z', item_count: 3, privacy: 'public', state_sha256: 'h' + i, raw: { i } }))
    const r = (await q1(pg, `select public.competitor_x3_playlists_record($1, $2, '2026-03-10T10:00:00Z', $3::jsonb, true) as r`, [c.site, canal, JSON.stringify(rows)])).r as { ids: Record<string, string> }
    const ref = Object.values(r.ids)[0]!
    const itens = [1, 2, 3].map(n => ({ item_id: 'i' + n, youtube_video_id: 'v' + String(n).padStart(10, '0'), position: n, added_at: null, video_published_at: null, video_owner_channel_id: null, privacy: 'public', note: null }))
    await pg.query(`select public.competitor_x3_items_record($1, $2, $3, '2026-03-10T10:05:00Z', $4::jsonb, true, 'ok', null)`, [c.site, canal, ref, JSON.stringify(itens)])
    await pg.query(`select public.competitor_x3_sections_record($1, $2, '2026-03-10T10:00:00Z', 'hs', '{"items":[]}'::jsonb)`, [c.site, canal])
    await pg.query(`select public.competitor_x3_visit_close($1, $2, '2026-03-10T10:10:00Z', 'ok', null, 5, 0, null, null, false)`, [c.site, canal])
  }
  const linhasDe = (canal: string) => escalar<number>(pg, `select coalesce(sum(row_count), 0)::int from public.obs_archive_channel_counts($1) where table_name = any($2::text[])`, [canal, CINCO])

  it('garantirX3 e depois garantirMg6 de novo: o registro volta a 30 e obs_archive_uncovered() é vazio', async () => {
    await emTransacaoComX3(pg, async () => {
      const { garantirMg6 } = await import('../helpers/mg6')
      await garantirMg6(pg)
      expect(await escalar<unknown>(pg, `select public.obs_archive_uncovered()`)).toEqual([])
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_registry()`)).toBe(30)
    })
  })

  it('exporta, confere, confirma e remove o canal A: as cinco tabelas ficam sem linha de A, o canal B fica intacto', async () => {
    await emTransacaoComX3(pg, async () => {
      const c = await semearCena(pg, { semX3: true })
      await semearX3(c, c.canalA)
      await semearX3(c, c.canalB)
      expect(await linhasDe(c.canalA)).toBeGreaterThan(8)
      const antesB = await linhasDe(c.canalB)
      await pausarEEnvelhecer(pg, c, c.canalA)
      const raiz = await pastaTemporaria()
      expect(await exportar(c, raiz)).toMatchObject({ ok: true })
      expect(await conferir(c, raiz)).toMatchObject({ ok: true })
      await pg.query(`select public.obs_archive_confirm_nas($1, $2, $3, $4)`, [c.site, LOTE, c.canalA, c.admin])
      const m = await manifestoDe(raiz)
      for (const t of CINCO) expect(m.arquivos.some(a => a.tabela === t), `${t} no manifesto`).toBe(true)
      const r = (await q1(pg, `select public.competitor_channel_remove_archived($1, $2, $3) as r`, [c.site, c.canalA, c.admin])).r as { status: string }
      expect(r.status).toBe('removido')
      const sobrou = async (canal: string): Promise<Record<string, number>> => ({
        reads: await escalar<number>(pg, `select count(*)::int from public.competitor_playlist_reads where competitor_channel_id = $1`, [canal]),
        secoes: await escalar<number>(pg, `select count(*)::int from public.competitor_channel_sections where competitor_channel_id = $1`, [canal]),
        playlists: await escalar<number>(pg, `select count(*)::int from public.competitor_playlists where competitor_channel_id = $1`, [canal]),
        versoes: await escalar<number>(pg, `select count(*)::int from public.competitor_playlist_versions v join public.competitor_playlists p on p.id = v.playlist_ref where p.competitor_channel_id = $1`, [canal]),
        itens: await escalar<number>(pg, `select count(*)::int from public.competitor_playlist_items i join public.competitor_playlists p on p.id = i.playlist_ref where p.competitor_channel_id = $1`, [canal]),
      })
      expect(await sobrou(c.canalA)).toEqual({ reads: 0, secoes: 0, playlists: 0, versoes: 0, itens: 0 })
      expect((await sobrou(c.canalB)).playlists).toBe(2)
      expect(await linhasDe(c.canalB)).toBe(antesB)
    })
  })

  it('recarga de verdade: os comandos recarregam as cinco tabelas, a sequência das duas de identidade não colide e o sha256 volta', async () => {
    await emTransacaoComX3(pg, async () => {
      const c = await semearCena(pg, { semX3: true })
      await semearX3(c, c.canalA)
      await pausarEEnvelhecer(pg, c, c.canalA)
      const raiz = await pastaTemporaria()
      expect(await exportar(c, raiz)).toMatchObject({ ok: true })
      expect(await conferir(c, raiz)).toMatchObject({ ok: true })
      await pg.query(`select public.obs_archive_confirm_nas($1, $2, $3, $4)`, [c.site, LOTE, c.canalA, c.admin])
      const m = await manifestoDe(raiz)
      await pg.query(`select public.competitor_channel_remove_archived($1, $2, $3)`, [c.site, c.canalA, c.admin])
      const comIdentidade = await tabelasComIdentidade(pg)
      expect(comIdentidade).toEqual(expect.arrayContaining(['competitor_playlist_versions', 'competitor_channel_sections']))
      for (const t of comIdentidade) await pg.query(`select setval(pg_get_serial_sequence('public.${t}', 'id'), 1, false)`)
      const comandos = comandosDeRecarga(m, join(raiz, LOTE))
      const copias = comandos.filter(l => l.startsWith('\\copy'))
      const ajustes = comandos.filter(l => l.startsWith('select setval'))
      expect(copias).toHaveLength(m.arquivos.length)
      for (let i = 0; i < m.arquivos.length; i++) {
        const a = m.arquivos[i]!
        expect(copias[i]).toContain(`public.${a.tabela} (`)
        const { colunas, linhas } = lerCsv(gunzipSync(await readFile(join(raiz, LOTE, a.caminho))).toString('utf8'))
        const tipos = new Map(a.colunas.map(x => [x.nome, x.tipo]))
        const lista = colunas.map(n => `"${n}"`).join(', ')
        const valores = colunas.map((n, k) => `$${k + 1}::${tipos.get(n)!}`).join(', ')
        for (const l of linhas) await pg.query(`insert into public."${a.tabela}" (${lista}) overriding system value values (${valores})`, l)
      }
      for (const l of ajustes) await pg.query(l)
      for (const t of ['competitor_playlist_versions', 'competitor_channel_sections']) {
        const max = await escalar<number>(pg, `select max(id)::int from public.${t}`)
        expect(await escalar<number>(pg, `select nextval(pg_get_serial_sequence('public.${t}', 'id'))::int`), `${t}: o próximo id não repete`).toBeGreaterThan(max)
      }
      for (const t of CINCO) expect(await escalar<number>(pg, `select count(*)::int from public.${t} where site_id = $1`, [c.site]), t).toBeGreaterThan(0)
      const registro = await lerRegistro(clienteDoTeste(pg))
      for (const a of m.arquivos.filter(x => CINCO.includes(x.tabela))) {
        const e = registro.find(x => x.tabela === a.tabela)!
        const unico = a.periodo === 'unico'
        const lido = await lerCsvDoBanco(clienteDoTeste(pg), {
          consulta: consultaDoArquivo({ tabela: a.tabela, filtro: e.filtro, periodo: e.periodo, ordem: e.ordem, colunas: a.colunas.map(x => x.nome) }),
          parametros: unico ? [c.canalA] : [c.canalA, a.periodStart], colunas: a.colunas.map(x => x.nome), colunaDaSoma: null, colunasDeOrdem: colunasDaExpressao(e.ordem),
        })
        expect([a.tabela, a.periodo, lido.sha256]).toEqual([a.tabela, a.periodo, a.csvSha256])
      }
    })
  })

  it('lote exportado antes da X3 (registro de 22): com a X3 aplicada depois, remover passa; com playlist nova de A, recusa banco_difere_do_manifesto', async () => {
    for (const comPlaylistNova of [false, true]) {
      await iniciarComMg6(pg)
      try {
        const c = await semearCena(pg, { semX3: true })
        await pausarEEnvelhecer(pg, c, c.canalA)
        const raiz = await pastaTemporaria()
        expect(await exportar(c, raiz)).toMatchObject({ ok: true })
        expect(await conferir(c, raiz)).toMatchObject({ ok: true })
        await pg.query(`select public.obs_archive_confirm_nas($1, $2, $3, $4)`, [c.site, LOTE, c.canalA, c.admin])
        await garantirX3(pg)
        if (comPlaylistNova) {
          await pg.query(`insert into public.competitor_playlists (site_id, competitor_channel_id, playlist_id, state_sha256, first_seen_at, last_seen_at) values ($1, $2, 'PLnova123', 'h', now(), now())`, [c.site, c.canalA])
          const t = await tenta(pg, `select public.competitor_channel_remove_archived($1, $2, $3)`, [c.site, c.canalA, c.admin])
          expect(t.ok).toBe(false)
          if (!t.ok) expect(codigoE10(t.message)).toBe('banco_difere_do_manifesto')
        } else {
          const r = (await q1(pg, `select public.competitor_channel_remove_archived($1, $2, $3) as r`, [c.site, c.canalA, c.admin])).r as { status: string }
          expect(r.status).toBe('removido')
        }
      } finally {
        await pg.query('rollback')
      }
    }
  })

  it('garantirX3 aplicada e garantirMg6 reaplicada em seguida: 30 linhas e obs_archive_uncovered() vazio', async () => {
    await emTransacaoComX3(pg, async () => {
      const { garantirMg6 } = await import('../helpers/mg6')
      await garantirMg6(pg)
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_registry()`)).toBe(30)
      expect(await escalar<unknown>(pg, `select public.obs_archive_uncovered()`)).toEqual([])
    })
  })
})
