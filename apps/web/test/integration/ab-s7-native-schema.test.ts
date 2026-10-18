// @vitest-environment node
/**
 * S7 fase 1 (T6): schema, funções e CAS do registro do teste nativo. Banco: SÓ o `bythiago_int`, com o rascunho já aplicado por `psql -f`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-s7-native --no-file-parallelism
 * Os testes só leem o catálogo e escrevem dentro de begin/rollback (exceto o CAS pelo PostgREST, que limpa depois).
 * Função sem EXECUTE nunca é chamada como authenticated (SIGSEGV): `has_function_privilege`.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

vi.setConfig({ testTimeout: 60_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const H = 3_600_000
const iso = (ms: number): string => new Date(ms).toISOString()

describe.skipIf(skipIfNoLocalDb())('S7 f1: schema e funções do registro do teste nativo', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let siteId: string
  let videoId: string
  let video2: string
  let canal: string
  const ytId = (): string => 'y' + randomUUID().replace(/-/g, '').slice(0, 10)

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    siteId = (await seedSite(sb)).siteId
    const k = randomUUID().replace(/-/g, '')
    canal = String((await pg.query(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [siteId, 'UC' + k.slice(0, 20), '@s7' + k.slice(0, 8), 'UU' + k.slice(0, 20), 's7-' + k.slice(0, 8)])).rows[0].id)
    const mk = async (): Promise<string> => String((await pg.query(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at)
      values ($1, $2, $3, 'T', now()) returning id`, [siteId, canal, ytId()])).rows[0].id)
    videoId = await mk(); video2 = await mk()
  })
  afterAll(async () => {
    try {
      await pg.query('delete from public.youtube_videos where site_id = $1', [siteId])
      await pg.query('delete from public.youtube_channels where site_id = $1', [siteId])
      await pg.query('delete from public.sites where id = $1', [siteId])
    } finally {
      await pg.end()
    }
  })

  /** Roda `fn` dentro de begin ... rollback. */
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
  const regSql = (estado = 'em_andamento'): string =>
    `insert into public.ab_native_tests (site_id, video_id, youtube_video_id, origem, campos, estado, variantes_titulo, primeira_vista, ultima_vista, versao_regra, encerrado_em)
     values ($1, $2, 'abcdefghijk', 'detectado', '{titulo}', '${estado}', '["a","b"]'::jsonb, now() - interval '1 day', now(), 1, ${estado === 'em_andamento' ? 'null' : 'now()'})`
  const avSql = (estado: string, extra = ''): string =>
    `insert into public.ab_native_avaliacoes (site_id, video_id, avaliada_em, estado_14, versao_regra, erro, retroativa ${extra ? ', ' + extra.split('=')[0] : ''})
     values ($1, $2, $3, '${estado}', 1, ${estado === 'erro' ? "'timeout'" : 'null'}, false ${extra ? ', ' + extra.split('=')[1] : ''})`

  it('objetos existem no catálogo', async () => {
    for (const t of ['ab_native_tests', 'ab_native_avaliacoes', 'ab_guarda_liberacoes']) {
      const r = await pg.query(`select to_regclass($1) as x, (select relrowsecurity from pg_class where oid = to_regclass($1)) as rls`, ['public.' + t])
      expect(r.rows[0].x, t).not.toBeNull()
      expect(r.rows[0].rls, t).toBe(true)
    }
    for (const f of ['yt_watch_reter(uuid,text,timestamptz)', 'ab_native_ultimas(uuid[])', 'ab_native_poda(timestamptz,integer)', 'ab_native_reproduzir(uuid,uuid,jsonb,jsonb)']) {
      expect((await pg.query(`select to_regprocedure($1) as x`, ['public.' + f])).rows[0].x, f).not.toBeNull()
    }
    const g = await pg.query(`select tgname from pg_trigger where tgrelid = 'public.ab_native_tests'::regclass and tgname = 'ab_native_tests_updated_at'`)
    expect(g.rowCount).toBe(1)
    const i = await pg.query(`select 1 from pg_indexes where indexname = 'ab_native_avaliacoes_poda'`)
    expect(i.rowCount).toBe(1)
  })

  it('CHECKs do §7.1 e §7.2 recusam o inválido', async () => {
    await tx(async () => {
      expect(await erro(regSql('x'), [siteId, videoId])).toBe('23514')
      expect(await erro(`insert into public.ab_native_tests (site_id, video_id, youtube_video_id, origem, campos, estado, variantes_titulo, primeira_vista, versao_regra)
        values ($1, $2, 'abcdefghijk', 'detectado', '{video}', 'em_andamento', '["a","b"]', now(), 1)`, [siteId, videoId])).toBe('23514')
      expect(await erro(regSql('encerrado').replace(', now())', ', null)'), [siteId, videoId])).toBe('23514')
      expect(await erro(avSql('provavel_teste', "aviso='x'"), [siteId, videoId, iso(Date.now())])).toBe('23514')
      expect(await erro(avSql('erro').replace("'timeout'", 'null'), [siteId, videoId, iso(Date.now())])).toBe('23514')
      expect(await erro(avSql('provavel_teste', "aviso='variantes_demais'"), [siteId, videoId, iso(Date.now())])).toBeNull()
    })
  })

  it('o índice parcial recusa 2 abertos no mesmo vídeo', async () => {
    await tx(async () => {
      expect(await erro(regSql(), [siteId, videoId])).toBeNull()
      expect(await erro(regSql(), [siteId, videoId])).toBe('23505')
      expect(await erro(regSql('encerrado'), [siteId, videoId])).toBeNull()
    })
  })

  it('CAS: updated_at muda a cada update, ida e volta pelo PostgREST como texto cru (microssegundos e +00:00)', async () => {
    const id = randomUUID()
    try {
      await pg.query(regSql().replace('insert into public.ab_native_tests (', 'insert into public.ab_native_tests (id, ').replace('values ($1, $2,', `values ('${id}', $1, $2,`), [siteId, video2])
      const l1 = await sb.from('ab_native_tests').select('updated_at').eq('id', id).single()
      expect(l1.error).toBeNull()
      const lido = String(l1.data!.updated_at)
      expect(lido).toMatch(/\.\d{4,6}\+00:00$/)
      const ok = await sb.from('ab_native_tests').update({ ultima_vista: iso(Date.now() + H) }).eq('id', id).eq('updated_at', lido).select('id')
      expect(ok.error).toBeNull()
      expect(ok.data).toHaveLength(1)
      const l2 = await sb.from('ab_native_tests').select('updated_at').eq('id', id).single()
      expect(String(l2.data!.updated_at)).not.toBe(lido)
      const perdido = await sb.from('ab_native_tests').update({ ultima_vista: iso(Date.now() + 2 * H) }).eq('id', id).eq('updated_at', lido).select('id')
      expect(perdido.error).toBeNull()
      expect(perdido.data).toHaveLength(0)
    } finally {
      await pg.query('delete from public.ab_native_tests where id = $1', [id])
    }
  })

  it('yt_watch_reter: plpgsql, sem yt_watch_alvos a criação não falha e a chamada dá 42P01', async () => {
    const f = await pg.query(`select l.lanname from pg_proc p join pg_language l on l.oid = p.prolang where p.oid = to_regprocedure('public.yt_watch_reter(uuid,text,timestamptz)')`)
    expect(f.rows[0].lanname).toBe('plpgsql')
    const tem = (await pg.query(`select to_regclass('public.yt_watch_alvos') as x`)).rows[0].x
    if (tem === null) {
      await tx(async () => { expect(await erro(`select public.yt_watch_reter($1, 'abcdefghijk', now())`, [siteId])).toBe('42P01') })
    } else {
      await tx(async () => {
        // banco com a S4: nunca diminui, 0 sem alvo
        expect(Number((await pg.query(`select public.yt_watch_reter($1, 'zzzzzzzzzzz', now()) as n`, [siteId])).rows[0].n)).toBe(0)
      })
    }
  })

  it('ab_native_ultimas: alguma, ultima_em, ultima_ok_em, último erro, ultima_id e ultimo_erro_id', async () => {
    await tx(async () => {
      const t = Date.now()
      const a = async (estado: string, ms: number, retro = false): Promise<number> => Number((await pg.query(
        `insert into public.ab_native_avaliacoes (site_id, video_id, avaliada_em, estado_14, versao_regra, erro, retroativa)
         values ($1, $2, $3, $4, 1, ${estado === 'erro' ? "'timeout'" : 'null'}, $5) returning id`, [siteId, videoId, iso(ms), estado, retro])).rows[0].id)
      const u = async (): Promise<Record<string, unknown>> => (await pg.query(`select * from public.ab_native_ultimas($1::uuid[])`, [[videoId]])).rows[0]
      let r = await u()
      expect(r.alguma).toBe(false); expect(r.ultima_em).toBeNull(); expect(r.ultima_id).toBeNull()
      const e1 = await a('erro', t - 10 * H)
      r = await u()
      expect(r.alguma, 'erro não conta').toBe(false)
      expect(r.ultimo_erro_id).toBe(String(e1)); expect(r.ultima_id).toBe(String(e1)); expect(r.ultimo_erro).toBe('timeout')
      expect(r.ultima_ok_em).toBeNull()
      const retro = await a('provavel_teste', t - 9 * H, true)
      r = await u()
      expect(r.alguma, 'retroativa conta em alguma').toBe(true)
      expect(r.ultima_em, 'ultima_em ignora retroativas').not.toBeNull()
      expect(r.ultima_id).toBe(String(e1))
      expect(retro).toBeGreaterThan(e1)
      const ok = await a('insuficiente', t - 8 * H)
      const sr = await a('sem_rodada_nova', t - 6 * H)
      r = await u()
      expect(new Date(r.ultima_ok_em as Date).getTime()).toBe(t - 8 * H)
      expect(r.ultima_id).toBe(String(sr)); expect(r.ultimo_erro_id).toBe(String(e1))
      expect(new Date(r.ultimo_sem_rodada_em as Date).getTime()).toBe(t - 6 * H)
      expect(ok).toBeGreaterThan(retro)
      const e2 = await a('erro', t - 1 * H)
      r = await u()
      expect(r.ultimo_erro_id).toBe(String(e2)); expect(r.ultima_id).toBe(String(e2))
    })
  })

  it('ab_native_poda: só > 180 d, no máximo p_lote; p_lote 0 e 5001 dão 22023', async () => {
    await tx(async () => {
      const agora = Date.now()
      for (const d of [200, 190, 181, 179, 10]) {
        await pg.query(`insert into public.ab_native_avaliacoes (site_id, video_id, avaliada_em, estado_14, versao_regra) values ($1, $2, $3, 'sem_leitura', 1)`, [siteId, videoId, iso(agora - d * 24 * H)])
      }
      const n = async (lote: number): Promise<number> => Number((await pg.query(`select public.ab_native_poda($1, $2) as n`, [iso(agora), lote])).rows[0].n)
      expect(await n(2)).toBe(2)
      expect(await n(10)).toBe(1)
      expect(await n(10)).toBe(0)
      expect(Number((await pg.query(`select count(*) from public.ab_native_avaliacoes where video_id = $1`, [videoId])).rows[0].count)).toBe(2)
      expect(await erro(`select public.ab_native_poda(now(), 0)`)).toBe('22023')
      expect(await erro(`select public.ab_native_poda(now(), 5001)`)).toBe('22023')
    })
  })

  describe('ab_native_reproduzir', () => {
    const reg = (id: string, estado = 'em_andamento'): Record<string, unknown> => ({
      id, youtube_video_id: 'abcdefghijk', origem: 'detectado', campos: ['titulo'], estado, variantes_titulo: ['a', 'b'], votos_titulo: { a: 2, b: 3 },
      primeira_vista: iso(Date.now() - 30 * H), ultima_vista: iso(Date.now() - 2 * H), veredito: { estado: 'provavel_teste' }, versao_regra: 1,
      ...(estado === 'em_andamento' ? {} : { encerrado_em: iso(Date.now()) }),
    })
    const av = (registro: string | null, estado = 'provavel_teste', quando = Date.now()): Record<string, unknown> => ({
      avaliada_em: iso(quando), estado_14: estado, versao_regra: 1, registro_id: registro, retroativa: true, ...(estado === 'erro' ? { erro: 'timeout' } : {}),
    })
    const rep = async (reg: unknown[], avs: unknown[]): Promise<number> =>
      Number((await pg.query(`select public.ab_native_reproduzir($1, $2, $3::jsonb, $4::jsonb) as n`, [siteId, videoId, JSON.stringify(reg), JSON.stringify(avs)])).rows[0].n)
    const contar = async (t: string): Promise<number> => Number((await pg.query(`select count(*) from public.${t} where video_id = $1`, [videoId])).rows[0].count)

    it('duas chamadas seguidas gravam N e depois 0, sem duplicar', async () => {
      await tx(async () => {
        const id = randomUUID()
        expect(await rep([reg(id)], [av(id, 'provavel_teste', Date.now() - 3 * H), av(id)])).toBe(2)
        expect(await rep([reg(randomUUID())], [av(null)])).toBe(0)
        expect(await contar('ab_native_tests')).toBe(1)
        expect(await contar('ab_native_avaliacoes')).toBe(2)
      })
    })
    it('avaliação inválida aborta tudo: nenhum registro fica', async () => {
      await tx(async () => {
        const id = randomUUID()
        expect(await erro(`select public.ab_native_reproduzir($1, $2, $3::jsonb, $4::jsonb)`, [siteId, videoId, JSON.stringify([reg(id)]), JSON.stringify([av(id, 'x')])])).toBe('23514')
        await pg.query('rollback to savepoint s').catch(() => undefined)
      })
      expect(await contar('ab_native_tests')).toBe(0)
    })
    it('uma avaliação erro anterior NÃO impede a reprodução', async () => {
      await tx(async () => {
        await pg.query(`insert into public.ab_native_avaliacoes (site_id, video_id, avaliada_em, estado_14, versao_regra, erro) values ($1, $2, now(), 'erro', 1, 'timeout')`, [siteId, videoId])
        const id = randomUUID()
        expect(await rep([reg(id)], [av(id)])).toBe(1)
      })
    })
    it('é plpgsql e contém pg_advisory_xact_lock; site e vídeo vêm dos parâmetros', async () => {
      const f = await pg.query(`select l.lanname, p.prosrc from pg_proc p join pg_language l on l.oid = p.prolang where p.oid = to_regprocedure('public.ab_native_reproduzir(uuid,uuid,jsonb,jsonb)')`)
      expect(f.rows[0].lanname).toBe('plpgsql')
      expect(f.rows[0].prosrc).toContain('pg_advisory_xact_lock')
      await tx(async () => {
        const id = randomUUID()
        await rep([{ ...reg(id), site_id: randomUUID(), video_id: randomUUID() }], [{ ...av(id), site_id: randomUUID(), video_id: randomUUID() }])
        expect(await contar('ab_native_tests')).toBe(1)
        expect(await contar('ab_native_avaliacoes')).toBe(1)
      })
    })
  })
})
