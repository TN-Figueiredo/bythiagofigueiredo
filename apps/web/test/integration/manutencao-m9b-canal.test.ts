// @vitest-environment node
/**
 * M9b Tarefa 6: a prova de ponta a ponta de "canal removido de guardado/sem_destino até concluido" SEM migration, SEM kit e SEM `expurgar --canal`.
 * Tudo em `begin … rollback` no bythiago_int (54422). O tempo é simulado voltando `nas_absent_first_at` (o banco decide pela hora gravada; `now()`
 * é fixo dentro da transação). Se algum passo exigir SQL novo, o teste falha e a tese do plano cai (Global Constraints).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { m3bNoBanco, aplicarM3b, escalar, q1, semearCanal } from '../helpers/m3b'
import { criarUsuario } from '../helpers/mg6'
import { aplicarM9 } from '../helpers/m9'
import { travarDdl } from '../helpers/ddl-testes'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const H = (ch: string): string => ch.repeat(64)
const DAILY = 'competitor_video_daily'
const MES = '2026-09-01'
type Linha = Record<string, unknown>
type Item = { item_id: string; tempo: string; falta: string | null; apagar: Array<{ filho: string; caminho: string; sha256: string }>; b2_nomes: string[]; prefixos: string[]; snap_bloqueio: string | null }
const FILHOS_OK = { numerico: { montado: true, sentinela: true }, texto: { montado: true, sentinela: true } }
/** Os dois nomes de arquivo (reais no formato do B2: fileName inteiro, sem o filho). */
const nomeB2 = (canal: string, tabela: string, classe: string): string => `${classe}/canais/${canal}/${tabela}/2026-09.v1.csv.gz`

