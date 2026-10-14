/**
 * A5 · E10: a MG6 (export, pausa de coleta e sinal de tamanho do banco) NÃO está aplicada de vez em banco nenhum
 * (só o controlador aplica migration; o arquivo ainda não está em `supabase/migrations/`). Os testes de integração
 * da E10 aplicam o texto do ensaio (`test/fixtures/sql/a5-e10-mg6.sql`, idêntico ao Apêndice A do plano) DENTRO da
 * transação de cada teste, que termina em `rollback`: nada fica gravado e o teste não supõe a MG6 aplicada.
 * Quando a migration existir, ela tem de ser idêntica a este arquivo (o teste `a migration é idêntica ao ensaio`
 * confere); `E10_MG6_ARQUIVO` aponta o helper para outro arquivo (mutação de teste, ou a migration).
 *
 * Tudo aqui roda numa única conexão (`pg.Client`): a transação, o ensaio da MG6, as sementes e as consultas.
 */
import type { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const MG6_FIXTURE = fileURLToPath(new URL('../fixtures/sql/a5-e10-mg6.sql', import.meta.url))

export function caminhoDaMg6(): string {
  const v = process.env.E10_MG6_ARQUIVO
  return v && v.length > 0 ? v : MG6_FIXTURE
}

export function lerSqlDaMg6(): string {
  return readFileSync(caminhoDaMg6(), 'utf8')
}

const dormir = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))

function codigoDoErro(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'code' in e) return String((e as { code: unknown }).code)
  return ''
}

/** Aplica o ensaio da MG6 na transação aberta (idempotente: pode ser aplicada de novo sobre uma MG6 já aplicada). */
export async function garantirMg6(c: Client): Promise<void> {
  await c.query(lerSqlDaMg6())
}

/**
 * Abre a transação e aplica a MG6. Banco ocupado por outro agente (`55P03` lock_timeout, `40P01` deadlock): espera e repete,
 * até 3 vezes; passando disso, o erro sobe (o teste falha dizendo que o banco estava ocupado, nunca em silêncio).
 */
export async function iniciarComMg6(c: Client, isolamento: 'read committed' | 'repeatable read' = 'read committed'): Promise<void> {
  for (let tentativa = 0; ; tentativa++) {
    await c.query(`begin isolation level ${isolamento}`)
    try {
      await garantirMg6(c)
      return
    } catch (e) {
      await c.query('rollback')
      const cod = codigoDoErro(e)
      if (tentativa < 2 && (cod === '55P03' || cod === '40P01')) { await dormir(5_000 * (tentativa + 1)); continue }
      throw e
    }
  }
}

/** Roda `fn` dentro de `begin; <MG6>; …; rollback`. Nada fica gravado, nem quando `fn` lança. */
export async function emTransacao<T>(c: Client, fn: () => Promise<T>, isolamento: 'read committed' | 'repeatable read' = 'read committed'): Promise<T> {
  await iniciarComMg6(c, isolamento)
  try {
    return await fn()
  } finally {
    await c.query('rollback')
  }
}

export type Tentativa =
  | { ok: true; rows: Record<string, unknown>[] }
  | { ok: false; code: string; message: string }

/** Roda um comando que PODE falhar sem estragar a transação (savepoint). */
export async function tenta(c: Client, sql: string, params: unknown[] = []): Promise<Tentativa> {
  await c.query('savepoint tenta')
  try {
    const r = await c.query(sql, params)
    await c.query('release savepoint tenta')
    return { ok: true, rows: r.rows as Record<string, unknown>[] }
  } catch (e) {
    await c.query('rollback to savepoint tenta')
    const message = typeof e === 'object' && e !== null && 'message' in e ? String((e as { message: unknown }).message) : String(e)
    return { ok: false, code: codigoDoErro(e), message }
  }
}

