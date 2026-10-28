// apps/web/test/helpers/m6.ts
/** Manutenção M6: o SQL vive em supabase/rascunhos/m6.sql até a Tarefa 14 (TRAVA M6-1). Este é o único lugar que a Tarefa 14 muda. */
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { aplicarM2 } from './m2'
import { travarDdl } from './ddl-testes'
import { apagarCanais } from './limpa-cena'
import { aplicarM3b, escalar } from './m3b'
import { M10A_SQL } from '../integration/video-antigo-m10a-caminho'

export const M6_SQL_CAMINHO: string = resolve(__dirname, '../../../../supabase/rascunhos/m6.sql')
export const M6_EM_MIGRATION = false
export const HASH_REL_SQL_CAMINHO: string = resolve(__dirname, '../../../../supabase/sql/obs-archive-hash-rel.sql')
export type ParteM6 = 1 | 2 | 3 | 4 | 5 | 6 | 7   // 1 a 6 = M6a; 7 = M6b (o interruptor)

/** O rascunho até a parte `ate` (inclusive). Parte pedida que não existe falha alto. */
export function sqlM6Ate(ate?: ParteM6): string {
  const sql = readFileSync(M6_SQL_CAMINHO, 'utf8')
  if (ate === undefined || ate === 7) return sql
  const fim = sql.indexOf(`-- M6 PARTE ${ate + 1}`)
  if (fim < 0) throw new Error(`parte ${ate + 1} não encontrada no rascunho da M6`)
  return sql.slice(0, fim)
}

/** Aplica M2, M10a, M3b e a M6 até `ate` na conexão (o chamador abriu a transação e a desfaz). */
export async function prepararM6(c: Client, ate?: ParteM6): Promise<void> {
  await travarDdl(c)
  await aplicarM2(c)
  await c.query(readFileSync(M10A_SQL, 'utf8'))
  await aplicarM3b(c)
  await c.query(sqlM6Ate(ate))
}

/** Relógio falso local à transação: `obs_archive.agora` (timestamptz) e `obs_archive.hoje` (dia de SP, AAAA-MM-DD). */
export async function relogio(c: Client, agora: string, hoje?: string): Promise<void> {
  await c.query(`select set_config('obs_archive.agora', $1, true)`, [agora])
  const dia = hoje ?? (await escalar<string>(c, `select to_char(($1::timestamptz at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD')`, [agora]))
  await c.query(`select set_config('obs_archive.hoje', $1, true)`, [dia])
}

/** Recria `obs_archive_policy()` (só nesta transação) com `released = true` nas classes pedidas. */
export async function liberarClasses(c: Client, classes: readonly string[]): Promise<void> {
  const def = await escalar<string>(c, `select pg_get_functiondef('public.obs_archive_policy()'::regprocedure)`)
  const alvo = new RegExp(`(\\('(?:${classes.join('|')})', '[a-z_]+', '[a-z]+', \\d+, \\d+, \\d+, '[a-z_0-9]+', )false,`, 'g')
  const nova = def.replace(alvo, '$1true,')
  if (nova === def) throw new Error(`nenhuma linha da política trocada para ${classes.join(',')}`)
  await c.query(nova)
}

export async function novoAdmin(c: Client, site: string): Promise<string> {
  const id = randomUUID()
  await c.query(`insert into auth.users (id, instance_id, aud, role, email) values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2)`, [id, `m6-${id}@t.test`])
  const org = (await c.query(`select org_id from public.sites where id = $1`, [site])).rows[0].org_id as string
  await c.query(`insert into public.organization_members (org_id, user_id, role) values ($1, $2, 'org_admin')`, [org, id])
  return id
}

export function particaoDe(tabela: string, mes: string): string {
  return `obs_part.${tabela}_${mes.slice(0, 4)}${mes.slice(5, 7)}`
}

export interface SelarMes { site: string; classe: string; tabela: string; mes: string; versao?: number; nasHa?: string; b2ForjaHa?: string | null; restauradoHa?: string | null }

/**
 * Grava o registro de um mês selado e verde DIRETO nas tabelas (sem passar pelas rotas da M3b), com os três valores de cada unidade
 * lidos agora do online por obs_archive_content_hash: uma unidade por canal do site com linha no mês. `nasHa`/`b2ForjaHa`/`restauradoHa`
 * são intervalos ('2 hours'); null em b2/restauração = não gravar. É fixture de teste: a selagem de verdade é da M3b.
 */
