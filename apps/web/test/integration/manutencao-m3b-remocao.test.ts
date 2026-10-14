// apps/web/test/integration/manutencao-m3b-remocao.test.ts
// @vitest-environment node
/**
 * Manutenção M3b, parte 6 do SQL (plano M3b-site, Tarefa 8): remover canal declara o destino do arquivo (fatia 12a), o gatilho que impede outro
 * caminho, a lista derivada, a função da restauração, o impacto do diálogo e a vigia. Banco: SÓ o `bythiago_int` (54422). Quase tudo em
 * `begin … rollback`; os casos de concorrência usam dados confirmados em sites próprios, apagados no fim.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { aplicarM2 } from '../helpers/m2'
import { aplicarM3b, corridasLigadas, confirmarM3bParaCorridas, desfazerM3bDasCorridas, escalar, q1, semearCanal, semearDiaria } from '../helpers/m3b'
import { M10A_SQL } from './video-antigo-m10a-caminho'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const MES = '2026-10-01'
const DAILY = 'competitor_video_daily'
const EARLY = 'competitor_video_early'
const HEX = (n: string): string => n.repeat(64).slice(0, 64)
const dorme = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))

interface Unid { classe?: string; tabela?: string; mes?: string; versao?: number; linhas?: number; bytes?: number; recebida?: boolean }

describe.skipIf(skipIfNoLocalDb())('M3b parte 6: remover canal declara o destino do arquivo', () => {
  let c: Client
  const sitesReais: string[] = []
  const usuariosReais: string[] = []
  beforeAll(async () => {
    if (corridasLigadas()) await confirmarM3bParaCorridas(6)       // só para as corridas (M3B_CORRIDAS=1); desfeito no afterAll (Yannis 1)
    c = new Client({ connectionString: PG_URL }); await c.connect()
  })
  afterAll(async () => {
    if (corridasLigadas()) await desfazerM3bDasCorridas()          // antes da limpeza: sem o gatilho, o delete dos canais de teste passa
    for (const s of sitesReais) {
      for (const sql of [
        `delete from public.obs_archive_unit_attachments where site_id = $1`, `delete from public.obs_archive_summaries where site_id = $1`,
        `delete from public.obs_archive_units where site_id = $1`, `delete from public.obs_archive_months where site_id = $1`,
        `delete from public.obs_archive_channel_removals where site_id = $1`, `delete from public.audit_log where site_id = $1`,
        `delete from public.competitor_channels where site_id = $1`]) {
        try { await c.query(sql, [s]) } catch { /* melhor esforço: o site de teste fica de resto */ }
      }
    }
    for (const u of usuariosReais) {
      try { await c.query(`delete from public.organization_members where user_id = $1`, [u]); await c.query(`delete from auth.users where id = $1`, [u]) } catch { /* idem */ }
    }
    await c.end()
  })

  async function emTx<T>(fn: () => Promise<T>, hoje = '2026-11-28'): Promise<T> {
    await c.query('begin')
    try {
      await aplicarM2(c)
      await c.query(readFileSync(M10A_SQL, 'utf8'))
      await aplicarM3b(c, 6)
      await c.query(`select set_config('obs_archive.hoje', $1, true)`, [hoje])
      return await fn()
    } finally { await c.query('rollback') }
  }
  async function falha(sql: string, params: unknown[] = [], cx: Client = c): Promise<{ code: string; message: string } | null> {
    await cx.query('savepoint f_rm')
    try { await cx.query(sql, params); await cx.query('release savepoint f_rm'); return null } catch (e) {
      await cx.query('rollback to savepoint f_rm')
      const o = e as { code?: string; message?: string }
      return { code: o.code ?? '', message: o.message ?? '' }
    }
  }
  async function novoUsuario(): Promise<string> {
    const id = randomUUID()
    await c.query(`insert into auth.users (id, instance_id, aud, role, email) values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2)`, [id, `m3b-${id}@t.test`])
    return id
  }
  async function novoAdmin(site: string, real = false): Promise<string> {
    const id = await novoUsuario()
    const org = (await c.query(`select org_id from public.sites where id = $1`, [site])).rows[0].org_id as string
    await c.query(`insert into public.organization_members (org_id, user_id, role) values ($1, $2, 'org_admin')`, [org, id])
    if (real) usuariosReais.push(id)
    return id
  }
  async function unidade(site: string, canal: string, o: Unid = {}): Promise<string> {
    const linhas = o.linhas ?? 1
    return (await q1(c, `insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, received_at)
      values ($1, $2, $3, $4, $5::date, $6::int, $7::bigint, md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text), md5('s') || md5('s'),
              case when $7::bigint > 0 then md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text) end, case when $7::bigint > 0 then md5('c') || md5('c') end, $8::bigint, case when $9::boolean then now() end) returning id`,
      [site, o.classe ?? 'serie', o.tabela ?? DAILY, canal, o.mes ?? MES, o.versao ?? 1, linhas, o.bytes ?? 100, o.recebida ?? true])).id as string
  }
  const resumo = async (site: string, canal: string, mes = MES, versao = 1): Promise<string> =>
    (await q1(c, `insert into public.obs_archive_summaries (site_id, class, channel_ref, month, version, empty, unit_hashes, received_at) values ($1, 'serie', $2, $3::date, $4, true, '{}'::jsonb, now()) returning id`,
      [site, canal, mes, versao])).id as string
  const remover = async (site: string, canal: string, decisao: string | null, via: string | null, ator: string, cx: Client = c): Promise<Record<string, unknown>> =>
    (await cx.query(`select public.competitor_channel_remove($1, $2, $3, $4, $5) as r`, [site, canal, decisao, via, ator])).rows[0].r
  const decidir = async (site: string, ref: string, ator: string, cx: Client = c): Promise<Record<string, unknown>> =>
    (await cx.query(`select public.obs_archive_channel_removal_decide($1, $2, $3) as r`, [site, ref, ator])).rows[0].r
  const lista = async (site: string): Promise<Array<Record<string, unknown>>> =>
    (await c.query(`select public.obs_archive_removed_channel_list($1) as r`, [site])).rows[0].r
  const semPurga = (site: string, ref: string): Promise<number> =>
    escalar(c, `select ((select count(*) from public.obs_archive_units where site_id = $1 and channel_ref = $2 and purged_at is null)
                     + (select count(*) from public.obs_archive_summaries where site_id = $1 and channel_ref = $2 and purged_at is null))::int`, [site, ref])
  const payloadUnidade = (canal: string, hash = HEX('a')): string => JSON.stringify({ classe: 'serie', tabela: DAILY, canal, mes: MES, row_count: 0, control_sum: null,
    hash_conteudo: hash, schema_fp: HEX('b'), sha256_bytes: '', csv_sha256: '', file_bytes: 0, partes: 1, min_key: null, max_key: null })
  const payloadResumo = (canal: string): string => JSON.stringify({ classe: 'serie', canal, mes: MES, vazio: true, unit_hashes: {}, canal_sha256: null, canal_bytes: null, canal_rows: null,
    video_sha256: null, video_bytes: null, video_rows: null })
  /** Cadastra o canal num site confirmado (fora de transação) e devolve o site, o canal e o administrador. */
  const itCorrida = it.skipIf(!corridasLigadas())   // duas conexões: precisam do rascunho confirmado (M3B_CORRIDAS=1)
  async function sitePermanente(): Promise<{ site: string; admin: string }> {
    const a = await semearCanal(c, { site: randomUUID(), videos: 0 })
    sitesReais.push(a.site)
    return { site: a.site, admin: await novoAdmin(a.site, true) }
  }

  it('o botão grava a remoção, e sem ela o delete recusa (service_role), com ou sem unidade (Phil I1)', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 1 }); const admin = await novoAdmin(a.site)
    await unidade(a.site, a.canal)
    await c.query(`set local role service_role`)
    const e = await falha(`delete from public.competitor_channels where id = $1`, [a.canal])
    await c.query(`reset role`)
    expect(e?.message).toBe('destino_do_arquivo_nao_declarado')
    expect(await escalar(c, `select count(*)::int from public.competitor_channels where id = $1`, [a.canal])).toBe(1)
    const r = await remover(a.site, a.canal, 'apagar', 'botao', admin)
    expect(r).toMatchObject({ status: 'ok', decisao: 'apagar', unidades: 1 })
    expect(await escalar(c, `select count(*)::int from public.competitor_channels where id = $1`, [a.canal])).toBe(0)
    expect(await q1(c, `select archive_decision, removed_via, units_at_removal, online_thumbs_known from public.obs_archive_channel_removals where site_id = $1 and channel_ref = $2`, [a.site, a.canal]))
      .toEqual({ archive_decision: 'apagar', removed_via: 'botao', units_at_removal: 1, online_thumbs_known: true })
    // Phil I1: canal SEM unidade também exige a declaração (antes da primeira unidade, 28/11, nenhum canal tem uma)
    const b = await semearCanal(c, { site: a.site, videos: 1 })
    expect((await falha(`delete from public.competitor_channels where id = $1`, [b.canal]))?.message).toBe('destino_do_arquivo_nao_declarado')
    expect(await escalar(c, `select count(*)::int from public.competitor_channels where id = $1`, [b.canal])).toBe(1)
    expect(await remover(a.site, b.canal, 'apagar', 'botao', admin)).toMatchObject({ status: 'ok', decisao: 'apagar', unidades: 0 })
    expect(await q1(c, `select archive_decision, removed_via, units_at_removal from public.obs_archive_channel_removals where site_id = $1 and channel_ref = $2`, [a.site, b.canal]))
      .toEqual({ archive_decision: 'apagar', removed_via: 'botao', units_at_removal: 0 })     // o rastro que faltava: a remoção de canal sem unidade
    expect(await escalar(c, `select count(*)::int from public.competitor_channels where id = $1`, [b.canal])).toBe(0)
  }))

  it('truncate recusa com canal, com ou sem unidade no registro (Phil I1)', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 0 })
    expect((await falha(`truncate public.competitor_channels cascade`))?.message).toBe('destino_do_arquivo_nao_declarado')   // sem unidade
    await unidade(a.site, a.canal)
    expect((await falha(`truncate public.competitor_channels cascade`))?.message).toBe('destino_do_arquivo_nao_declarado')   // com unidade
    expect(await escalar(c, `select count(*)::int from public.competitor_channels where id = $1`, [a.canal])).toBe(1)
  }))

  it('declaração de outra transação não vale (Yannis M7: o xid do gatilho; vale para canal com e sem unidade)', async () => emTx(async () => {
    for (const comUnidade of [true, false]) {
      const a = await semearCanal(c, { site: randomUUID(), videos: 0 })
      if (comUnidade) await unidade(a.site, a.canal)
      await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known, declared_xid)
        values ($1, $2, 'botao', 'apagar', now(), true, '1'::xid8)`, [a.site, a.canal])                  // declaração com o xid de OUTRA transação
      expect((await falha(`delete from public.competitor_channels where id = $1`, [a.canal]))?.message).toBe('destino_do_arquivo_nao_declarado')
      expect(await escalar(c, `select count(*)::int from public.competitor_channels where id = $1`, [a.canal])).toBe(1)
      await c.query(`update public.obs_archive_channel_removals set declared_xid = pg_current_xact_id() where site_id = $1 and channel_ref = $2`, [a.site, a.canal])
      expect(await falha(`delete from public.competitor_channels where id = $1`, [a.canal])).toBeNull()   // com o xid desta transação, passa
    }
  }))

  it('guardar pelo botão é recusado pelo banco; guardar pela E10 passa', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 1 }); const admin = await novoAdmin(a.site)
    expect((await falha(`select public.competitor_channel_remove($1, $2, 'guardar', 'botao', $3)`, [a.site, a.canal, admin]))?.message).toBe('guardar_so_pela_e10')
    expect((await falha(`select public.competitor_channel_remove($1, $2, 'guardar', 'fila', $3)`, [a.site, a.canal, admin]))?.message).toBe('guardar_so_pela_e10')
    expect(await escalar(c, `select count(*)::int from public.obs_archive_channel_removals where site_id = $1`, [a.site])).toBe(0)
    expect(await remover(a.site, a.canal, 'guardar', 'e10_export', admin)).toMatchObject({ status: 'ok', decisao: 'guardar' })
  }))

  it('apagar marca purged_at em toda unidade e todo resumo do canal, em toda classe, tabela, mês e versão, recebida ou não', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 0 }); const admin = await novoAdmin(a.site)
    const outro = await semearCanal(c, { site: a.site, videos: 0 })
    await unidade(a.site, a.canal, { tabela: DAILY, versao: 1 }); await unidade(a.site, a.canal, { tabela: DAILY, versao: 2, recebida: false })
    await unidade(a.site, a.canal, { tabela: EARLY, mes: '2026-09-01' })
    await unidade(a.site, a.canal, { classe: 'horaria', tabela: 'competitor_video_hourly', linhas: 0 })
    await unidade(a.site, a.canal, { classe: 'texto', tabela: 'competitor_raw', recebida: false })
    await resumo(a.site, a.canal); await resumo(a.site, a.canal, '2026-09-01')
    await unidade(a.site, outro.canal); await resumo(a.site, outro.canal)
    await remover(a.site, a.canal, 'apagar', 'botao', admin)
    expect(await semPurga(a.site, a.canal)).toBe(0)
    expect(await q1(c, `select purge_ref, purged_by = $2 as ator from public.obs_archive_units where site_id = $1 and channel_ref = $3 limit 1`, [a.site, admin, a.canal]))
      .toEqual({ purge_ref: `remocao:${a.canal}`, ator: true })
    expect(await semPurga(a.site, outro.canal)).toBe(2)                                 // o outro canal não é tocado
  }))

  it('canal removido sem unidade nasce sem_arquivo; a lista mostra o estado, sem nome', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 0 }); const admin = await novoAdmin(a.site)
    await remover(a.site, a.canal, 'apagar', 'botao', admin)
    expect(await escalar(c, `select units_at_removal from public.obs_archive_channel_removals where site_id = $1`, [a.site])).toBe(0)
    const l = await lista(a.site)
    expect(l).toHaveLength(1)
    expect(l[0]).toMatchObject({ channel_ref: a.canal, estado: 'sem_arquivo', online_thumbs_known: true, blobs_pendentes: 0 })
    expect(JSON.stringify(l)).not.toContain('canal m3b')
    expect((await c.query(`select public.obs_archive_removed_channel_list($1) as r`, [randomUUID()])).rows[0].r).toEqual([])
  }))

  it('segunda remoção do mesmo canal do YouTube não falha nem toca na primeira', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 0 }); const admin = await novoAdmin(a.site)
    const yt = await escalar<string>(c, `select channel_id from public.competitor_channels where id = $1`, [a.canal])
    await remover(a.site, a.canal, 'apagar', 'botao', admin)
    const antes = await q1(c, `select to_jsonb(r) as j from public.obs_archive_channel_removals r where site_id = $1 and channel_ref = $2`, [a.site, a.canal])
    const novo = randomUUID()
    await c.query(`insert into public.competitor_channels (id, site_id, channel_id, channel_name, added_at) values ($1, $2, $3, 'canal m3b', now())`, [novo, a.site, yt])
    await unidade(a.site, novo)
    await remover(a.site, novo, 'apagar', 'botao', admin)
    expect(await escalar(c, `select count(*)::int from public.obs_archive_channel_removals where site_id = $1 and youtube_channel_id = $2`, [a.site, yt])).toBe(2)
    expect(await q1(c, `select to_jsonb(r) as j from public.obs_archive_channel_removals r where site_id = $1 and channel_ref = $2`, [a.site, a.canal])).toEqual(antes)
  }))

  it('mês com unidade não recebida de canal apagar sela: a unidade com purged_at conta como terminal', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 0 }); const admin = await novoAdmin(a.site)
    const b = await semearCanal(c, { site: a.site, videos: 0 })
    expect(await escalar(c, `select public.obs_archive_is_terminal(null, null, 5, null, now())`)).toBe(true)
    await unidade(a.site, a.canal, { tabela: DAILY, recebida: false }); await unidade(a.site, a.canal, { tabela: EARLY, recebida: false })
    await unidade(a.site, b.canal, { tabela: DAILY }); await unidade(a.site, b.canal, { tabela: EARLY })
    const pendentes = (): Promise<number> => escalar(c, `select count(*)::int from public.obs_archive_pending_units($1, 'serie', $2::date)`, [a.site, MES])
    expect(await pendentes()).toBeGreaterThan(0)
    await remover(a.site, a.canal, 'apagar', 'botao', admin)
    expect(await pendentes()).toBe(0)
  }))

  it('item pendente da E9 é concluído com a anotação (D15); os de outro canal ficam', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 0 }); const admin = await novoAdmin(a.site)
    const b = await semearCanal(c, { site: a.site, videos: 0 })
    const item = async (canal: string, kind: string): Promise<number> => Number((await q1(c, `insert into public.competitor_removed_items (site_id, kind, youtube_id, competitor_channel_id, decided_by, rows_deleted, archive_pending)
      values ($1, $2, 'x' || gen_random_uuid()::text, $3, $4, '{}'::jsonb, true) returning id`, [a.site, kind, canal, admin])).id)
    const meu = await item(a.canal, 'video'), comentario = await item(a.canal, 'comentario'), alheio = await item(b.canal, 'video')
    await remover(a.site, a.canal, 'apagar', 'botao', admin)
    const ler = async (id: number): Promise<Record<string, unknown>> => q1(c, `select archive_pending, archive_note from public.competitor_removed_items where id = $1`, [id])
    expect(await ler(meu)).toEqual({ archive_pending: false, archive_note: 'canal apagado inteiro' })
    expect(await ler(comentario)).toEqual({ archive_pending: false, archive_note: 'canal apagado inteiro' })
    expect(await ler(alheio)).toEqual({ archive_pending: true, archive_note: null })
  }))

  it('blobs_pending vem da união das imagens online com as dos anexos', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 1 }); const admin = await novoAdmin(a.site)
    await c.query(`insert into public.competitor_video_versions (video_id, field, value_hash, thumb_blob_url, first_seen_at, last_seen_at, "precision") values ($1, 'thumb', md5('t'), 'https://blob.test/online.jpg', now(), now(), 'first')`, [a.videos[0]])
    const u = await unidade(a.site, a.canal, { classe: 'video_antigo', tabela: 'competitor_video_versions' })
    await c.query(`insert into public.obs_archive_unit_attachments (site_id, unit_id, channel_ref, origin_url, blob_url, estado) values ($1, $2, $3, 'https://yt.test/x.jpg', 'https://blob.test/anexo.jpg', 'perdida_na_origem')`, [a.site, u, a.canal])
    const r = await remover(a.site, a.canal, 'apagar', 'botao', admin)
    expect(r.blobs_pendentes).toBe(2)
    const urls = await escalar<string[]>(c, `select blobs_pending from public.obs_archive_channel_removals where site_id = $1`, [a.site])
    expect([...urls].sort()).toEqual(['https://blob.test/anexo.jpg', 'https://blob.test/online.jpg'])
  }))

  it('sem_direito: editor do site, na remoção e na decisão; nada gravado', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 1 })
    const editor = await novoUsuario()
    await c.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor')`, [a.site, editor])
    expect((await falha(`select public.competitor_channel_remove($1, $2, 'apagar', 'botao', $3)`, [a.site, a.canal, editor]))?.message).toBe('sem_direito')
    expect(await escalar(c, `select count(*)::int from public.competitor_channels where id = $1`, [a.canal])).toBe(1)
    expect(await escalar(c, `select count(*)::int from public.obs_archive_channel_removals where site_id = $1`, [a.site])).toBe(0)
    const orfao = randomUUID(); await unidade(a.site, orfao)
    expect((await falha(`select public.obs_archive_channel_removal_decide($1, $2, $3)`, [a.site, orfao, editor]))?.message).toBe('sem_direito')
    expect(await escalar(c, `select count(*)::int from public.obs_archive_channel_removals where site_id = $1`, [a.site])).toBe(0)
    expect(await semPurga(a.site, orfao)).toBe(1)
  }))

  it('canal_nao_encontrado e decisao_invalida (inclusive p_via nulo, nunca 23502) não gravam nada', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 1 }); const admin = await novoAdmin(a.site)
    const msg = async (d: string | null, v: string | null, canal = a.canal): Promise<string | undefined> =>
      (await falha(`select public.competitor_channel_remove($1, $2, $3, $4, $5)`, [a.site, canal, d, v, admin]))?.message
    expect(await msg('apagar', null)).toBe('decisao_invalida')
    expect(await msg(null, 'botao')).toBe('decisao_invalida')
    expect(await msg('talvez', 'botao')).toBe('decisao_invalida')
    expect(await msg('apagar', 'outro')).toBe('decisao_invalida')
    expect(await msg('apagar', 'botao', randomUUID())).toBe('canal_nao_encontrado')
    expect(await escalar(c, `select count(*)::int from public.obs_archive_channel_removals where site_id = $1`, [a.site])).toBe(0)
  }))

  itCorrida('dois cliques simultâneos gravam uma decisão (sem_destino): uma ok, outra ja_pedido', async () => {
    const { site, admin } = await sitePermanente()
    const orfao = randomUUID(); await unidade(site, orfao)
    const b = new Client({ connectionString: PG_URL }); await b.connect()
    try {
      const [x, y] = await Promise.all([decidir(site, orfao, admin, c), decidir(site, orfao, admin, b)])
      expect([x.status, y.status].sort()).toEqual(['ja_pedido', 'ok'])
      expect(await escalar(c, `select count(*)::int from public.obs_archive_channel_removals where site_id = $1 and channel_ref = $2`, [site, orfao])).toBe(1)
      expect(await semPurga(site, orfao)).toBe(0)
      expect(await escalar(c, `select count(*)::int from public.audit_log where site_id = $1 and action = 'obs_archive_channel_removal_decide'`, [site])).toBe(1)
    } finally { await b.end() }
  })

  it('a linha da vigia: removed_via vigia, sem nome, sem remoção por pessoa, decided_at preenchido, imagens não conhecidas', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 0 }); const admin = await novoAdmin(a.site)
    const orfao = randomUUID(); await unidade(a.site, orfao, { mes: '2026-09-01' }); await unidade(a.site, orfao, { mes: '2026-10-01', linhas: 3 })
    const antes = (await lista(a.site)).find(x => x.channel_ref === orfao)
    expect(antes).toMatchObject({ estado: 'sem_destino', primeiro_mes: '2026-09', ultimo_mes: '2026-10', meses: 2, registros: 4, classes: ['serie'] })
    expect(await decidir(a.site, orfao, admin)).toEqual({ status: 'ok' })
    const l = await q1(c, `select removed_via, youtube_channel_id, name_at_removal, removed_at, removed_by, decided_at is not null as decidido, online_thumbs_known, thumbs_unknown_ack_at is not null as ciente
      from public.obs_archive_channel_removals where site_id = $1 and channel_ref = $2`, [a.site, orfao])
    expect(l).toEqual({ removed_via: 'vigia', youtube_channel_id: null, name_at_removal: null, removed_at: null, removed_by: null, decidido: true, online_thumbs_known: false, ciente: true })
    expect(await decidir(a.site, orfao, admin)).toEqual({ status: 'ja_pedido' })
    expect(await semPurga(a.site, orfao)).toBe(0)
    expect(await escalar(c, `select is_nullable from information_schema.columns where table_name = 'obs_archive_channel_removals' and column_name = 'decided_at'`)).toBe('NO')
    expect((await falha(`select public.obs_archive_channel_removal_decide($1, $2, $3)`, [a.site, randomUUID(), admin]))?.message).toBe('canal_nao_encontrado')
  }))

  it('troca de guardar por apagar grava decided_at e decided_by do clique', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 1 }); const admin = await novoAdmin(a.site); const dono = await novoUsuario()
    await unidade(a.site, a.canal)
    await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, decided_by, online_thumbs_known, declared_xid)
      values ($1, $2, 'e10_export', 'guardar', now() - interval '365 days', $3, true, pg_current_xact_id())`, [a.site, a.canal, dono])
    await c.query(`delete from public.competitor_channels where id = $1`, [a.canal])
    expect(await decidir(a.site, a.canal, admin)).toEqual({ status: 'ok' })
    expect(await q1(c, `select archive_decision, decided_by = $2 as clique, decided_at > now() - interval '1 minute' as agora from public.obs_archive_channel_removals where site_id = $1`, [a.site, admin]))
      .toEqual({ archive_decision: 'apagar', clique: true, agora: true })
    expect(await semPurga(a.site, a.canal)).toBe(0)
    expect(await decidir(a.site, a.canal, admin)).toEqual({ status: 'ja_pedido' })
  }))

  it('expurgo de canal guardado, apagar e sem_destino (D22): o record_core só o dono chama', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 0 }); const admin = await novoAdmin(a.site)
    const expurgo = async (canal: string): Promise<string> => (await c.query(`select public.obs_archive_record_core($1, 'unidade', $2::jsonb, 'expurgo') as r`, [a.site, payloadUnidade(canal)])).rows[0].r.status
    // guardar: a única exceção, grava a versão nova
    await unidade(a.site, a.canal)
    await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known, declared_xid) values ($1, $2, 'e10_export', 'guardar', now(), true, pg_current_xact_id())`, [a.site, a.canal])
    await c.query(`delete from public.competitor_channels where id = $1`, [a.canal])
    expect(await expurgo(a.canal)).toBe('nova')
    expect(await escalar(c, `select max(version)::int from public.obs_archive_units where site_id = $1 and channel_ref = $2`, [a.site, a.canal])).toBe(2)
    // a rota (sem p_origem) recusa o canal guardado, em unidade e em resumo
    expect((await c.query(`select public.obs_archive_record($1, 'unidade', $2::jsonb) as r`, [a.site, payloadUnidade(a.canal, HEX('c'))])).rows[0].r.status).toBe('canal_removido')
    expect((await c.query(`select public.obs_archive_record($1, 'resumo', $2::jsonb) as r`, [a.site, payloadResumo(a.canal)])).rows[0].r.status).toBe('canal_removido')
    // apagar: canal_removido
    const b = await semearCanal(c, { site: a.site, videos: 0 }); await unidade(a.site, b.canal)
    await remover(a.site, b.canal, 'apagar', 'botao', admin)
    expect(await expurgo(b.canal)).toBe('canal_removido')
    // sem destino: sem_destino
    const orfao = randomUUID(); await unidade(a.site, orfao)
    expect(await expurgo(orfao)).toBe('sem_destino')
    expect(await escalar(c, `select count(*)::int from public.obs_archive_units where site_id = $1 and channel_ref = $2`, [a.site, orfao])).toBe(1)
  }))

  it('a trava da linha da remoção pelo expurgo é for share (não for key share)', async () => emTx(async () => {
    const corpo = await escalar<string>(c, `select prosrc from pg_proc where proname = 'obs_archive_record_core' and pronamespace = 'public'::regnamespace`)
    expect(corpo).toMatch(/obs_archive_channel_removals r[\s\S]{0,200}for share/)
    expect(corpo).not.toMatch(/for key share[\s\S]{0,40}removals/)
    expect(corpo.match(/for key share/g)?.length).toBe(1)                               // a única: a do canal, não a da remoção
  }))

  itCorrida('a troca simultânea ao expurgo espera, 20 vezes nas duas ordens: nunca sobra unidade sem marca', async () => {
    const { site, admin } = await sitePermanente()
    const A = new Client({ connectionString: PG_URL }), B = new Client({ connectionString: PG_URL })
    await A.connect(); await B.connect()
    const preparar = async (): Promise<string> => {
      const ref = randomUUID()
      await unidade(site, ref)
      await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known) values ($1, $2, 'e10_export', 'guardar', now(), true)`, [site, ref])
      return ref
    }
    const expurgo = (cx: Client, ref: string, hash: string): Promise<{ rows: Array<{ r: { status: string } }> }> =>
      cx.query(`select public.obs_archive_record_core($1, 'unidade', $2::jsonb, 'expurgo') as r`, [site, payloadUnidade(ref, hash)]) as Promise<{ rows: Array<{ r: { status: string } }> }>
    try {
      for (let i = 0; i < 20; i++) {
        // ordem 1: o expurgo pega a linha antes; a decisão espera e depois marca também a unidade nova
        const r1 = await preparar()
        await B.query('begin'); const e1 = await expurgo(B, r1, HEX('d'))
        expect(e1.rows[0]!.r.status).toBe('nova')
        let fim = false
        const p1 = decidir(site, r1, admin, A).then(x => { fim = true; return x })
        await dorme(120); expect(fim).toBe(false)
        await B.query('commit')
        expect((await p1).status).toBe('ok')
        expect(await semPurga(site, r1)).toBe(0)
        // ordem 2: a decisão pega a linha antes; o expurgo espera e depois vê apagar
        const r2 = await preparar()
        await A.query('begin'); await decidir(site, r2, admin, A)
        let fim2 = false
        const p2 = expurgo(B, r2, HEX('e')).then(x => { fim2 = true; return x })
        await dorme(120); expect(fim2).toBe(false)
        await A.query('commit')
        expect((await p2).rows[0]!.r.status).toBe('canal_removido')
        expect(await semPurga(site, r2)).toBe(0)
      }
    } finally { await A.end(); await B.end() }
  }, 120_000)

  itCorrida('a corrida com a exportação, 20 vezes em cada forma: nunca sobra unidade nem resumo sem purged_at', async () => {
    const { site, admin } = await sitePermanente()
    const A = new Client({ connectionString: PG_URL }), B = new Client({ connectionString: PG_URL })
    await A.connect(); await B.connect()
    for (const cx of [A, B]) await cx.query(`select set_config('obs_archive.hoje', '2026-11-28', false)`)
    const grava = (cx: Client, tipo: 'unidade' | 'resumo', canal: string): Promise<unknown> =>
      cx.query(`select public.obs_archive_record($1, $2, $3::jsonb)`, [site, tipo, tipo === 'unidade' ? payloadUnidade(canal) : payloadResumo(canal)])
    try {
      for (const forma of ['unidade', 'resumo', 'delete'] as const) {
        for (let i = 0; i < 20; i++) {
          const a = await semearCanal(c, { site, videos: 0 })
          if (forma === 'delete') {
            const [g, d] = await Promise.allSettled([grava(A, 'unidade', a.canal), B.query(`delete from public.competitor_channels where id = $1`, [a.canal])])
            expect(g.status).toBe('fulfilled')
            const existe = await escalar(c, `select count(*)::int from public.competitor_channels where id = $1`, [a.canal])
            if (existe === 0) expect(await escalar(c, `select count(*)::int from public.obs_archive_units where site_id = $1 and channel_ref = $2`, [site, a.canal]), `rodada ${i}`).toBe(0)
            else expect(d.status).toBe('rejected')                                      // a unidade chegou primeiro: o gatilho recusou o delete
          } else {
            const [g, r] = await Promise.allSettled([grava(A, forma, a.canal), remover(site, a.canal, 'apagar', 'botao', admin, B)])
            expect(g.status, `${forma} ${i}`).toBe('fulfilled'); expect(r.status, `${forma} ${i}`).toBe('fulfilled')
            expect(await semPurga(site, a.canal), `${forma} rodada ${i}`).toBe(0)
          }
        }
      }
      expect((await c.query(`select public.obs_archive_vigia_remocao($1) as r`, [site])).rows[0].r).toMatchObject({ c1: 0, c3: 0 })
    } finally { await A.end(); await B.end() }
  }, 120_000)

  it('vigia (item 160): registro limpo zera; cada consulta conta o que foi plantado; c4 fica em 0 até a M9', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 0 })
    const vigia = async (): Promise<Record<string, unknown>> => (await c.query(`select public.obs_archive_vigia_remocao($1) as r`, [a.site])).rows[0].r
    const vermelhos = async (): Promise<string[]> => (await c.query(`select public.obs_archive_vermelhos($1) as r`, [a.site])).rows[0].r
    expect(await vigia()).toEqual({ c1: 0, c2: 0, c3: 0, c4: 0 })
    expect((await vermelhos()).filter(v => v.includes('sem destino') || v.startsWith('vigia'))).toEqual([])
    // c1: unidade órfã (canal apagado com o gatilho desligado, como dono) sem linha de remoção
    const orfao = await semearCanal(c, { site: a.site, videos: 0 }); await unidade(a.site, orfao.canal)
    await c.query(`alter table public.competitor_channels disable trigger obs_archive_z_destino_declarado`)
    await c.query(`delete from public.competitor_channels where id = $1`, [orfao.canal])
    await c.query(`alter table public.competitor_channels enable trigger obs_archive_z_destino_declarado`)
    expect(await vigia()).toEqual({ c1: 1, c2: 0, c3: 0, c4: 0 })
    expect(await vermelhos()).toContain('1 canais removidos sem destino do arquivo')
    // c2: remoção cujo canal ainda existe
    await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known) values ($1, $2, 'botao', 'apagar', now(), true)`, [a.site, a.canal])
    expect(await vigia()).toMatchObject({ c2: 1 })
    expect(await vermelhos()).toContain('vigia da remoção: consulta 2 com 1')
    // c3: remoção apagar com unidade sem purged_at
    const outro = randomUUID(); await unidade(a.site, outro)
    await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known) values ($1, $2, 'botao', 'apagar', now(), true)`, [a.site, outro])
    expect(await vigia()).toMatchObject({ c1: 1, c2: 1, c3: 1, c4: 0 })
    expect(await vermelhos()).toContain('vigia da remoção: consulta 3 com 1')
  }))

  it('a função que a restauração consulta (165, P55)', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 0 }); const admin = await novoAdmin(a.site)
    const e = async (ref: string): Promise<Record<string, unknown>> => (await c.query(`select public.obs_archive_channel_is_removed($1, $2) as r`, [a.site, ref])).rows[0].r
    expect(await e(a.canal)).toEqual({ removido: false, decisao: null, sem_destino: false })
    const b = await semearCanal(c, { site: a.site, videos: 0 }); await remover(a.site, b.canal, 'apagar', 'botao', admin)
    expect(await e(b.canal)).toEqual({ removido: true, decisao: 'apagar', sem_destino: false })
    expect(await e(randomUUID())).toEqual({ removido: true, decisao: null, sem_destino: true })
  }))

  it('video_antigo: o mês ganha dropped_at quando só sobra unidade retirada de canal que continua', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 0 }); const admin = await novoAdmin(a.site)
    const b = await semearCanal(c, { site: a.site, videos: 0 })
    const va = { classe: 'video_antigo', tabela: 'competitor_video_versions' }
    await unidade(a.site, a.canal, { ...va, recebida: false })
    const ub = await unidade(a.site, b.canal, va)
    await c.query(`update public.obs_archive_units set dropped_at = now(), dropped_by = gen_random_uuid() where id = $1`, [ub])
    await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month) values ($1, 'video_antigo', 'competitor_video_versions', $2::date)`, [a.site, MES])
    await remover(a.site, a.canal, 'apagar', 'botao', admin)
    expect(await escalar(c, `select dropped_at is not null from public.obs_archive_months where site_id = $1 and class = 'video_antigo'`, [a.site])).toBe(true)
    // se o canal que continua tem unidade ainda no banco, o mês não ganha dropped_at
    const c2 = await semearCanal(c, { site: a.site, videos: 0 }); const d2 = await semearCanal(c, { site: a.site, videos: 0 })
    await unidade(a.site, c2.canal, { ...va, mes: '2026-09-01' }); await unidade(a.site, d2.canal, { ...va, mes: '2026-09-01' })
    await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month) values ($1, 'video_antigo', 'competitor_video_versions', '2026-09-01')`, [a.site])
    await remover(a.site, c2.canal, 'apagar', 'botao', admin)
    expect(await escalar(c, `select dropped_at is null from public.obs_archive_months where site_id = $1 and month = '2026-09-01'`, [a.site])).toBe(true)
  }))

  it('purga só com decisão apagar; perda só de canal removido (Phil I5, K3)', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 0 })
    const u = await unidade(a.site, a.canal)
    const s = await resumo(a.site, a.canal)
    expect((await falha(`update public.obs_archive_units set purged_at = now(), purged_by = gen_random_uuid(), purge_ref = 'x' where id = $1`, [u]))?.message).toBe('purga_sem_decisao_apagar')
    expect((await falha(`update public.obs_archive_summaries set purged_at = now(), purged_by = gen_random_uuid(), purge_ref = 'x' where id = $1`, [s]))?.message).toBe('purga_sem_decisao_apagar')
    expect((await falha(`update public.obs_archive_units set lost_at = now(), lost_by = gen_random_uuid(), lost_reason = 'ausente_nas_e_b2' where id = $1`, [u]))?.message).toBe('perda_de_canal_que_existe')
    const orfao = randomUUID(); const uo = await unidade(a.site, orfao)                // recebida, canal ausente
    expect((await falha(`update public.obs_archive_units set lost_at = now(), lost_by = gen_random_uuid(), lost_reason = 'nunca_recebida' where id = $1`, [uo]))?.message).toBe('perda_incoerente')
    expect(await falha(`update public.obs_archive_units set lost_at = now(), lost_by = gen_random_uuid(), lost_reason = 'ausente_nas_e_b2' where id = $1`, [uo])).toBeNull()
    // Yannis M8: uma remoção com decisão GUARDAR não autoriza purga (o gatilho exige archive_decision = 'apagar', não "qualquer remoção")
    const g = randomUUID(); const ug = await unidade(a.site, g)
    await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known) values ($1, $2, 'e10_export', 'guardar', now(), true)`, [a.site, g])
    expect((await falha(`update public.obs_archive_units set purged_at = now(), purged_by = gen_random_uuid(), purge_ref = 'x' where id = $1`, [ug]))?.message).toBe('purga_sem_decisao_apagar')
    await c.query(`update public.obs_archive_channel_removals set archive_decision = 'apagar' where site_id = $1 and channel_ref = $2`, [a.site, g])
    expect(await falha(`update public.obs_archive_units set purged_at = now(), purged_by = gen_random_uuid(), purge_ref = 'x' where id = $1`, [ug])).toBeNull()
    const un = await unidade(a.site, randomUUID(), { recebida: false })
    expect(await falha(`update public.obs_archive_units set lost_at = now(), lost_by = gen_random_uuid(), lost_reason = 'nunca_recebida' where id = $1`, [un])).toBeNull()
  }))

  it('o service_role não escreve no registro nem chama as internas (K3)', async () => emTx(async () => {
    for (const f of ['obs_archive_mark_purged(uuid,text,uuid)', 'obs_archive_video_antigo_months(uuid,text)', 'obs_archive_destino_declarado()', 'obs_archive_mark_guard()',
                     'obs_archive_channel_blobs(uuid,text)', 'obs_archive_vermelhos_remocao(uuid)'])
      for (const q of ['service_role', 'anon', 'authenticated']) expect(await escalar(c, `select has_function_privilege($1, $2, 'execute')`, [q, `public.${f}`]), `${f} ${q}`).toBe(false)
    for (const f of ['competitor_channel_remove(uuid,uuid,text,text,uuid)', 'obs_archive_channel_removal_decide(uuid,text,uuid)', 'obs_archive_removed_channel_list(uuid)',
                     'obs_archive_channel_is_removed(uuid,text)', 'obs_archive_vigia_remocao(uuid)', 'obs_archive_channel_archive_impact(uuid,uuid)']) {
      expect(await escalar(c, `select has_function_privilege('service_role', $1, 'execute')`, [`public.${f}`]), f).toBe(true)
      for (const q of ['anon', 'authenticated']) expect(await escalar(c, `select has_function_privilege($1, $2, 'execute')`, [q, `public.${f}`]), `${f} ${q}`).toBe(false)
    }
    const a = await semearCanal(c, { site: randomUUID(), videos: 0 }); const u = await unidade(a.site, a.canal)
    await c.query(`set local role service_role`)
    const e = await falha(`update public.obs_archive_units set purged_at = now() where id = $1`, [u])
    await c.query(`reset role`)
    expect(e?.code).toBe('42501')
  }))

  it('os números do diálogo e da lista contam o conjunto corrente (Phil I8)', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 0 }); const admin = await novoAdmin(a.site)
    await unidade(a.site, a.canal, { versao: 1, linhas: 1000, bytes: 100 }); await unidade(a.site, a.canal, { versao: 2, linhas: 1000, bytes: 200 })
    const imp = (await c.query(`select public.obs_archive_channel_archive_impact($1, $2) as r`, [a.site, a.canal])).rows[0].r
    expect(imp).toMatchObject({ status: 'ok', meses: 1, de: '2026-10', ate: '2026-10', registros: 1000, imagens_blob: 0,
      fora_do_banco: { meses: 0, de: null, ate: null }, videos_retirados: { n: 0, de: null, ate: null } })
    expect((await c.query(`select public.obs_archive_channel_archive_impact($1, $2) as r`, [a.site, randomUUID()])).rows[0].r).toEqual({ status: 'nao_encontrado' })
    expect((await c.query(`select public.obs_archive_channel_archive_impact($1, $2) as r`, [randomUUID(), a.canal])).rows[0].r).toEqual({ status: 'nao_encontrado' })
    const orfao = randomUUID(); await unidade(a.site, orfao, { versao: 1, linhas: 1000 }); await unidade(a.site, orfao, { versao: 2, linhas: 1000 })
    expect((await lista(a.site)).find(x => x.channel_ref === orfao)).toMatchObject({ estado: 'sem_destino', registros: 1000, meses: 1 })
    await remover(a.site, a.canal, 'apagar', 'botao', admin)
    expect(await q1(c, `select units_at_removal, bytes_at_removal::int as bytes, first_month::text as de, last_month::text as ate from public.obs_archive_channel_removals where site_id = $1 and channel_ref = $2`, [a.site, a.canal]))
      .toEqual({ units_at_removal: 1, bytes: 300, de: MES, ate: MES })
  }))

  it('P51: medida num canal cheio (150 vídeos, 13 meses de diária, ~1.100 unidades e resumos)', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 150 }); const admin = await novoAdmin(a.site)
    await semearDiaria(c, a.videos, '2025-10-01', 395)
    await c.query(`insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, received_at)
      select $1, 'serie', t.n, $2, m.d::date, v, 1000, md5(random()::text) || md5(random()::text), md5('s') || md5('s'), md5(random()::text) || md5(random()::text), md5('c') || md5('c'), 1000, now()
        from unnest(array['competitor_video_daily', 'competitor_video_early']) t(n), generate_series('2025-10-01'::date, '2026-10-01'::date, interval '1 month') m(d), generate_series(1, 43) v`, [a.site, a.canal])
    await c.query(`insert into public.obs_archive_summaries (site_id, class, channel_ref, month, version, empty, unit_hashes, received_at)
      select $1, 'serie', $2, m.d::date, v, true, '{}'::jsonb, now() from generate_series('2025-10-01'::date, '2026-10-01'::date, interval '1 month') m(d), generate_series(1, 85) v`, [a.site, a.canal])
    const unidades = await escalar(c, `select count(*)::int from public.obs_archive_units where site_id = $1`, [a.site])
    const t0 = performance.now()
    const r = await remover(a.site, a.canal, 'apagar', 'botao', admin)
    const ms = Math.round(performance.now() - t0)
    console.log(`P51: competitor_channel_remove com ${unidades} unidades e resumos, 150 vídeos e ~59 mil linhas de diária: ${ms} ms`)
    expect(r.status).toBe('ok')
    expect(await semPurga(a.site, a.canal)).toBe(0)
    expect(ms).toBeLessThan(8000)                                                       // o teto do authenticator
  }), 60_000)
})
