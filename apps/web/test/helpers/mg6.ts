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
import { M2_BLOCO_11 } from './m2'
import { garantirParticoesDaDiaria, travarDdl } from './ddl-testes'
import { lerSqlDaX3, lerX3Registro } from './x3-sql'
import { lerSqlDaF1, lerSqlDaT13 } from './f1-sql'

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
  await travarDdl(c)   // Yannis N4: DDL em transação desfeita se enfileira entre arquivos
  await c.query(lerSqlDaMg6())
  // a fixture é a MG6 de produção byte a byte e recria duas funções sem saber de partição; o bloco 11 da M2 as recria com o conserto
  await c.query(M2_BLOCO_11)
  // A5 X3: a MG6 reaplicada recria o registro com as 22; com a X3 presente no banco da transação o registro tem de voltar a 27
  // (sem isso o `garantirMg6` de um teste da E10 deixaria `obs_archive_uncovered()` com as cinco tabelas novas).
  // `E10_COM_X3=1` aplica a migration da X3 inteira na transação (rodar a pasta da E10 com a X3 presente, plano X3 T2 passo 5).
  if (process.env.E10_COM_X3 === '1') await c.query(lerSqlDaX3())
  else if ((await c.query(`select to_regclass('public.competitor_playlists') as t`)).rows[0]?.t) await c.query(lerX3Registro())
  // A5 F1 (Remover canal): a MG6 reaplicada recria o registro e a remoção arquivada sem a watch; com a S4 e a F1 presentes, a F1 volta a valer.
  const f1 = lerSqlDaF1()
  if (f1 !== null && (await c.query(`select to_regclass('public.yt_watch_readings') is not null and to_regclass('public.competitor_channel_sections') is not null as ok`)).rows[0]?.ok) await c.query(f1)
}

/**
 * Abre a transação e aplica a MG6. Banco ocupado por outro agente (`55P03` lock_timeout, `40P01` deadlock): espera e repete,
 * até 3 vezes; passando disso, o erro sobe (o teste falha dizendo que o banco estava ocupado, nunca em silêncio).
 */
/**
 * MG6 + F1 (garantirMg6) e depois a 20261021000007 (T13), que é o corpo de partida do bloco 11b da M2. Fica fora de
 * `garantirMg6` de propósito: as suítes da E10 e da E4 esperam 30 entradas no registro. Quem aplica a M2 ou a M3b depois
 * usa esta (MG6+F1 deixa o corpo da F1, e não o da 0007, e a M2 cairia em `M2:..._divergente`).
 */
export async function garantirComT13(c: Client): Promise<void> {
  await garantirMg6(c)
  const t13 = lerSqlDaT13()
  if (t13 !== null && (await c.query(`select to_regclass('public.ab_native_observados') is not null and to_regclass('public.ab_native_obs_cursor') is not null as ok`)).rows[0]?.ok) await c.query(t13)
}