export async function selarMes(c: Client, o: SelarMes): Promise<void> {
  const v = o.versao ?? 1
  const agora = `public.obs_archive_agora()`
  await c.query(`
    insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, control_sum, hash_conteudo, schema_fp, sha256_bytes, received_at, nas_attested_at)
    select $1::uuid, $2, $3, ch.id::text, $4::date, $5, h.row_count, h.control_sum::numeric, h.hash_conteudo,
           public.obs_archive_schema_fp(('public.' || $3)::regclass),
           case when h.row_count = 0 then null else repeat('a', 64) end, ${agora}, ${agora} - $6::interval
      from public.competitor_channels ch
      cross join lateral public.obs_archive_content_hash($1::uuid, $2, $3, ch.id, $4::date) h
     where ch.site_id = $1::uuid`, [o.site, o.classe, o.tabela, o.mes, v, o.nasHa ?? '1 hour'])
  await c.query(`
    insert into public.obs_archive_months (site_id, class, table_name, month, sealed_at, sealed_version, sealed_kind, rows_total, units_total,
                                           manifest_sha256, nas_attested_at, b2_forja_ok_at, b2_forja_manifest_sha256, b2_attested_at, b2_attested_via)
    select $1::uuid, $2, $3, $4::date, ${agora} - interval '1 day', $5, case when sum(u.row_count) > 0 then 'com_dado' else 'vazio_conferido' end,
           sum(u.row_count), count(*), repeat('m', 64), ${agora} - $6::interval,
           case when $7::interval is null then null else ${agora} - $7::interval end, repeat('m', 64),
           case when $7::interval is null then null else ${agora} - $7::interval end, case when $7::interval is null then null else 'forja' end
      from public.obs_archive_units u where u.site_id = $1::uuid and u.class = $2 and u.table_name = $3 and u.month = $4::date and u.version = $5
    on conflict (site_id, class, table_name, month) do update set sealed_at = excluded.sealed_at, sealed_version = excluded.sealed_version,
      sealed_kind = excluded.sealed_kind, rows_total = excluded.rows_total, units_total = excluded.units_total, unsealed_at = null, unsealed_reason = null,
      manifest_sha256 = excluded.manifest_sha256, nas_attested_at = excluded.nas_attested_at, b2_forja_ok_at = excluded.b2_forja_ok_at,
      b2_forja_manifest_sha256 = excluded.b2_forja_manifest_sha256, b2_attested_at = excluded.b2_attested_at, b2_attested_via = excluded.b2_attested_via`,
    [o.site, o.classe, o.tabela, o.mes, v, o.nasHa ?? '1 hour', o.b2ForjaHa === undefined ? '1 day' : o.b2ForjaHa])
  if (o.restauradoHa !== null) {
    await c.query(`insert into public.obs_archive_restores (site_id, class, table_name, schema_fp, origem, chave, units_checked, rows_restored, diff_rows, done_by, done_at)
      values ($1, $2, $3, public.obs_archive_schema_fp(('public.' || $3)::regclass), 'b2', 'cofre', 1, 10, 0, 'dono@t.test', ${agora} - $4::interval)`,
      [o.site, o.classe, o.tabela, o.restauradoHa ?? '10 days'])
  }
}

/** Partição do mês + `linhasPorVideo` linhas por vídeo, espalhadas pelo mês (site_id vem do canal do vídeo). */
async function semearJanela(c: Client, tabela: 'competitor_video_hourly' | 'competitor_video_early', videos: readonly string[], mes: string, linhasPorVideo: number): Promise<void> {
  await c.query(`select obs_part.criar_particao($1::regclass, $2::date)`, [`public.${tabela}`, mes])
  const cols = tabela === 'competitor_video_hourly' ? '(video_id, hour_slot, taken_at, site_id, views)' : '(video_id, taken_at, site_id, views, likes, comments)'
  const t = `(($2::date)::text || ' 00:00:00-03')::timestamptz + (g * interval '1 hour')`
  const sel = tabela === 'competitor_video_hourly' ? `${t}, ${t} + interval '5 minutes', ch.site_id, 100 + g` : `${t}, ch.site_id, 100 + g, 1, 1`
  await c.query(`
    insert into public.${tabela} ${cols}
    select v.id, ${sel}
      from public.competitor_videos v join public.competitor_channels ch on ch.id = v.competitor_channel_id
      cross join lateral generate_series(1, $3::int) g
     where v.id = any($1::uuid[])`, [videos, mes, linhasPorVideo])
}
export const semearHoraria = (c: Client, videos: readonly string[], mes: string, linhasPorVideo: number): Promise<void> => semearJanela(c, 'competitor_video_hourly', videos, mes, linhasPorVideo)
export const semearEarly = (c: Client, videos: readonly string[], mes: string, linhasPorVideo: number): Promise<void> => semearJanela(c, 'competitor_video_early', videos, mes, linhasPorVideo)

/** Apaga o canal pelo caminho que declara o destino (`apagarCanais` da M3b); não deixa resíduo em obs_archive_channel_removals. */
export async function apagarCanalDeclarando(c: Client, _site: string, canal: string, _admin: string): Promise<void> {
  await apagarCanais(c, 'id = $1', [canal])
}
