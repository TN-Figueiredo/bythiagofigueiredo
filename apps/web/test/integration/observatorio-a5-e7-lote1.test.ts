// @vitest-environment node
/**
 * A5 · E7, Tarefa 8b: o Lote 1 (perfil em `channels`, `campos=todos` em `changes`) contra o PostgREST de verdade.
 * Banco: SÓ o `bythiago_int` (a MG1 já está nele).
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e7-lote1.test.ts --no-file-parallelism
 * Cada teste cria o SEU site; o `afterAll` apaga (roda também depois de falha). Só dado inventado, datas relativas ao relógio.
 * Não cobre "duas páginas no banco": o Lote 1 foi enviado sem continuação (P-2), então não há `.or(...)` a provar.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SERVICE_KEY } from '../helpers/db-seed'
import { criarCanal, criarSite, criarVideo, q1 } from '../helpers/mg6'
import { listCompetitorChanges, listCompetitorChannels } from '@/lib/pipeline/services/competitors'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import { listarMudancasDeCampo } from '@/lib/pipeline/services/competitors-campos'
import { apagarCanais, apagarSites } from '../helpers/limpa-cena'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const URL_BANCO = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const NA_CI = process.env.CI === 'true'
const HOST_BANCO = NA_CI ? '127.0.0.1:54321' : '127.0.0.1:54421'
const PORTA_PG = NA_CI ? ':54322/' : ':54422/'
const PG_URL = process.env.SUPABASE_DB_URL ?? (NA_CI ? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' : '')

const RETRATO_CHANGES = JSON.parse(readFileSync(new URL('../api/pipeline/__retratos__/e7-changes-hoje.json', import.meta.url), 'utf8')) as {
  sem_filtro: { changes: Array<Record<string, unknown>> } & Record<string, unknown>
}

describe.skipIf(skipIfNoLocalDb())('A5 E7 Tarefa 8b: Lote 1 contra o PostgREST local', () => {
  let pg: Client
  let sb: SupabaseClient
  const sites: string[] = []
  const orgs: string[] = []

  beforeAll(async () => {
    if (new URL(URL_BANCO).host !== HOST_BANCO) throw new Error('NEXT_PUBLIC_SUPABASE_URL não aponta para o banco de integração (' + HOST_BANCO + ')')
    if (!PG_URL.includes(PORTA_PG)) throw new Error('SUPABASE_DB_URL não aponta para o banco de integração (' + PORTA_PG + ')')
    sb = createClient(URL_BANCO, process.env.SUPABASE_SERVICE_ROLE_KEY ?? SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
    const mg1 = await q1(pg, `select to_regclass('public.competitor_field_versions')::text as t`)
    if (mg1.t === null) throw new Error('a MG1 não está aplicada neste banco (P-11)')
  })
  afterAll(async () => {
    try {
      if (sites.length > 0) await apagarSites(pg, 'id = any($1::uuid[])', [sites])
      if (orgs.length > 0) await pg.query('delete from public.organizations where id = any($1::uuid[])', [orgs])
    } finally {
      await pg.end()
    }
  })

  const ctxDe = (siteId: string): ServiceContext => ({ siteId, permissions: ['read'], supabase: sb })

  async function novoSite(): Promise<string> {
    const { org, site } = await criarSite(pg)
    sites.push(site)
    orgs.push(org)
    return site
  }
  async function versao(o: {
    site: string; canal: string; video?: string | null; campo: string; valor: unknown; hash: string
    precisao: '6h' | '1d' | '7d' | 'gap' | 'first'; vistoHa: number; corrente: boolean
  }): Promise<void> {
    await pg.query(
      `insert into public.competitor_field_versions (site_id, competitor_channel_id, video_id, field, value, value_hash, precision, first_seen_at, last_seen_at, is_current)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7, now() - make_interval(hours => $8), now() - make_interval(hours => $8), $9)`,
      [o.site, o.canal, o.video ?? null, o.campo, JSON.stringify(o.valor), o.hash, o.precisao, o.vistoHa, o.corrente])
  }
  async function perfilDoCanal(site: string, canal: string, handle: string, pais: string): Promise<void> {
    await pg.query(`update public.competitor_channels set last_seen_at = now(), published_at = now() - interval '900 days' where id = $1`, [canal])
    await versao({ site, canal, campo: 'custom_url', valor: handle, hash: 'h-' + handle, precisao: 'first', vistoHa: 48, corrente: true })
    await versao({ site, canal, campo: 'country', valor: pais, hash: 'h-' + pais, precisao: 'first', vistoHa: 48, corrente: true })
  }
  /** Três vídeos e um canal com uma mudança de campo cada, todas com a versão anterior lida (4 mudanças e as primeiras leituras). */
  async function cenaDeCampos(site: string): Promise<{ canalA: string; canalB: string; videos: string[] }> {
    const canalA = await criarCanal(pg, site, 'Canal Alfa')
    const canalB = await criarCanal(pg, site, 'Canal Beta')
    const v1 = await criarVideo(pg, canalA, 5)
    const v2 = await criarVideo(pg, canalA, 6)
    const v3 = await criarVideo(pg, canalB, 7)
    // v1 tags: first -> mudança 1d (a primeira leitura não conta como mudança)
    await versao({ site, canal: canalA, video: v1, campo: 'tags', valor: ['a'], hash: 't0', precisao: 'first', vistoHa: 72, corrente: false })
    await versao({ site, canal: canalA, video: v1, campo: 'tags', valor: ['a', 'b'], hash: 't1', precisao: '1d', vistoHa: 30, corrente: true })
    // v2 category_id: first -> mudança
    await versao({ site, canal: canalA, video: v2, campo: 'category_id', valor: '19', hash: 'c0', precisao: 'first', vistoHa: 72, corrente: false })
    await versao({ site, canal: canalA, video: v2, campo: 'category_id', valor: '22', hash: 'c1', precisao: '1d', vistoHa: 20, corrente: true })
    // v3 default_language: first -> mudança
    await versao({ site, canal: canalB, video: v3, campo: 'default_language', valor: 'pt', hash: 'l0', precisao: 'first', vistoHa: 60, corrente: false })
    await versao({ site, canal: canalB, video: v3, campo: 'default_language', valor: 'en', hash: 'l1', precisao: '1d', vistoHa: 10, corrente: true })
    // canal: country mudou (a anterior é a leitura de perfil)
    await perfilDoCanal(site, canalA, '@alfa', 'BR')
    await pg.query(`update public.competitor_field_versions set is_current = false where competitor_channel_id = $1 and field = 'country'`, [canalA])
    await versao({ site, canal: canalA, campo: 'country', valor: 'PT', hash: 'h-PT', precisao: '1d', vistoHa: 5, corrente: true })
    return { canalA, canalB, videos: [v1, v2, v3] }
  }

  it('as consultas do perfil são aceitas pelo PostgREST', async () => {
    const site = await novoSite()
    const a = await criarCanal(pg, site, 'Canal Um')
    const b = await criarCanal(pg, site, 'Canal Dois')
    await perfilDoCanal(site, a, '@um', 'BR')
    await perfilDoCanal(site, b, '@dois', 'PT')
    const r = await listCompetitorChannels(ctxDe(site))
    expect(r.status ?? 200).toBe(200)
    expect(r.data.count).toBe(2)
    const porNome = new Map(r.data.channels.map((c) => [c.channel_name, c.perfil]))
    expect(porNome.get('Canal Um')).toMatchObject({ estado: 'lido', handle: '@um', pais: 'BR' })
    expect(porNome.get('Canal Dois')).toMatchObject({ estado: 'lido', handle: '@dois', pais: 'PT' })
    for (const c of r.data.channels) expect(c.perfil.estado).toBe('lido') // nenhum erro_do_banco
  })

  it('as consultas de campos=todos são aceitas pelo PostgREST', async () => {
    const site = await novoSite()
    await cenaDeCampos(site)
    const r = await listCompetitorChanges(ctxDe(site), { campos: 'todos' })
    const m = (r.data as unknown as { mudancas_de_campo: Awaited<ReturnType<typeof listarMudancasDeCampo>> }).mudancas_de_campo
    expect(m.estado).toBe('lido')
    if (m.estado !== 'lido') return
    expect(m.itens).toHaveLength(4)
    // do mais recente para o mais antigo: country (5h), default_language (10h), category_id (20h), tags (30h)
    expect(m.itens.map((i) => i.campo)).toEqual(['country', 'default_language', 'category_id', 'tags'])
    expect(m.itens.map((i) => i.alvo)).toEqual(['canal', 'video', 'video', 'video'])
    for (const i of m.itens) expect(i.valor_anterior.estado).toBe('lido')
    expect(m.itens[0]!.valor_anterior).toEqual({ estado: 'lido', valor: 'BR' })
    expect(m.itens[0]!.valor_novo).toBe('PT')
    expect(m.lido_ate.mais_recente).not.toBeNull()
    expect(m.lido_ate.videos_mais_recente).toBeNull() // vídeos criados sem last_seen_at
    expect(m.coleta_desde).toBeTruthy()
    expect(m.fora_da_lista).toBe(0)
    expect(m.video_de_outro_site).toBe(0)
  })

  it('changes sem parâmetro contra o banco tem as mesmas chaves do retrato do falso', async () => {
    const site = await novoSite()
    const canal = await criarCanal(pg, site, 'Canal Gama')
    const v1 = await criarVideo(pg, canal, 3)
    const v2 = await criarVideo(pg, canal, 4)
    for (const v of [v1, v2]) {
      await pg.query(
        `insert into public.competitor_changes (site_id, video_id, change_type, old_title, new_title, view_count_at_change) values ($1, $2, 'title', 'velho', 'novo', 10)`, [site, v])
    }
    const r = await listCompetitorChanges(ctxDe(site), {})
    expect(r.data.changes).toHaveLength(2)
    expect(Object.keys(r.data).sort()).toEqual(Object.keys(RETRATO_CHANGES.sem_filtro).sort())
    expect(Object.keys(r.data.changes[0]!).sort()).toEqual(Object.keys(RETRATO_CHANGES.sem_filtro.changes[0]!).sort())
  })

  it('dois sites no mesmo banco não se enxergam', async () => {
    const A = await novoSite()
    const B = await novoSite()
    const ytId = 'UC' + randomUUID().replace(/-/g, '').slice(0, 20)
    const nomeB = 'Canal exclusivo de B ' + randomUUID().slice(0, 8)
    const canalA = (await q1(pg, `insert into public.competitor_channels (site_id, channel_id, channel_name) values ($1, $2, 'Canal de A') returning id`, [A, ytId])).id as string
    const canalB = (await q1(pg, `insert into public.competitor_channels (site_id, channel_id, channel_name) values ($1, $2, $3) returning id`, [B, ytId, nomeB])).id as string
    await perfilDoCanal(A, canalA, '@do-a', 'BR')
    await perfilDoCanal(B, canalB, '@do-b-segredo', 'JP')
    const vB = await criarVideo(pg, canalB, 4)
    await versao({ site: B, canal: canalB, video: vB, campo: 'tags', valor: ['valor-do-b'], hash: 'b0', precisao: 'first', vistoHa: 50, corrente: false })
    await versao({ site: B, canal: canalB, video: vB, campo: 'tags', valor: ['valor-do-b', 'x'], hash: 'b1', precisao: '1d', vistoHa: 5, corrente: true })
    const vA = await criarVideo(pg, canalA, 4)
    await versao({ site: A, canal: canalA, video: vA, campo: 'tags', valor: ['valor-do-a'], hash: 'a0', precisao: 'first', vistoHa: 50, corrente: false })
    await versao({ site: A, canal: canalA, video: vA, campo: 'tags', valor: ['valor-do-a', 'y'], hash: 'a1', precisao: '1d', vistoHa: 5, corrente: true })

    const canais = JSON.stringify((await listCompetitorChannels(ctxDe(A))).data)
    const campos = JSON.stringify((await listCompetitorChanges(ctxDe(A), { campos: 'todos' })).data)
    for (const texto of [canais, campos]) {
      expect(texto).not.toContain(canalB)
      expect(texto).not.toContain(vB)
      expect(texto).not.toContain(nomeB)
      expect(texto).not.toContain('@do-b-segredo')
      expect(texto).not.toContain('valor-do-b')
    }
    expect(canais).toContain('@do-a')
    expect(campos).toContain('valor-do-a')
  })

  it('o vídeo apagado some', async () => {
    const site = await novoSite()
    const { videos } = await cenaDeCampos(site)
    await pg.query('delete from public.competitor_videos where id = $1', [videos[0]])
    const r = await listCompetitorChanges(ctxDe(site), { campos: 'todos' })
    const m = (r.data as unknown as { mudancas_de_campo: Awaited<ReturnType<typeof listarMudancasDeCampo>> }).mudancas_de_campo
    expect(m.estado).toBe('lido')
    if (m.estado !== 'lido') return
    expect(m.itens.some((i) => i.campo === 'tags')).toBe(false)
    expect(m.itens).toHaveLength(3)
    expect(m.video_de_outro_site).toBe(0)
  })

  it('o canal apagado some', async () => {
    const site = await novoSite()
    const { canalB } = await cenaDeCampos(site)
    await apagarCanais(pg, 'id = $1', [canalB])
    const canais = await listCompetitorChannels(ctxDe(site))
    expect(canais.data.channels.some((c) => c.id === canalB)).toBe(false)
    const r = await listCompetitorChanges(ctxDe(site), { campos: 'todos' })
    const m = (r.data as unknown as { mudancas_de_campo: Awaited<ReturnType<typeof listarMudancasDeCampo>> }).mudancas_de_campo
    expect(m.estado).toBe('lido')
    if (m.estado !== 'lido') return
    expect(m.itens.some((i) => i.campo === 'default_language')).toBe(false)
    expect(m.itens).toHaveLength(3)
  })

  it('a ponta dos vídeos no banco', async () => {
    const site = await novoSite()
    const outro = await novoSite()
    const canal = await criarCanal(pg, site, 'Canal Ponta')
    const canalOutro = await criarCanal(pg, outro, 'Canal Outro')
    const ontem = await criarVideo(pg, canal, 10)
    const hoje = await criarVideo(pg, canal, 9)
    await criarVideo(pg, canal, 8) // last_seen_at nulo
    const alheio = await criarVideo(pg, canalOutro, 7)
    await pg.query(`update public.competitor_videos set last_seen_at = now() - interval '1 day' where id = $1`, [ontem])
    await pg.query(`update public.competitor_videos set last_seen_at = now() where id = $1`, [hoje])
    await pg.query(`update public.competitor_videos set last_seen_at = now() + interval '1 hour' where id = $1`, [alheio])
    // uma versão qualquer para a coleta ter começado
    await versao({ site, canal, campo: 'name', valor: 'x', hash: 'n0', precisao: 'first', vistoHa: 2, corrente: true })
    const m = await listarMudancasDeCampo(sb, site, { limite: 10 })
    expect(m.estado).toBe('lido')
    if (m.estado !== 'lido') return
    const lidoEm = async (id: string): Promise<string> =>
      (await q1(pg, `select to_char(last_seen_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as t from public.competitor_videos where id = $1`, [id])).t as string
    const dif = (a: string | null, b: string): number => Math.abs(Date.parse(a ?? '') - Date.parse(b))
    expect(dif(m.lido_ate.videos_mais_antigo, await lidoEm(ontem))).toBeLessThan(1)
    expect(dif(m.lido_ate.videos_mais_recente, await lidoEm(hoje))).toBeLessThan(1)
    // o vídeo do outro site (lido depois) não entra; o nulo não virou a ponta
    expect(dif(m.lido_ate.videos_mais_recente, await lidoEm(alheio))).toBeGreaterThan(1000)
  })
})
