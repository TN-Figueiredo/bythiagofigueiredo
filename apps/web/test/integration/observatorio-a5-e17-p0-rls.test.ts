// @vitest-environment node
/**
 * A5 · E17 passo 0 (MG11), Tarefa 2: RLS do direito "ver desempenho privado" contra o banco local, com papel SEM superusuário
 * e com o GUC `app.site_id` FORJADO (itens 169, 232 e 236).
 *
 * Cada `it` roda numa transação só: aplica a MG11 (`garantirMg11`), semeia pela conexão `pg` (não pelo cliente de serviço),
 * consulta como `anon`/`authenticated` (`set local role` + `request.jwt.claims`) e DESFAZ no fim. Nada fica gravado.
 * Banco: SÓ o `bythiago_int` (fora da CI):
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e17-p0-rls.test.ts --no-file-parallelism
 * Erro 55P03 ou `lock_timeout` = banco ocupado por outro teste: esperar um minuto e repetir (não é falha da RLS).
 * Função sem EXECUTE NUNCA é chamada aqui como anon/authenticated (derruba este Postgres): as `_as` rodam só como postgres.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { garantirMg11 } from '../helpers/mg11'

vi.setConfig({ testTimeout: 90_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/** A lista das doze: leitura pelo direito. As que não existem no banco são puladas; as que existem TÊM de ter semente aqui. */
const DOZE = [
  'yt_own_video_daily', 'yt_own_video_reach_daily', 'yt_own_video_meta_daily', 'yt_own_video_coverage',
  'yt_own_video_retention', 'yt_own_video_dim_daily', 'yt_own_video_traffic_detail_daily', 'yt_own_video_reach_dim_daily',
  'yt_own_video_versions', 'yt_own_versions_state', 'competitor_video_comments', 'competitor_video_comment_marks',
] as const
const AUTORES = 'competitor_video_comment_authors'

const QUEM = ['super', 'orgadmin', 'editor', 'leitora', 'reporter', 'revogada', 'exmembro', 'editorB', 'sem'] as const
type Quem = (typeof QUEM)[number]

/** (ver, editar, privado) esperado de cada usuário em cada site: a matriz do Apêndice B. */
const MATRIZ: Record<Quem, { A: [boolean, boolean, boolean]; B: [boolean, boolean, boolean] }> = {
  super: { A: [true, true, true], B: [true, true, true] },
  orgadmin: { A: [true, true, true], B: [false, false, false] },
  editor: { A: [true, true, true], B: [false, false, false] },
  leitora: { A: [true, false, true], B: [false, false, false] },
  reporter: { A: [true, false, false], B: [false, false, false] },
  revogada: { A: [true, false, false], B: [false, false, false] },
  exmembro: { A: [false, false, false], B: [false, false, false] },
  editorB: { A: [false, false, false], B: [true, true, true] },
  sem: { A: [false, false, false], B: [false, false, false] },
}

interface Cen { a: string; b: string; orgA: string; raiz: string; u: Record<Quem, string>; dono: string; tabelas: string[] }
interface Res { n: number; rows: Array<Record<string, unknown>>; code: string | null }

const diaPt = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)

