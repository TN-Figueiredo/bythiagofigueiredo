// apps/web/test/integration/manutencao-m3b-leitor.test.ts
// @vitest-environment node
/**
 * Manutenção M3b, parte 2 do SQL (plano M3b-site, Tarefa 4): o leitor único da unidade mensal e as duas funções de hash.
 * Banco: SÓ o `bythiago_int` (54422). Tudo em `begin … rollback`. Itens 22, 75 e 131.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { aplicarM2 } from '../helpers/m2'
import { aplicarM3b, escalar, tenta, semearCanal, semearDiaria, SITE_TESTE } from '../helpers/m3b'
import { M10A_SQL } from './video-antigo-m10a-caminho'
import { readFileSync } from 'node:fs'
import { exportarUnidade, type FonteDaUnidade } from '@/lib/youtube/observatorio/arquivo/exportar'
import { consultaDoArquivo, lerLinhasDoBanco, INSTRUCOES_DA_LEITURA } from '@/lib/youtube/observatorio/arquivo/sessao'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const SITE2 = '00000000-0000-0000-0000-00000000a3b1'

interface Lida {
  rows: Array<Array<string | null>>; row_count: string; control_sum: string | null; hash_conteudo: string
  columns: Array<{ nome: string; tipo: string; nulo: boolean }>; schema_fp: string; first_key: string | null; last_key: string | null
}

describe.skipIf(skipIfNoLocalDb())('M3b parte 2: o leitor único e os hashes', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c.end() })

  async function emTx<T>(fn: () => Promise<T>): Promise<T> {
    await c.query('begin')
    try {
      await aplicarM2(c)
      await c.query(readFileSync(M10A_SQL, 'utf8'))
      await aplicarM3b(c, 2)
      return await fn()
    } finally { await c.query('rollback') }
  }
  async function ler(site: string, classe: string, tabela: string, canal: string, mes: string, off = 0, lim = 5000): Promise<Lida> {
    const r = await c.query(`select * from public.obs_archive_read_unit($1, $2, $3, $4, $5::date, $6, $7)`, [site, classe, tabela, canal, mes, off, lim])
    return r.rows[0] as Lida
  }
  const hash = (site: string, classe: string, tabela: string, canal: string, mes: string): Promise<Record<string, string>> =>
    c.query(`select row_count::text, control_sum, hash_conteudo from public.obs_archive_content_hash($1, $2, $3, $4, $5::date)`, [site, classe, tabela, canal, mes]).then(r => r.rows[0] as Record<string, string>)
  /** A fonte do caminho da rota: páginas por posição do leitor (o rpc falso devolve o resultado de read_unit). */
  async function fonteDaRota(site: string, classe: string, tabela: string, canal: string, mes: string): Promise<FonteDaUnidade> {
    return { ler: async () => {
      const linhas: Array<Array<string | null>> = []
      let primeira: Lida | null = null
      for (let off = 0; ; off += 1000) {
        const p = await ler(site, classe, tabela, canal, mes, off, 1000)
        primeira ??= p
        linhas.push(...p.rows)
        if (off + 1000 >= Number(p.row_count)) break
      }
      return { colunas: primeira.columns.map(x => x.nome), linhas, contagem: Number(primeira.row_count), soma: primeira.control_sum }
    } }
  }

  it('uma linha só, com 2.500 linhas na unidade (item 75)', async () => {
    await emTx(async () => {
      const { site, canal, videos } = await semearCanal(c, { videos: 100 })
      await semearDiaria(c, videos, '2026-10-03', 25)
      const r = await ler(site, 'serie', 'competitor_video_daily', canal, '2026-10-01', 0, 5000)
      expect(r.rows).toHaveLength(2500)
      expect(r.row_count).toBe('2500')
      expect(await escalar<number>(c, `select jsonb_array_length(rows) from public.obs_archive_read_unit($1, 'serie', 'competitor_video_daily', $2, '2026-10-01', 0, 5000)`, [site, canal])).toBe(2500)
      expect((await c.query(`select count(*)::int as n from public.obs_archive_read_unit($1, 'serie', 'competitor_video_daily', $2, '2026-10-01', 0, 5000)`, [site, canal])).rows[0].n).toBe(1)
    })
  })

  it('as partes por posição trazem os totais da unidade inteira', async () => {
    await emTx(async () => {
      const { site, canal, videos } = await semearCanal(c, { videos: 100 })
      await semearDiaria(c, videos, '2026-10-03', 25)
      const todas = await ler(site, 'serie', 'competitor_video_daily', canal, '2026-10-01', 0, 5000)
      const partes = [await ler(site, 'serie', 'competitor_video_daily', canal, '2026-10-01', 0, 1000),
        await ler(site, 'serie', 'competitor_video_daily', canal, '2026-10-01', 1000, 1000),
        await ler(site, 'serie', 'competitor_video_daily', canal, '2026-10-01', 2000, 1000)]
      expect(new Set(partes.map(p => p.hash_conteudo)).size).toBe(1)
      expect(partes.map(p => p.row_count)).toEqual(['2500', '2500', '2500'])
      expect(partes.map(p => p.control_sum)).toEqual([todas.control_sum, todas.control_sum, todas.control_sum])
      expect(partes.flatMap(p => p.rows)).toEqual(todas.rows)
      expect(partes[0]!.hash_conteudo).toBe(todas.hash_conteudo)
    })
  })

  it('hash e leitor concordam; o hash muda com uma linha a mais e volta com ela apagada', async () => {
    await emTx(async () => {
      const { site, canal, videos } = await semearCanal(c, { videos: 3 })
      await semearDiaria(c, videos, '2026-10-03', 5)
      const lido = await ler(site, 'serie', 'competitor_video_daily', canal, '2026-10-01')
      const h = await hash(site, 'serie', 'competitor_video_daily', canal, '2026-10-01')
      expect(h.hash_conteudo).toBe(lido.hash_conteudo)
      expect(h.row_count).toBe(lido.row_count)
      expect(h.control_sum).toBe(lido.control_sum)
      await c.query(`insert into public.competitor_video_daily (video_id, snap_date, views, taken_at) values ($1, '2026-10-20', 7, '2026-10-20T12:00:00Z')`, [videos[0]])
      const h2 = await hash(site, 'serie', 'competitor_video_daily', canal, '2026-10-01')
      expect(h2.hash_conteudo).not.toBe(h.hash_conteudo)
      expect(h2.row_count).toBe('16')
      await c.query(`delete from public.competitor_video_daily where video_id = $1 and snap_date = '2026-10-20'`, [videos[0]])
      expect((await hash(site, 'serie', 'competitor_video_daily', canal, '2026-10-01')).hash_conteudo).toBe(h.hash_conteudo)
    })
  })

  it('o mês é o de São Paulo', async () => {
    await emTx(async () => {
      const { site, canal, videos } = await semearCanal(c, { videos: 1 })
      // 02:00 UTC de 01/11 = 23:00 de 31/10 em SP; 03:00 UTC = 00:00 de 01/11 em SP
      await c.query(`insert into public.competitor_video_hourly (video_id, hour_slot, taken_at, site_id, views) values ($1, '2026-11-01T02:00:00Z', '2026-11-01T02:00:00Z', $2, 1), ($1, '2026-11-01T03:00:00Z', '2026-11-01T03:00:00Z', $2, 2)`, [videos[0], site])
      const out = await ler(site, 'horaria', 'competitor_video_hourly', canal, '2026-10-01')
      const nov = await ler(site, 'horaria', 'competitor_video_hourly', canal, '2026-11-01')
      expect(out.row_count).toBe('1')
      expect(out.control_sum).toBe('1')
      expect(nov.row_count).toBe('1')
      expect(nov.control_sum).toBe('2')
    })
  })

  async function semearConversa(site: string, canal: string, video: string): Promise<{ pai: string; resposta: string }> {
    const ins = async (parent: string | null, ytId: string, primeira: string): Promise<string> => (await c.query(
      `insert into public.competitor_video_comments (site_id, competitor_channel_id, video_id, youtube_comment_id, parent_id, body, published_at, is_creator, first_seen_at, last_seen_at)
       values ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $7::timestamptz, $7::timestamptz) returning id::text as id`,
      [site, canal, video, ytId, parent, parent ? '' : 'oi', primeira, parent !== null])).rows[0].id as string
    const pai = await ins(null, 'yt' + randomUUID().slice(0, 8), '2026-10-20T12:00:00Z')
    const resposta = await ins(pai, 'yt' + randomUUID().slice(0, 8), '2026-11-05T12:00:00Z')
    return { pai, resposta }
  }

  it('o mês da conversa: a resposta de novembro a um comentário de outubro entra na unidade de outubro, e sua marca também (02 §10.3)', async () => {
    await emTx(async () => {
      const { site, canal, videos } = await semearCanal(c, { videos: 1 })
      const { pai, resposta } = await semearConversa(site, canal, videos[0]!)
      await c.query(`insert into public.competitor_video_comment_marks (comment_id, mark, site_id, likes) values ($1, 0, $3, 4), ($2, 0, $3, 6)`, [pai, resposta, site])
      const out = await ler(site, 'texto', 'competitor_video_comments', canal, '2026-10-01')
      const nov = await ler(site, 'texto', 'competitor_video_comments', canal, '2026-11-01')
      expect(out.row_count).toBe('2')
      expect(nov.row_count).toBe('0')
      const mOut = await ler(site, 'texto', 'competitor_video_comment_marks', canal, '2026-10-01')
      const mNov = await ler(site, 'texto', 'competitor_video_comment_marks', canal, '2026-11-01')
      expect(mOut.row_count).toBe('2')
      expect(mOut.control_sum).toBe('10')
      expect(mNov.row_count).toBe('0')
      expect(mNov.control_sum).toBe('0')
    })
  })

  it('o bruto nas duas classes: cada linha em uma só (item 131)', async () => {
    await emTx(async () => {
      const { site, canal, videos } = await semearCanal(c, { videos: 2 })
      const raw = (video: string, corrente: boolean, visto: string): Promise<unknown> => c.query(
        `insert into public.competitor_raw (site_id, competitor_channel_id, video_id, raw_sha256, first_seen_at, last_seen_at, is_current, raw)
         values ($1, $2, $3, md5(random()::text), '2026-10-01T00:00:00Z', $4::timestamptz, $5, '{}'::jsonb)`, [site, canal, video, visto, corrente])
      await raw(videos[0]!, false, '2026-12-10T12:00:00Z')   // versão não corrente de vídeo vivo: texto, dezembro
      await raw(videos[1]!, true, '2026-12-10T12:00:00Z')    // versão corrente de vídeo congelado em dezembro: video_antigo, dezembro
      // congela depois das linhas: o guarda da M10a recusa gravar em vídeo congelado
      await c.query(`update public.competitor_videos set archive_frozen_at = '2026-12-15T12:00:00Z' where id = $1`, [videos[1]])
      const n = async (classe: string, mes: string): Promise<string> => (await ler(site, classe, 'competitor_raw', canal, mes)).row_count
      expect(await n('texto', '2026-12-01')).toBe('1')
      expect(await n('video_antigo', '2026-12-01')).toBe('1')
      expect(await n('texto', '2026-11-01')).toBe('0')
      expect(await n('video_antigo', '2026-11-01')).toBe('0')
      const t = await ler(site, 'texto', 'competitor_raw', canal, '2026-12-01')
      const v = await ler(site, 'video_antigo', 'competitor_raw', canal, '2026-12-01')
      expect(t.hash_conteudo).not.toBe(v.hash_conteudo)
    })
  })

  it('outro canal e outro site não entram', async () => {
    await emTx(async () => {
      const a = await semearCanal(c, { videos: 1 })
      const b = await semearCanal(c, { videos: 1 })
      const o = await semearCanal(c, { site: SITE2, videos: 1 })
      await semearDiaria(c, a.videos, '2026-10-03', 3)
      await semearDiaria(c, b.videos, '2026-10-03', 4)
      await semearDiaria(c, o.videos, '2026-10-03', 5)
      expect((await ler(a.site, 'serie', 'competitor_video_daily', a.canal, '2026-10-01')).row_count).toBe('3')
      expect((await ler(b.site, 'serie', 'competitor_video_daily', b.canal, '2026-10-01')).row_count).toBe('4')
      // o canal do outro site lido com o site errado: nenhuma linha
      expect((await ler(a.site, 'serie', 'competitor_video_daily', o.canal, '2026-10-01')).row_count).toBe('0')
      expect((await ler(o.site, 'serie', 'competitor_video_daily', a.canal, '2026-10-01')).row_count).toBe('0')
    })
  })

  it('nulo, texto vazio e bigint acima de 2^53 voltam como texto', async () => {
    await emTx(async () => {
      const { site, canal, videos } = await semearCanal(c, { videos: 2 })
      await c.query(`insert into public.competitor_video_daily (video_id, snap_date, views, likes, taken_at) values ($1, '2026-10-05', 9007199254740993, null, '2026-10-05T12:00:00Z'), ($2, '2026-10-05', 2, 3, '2026-10-05T12:00:00Z')`, [videos[0], videos[1]])
      const r = await ler(site, 'serie', 'competitor_video_daily', canal, '2026-10-01')
      const cols = r.columns.map(x => x.nome)
      const linhaDe = (v: string): Array<string | null> => r.rows.find(l => l[cols.indexOf('video_id')] === v)!
      expect(linhaDe(videos[0]!)[cols.indexOf('views')]).toBe('9007199254740993')
      expect(linhaDe(videos[0]!)[cols.indexOf('likes')]).toBeNull()
      expect(r.control_sum).toBe('9007199254740995')
      // texto vazio é "", nunca nulo
      await semearConversa(site, canal, videos[0]!)
      const t = await ler(site, 'texto', 'competitor_video_comments', canal, '2026-10-01')
      const iBody = t.columns.map(x => x.nome).indexOf('body')
      expect(t.rows.map(l => l[iBody]).sort()).toEqual(['', 'oi'])
    })
  })

  it('schema_fp muda com coluna nova e com a ordem das colunas; não muda com alter column set default (Phil M2)', async () => {
    await emTx(async () => {
      const fp = (): Promise<string> => escalar<string>(c, `select public.obs_archive_schema_fp('public.obs_archive_rehearsal'::regclass)`)
      const base = await fp()
      await c.query(`alter table public.obs_archive_rehearsal alter column likes set default 0`)
      expect(await fp()).toBe(base)
      // recriar a coluna no fim muda a ordem por attnum, e o CSV sai em outra ordem: por isso muda
      await c.query(`alter table public.obs_archive_rehearsal drop column likes`)
      await c.query(`alter table public.obs_archive_rehearsal add column likes bigint`)
      const reordenada = await fp()
      expect(reordenada).not.toBe(base)
      await c.query(`alter table public.obs_archive_rehearsal add column zz_nova integer`)
      expect(await fp()).not.toBe(reordenada)
    })
  })

  it('tabela ausente lança, nunca zero; par fora da política lança', async () => {
    await emTx(async () => {
      const { site, canal } = await semearCanal(c, { videos: 1 })
      await c.query(`alter table public.obs_archive_rehearsal rename to zz_m3b_renomeada`)
      const r = await tenta(c, `select * from public.obs_archive_read_unit($1, 'ensaio', 'obs_archive_rehearsal', $2, '2026-10-01', 0, 10)`, [site, canal])
      expect(r.ok).toBe(false)
      if (!r.ok) { expect(r.code).toBe('P0001'); expect(r.message).toContain('tabela_ausente') }
      const f = await tenta(c, `select * from public.obs_archive_read_unit($1, 'serie', 'competitor_raw', $2, '2026-10-01', 0, 10)`, [site, canal])
      expect(f.ok).toBe(false)
      if (!f.ok) expect(f.message).toContain('classe_tabela_invalida')
    })
  })

  it('unidade sem linha: rows vazio, contagem 0, soma 0 (com coluna) ou nula (sem), hash do texto vazio', async () => {
    await emTx(async () => {
      const { site, canal } = await semearCanal(c, { videos: 1 })
      const vazio = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      const d = await ler(site, 'serie', 'competitor_video_daily', canal, '2026-10-01')
      expect(d.rows).toEqual([])
      expect(d.row_count).toBe('0')
      expect(d.control_sum).toBe('0')
      expect(d.hash_conteudo).toBe(vazio)
      const t = await ler(site, 'texto', 'competitor_video_comments', canal, '2026-10-01')
      expect(t.control_sum).toBeNull()
      expect(t.hash_conteudo).toBe(vazio)
    })
  })

  it('as funções fixam a sessão: o hash é o mesmo com outro fuso e outro extra_float_digits', async () => {
    await emTx(async () => {
      const { site, canal, videos } = await semearCanal(c, { videos: 2 })
      await semearDiaria(c, videos, '2026-10-03', 4)
      const a = await hash(site, 'serie', 'competitor_video_daily', canal, '2026-10-01')
      await c.query(`set local timezone = 'America/Sao_Paulo'`)
      await c.query(`set local extra_float_digits = 0`)
      await c.query(`set local datestyle = 'SQL, DMY'`)
      const b = await hash(site, 'serie', 'competitor_video_daily', canal, '2026-10-01')
      expect(b).toEqual(a)
    })
  })

  it('o mesmo CSV pelos dois caminhos (item 22): a fonte da rota e a do terminal dão o mesmo csvSha256, e as mesmas linhas na mesma ordem', async () => {
    await emTx(async () => {
      const { site, canal, videos } = await semearCanal(c, { videos: 7 })
      await semearDiaria(c, videos, '2026-10-03', 6)
      const rota = await exportarUnidade(await fonteDaRota(site, 'serie', 'competitor_video_daily', canal, '2026-10-01'), null,
        { tabela: 'competitor_video_daily', canal, de: '2026-10-01', ate: '2026-10-31', rotulo: 'x', colunasDeOrdem: ['video_id', 'snap_date'] })
      // o terminal: a consulta da E10 (obs_archive_registry), com a sessão da E10 (menos o `begin`, que a transação do teste já abriu)
      for (const i of INSTRUCOES_DA_LEITURA.slice(1)) await c.query(i)
      const colunas = (await ler(site, 'serie', 'competitor_video_daily', canal, '2026-10-01', 0, 1)).columns.map(x => x.nome)
      const consulta = consultaDoArquivo({ tabela: 'competitor_video_daily', filtro: 't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
        periodo: 't.snap_date', ordem: 't.video_id, t.snap_date', colunas })
      const terminal = await exportarUnidade({ ler: () => lerLinhasDoBanco(c, { consulta, parametros: [canal, '2026-10-01'], colunas, colunaDaSoma: 'views' }) }, null,
        { tabela: 'competitor_video_daily', canal, de: '2026-10-01', ate: '2026-10-31', rotulo: 'x', colunasDeOrdem: ['video_id', 'snap_date'] })
      expect(rota.linhas).toBe(42)
      expect(rota.csvSha256).toBe(terminal.csvSha256)
      expect(rota.soma).toBe(terminal.soma)
      expect(rota.menorChave).toBe(terminal.menorChave)
    })
  })

  it('o SQL nunca monta CSV (item 22): só o string_agg do hash e das listas de colunas', async () => {
    await emTx(async () => {
      const r = await c.query(`select proname, prosrc from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('obs_archive_schema_fp', 'obs_archive_unit_source', 'obs_archive_read_unit', 'obs_archive_content_hash')`)
      expect(r.rows.map(x => x.proname).sort()).toEqual(['obs_archive_content_hash', 'obs_archive_read_unit', 'obs_archive_schema_fp', 'obs_archive_unit_source'])
      for (const f of r.rows as Array<{ proname: string; prosrc: string }>) {
        expect(f.prosrc, f.proname).not.toMatch(/E'\\n'\s*\|\|/)
        expect(f.prosrc, f.proname).not.toMatch(/array_to_string|concat_ws\(\s*','|quote_nullable/)
      }
    })
  })

  it('permissões: o leitor e o hash só para o service_role; a fonte da unidade só para o dono', async () => {
    await emTx(async () => {
      const sig = (f: string): Promise<boolean[]> => Promise.all(['anon', 'authenticated', 'service_role'].map(p => escalar<boolean>(c, `select has_function_privilege($1, $2, 'execute')`, [p, f])))
      expect(await sig('public.obs_archive_read_unit(uuid,text,text,uuid,date,bigint,integer)')).toEqual([false, false, true])
      expect(await sig('public.obs_archive_content_hash(uuid,text,text,uuid,date)')).toEqual([false, false, true])
      expect(await sig('public.obs_archive_schema_fp(regclass)')).toEqual([false, false, true])
      expect(await sig('public.obs_archive_unit_source(text,text)')).toEqual([false, false, false])
    })
  })
})
