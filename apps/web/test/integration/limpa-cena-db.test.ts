// @vitest-environment node
/**
 * O helper de limpeza (`test/helpers/limpa-cena.ts`) com e sem a M3b no banco. Banco: SÓ o `bythiago_int` (54422).
 * Tudo em `begin … rollback`. A M3b inteira ainda não aplica (guarda por md5 do corpo de `competitor_channel_remove_archived`,
 * yannis.md 3.3), então o teste instala só o recorte que importa, tirado do rascunho: a tabela de remoções e o gatilho de destino declarado.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { readFileSync } from 'node:fs'
import { M3B_SQL_CAMINHO, escalar, semearCanal } from '../helpers/m3b'
import { apagarCanais, apagarSites } from '../helpers/limpa-cena'

/** Tabela `obs_archive_channel_removals` + função/gatilhos `obs_archive_destino_declarado`, do rascunho da M3b (mesmo texto). */
function recorteDoGatilho(): string {
  const sql = readFileSync(M3B_SQL_CAMINHO, 'utf8')
  const t0 = sql.indexOf('create table if not exists public.obs_archive_channel_removals')
  const t1 = sql.indexOf('\n);', t0) + 4
  const g0 = sql.indexOf('create or replace function public.obs_archive_destino_declarado()')
  const g1 = sql.indexOf('create trigger obs_archive_z_truncate', g0)
  const g2 = sql.indexOf('\n', g1) + 1
  if (t0 < 0 || g0 < 0 || g1 < 0) throw new Error('recorte da M3b (tabela de remoções ou gatilho) não encontrado no rascunho')
  return sql.slice(t0, t1) + '\n' + sql.slice(g0, g2)
}

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

describe.skipIf(skipIfNoLocalDb())('limpa-cena: declara o destino quando a M3b está no banco e apaga a declaração', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c.end() })
  async function emTx(comM3b: boolean, fn: () => Promise<void>): Promise<void> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')
    try {
      if (comM3b) await c.query(recorteDoGatilho())
      await fn()
    } finally { await c.query('rollback') }
  }
  const nCanais = (site: string): Promise<number> => escalar(c, `select count(*)::int from public.competitor_channels where site_id = $1`, [site])
  const nDecl = (): Promise<number> => escalar(c, `select case when to_regclass('public.obs_archive_channel_removals') is null then 0 else (select count(*)::int from public.obs_archive_channel_removals) end`)

  it('sem a M3b (ou com a tabela ausente): delete puro', async () => emTx(false, async () => {
    const a = await semearCanal(c, { videos: 0 })
    await apagarCanais(c, 'id = $1', [a.canal])
    expect(await nCanais(a.site)).toBe(0)
  }))

  it('com o gatilho da M3b: apagarCanais e apagarSites passam pelo gatilho e não deixam linha de remoção', async () => emTx(true, async () => {
    const antes = await nDecl()
    const a = await semearCanal(c, { videos: 0 })
    await expect(c.query(`savepoint s`).then(() => c.query(`delete from public.competitor_channels where id = $1`, [a.canal]))).rejects.toThrow('destino_do_arquivo_nao_declarado')
    await c.query(`rollback to savepoint s`)
    await apagarCanais(c, 'id = $1', [a.canal])
    expect(await nCanais(a.site)).toBe(0)
    expect(await nDecl()).toBe(antes)
    const b = await semearCanal(c, { videos: 0 })
    await apagarSites(c, 'id = $1', [b.site])
    expect(await escalar(c, `select count(*)::int from public.sites where id = $1`, [b.site])).toBe(0)
    expect(await nCanais(b.site)).toBe(0)
    expect(await nDecl()).toBe(antes)
  }))

  it('não apaga a linha botao que o teste já tinha declarado antes (só a que o helper inseriu; Yannis 1.5 M1)', async () => emTx(true, async () => {
    const a = await semearCanal(c, { videos: 0 })
    await c.query(
      `insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known, declared_xid)
       values ($1, $2, 'botao', 'apagar', now(), true, '1'::xid8)`, [a.site, a.canal])
    await apagarCanais(c, 'id = $1', [a.canal])
    expect(await nCanais(a.site)).toBe(0)
    expect(await escalar(c, `select count(*)::int from public.obs_archive_channel_removals where site_id = $1 and channel_ref = $2`, [a.site, a.canal])).toBe(1)
  }))
})
