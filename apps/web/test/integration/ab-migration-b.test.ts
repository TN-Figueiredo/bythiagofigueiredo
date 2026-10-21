import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite, seedYoutubeChannelAndVideo, clienteServico } from '../helpers/db-seed'

// Migration B (A/B Lab): o SQL como fixture, provado no bythiago_int. O arquivo de migration real só nasce no dia B
// (db:new, cópia byte a byte de fixtures/ab-migration-b.sql). Cada `it` roda dentro de uma transação desfeita; a fixture
// `-pre` devolve a forma de antes dentro dela, então o teste é igual no banco local (antes da B) e no do CI (já migrado).
const DIR = join(__dirname, 'fixtures')
const SQL_B = readFileSync(join(DIR, 'ab-migration-b.sql'), 'utf8')
const SQL_PRE = readFileSync(join(DIR, 'ab-migration-b-pre.sql'), 'utf8')
const URL_DB = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g

async function conectar(): Promise<Client> {
  const c = new Client({ connectionString: URL_DB })
  await c.connect()
  return c
}
async function colunaExiste(c: Client, tabela: string, coluna: string): Promise<boolean> {
  const r = await c.query(
    `select 1 from pg_attribute where attrelid = $1::regclass and attname = $2 and not attisdropped`, [`public.${tabela}`, coluna])
  return r.rowCount === 1
}
async function tabelaExiste(c: Client, nome: string): Promise<boolean> {
  const r = await c.query(`select to_regclass($1) is not null as existe`, [`public.${nome}`])
  return r.rows[0].existe === true
}
async function funcoes(c: Client, nome: string): Promise<number> {
  const r = await c.query(`select count(*)::int as n from pg_proc where proname = $1 and pronamespace = 'public'::regnamespace`, [nome])
  return r.rows[0].n as number
}
async function aplicar(c: Client): Promise<void> {
  // as sementes da mesma transação deixam gatilhos de FK pendentes, que travariam o ALTER; na migration real não há
  await c.query('set constraints all immediate')
  await c.query(SQL_B)
}
async function catalogo(c: Client) {
  return {
    orig: await colunaExiste(c, 'ab_tests', 'original_description'),
    desc: await colunaExiste(c, 'ab_test_variants', 'description_text'),
    links: await tabelaExiste(c, 'ab_test_tracked_links'),
    fn: await funcoes(c, 'create_playoff_test'),
  }
}
const ANTES = { orig: true, desc: true, links: true, fn: 1 }
const DEPOIS = { orig: false, desc: false, links: false, fn: 0 }