describe.skipIf(skipIfNoLocalDb())('M9b T6: canal removido de guardado/sem_destino até concluido, sem SQL novo', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })

  type Cena = { site: string; canal: string; admin: string }

  async function emTx(fn: (c: Cena) => Promise<void>): Promise<void> {
    await pg.query('begin'); await pg.query('select pg_advisory_xact_lock(7339001)')
    try {
      if (!(await m3bNoBanco(pg))) await aplicarM3b(pg)
      await travarDdl(pg)
      await aplicarM9(pg)
      const s = await semearCanal(pg, { videos: 0 })
      const admin = await criarUsuario(pg)
      const org = await escalar<string>(pg, `select org_id from public.sites where id = $1`, [s.site])
      await pg.query(`insert into public.organization_members (org_id, user_id, role) values ($1, $2, 'org_admin')`, [org, admin])
      await pg.query(`insert into public.obs_archive_m9_interruptor (site_id, ligado) values ($1, true) on conflict (site_id) do update set ligado = true`, [s.site])
      await fn({ site: s.site, canal: s.canal, admin })
    } finally { await pg.query('rollback') }
  }

  async function unidade(site: string, canal: string, o: { classe?: string; tabela?: string; recebida?: boolean } = {}): Promise<string> {
    return (await q1(pg,
      `insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, control_sum, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, parts, received_at, nas_attested_at)
       values ($1, $2, $3, $4, $5::date, 1, 10, 100, $6, $7, $8, $9, 100, 1, case when $10 then now() end, case when $10 then now() end) returning id`,
      [site, o.classe ?? 'serie', o.tabela ?? DAILY, canal, MES, H('a') + '', H('b'), H(o.classe === 'texto' ? '2' : '1'), H('c'), o.recebida ?? true])).id as string
  }
  /** Canal com unidade serie, unidade texto e resumo vazio, tudo recebido; depois removido pelo caminho da E10 (guardar). */
  async function canalGuardado(c: Cena): Promise<void> {
    await unidade(c.site, c.canal)
    await unidade(c.site, c.canal, { classe: 'texto', tabela: 'competitor_raw' })
    await pg.query(`insert into public.obs_archive_summaries (site_id, class, channel_ref, month, version, empty, unit_hashes, received_at) values ($1, 'serie', $2, $3::date, 1, true, '{}'::jsonb, now())`, [c.site, c.canal, MES])
    const r = (await pg.query(`select public.competitor_channel_remove($1, $2, 'guardar', 'e10_export', $3) as r`, [c.site, c.canal, c.admin])).rows[0].r
    expect(r).toMatchObject({ status: 'ok', decisao: 'guardar' })
  }
  const lista = async (c: Cena): Promise<Linha> => {
    const l = (await pg.query(`select public.obs_archive_removed_channel_list($1) as r`, [c.site])).rows[0].r as Linha[]
    const x = l.find(e => e.channel_ref === c.canal)
    if (!x) throw new Error('canal fora da lista')
    return x
  }
  const decidir = async (c: Cena): Promise<Linha> => (await pg.query(`select public.obs_archive_channel_removal_decide($1, $2, $3) as r`, [c.site, c.canal, c.admin])).rows[0].r
  const pendencia = async (c: Cena): Promise<Item | undefined> => {
    const p = (await pg.query(`select public.obs_archive_owner_pending($1) as r`, [c.site])).rows[0].r as { itens: Item[] }
    return p.itens.find(i => i.item_id === `canal:${c.canal}`)
  }
  const linhasAbertas = (c: Cena): Promise<number> => escalar(pg, `select count(*)::int from public.obs_archive_absence where site_id = $1 and alvo = $2 and encerrada_at is null`, [c.site, `canal:${c.canal}`])
  const removal = async (c: Cena): Promise<Linha> => q1(pg, `select * from public.obs_archive_channel_removals where site_id = $1 and channel_ref = $2`, [c.site, c.canal])

  /** Os prefixos que o banco abriu, para o kit (quem atesta) devolver. */
  async function prefixos(c: Cena): Promise<Array<{ filho: string; prefixo: string }>> {
    return (await pg.query(`select filho, prefixo from public.obs_archive_absence where site_id = $1 and alvo = $2 and encerrada_at is null order by filho, prefixo`, [c.site, `canal:${c.canal}`])).rows as Array<{ filho: string; prefixo: string }>
  }
  async function attestNas(c: Cena, o: { estado?: (p: string) => string; snap?: Record<string, unknown> } = {}): Promise<Linha[]> {
    const itens = (await prefixos(c)).map(p => ({ alvo: `canal:${c.canal}`, filho: p.filho, prefixo: p.prefixo, estado: (o.estado ?? (() => 'ausente'))(p.prefixo), ...(o.snap ?? {}) }))
    const r = (await pg.query(`select public.obs_archive_attest_prefixos($1, 'nas', $2, $3::jsonb, $4::jsonb) as r`, [c.site, randomUUID(), JSON.stringify(FILHOS_OK), JSON.stringify(itens)])).rows[0].r as { prefixos: Linha[] }
    return r.prefixos
  }
  async function attestB2(c: Cena, estado: 'presente' | 'ausente'): Promise<Linha[]> {
    const run = (await q1(pg, `insert into public.obs_archive_b2_runs (site_id, expires_at, modo, negative_name, negative_filho, canary_days, estado)
                               values ($1, now() + interval '1 hour', 'normal', 'neg', 'numerico', '{}'::jsonb, 'controle_ok') returning id`, [c.site])).id as string
    const itens = (await prefixos(c)).map(p => ({
      alvo: `canal:${c.canal}`, filho: p.filho, prefixo: p.prefixo, estado,
      ...(estado === 'presente' ? { nomes: [nomeB2(c.canal, p.filho === 'texto' ? 'competitor_raw' : DAILY, p.filho === 'texto' ? 'texto' : 'serie')] } : {}) }))
    const r = (await pg.query(`select public.obs_archive_attest_prefixos($1, 'b2', $2, $3::jsonb, $4::jsonb) as r`, [c.site, run, JSON.stringify(FILHOS_OK), JSON.stringify(itens)])).rows[0].r as { prefixos: Linha[] }
    return r.prefixos
  }
  const voltaAusencia = (c: Cena, intervalo: string) => pg.query(`update public.obs_archive_absence set nas_absent_first_at = now() - $3::interval where site_id = $1 and alvo = $2 and nas_absent_first_at is not null`, [c.site, `canal:${c.canal}`, intervalo])
  const snapDe = (): Record<string, unknown> => ({ snapshots: 'por_tempo', snap_mais_antigo_s: String(Math.floor(Date.now() / 1000) - 14 * 86400), snap_mais_novo_s: String(Math.floor(Date.now() / 1000) - 60) })

  /** Do `pedido` até a ausência no NAS provada duas vezes (11 h) e a dos snapshots; para antes do B2. */
  async function ateSnapshots(c: Cena): Promise<void> {
    expect((await attestNas(c)).every(x => x.resposta === 'aceito')).toBe(true)   // 1ª conferência
    expect((await pendencia(c))?.falta).toBe('segunda_conferencia')
    await voltaAusencia(c, '12 hours')
    await attestNas(c)                                                              // 2ª, 11 h depois
    expect((await removal(c)).nas_absent_at).not.toBeNull()
    expect((await pendencia(c))?.falta).toBe('snapshots')
    await voltaAusencia(c, '15 days')
    await attestNas(c, { snap: snapDe() })                                          // snapshots por tempo, piso de 14 dias
  }

  it('o roteiro inteiro: guardar (e10_export) -> guardado -> decide -> pedido -> NAS x2 -> snapshots -> B2 -> apagado_b2 -> concluido', async () => {
    await emTx(async c => {
      await canalGuardado(c)
      // 1. guardar pela E10 nasce com online_thumbs_known = true, sem unidade apagada
      const r0 = await removal(c)
      expect(r0).toMatchObject({ removed_via: 'e10_export', archive_decision: 'guardar', online_thumbs_known: true, completed_at: null })
      expect(await escalar(pg, `select count(*)::int from public.obs_archive_units where site_id = $1 and purged_at is not null`, [c.site])).toBe(0)
      expect((await lista(c)).estado).toBe('guardado')
      expect(await pendencia(c)).toBeUndefined()
      // 2. decide: pedido, purged_at marcado, 3 linhas por (filho, classe) [2 classes = 6]
      expect(await decidir(c)).toEqual({ status: 'ok' })
      expect((await lista(c)).estado).toBe('pedido')
      expect(await escalar(pg, `select count(*)::int from public.obs_archive_units where site_id = $1 and purged_at is not null and purge_ref = $2`, [c.site, `remocao:${c.canal}`])).toBe(2)
      expect(await linhasAbertas(c)).toBe(6)
      const ps = await prefixos(c)
      expect(ps.map(p => p.prefixo).sort()).toEqual([
        `_recebendo/_quarentena/serie/canais/${c.canal}`, `_recebendo/_quarentena/texto/canais/${c.canal}`,
        `_recebendo/serie/canais/${c.canal}`, `_recebendo/texto/canais/${c.canal}`,
        `serie/canais/${c.canal}`, `texto/canais/${c.canal}`].sort())
      const pend = (await pendencia(c))!
      expect(pend).toMatchObject({ tempo: 'apagar_antigas', falta: null })
      expect(pend.apagar).toHaveLength(2)                                  // as duas unidades com sha256 (o resumo vazio não tem arquivo)
      expect(pend.apagar.map(a => a.filho).sort()).toEqual(['numerico', 'texto'])
      expect(pend.prefixos.every(p => !p.startsWith('_recebendo/'))).toBe(true)   // o defeito do plano: _recebendo sai da lista da pendência
      // 3. NAS x2 (inclusive _recebendo), snapshots
      await ateSnapshots(c)
      const rm = await removal(c)
      expect(rm.nas_absent_at).not.toBeNull(); expect(rm.snapshots_clear_on).not.toBeNull(); expect(rm.b2_absent_at).toBeNull()
      expect((await lista(c)).estado).toBe('apagado_nas')
      expect((await pendencia(c))?.falta).toBe('b2_sync')
      // 4. B2: 'presente' com o nome real para o painel; conferir_b2 mostra filho/fileName inteiro
      expect((await attestB2(c, 'presente')).every(x => x.resposta === 'aceito')).toBe(true)
      const pb = (await pendencia(c))!
      expect(pb).toMatchObject({ tempo: 'conferir_b2', falta: null })
      expect(pb.b2_nomes).toContain(`numerico/${nomeB2(c.canal, DAILY, 'serie')}`)
      expect(pb.b2_nomes).toContain(`texto/${nomeB2(c.canal, 'competitor_raw', 'texto')}`)
      expect((await lista(c)).estado).toBe('apagado_nas')
      // 5. blobs ainda pendentes: o B2 ausente leva a apagado_b2 e NÃO a concluido
      await pg.query(`update public.obs_archive_channel_removals set blobs_pending = array['https://blob.test/x.jpg'] where site_id = $1 and channel_ref = $2`, [c.site, c.canal])
      expect((await attestB2(c, 'ausente')).every(x => x.resposta === 'aceito')).toBe(true)
      expect((await lista(c)).estado).toBe('apagado_b2')
      expect((await removal(c)).completed_at).toBeNull()
      expect((await pendencia(c))).toMatchObject({ falta: 'blobs' })
      // 6. blobs_pending vazio: concluido, completed_at, linhas encerradas
      await pg.query(`update public.obs_archive_channel_removals set blobs_pending = '{}' where site_id = $1 and channel_ref = $2`, [c.site, c.canal])
      await pg.query(`select public.obs_archive_removal_advance($1)`, [c.site])
      expect((await lista(c)).estado).toBe('concluido')
      expect((await removal(c)).completed_at).not.toBeNull()
      expect(await linhasAbertas(c)).toBe(0)
      expect(await pendencia(c)).toBeUndefined()
    })
  })

  it('negativo: uma linha _recebendo presente segura o canal em apagar_antigas (o defeito documentado), mesmo com o resto provado', async () => {
    await emTx(async c => {
      await canalGuardado(c); await decidir(c)
      const presente = (p: string): string => p === `_recebendo/serie/canais/${c.canal}` ? 'presente' : 'ausente'
      await attestNas(c, { estado: presente })
      await voltaAusencia(c, '15 days')
      await attestNas(c, { estado: presente, snap: snapDe() })
      expect(await pendencia(c)).toMatchObject({ tempo: 'apagar_antigas', falta: null })
      expect((await lista(c)).estado).toBe('pedido')
      expect((await removal(c)).completed_at).toBeNull()
      // ... e a pendência do dono não tem como limpá-la: o prefixo some da lista (o conserto é no script, T5)
      expect((await pendencia(c))!.prefixos.some(p => p.startsWith('_recebendo/'))).toBe(false)
    })
  })

  it('negativo: blobs_pending com URL segura em falta blobs, nunca concluido', async () => {
    await emTx(async c => {
      await canalGuardado(c); await decidir(c)
      await pg.query(`update public.obs_archive_channel_removals set blobs_pending = array['https://blob.test/y.jpg'] where site_id = $1 and channel_ref = $2`, [c.site, c.canal])
      await ateSnapshots(c); await attestB2(c, 'presente'); await attestB2(c, 'ausente')
      expect(await pendencia(c)).toMatchObject({ falta: 'blobs' })
      expect((await removal(c)).completed_at).toBeNull()
    })
  })

  it('negativo: linha montada à mão com online_thumbs_known = false e sem ack fica em falta imagens', async () => {
    await emTx(async c => {
      await canalGuardado(c)
      await pg.query(`update public.obs_archive_channel_removals set online_thumbs_known = false, thumbs_unknown_ack_at = null where site_id = $1 and channel_ref = $2`, [c.site, c.canal])
      await decidir(c)                                                      // decide NÃO mexe no ack de uma linha existente (só no ramo sem linha)
      await ateSnapshots(c); await attestB2(c, 'presente'); await attestB2(c, 'ausente')
      expect(await pendencia(c)).toMatchObject({ falta: 'imagens' })
      expect((await lista(c)).estado).toBe('apagado_b2')
      expect((await removal(c)).completed_at).toBeNull()
    })
  })

  it('positivo: sem_destino -> decide (grava o ack com now()) -> concluido', async () => {
    await emTx(async c => {
      // canal que sumiu sem declaração: unidades de um channel_ref sem linha em competitor_channels
      const fantasma: Cena = { ...c, canal: randomUUID() }
      await unidade(c.site, fantasma.canal)
      await unidade(c.site, fantasma.canal, { classe: 'texto', tabela: 'competitor_raw' })
      expect((await lista(fantasma)).estado).toBe('sem_destino')
      expect(await decidir(fantasma)).toEqual({ status: 'ok' })
      const r = await removal(fantasma)
      expect(r).toMatchObject({ removed_via: 'vigia', archive_decision: 'apagar', online_thumbs_known: false })
      expect(r.thumbs_unknown_ack_at).not.toBeNull()
      await ateSnapshots(fantasma); await attestB2(fantasma, 'presente'); await attestB2(fantasma, 'ausente')
      expect((await lista(fantasma)).estado).toBe('concluido')
      expect((await removal(fantasma)).completed_at).not.toBeNull()
      expect(await decidir(fantasma)).toEqual({ status: 'ja_pedido' })
    })
  })

  it('purged_at: unidade de canal removido fora do aguardando_dono depois do decide (165, parte purged_at)', async () => {
    await emTx(async c => {
      await unidade(c.site, c.canal)
      const nunca = await unidade(c.site, c.canal, { classe: 'texto', tabela: 'competitor_raw', recebida: false })
      await pg.query(`select public.competitor_channel_remove($1, $2, 'guardar', 'e10_export', $3)`, [c.site, c.canal, c.admin])
      const dono = async (): Promise<string[]> => ((await pg.query(`select public.obs_archive_plan($1, false, null) as r`, [c.site])).rows[0].r.aguardando_dono as Array<{ arquivo_id: string }>).map(x => x.arquivo_id)
      expect(await dono()).toContain(`u:${nunca}`)                          // antes: a unidade nunca recebida espera o dono
      await decidir(c)
      expect(await dono()).not.toContain(`u:${nunca}`)                      // depois: purged_at a tira (filtro purged_at is null)
      expect(await escalar(pg, `select count(*)::int from public.obs_archive_units where id = $1 and purged_at is not null`, [nunca])).toBe(1)
    })
  })

  const reverter = async (c: Cena, linhas: 'encerrar' | 'apagar'): Promise<void> => {
    // === TEXTO QUE VAI AO RUNBOOK (T8): troque o site e o canal ===
    await pg.query(`update public.obs_archive_channel_removals set archive_decision = 'guardar' where site_id = $1 and channel_ref = $2 and completed_at is null`, [c.site, c.canal])
    await pg.query(`update public.obs_archive_units set purged_at = null, purged_by = null, purge_ref = null where site_id = $1 and channel_ref = $2 and purge_ref = $3`, [c.site, c.canal, `remocao:${c.canal}`])
    await pg.query(`update public.obs_archive_summaries set purged_at = null, purged_by = null, purge_ref = null where site_id = $1 and channel_ref = $2 and purge_ref = $3`, [c.site, c.canal, `remocao:${c.canal}`])
    if (linhas === 'apagar') await pg.query(`delete from public.obs_archive_absence where site_id = $1 and alvo = $2`, [c.site, `canal:${c.canal}`])
    else await pg.query(`update public.obs_archive_absence set encerrada_at = now() where site_id = $1 and alvo = $2 and encerrada_at is null`, [c.site, `canal:${c.canal}`])
    // === fim ===
  }

  it('reversão (apagar as linhas de ausência): devolve o canal a guardado e um novo decide reabre as 6 linhas', async () => {
    await emTx(async c => {
      await canalGuardado(c); await decidir(c)
      expect(await linhasAbertas(c)).toBe(6)
      await reverter(c, 'apagar')
      expect(await linhasAbertas(c)).toBe(0)
      expect((await lista(c)).estado).toBe('guardado')
      expect(await escalar(pg, `select count(*)::int from public.obs_archive_units where site_id = $1 and purged_at is not null`, [c.site])).toBe(0)
      expect(await escalar(pg, `select count(*)::int from public.obs_archive_summaries where site_id = $1 and purged_at is not null`, [c.site])).toBe(0)
      expect(await pendencia(c)).toBeUndefined()
      expect(await decidir(c)).toEqual({ status: 'ok' })
      expect(await escalar(pg, `select count(*)::int from public.obs_archive_units where site_id = $1 and purged_at is not null`, [c.site])).toBe(2)
      expect(await linhasAbertas(c)).toBe(6)
      expect(await pendencia(c)).toMatchObject({ tempo: 'apagar_antigas' })
    })
  })

  it('reversão (só ENCERRAR as linhas, como o plano dizia): um novo decide conclui sem prova de ausência. NÃO usar no runbook', async () => {
    await emTx(async c => {
      await canalGuardado(c); await decidir(c)
      await reverter(c, 'encerrar')
      await decidir(c)
      expect(await linhasAbertas(c)).toBe(0)                               // on conflict do nothing: as linhas encerradas não reabrem
      await pg.query(`select public.obs_archive_removal_advance($1)`, [c.site])
      expect((await removal(c)).completed_at).not.toBeNull()                // g.n = 0: concluiu sem nenhuma conferência
    })
  })
})
