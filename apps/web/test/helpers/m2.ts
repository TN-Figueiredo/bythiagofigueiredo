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
 * O bloco 11 da M2 (pedidos 1 e 3 da E10), sozinho, SEM o 11b (a guarda por folhas parte do corpo da F1, não do da MG6: quem aplica a MG6
 * recebe o 11b só pela M2 inteira, depois da F1). A fixture da MG6 (cópia byte a byte da migration em produção) recria
 * `obs_archive_uncovered` e `obs_db_size_record` sem saber de partição; quem a reaplica (`garantirMg6`, da E10) roda este bloco
 * logo depois, na mesma transação. Inofensivo antes da conversão das séries.
 */
function bloco11(sql: string): string {
  const i = sql.indexOf('-- 11. ')
  const f = sql.indexOf('-- 11b. ')
  if (i < 0 || f < 0 || f < i || sql.indexOf('-- 11. ', i + 1) >= 0 || sql.indexOf('-- 11b. ', f + 1) >= 0) throw new Error('M2: marcadores do bloco 11 ausentes, repetidos ou fora de ordem')
  const b = sql.slice(i, f)
  if (/obs_part\.converter\(/.test(b) || !/obs_db_size_record/.test(b) || /competitor_channel_remove_archived\(/.test(b)) throw new Error('M2: bloco 11 com conteúdo inesperado')
  return b
}
export const M2_BLOCO_11: string = bloco11(M2_SQL)

/** Aplica o SQL inteiro na conexão (dentro da transação de quem chama, se houver). */
export async function aplicarM2(c: Client): Promise<void> {
  await c.query(M2_SQL)
}

/**
 * Só a parte 1 (obs_part, funções, registro da conversão), sem a tabela de ensaio, sem as funções da E10 e sem a conversão das
 * três séries: segura para confirmar no banco compartilhado. Sem o marcador: se o SQL já converte as séries, falha alto (nunca
 * confirma a conversão por engano); se ainda não converte (Tarefa 2), aplica o que há.
 */
export const MARCA_PARTE_2 = '-- 8. A tabela de ensaio'
export async function aplicarM2SoFuncoes(c: Client): Promise<void> {
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