describe.skipIf(skipIfNoLocalDb())('Migration B (fixture)', () => {
  let siteId = ''
  let channelId = ''
  let videoId = ''
  let jaMigrado = false
  let seq = 0

  beforeAll(async () => {
    const db = clienteServico()
    const s = await seedSite(db)
    siteId = s.siteId
    const v = await seedYoutubeChannelAndVideo(db, siteId)
    channelId = v.channelId
    videoId = v.videoId
    const c = await conectar()
    try { jaMigrado = !(await colunaExiste(c, 'ab_tests', 'original_description')) } finally { await c.end() }
  })

  afterAll(async () => {
    const c = await conectar()
    try {
      // Guarda do banco dos outros terminais: nenhum teste pode ter aplicado a B de verdade aqui.
      if (!jaMigrado) expect(await catalogo(c)).toEqual(ANTES)
    } finally { await c.end() }
    const db = clienteServico()
    await db.from('youtube_videos').delete().eq('id', videoId)
    await db.from('youtube_channels').delete().eq('id', channelId)
    await db.from('sites').delete().eq('id', siteId)
  })

  async function emTransacao(fn: (c: Client) => Promise<void>, preparar = true): Promise<void> {
    const c = await conectar()
    try {
      await c.query('begin')
      if (preparar) {
        await c.query(SQL_PRE)
        await c.query('truncate public.ab_tests cascade')
        await c.query(`delete from public.tracked_links where source_type = 'ab_test'`)
      }
      await fn(c)
    } finally {
      await c.query('rollback').catch(() => undefined)
      await c.end()
    }
  }

  async function semearTeste(
    c: Client,
    o: { status?: string; parent?: string | null; original?: string | null; criadoEm?: string; variantes?: number } = {},
  ): Promise<string> {
    seq += 1
    const yv = randomUUID().replace(/-/g, '').slice(0, 11)
    const vid = (await c.query(
      `insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at, duration_seconds)
       values ($1, $2, $3, 'mb', now(), 300) returning id`, [siteId, channelId, yv])).rows[0].id as string
    const r = await c.query(
      `insert into public.ab_tests (site_id, youtube_video_id, name, status, original_thumbnail_url, parent_test_id, original_description, created_at)
       values ($1, $2, $3, $4, 'https://i.ytimg.com/vi/x/hqdefault.jpg', $5, $6, coalesce($7::timestamptz, now())) returning id`,
      [siteId, vid, `mb-${seq}`, o.status ?? 'completed', o.parent ?? null, o.original ?? null, o.criadoEm ?? null])
    const id = r.rows[0].id as string
    for (let i = 0; i < (o.variantes ?? 0); i++) {
      await c.query(`insert into public.ab_test_variants (test_id, label, is_original, sort_order) values ($1, $2, $3, $4)`,
        [id, String.fromCharCode(65 + i), i === 0, i])
    }
    return id
  }

  it('banco sem bloqueio: somem as duas colunas, a tabela e a função; ab_tests e ab_test_variants ficam', async () => {
    await emTransacao(async (c) => {
      await semearTeste(c, { original: 'x', criadoEm: '2026-10-01', variantes: 2 })
      await aplicar(c)
      expect(await catalogo(c)).toEqual(DEPOIS)
      expect((await c.query('select count(*)::int as n from public.ab_test_variants')).rows[0].n).toBe(2)
      const t = (await c.query('select id from public.ab_tests')).rows[0].id as string
      await c.query(`insert into public.ab_test_variants (test_id, label, is_original, sort_order) values ($1, 'Z', false, 9)`, [t])
    })
  })

  it('aplicar duas vezes não dá erro', async () => {
    await emTransacao(async (c) => {
      await semearTeste(c, { original: 'x', criadoEm: '2026-10-01', variantes: 2 })
      await aplicar(c)
      await aplicar(c)
      expect(await catalogo(c)).toEqual(DEPOIS)
    })
  })

  it('avisa quantos testes têm original_description', async () => {
    await emTransacao(async (c) => {
      await semearTeste(c, { original: 'a', criadoEm: '2026-10-01' })
      await semearTeste(c, { original: 'b', criadoEm: '2026-10-02' })
      await semearTeste(c, { original: null })
      const avisos: string[] = []
      c.on('notice', (n) => { avisos.push(n.message) })
      await aplicar(c)
      expect(avisos.join('\n')).toContain('2 teste(s) com original_description')
    })
  })

  describe('abortos: nada muda', () => {
    const casos: Array<{ nome: string; semear: (c: Client) => Promise<string | null>; trecho: (id: string | null) => string[] }> = [
      { nome: 'teste active', semear: (c) => semearTeste(c, { status: 'active' }), trecho: (id) => [id!, '(active)'] },
      { nome: 'teste paused', semear: (c) => semearTeste(c, { status: 'paused' }), trecho: (id) => [id!, '(paused)'] },
      {
        nome: 'playoff draft com pai completed',
        semear: async (c) => {
          const pai = await semearTeste(c, { status: 'completed' })
          return semearTeste(c, { status: 'draft', parent: pai })
        },
        trecho: (id) => ['playoff(s) vivo(s)', id!],
      },
      {
        nome: 'link de A/B em tracked_links',
        semear: async (c) => {
          await c.query(`insert into public.tracked_links (site_id, code, destination_url, source_type) values ($1, $2, 'https://example.com', 'ab_test')`, [siteId, `mb${Date.now()}`])
          return null
        },
        trecho: () => ['1 link(s) de A/B'],
      },
      {
        nome: 'linha em ab_test_tracked_links',
        semear: async (c) => {
          const t = await semearTeste(c, { variantes: 1 })
          const v = (await c.query('select id from public.ab_test_variants where test_id = $1', [t])).rows[0].id as string
          const l = (await c.query(`insert into public.tracked_links (site_id, code, destination_url) values ($1, $2, 'https://example.com') returning id`, [siteId, `mb${Date.now()}x`])).rows[0].id as string
          await c.query(`insert into public.ab_test_tracked_links (ab_test_id, variant_id, link_id, template_name, short_code) values ($1, $2, $3, 'd', 's')`, [t, v, l])
          return null
        },
        trecho: () => ['1 linha(s) em ab_test_tracked_links'],
      },
      {
        nome: 'variante com description_text vazio',
        semear: async (c) => {
          const t = await semearTeste(c, { variantes: 1 })
          const v = (await c.query(`update public.ab_test_variants set description_text = '' where test_id = $1 returning id`, [t])).rows[0].id as string
          return v
        },
        trecho: (id) => ['1 variante(s) com description_text', id!],
      },
      {
        nome: 'original_description gravado depois da P3',
        semear: (c) => semearTeste(c, { original: 'x', criadoEm: '2026-10-16' }),
        trecho: (id) => ['gravado depois da P3', id!],
      },
      {
        nome: 'sobrecarga de create_playoff_test',
        semear: async (c) => {
          await c.query(`create function public.create_playoff_test(p_parent_test_id uuid) returns uuid language sql as 'select null::uuid'`)
          return null
        },
        trecho: () => ['assinatura inesperada (p_parent_test_id uuid)'],
      },
    ]

    it.each(casos)('$nome', async ({ semear, trecho }) => {
      await emTransacao(async (c) => {
        const id = await semear(c)
        const antes = await catalogo(c)
        expect(antes).toMatchObject({ orig: true, desc: true, links: true })
        expect(antes.fn).toBeGreaterThanOrEqual(1)
        await c.query('savepoint s')
        let msg = ''
        try { await aplicar(c) } catch (e) { msg = e instanceof Error ? e.message : String(e) }
        await c.query('rollback to savepoint s')
        expect(msg).toContain('Migration B abortada')
        for (const t of trecho(id)) expect(msg).toContain(t)
        expect(await catalogo(c)).toEqual(antes)
      })
    })

    it('25 testes active: conta 25 e lista exatamente 20 ids', async () => {
      await emTransacao(async (c) => {
        for (let i = 0; i < 25; i++) await semearTeste(c, { status: 'active' })
        await c.query('savepoint s')
        let msg = ''
        try { await aplicar(c) } catch (e) { msg = e instanceof Error ? e.message : String(e) }
        await c.query('rollback to savepoint s')
        expect(msg).toContain('25 teste(s)')
        expect(msg.match(UUID_RE)).toHaveLength(20)
        expect(await catalogo(c)).toEqual(ANTES)
      })
    })
  })

  it('não bloqueiam: playoff completed, teste queued, rascunho sem playoff', async () => {
    await emTransacao(async (c) => {
      const pai = await semearTeste(c, { status: 'completed' })
      await semearTeste(c, { status: 'completed', parent: pai })
      await semearTeste(c, { status: 'queued' })
      await semearTeste(c, { status: 'draft' })
      await aplicar(c)
      expect(await catalogo(c)).toEqual(DEPOIS)
    })
  })

  it.each(['ab_test_variants', 'tracked_links'])('lock ocupado em %s: falha em ~5 s com 55P03 e nada muda', async (tabela) => {
    const outro = await conectar()
    const c = await conectar()
    try {
      const antes = await catalogo(c)
      await outro.query('begin')
      await outro.query(`lock table public.${tabela} in access share mode`)
      await c.query('begin')
      const seg = await c.query(
        `select 1 from pg_locks where relation = $1::regclass and mode = 'AccessShareLock' and granted`, [`public.${tabela}`])
      expect(seg.rowCount).toBeGreaterThanOrEqual(1)
      const t0 = Date.now()
      let codigo = ''
      try { await aplicar(c) } catch (e) { codigo = (e as { code?: string }).code ?? 'sem-codigo' }
      const ms = Date.now() - t0
      expect(codigo).toBe('55P03')
      expect(ms).toBeLessThan(8000)
      await c.query('rollback')
      expect(await catalogo(c)).toEqual(antes)
    } finally {
      await c.query('rollback').catch(() => undefined)
      await outro.query('rollback').catch(() => undefined)
      await c.end()
      await outro.end()
    }
  }, 20000)

  it('no banco já migrado (como o CI): a -pre devolve a forma de antes e a B roda igual', async () => {
    await emTransacao(async (c) => {
      await semearTeste(c, { original: 'x', criadoEm: '2026-10-01', variantes: 2 })
      await aplicar(c)
      await c.query(SQL_PRE)
      expect(await catalogo(c)).toEqual(ANTES)
      await aplicar(c)
      expect(await catalogo(c)).toEqual(DEPOIS)
      expect((await c.query('select count(*)::int as n from public.ab_test_variants')).rows[0].n).toBe(2)
    })
  })
})