/** `E10:<codigo>: texto` -> `<codigo>`; mensagem que não é da E10 -> null. */
export function codigoE10(message: string): string | null {
  const m = /^E10:([a-z_]+):/.exec(message)
  return m ? m[1]! : null
}

export async function q1(c: Client, sql: string, params: unknown[] = []): Promise<Record<string, unknown>> {
  const r = await c.query(sql, params)
  if (r.rows.length !== 1) throw new Error(`esperava 1 linha, veio ${r.rows.length}: ${sql.slice(0, 80)}`)
  return r.rows[0] as Record<string, unknown>
}

export async function escalar<T = number>(c: Client, sql: string, params: unknown[] = []): Promise<T> {
  const r = await c.query({ text: sql, values: params, rowMode: 'array' })
  return (r.rows[0] as unknown[])[0] as T
}

// ───────────────────────── sementes (sempre sintéticas) ─────────────────────────

export interface Cena {
  org: string
  /** Site da cena: o usuário `admin` administra a organização dele. */
  site: string
  admin: string
  comum: string
  canalA: string
  canalB: string
  /** Vídeo de A publicado há 2 dias. */
  videoA: string
  /** Vídeo de A publicado há 20 dias. */
  videoA2: string
  videoB: string
  /** Comentário (de B) cujo "destaque" aponta para o canal A. */
  comentarioDeBQueApontaParaA: string
}

export async function criarUsuario(c: Client, id: string = randomUUID()): Promise<string> {
  await c.query(
    `insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', $2, '', now(), 'authenticated', 'authenticated', '{}', '{}', now(), now())`,
    [id, `e10-${id}@example.test`])
  return id
}

/** Organização filha da mestra (a mestra é única: reaproveita a que existe, ou cria uma dentro da transação) + um site. */
export async function criarSite(c: Client): Promise<{ org: string; site: string }> {
  const suf = randomUUID().replace(/-/g, '').slice(0, 12)
  let mestra = (await c.query(`select id from public.organizations where parent_org_id is null limit 1`)).rows[0]?.id as string | undefined
  if (!mestra) mestra = (await q1(c, `insert into public.organizations (name, slug, parent_org_id) values ($1, $2, null) returning id`, [`E10 mestra ${suf}`, `e10-mestra-${suf}`])).id as string
  const org = (await q1(c, `insert into public.organizations (name, slug, parent_org_id) values ($1, $2, $3) returning id`, [`E10 org ${suf}`, `e10-org-${suf}`, mestra])).id as string
  const site = (await q1(c,
    `insert into public.sites (org_id, name, slug, domains, primary_domain, default_locale, supported_locales)
     values ($1, $2, $3, $4::text[], $5, 'pt-BR', '{pt-BR}') returning id`,
    [org, `E10 site ${suf}`, `e10-site-${suf}`, `{e10-${suf}.test}`, `e10-${suf}.test`])).id as string
  return { org, site }
}

export async function criarCanal(c: Client, site: string, nome = 'Canal de teste'): Promise<string> {
  return (await q1(c, `insert into public.competitor_channels (site_id, channel_id, channel_name) values ($1, $2, $3) returning id`,
    [site, 'UC' + randomUUID().replace(/-/g, '').slice(0, 20), nome])).id as string
}

export async function criarVideo(c: Client, canal: string, diasAtras: number): Promise<string> {
  return (await q1(c,
    `insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at, discovered_at, view_count)
     values ($1, $2, 'sintético', now() - make_interval(days => $3), now() - make_interval(days => $3), 10) returning id`,
    [canal, 'e10' + randomUUID().replace(/-/g, '').slice(0, 10), diasAtras])).id as string
}

