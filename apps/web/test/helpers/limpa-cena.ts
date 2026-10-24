/**
 * Limpeza de cena de teste que apaga `competitor_channels` ou `sites` (o delete de site desce em cascata até os canais).
 *
 * Por que existe: com a M3b no banco, o gatilho `obs_archive_z_destino_declarado` recusa o delete de canal que não declarou
 * o destino do arquivo na MESMA transação (`destino_do_arquivo_nao_declarado`). Sem a M3b a declaração não existe. Estes
 * helpers servem aos dois mundos: com `obs_archive_channel_removals` no banco declaram (`apagar`, `botao`) antes do delete e
 * apagam a linha que declararam depois (resíduo causaria `site_ambiguo` em teste que chama sem site); sem a tabela, é o
 * `delete` puro.
 *
 * Regras (plano da M3b, Passo 0a, rodadas 0.6 e 0.7):
 *  - roda só por conexão `pg` como `postgres` (o `service_role` não apaga a linha de remoção: K3);
 *  - o `insert` usa `on conflict ... do update set declared_xid = pg_current_xact_id()` (xid velho recusaria o delete);
 *  - o `delete` da linha declarada filtra `declared_xid = pg_current_xact_id() and removed_via = 'botao'` e só os canais que
 *    este helper declarou;
 *  - `c` é UMA conexão (Client), não Pool. Dentro de transação do teste o helper usa savepoint; fora, abre a sua.
 *
 * Teste novo que apaga canal ou site usa estes helpers: `test/manutencao/limpeza-de-teste-forma.test.ts` falha se não usar.
 * `apagarCanaisDeTeste`/`apagarSitesDeTeste` abrem conexão curta em `SUPABASE_DB_URL` (para teardown que antes ia por PostgREST).
 */
import { Client } from 'pg'

export interface IConexaoDeTeste {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>
}

const DB_URL = (): string => process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

interface ICanalDeclarado { site_id: string; channel_ref: string }

async function haRegistroDeRemocao(c: IConexaoDeTeste): Promise<boolean> {
  const r = await c.query(`select to_regclass('public.obs_archive_channel_removals') is not null as ok`)
  return r.rows[0]?.ok === true
}

async function emTransacao(c: IConexaoDeTeste, corpo: () => Promise<void>): Promise<void> {
  let fora = false
  try { await c.query('savepoint limpa_cena') } catch { fora = true }
  if (fora) await c.query('begin')
  try {
    await corpo()
    await c.query(fora ? 'commit' : 'release savepoint limpa_cena')
  } catch (e) {
    await c.query(fora ? 'rollback' : 'rollback to savepoint limpa_cena').catch(() => undefined)
    throw e
  }
}

async function apagarComDeclaracao(c: IConexaoDeTeste, alvo: string, quaisCanais: string, where: string, params: unknown[]): Promise<void> {
  if (!(await haRegistroDeRemocao(c))) { await c.query(`delete from public.${alvo} where ${where}`, params); return }
  await emTransacao(c, async () => {
    const declarados = await c.query(
      `insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known, declared_xid)
       select site_id, id::text, 'botao', 'apagar', now(), true, pg_current_xact_id()
         from public.competitor_channels where ${quaisCanais}
       on conflict (site_id, channel_ref) do update set declared_xid = pg_current_xact_id()
       returning site_id, channel_ref`, params)
    await c.query(`delete from public.${alvo} where ${where}`, params)
    const meus = declarados.rows as unknown as ICanalDeclarado[]
    if (meus.length > 0) {
      await c.query(
        `delete from public.obs_archive_channel_removals r
          using unnest($1::uuid[], $2::text[]) as m(site_id, channel_ref)
          where r.site_id = m.site_id and r.channel_ref = m.channel_ref and r.declared_xid = pg_current_xact_id() and r.removed_via = 'botao'`,
        [meus.map(m => m.site_id), meus.map(m => m.channel_ref)])
    }
  })
}

/** `delete from public.competitor_channels where <where>`, declarando o destino quando a M3b está no banco. */
export async function apagarCanais(c: IConexaoDeTeste, where: string, params: unknown[] = []): Promise<void> {
  await apagarComDeclaracao(c, 'competitor_channels', where, where, params)
}

/** `delete from public.sites where <where>`, declarando os canais do site (a cascata os apaga) quando a M3b está no banco. */
export async function apagarSites(c: IConexaoDeTeste, where: string, params: unknown[] = []): Promise<void> {
  await apagarComDeclaracao(c, 'sites', `site_id in (select id from public.sites where ${where})`, where, params)
}

async function comConexaoCurta(fn: (c: Client) => Promise<void>): Promise<void> {
  const c = new Client({ connectionString: DB_URL() })
  await c.connect()
  try { await fn(c) } finally { await c.end() }
}

/** Como `apagarCanais`, abrindo conexão curta em `SUPABASE_DB_URL` (substitui o `.from('competitor_channels').delete()`). */
export async function apagarCanaisDeTeste(where: string, params: unknown[] = []): Promise<void> {
  await comConexaoCurta(c => apagarCanais(c, where, params))
}

/** Como `apagarSites`, abrindo conexão curta em `SUPABASE_DB_URL` (substitui o `.from('sites').delete()`). */
export async function apagarSitesDeTeste(where: string, params: unknown[] = []): Promise<void> {
  await comConexaoCurta(c => apagarSites(c, where, params))
}
