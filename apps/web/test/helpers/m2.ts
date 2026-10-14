// apps/web/test/helpers/m2.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'

/**
 * O SQL da M2. Até a Tarefa 8, Step 0: o rascunho, fora de supabase/migrations (TRAVA M2-1). No dia, o Step 0 troca estas duas
 * constantes (e só elas) para o arquivo da migration e `true`. Caminho por `__dirname`, nunca pelo `cwd` (muda entre `npm test -w`
 * e `npx vitest` da raiz).
 */
export const M2_SQL_CAMINHO: string = resolve(__dirname, '../../../../supabase/rascunhos/m2.sql')
export const M2_EM_MIGRATION = false
export const M2_SQL: string = readFileSync(M2_SQL_CAMINHO, 'utf8')

/**
 * O bloco 11 da M2 (pedidos 1 e 3 da E10), sozinho. A fixture da MG6 (cópia byte a byte da migration em produção) recria
 * `obs_archive_uncovered` e `obs_db_size_record` sem saber de partição; quem a reaplica (`garantirMg6`, da E10) roda este bloco
 * logo depois, na mesma transação. Inofensivo antes da conversão das séries.
 */
function bloco11(sql: string): string {
  const i = sql.indexOf('-- 11. ')
  const f = sql.indexOf('-- 12. ')
  if (i < 0 || f < 0 || f < i || sql.indexOf('-- 11. ', i + 1) >= 0 || sql.indexOf('-- 12. ', f + 1) >= 0) throw new Error('M2: marcadores do bloco 11 ausentes, repetidos ou fora de ordem')
  const b = sql.slice(i, f)
  if (/obs_part\.converter\(/.test(b) || !/competitor_channel_remove_archived/.test(b)) throw new Error('M2: bloco 11 com conteúdo inesperado')
  return b
}
export const M2_BLOCO_11: string = bloco11(M2_SQL)

/**
 * Yannis N4 (2ª rodada): quem aplica DDL (M2, MG6, M3b) em transação desfeita, em vários arquivos ao mesmo tempo (`HAS_LOCAL_DB=1 npm test` é paralelo),
 * dá deadlock e `tuple concurrently updated`. Todo aplicador pega este lock de transação ANTES de tocar no catálogo: os arquivos passam a
 * se enfileirar em vez de se travar. Fora de transação o lock solta no mesmo instante (inofensivo).
 */
export const TRAVA_DDL_TESTES = 7339001
export async function travarDdl(c: Client): Promise<void> {
  await c.query('select pg_advisory_xact_lock($1)', [TRAVA_DDL_TESTES])
}

/** Aplica o SQL inteiro na conexão (dentro da transação de quem chama, se houver). */
export async function aplicarM2(c: Client): Promise<void> {
  await travarDdl(c)
  await c.query(M2_SQL)
}

/**
 * Só a parte 1 (obs_part, funções, registro da conversão), sem a tabela de ensaio, sem as funções da E10 e sem a conversão das
 * três séries: segura para confirmar no banco compartilhado. Sem o marcador: se o SQL já converte as séries, falha alto (nunca
 * confirma a conversão por engano); se ainda não converte (Tarefa 2), aplica o que há.
 */
export const MARCA_PARTE_2 = '-- 8. A tabela de ensaio'
export async function aplicarM2SoFuncoes(c: Client): Promise<void> {
  await travarDdl(c)
  const corte = M2_SQL.indexOf(MARCA_PARTE_2)
  if (corte < 0) {
    if (/obs_part\.converter\('public\.competitor_video_/.test(M2_SQL)) throw new Error(`marcador "${MARCA_PARTE_2}" ausente no SQL da M2`)
    await c.query(M2_SQL)
    return
  }
  await c.query(M2_SQL.slice(0, corte))
}

/** A conversão das três séries está confirmada neste banco (`relkind = 'p'`). Banco fora do ar: false (quem chama já pulou por `skipIfNoLocalDb`). */
export async function m2NoBanco(url: string = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'): Promise<boolean> {
  const c = new Client({ connectionString: url })
  try {
    await c.connect()
    const r = await c.query(`select relkind::text as k from pg_class where oid = to_regclass('public.competitor_video_daily')`)
    return (r.rows[0] as { k?: string } | undefined)?.k === 'p'
  } catch {
    return false
  } finally {
    await c.end().catch(() => undefined)
  }
}

/**
 * Uma tabela com a forma da leitura horária, em `public`, com tudo o que a conversão tem de copiar: PK com a coluna de tempo,
 * duas FKs em cascata, check, índice, policy, RLS, comentário e as concessões padrão. Opcional: gatilho `before insert` que
 * soma 1 a `views` (faz a cópia divergir) e índice único sem a coluna de tempo (proibido em tabela particionada).
 */
export async function criarBrinquedo(c: Client, o: { gatilhoQueMuda?: boolean; unicoSemTempo?: boolean; semFk?: boolean } = {}): Promise<string> {
  const t = 'zz_m2_brinquedo_' + randomUUID().replace(/-/g, '').slice(0, 10)
  await c.query(`create table public.${t} (
      video_id uuid not null${o.semFk ? '' : ' references public.competitor_videos(id) on delete cascade'},
      hour_slot timestamptz not null,
      taken_at timestamptz not null,
      site_id uuid not null${o.semFk ? '' : ' references public.sites(id) on delete cascade'},
      views bigint not null,
      likes bigint,
      comments bigint,
      primary key (video_id, hour_slot),
      check (hour_slot = date_trunc('hour', taken_at at time zone 'UTC') at time zone 'UTC'))`)
  await c.query(`create index ${t}_slot on public.${t} (hour_slot)`)
  await c.query(`alter table public.${t} enable row level security`)
  await c.query(`create policy ${t}_select on public.${t} for select using (public.can_view_site(site_id))`)
  await c.query(`comment on table public.${t} is 'brinquedo da M2'`)
  if (o.gatilhoQueMuda) {
    await c.query(`create or replace function public.${t}_soma() returns trigger language plpgsql as $$ begin new.views := new.views + 1; return new; end $$`)
    await c.query(`create trigger ${t}_soma before insert on public.${t} for each row execute function public.${t}_soma()`)
  }
  if (o.unicoSemTempo) await c.query(`create unique index ${t}_unico on public.${t} (video_id, views)`)
  return t
}

export async function apagarBrinquedo(c: Client, t: string): Promise<void> {
  await c.query(`drop table if exists public.${t} cascade`)
  await c.query(`drop table if exists public.${t}_antiga cascade`)
  await c.query(`drop table if exists public.${t}_particionada cascade`)
  await c.query(`drop function if exists public.${t}_soma()`)
  await c.query(`delete from public.obs_partition_conversions where table_name = 'public.' || $1`, [t])
}

/**
 * Garante as partições mensais de competitor_video_daily para [de, de + dias - 1] (Yannis N1, 2ª rodada): em banco NOVO (db reset, como a CI) a M2
 * só cria a partição do mês de min(coluna) até +12, então uma semeadura em mês antigo falha com "no partition of relation". Idempotente; no-op se a
 * tabela não é particionada ou se obs_part.criar_particao ainda não existe (M2 não aplicada).
 */
export async function garantirParticoesDaDiaria(c: Client, de: string, dias: number): Promise<void> {
  const ok = await c.query(
    `select to_regprocedure('obs_part.criar_particao(regclass,date)') is not null
        and coalesce((select relkind::text from pg_class where oid = 'public.competitor_video_daily'::regclass), '') = 'p' as vale`)
  if (!ok.rows[0].vale) return
  const meses = await c.query(
    `select g::date::text as mes from generate_series(date_trunc('month', $1::date), date_trunc('month', $1::date + ($2::int - 1)), interval '1 month') g`, [de, dias])
  for (const m of meses.rows) await c.query(`select obs_part.criar_particao('public.competitor_video_daily'::regclass, $1::date)`, [m.mes])
}
