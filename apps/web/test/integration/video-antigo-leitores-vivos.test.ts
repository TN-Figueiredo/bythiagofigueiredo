// @vitest-environment node
// M10a (Tarefa 11): a lista dos leitores bate com o catálogo do banco (funções vivas, views, chaves estrangeiras, gatilho, fold_log).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import pg from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { M10A_EM_MIGRATION, m10aNoBanco } from './video-antigo-m10a-caminho'
import { FUNCOES_VIVAS, TABELAS_COM_CHAVE_PARA_COMPETITOR_VIDEOS } from '@/lib/youtube/video-antigo/leitores-competitor-videos'

const pular = skipIfNoLocalDb() || (!M10A_EM_MIGRATION && !(await m10aNoBanco()))
// leitores conhecidos de competitor_hour_fold_log (E15 soma o dia; o registro do arquivo e a contagem da remoção só contam)
const LEITORES_FOLD_LOG = ['competitor_channel_removal_impact', 'obs_archive_registry']

describe.skipIf(pular)('M10a: listas de leitores contra o catálogo do banco', () => {
  let c: pg.Client
  beforeAll(async () => {
    c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' })
    await c.connect()
  })
  afterAll(async () => { await c.end() })

  it('(a) as funções que citam competitor_videos são exatamente FUNCOES_VIVAS', async () => {
    const r = await c.query(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) like '%competitor_videos%' order by 1`)
    const vivas = [...new Set(r.rows.map(x => x.proname as string))].sort()
    expect(vivas).toEqual(FUNCOES_VIVAS.map(f => f.nome).sort())
  })

  it('(b) nenhuma view de public cita a tabela', async () => {
    const r = await c.query(`select viewname from pg_views where schemaname = 'public' and definition like '%competitor_videos%'`)
    expect(r.rows.map(x => x.viewname)).toEqual([])
  })

  it('(c) as chaves estrangeiras raiz para competitor_videos são exatamente as 16 tabelas', async () => {
    const r = await c.query(`select cl.relname::text as t, a.attname::text as col
      from pg_constraint k join pg_class cl on cl.oid = k.conrelid join pg_namespace n on n.oid = cl.relnamespace
      join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any(k.conkey)
      where k.confrelid = 'public.competitor_videos'::regclass and k.contype = 'f' and k.conparentid = 0 and not cl.relispartition and n.nspname = 'public' order by 1, 2`)
    const lista = TABELAS_COM_CHAVE_PARA_COMPETITOR_VIDEOS.map(t => `${t.tabela}.${t.coluna}`).sort()
    expect(r.rows.map(x => `${x.t}.${x.col}`)).toEqual(lista)
    expect(lista).toHaveLength(16)
  })

  it('(c2) as 8 tabelas da classe video_antigo são as que têm o gatilho da guarda', async () => {
    const r = await c.query(`select c.relname::text as t from pg_trigger t join pg_class c on c.oid = t.tgrelid
      where t.tgname = 'obs_video_antigo_guarda' and not t.tgisinternal and not c.relispartition order by 1`)
    expect(r.rows.map(x => x.t)).toEqual(TABELAS_COM_CHAVE_PARA_COMPETITOR_VIDEOS.filter(t => t.classe === 'video_antigo').map(t => t.tabela).sort())
  })

  it('(d) quem lê competitor_hour_fold_log é só o conhecido', async () => {
    const r = await c.query(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) like '%competitor_hour_fold_log%' order by 1`)
    expect(r.rows.map(x => x.proname)).toEqual([...LEITORES_FOLD_LOG].sort())
  })
})