describe.skipIf(skipIfNoLocalDb())('A5 E17 passo 0 (MG11): RLS do direito contra o banco (papel sem superusuário, GUC forjado)', () => {
  let pg: Client

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
  })
  afterAll(async () => {
    await pg.end()
  })

  async function emTransacao<T>(corpo: () => Promise<T>): Promise<T> {
    await pg.query('begin')
    try {
      return await corpo()
    } finally {
      await pg.query('rollback')
    }
  }

  async function existe(t: string): Promise<boolean> {
    return (await pg.query<{ e: boolean }>(`select to_regclass('public.' || $1::text) is not null as e`, [t])).rows[0].e
  }

  /** Uma linha de cada tabela da lista que existe, mais a de autores, no site dado. Devolve os nomes semeados. */
  async function semearLinhas(site: string): Promise<string[]> {
    const x = randomUUID().replace(/-/g, '')
    const yt = 'y' + x.slice(0, 10)
    const canal = String((await pg.query(
      `insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug) values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`,
      [site, 'UC' + x.slice(0, 22), '@t' + x.slice(0, 8), 'UU' + x.slice(2, 24), 'teste-' + x.slice(0, 8)],
    )).rows[0].id)
    const dia = diaPt(5)
    const versao = 'views_ate_2025-03-30'
    const semeadas: string[] = []
    const sementes: Record<string, () => Promise<void>> = {
      yt_own_video_daily: async () => { await pg.query(`insert into public.yt_own_video_daily (youtube_video_id, day_pt, site_id, channel_id, views, metric_version) values ($1, $2, $3, $4, 3, $5)`, [yt, dia, site, canal, versao]) },
      yt_own_video_reach_daily: async () => { await pg.query(`insert into public.yt_own_video_reach_daily (youtube_video_id, day_pt, site_id, channel_id, source_report_id, report_create_time, metric_version) values ($1, $2, $3, $4, 'r1', now(), $5)`, [yt, dia, site, canal, versao]) },
      yt_own_video_meta_daily: async () => { await pg.query(`insert into public.yt_own_video_meta_daily (youtube_video_id, day_pt, site_id, channel_id, privacy_status, captured_at) values ($1, $2, $3, $4, 'public', now())`, [yt, dia, site, canal]) },
      yt_own_video_coverage: async () => { await pg.query(`insert into public.yt_own_video_coverage (youtube_video_id, metric_set, covered_from, covered_to, site_id, channel_id) values ($1, 'base', $2, $3, $4, $5)`, [yt, diaPt(10), diaPt(5), site, canal]) },
      yt_own_video_retention: async () => {
        await pg.query(
          `insert into public.yt_own_video_retention (youtube_video_id, window_kind, segment, window_end, window_start, requested_end, site_id, channel_id, points, point_count, metrics_returned, views_at_read, metric_version)
           values ($1, 'vida', 'organico', $2, $3, $2, $4, $5, '[{"a":1},{"a":2}]'::jsonb, 2, array['views'], 10, $6)`, [yt, diaPt(5), diaPt(30), site, canal, versao])
      },
      yt_own_video_dim_daily: async () => { await pg.query(`insert into public.yt_own_video_dim_daily (youtube_video_id, day_pt, dim_kind, dim_value, site_id, channel_id, views, metric_version) values ($1, $2, 'country', 'BR', $3, $4, 3, 'v')`, [yt, dia, site, canal]) },
      yt_own_video_traffic_detail_daily: async () => {
        await pg.query(
          `insert into public.yt_own_video_traffic_detail_daily (youtube_video_id, day_pt, source_type, detail, detail_hash, site_id, channel_id, views, source_report_id, report_create_time, metric_version)
           values ($1, $2, '4', 'termo privado', $3, $4, $5, 2, 'r1', now(), 'v')`, [yt, dia, '0'.repeat(64), site, canal])
      },
      yt_own_video_reach_dim_daily: async () => {
        await pg.query(
          `insert into public.yt_own_video_reach_dim_daily (youtube_video_id, day_pt, traffic_source_type, device_type, operating_system, site_id, channel_id, thumbnail_impressions, source_report_id, report_create_time, metric_version)
           values ($1, $2, '1', 'MOBILE', 'ANDROID', $3, $4, 50, 'r1', now(), 'v')`, [yt, dia, site, canal])
      },
    }
    for (const t of [...DOZE.filter((n) => !n.startsWith('competitor_')), ]) {
      if (!(await existe(t))) continue
      const semente = sementes[t]
      if (!semente) throw new Error(`a tabela ${t} existe no banco e esta semente não a conhece: acrescentar a semente dela (tabela que existe e não é semeada falha, não pula)`)
      await semente()
      semeadas.push(t)
    }
    // comentários: canal acompanhado, vídeo, o comentário, a marca e a identidade (autor)
    if (await existe('competitor_video_comments')) {
      const cc = String((await pg.query(`insert into public.competitor_channels (site_id, channel_id, channel_name) values ($1, $2, 'Teste') returning id`, [site, 'UC' + x.slice(0, 20)])).rows[0].id)
      const cv = String((await pg.query(`insert into public.competitor_videos (competitor_channel_id, video_id, published_at) values ($1, $2, now() - interval '3 days') returning id`, [cc, 'v' + x.slice(0, 10)])).rows[0].id)
      const comentario = String((await pg.query(
        `insert into public.competitor_video_comments (site_id, competitor_channel_id, video_id, youtube_comment_id, body, published_at, is_creator, first_seen_at, last_seen_at)
         values ($1, $2, $3, $4, 'texto inventado', now() - interval '2 days', false, now(), now()) returning id`, [site, cc, cv, 'c' + x.slice(0, 10)])).rows[0].id)
      semeadas.push('competitor_video_comments')
      if (await existe('competitor_video_comment_marks')) {
        await pg.query(`insert into public.competitor_video_comment_marks (comment_id, mark, site_id, likes) values ($1, 7, $2, 1)`, [comentario, site])
        semeadas.push('competitor_video_comment_marks')
      }
      if (await existe(AUTORES)) {
        await pg.query(`insert into public.competitor_video_comment_authors (comment_id, site_id, display_name, expires_at) values ($1, $2, 'Autor inventado', now() + interval '28 days')`, [comentario, site])
        semeadas.push(AUTORES)
      }
    } else if (await existe('competitor_video_comment_marks')) {
      throw new Error('competitor_video_comment_marks existe sem competitor_video_comments: banco em estado inesperado')
    }
    return semeadas
  }

  /**
   * Nove usuários e dois sites (A e B), cada um em organização filha da raiz. Concessões no site A: a leitora (em vigor), a revogada
   * (concedida e retirada) e a ex-membro (em vigor, sem vínculo). Uma linha privada em CADA site em cada tabela (o site B serve às provas de site cruzado).
   * `comConcessoes: false` é o estado do dia do deploy: a tabela de concessões vazia.
   */
  async function cenario(opcoes: { comConcessoes?: boolean } = {}): Promise<Cen> {
    const comConcessoes = opcoes.comConcessoes ?? true
    const sufixo = randomUUID().slice(0, 8)
    let raiz = (await pg.query<{ id: string }>('select id from public.organizations where parent_org_id is null limit 1')).rows[0]?.id
    if (!raiz) {
      raiz = randomUUID()
      await pg.query(`insert into public.organizations (id, name, slug, parent_org_id) values ($1, 'Raiz MG11', $2, null)`, [raiz, `mg11-raiz-${sufixo}`])
    }
    const orgA = randomUUID(); const orgB = randomUUID(); const a = randomUUID(); const b = randomUUID()
    for (const [org, site, r] of [[orgA, a, 'a'], [orgB, b, 'b']] as const) {
      await pg.query(`insert into public.organizations (id, name, slug, parent_org_id) values ($1, $2, $3, $4)`, [org, `Org MG11 ${r}`, `mg11-org-${r}-${sufixo}`, raiz])
      await pg.query(`insert into public.sites (id, org_id, name, slug, domains, primary_domain) values ($1, $2, $3, $4, $5, $6)`,
        [site, org, `Site MG11 ${r}`, `mg11-site-${r}-${sufixo}`, [`mg11-${r}-${sufixo}.test`], `mg11-${r}-${sufixo}.test`])
    }
    const u = Object.fromEntries(QUEM.map((q) => [q, randomUUID()])) as Record<Quem, string>
    const dono = randomUUID()
    for (const [q, id] of [...Object.entries(u), ['dono', dono]] as Array<[string, string]>) {
      await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [id, `${q}-${sufixo}@mg11.test`])
    }
    await pg.query(`insert into public.organization_members (org_id, user_id, role) values ($1, $2, 'org_admin'), ($3, $4, 'org_admin')`, [raiz, u.super, orgA, u.orgadmin])
    await pg.query(
      `insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor'), ($1, $3, 'reporter'), ($1, $4, 'reporter'), ($1, $5, 'reporter'), ($6, $7, 'editor')`,
      [a, u.editor, u.leitora, u.reporter, u.revogada, b, u.editorB],
    )
    if (comConcessoes) {
      await pg.query(`insert into public.site_private_viewers (site_id, user_id, granted_by) values ($1, $2, $5), ($1, $3, $5), ($1, $4, $5)`, [a, u.leitora, u.revogada, u.exmembro, dono])
      await pg.query(`update public.site_private_viewers set revoked_at = now(), revoked_by = $3 where site_id = $1 and user_id = $2`, [a, u.revogada, dono])
    }
    const tabelas = await semearLinhas(a)
    const tabelasB = await semearLinhas(b)
    expect(tabelasB).toEqual(tabelas)
    expect(tabelas.length, 'nenhuma tabela da lista das doze existe: banco errado').toBeGreaterThan(0)
    return { a, b, orgA, raiz, u, dono, tabelas }
  }

  async function garantirEMontar(opcoes: { comConcessoes?: boolean } = {}): Promise<Cen> {
    await garantirMg11(pg)
    return cenario(opcoes)
  }

  /** Roda `sql` como `quem` (papel sem superusuário, claims e GUC forjados) num ponto de salvamento e desfaz tudo o que ele mudou. */
  async function como(c: Cen, quem: Quem | 'anon', sql: string, params: unknown[] = [], guc: string = c.a): Promise<Res> {
    await pg.query('savepoint como')
    try {
      await pg.query(`select set_config('request.jwt.claims', $1, true)`, [quem === 'anon' ? '' : JSON.stringify({ sub: c.u[quem], role: 'authenticated' })])
      await pg.query(`select set_config('app.site_id', $1, true)`, [guc])
      await pg.query(quem === 'anon' ? 'set local role anon' : 'set local role authenticated')
      const r = await pg.query(sql, params)
      return { n: r.rowCount ?? 0, rows: r.rows, code: null }
    } catch (e) {
      return { n: 0, rows: [], code: (e as { code?: string }).code ?? 'sem-codigo' }
    } finally {
      await pg.query('rollback to savepoint como')
      await pg.query('release savepoint como')
    }
  }

  /** Quantas linhas `quem` enxerga da tabela, sem filtro nenhum (os dois sites têm uma). `anon` sem privilégio conta como zero (42501). */
  async function contar(c: Cen, quem: Quem | 'anon', t: string, guc: string = c.a): Promise<number> {
    const r = await como(c, quem, `select count(*)::int as n from public.${t}`, [], guc)
    if (r.code === '42501') return 0
    expect(r.code, `${quem} em ${t}`).toBeNull()
    return Number(r.rows[0].n)
  }

  const siteDe = (c: Cen, s: 'A' | 'B'): string => (s === 'A' ? c.a : c.b)

  it('a matriz: ver, editar e privado dos 9 usuários nos 2 sites (os 18 valores do Apêndice B)', async () => {
    await emTransacao(async () => {
      const c = await garantirEMontar()
      for (const q of QUEM) {
        for (const s of ['A', 'B'] as const) {
          const r = await pg.query<{ v: boolean; e: boolean; p: boolean }>(
            `select public.can_view_site_as($1, $2) as v, public.can_edit_site_as($1, $2) as e, public.can_view_private_site_as($1, $2) as p`, [c.u[q], siteDe(c, s)],
          )
          expect([r.rows[0].v, r.rows[0].e, r.rows[0].p], `${q} no site ${s}`).toEqual(MATRIZ[q][s])
        }
      }
    })
  })

  it('sessão e _as respondem igual para os 9 usuários nos 2 sites, com o GUC forjado (item 236)', async () => {
    await emTransacao(async () => {
      const c = await garantirEMontar()
      let comparados = 0
      for (const q of QUEM) {
        for (const s of ['A', 'B'] as const) {
          const comoPostgres = (await pg.query<{ v: boolean; e: boolean; p: boolean }>(
            `select public.can_view_site_as($1, $2) as v, public.can_edit_site_as($1, $2) as e, public.can_view_private_site_as($1, $2) as p`, [c.u[q], siteDe(c, s)])).rows[0]
          // o GUC aponta para o site A, qualquer que seja o site perguntado: a função de sessão não pode olhar para ele
          const sessao = await como(c, q, `select public.can_view_site($1) as v, public.can_edit_site($1) as e, public.can_view_private_site($1) as p`, [siteDe(c, s)], c.a)
          expect(sessao.code, `${q} no site ${s}`).toBeNull()
          expect(sessao.rows[0], `${q} no site ${s}`).toEqual(comoPostgres)
          comparados++
        }
      }
      expect(comparados).toBe(18)
      // anon: a função de sessão responde false (executável por anon; sem sessão não há quem)
      const anon = await como(c, 'anon', `select public.can_view_private_site($1) as p`, [c.a])
      expect(anon.rows[0]).toEqual({ p: false })
    })
  })

  it('a leitora lê cada uma das doze que existem, só as do site dela (a linha privada do site B fica de fora)', async () => {
    await emTransacao(async () => {
      const c = await garantirEMontar()
      const lidas = c.tabelas.filter((t) => DOZE.includes(t as (typeof DOZE)[number]))
      expect(lidas.length).toBeGreaterThan(0)
      for (const t of lidas) {
        expect(await contar(c, 'leitora', t), `a leitora em ${t}`).toBe(1)
        const so = await como(c, 'leitora', `select site_id from public.${t}`)
        expect(so.rows.map((r) => r.site_id), `site das linhas de ${t}`).toEqual([c.a])
      }
    })
  })

  it('a reporter sem linha, a revogada, a ex-membro, o editor de B, o usuário sem papel e o anon leem zero linha de cada uma das doze (item 169)', async () => {
    await emTransacao(async () => {
      const c = await garantirEMontar()
      for (const t of c.tabelas.filter((n) => DOZE.includes(n as (typeof DOZE)[number]))) {
        for (const q of ['reporter', 'revogada', 'exmembro', 'sem'] as const) {
          expect(await contar(c, q, t), `${q} em ${t}`).toBe(0)
        }
        expect(await contar(c, 'editorB', t), `o editor de B em ${t}: só a linha do site dele`).toBe(1)
        expect((await como(c, 'editorB', `select site_id from public.${t}`)).rows.map((r) => r.site_id), t).toEqual([c.b])
        const anon = await como(c, 'anon', `select 1 from public.${t}`)
        expect(anon.code === '42501' || anon.n === 0, `anon em ${t}`).toBe(true)
      }
    })
  })

  it('quem edita continua lendo como antes: o editor, o administrador da organização e o super leem as doze', async () => {
    await emTransacao(async () => {
      const c = await garantirEMontar()
      for (const t of c.tabelas.filter((n) => DOZE.includes(n as (typeof DOZE)[number]))) {
        expect(await contar(c, 'editor', t), `editor em ${t}`).toBe(1)
        expect(await contar(c, 'orgadmin', t), `orgadmin em ${t}`).toBe(1)
        expect(await contar(c, 'super', t), `super em ${t}`).toBe(2) // os dois sites
      }
    })
  })

  it('a leitora recebe zero linha de competitor_video_comment_authors; o editor lê (item 232)', async () => {
    await emTransacao(async () => {
      const c = await garantirEMontar()
      expect(c.tabelas, 'a semente de autores').toContain(AUTORES)
      expect(await contar(c, 'leitora', AUTORES)).toBe(0)
      expect(await contar(c, 'reporter', AUTORES)).toBe(0)
      expect(await contar(c, 'editor', AUTORES)).toBe(1)
    })
  })

  it('ninguém escreve: insert, update e delete da leitora e do editor em cada uma das doze dão erro de privilégio ou zero linha (item 169)', async () => {
    await emTransacao(async () => {
      const c = await garantirEMontar()
      const antes = new Map<string, number>()
      for (const t of c.tabelas) antes.set(t, Number((await pg.query(`select count(*)::int as n from public.${t}`)).rows[0].n))
      for (const t of c.tabelas.filter((n) => DOZE.includes(n as (typeof DOZE)[number]))) {
        for (const q of ['leitora', 'editor'] as const) {
          // o privilégio é conferido antes de qualquer linha: INSERT sem permissão dá 42501, seja qual for a forma
          const ins = await como(c, q, `insert into public.${t} default values`)
          expect(ins.code, `insert de ${q} em ${t}`).toBe('42501')
          const upd = await como(c, q, `update public.${t} set site_id = site_id`)
          expect(upd.code === '42501' || upd.n === 0, `update de ${q} em ${t}`).toBe(true)
          const del = await como(c, q, `delete from public.${t}`)
          expect(del.code === '42501' || del.n === 0, `delete de ${q} em ${t}`).toBe(true)
        }
      }
      for (const t of c.tabelas) expect(Number((await pg.query(`select count(*)::int as n from public.${t}`)).rows[0].n), `${t} não mudou`).toBe(antes.get(t))
    })
  })

  it('forjar app.site_id para o site A não dá nada ao editor de B, e forjar para o site B não tira nada do editor de A', async () => {
    await emTransacao(async () => {
      const c = await garantirEMontar()
      for (const t of c.tabelas.filter((n) => DOZE.includes(n as (typeof DOZE)[number]))) {
        const deB = await como(c, 'editorB', `select site_id from public.${t}`, [], c.a)
        expect(deB.rows.map((r) => r.site_id), `editor de B em ${t}, GUC do site A`).toEqual([c.b])
        const deA = await como(c, 'editor', `select site_id from public.${t}`, [], c.b)
        expect(deA.rows.map((r) => r.site_id), `editor de A em ${t}, GUC do site B`).toEqual([c.a])
        for (const guc of ['', 'lixo', c.b]) {
          expect(await contar(c, 'reporter', t, guc), `reporter em ${t}, GUC ${guc || '(vazio)'}`).toBe(0)
          expect(await contar(c, 'leitora', t, guc), `leitora em ${t}, GUC ${guc || '(vazio)'}`).toBe(1)
        }
      }
    })
  })

  it('a leitora vê só a própria linha de site_private_viewers; a reporter, zero; o administrador da organização, as três do site; ninguém escreve nela como authenticated', async () => {
    await emTransacao(async () => {
      const c = await garantirEMontar()
      const esperado: Record<string, number> = { super: 3, orgadmin: 3, editor: 0, leitora: 1, reporter: 0, editorB: 0, sem: 0 }
      for (const [q, n] of Object.entries(esperado)) {
        expect(await contar(c, q as Quem, 'site_private_viewers'), `${q} em site_private_viewers`).toBe(n)
      }
      const anon = await como(c, 'anon', 'select 1 from public.site_private_viewers')
      expect(anon.code).toBe('42501')
      const alvo = c.u.sem
      expect((await como(c, 'orgadmin', `insert into public.site_private_viewers (site_id, user_id) values ($1, $2)`, [c.a, alvo])).code).toBe('42501')
      expect((await como(c, 'orgadmin', `update public.site_private_viewers set revoked_at = now() where site_id = $1`, [c.a])).code).toBe('42501')
      expect((await como(c, 'orgadmin', `delete from public.site_private_viewers where site_id = $1`, [c.a])).code).toBe('42501')
      expect((await como(c, 'leitora', `delete from public.site_private_viewers`)).code).toBe('42501')
    })
  })

  it('retirar o direito corta na mesma transação', async () => {
    await emTransacao(async () => {
      const c = await garantirEMontar()
      const t = c.tabelas.find((n) => DOZE.includes(n as (typeof DOZE)[number]))!
      expect(await contar(c, 'leitora', t)).toBe(1)
      await pg.query(`update public.site_private_viewers set revoked_at = now(), revoked_by = $3 where site_id = $1 and user_id = $2`, [c.a, c.u.leitora, c.dono])
      expect(await contar(c, 'leitora', t)).toBe(0)
    })
  })

  it('tirar a leitora do site corta, mesmo com a linha em vigor', async () => {
    await emTransacao(async () => {
      const c = await garantirEMontar()
      const t = c.tabelas.find((n) => DOZE.includes(n as (typeof DOZE)[number]))!
      expect(await contar(c, 'leitora', t)).toBe(1)
      await pg.query(`delete from public.site_memberships where site_id = $1 and user_id = $2`, [c.a, c.u.leitora])
      expect(await contar(c, 'leitora', t)).toBe(0)
      // a linha de concessão continua em vigor: quem corta é o vínculo
      const v = await pg.query(`select revoked_at from public.site_private_viewers where site_id = $1 and user_id = $2`, [c.a, c.u.leitora])
      expect(v.rows[0].revoked_at).toBeNull()
    })
  })

  it('revoked_at no futuro já conta como retirado', async () => {
    await emTransacao(async () => {
      const c = await garantirEMontar()
      const t = c.tabelas.find((n) => DOZE.includes(n as (typeof DOZE)[number]))!
      await pg.query(`update public.site_private_viewers set revoked_at = now() + interval '1 day', revoked_by = $3 where site_id = $1 and user_id = $2`, [c.a, c.u.leitora, c.dono])
      expect(await contar(c, 'leitora', t)).toBe(0)
      expect((await pg.query(`select public.can_view_private_site_as($1, $2) as p`, [c.u.leitora, c.a])).rows[0].p).toBe(false)
    })
  })

  it('tabela de concessões vazia: só quem edita lê (o estado do dia do deploy)', async () => {
    await emTransacao(async () => {
      const c = await garantirEMontar({ comConcessoes: false })
      expect((await pg.query(`select count(*)::int as n from public.site_private_viewers where site_id = any($1::uuid[])`, [[c.a, c.b]])).rows[0].n, 'concessões dos sites deste teste').toBe(0)
      for (const t of c.tabelas.filter((n) => DOZE.includes(n as (typeof DOZE)[number]))) {
        for (const q of ['leitora', 'reporter', 'revogada', 'exmembro', 'sem'] as const) expect(await contar(c, q, t), `${q} em ${t}`).toBe(0)
        for (const q of ['editor', 'orgadmin'] as const) expect(await contar(c, q, t), `${q} em ${t}`).toBe(1)
      }
    })
  })

  it('apagar a leitora de auth.users some com a concessão e anula user_id do registro e da chave; apagar quem concedeu anula granted_by', async () => {
    await emTransacao(async () => {
      const c = await garantirEMontar()
      const chave = randomUUID()
      await pg.query(`insert into public.pipeline_api_keys (id, site_id, name, key_hash, permissions, user_id, expires_at) values ($1, $2, 'mg11 perfil', $3, array['observatorio_leitura'], $4, now() + interval '30 days')`, [chave, c.a, 'hash-' + chave, c.u.leitora])
      await pg.query(`insert into public.obs_ai_access_log (site_id, user_id, key_id, origin, action, included_private, result) values ($1, $2, $3, 'mcp', 'prova', true, 'ok')`, [c.a, c.u.leitora, chave])
      await pg.query('delete from auth.users where id = $1', [c.u.leitora])
      expect((await pg.query(`select count(*)::int as n from public.site_private_viewers where user_id = $1`, [c.u.leitora])).rows[0].n).toBe(0)
      expect((await pg.query(`select user_id from public.pipeline_api_keys where id = $1`, [chave])).rows[0].user_id).toBeNull()
      expect((await pg.query(`select user_id from public.obs_ai_access_log where key_id = $1`, [chave])).rows[0].user_id).toBeNull()
      // quem concedeu e quem retirou (o mesmo "dono") é apagado: as duas colunas anulam, as linhas ficam
      await pg.query('delete from auth.users where id = $1', [c.dono])
      const r = await pg.query(`select count(*)::int as total, count(*) filter (where granted_by is null)::int as sem_autor, count(*) filter (where revoked_by is null)::int as sem_quem_retirou from public.site_private_viewers where site_id = any($1::uuid[])`, [[c.a, c.b]])
      expect(r.rows[0]).toEqual({ total: 2, sem_autor: 2, sem_quem_retirou: 2 })
    })
  })

  it('cada concessão e cada retirada grava uma linha em audit_log, com org_id preenchido; conceder a quem já tem não grava nada', async () => {
    await emTransacao(async () => {
      const c = await garantirEMontar()
      const rastro = async (): Promise<Record<string, number>> => {
        const r = await pg.query<{ action: string; n: number }>(`select action, count(*)::int as n from public.audit_log where resource_type = 'site_private_viewers' and site_id = any($1::uuid[]) group by 1`, [[c.a, c.b]])
        return Object.fromEntries(r.rows.map((x) => [x.action, x.n]))
      }
      expect(await rastro()).toEqual({ private_view_granted: 3, private_view_revoked: 1 })
      expect((await pg.query(`select bool_and(org_id is not null) as ok from public.audit_log where resource_type = 'site_private_viewers' and site_id = any($1::uuid[])`, [[c.a, c.b]])).rows[0].ok).toBe(true)
      // conceder a quem já tem: a instrução do runbook não altera linha (a cláusula where) e o rastro fica igual
      const conceder = `insert into public.site_private_viewers (site_id, user_id, granted_by) values ($1, $2, $3)
        on conflict (site_id, user_id) do update set revoked_at = null, revoked_by = null, granted_by = excluded.granted_by, granted_at = now() where public.site_private_viewers.revoked_at is not null returning 1`
      expect((await pg.query(conceder, [c.a, c.u.leitora, c.dono])).rowCount).toBe(0)
      expect(await rastro()).toEqual({ private_view_granted: 3, private_view_revoked: 1 })
      // reconceder a revogada grava uma linha; retirar a leitora grava outra
      expect((await pg.query(conceder, [c.a, c.u.revogada, c.dono])).rowCount).toBe(1)
      expect((await pg.query(`update public.site_private_viewers set revoked_at = now(), revoked_by = $3 where site_id = $1 and user_id = $2 and revoked_at is null`, [c.a, c.u.leitora, c.dono])).rowCount).toBe(1)
      expect(await rastro()).toEqual({ private_view_granted: 4, private_view_revoked: 2 })
      expect((await pg.query(`select bool_and(org_id is not null) as ok from public.audit_log where resource_type = 'site_private_viewers' and site_id = any($1::uuid[])`, [[c.a, c.b]])).rows[0].ok).toBe(true)
    })
  })

  it('apagar quem concedeu, e apagar quem retirou, não grava linha nenhuma em audit_log; granted_by e revoked_by ficam nulos', async () => {
    await emTransacao(async () => {
      const c = await garantirEMontar()
      const contagem = async (): Promise<number> => Number((await pg.query(`select count(*)::int as n from public.audit_log where resource_type = 'site_private_viewers' and site_id = any($1::uuid[])`, [[c.a, c.b]])).rows[0].n)
      const antes = await contagem()
      expect(antes).toBeGreaterThan(0)
      await pg.query('delete from auth.users where id = $1', [c.dono])
      expect(await contagem(), 'contagem de audit_log antes e depois do delete from auth.users').toBe(antes)
      const r = await pg.query(`select count(*) filter (where granted_by is not null)::int as g, count(*) filter (where revoked_by is not null)::int as v from public.site_private_viewers where site_id = any($1::uuid[])`, [[c.a, c.b]])
      expect(r.rows[0]).toEqual({ g: 0, v: 0 })
    })
  })

  it('retirar grava revoked_by; reconceder o limpa; a linha de rastro da retirada leva revoked_by no "depois"', async () => {
    await emTransacao(async () => {
      const c = await garantirEMontar()
      await pg.query(`update public.site_private_viewers set revoked_at = now(), revoked_by = $3 where site_id = $1 and user_id = $2 and revoked_at is null`, [c.a, c.u.leitora, c.dono])
      expect((await pg.query(`select revoked_by from public.site_private_viewers where site_id = $1 and user_id = $2`, [c.a, c.u.leitora])).rows[0].revoked_by).toBe(c.dono)
      const linha = await pg.query(`select after_data->>'revoked_by' as quem from public.audit_log where resource_type = 'site_private_viewers' and action = 'private_view_revoked' and resource_id = $1 order by created_at desc, id desc limit 1`, [c.u.leitora])
      expect(linha.rows[0].quem).toBe(c.dono)
      await pg.query(`update public.site_private_viewers set revoked_at = null, revoked_by = null, granted_by = $3, granted_at = now() where site_id = $1 and user_id = $2`, [c.a, c.u.leitora, c.dono])
      expect((await pg.query(`select revoked_at, revoked_by from public.site_private_viewers where site_id = $1 and user_id = $2`, [c.a, c.u.leitora])).rows[0]).toEqual({ revoked_at: null, revoked_by: null })
    })
  })

  it('corrigir o autor em branco não muda quem lê e não grava rastro (os dois updates do runbook)', async () => {
    await emTransacao(async () => {
      const c = await garantirEMontar()
      const t = c.tabelas.find((n) => DOZE.includes(n as (typeof DOZE)[number]))!
      const rastro = async (): Promise<number> => Number((await pg.query(`select count(*)::int as n from public.audit_log where resource_type = 'site_private_viewers' and site_id = any($1::uuid[])`, [[c.a, c.b]])).rows[0].n)
      // revogada: retirada, com o autor anulado à mão
      await pg.query(`update public.site_private_viewers set revoked_by = null where site_id = $1 and user_id = $2`, [c.a, c.u.revogada])
      // leitora: em vigor, com quem concedeu anulado à mão
      await pg.query(`update public.site_private_viewers set granted_by = null where site_id = $1 and user_id = $2`, [c.a, c.u.leitora])
      const antes = await rastro()
      const corrigirRetirada = await pg.query(
        `update public.site_private_viewers set revoked_by = $3 where site_id = $1 and user_id = $2 and revoked_at is not null and revoked_by is null returning user_id, revoked_at`, [c.a, c.u.revogada, c.dono])
      expect(corrigirRetirada.rowCount).toBe(1)
      expect(corrigirRetirada.rows[0].revoked_at).not.toBeNull()
      const corrigirConcessao = await pg.query(`update public.site_private_viewers set granted_by = $3 where site_id = $1 and user_id = $2 and granted_by is null returning user_id`, [c.a, c.u.leitora, c.dono])
      expect(corrigirConcessao.rowCount).toBe(1)
      expect(await rastro(), 'rastro novo ao corrigir').toBe(antes)
      expect((await pg.query(`select public.can_view_private_site_as($1, $2) as p`, [c.u.revogada, c.a])).rows[0].p, 'a revogada continua sem ler').toBe(false)
      expect((await pg.query(`select public.can_view_private_site_as($1, $2) as p`, [c.u.leitora, c.a])).rows[0].p, 'a leitora continua lendo').toBe(true)
      expect(await contar(c, 'leitora', t)).toBe(1)
      expect(await contar(c, 'revogada', t)).toBe(0)
    })
  })

  it('a receita antiga, pelo nome: numa linha retirada, "retirar" altera 0 linha e "conceder" devolve o direito (por isso nunca se concede para consertar)', async () => {
    await emTransacao(async () => {
      const c = await garantirEMontar()
      const t = c.tabelas.find((n) => DOZE.includes(n as (typeof DOZE)[number]))!
      const retirar = await pg.query(`update public.site_private_viewers set revoked_at = now(), revoked_by = $3 where site_id = $1 and user_id = $2 and revoked_at is null returning 1`, [c.a, c.u.revogada, c.dono])
      expect(retirar.rowCount, 'UPDATE 0').toBe(0)
      expect(await contar(c, 'revogada', t)).toBe(0)
      const conceder = await pg.query(
        `insert into public.site_private_viewers (site_id, user_id, granted_by) values ($1, $2, $3)
         on conflict (site_id, user_id) do update set revoked_at = null, revoked_by = null, granted_by = excluded.granted_by, granted_at = now() where public.site_private_viewers.revoked_at is not null returning 1`, [c.a, c.u.revogada, c.dono])
      expect(conceder.rowCount, 'INSERT 0 1').toBe(1)
      expect(await contar(c, 'revogada', t), 'a pessoa volta a ler').toBe(1)
    })
  })
})
