// @vitest-environment node
/**
 * F1a-dado T1: colunas do dia 14, os quatro CHECKs no lugar do check3 e `ab_native_fichas`. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-f1a-migration --no-file-parallelism
 * Tudo dentro de begin/rollback (a RLS roda como `authenticated` com o GUC `app.site_id` falsificado).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

vi.setConfig({ testTimeout: 60_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const CHECK_VELHO = 'CHECK (((vencedor_titulo IS NULL) = (vencedor_fonte IS NULL)))'
const FICHA2 = JSON.stringify([{ n: 1, tipo: 'titulo', titulo: 'Original' }, { n: 2, tipo: 'titulo', titulo: 'Nova' }])

describe.skipIf(skipIfNoLocalDb())('F1a-dado T1: migration (colunas, CHECKs, ab_native_fichas)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let siteId: string
  let videoId: string
  let video2: string
  const usuarios: string[] = []
  const ytId = (): string => 'y' + randomUUID().replace(/-/g, '').slice(0, 10)

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    siteId = (await seedSite(sb)).siteId
    const k = randomUUID().replace(/-/g, '')
    const canal = String((await pg.query(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [siteId, 'UC' + k.slice(0, 20), '@f1' + k.slice(0, 8), 'UU' + k.slice(0, 20), 'f1a-' + k.slice(0, 8)])).rows[0].id)
    const mk = async (): Promise<string> => String((await pg.query(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at)
      values ($1, $2, $3, 'T', now()) returning id`, [siteId, canal, ytId()])).rows[0].id)
    videoId = await mk(); video2 = await mk()
  })
  afterAll(async () => {
    try {
      await pg.query('delete from public.site_memberships where site_id = $1', [siteId])
      await pg.query('delete from auth.users where id = any($1::uuid[])', [usuarios])
      await pg.query('delete from public.youtube_videos where site_id = $1', [siteId])
      await pg.query('delete from public.youtube_channels where site_id = $1', [siteId])
      await pg.query('delete from public.audit_log where site_id = $1', [siteId])
      await pg.query('delete from public.sites where id = $1', [siteId])
    } finally {
      await pg.end()
    }
  })

  async function tx<T>(fn: () => Promise<T>): Promise<T> {
    await pg.query('begin')
    try { return await fn() } finally { await pg.query('rollback') }
  }
  async function erro(sql: string, params: unknown[] = []): Promise<string | null> {
    await pg.query('savepoint s')
    try { await pg.query(sql, params); await pg.query('release savepoint s'); return null } catch (e) {
      await pg.query('rollback to savepoint s'); return (e as { code?: string }).code ?? 'sem_codigo'
    }
  }
  /** Linha `confirmado` (ficha, `variantes` não nulo) ou derivada (`detectado`, `variantes` nulo), com os campos de desfecho. */
  const linha = (o: { ficha?: boolean; estado?: string; fonte?: string | null; titulo?: string | null; resposta?: string | null; n?: number | null; respondido?: boolean; semDesfecho?: boolean }): { sql: string; params: unknown[] } => {
    const ficha = o.ficha ?? true
    const estado = o.estado ?? 'encerrado'
    const fechado = estado !== 'em_andamento'
    return {
      sql: `insert into public.ab_native_tests (site_id, video_id, youtube_video_id, origem, campos, estado, variantes_titulo, primeira_vista, versao_regra,
              variantes, confirmado_em, encerrado_em, vencedor_fonte, vencedor_titulo, resposta_dono, variante_vencedora, respondido_em)
            values ($1, $2, 'abcdefghijk', $3, '{titulo}', $4, $5::jsonb, now() - interval '1 day', 1, $6::jsonb, $7, $8, $9, $10, $11, $12, $13)`,
      params: [siteId, videoId, ficha ? 'confirmado' : 'detectado', estado, ficha ? null : '["a","b"]', ficha ? FICHA2 : null,
        ficha ? new Date().toISOString() : null, fechado ? new Date().toISOString() : null,
        o.fonte ?? null, o.titulo ?? null, o.resposta ?? null, o.n ?? null,
        (o.respondido ?? (o.resposta != null && o.resposta !== 'sem_resposta')) ? new Date().toISOString() : null],
    }
  }
  const tenta = (o: Parameters<typeof linha>[0]): Promise<string | null> => { const l = linha(o); return erro(l.sql, l.params) }

  it('(a) nenhum CHECK com a definição velha; os quatro novos presentes; colunas novas', async () => {
    const velhos = await pg.query(`select conname from pg_constraint where conrelid = 'public.ab_native_tests'::regclass and contype = 'c' and pg_get_constraintdef(oid) = $1`, [CHECK_VELHO])
    expect(velhos.rowCount).toBe(0)
    const novos = await pg.query(`select conname from pg_constraint where conrelid = 'public.ab_native_tests'::regclass and contype = 'c' and conname = any($1::text[])`,
      [['ab_native_tests_titulo_com_fonte', 'ab_native_tests_fonte_com_vencedor', 'ab_native_tests_variante_da_resposta', 'ab_native_tests_respondido_em_do_dono']])
    expect(novos.rowCount).toBe(4)
    const cols = await pg.query(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'ab_native_tests'
      and column_name = any($1::text[])`, [['lembrete_notificado_em', 'resposta_dono', 'variante_vencedora', 'respondido_em', 'notificacao_tentativas', 'notificacao_falhou_em', 'variantes']])
    expect(cols.rowCount).toBe(7)
  })

  it('(b)-(d) CHECKs de vencedor e de resposta', async () => {
    await tx(async () => {
      // (b) "Venceu a nova" só de miniatura: fonte dono, sem título, com variante
      expect(await tenta({ fonte: 'dono', resposta: 'venceu_nova', n: 2 })).toBeNull()
      await pg.query('delete from public.ab_native_tests where site_id = $1', [siteId])
      // (c)
      expect(await tenta({ fonte: 'dono' })).toBe('23514')
      expect(await tenta({ titulo: 'x' })).toBe('23514')
      // (d) o caso do dia 14 depois de o registrador fechar sem vencedor: derivada, sem fonte
      expect(await tenta({ ficha: false, estado: 'sem_desfecho', resposta: 'venceu_nova', n: 2 })).toBeNull()
      await pg.query('delete from public.ab_native_tests where site_id = $1', [siteId])
      // (r5) mantidos
      expect(await tenta({ resposta: 'venceu_nova', n: 1 })).toBe('23514')
      expect(await tenta({ resposta: 'venceu_original', n: 1 })).toBeNull()
      await pg.query('delete from public.ab_native_tests where site_id = $1', [siteId])
      expect(await tenta({ resposta: 'venceu_original', n: 2 })).toBe('23514')
      // F1a-tela-2 T1: a derivada passa a aceitar venceu_original com n = 1 (o original é o título de antes); n = 2 segue recusado
      expect(await tenta({ ficha: false, estado: 'sem_desfecho', resposta: 'venceu_original', n: 1 })).toBeNull()
      await pg.query('delete from public.ab_native_tests where site_id = $1', [siteId])
      expect(await tenta({ ficha: false, estado: 'sem_desfecho', resposta: 'venceu_original', n: 2 })).toBe('23514')
      expect(await tenta({ resposta: 'ficou_igual', n: 2 })).toBe('23514')
      expect(await tenta({ ficha: false, resposta: 'venceu_nova', n: 0 })).toBe('23514')
      expect(await tenta({ ficha: false, resposta: 'venceu_nova', n: 4 })).toBe('23514')
      expect(await tenta({ ficha: false, resposta: 'venceu_nova', n: 1 })).toBeNull() // derivada aceita 1
      await pg.query('delete from public.ab_native_tests where site_id = $1', [siteId])
      expect(await tenta({ resposta: 'ficou_igual', n: 2 })).toBe('23514')
      // respondido_em
      expect(await tenta({ resposta: 'sem_resposta', respondido: true })).toBe('23514')
      expect(await tenta({ resposta: 'nao_vi', respondido: false })).toBe('23514')
      expect(await tenta({ resposta: 'sem_resposta', respondido: false })).toBeNull()
    })
  })

  it('(b2) venceu_nova sem variante_vencedora é recusada pelo banco (Phil m7)', async () => {
    await tx(async () => {
      expect(await erro(`insert into public.ab_native_tests (site_id, video_id, youtube_video_id, origem, campos, estado, confirmado_em, variantes, resposta_dono, respondido_em)
        values ($1, $2, 'abcdefghijk', 'confirmado', '{titulo}', 'em_andamento', now(), $3::jsonb, 'venceu_nova', now())`, [siteId, videoId, FICHA2])).toBe('23514')
    })
  })

  it('(a2) check3 que sobra por definição diferente derruba a migration alto, em vez de passar calado (Yannis M2)', async () => {
    const sql = readFileSync(resolve(__dirname, '../../../../supabase/migrations/20261021000004_ab_lab_f1a_dado.sql'), 'utf8')
    await tx(async () => {
      await pg.query('alter table public.ab_native_tests add constraint f1a_check3_disfarcado check (((vencedor_titulo is null) = (vencedor_fonte is null)) and true) not valid')
      await pg.query('savepoint m')
      await expect(pg.query(sql)).rejects.toThrow(/check3/)
      await pg.query('rollback to savepoint m')
    })
  })

  it('(e) ficha: rascunho passa, 4 variantes e campo fora recusados', async () => {
    await tx(async () => {
      const ins = (campos: string, variantes: string, video = videoId): Promise<string | null> =>
        erro(`insert into public.ab_native_fichas (site_id, video_id, campos, variantes) values ($1, $2, $3::text[], $4::jsonb)`, [siteId, video, campos, variantes])
      expect(await ins('{}', '[]')).toBeNull()
      expect(await ins('{titulo,miniatura}', '[]', video2)).toBeNull()
      expect(await erro(`delete from public.ab_native_fichas where site_id = $1`, [siteId])).toBeNull()
      expect(await ins('{}', '[1,2,3,4]')).toBe('23514')
      expect(await ins('{descricao}', '[]')).toBe('23514')
      expect(await ins('{}', '{}')).toBe('23514')
    })
  })

  it('(f) uma ficha aberta por vídeo; descartada libera', async () => {
    await tx(async () => {
      const ins = (): Promise<string | null> => erro(`insert into public.ab_native_fichas (site_id, video_id) values ($1, $2)`, [siteId, videoId])
      expect(await ins()).toBeNull()
      expect(await ins()).toBe('23505')
      await pg.query(`update public.ab_native_fichas set descartada_em = now() where site_id = $1 and video_id = $2`, [siteId, videoId])
      expect(await ins()).toBeNull()
    })
  })

  it('(g) RLS: sem papel de edição lê 0 linhas com GUC falsificado; editor lê; insert recusado (42501)', async () => {
    const sem = randomUUID(); const editor = randomUUID(); usuarios.push(sem, editor)
    for (const id of [sem, editor]) await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [id, id + '@f1a.test'])
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor')`, [siteId, editor])
    await pg.query(`insert into public.ab_native_fichas (site_id, video_id) values ($1, $2)`, [siteId, videoId])
    try {
      const como = async (quem: string, sql: string, params: unknown[]): Promise<{ rows: number; code: string | null }> => {
        await pg.query('begin')
        try {
          await pg.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: quem, role: 'authenticated' })])
          await pg.query(`select set_config('app.site_id', $1, true)`, [siteId])
          await pg.query('set local role authenticated')
          const r = await pg.query(sql, params)
          return { rows: r.rowCount ?? 0, code: null }
        } catch (e) { return { rows: 0, code: (e as { code?: string }).code ?? null } } finally { await pg.query('rollback') }
      }
      const semLeitura = await como(sem, 'select 1 from public.ab_native_fichas where site_id = $1', [siteId])
      expect(semLeitura).toEqual({ rows: 0, code: null })
      expect((await como(editor, 'select 1 from public.ab_native_fichas where site_id = $1', [siteId])).rows).toBe(1)
      expect((await como(editor, 'insert into public.ab_native_fichas (site_id, video_id) values ($1, $2)', [siteId, videoId])).code).toBe('42501')
    } finally {
      await pg.query('delete from public.ab_native_fichas where site_id = $1', [siteId])
    }
  })

  it('(g2) apagar o usuário de criada_por: a ficha continua, criada_por nulo (on delete set null)', async () => {
    const u = randomUUID(); usuarios.push(u)
    await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [u, u + '@f1a.test'])
    const f = String((await pg.query(`insert into public.ab_native_fichas (site_id, video_id, criada_por) values ($1, $2, $3) returning id`, [siteId, videoId, u])).rows[0].id)
    try {
      const fk = await pg.query(`select confdeltype from pg_constraint where conrelid = 'public.ab_native_fichas'::regclass and contype = 'f' and confrelid = 'auth.users'::regclass`)
      expect(fk.rows[0].confdeltype).toBe('n')
      await pg.query('delete from auth.users where id = $1', [u])
      const r = await pg.query('select criada_por from public.ab_native_fichas where id = $1', [f])
      expect(r.rowCount).toBe(1)
      expect(r.rows[0].criada_por).toBeNull()
    } finally {
      await pg.query('delete from public.ab_native_fichas where id = $1', [f])
    }
  })

  it('(g3) dois update na mesma transação: atualizada_em diferente', async () => {
    await tx(async () => {
      const f = String((await pg.query(`insert into public.ab_native_fichas (site_id, video_id) values ($1, $2) returning id`, [siteId, videoId])).rows[0].id)
      await pg.query(`update public.ab_native_fichas set campos = '{titulo}' where id = $1`, [f])
      const a = String((await pg.query(`select atualizada_em::text as t from public.ab_native_fichas where id = $1`, [f])).rows[0].t)
      await pg.query(`update public.ab_native_fichas set campos = '{miniatura}' where id = $1`, [f])
      const b = String((await pg.query(`select atualizada_em::text as t from public.ab_native_fichas where id = $1`, [f])).rows[0].t)
      expect(b).not.toBe(a)
    })
  })

  it('(h) a leitura "ficha mais recente do vídeo" usa ab_native_fichas_recente', async () => {
    await pg.query('begin')
    try {
      await pg.query('set local enable_seqscan = off')
      const r = await pg.query(`explain select * from public.ab_native_fichas where site_id = $1 and video_id = $2 order by criada_em desc limit 1`, [siteId, videoId])
      expect(r.rows.map((x) => String(x['QUERY PLAN'])).join('\n')).toContain('ab_native_fichas_recente')
    } finally { await pg.query('rollback') }
  })
})
