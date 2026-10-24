// @vitest-environment node
/**
 * A5 · S4 (T10, B2): RLS e privilégios de yt_watch_* contra Postgres de verdade (GUC app.site_id forjado por NÃO superusuário).
 * Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/a5-s4-watch-rls.test.ts --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { travarS4, destravarS4 } from '../helpers/a5-s4-trava'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { leituraValida, thumbValida } from '../fixtures/watch-html/casos-recusados'
import { apagarSites } from '../helpers/limpa-cena'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 300_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const TABELAS = ['yt_watch_alvos', 'yt_watch_thumbs', 'yt_watch_readings'] as const
const FUNCOES = [
  'public.yt_watch_conciliar(timestamptz, jsonb)', 'public.yt_watch_gravar_disparo(jsonb)',
  'public.yt_watch_poda(timestamptz, integer)', 'public.yt_watch_prova(timestamptz, boolean, integer)',
] as const
type Who = 'anon' | 'sem' | 'editor' | 'outroSite'

describe.skipIf(skipIfNoLocalDb())('A5 S4 B2: RLS de yt_watch_* (banco local, GUC forjado)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const sites: string[] = []
  const usuarios: string[] = []
  let siteA = ''; let siteB = ''
  const users = { sem: randomUUID(), editor: randomUUID(), outroSite: randomUUID() }

  async function comRepeticao(sql: string, args: unknown[]): Promise<void> {
    for (let i = 0; ; i++) {
      try { await pg.query(sql, args); return } catch (e) {
        if ((e as { code?: string }).code !== '40P01' || i >= 8) throw e
        await new Promise(r => setTimeout(r, 150 * (i + 1) + Math.random() * 200))
      }
    }
  }
  async function comRepeticaoDe(acao: () => Promise<void>): Promise<void> {   // mesmo laço do comRepeticao, para o helper de limpeza
    for (let i = 0; ; i++) {
      try { await acao(); return } catch (e) {
        if ((e as { code?: string }).code !== '40P01' || i >= 8) throw e
        await new Promise(r => setTimeout(r, 150 * (i + 1) + Math.random() * 200))
      }
    }
  }

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    await travarS4(pg)
    siteA = (await seedSite(sb, { siteSlug: 's4rls-' + randomUUID(), siteName: 'S4 RLS' })).siteId; sites.push(siteA)
    siteB = (await seedSite(sb, { siteSlug: 's4rls-' + randomUUID(), siteName: 'S4 RLS' })).siteId; sites.push(siteB)
    for (const id of Object.values(users)) {
      usuarios.push(id)
      await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [id, id + '@s4.test'])
    }
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor'), ($3, $4, 'editor')`, [siteA, users.editor, siteB, users.outroSite])
    await pg.query(`insert into public.yt_watch_alvos (site_id, youtube_video_id, tipo, motivo_ate, coleta_ate, hora_base_min, proxima_rodada_em)
      values ($1, 'qIg9a7vqcNo', 'proprio', 'janela_propria', now() + interval '1 day', 10, now())`, [siteA])
    const t = thumbValida()
    await pg.query(`insert into public.yt_watch_thumbs (site_id, youtube_video_id, host, variante, http, etag, sha16, dhash, largura, altura, primeira_vista, ultima_vista)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())`, [siteA, t.youtube_video_id, t.host, t.variante, t.http, t.etag, t.sha16, t.dhash, t.largura, t.altura])
    const l = leituraValida()
    await pg.query(`insert into public.yt_watch_readings (site_id, youtube_video_id, lida_em, rodada_id, origem_rede, versao_leitor, http, idioma, titulo_oficial, titulo_oficial_fonte, titulo_exibido, renderers_presentes, rendicoes_sqp)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [siteA, l.youtube_video_id, l.lida_em, l.rodada_id, l.origem_rede, l.versao_leitor, l.http, l.idioma, l.titulo_oficial, l.titulo_oficial_fonte, l.titulo_exibido, l.renderers_presentes, l.rendicoes_sqp])
  })
  afterAll(async () => {
    try {
      if (sites.length > 0) await comRepeticao('delete from public.site_memberships where site_id = any($1::uuid[])', [sites])
      if (sites.length > 0) await comRepeticao('delete from public.audit_log where site_id = any($1::uuid[])', [sites])
      if (usuarios.length > 0) await comRepeticao('delete from auth.users where id = any($1::uuid[])', [usuarios])
      if (sites.length > 0) await comRepeticaoDe(() => apagarSites(pg, 'id = any($1::uuid[])', [sites])) // cascade apaga yt_watch_*
    } finally { await destravarS4(pg); await pg.end() }
  })

  /** Lê como `who` numa transação desfeita, com o GUC app.site_id forjado (papel anon/authenticated, sem superusuário). */
  async function lerComo(who: Who, tabela: string, guc: string): Promise<number> {
    await pg.query('begin')
    try {
      if (who !== 'anon') await pg.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: users[who], role: 'authenticated' })])
      await pg.query(`select set_config('app.site_id', $1, true)`, [guc])
      await pg.query(who === 'anon' ? 'set local role anon' : 'set local role authenticated')
      return (await pg.query(`select 1 from public.${tabela} where site_id = $1`, [siteA])).rowCount ?? 0
    } finally {
      await pg.query('rollback')
    }
  }

  it('anon não tem select nas 3 tabelas (privilégio e consulta)', async () => {
    for (const t of TABELAS) {
      expect((await pg.query(`select has_table_privilege('anon', $1, 'SELECT') as a`, ['public.' + t])).rows[0].a, t).toBe(false)
      await expect(lerComo('anon', t, siteA), t).rejects.toMatchObject({ code: '42501' })
    }
  })

  it('privilégios: authenticated só SELECT; anon nenhum', async () => {
    for (const t of TABELAS) {
      for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
        const r = await pg.query(`select has_table_privilege('anon', $1, $2) as a, has_table_privilege('authenticated', $1, $2) as u`, ['public.' + t, priv])
        expect(r.rows[0].a, `anon ${priv} ${t}`).toBe(false)
        expect(r.rows[0].u, `authenticated ${priv} ${t}`).toBe(priv === 'SELECT')
      }
    }
  })

  it('catálogo: RLS ligada e uma policy de SELECT por tabela, nenhuma de escrita', async () => {
    for (const t of TABELAS) {
      expect((await pg.query(`select relrowsecurity from pg_class where oid = $1::regclass`, ['public.' + t])).rows[0].relrowsecurity, t).toBe(true)
      const pol = await pg.query(`select policyname, cmd from pg_policies where schemaname = 'public' and tablename = $1`, [t])
      expect(pol.rows).toEqual([{ policyname: `${t}_select`, cmd: 'SELECT' }])
    }
  })

  it('RLS: o editor do site lê 1 (controle positivo); sem vínculo e editor de outro site leem 0, mesmo com o GUC forjado', async () => {
    for (const t of TABELAS) {
      for (const guc of [siteA, siteB, '']) {
        expect(await lerComo('editor', t, guc), `editor ${t}, GUC ${guc || 'vazio'}`).toBe(1)
        expect(await lerComo('sem', t, guc), `sem vínculo ${t}, GUC ${guc || 'vazio'}`).toBe(0)
        expect(await lerComo('outroSite', t, guc), `editor de B ${t}, GUC ${guc || 'vazio'}`).toBe(0)
      }
    }
  })

  it('authenticated não escreve (42501) e as funções só executam como service_role', async () => {
    await pg.query('begin')
    try {
      await pg.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: users.editor, role: 'authenticated' })])
      await pg.query('set local role authenticated')
      await expect(pg.query(`delete from public.yt_watch_alvos where site_id = $1`, [siteA])).rejects.toMatchObject({ code: '42501' })
    } finally { await pg.query('rollback') }
    for (const f of FUNCOES) {
      const r = await pg.query(`select has_function_privilege('anon', $1, 'EXECUTE') as a, has_function_privilege('authenticated', $1, 'EXECUTE') as u, has_function_privilege('service_role', $1, 'EXECUTE') as s`, [f])
      expect(r.rows[0], f).toEqual({ a: false, u: false, s: true })
    }
  })
})