/** Uma linha em quase toda tabela do registro para o vídeo (e o canal). Datas relativas a hoje. */
export async function semearDadosDoVideo(c: Client, site: string, canal: string, video: string): Promise<void> {
  await c.query(
    `insert into public.competitor_video_daily (video_id, snap_date, views, taken_at) values
       ($1, current_date - 1, 100, now() - interval '1 day'), ($1, current_date - 2, 90, now() - interval '2 days'), ($1, current_date - 40, 5, now() - interval '40 days')`, [video])
  await c.query(
    `insert into public.competitor_video_versions (video_id, field, value_hash, precision, first_seen_at, last_seen_at, thumb_blob_url, is_current) values
       ($1, 'thumb', 'h1', '1d', now() - interval '3 days', now() - interval '2 days', $2, false), ($1, 'thumb', 'h2', '1d', now() - interval '2 days', now() - interval '1 day', $3, true)`,
    [video, `https://blob.example.test/${video}-1.jpg`, `https://blob.example.test/${video}-2.jpg`])
  await c.query(
    `insert into public.competitor_field_versions (site_id, competitor_channel_id, video_id, field, value_hash, precision, first_seen_at, last_seen_at)
     values ($1, $2, $3, 'title', 'h', '1d', now() - interval '3 days', now() - interval '1 day')`, [site, canal, video])
  await c.query(`insert into public.competitor_changes (site_id, video_id, change_type) values ($1, $2, 'title')`, [site, video])
}

export async function semearCena(c: Client): Promise<Cena> {
  const { org, site } = await criarSite(c)
  const admin = await criarUsuario(c)
  const comum = await criarUsuario(c)
  await c.query(`insert into public.organization_members (org_id, user_id, role) values ($1, $2, 'org_admin')`, [org, admin])
  const canalA = await criarCanal(c, site, 'Canal A')
  const canalB = await criarCanal(c, site, 'Canal B')
  const videoA = await criarVideo(c, canalA, 2)
  const videoA2 = await criarVideo(c, canalA, 20)
  const videoB = await criarVideo(c, canalB, 3)
  await semearDadosDoVideo(c, site, canalA, videoA)
  await semearDadosDoVideo(c, site, canalB, videoB)
  await c.query(`insert into public.competitor_channel_snapshots (competitor_channel_id, snapshot_date, view_count) values ($1, current_date - 1, 1000), ($1, current_date - 40, 900), ($2, current_date - 1, 500)`, [canalA, canalB])
  const cA = (await q1(c,
    `insert into public.competitor_video_comments (site_id, competitor_channel_id, video_id, youtube_comment_id, body, is_creator, published_at, first_seen_at, last_seen_at)
     values ($1, $2, $3, $4, 'comentário sintético', false, now() - interval '1 day', now() - interval '1 day', now()) returning id`,
    [site, canalA, videoA, 'cm' + randomUUID().replace(/-/g, '').slice(0, 10)])).id as string
  await c.query(`insert into public.competitor_video_comment_authors (comment_id, expires_at, site_id) values ($1, now() + interval '20 days', $2)`, [cA, site])
  const cB = (await q1(c,
    `insert into public.competitor_video_comments (site_id, competitor_channel_id, video_id, youtube_comment_id, body, is_creator, published_at, first_seen_at, last_seen_at, featured_channel_id)
     values ($1, $2, $3, $4, 'comentário de B que aponta para A', false, now() - interval '1 day', now() - interval '1 day', now(), $5) returning id`,
    [site, canalB, videoB, 'cm' + randomUUID().replace(/-/g, '').slice(0, 10), canalA])).id as string
  return { org, site, admin, comum, canalA, canalB, videoA, videoA2, videoB, comentarioDeBQueApontaParaA: cB }
}

// ───────────────────────── passos do fluxo de export ─────────────────────────

