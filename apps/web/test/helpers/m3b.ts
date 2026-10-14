/** Manutenção M3b: o SQL da migration vive em supabase/rascunhos/m3b.sql até a Tarefa 10 (TRAVA M3b-1). Este é o único lugar que a Tarefa 10 muda. */
import type { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

export const M3B_SQL_CAMINHO: string = resolve(__dirname, '../../../../supabase/rascunhos/m3b.sql')
export const M3B_EM_MIGRATION = false
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
  const videos: string[] = []
  for (let i = 0; i < (o.videos ?? 3); i++) {
    const v = randomUUID()
    // competitor_videos não tem site_id (o site vem do canal) e o id do YouTube mora em video_id (Phil I1).
    await c.query(`insert into public.competitor_videos (id, competitor_channel_id, video_id, title, published_at) values ($1::uuid, $2, substr(md5($1::text), 1, 11), 'v', now() - interval '60 days')`, [v, canal])
    videos.push(v)
  }
  return { site, canal, videos }
}
export async function semearDiaria(c: Client, videos: readonly string[], de: string, dias: number): Promise<void> {
  await c.query(`insert into public.competitor_video_daily (video_id, snap_date, views, likes, comments, taken_at)
    select v, d::date, 1000 + (extract(day from d))::int, null, 1, d + interval '12 hours'
      from unnest($1::uuid[]) v, generate_series($2::date, $2::date + ($3 - 1), interval '1 day') d`, [videos, de, dias])
}
