/** Manutenção M3b: o SQL da migration vive em supabase/rascunhos/m3b.sql até a Tarefa 10 (TRAVA M3b-1). Este é o único lugar que a Tarefa 10 muda. */
import { Client } from 'pg'
import { skipIfNoLocalDb } from './db-skip'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { garantirParticoesDaDiaria, travarDdl } from './ddl-testes'

export const M3B_SQL_CAMINHO: string = resolve(__dirname, '../../../../supabase/migrations', readdirSync(resolve(__dirname, '../../../../supabase/migrations')).find(n => n.endsWith('_manutencao_m3b_arquivo.sql')) ?? 'manutencao_m3b_ausente.sql')
export const M3B_EM_MIGRATION = true
export const M3B_DESFAZER_CAMINHO: string = resolve(__dirname, '../../../../supabase/rascunhos/m3b-desfazer.sql')
export const HASH_SQL_CAMINHO: string = resolve(__dirname, '../../../../supabase/sql/obs-archive-hash.sql')
export const M3B_SQL = (): string => readFileSync(M3B_SQL_CAMINHO, 'utf8')
export const SITE_TESTE = '00000000-0000-0000-0000-00000000a3b0'

export type ParteM3b = 1 | 2 | 3 | 4 | 5 | 6 | 7

/**
 * O texto do rascunho até a parte `ate` (inclusive). Parte pedida que ainda não existe no rascunho falha alto (nunca aplica "o que há"):
 * é o que faz o teste de cada tarefa falhar antes da parte nascer. `ate` omitido: tudo.
 */
export function sqlM3bAte(ate?: ParteM3b): string {
  const sql = M3B_SQL()
  const partes = [...sql.matchAll(/^-- M3B PARTE (\d+)/gm)].map(m => Number(m[1]))
  const maior = partes.length ? Math.max(...partes) : 0
  if (ate === undefined) return sql
  if (ate > maior) throw new Error(`parte ${ate} não encontrada no rascunho (a maior é ${maior})`)
  if (ate === maior) return sql
  const fim = sql.indexOf(`-- M3B PARTE ${ate + 1}`)
  if (fim < 0) throw new Error(`parte ${ate + 1} não encontrada no rascunho`)
  return sql.slice(0, fim)
}

/** Aplica o rascunho até a parte `ate` (inclusive), na conexão dada. O chamador abre e desfaz a transação. */
export async function aplicarM3b(c: Client, ate?: ParteM3b): Promise<void> {
  await travarDdl(c)   // Yannis N4
  await c.query(sqlM3bAte(ate))
}
export async function m3bNoBanco(c: Client): Promise<boolean> {
  const r = await c.query(`select to_regclass('public.obs_archive_units') is not null as ok`)
  return r.rows[0]?.ok === true
}

export async function escalar<T = number>(c: Client, sql: string, params: unknown[] = []): Promise<T> {
  const r = await c.query({ text: sql, values: params, rowMode: 'array' })
  return (r.rows[0] as unknown[])[0] as T
}
export async function q1(c: Client, sql: string, params: unknown[] = []): Promise<Record<string, unknown>> {
  const r = await c.query(sql, params)
  if (r.rows.length !== 1) throw new Error(`esperava 1 linha, veio ${r.rows.length}: ${sql.slice(0, 80)}`)
  return r.rows[0] as Record<string, unknown>
}
/** Roda dentro de um savepoint: erro vira { ok: false, code, message } e a transação segue viva. */
export async function tenta(c: Client, sql: string, params: unknown[] = []): Promise<{ ok: true; rows: Record<string, unknown>[] } | { ok: false; code: string; message: string }> {
  await c.query('savepoint tenta_m3b')
  try {
    const r = await c.query(sql, params)
    await c.query('release savepoint tenta_m3b')
    return { ok: true, rows: r.rows as Record<string, unknown>[] }
  } catch (e) {
    await c.query('rollback to savepoint tenta_m3b')
    const o = e as { code?: string; message?: string }
    return { ok: false, code: o.code ?? '', message: o.message ?? String(e) }
  }
}

/** Um site e um canal de teste, com N vídeos. Devolve os ids. Só dentro de transação desfeita. */
export async function semearCanal(c: Client, o: { site?: string; videos?: number; addedAt?: string | null } = {}): Promise<{ site: string; canal: string; videos: string[] }> {
  const site = o.site ?? SITE_TESTE
  const org = (await c.query(`select id from public.organizations where parent_org_id is null order by created_at limit 1`)).rows[0]?.id as string | undefined
    ?? (await q1(c, `insert into public.organizations (name, slug) values ('m3b raiz', 'm3b-raiz-' || substr(gen_random_uuid()::text, 1, 8)) returning id`)).id as string
  await c.query(`insert into public.sites (id, org_id, name, slug, domains, primary_domain)
    values ($1::uuid, $2, 'm3b', 'm3b-' || substr($1::text, 25), array['m3b-' || substr($1::text, 25) || '.test'], 'm3b-' || substr($1::text, 25) || '.test') on conflict (id) do nothing`, [site, org])
  const canal = randomUUID()
  await c.query(`insert into public.competitor_channels (id, site_id, channel_id, channel_name, added_at) values ($1::uuid, $2, 'UC' || substr(md5($1::text), 1, 22), 'canal m3b', $3::timestamptz)`,
    [canal, site, o.addedAt === undefined ? '2026-09-15T12:00:00Z' : o.addedAt])
  // competitor_videos não tem site_id (o site vem do canal) e o id do YouTube mora em video_id (Phil I1).
  const r = await c.query(`insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at)
    select $1::uuid, substr(md5(gen_random_uuid()::text), 1, 11), 'v', now() - interval '60 days' from generate_series(1, $2::int) returning id`, [canal, o.videos ?? 3])
  const videos = r.rows.map(x => x.id as string)
  return { site, canal, videos }
}
export async function semearDiaria(c: Client, videos: readonly string[], de: string, dias: number): Promise<void> {
  await garantirParticoesDaDiaria(c, de, dias)   // banco novo (CI): só há a partição do mês de min(coluna) (Yannis N1)
  await c.query(`insert into public.competitor_video_daily (video_id, snap_date, views, likes, comments, taken_at)
    select v, d::date, 1000 + (extract(day from d))::int, null, 1, d + interval '12 hours'
      from unnest($1::uuid[]) v, generate_series($2::date, $2::date + ($3 - 1), interval '1 day') d`, [videos, de, dias])
}