/** Pausa o canal e põe a pausa 10 minutos no passado (o banco recusa exportar antes de 6 minutos). */
export async function pausarEEnvelhecer(c: Client, cena: Cena, canal: string, minutos = 10): Promise<void> {
  const r = await escalar<string>(c, `select public.competitor_channel_pause($1, $2, $3) ->> 'status'`, [cena.site, canal, cena.admin])
  if (r !== 'pausado') throw new Error(`pausa inesperada: ${r}`)
  await c.query(`update public.competitor_channels set collection_paused_at = collection_paused_at - make_interval(mins => $2) where id = $1`, [canal, minutos])
  await c.query(`update public.competitor_collection_pauses set paused_at = paused_at - make_interval(mins => $2) where competitor_channel_id = $1 and resumed_at is null`, [canal, minutos])
}

/** O manifesto que o `exportar` mandaria: uma linha por tabela e mês com linha, lidas do próprio banco. */
export async function manifestoDoCanal(c: Client, canal: string, hash = 'a'): Promise<string> {
  const r = await escalar<unknown>(c,
    `select jsonb_agg(jsonb_build_object('table_name', x.table_name, 'period_start', x.period_start,
        'period_end', (x.period_start + interval '1 month - 1 day')::date, 'row_count', x.row_count, 'control_sum', x.control_sum,
        'file_sha256', repeat($2::text, 64), 'csv_sha256', repeat($2::text, 64),
        'blob_count', case when x.table_name = 'competitor_video_versions' then 0 end))
       from public.obs_archive_channel_counts($1) x`, [canal, hash])
  return JSON.stringify(r)
}

export async function registrar(c: Client, cena: Cena, canal: string, batch: string, hash = 'a'): Promise<Record<string, unknown>> {
  const j = await manifestoDoCanal(c, canal, hash)
  return (await q1(c, `select public.obs_archive_register($1, $2, $3, $4::jsonb) as r`, [cena.site, batch, canal, j])).r as Record<string, unknown>
}

export async function exportarConferirConfirmar(c: Client, cena: Cena, canal: string, batch: string): Promise<void> {
  await pausarEEnvelhecer(c, cena, canal)
  await registrar(c, cena, canal, batch)
  await c.query(`select public.obs_archive_verify($1, $2, $3)`, [cena.site, batch, canal])
  await c.query(`select public.obs_archive_confirm_nas($1, $2, $3, $4)`, [cena.site, batch, canal, cena.admin])
}

export interface Provas { lista: number; due: number; atrasados: number; fora: number }

const MARCAS = '[{"mark":1,"from_h":20,"until_h":100}]'

/** As quatro funções que escolhem ou cobram vídeo por canal, para o canal e o site da cena. */
export async function provasDasQuatro(c: Client, cena: Cena, canal: string, agora: 'agora' | 'daqui_a_8_dias' = 'agora'): Promise<Provas> {
  const t = agora === 'agora' ? 'clock_timestamp()' : `clock_timestamp() + interval '8 days'`
  const r = await q1(c,
    `select (public.competitor_hourly_health($1, ${t}, 14, 25) ->> 'videos_na_lista')::int as lista,
            (select count(*) from public.competitor_comment_due(${t}, $3::jsonb, interval '20 hours', 10000, '{}', interval '15 minutes', null, $1) d where d.channel_row_id = $2)::int as due,
            (public.competitor_comment_health($1, ${t}, $3::jsonb, 28, interval '2 hours', null) ->> 'retratos_atrasados')::int as atrasados,
            (public.competitor_series_health($1, ${t}) ->> 'fora_da_prova')::int as fora`,
    [cena.site, canal, MARCAS])
  return { lista: Number(r.lista), due: Number(r.due), atrasados: Number(r.atrasados), fora: Number(r.fora) }
}

/** Quantas linhas o canal tem em cada tabela do registro que existe no banco (contagem do TESTE, não do banco). */
export async function contagemPorTabela(c: Client, canal: string): Promise<Record<string, number>> {
  const r = await c.query(`select table_name, sum(row_count)::int as n from public.obs_archive_channel_counts($1) group by 1 order by 1`, [canal])
  return Object.fromEntries(r.rows.map((x: { table_name: string; n: number }) => [x.table_name, Number(x.n)]))
}