export async function iniciarComMg6(c: Client, isolamento: 'read committed' | 'repeatable read' = 'read committed', folhas = true): Promise<void> {
  for (let tentativa = 0; ; tentativa++) {
    await c.query(`begin isolation level ${isolamento}`)
    try {
      await garantirMg6(c)
      if (folhas) await guardaPorFolhas(c)   // `folhas = false`: a suíte da T13 precisa do corpo puro da F1 (guarda de md5 da 20261021000007)
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
export async function emTransacao<T>(c: Client, fn: () => Promise<T>, isolamento: 'read committed' | 'repeatable read' = 'read committed', folhas = true): Promise<T> {
  await iniciarComMg6(c, isolamento, folhas)
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
    [canal, 'e10' + randomUUID().replace(/-/g, '').slice(0, 8), diasAtras])).id as string
}

/** Uma linha em quase toda tabela do registro para o vídeo (e o canal). Datas relativas a hoje. */
export async function semearDadosDoVideo(c: Client, site: string, canal: string, video: string): Promise<void> {
  await garantirParticoesDaDiaria(c, new Date(Date.now() - 41 * 86400000).toISOString().slice(0, 10), 42)   // current_date - 40 .. - 1 (Yannis N1)
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

/** `semX3`: os testes da própria X3 semeiam as tabelas de playlists à mão e não querem a semente padrão delas. */
export async function semearCena(c: Client, opcoes: { semX3?: boolean; semWatch?: boolean } = {}): Promise<Cena> {
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
  await semearRestoDoFecho(c, { site, canalA, canalB, videoA, videoB, comentarioA: cA, comentarioB: cB }, opcoes.semX3 === true)
  if (opcoes.semWatch !== true) await semearWatchBase(c, site, [videoA, videoB])
  return { org, site, admin, comum, canalA, canalB, videoA, videoA2, videoB, comentarioDeBQueApontaParaA: cB }
}

/**
 * (revisão Phil 14/10, I-1) Uma linha, para o canal A e para o canal B, em CADA tabela do fecho de cascata que `semearCena` ainda não
 * cobria: canal e vídeo em `field_versions` e `raw`, mapa de horas, faixas, primeiras horas, horária, dobra, resposta de comentário,
 * marcas e retratos de comentário, tarefa e leitura da forja. Com a semente incompleta, o filtro quebrado de dez das vinte e duas
 * entradas do registro deixava os testes verdes (contava 0 com 0). Só as tabelas da MG4 e da MG18, que ainda não existem, ficam de fora.
 */
async function semearRestoDoFecho(c: Client, o: { site: string; canalA: string; canalB: string; videoA: string; videoB: string; comentarioA: string; comentarioB: string }, semX3: boolean): Promise<void> {
  const { site, canalA, canalB, videoA, videoB } = o
  const canais = [canalA, canalB]
  const videos: Array<[string, string]> = [[canalA, videoA], [canalB, videoB]]
  for (const canal of canais) {
    // nível do canal (vídeo nulo) em field_versions e raw
    await c.query(`insert into public.competitor_field_versions (site_id, competitor_channel_id, video_id, field, value_hash, precision, first_seen_at, last_seen_at)
                   values ($1, $2, null, 'subs', 'h', '1d', now() - interval '3 days', now() - interval '1 day')`, [site, canal])
    // is_current = false: o índice `idx_craw_one_current_channel` só admite um retrato corrente de canal, e há teste que insere o seu
    await c.query(`insert into public.competitor_raw (site_id, competitor_channel_id, video_id, raw_sha256, first_seen_at, last_seen_at, raw, is_current)
                   values ($1, $2, null, $3, now() - interval '2 days', now() - interval '1 day', '{}'::jsonb, false)`, [site, canal, 'canal-' + canal])
    await c.query(`insert into public.competitor_channel_hour_map (competitor_channel_id, month, format, phase, site_id, views_sum, likes_sum, comments_sum, views_share, likes_share, comments_share, n_intervals)
                   values ($1, date_trunc('month', now())::date, 'longo', 'lancamento', $2, array_fill(1::bigint, array[168]), array_fill(1, array[168]), array_fill(1, array[168]),
                           array_fill(0.5::real, array[168]), array_fill(0.5::real, array[168]), array_fill(0.5::real, array[168]), array_fill(1, array[168]))`, [canal, site])
  }
  for (const [canal, video] of videos) {
    await c.query(`insert into public.competitor_raw (site_id, competitor_channel_id, video_id, raw_sha256, first_seen_at, last_seen_at, raw)
                   values ($1, $2, $3, $4, now() - interval '2 days', now(), '{}'::jsonb)`, [site, canal, video, 'video-' + video])
    await c.query(`insert into public.competitor_video_tier_spans (video_id, from_date, tier, site_id) values ($1, current_date - 10, 'diaria', $2)`, [video, site])
    await c.query(`insert into public.competitor_video_early (video_id, taken_at, site_id, views) values ($1, now() - interval '1 day', $2, 3)`, [video, site])
    await c.query(`insert into public.competitor_video_hourly (video_id, hour_slot, taken_at, site_id, views) values ($1, date_trunc('hour', now()), date_trunc('hour', now()), $2, 3)`, [video, site])
    await c.query(`insert into public.competitor_hour_fold_log (video_id, day, site_id, intervals_clean, intervals_long) values ($1, current_date - 2, $2, 1, 1)`, [video, site])
    await c.query(`insert into public.competitor_video_comment_snaps (video_id, mark, site_id, competitor_channel_id, taken_at, video_age_hours, status, rule_version, rule_params, units_used)
                   values ($1, 7, $2, $3, now(), 30, 'ok', 1, '{}'::jsonb, 1)`, [video, site, canal]) // marca 7: as provas das quatro funções olham a marca 1
  }
  // resposta de comentário (a linha filha do canal A) e marcas de comentário
  const resposta = (await q1(c,
    `insert into public.competitor_video_comments (site_id, competitor_channel_id, video_id, youtube_comment_id, parent_id, body, is_creator, published_at, first_seen_at, last_seen_at)
     values ($1, $2, $3, $4, $5, 'resposta sintética', true, now() - interval '1 day', now() - interval '1 day', now()) returning id`,
    [site, canalA, videoA, 'rp' + randomUUID().replace(/-/g, '').slice(0, 10), o.comentarioA])).id as string
  for (const comentario of [o.comentarioA, resposta, o.comentarioB]) {
    await c.query(`insert into public.competitor_video_comment_marks (comment_id, mark, site_id, likes) values ($1, 1, $2, 3)`, [comentario, site])
  }
  // A5 X3: quando as tabelas de playlists existem na transação, uma linha em cada uma, para os dois canais (sem a semente, o filtro
  // quebrado de uma delas deixaria os testes verdes: contava 0 com 0)
  if (!semX3 && (await c.query(`select to_regclass('public.competitor_playlists') as t`)).rows[0]?.t) {
    for (const canal of canais) {
      const ref = (await q1(c,
        `insert into public.competitor_playlists (site_id, competitor_channel_id, playlist_id, title, item_count, state_sha256, first_seen_at, last_seen_at)
         values ($1, $2, $3, 'sintética', 1, 'h', now() - interval '2 days', now() - interval '1 day') returning id`,
        [site, canal, 'PL' + randomUUID().replace(/-/g, '').slice(0, 14)])).id as string
      await c.query(`insert into public.competitor_playlist_versions (playlist_ref, site_id, state_sha256, raw, observed_at) values ($1, $2, 'h', '{}'::jsonb, now() - interval '2 days')`, [ref, site])
      await c.query(`insert into public.competitor_playlist_items (playlist_ref, item_id, site_id, youtube_video_id, position, first_seen_at) values ($1, 'it1', $2, 'abcdefghijk', 0, now() - interval '2 days')`, [ref, site])
      await c.query(`insert into public.competitor_channel_sections (competitor_channel_id, site_id, state_sha256, raw, observed_at) values ($1, $2, 'h', '{}'::jsonb, now() - interval '2 days')`, [canal, site])
      await c.query(
        `insert into public.competitor_playlist_reads (competitor_channel_id, site_id, first_visit_at, last_visit_at, last_visit_day, last_status, last_units)
         values ($1, $2, now() - interval '2 days', now() - interval '1 day', current_date - 1, 'ok', 3)`, [canal, site])
    }
  }
  // a forja: um nicho, uma tarefa por vídeo e a leitura que a tarefa gerou
  await c.query(`insert into public.youtube_niches (site_id, slug, label, color_dark, color_light) values ($1, 'sint', 'S', '#AAB4C0', '#4B5563')`, [site])
  for (const [, video] of videos) {
    const tarefa = (await q1(c,
      `insert into public.youtube_intelligence_tasks (id, site_id, task_type, target_niche, target_video_id, trigger_type, status)
       values ($1, $2, 'leitura-video', 'sint', $3, 'manual', 'completed') returning id`, [randomUUID(), site, video])).id as string
    await c.query(`insert into public.competitor_readings (site_id, task_id, task_type, video_id, fmt, model, generated_at, sent, text)
                   values ($1, $2, 'leitura-video', $3, 'long', 'm', now() - interval '1 day', '{}'::jsonb, '{}'::jsonb)`, [site, tarefa, video])
  }
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

/** As tabelas do registro (que existem) cuja coluna `id` é de identidade ou tem sequência: do CATÁLOGO, para conferir a lista fixa do comando de recarga. */
export async function tabelasComIdentidade(c: Client): Promise<string[]> {
  const r = await c.query(
    `select distinct rel.relname::text as nome
       from public.obs_archive_registry() t
       join pg_class rel on rel.oid = to_regclass('public.' || quote_ident(t.table_name))
       join pg_attribute a on a.attrelid = rel.oid and a.attname = 'id' and not a.attisdropped
       left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where a.attidentity <> '' or pg_get_expr(d.adbin, d.adrelid) like 'nextval(%'
      order by 1`)
  return r.rows.map((x: { nome: string }) => x.nome)
}

// ───────────────────────── a watch (S4) ─────────────────────────

/** Um alvo ativo, uma miniatura e uma leitura por vídeo (linha de `competitor_videos.id`); só quando as tabelas da S4 existem. */
export async function semearWatchBase(c: Client, site: string, videos: string[]): Promise<void> {
  if (!(await c.query(`select to_regclass('public.yt_watch_readings') as t`)).rows[0]?.t) return
  for (const v of videos) {
    const yt = (await q1(c, `select video_id from public.competitor_videos where id = $1`, [v])).video_id as string
    await semearWatchDoVideo(c, site, yt, { leituras: 1, miniaturas: 1, alvo: true })
  }
}

/** Semeia a watch de um vídeo do YouTube (id de 11 caracteres). Devolve os ids das leituras. */
export async function semearWatchDoVideo(c: Client, site: string, yt: string, o: { leituras: number; miniaturas: number; alvo: boolean; tipo?: 'concorrente' | 'proprio' }): Promise<{ leituras: number[]; miniaturas: number[] }> {
  if (o.alvo) {
    await c.query(
      `insert into public.yt_watch_alvos (site_id, youtube_video_id, tipo, motivo_ate, coleta_ate, hora_base_min, proxima_rodada_em)
       values ($1, $2, $3, $4, now() + interval '20 days', 60, now() + interval '1 hour')`,
      [site, yt, o.tipo ?? 'concorrente', (o.tipo ?? 'concorrente') === 'concorrente' ? 'janela_concorrente' : 'janela_propria'])
  }
  const miniaturas: number[] = []
  for (let i = 0; i < o.miniaturas; i++) {
    miniaturas.push((await q1(c,
      `insert into public.yt_watch_thumbs (site_id, youtube_video_id, host, variante, http, primeira_vista, ultima_vista)
       values ($1, $2, 'i.ytimg.com', $3, 200, now() - interval '2 days', now() - interval '1 day') returning id`,
      [site, yt, 'v' + i])).id as number)
  }
  const leituras: number[] = []
  for (let i = 0; i < o.leituras; i++) {
    leituras.push((await q1(c,
      `insert into public.yt_watch_readings (site_id, youtube_video_id, lida_em, rodada_id, origem_rede, versao_leitor, http, idioma, titulo_oficial, titulo_oficial_fonte, renderers_presentes, miniatura_id)
       values ($1, $2, now() - make_interval(hours => $3), $4, 'vercel', 1, 200, 'pt', 'Título', 'videoDetails', 0, $5) returning id`,
      [site, yt, 20 - i, randomUUID(), i === 0 && miniaturas.length > 0 ? miniaturas[0] : null])).id as number)
  }
  return { leituras, miniaturas }
}

/**
 * Com a M2 aplicada (séries particionadas) a F1 (ou a T13) reaplicada pelos helpers mede n_tup_del pela mãe, que vale 0 (a estatística é
 * por folha), e a remoção recusa com `E10:apagou_alem_do_arquivo: competitor_video_daily apagadas=0`. Mesma troca do 11b/11c da M2, feita
 * sobre o corpo instalado (o texto do 11b/11c parte do corpo da T13 e exige o registro de 32; aqui o registro pode ter 30): soma das
 * folhas de pg_partition_tree e o fecho sem partição. Sem a M2 (séries comuns) não faz nada.
 */
export async function guardaPorFolhas(c: Client): Promise<void> {
  if ((await c.query(`select relkind::text as k from pg_class where oid = to_regclass('public.competitor_video_daily')`)).rows[0]?.k !== 'p') return
  const SOMA = `coalesce((select sum(x.n_tup_del) from pg_catalog.pg_stat_xact_user_tables x where x.relid = c.oid or x.relid in (select pt.relid from pg_catalog.pg_partition_tree(c.oid) pt where pt.isleaf)), 0)`
  for (const assinatura of ['public.competitor_channel_remove_archived(uuid,uuid,uuid)', 'public.competitor_channel_delete_unarchived(uuid,uuid,uuid,text,text)']) {
    const def = String((await c.query(`select pg_get_functiondef($1::regprocedure) as d`, [assinatura])).rows[0]?.d)
    if (/pg_partition_tree/.test(def)) continue
    const novo = def.replaceAll('coalesce(s.n_tup_del, 0)', SOMA).replaceAll(`where n.nspname = 'public'`, `where n.nspname = 'public' and not c.relispartition`)
    if (novo === def) throw new Error(`guardaPorFolhas: nada a trocar em ${assinatura}`)
    await c.query(novo)
  }
}