/**
 * CORRIDAS (duas conexões) precisam do rascunho CONFIRMADO no banco, e confirmar no banco compartilhado/da CI quebra a lista fechada da E10
 * (Yannis 1, 14/10). Por isso elas só rodam com M3B_CORRIDAS=1 e um SUPABASE_DB_URL explícito (um banco de integração, nunca o 54322 do
 * navegador): confirmam no beforeAll e DESFAZEM no afterAll (supabase/rascunhos/m3b-desfazer.sql). Até a Tarefa 10 virar migration.
 */
const TRAVA_CORRIDAS_M3B = 7339002
export const corridasLigadas = (): boolean => !skipIfNoLocalDb() && process.env.M3B_CORRIDAS === '1'
export function urlDasCorridas(): string {
  const u = process.env.SUPABASE_DB_URL
  if (!u) throw new Error('M3B_CORRIDAS=1 exige SUPABASE_DB_URL explícito (banco de integração, ex.: 54422); o padrão 54322 é o do navegador')
  if (/:54322\//.test(u)) throw new Error('M3B_CORRIDAS=1 não roda no 54322 (banco do navegador)')
  return u
}
/** Confirma as partes 1..ate do rascunho (a M2 e a M10a já têm de estar no banco). Idempotente. */
let guardaDasCorridas: Client | null = null
export async function confirmarM3bParaCorridas(ate: ParteM3b): Promise<void> {
  // Yannis N3 (2ª rodada): as corridas confirmam e desfazem a M3b no banco INTEIRO; dois arquivos de corrida ao mesmo tempo se desfazem um ao outro
  // e deixam o banco confirmado. Lock de sessão numa conexão à parte, solto no desfazer: o segundo arquivo falha alto em vez de seguir. A suíte de
  // corridas roda em série (`vitest run --no-file-parallelism` com M3B_CORRIDAS=1).
  const g = new Client({ connectionString: urlDasCorridas() }); await g.connect()
  if (!(await g.query('select pg_try_advisory_lock($1) as ok', [TRAVA_CORRIDAS_M3B])).rows[0].ok) {
    await g.end()
    throw new Error('M3B_CORRIDAS=1 exige arquivos em série: outra suíte de corridas já confirmou a M3b neste banco (use --no-file-parallelism)')
  }
  guardaDasCorridas = g
  const x = new Client({ connectionString: urlDasCorridas() }); await x.connect()
  try {
    const r = await x.query(`select to_regclass('public.obs_archive_video_policy') is not null as m10a, (select relkind::text from pg_class where oid = 'public.competitor_video_daily'::regclass) = 'p' as m2`)
    if (!r.rows[0].m2 || !r.rows[0].m10a) throw new Error('corridas: a M2 e a M10a precisam estar confirmadas neste banco')
    await x.query(sqlM3bAte(ate))
  } finally { await x.end() }
}
/** Volta o banco ao estado sem a M3b (só toca o que a M3b cria). Chamar depois de fechar as conexões das corridas. */
export async function desfazerM3bDasCorridas(): Promise<void> {
  if (guardaDasCorridas === null) return   // Yannis R3-2: quem não confirmou (falhou no lock) não desfaz a M3b de outro arquivo
  const x = new Client({ connectionString: urlDasCorridas() }); await x.connect()
  try { await x.query(readFileSync(M3B_DESFAZER_CAMINHO, 'utf8')) } finally {
    await x.end()
    if (guardaDasCorridas) { await guardaDasCorridas.end(); guardaDasCorridas = null }   // solta o lock de sessão
  }
}

/**
 * Volta competitor_channel_remove ao corpo da 000004 quando a 000005 (v_cheias) já está no banco (CI aplica todas as migrations):
 * os testes que reaplicam a 000004 precisam do corpo que a guarda de md5 dela aceita. Só dentro de transação: o begin/commit
 * do desfazer sai, e o rollback do teste devolve o corpo vigente.
 */
export async function voltarA04(c: Client): Promise<void> {
  const tem = await escalar<boolean>(c, `select prosrc ~ 'v_cheias' from pg_proc where oid = 'public.competitor_channel_remove(uuid,uuid,text,text,uuid)'::regprocedure`)
  if (!tem) return
  const sql = readFileSync(resolve(__dirname, '../../../../supabase/rascunhos/m3b-apagar-so-cheias-desfazer.sql'), 'utf8')
  await c.query(sql.replace(/^begin;\s*$/m, '').replace(/^commit;\s*$/m, ''))
}
