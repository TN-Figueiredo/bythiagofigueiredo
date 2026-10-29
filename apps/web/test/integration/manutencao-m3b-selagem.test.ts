// apps/web/test/integration/manutencao-m3b-selagem.test.ts
// @vitest-environment node
/**
 * Manutenção M3b, parte 3 do SQL (plano M3b-site, Tarefa 5): gravação única, recebimento, resumo por canal, manifesto, selagem e a
 * conferência do NAS. Banco: SÓ o `bythiago_int` (54422). Quase tudo em `begin … rollback`; os dois casos de corrida precisam de
 * duas conexões e gravam de verdade num site próprio de cada rodada, apagado no fim.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID, createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { aplicarM2 } from '../helpers/m2'
import { aplicarM3b, sqlM3bAte, corridasLigadas, confirmarM3bParaCorridas, desfazerM3bDasCorridas, escalar, q1, semearCanal, semearDiaria } from '../helpers/m3b'
import { M10A_SQL } from './video-antigo-m10a-caminho'
import { exportarUnidade } from '@/lib/youtube/observatorio/arquivo/exportar'
import { serializarResumo, type LinhasDoResumo } from '@/lib/youtube/observatorio/arquivo-mensal/resumo'
import { montarManifesto, type LinhasDoManifesto } from '@/lib/youtube/observatorio/arquivo-mensal/manifesto-mensal'
import { RespostaRecord } from '@/lib/youtube/observatorio/arquivo-mensal/contrato'
import { apagarCanais, apagarSites } from '../helpers/limpa-cena'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const MES = '2026-10-01'
const DAILY = 'competitor_video_daily'
const EARLY = 'competitor_video_early'
const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex')
const HEX = (n: string): string => n.repeat(64).slice(0, 64)

interface Lida {
  rows: Array<Array<string | null>>; row_count: string; control_sum: string | null; hash_conteudo: string
  columns: Array<{ nome: string }>; schema_fp: string; first_key: string | null; last_key: string | null
}
interface Gravada { status: string; arquivo_id?: string; versao?: number }
interface Unidade extends Gravada { sha256: string; bytes: number; soma: string | null; linhas: number; payload: Record<string, unknown> }
interface Item { arquivo_id: string; sha256: string; bytes: number; linhas: number | null; soma: string | null }

describe.skipIf(skipIfNoLocalDb())('M3b parte 3: gravação, recebimento, resumo, manifesto, selagem e NAS', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c.end() })

  async function emTx<T>(fn: () => Promise<T>, hoje = '2026-11-28'): Promise<T> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')   // TRAVA_DDL_TESTES na 1ª instrução (Yannis R3-1)
    try {
      await aplicarM2(c)
      await c.query(readFileSync(M10A_SQL, 'utf8'))
      await aplicarM3b(c, 3)
      await c.query(`select set_config('obs_archive.hoje', $1, true)`, [hoje])
      return await fn()
    } finally { await c.query('rollback') }
  }
  const fixaHoje = (hoje: string): Promise<unknown> => c.query(`select set_config('obs_archive.hoje', $1, true)`, [hoje])

  // ---- as funções do caminho da rota, no próprio teste (a Tarefa 11 usa as mesmas funções TS) ----
  async function lidaCompleta(cx: Client, site: string, classe: string, tabela: string, canal: string, mes: string): Promise<Lida & { todas: Array<Array<string | null>> }> {
    const todas: Array<Array<string | null>> = []
    let primeira: Lida | null = null
    for (let off = 0; ; off += 1000) {
      const p = (await cx.query(`select * from public.obs_archive_read_unit($1, $2, $3, $4, $5::date, $6, 1000)`, [site, classe, tabela, canal, mes, off])).rows[0] as Lida
      primeira ??= p
      todas.push(...p.rows)
      if (off + 1000 >= Number(p.row_count)) break
    }
    return { ...primeira, todas }
  }
  async function unidadePelaRota(o: { site: string; classe: string; tabela: string; canal: string; mes: string }, cx: Client = c): Promise<Unidade> {
    const l = await lidaCompleta(cx, o.site, o.classe, o.tabela, o.canal, o.mes)
    const n = Number(l.row_count)
    const exp = await exportarUnidade({ ler: async () => ({ colunas: l.columns.map(x => x.nome), linhas: l.todas, contagem: n, soma: l.control_sum }) }, null,
      { tabela: o.tabela, canal: o.canal, de: o.mes, ate: o.mes, rotulo: 'x', colunasDeOrdem: null })
    const payload = { classe: o.classe, tabela: o.tabela, canal: o.canal, mes: o.mes, row_count: n, control_sum: l.control_sum, hash_conteudo: l.hash_conteudo,
      schema_fp: l.schema_fp, sha256_bytes: n ? exp.sha256 : '', csv_sha256: n ? exp.csvSha256 : '', file_bytes: n ? exp.bytes : 0, partes: 1, min_key: l.first_key, max_key: l.last_key }
    const r = (await cx.query(`select public.obs_archive_record($1, 'unidade', $2::jsonb) as r`, [o.site, JSON.stringify(payload)])).rows[0].r as Gravada
    return { ...r, sha256: exp.sha256, bytes: exp.bytes, soma: l.control_sum, linhas: n, payload }
  }
  const item = (u: Unidade): Item => ({ arquivo_id: u.arquivo_id!, sha256: u.sha256, bytes: u.bytes, linhas: u.linhas, soma: u.soma })
  async function receber(site: string, itens: Item[], cx: Client = c): Promise<{ itens: Array<{ arquivo_id: string; resultado: string }>; selados: Array<{ classe: string; mes: string; versao: number }> }> {
    return (await cx.query(`select public.obs_archive_receive($1, $2::jsonb) as r`, [site, JSON.stringify(itens)])).rows[0].r
  }
  async function resumoPelaRota(o: { site: string; classe: string; canal: string; mes: string }, cx: Client = c): Promise<Gravada & { vazio: boolean; rows: LinhasDoResumo; arquivos: Item[] }> {
    const rows = (await cx.query(`select public.obs_archive_summary_rows($1, $2, $3, $4::date) as r`, [o.site, o.classe, o.canal, o.mes])).rows[0].r as LinhasDoResumo
    const s = serializarResumo(rows)
    const por = (p: string) => s.arquivos.find(a => a.papel === p)
    const payload = { classe: o.classe, canal: o.canal, mes: o.mes, vazio: s.vazio, unit_hashes: s.unit_hashes,
      canal_sha256: por('canal')?.sha256 ?? null, canal_bytes: por('canal')?.bytes ?? null, canal_rows: por('canal')?.linhas ?? null,
      video_sha256: por('video')?.sha256 ?? null, video_bytes: por('video')?.bytes ?? null, video_rows: por('video')?.linhas ?? null }
    const r = (await cx.query(`select public.obs_archive_record($1, 'resumo', $2::jsonb) as r`, [o.site, JSON.stringify(payload)])).rows[0].r as Gravada
    return { ...r, vazio: s.vazio, rows,
      arquivos: s.arquivos.map(a => ({ arquivo_id: `${r.arquivo_id}:${a.papel}`, sha256: a.sha256, bytes: a.bytes, linhas: a.linhas, soma: null })) }
  }
  async function manifestoPelaRota(o: { site: string; classe: string; mes: string }, cx: Client = c): Promise<{ versao: number; arquivos: Item[]; rows: LinhasDoManifesto }> {
    const rows = (await cx.query(`select public.obs_archive_manifest_rows($1, $2, $3::date) as r`, [o.site, o.classe, o.mes])).rows[0].r as LinhasDoManifesto
    const m = montarManifesto(rows, o.site)
    await cx.query(`select public.obs_archive_record_manifest($1, $2, $3::date, $4, $5, $6, $7, $8)`, [o.site, o.classe, o.mes, rows.versao, sha(m.json), m.json.length, sha(m.lista), m.lista.length])
    const base = `m:${o.classe}:${o.mes.slice(0, 7)}:v${rows.versao}`
    return { versao: rows.versao, rows, arquivos: [
      { arquivo_id: `${base}:json`, sha256: sha(m.json), bytes: m.json.length, linhas: null, soma: null },
      { arquivo_id: `${base}:sha256`, sha256: sha(m.lista), bytes: m.lista.length, linhas: null, soma: null },
    ] }
  }
  const selado = async (site: string, classe: string, mes: string): Promise<boolean> =>
    (await escalar<number>(c, `select count(*)::int from public.obs_archive_months where site_id = $1 and class = $2 and month = $3::date and sealed_at is not null and unsealed_at is null`, [site, classe, mes])) > 0
  async function falha(sql: string, params: unknown[] = []): Promise<{ code: string; message: string; detail: string } | null> {
    await c.query('savepoint f_m3b')
    try { await c.query(sql, params); await c.query('release savepoint f_m3b'); return null } catch (e) {
      await c.query('rollback to savepoint f_m3b')
      const o = e as { code?: string; message?: string; detail?: string }
      return { code: o.code ?? '', message: o.message ?? '', detail: o.detail ?? '' }
    }
  }
  /** Os dois arquivos da série de um canal gravados e (os não vazios) recebidos. */
  async function unidadesDoCanal(site: string, canal: string): Promise<{ daily: Unidade; early: Unidade }> {
    const daily = await unidadePelaRota({ site, classe: 'serie', tabela: DAILY, canal, mes: MES })
    const early = await unidadePelaRota({ site, classe: 'serie', tabela: EARLY, canal, mes: MES })
    if (daily.linhas > 0) await receber(site, [item(daily)])
    if (early.linhas > 0) await receber(site, [item(early)])
    return { daily, early }
  }
  /** O mês inteiro de uma série até o selo. Devolve a resposta do último recebimento (a do manifesto). */
  async function selarSerie(site: string, canais: string[]): Promise<{ selados: Array<{ classe: string; mes: string; versao: number }> }> {
    for (const canal of canais) await unidadesDoCanal(site, canal)
    for (const canal of canais) {
      const r = await resumoPelaRota({ site, classe: 'serie', canal, mes: MES })
      if (!r.vazio) await receber(site, r.arquivos)
    }
    const m = await manifestoPelaRota({ site, classe: 'serie', mes: MES })
    return receber(site, m.arquivos)
  }
  const col = (colunas: string[], linha: ReadonlyArray<string | null>, nome: string): string | null => linha[colunas.indexOf(nome)] ?? null
  const attest = async (site: string, itens: unknown[], o: { canarios?: unknown[]; montado?: boolean } = {}): Promise<{ itens: Array<{ arquivo_id: string; resposta: string; motivo?: string }>; canarios: Array<{ filho: string; resposta: string; motivo?: string }> }> => {
    const f = { montado: o.montado ?? true, sentinela: o.montado ?? true }
    const corpo = { fonte: 'nas', plano_id: randomUUID(), filhos: { numerico: f, texto: f }, canarios: o.canarios ?? [], itens }
    return (await c.query(`select public.obs_archive_attest_nas($1, $2::jsonb) as r`, [SITE_DE_TESTE, JSON.stringify(corpo)])).rows[0].r
  }
  let SITE_DE_TESTE = ''

  it('a ordem do selo: unidades, resumo do canal, manifesto, e só então sealed_at (itens 77 e 158)', async () => emTx(async () => {
    const { site, canal, videos } = await semearCanal(c, { videos: 2 })
    await semearDiaria(c, videos, '2026-10-03', 29)
    const u = await unidadePelaRota({ site, classe: 'serie', tabela: DAILY, canal, mes: MES })
    const e = await unidadePelaRota({ site, classe: 'serie', tabela: EARLY, canal, mes: MES })
    expect(e.status).toBe('nova')
    expect(await selado(site, 'serie', MES)).toBe(false)
    await receber(site, [item(u)])
    expect(await selado(site, 'serie', MES)).toBe(false)                                   // falta o resumo
    const r = await resumoPelaRota({ site, classe: 'serie', canal, mes: MES })
    await receber(site, r.arquivos)
    expect(await selado(site, 'serie', MES)).toBe(false)                                   // falta o manifesto
    const m = await manifestoPelaRota({ site, classe: 'serie', mes: MES })
    const res = await receber(site, m.arquivos)
    expect(res.selados).toEqual([{ classe: 'serie', mes: '2026-10', versao: 1 }])
    const linha = (await c.query(`select sealed_kind, rows_total, days_measured, days_in_month from public.obs_archive_months where site_id = $1 and class = 'serie' and table_name = $2`, [site, DAILY])).rows[0]
    expect(linha).toEqual({ sealed_kind: 'com_dado', rows_total: '58', days_measured: 29, days_in_month: 31 })
  }))

  it('re-selo por expurgo de mês fora do banco guarda os dias do selo anterior (pedido da M9)', async () => emTx(async () => {
    const { site, canal, videos } = await semearCanal(c, { videos: 2 })
    await semearDiaria(c, videos, '2026-10-03', 29)
    const u = await unidadePelaRota({ site, classe: 'serie', tabela: DAILY, canal, mes: MES })
    await unidadePelaRota({ site, classe: 'serie', tabela: EARLY, canal, mes: MES })
    await receber(site, [item(u)])
    await receber(site, (await resumoPelaRota({ site, classe: 'serie', canal, mes: MES })).arquivos)
    await receber(site, (await manifestoPelaRota({ site, classe: 'serie', mes: MES })).arquivos)
    await c.query(`delete from public.competitor_video_daily where video_id = any($1::uuid[])`, [videos])
    const reselar = async (marca: string, nulos = false): Promise<Record<string, unknown>> => {
      // Com a M9 instalada o gatilho obs_archive_congela_dias devolve os dias antigos a todo update de mês fora do banco: para simular "sem medida
      // anterior" (nulos), desliga-o só neste passo (dentro da transação desfeita) e religa em seguida.
      if (nulos) await c.query('alter table public.obs_archive_months disable trigger obs_archive_congela_dias')
      await c.query(`update public.obs_archive_months set ${marca} = now(), unsealed_at = now(), unsealed_reason = 'expurgo'${nulos ? ', days_measured = null, days_in_month = null' : ''} where site_id = $1 and class = 'serie'`, [site])
      if (nulos) await c.query('alter table public.obs_archive_months enable trigger obs_archive_congela_dias')
      expect(await escalar(c, `select public.obs_archive_seal($1, 'serie', $2::date)`, [site, MES])).toBe(1)
      return (await c.query(`select days_measured, days_in_month, unsealed_reason from public.obs_archive_months where site_id = $1 and class = 'serie' and table_name = $2`, [site, DAILY])).rows[0]
    }
    expect(await reselar('detached_at')).toEqual({ days_measured: 29, days_in_month: 31, unsealed_reason: null })
    expect(await reselar('dropped_at')).toEqual({ days_measured: 29, days_in_month: 31, unsealed_reason: null })
    // mês fora do banco sem medida anterior fica sem medida (nulo, nunca 0)
    expect(await reselar('detached_at', true)).toEqual({ days_measured: null, days_in_month: null, unsealed_reason: null })
  }))

  it('canal sem linha tem unidade vazia com o nome do canal (item 26)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    const b = await semearCanal(c, { site: a.site, videos: 0 })
    const ub = await unidadePelaRota({ site: a.site, classe: 'serie', tabela: DAILY, canal: b.canal, mes: MES })
    const linha = await q1(c, `select row_count, sha256_bytes, received_at is not null as recebida from public.obs_archive_units where id = $1`, [ub.arquivo_id!.slice(2)])
    expect(linha).toEqual({ row_count: '0', sha256_bytes: null, recebida: true })
    expect((await selarSerie(a.site, [a.canal, b.canal])).selados).toHaveLength(1)
  }))

  it('canal sem unidade impede resumo, manifesto e selo (Review Focus 1, Phil C1)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    const b = await semearCanal(c, { site: a.site, videos: 1 }); await semearDiaria(c, b.videos, '2026-10-01', 31)
    await unidadesDoCanal(a.site, a.canal)
    const rb = await falha(`select public.obs_archive_summary_rows($1, 'serie', $2, $3::date)`, [a.site, b.canal, MES])
    expect(rb?.message).toBe('unidades_pendentes')
    expect(rb?.detail).toContain(`faltando:${DAILY}`)
    const ra = await resumoPelaRota({ site: a.site, classe: 'serie', canal: a.canal, mes: MES })
    await receber(a.site, ra.arquivos)
    const mf = await falha(`select public.obs_archive_manifest_rows($1, 'serie', $2::date)`, [a.site, MES])
    expect(mf?.message).toBe('unidades_pendentes')
    expect(mf?.detail).toContain(`faltando:${DAILY}:${b.canal}`)
    expect(await selado(a.site, 'serie', MES)).toBe(false)
    // O plano (resumos sem B, manifestos vazio) é afirmado em manutencao-m3b-plano.test.ts (Tarefa 7), onde obs_archive_plan nasce.
  }))

  it('unidade nova em mês selado reabre (Phil C1)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    await selarSerie(a.site, [a.canal])
    expect(await selado(a.site, 'serie', MES)).toBe(true)
    const b = await semearCanal(c, { site: a.site, videos: 1 }); await semearDiaria(c, b.videos, '2026-10-01', 31)   // cadastrado antes do fim do mês
    const u = await unidadePelaRota({ site: a.site, classe: 'serie', tabela: DAILY, canal: b.canal, mes: MES })
    expect(u.status).toBe('nova')
    const m = await q1(c, `select unsealed_reason, unsealed_at is not null as aberto from public.obs_archive_months where site_id = $1 and table_name = $2`, [a.site, DAILY])
    expect(m).toEqual({ unsealed_reason: 'unidade_nova', aberto: true })
    expect(await selado(a.site, 'serie', MES)).toBe(false)
  }))

  it('o dia devido: 27/11 mes_aberto, 28/11 nova; texto 14/12 mes_aberto, 15/12 nova (Phil C2)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    const d = { site: a.site, classe: 'serie', tabela: DAILY, canal: a.canal, mes: MES }
    await fixaHoje('2026-11-27'); expect((await unidadePelaRota(d)).status).toBe('mes_aberto')
    await fixaHoje('2026-11-28'); expect((await unidadePelaRota(d)).status).toBe('nova')
    const t = { site: a.site, classe: 'texto', tabela: 'competitor_video_comments', canal: a.canal, mes: MES }
    await fixaHoje('2026-12-14'); expect((await unidadePelaRota(t)).status).toBe('mes_aberto')
    await fixaHoje('2026-12-15'); expect((await unidadePelaRota(t)).status).toBe('nova')
  }))

  const corpoDe = async (nome: string): Promise<string> => ((await c.query(`select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1`, [nome])).rows[0]?.prosrc as string | undefined) ?? ''
  it('uma conta só para o dia devido (D20)', async () => emTx(async () => {
    expect(await corpoDe('obs_archive_record_core')).toContain('obs_archive_due_on')
    const aux = ['obs_archive_meses_devidos', 'obs_archive_atraso_itens']                         // a conta do devido mora nelas; plano, atraso e vermelhos só as chamam
    for (const f of ['obs_archive_plan', 'obs_archive_atraso', 'obs_archive_vermelhos']) {       // nascem na Tarefa 7; o teste de lá exige que existam
      const corpo = await corpoDe(f)
      if (corpo) expect([corpo, ...(await Promise.all(aux.map(corpoDe)))].join('\n'), f).toContain('obs_archive_due_on')
    }
    const ruins = (await c.query(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'obs_archive_%' and p.prosrc ~ 'seal_margin_days\\s*>'`)).rows
    expect(ruins).toEqual([])
  }))

  it('uma definição só do devido (D19)', async () => emTx(async () => {
    for (const f of ['obs_archive_summary_rows', 'obs_archive_manifest_rows', 'obs_archive_seal', 'obs_archive_unit_due']) expect(await corpoDe(f), f).toContain('obs_archive_expected_units')
    for (const f of ['obs_archive_plan', 'obs_archive_atraso']) { const corpo = await corpoDe(f); if (corpo) expect(corpo + await corpoDe('obs_archive_atraso_itens'), f).toContain('obs_archive_expected_units') }
  }))

  it('unidade fora do devido: nao_devida, nada gravado (Yannis M17)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 })
    const antes = await escalar(c, `select (select count(*) from public.obs_archive_units) + (select count(*) from public.obs_archive_months)`)
    const set = await unidadePelaRota({ site: a.site, classe: 'serie', tabela: DAILY, canal: a.canal, mes: '2026-09-01' })
    expect(set.status).toBe('nao_devida')
    const payload = { classe: 'video_antigo', tabela: 'competitor_video_versions', canal: a.canal, mes: MES, row_count: 0, control_sum: null, hash_conteudo: HEX('a'), schema_fp: HEX('b'), sha256_bytes: '', csv_sha256: '', file_bytes: 0, partes: 1 }
    const va = (await c.query(`select public.obs_archive_record($1, 'unidade', $2::jsonb) as r`, [a.site, JSON.stringify(payload)])).rows[0].r as Gravada
    expect(va.status).toBe('nao_devida')
    expect(await escalar(c, `select (select count(*) from public.obs_archive_units) + (select count(*) from public.obs_archive_months)`)).toBe(antes)
  }))

  it('canal cadastrado depois do mês não é devido nele (D14, Phil I7)', async () => emTx(async () => {
    const tarde = await semearCanal(c, { videos: 1, addedAt: '2026-11-05T12:00:00Z' })
    const comLinha = await semearCanal(c, { site: tarde.site, videos: 1, addedAt: '2026-11-05T12:00:00Z' }); await semearDiaria(c, comLinha.videos, '2026-10-10', 3)
    const nulo = await semearCanal(c, { site: tarde.site, videos: 0, addedAt: null })
    const devidos = (await c.query(`select channel_ref from public.obs_archive_expected_units($1, 'serie', $2::date) where table_name = $3`, [tarde.site, MES, DAILY])).rows.map(r => r.channel_ref as string)
    expect(devidos).not.toContain(tarde.canal)
    expect(devidos).toContain(comLinha.canal)
    expect(devidos).toContain(nulo.canal)
  }))

  it('mês fora do banco nunca se refaz do online (Phil C3)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    const { daily } = await unidadesDoCanal(a.site, a.canal)
    await c.query(`update public.obs_archive_months set detached_at = now() where site_id = $1 and table_name = $2`, [a.site, DAILY])
    SITE_DE_TESTE = a.site
    const r = await attest(a.site, [{ arquivo_id: daily.arquivo_id, resultado: 'ausente' }])
    expect(r.itens[0]?.resposta).toBe('aceito')
    const u = await q1(c, `select nas_withdrawn_reason, redo_reason from public.obs_archive_units where id = $1`, [daily.arquivo_id!.slice(2)])
    expect(u).toEqual({ nas_withdrawn_reason: 'ausente', redo_reason: null })               // a lista aguardando_dono é afirmada na Tarefa 7
    expect((await unidadePelaRota({ site: a.site, classe: 'serie', tabela: DAILY, canal: a.canal, mes: MES })).status).toBe('mes_fora_do_banco')
    const rh = (await c.query(`select public.obs_archive_unit_rehash($1) as r`, [daily.arquivo_id!.slice(2)])).rows[0].r
    expect(rh).toEqual({ igual: true, pulada: true })
    expect((await falha(`select public.obs_archive_summary_rows($1, 'serie', $2, $3::date)`, [a.site, a.canal, MES]))?.message).toBe('ja_no_arquivo')
    expect(await escalar(c, `select count(*)::int from public.obs_archive_units where site_id = $1 and table_name = $2`, [a.site, DAILY])).toBe(1)
  }))

  async function duasPontas(video: string, v1: [number, number | null], v2: [number, number | null]): Promise<void> {
    await c.query(`delete from public.competitor_video_daily where video_id = $1`, [video])
    await c.query(`insert into public.competitor_video_daily (video_id, snap_date, views, likes, comments, taken_at) values
      ($1, '2026-10-02', 100, $2, 1, '2026-10-02T12:00:00Z'), ($1, '2026-10-20', 200, $3, 1, '2026-10-20T12:00:00Z')`, [video, v1[1], v2[1]])
  }
  it('variação nula com nulo em qualquer ponta (Phil I10)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 2 })
    await duasPontas(a.videos[0]!, [0, 10], [0, 20])           // A: likes 10 → 20
    await duasPontas(a.videos[1]!, [0, null], [0, 5])          // B: null → 5
    await unidadesDoCanal(a.site, a.canal)
    const r = (await c.query(`select public.obs_archive_summary_rows($1, 'serie', $2, $3::date) as r`, [a.site, a.canal, MES])).rows[0].r as LinhasDoResumo
    const linha = r.canal.find(l => col(r.colunas_canal, l, 'tabela') === DAILY)!
    expect(col(r.colunas_canal, linha, 'var_likes')).toBeNull()
    expect(col(r.colunas_canal, linha, 'var_views')).toBe('200')       // (200-100) + (200-100)
  }))

  it('Passo 1b: a saída do resumo depois de extrair a calc é IGUAL, byte a byte, à da função antiga congelada', async () => emTx(async () => {
    // Escolha: diferencial vivo (a função de antes, congelada em test/fixtures-sql, roda ao lado da nova sobre os mesmos dados), não ouro gravado:
    // o ouro envelhece com o esquema e o diferencial cai no dia em que alguém mexer na calc sem querer.
    await c.query(readFileSync(resolve(__dirname, '../fixtures-sql/m3b-summary-rows-antes.sql'), 'utf8'))
    const a = await semearCanal(c, { videos: 3 })
    await duasPontas(a.videos[0]!, [0, 10], [0, 20])
    await duasPontas(a.videos[1]!, [0, null], [0, 5])
    await semearDiaria(c, [a.videos[2]!], '2026-10-03', 29)
    await unidadesDoCanal(a.site, a.canal)
    const vazio = await semearCanal(c, { videos: 1 })
    await unidadesDoCanal(vazio.site, vazio.canal)
    for (const k of [a, vazio]) {
      const [antes, depois] = await Promise.all(['obs_archive_summary_rows_antes', 'obs_archive_summary_rows'].map(async f =>
        (await c.query(`select public.${f}($1, 'serie', $2, $3::date)::text as r`, [k.site, k.canal, MES])).rows[0].r as string))
      expect(depois).toBe(antes)
      expect(depois.length).toBeGreaterThan(100)
    }
    // Phil M4 / Yannis M4: a classe `texto` (measured = false, o ramo do nulo) também passa pelo antes/depois
    const tx = await semearCanal(c, { videos: 1 })
    await c.query(`insert into public.competitor_video_comments (site_id, competitor_channel_id, video_id, youtube_comment_id, body, published_at, is_creator, first_seen_at, last_seen_at)
      values ($1, $2, $3, 'cm1', 'um comentário', '2026-10-05T10:00:00Z', false, '2026-10-05T11:00:00Z', '2026-10-06T11:00:00Z')`, [tx.site, tx.canal, tx.videos[0]])
    await fixaHoje('2026-12-15')                                  // o texto só fecha o mês no dia 15 (Phil C2)
    for (const t of ['competitor_video_comments', 'competitor_video_comment_marks', 'competitor_raw']) {
      const u = await unidadePelaRota({ site: tx.site, classe: 'texto', tabela: t, canal: tx.canal, mes: MES })
      if (u.linhas > 0) await receber(tx.site, [item(u)])
    }
    const [antesT, depoisT] = await Promise.all(['obs_archive_summary_rows_antes', 'obs_archive_summary_rows'].map(async f =>
      (await c.query(`select public.${f}($1, 'texto', $2, $3::date)::text as r`, [tx.site, tx.canal, MES])).rows[0].r as string))
    expect(depoisT).toBe(antesT)
    expect(depoisT.length).toBeGreaterThan(100)
    const dados = JSON.parse((await c.query(`select public.obs_archive_summary_rows($1, 'serie', $2, $3::date)::text as r`, [a.site, a.canal, MES])).rows[0].r) as LinhasDoResumo
    expect(dados.canal.length).toBeGreaterThan(0)
    expect(dados.video.length).toBeGreaterThan(0)
  }))

  it('Passo 1b: a calc é interna (ninguém chama de fora) e é o único execute format do cálculo', async () => emTx(async () => {
    for (const q of ['anon', 'authenticated', 'service_role']) {
      expect(await escalar<boolean>(c, `select has_function_privilege($1, 'public.obs_archive_summary_calc(uuid,text,uuid,text,date,text,text)'::regprocedure, 'execute')`, [q]), q).toBe(false)
    }
    const rows = await escalar<string>(c, `select prosrc from pg_proc where proname = 'obs_archive_summary_rows' and pronamespace = 'public'::regnamespace`)
    expect(rows).not.toMatch(/execute format/)
    expect(rows).toMatch(/obs_archive_summary_calc\(/)
    expect(await escalar<string>(c, `select provolatile::text from pg_proc where proname = 'obs_archive_summary_calc' and pronamespace = 'public'::regnamespace`)).toBe('s')
  }))

  it('sealed_kind e os números são por tabela (Phil I10)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 2 }); await semearDiaria(c, a.videos, '2026-10-03', 29)
    await selarSerie(a.site, [a.canal])
    const m = (await c.query(`select table_name, sealed_kind, days_measured, rows_total from public.obs_archive_months where site_id = $1 order by table_name`, [a.site])).rows
    expect(m).toEqual([
      { table_name: DAILY, sealed_kind: 'com_dado', days_measured: 29, rows_total: '58' },
      { table_name: EARLY, sealed_kind: 'vazio_conferido', days_measured: 0, rows_total: '0' },
    ])
  }))

  it('parte_mudou reaproveita a versão não recebida (Phil M3)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    const d = { site: a.site, classe: 'serie', tabela: DAILY, canal: a.canal, mes: MES }
    const v1 = await unidadePelaRota(d)
    await c.query(`select public.obs_archive_mark_redo($1, 'parte_mudou')`, [v1.arquivo_id!.slice(2)])
    const v1b = await unidadePelaRota(d)
    expect(v1b).toMatchObject({ status: 'mesma', versao: 1 })
    expect(await escalar(c, `select redo_reason is null from public.obs_archive_units where id = $1`, [v1.arquivo_id!.slice(2)])).toBe(true)
  }))

  /** Uma unidade da diária gravada em duas partes (30 + 28 linhas), com os hashes de mentira. */
  async function unidadeEmPartes(site: string, canal: string): Promise<{ id: string; gravada: Gravada; payload: Record<string, unknown> }> {
    const l = await lidaCompleta(c, site, 'serie', DAILY, canal, MES)
    const payload = { classe: 'serie', tabela: DAILY, canal, mes: MES, row_count: 58, control_sum: l.control_sum, hash_conteudo: l.hash_conteudo, schema_fp: l.schema_fp,
      sha256_bytes: HEX('c'), csv_sha256: HEX('d'), file_bytes: 1000, partes: 2, min_key: l.first_key, max_key: l.last_key,
      parts: [
        { parte: 1, sha256_bytes: HEX('1'), csv_sha256: HEX('2'), file_bytes: 500, row_count: 30, control_sum: '30000', row_offset: 0, min_key: 'a', max_key: 'b' },
        { parte: 2, sha256_bytes: HEX('3'), csv_sha256: HEX('4'), file_bytes: 500, row_count: 28, control_sum: '28000', row_offset: 30, min_key: 'c', max_key: 'd' },
      ] }
    const gravada = (await c.query(`select public.obs_archive_record($1, 'unidade', $2::jsonb) as r`, [site, JSON.stringify(payload)])).rows[0].r as Gravada
    return { id: gravada.arquivo_id!.slice(2), gravada, payload }
  }
  it('mesma com parte já recebida: nao_devida (Yannis M16)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 2 }); await semearDiaria(c, a.videos, '2026-10-03', 29)
    const p = await unidadeEmPartes(a.site, a.canal)
    expect(p.gravada.status).toBe('nova')
    const r = await receber(a.site, [{ arquivo_id: `p:${p.id}:01`, sha256: HEX('1'), bytes: 500, linhas: 30, soma: '30000' }])
    expect(r.itens[0]?.resultado).toBe('recebida')
    const de = (await c.query(`select public.obs_archive_record($1, 'unidade', $2::jsonb) as r`, [a.site, JSON.stringify(p.payload)])).rows[0].r as Gravada
    expect(de.status).toBe('nao_devida')
    expect(await escalar(c, `select received_at is not null from public.obs_archive_unit_parts where unit_id = $1 and part = 1`, [p.id])).toBe(true)
  }))

  it('canário regravado no dia: recusado (Phil I4)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 0 }); SITE_DE_TESTE = a.site
    const dia = '2026-11-28'
    const um = await attest(a.site, [], { canarios: [{ filho: 'numerico', dia, sha256: HEX('a') }, { filho: 'texto', dia, sha256: HEX('b') }] })
    expect(um.canarios.map(x => x.resposta)).toEqual(['aceito', 'aceito'])
    const dois = await attest(a.site, [], { canarios: [{ filho: 'numerico', dia, sha256: HEX('f') }] })
    expect(dois.canarios[0]).toMatchObject({ filho: 'numerico', resposta: 'recusado', motivo: 'sha256_diferente_no_dia' })
    const reg = await q1(c, `select sha256, regravado_at is not null as vermelho from public.obs_archive_canaries where site_id = $1 and filho = 'numerico'`, [a.site])
    expect(reg).toEqual({ sha256: HEX('a'), vermelho: true })       // o texto `canario_regravado:numerico` em vermelhos é afirmado na Tarefa 7
  }))

  it('ilegivel no NAS é divergente (K4)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31); SITE_DE_TESTE = a.site
    const { daily } = await unidadesDoCanal(a.site, a.canal)
    const r = await attest(a.site, [{ arquivo_id: daily.arquivo_id, resultado: 'ilegivel' }])
    expect(r.itens[0]?.resposta).toBe('aceito')
    expect(await q1(c, `select nas_withdrawn_reason, redo_reason, nas_unreadable_at is not null as ilegivel from public.obs_archive_units where id = $1`, [daily.arquivo_id!.slice(2)]))
      .toEqual({ nas_withdrawn_reason: 'divergente', redo_reason: 'divergente', ilegivel: true })
  }))

  it('ilegivel de canal removido não volta a devida (K4)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31); SITE_DE_TESTE = a.site
    const { daily } = await unidadesDoCanal(a.site, a.canal)
    await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known, declared_xid)
      select distinct site_id, channel_ref, 'botao', 'apagar', now(), true, pg_current_xact_id() from public.obs_archive_units where site_id = $1 on conflict do nothing`, [a.site])      // o destino declarado (parte 6): o gatilho deixa apagar
    await apagarCanais(c, 'id = $1', [a.canal])
    await attest(a.site, [{ arquivo_id: daily.arquivo_id, resultado: 'ilegivel' }])
    expect(await q1(c, `select nas_withdrawn_reason, redo_reason from public.obs_archive_units where id = $1`, [daily.arquivo_id!.slice(2)])).toEqual({ nas_withdrawn_reason: 'divergente', redo_reason: null })
  }))

  it('mês sem linha em canal nenhum sela como vazio conferido (item 26)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 })
    expect((await selarSerie(a.site, [a.canal])).selados).toHaveLength(1)
    expect((await c.query(`select sealed_kind from public.obs_archive_months where site_id = $1`, [a.site])).rows.map(r => r.sealed_kind)).toEqual(['vazio_conferido', 'vazio_conferido'])
  }))

  it('tudo purged: sem dado a guardar (item 158)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    await unidadesDoCanal(a.site, a.canal)
    await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known, declared_xid)
      select distinct site_id, channel_ref, 'botao', 'apagar', now(), true, pg_current_xact_id() from public.obs_archive_units where site_id = $1 on conflict do nothing`, [a.site])
    await c.query(`update public.obs_archive_units set purged_at = now(), purged_by = gen_random_uuid(), purge_ref = 'teste' where site_id = $1`, [a.site])
    const m = await manifestoPelaRota({ site: a.site, classe: 'serie', mes: MES })
    expect(m.rows.arquivos.map(x => x.estado)).toEqual(['expurgada', 'expurgada'])
    const r = await receber(a.site, m.arquivos)
    expect(r.selados).toHaveLength(1)
    expect((await c.query(`select sealed_kind from public.obs_archive_months where site_id = $1`, [a.site])).rows.map(x => x.sealed_kind)).toEqual(['sem_dado_a_guardar', 'sem_dado_a_guardar'])
  }))

  it('recebido com hash diferente não vira recebida (item 23)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    const u = await unidadePelaRota({ site: a.site, classe: 'serie', tabela: DAILY, canal: a.canal, mes: MES })
    const r = await receber(a.site, [{ ...item(u), sha256: HEX('e') }])
    expect(r.itens[0]?.resultado).toBe('divergente')
    expect(await q1(c, `select received_at, redo_reason from public.obs_archive_units where id = $1`, [u.arquivo_id!.slice(2)])).toEqual({ received_at: null, redo_reason: 'divergente' })
  }))

  it('hash certo e uma linha a menos: conteudo_divergente (item 76)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    const u = await unidadePelaRota({ site: a.site, classe: 'serie', tabela: DAILY, canal: a.canal, mes: MES })
    const r = await receber(a.site, [{ ...item(u), linhas: u.linhas - 1 }])
    expect(r.itens[0]?.resultado).toBe('conteudo_divergente')
    expect(await q1(c, `select received_at, redo_reason from public.obs_archive_units where id = $1`, [u.arquivo_id!.slice(2)])).toEqual({ received_at: null, redo_reason: 'conteudo_divergente' })
  }))

  it('ausente: a versão seguinte nasce com o mesmo hash, o selo da v1 resiste até a v2 (itens 23, 78, N1 do Phil)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31); SITE_DE_TESTE = a.site
    await selarSerie(a.site, [a.canal])
    const v1 = await q1(c, `select id, sha256_bytes from public.obs_archive_units where site_id = $1 and table_name = $2`, [a.site, DAILY])
    await c.query(`update public.obs_archive_units set nas_attested_at = now() where id = $1`, [v1.id])
    await c.query(`select public.obs_archive_attest_nas($1, $2::jsonb)`, [a.site, JSON.stringify({ fonte: 'nas', plano_id: randomUUID(), filhos: { numerico: { montado: true, sentinela: true }, texto: { montado: true, sentinela: true } }, canarios: [],
      itens: [{ arquivo_id: `u:${v1.id}`, resultado: 'ausente' }] })])
    // N1: o atestado do mês zera na mesma chamada, e month_files traz a v1 sem atestado
    expect(await escalar(c, `select nas_attested_at is null from public.obs_archive_months where site_id = $1 and table_name = $2`, [a.site, DAILY])).toBe(true)
    expect(await q1(c, `select arquivo_id, nas_attested_at from public.obs_archive_month_files($1, 'serie', $2::date) where tipo = 'unidade'`, [a.site, MES])).toEqual({ arquivo_id: `u:${v1.id}`, nas_attested_at: null })
    const v2 = await unidadePelaRota({ site: a.site, classe: 'serie', tabela: DAILY, canal: a.canal, mes: MES })
    expect(v2).toMatchObject({ status: 'nova', versao: 2 })
    expect(await escalar(c, `select sha256_bytes from public.obs_archive_units where id = $1`, [v1.id])).toBe(v1.sha256_bytes)
    expect((await q1(c, `select arquivo_id from public.obs_archive_month_files($1, 'serie', $2::date) where tipo = 'unidade'`, [a.site, MES])).arquivo_id).toBe(`u:${v1.id}`)   // até a v2 chegar
    expect(await escalar(c, `select sealed_version from public.obs_archive_months where site_id = $1 and table_name = $2`, [a.site, DAILY])).toBe(1)
    await receber(a.site, [item(v2)])
    expect((await q1(c, `select arquivo_id from public.obs_archive_month_files($1, 'serie', $2::date) where tipo = 'unidade'`, [a.site, MES])).arquivo_id).toBe(v2.arquivo_id)
    expect(await escalar(c, `select sealed_version from public.obs_archive_months where site_id = $1 and table_name = $2`, [a.site, DAILY])).toBe(1)   // faltam resumo e manifesto
    const r = await resumoPelaRota({ site: a.site, classe: 'serie', canal: a.canal, mes: MES })
    expect(r.versao).toBe(2)
    await receber(a.site, r.arquivos)
    const m = await manifestoPelaRota({ site: a.site, classe: 'serie', mes: MES })
    expect(m.versao).toBe(2)
    const fim = await receber(a.site, m.arquivos)
    expect(fim.selados).toEqual([{ classe: 'serie', mes: '2026-10', versao: 2 }])
    expect(await escalar(c, `select sealed_version from public.obs_archive_months where site_id = $1 and table_name = $2`, [a.site, DAILY])).toBe(2)
    expect(await escalar(c, `select superseded_at is not null from public.obs_archive_units where id = $1`, [v1.id])).toBe(true)
  }))

  it('repetir a exportação com o mesmo hash devolve a mesma versão', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    const d = { site: a.site, classe: 'serie', tabela: DAILY, canal: a.canal, mes: MES }
    const v1 = await unidadePelaRota(d)
    await c.query(`update public.obs_archive_units set sha256_bytes = $2 where id = $1`, [v1.arquivo_id!.slice(2), HEX('9')])
    const v1b = await unidadePelaRota(d)
    expect(v1b).toMatchObject({ status: 'mesma', versao: 1 })
    expect(await escalar(c, `select sha256_bytes from public.obs_archive_units where id = $1`, [v1.arquivo_id!.slice(2)])).toBe(v1b.sha256)
    await receber(a.site, [item(v1b)])
    expect((await unidadePelaRota(d)).status).toBe('nao_devida')       // recebida: nunca regrava os bytes
  }))

  it('o resumo carrega o hash de cada unidade e é refeito por canal quando o mês é reexportado (itens 31, 158)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    const b = await semearCanal(c, { site: a.site, videos: 1 }); await semearDiaria(c, b.videos, '2026-10-01', 31)
    await selarSerie(a.site, [a.canal, b.canal])
    const u1 = (await q1(c, `select id, hash_conteudo from public.obs_archive_units where site_id = $1 and channel_ref = $2 and table_name = $3`, [a.site, a.canal, DAILY]))
    const sA = await q1(c, `select unit_hashes, version from public.obs_archive_summaries where site_id = $1 and channel_ref = $2`, [a.site, a.canal])
    expect((sA.unit_hashes as Record<string, string>)[`u:${u1.id}`]).toBe(u1.hash_conteudo)
    await c.query(`update public.competitor_video_daily set views = views + 1 where video_id = $1`, [a.videos[0]])
    const v2 = await unidadePelaRota({ site: a.site, classe: 'serie', tabela: DAILY, canal: a.canal, mes: MES })
    expect(v2.status).toBe('nova')
    await receber(a.site, [item(v2)])
    const rA = await resumoPelaRota({ site: a.site, classe: 'serie', canal: a.canal, mes: MES })
    const rB = await resumoPelaRota({ site: a.site, classe: 'serie', canal: b.canal, mes: MES })
    expect(rA.versao).toBe(2)
    expect(Object.keys(rA.rows.unit_hashes)).toContain(v2.arquivo_id)
    expect(rB.versao).toBe(1)
  }))

  it('mês com buraco nunca vira zero (item 31)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 2 }); await semearDiaria(c, a.videos, '2026-10-03', 29)
    await unidadesDoCanal(a.site, a.canal)
    const r = (await c.query(`select public.obs_archive_summary_rows($1, 'serie', $2, $3::date) as r`, [a.site, a.canal, MES])).rows[0].r as LinhasDoResumo
    const l = r.canal.find(x => col(r.colunas_canal, x, 'tabela') === DAILY)!
    expect(col(r.colunas_canal, l, 'dias_medidos')).toBe('29')
    expect(col(r.colunas_canal, l, 'dias_do_mes')).toBe('31')
    expect(col(r.colunas_canal, l, 'var_likes')).toBeNull()
  }))

  it('um hash que mudou entre a unidade e o resumo impede o selo (item 77)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 30)
    const { daily } = await unidadesDoCanal(a.site, a.canal)
    await c.query(`insert into public.competitor_video_daily (video_id, snap_date, views, likes, comments, taken_at) values ($1, '2026-10-31', 7, null, 1, now())`, [a.videos[0]])
    const rh = (await c.query(`select public.obs_archive_unit_rehash($1) as r`, [daily.arquivo_id!.slice(2)])).rows[0].r
    expect(rh).toEqual({ igual: false })
    expect(await escalar(c, `select redo_reason from public.obs_archive_units where id = $1`, [daily.arquivo_id!.slice(2)])).toBe('conteudo_mudou')
    expect((await falha(`select public.obs_archive_summary_rows($1, 'serie', $2, $3::date)`, [a.site, a.canal, MES]))?.message).toBe('unidades_pendentes')
  }))

  it('nas_attested_at do mês é o menor entre os arquivos do mês; em partes, month_files traz as partes (itens 77 e 158, Phil I2)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31); SITE_DE_TESTE = a.site
    await selarSerie(a.site, [a.canal])
    await c.query(`update public.obs_archive_units set nas_attested_at = '2026-10-05T00:00:00Z' where site_id = $1`, [a.site])
    await c.query(`update public.obs_archive_summaries set nas_attested_at = '2026-10-02T00:00:00Z' where site_id = $1`, [a.site])
    await c.query(`update public.obs_archive_months set manifest_nas_attested_at = '2026-10-03T00:00:00Z' where site_id = $1`, [a.site])
    const u = await q1(c, `select id, sha256_bytes, file_bytes, row_count, control_sum from public.obs_archive_units where site_id = $1 and table_name = $2`, [a.site, DAILY])
    await attest(a.site, [{ arquivo_id: `u:${u.id}`, resultado: 'presente', sha256: u.sha256_bytes, bytes: Number(u.file_bytes), linhas: Number(u.row_count), soma: u.control_sum }])
    expect(await escalar<Date | null>(c, `select nas_attested_at from public.obs_archive_months where site_id = $1 and table_name = $2`, [a.site, DAILY])).toEqual(new Date('2026-10-02T00:00:00Z'))
    const b = await semearCanal(c, { videos: 1 }); await semearDiaria(c, b.videos, '2026-10-03', 29)
    const p = await unidadeEmPartes(b.site, b.canal)
    const ids = (await c.query(`select arquivo_id from public.obs_archive_month_files($1, 'serie', $2::date) where channel_ref = $3 and tipo in ('unidade','parte') order by arquivo_id`, [b.site, MES, b.canal])).rows.map(r => r.arquivo_id)
    expect(ids).toEqual([`p:${p.id}:01`, `p:${p.id}:02`])
  }))

  it('remover o canal antes do recebimento: unit/received devolve canal_removido e não grava (item 159; a corrida de 20 rodadas está em manutencao-m3b-remocao.test.ts)', async () => {
    await c.query('begin')
    try {
      await aplicarM2(c); await c.query(readFileSync(M10A_SQL, 'utf8')); await aplicarM3b(c, 6)
      await c.query(`select set_config('obs_archive.hoje', '2026-11-28', true)`)
      const a = await semearCanal(c, { videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
      const u = await unidadePelaRota({ site: a.site, classe: 'serie', tabela: DAILY, canal: a.canal, mes: MES })
      const admin = randomUUID()
      const org = (await c.query(`select org_id from public.sites where id = $1`, [a.site])).rows[0].org_id as string
      await c.query(`insert into auth.users (id, instance_id, aud, role, email) values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2)`, [admin, `m3b-${admin}@t.test`])
      await c.query(`insert into public.organization_members (org_id, user_id, role) values ($1, $2, 'org_admin')`, [org, admin])
      expect((await c.query(`select public.competitor_channel_remove($1, $2, 'apagar', 'botao', $3) as r`, [a.site, a.canal, admin])).rows[0].r.status).toBe('ok')
      const r = await receber(a.site, [item(u)])
      expect(r.itens[0]?.resultado).toBe('canal_removido')
      expect(await escalar(c, `select received_at is null from public.obs_archive_units where id = $1`, [u.arquivo_id!.slice(2)])).toBe(true)
      expect((await unidadePelaRota({ site: a.site, classe: 'serie', tabela: DAILY, canal: a.canal, mes: MES })).status).toBe('canal_removido')
    } finally { await c.query('rollback') }
  })

  it('a rede: insert direto de unidade de canal apagar recusa (K3)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 0 })
    await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known) values ($1, $2, 'botao', 'apagar', now(), true)`, [a.site, a.canal])
    const ins = `insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp) values ($1, 'serie', $2, $3, $4::date, 1, 0, $5, $5)`
    expect((await falha(ins, [a.site, DAILY, a.canal, MES, HEX('a')]))?.message).toBe('canal_removido')
    expect(await escalar(c, `select has_table_privilege('service_role', 'public.obs_archive_units', 'insert')`)).toBe(false)
  }))

  it('o service_role não chega ao core nem às internas (D22, K3)', async () => emTx(async () => {
    const tem = (f: string): Promise<boolean> => escalar<boolean>(c, `select has_function_privilege('service_role', $1::regprocedure, 'execute')`, [f])
    expect(await tem('public.obs_archive_record_core(uuid,text,jsonb,text)')).toBe(false)
    expect(await tem('public.obs_archive_record(uuid,text,jsonb)')).toBe(true)
    for (const f of ['public.obs_archive_seal(uuid,text,date)', 'public.obs_archive_insert_guard()', 'public.obs_archive_hoje_sp()', 'public.obs_archive_unit_due(uuid,text,text,uuid,date)']) expect(await tem(f), f).toBe(false)
  }))

  it('catálogo dos privilégios do service_role (R2-S1 do Yannis)', async () => emTx(async () => {
    const definidas = [...sqlM3bAte(3).matchAll(/create or replace function public\.(obs_archive_\w+)\(/g)].map(m => m[1]!)
    const com = (await c.query(`select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1::text[]) and has_function_privilege('service_role', p.oid, 'execute') order by 1`, [definidas])).rows.map(r => r.proname as string)
    // a lista fechada do que a aplicação chama, até a parte 3 (a Tarefa 11 completa o resto)
    expect(com).toEqual(['obs_archive_attest_nas', 'obs_archive_channel_units', 'obs_archive_content_hash', 'obs_archive_due_on', 'obs_archive_expected_units',
      'obs_archive_is_site_admin', 'obs_archive_manifest_rows', 'obs_archive_mark_redo', 'obs_archive_month_files', 'obs_archive_policy', 'obs_archive_read_unit',
      'obs_archive_receive', 'obs_archive_record', 'obs_archive_record_manifest', 'obs_archive_schema_fp', 'obs_archive_summary_rows', 'obs_archive_unit_part_info', 'obs_archive_unit_rehash'])
    const nossas = [...sqlM3bAte(3).matchAll(/create table if not exists public\.(obs_archive_\w+)/g)].map(m => m[1]!)
    expect(nossas).toHaveLength(15)
    for (const t of nossas) {
      for (const priv of ['insert', 'update', 'delete']) expect(await escalar(c, `select has_table_privilege('service_role', $1, $2)`, [`public.${t}`, priv]), `${t} ${priv}`).toBe(false)
    }
  }))

  it('P56: a marca do expurgo presa ao dono e à transação', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    const v1 = await unidadePelaRota({ site: a.site, classe: 'serie', tabela: DAILY, canal: a.canal, mes: MES })
    await c.query(`update public.obs_archive_units set dropped_at = now(), dropped_by = gen_random_uuid() where id = $1`, [v1.arquivo_id!.slice(2)])
    // (1) service_role não tem insert
    expect(await escalar(c, `select has_table_privilege('service_role', 'public.obs_archive_units', 'insert')`)).toBe(false)
    // (2) função de teste do dono, que fixa a marca e insere
    await c.query(`create or replace function public.m3b_teste_insere(p_site uuid, p_canal text, p_origem text) returns void language plpgsql security definer set search_path = '' as $$
      begin
        perform set_config('obs_archive.origem', case when p_origem = 'xid' then 'expurgo:' || pg_current_xact_id()::text else p_origem end, true);
        insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp)
        values (p_site, 'serie', 'competitor_video_daily', p_canal, '2026-10-01', 2, 0, repeat('a', 64), repeat('a', 64));
      end $$`)
    expect((await falha(`select public.m3b_teste_insere($1, $2, 'expurgo')`, [a.site, a.canal]))?.message).toBe('unidade_retirada')
    expect((await falha(`select public.m3b_teste_insere($1, $2, 'expurgo:1')`, [a.site, a.canal]))?.message).toBe('unidade_retirada')
    expect(await falha(`select public.m3b_teste_insere($1, $2, 'xid')`, [a.site, a.canal])).toBeNull()
  }))

  it('P56 (3) e (4): a marca é sobrescrita por texto vazio e o xid é o mesmo dentro de subtransação', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    const d = await unidadePelaRota({ site: a.site, classe: 'serie', tabela: DAILY, canal: a.canal, mes: MES })
    await c.query(`update public.obs_archive_units set dropped_at = now(), dropped_by = gen_random_uuid() where id = $1`, [d.arquivo_id!.slice(2)])
    await c.query(`select public.obs_archive_record_core($1, 'unidade', $2::jsonb, 'expurgo')`, [a.site, JSON.stringify({ ...d.payload, hash_conteudo: HEX('7') })])
    // a marca do _core ('expurgo:<xid>') não sobrevive à casca sem p_origem: o guarda recusa o insert (P56, 3)
    expect((await falha(`select public.obs_archive_record($1, 'unidade', $2::jsonb)`, [a.site, JSON.stringify({ ...d.payload, hash_conteudo: HEX('8') })]))?.message).toBe('unidade_retirada')
    const xid = await escalar<string>(c, `select pg_current_xact_id()::text`)
    const sub = await escalar<string>(c, `select (with q as (select 1) select pg_current_xact_id()::text)`)
    expect(sub).toBe(xid)
  }))

  it('attest com filho desmontado não grava nada', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31); SITE_DE_TESTE = a.site
    const { daily } = await unidadesDoCanal(a.site, a.canal)
    const antes = await q1(c, `select to_jsonb(u) as j from public.obs_archive_units u where id = $1`, [daily.arquivo_id!.slice(2)])
    const r = await attest(a.site, [{ arquivo_id: daily.arquivo_id, resultado: 'ausente' }], { montado: false })
    expect(r.itens[0]).toMatchObject({ resposta: 'recusado', motivo: 'filho_fora' })
    expect(await q1(c, `select to_jsonb(u) as j from public.obs_archive_units u where id = $1`, [daily.arquivo_id!.slice(2)])).toEqual(antes)
  }))

  it('unit/received de unidade com purged_at devolve canal_removido e não grava (item 159)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    const u = await unidadePelaRota({ site: a.site, classe: 'serie', tabela: DAILY, canal: a.canal, mes: MES })
    await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known, declared_xid)
      select distinct site_id, channel_ref, 'botao', 'apagar', now(), true, pg_current_xact_id() from public.obs_archive_units where site_id = $1 on conflict do nothing`, [a.site])
    await c.query(`update public.obs_archive_units set purged_at = now(), purged_by = gen_random_uuid(), purge_ref = 't' where id = $1`, [u.arquivo_id!.slice(2)])
    const r = await receber(a.site, [item(u)])
    expect(r.itens[0]?.resultado).toBe('canal_removido')
    expect(await escalar(c, `select received_at is null from public.obs_archive_units where id = $1`, [u.arquivo_id!.slice(2)])).toBe(true)
  }))

  it('part_info: só de versão não recebida; recebida ou ausente é nao_devida', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 2 }); await semearDiaria(c, a.videos, '2026-10-03', 29)
    const p = await unidadeEmPartes(a.site, a.canal)
    const info = async (parte: number): Promise<Record<string, unknown>> => (await c.query(`select public.obs_archive_unit_part_info($1, 'serie', $2, $3, $4::date, $5) as r`, [a.site, DAILY, a.canal, MES, parte])).rows[0].r
    expect(await info(2)).toMatchObject({ status: 'ok', unidade_id: p.id, versao: 1, partes: 2, de: 30, ate: 58, sha256: HEX('3') })
    await receber(a.site, [{ arquivo_id: `p:${p.id}:02`, sha256: HEX('3'), bytes: 500, linhas: 28, soma: '28000' }])
    expect(await info(2)).toEqual({ status: 'nao_devida' })
    expect(await info(7)).toEqual({ status: 'nao_devida' })
  }))

  it('o retorno REAL de obs_archive_record cabe em RespostaRecord e traz arquivo_id u:<uuid>, não unidade_id (Yannis 9)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    const u = await unidadePelaRota({ site: a.site, classe: 'serie', tabela: DAILY, canal: a.canal, mes: MES })
    expect(u.arquivo_id).toMatch(/^u:[0-9a-f-]{36}$/)
    const bruto = (await c.query(`select public.obs_archive_record($1, 'unidade', $2::jsonb) as r`, [a.site, JSON.stringify({ classe: 'serie', tabela: DAILY, canal: a.canal, mes: MES, row_count: 0, control_sum: null,
      hash_conteudo: HEX('f'), schema_fp: HEX('b'), sha256_bytes: '', csv_sha256: '', file_bytes: 0, partes: 1, min_key: null, max_key: null })])).rows[0].r
    expect(RespostaRecord.safeParse(bruto).success).toBe(true)
    expect(RespostaRecord.safeParse(u).success).toBe(true)
    expect((RespostaRecord.parse(bruto) as Record<string, unknown>).arquivo_id).toMatch(/^u:/)
    expect(bruto).not.toHaveProperty('unidade_id')
  }))

  it('payload sem canal ou sem mês não grava nem sai como canal_removido (Yannis 11)', async () => emTx(async () => {
    const a = await semearCanal(c, { videos: 1 })
    for (const p of [{ classe: 'serie', tabela: DAILY, mes: MES }, { classe: 'serie', tabela: DAILY, canal: a.canal }]) {
      expect((await falha(`select public.obs_archive_record($1, 'unidade', $2::jsonb)`, [a.site, JSON.stringify(p)]))?.message).toBe('payload_invalido')
    }
  }))

  it('par novo trava as linhas do mês ANTES de gravar a unidade (units -> months, for update; Yannis 5)', async () => emTx(async () => {
    const corpo = await escalar<string>(c, `select prosrc from pg_proc where proname = 'obs_archive_record_core' and pronamespace = 'public'::regnamespace`)
    const trava = corpo.search(/if v_novo_par then\s+perform 1 from public\.obs_archive_months m[^;]*order by m\.table_name for update;/)
    expect(trava).toBeGreaterThan(0)
    expect(trava).toBeLessThan(corpo.indexOf('insert into public.obs_archive_units'))
    expect(trava).toBeGreaterThan(corpo.indexOf('order by u.version desc limit 1 for update'))   // depois do lock da unidade: a ordem do receive
  }))

  it('hoje em São Paulo: sem o parâmetro de teste, vale o relógio (nunca um padrão que todo teste sobrescreve)', async () => emTx(async () => {
    await c.query(`select set_config('obs_archive.hoje', '', true)`)
    expect(await escalar<Date>(c, `select (now() at time zone 'America/Sao_Paulo')::date = public.obs_archive_hoje_sp()`)).toBe(true)
  }))

  // ---- as duas corridas: duas conexões, gravação de verdade num site próprio de cada rodada, apagado no fim ----
  describe.skipIf(!corridasLigadas())('corridas (duas conexões; só com M3B_CORRIDAS=1, confirmam e desfazem a parte 3)', () => {
    let a: Client, b: Client
    const sites: string[] = []
    beforeAll(async () => {
      await confirmarM3bParaCorridas(3)                                  // confirma no banco de integração e desfaz no afterAll (Yannis 1)
      a = new Client({ connectionString: PG_URL }); b = new Client({ connectionString: PG_URL })
      await Promise.all([a.connect(), b.connect()])
      for (const x of [c, a, b]) await x.query(`select set_config('obs_archive.hoje', '2026-11-28', false)`)
    })
    afterAll(async () => {
      for (const site of sites) {
        await c.query(`delete from public.obs_archive_unit_parts where unit_id in (select id from public.obs_archive_units where site_id = $1)`, [site])
        for (const t of ['obs_archive_units', 'obs_archive_summaries', 'obs_archive_months']) await c.query(`delete from public.${t} where site_id = $1`, [site])
        await c.query(`delete from public.competitor_video_daily where video_id in (select v.id from public.competitor_videos v join public.competitor_channels ch on ch.id = v.competitor_channel_id where ch.site_id = $1)`, [site])
        await c.query(`delete from public.competitor_videos where competitor_channel_id in (select id from public.competitor_channels where site_id = $1)`, [site])
        await apagarCanais(c, 'site_id = $1', [site])
        await apagarSites(c, 'id = $1', [site])
      }
      await Promise.all([a.end(), b.end()])
      await desfazerM3bDasCorridas()
    })
    async function siteNovo(): Promise<{ site: string; canal: string; videos: string[] }> {
      const s = await semearCanal(c, { site: randomUUID(), videos: 1 }); sites.push(s.site)
      await semearDiaria(c, s.videos, '2026-10-01', 31)
      return s
    }

    it('dois recebimentos simultâneos do último arquivo selam uma vez (Yannis I8)', async () => {
      for (let i = 0; i < 20; i++) {
        const s = await siteNovo()
        await unidadesDoCanal(s.site, s.canal)
        const r = await resumoPelaRota({ site: s.site, classe: 'serie', canal: s.canal, mes: MES }); await receber(s.site, r.arquivos)
        const m = await manifestoPelaRota({ site: s.site, classe: 'serie', mes: MES })
        await receber(s.site, [m.arquivos[0]!])
        const [x, y] = await Promise.all([receber(s.site, [m.arquivos[1]!], a), receber(s.site, [m.arquivos[1]!], b)])
        expect(x.selados.length + y.selados.length, `rodada ${i}`).toBe(1)
        expect(await escalar(c, `select count(*)::int from public.obs_archive_months where site_id = $1 and sealed_at is not null`, [s.site])).toBe(2)
      }
    }, 120_000)

    it('duas gravações da versão 1 ao mesmo tempo: uma nova, a outra mesma, nunca 23505 (Phil M6)', async () => {
      for (let i = 0; i < 20; i++) {
        const s = await siteNovo()
        const d = { site: s.site, classe: 'serie', tabela: DAILY, canal: s.canal, mes: MES }
        const [x, y] = await Promise.all([unidadePelaRota(d, a), unidadePelaRota(d, b)])
        expect([x.status, y.status].sort(), `rodada ${i}`).toEqual(['mesma', 'nova'])
        expect(await escalar(c, `select count(*)::int from public.obs_archive_units where site_id = $1 and table_name = $2`, [s.site, DAILY])).toBe(1)
      }
    }, 120_000)
  })
})
