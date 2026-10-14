// apps/web/test/integration/manutencao-m3b-plano.test.ts
// @vitest-environment node
/**
 * Manutenção M3b, parte 5 do SQL (plano M3b-site, Tarefa 7): o plano do copiador, o atraso, os vermelhos, a varredura completa, o batimento
 * e o pode-desligar. Banco: SÓ o `bythiago_int` (54422). Tudo em `begin … rollback`, menos o caso de dois planos simultâneos (duas conexões,
 * site próprio, apagado no fim). Relógios de teste: `obs_archive.hoje` (dia devido) e `obs_archive.agora` (B2).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID, createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { aplicarM2 } from '../helpers/m2'
import { aplicarM3b, corridasLigadas, confirmarM3bParaCorridas, desfazerM3bDasCorridas, escalar, q1, semearCanal, semearDiaria } from '../helpers/m3b'
import { M10A_SQL } from './video-antigo-m10a-caminho'
import { exportarUnidade } from '@/lib/youtube/observatorio/arquivo/exportar'
import { serializarResumo, type LinhasDoResumo } from '@/lib/youtube/observatorio/arquivo-mensal/resumo'
import { montarManifesto, type LinhasDoManifesto } from '@/lib/youtube/observatorio/arquivo-mensal/manifesto-mensal'
import { RespostaPlano } from '@/lib/youtube/observatorio/arquivo-mensal/contrato'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const MES = '2026-10-01'
const DAILY = 'competitor_video_daily'
const EARLY = 'competitor_video_early'
const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex')
const HEX = (n: string): string => n.repeat(64).slice(0, 64)
const FID = (n = 1): string => `4_z${n.toString(16).padStart(24, '0')}_f001_d20261029_m000000_c001_v0001`
const T = (hora: string, dia = '2026-11-29'): string => `${dia} ${hora}-03`

interface Lida { rows: Array<Array<string | null>>; row_count: string; control_sum: string | null; hash_conteudo: string; columns: Array<{ nome: string }>; schema_fp: string; first_key: string | null; last_key: string | null }
interface Gravada { status: string; arquivo_id?: string }
interface Item { arquivo_id: string; sha256: string; bytes: number; linhas: number | null; soma: string | null }
interface Exp { classe: string; tabela: string; canal: string; mes: string; motivo: string }
interface Plano {
  plano_id: string; modo: string; cursor_seguinte: string | null; primeira_selagem: string | null; vermelhos: string[]; canario: { dia: string }
  exportar: Exp[]; resumos: Array<{ classe: string; canal: string; mes: string }>; manifestos: Array<{ classe: string; mes: string }>
  aguardando_dono: Array<{ arquivo_id: string; b2_file_id_bom: string | null }>; a_apagar: Array<{ filho: string; caminho: string }>
  reconferir: Array<{ arquivo_id: string }>; prefixos_ausentes: unknown[]; erro?: string
}
interface PlanoB2 { execucao_id: string; arquivos: unknown[]; estado: { numerico: string; texto: string } }

describe.skipIf(skipIfNoLocalDb())('M3b parte 5: plano do copiador, atraso, vermelhos, varredura, batimento e pode-desligar', () => {
  let c: Client
  const sitesReais: string[] = []
  beforeAll(async () => {
    if (corridasLigadas()) await confirmarM3bParaCorridas(5)       // só para a corrida (M3B_CORRIDAS=1); desfeito no afterAll (Yannis 1)
    c = new Client({ connectionString: PG_URL }); await c.connect()
  })
  afterAll(async () => {
    for (const s of sitesReais) {
      await c.query(`delete from public.obs_archive_sweeps where site_id = $1`, [s])
      await c.query(`delete from public.obs_archive_heartbeat where site_id = $1`, [s])
    }
    await c.end()
    if (corridasLigadas()) await desfazerM3bDasCorridas()
  })

  async function emTx<T2>(fn: () => Promise<T2>, hoje = '2026-11-28'): Promise<T2> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')   // TRAVA_DDL_TESTES na 1ª instrução (Yannis R3-1)
    try {
      await aplicarM2(c)
      await c.query(readFileSync(M10A_SQL, 'utf8'))
      await aplicarM3b(c, 5)
      await c.query(`select set_config('obs_archive.hoje', $1, true)`, [hoje])
      await agora(T('12:00'))
      return await fn()
    } finally { await c.query('rollback') }
  }
  const agora = (ts: string): Promise<unknown> => c.query(`select set_config('obs_archive.agora', $1, true)`, [ts])
  const hoje = (d: string): Promise<unknown> => c.query(`select set_config('obs_archive.hoje', $1, true)`, [d])
  async function falha(sql: string, params: unknown[] = []): Promise<{ code: string; message: string } | null> {
    await c.query('savepoint f_pl')
    try { await c.query(sql, params); await c.query('release savepoint f_pl'); return null } catch (e) {
      await c.query('rollback to savepoint f_pl')
      const o = e as { code?: string; message?: string }
      return { code: o.code ?? '', message: o.message ?? '' }
    }
  }
  const plano = async (site: string, completo = false, cursor: string | null = null, cx: Client = c): Promise<Plano> =>
    (await cx.query(`select public.obs_archive_plan($1, $2, $3) as r`, [site, completo, cursor])).rows[0].r as Plano
  const atraso = async (site: string): Promise<{ amarelos: number; vermelhos: number; mais_antiga: string | null; meses_sem_selo: number }> =>
    (await c.query(`select public.obs_archive_atraso($1) as r`, [site])).rows[0].r
  const vermelhos = async (site: string): Promise<string[]> => (await c.query(`select public.obs_archive_vermelhos($1) as r`, [site])).rows[0].r as string[]
  const batida = async (site: string, worker: string, extra: Record<string, unknown> = {}): Promise<{ gravado: boolean; teto: string | null }> => {
    await c.query(`update public.obs_archive_heartbeat set updated_at = now() - interval '1 minute' where site_id = $1 and worker = $2`, [site, worker])
    const corpo = { versao: 'abc1234', hora_maquina: new Date().toISOString(), nas_ok: true, montagens_ok: { numerico: true, texto: true }, sentinela_ok: { numerico: true, texto: true },
      livre_bytes: { numerico: 500, texto: 500 }, total_bytes: { numerico: 1000, texto: 1000 }, parado_no_teto: null, ultimo_erro: null, ...extra }
    return (await c.query(`select public.obs_archive_heartbeat_write($1, $2, $3::jsonb) as r`, [site, worker, JSON.stringify(corpo)])).rows[0].r
  }

  // ---- a gravação pela rota (copiada da Tarefa 5) ----
  async function lidaCompleta(site: string, tabela: string, canal: string): Promise<Lida & { todas: Array<Array<string | null>> }> {
    const todas: Array<Array<string | null>> = []
    let primeira: Lida | null = null
    for (let off = 0; ; off += 1000) {
      const p = (await c.query(`select * from public.obs_archive_read_unit($1, 'serie', $2, $3, $4::date, $5, 1000)`, [site, tabela, canal, MES, off])).rows[0] as Lida
      primeira ??= p
      todas.push(...p.rows)
      if (off + 1000 >= Number(p.row_count)) break
    }
    return { ...primeira, todas }
  }
  async function unidade(site: string, tabela: string, canal: string, receber = true): Promise<{ status: string; item: Item | null; id: string }> {
    const l = await lidaCompleta(site, tabela, canal)
    const n = Number(l.row_count)
    const exp = await exportarUnidade({ ler: async () => ({ colunas: l.columns.map(x => x.nome), linhas: l.todas, contagem: n, soma: l.control_sum }) }, null,
      { tabela, canal, de: MES, ate: MES, rotulo: 'x', colunasDeOrdem: null })
    const payload = { classe: 'serie', tabela, canal, mes: MES, row_count: n, control_sum: l.control_sum, hash_conteudo: l.hash_conteudo, schema_fp: l.schema_fp,
      sha256_bytes: n ? exp.sha256 : '', csv_sha256: n ? exp.csvSha256 : '', file_bytes: n ? exp.bytes : 0, partes: 1, min_key: l.first_key, max_key: l.last_key }
    const r = (await c.query(`select public.obs_archive_record($1, 'unidade', $2::jsonb) as r`, [site, JSON.stringify(payload)])).rows[0].r as Gravada
    const item = n ? { arquivo_id: r.arquivo_id!, sha256: exp.sha256, bytes: exp.bytes, linhas: n, soma: l.control_sum } : null
    if (item && receber) await c.query(`select public.obs_archive_receive($1, $2::jsonb)`, [site, JSON.stringify([item])])
    return { status: r.status, item, id: r.arquivo_id!.slice(2) }
  }
  const receberItens = async (site: string, itens: Item[]): Promise<void> => { await c.query(`select public.obs_archive_receive($1, $2::jsonb)`, [site, JSON.stringify(itens)]) }
  /** O mês de série até o selo. Devolve os itens de todos os arquivos. */
  async function selar(site: string, canais: string[]): Promise<Item[]> {
    const todos: Item[] = []
    for (const canal of canais) for (const t of [DAILY, EARLY]) { const u = await unidade(site, t, canal); if (u.item) todos.push(u.item) }
    for (const canal of canais) {
      const rows = (await c.query(`select public.obs_archive_summary_rows($1, 'serie', $2, $3::date) as r`, [site, canal, MES])).rows[0].r as LinhasDoResumo
      const s = serializarResumo(rows)
      const por = (p: string) => s.arquivos.find(a => a.papel === p)
      const payload = { classe: 'serie', canal, mes: MES, vazio: s.vazio, unit_hashes: s.unit_hashes,
        canal_sha256: por('canal')?.sha256 ?? null, canal_bytes: por('canal')?.bytes ?? null, canal_rows: por('canal')?.linhas ?? null,
        video_sha256: por('video')?.sha256 ?? null, video_bytes: por('video')?.bytes ?? null, video_rows: por('video')?.linhas ?? null }
      const r = (await c.query(`select public.obs_archive_record($1, 'resumo', $2::jsonb) as r`, [site, JSON.stringify(payload)])).rows[0].r as Gravada
      if (!s.vazio) {
        const its = s.arquivos.map(a => ({ arquivo_id: `${r.arquivo_id}:${a.papel}`, sha256: a.sha256, bytes: a.bytes, linhas: a.linhas, soma: null }))
        await receberItens(site, its); todos.push(...its)
      }
    }
    const rows = (await c.query(`select public.obs_archive_manifest_rows($1, 'serie', $2::date) as r`, [site, MES])).rows[0].r as LinhasDoManifesto
    const m = montarManifesto(rows, site)
    await c.query(`select public.obs_archive_record_manifest($1, 'serie', $2::date, $3, $4, $5, $6, $7)`, [site, MES, rows.versao, sha(m.json), m.json.length, sha(m.lista), m.lista.length])
    const base = `m:serie:2026-10:v${rows.versao}`
    const mi: Item[] = [{ arquivo_id: `${base}:json`, sha256: sha(m.json), bytes: m.json.length, linhas: null, soma: null },
                        { arquivo_id: `${base}:sha256`, sha256: sha(m.lista), bytes: m.lista.length, linhas: null, soma: null }]
    await receberItens(site, mi); todos.push(...mi)
    return todos
  }
  async function mesSelado(videos = 2): Promise<{ site: string; canal: string; itens: Item[] }> {
    const a = await semearCanal(c, { site: randomUUID(), videos }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    const itens = await selar(a.site, [a.canal])
    return { site: a.site, canal: a.canal, itens }
  }
  /** n unidades de série recebidas, de canais fictícios, num mês selado (para paginar e para a varredura). */
  async function muitos(site: string, n: number): Promise<void> {
    await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, units_total, units_empty, rows_total, sealed_at, sealed_version, sealed_kind)
      values ($1, 'serie', $2, $3::date, $4::int, 0, ($4::int)::bigint, now() - interval '30 days', 1, 'com_dado')`, [site, DAILY, MES, n])
    await c.query(`insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, received_at, received_sha256, received_row_count)
      select $1, 'serie', $2, gen_random_uuid()::text, $3::date, 1, 1, md5(g::text) || md5(g::text), md5('s') || md5('s'), md5(g::text) || md5(g::text), md5('c') || md5('c'), 100, now() - interval '20 days', md5(g::text) || md5(g::text), 1
        from generate_series(1, $4::int) g`, [site, DAILY, MES, n])
  }
  const exportarDe = (p: Plano, classe: string): Exp[] => p.exportar.filter(x => x.classe === classe)

  it('devido depois da margem: 28/11 para a série de outubro, 15/12 para o texto (pela obs_archive_due_on)', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    await hoje('2026-11-27'); expect((await plano(a.site)).exportar).toEqual([])
    await hoje('2026-11-28')
    const p = await plano(a.site)
    expect(RespostaPlano.safeParse(p).success).toBe(true)
    expect(exportarDe(p, 'serie').map(x => [x.tabela, x.canal, x.mes, x.motivo])).toEqual([[DAILY, a.canal, '2026-10', 'nova'], [EARLY, a.canal, '2026-10', 'nova']])
    expect(exportarDe(p, 'texto')).toEqual([])
    await hoje('2026-12-14'); expect(exportarDe(await plano(a.site), 'texto')).toEqual([])
    await hoje('2026-12-15'); expect(exportarDe(await plano(a.site), 'texto').map(x => x.tabela).sort()).toEqual(['competitor_raw', 'competitor_video_comment_marks', 'competitor_video_comments'])
    expect(p.prefixos_ausentes).toEqual([]); expect(p.canario.dia).toBe('2026-11-28')
  }))

  it('canais devidos pela regra D14: cadastrados antes do fim do mês ou com linha; o rol do ensaio, inclusive sem linha (março de 2026 aparece)', async () => emTx(async () => {
    const site = randomUUID()
    const antes = await semearCanal(c, { site, videos: 1 })
    const tarde = await semearCanal(c, { site, videos: 0, addedAt: '2026-11-05T12:00:00Z' })
    const tardeComLinha = await semearCanal(c, { site, videos: 1, addedAt: '2026-11-05T12:00:00Z' }); await semearDiaria(c, tardeComLinha.videos, '2026-10-10', 3)
    const p = await plano(site)
    const daily = exportarDe(p, 'serie').filter(x => x.tabela === DAILY && x.mes === '2026-10').map(x => x.canal)
    expect(daily).toContain(antes.canal); expect(daily).toContain(tardeComLinha.canal); expect(daily).not.toContain(tarde.canal)
    expect(exportarDe(p, 'video_antigo')).toEqual([])
    // ensaio: o rol da carga (tabela de teste), inclusive o canal sem linha; sem o rol, só os com linha
    await c.query(`create table public.obs_archive_rehearsal_2026_03 partition of public.obs_archive_rehearsal for values from ('2026-03-01 00:00:00-03') to ('2026-04-01 00:00:00-03')`)
    await c.query(`create table public.obs_archive_rehearsal_seed (site_id uuid, month date, channel_ref text)`)
    await c.query(`insert into public.obs_archive_rehearsal (video_id, hour_slot, taken_at, site_id, views) values ($1, '2026-03-10 12:00:00-03', '2026-03-10 12:00:00-03', $2, 5)`, [antes.videos[0], site])
    await c.query(`insert into public.obs_archive_rehearsal_seed values ($1, '2026-03-01', $2), ($1, '2026-03-01', $3)`, [site, antes.canal, tarde.canal])
    const e = exportarDe(await plano(site), 'ensaio').filter(x => x.mes === '2026-03').map(x => x.canal).sort()
    expect(e).toEqual([antes.canal, tarde.canal].sort())
  }))

  it('o plano nunca pede mês fora do banco, mesmo com redo_reason (Phil C3)', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    const d = await unidade(a.site, DAILY, a.canal, false); await unidade(a.site, EARLY, a.canal)
    await c.query(`select public.obs_archive_mark_redo($1, 'parte_mudou')`, [d.id])
    expect(exportarDe(await plano(a.site), 'serie').map(x => x.tabela)).toContain(DAILY)
    await c.query(`update public.obs_archive_months set detached_at = now() where site_id = $1 and class = 'serie'`, [a.site])
    const p = await plano(a.site)
    expect(exportarDe(p, 'serie')).toEqual([]); expect(p.resumos.filter(r => r.classe === 'serie')).toEqual([])
  }))

  it('o início da classe é calculado uma vez (Phil M7) e o plano não pede mês anterior a ele (D13)', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    await plano(a.site)
    expect(await escalar(c, `select first_month::text from public.obs_archive_switch where site_id = $1 and class = 'serie'`, [a.site])).toBe('2026-10-01')
    await semearDiaria(c, a.videos, '2026-09-01', 20)                                  // uma linha mais antiga, semeada depois
    const p = await plano(a.site)
    expect(await escalar(c, `select first_month::text from public.obs_archive_switch where site_id = $1 and class = 'serie'`, [a.site])).toBe('2026-10-01')
    expect(p.exportar.every(x => x.mes >= '2026-10')).toBe(true)
  }))

  it('o atraso é do site (28): 6 dias amarelo, 31 vermelho e em vermelhos; o batimento não muda a medida', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    await plano(a.site)                                                                // grava o início da classe
    await hoje('2026-12-04')                                                          // 28/11 + 6
    const seis = await atraso(a.site)
    expect(seis.amarelos).toBe(3); expect(seis.vermelhos).toBe(0)                    // serie daily, early e horaria
    expect(seis.mais_antiga).toBe('2026-11-28')
    expect((await vermelhos(a.site)).some(v => v.startsWith('atraso de cópia'))).toBe(false)
    await hoje('2026-12-29')                                                          // 28/11 + 31
    await batida(a.site, 'copiador')
    const trinta = await atraso(a.site)
    expect(trinta.vermelhos).toBe(3)
    expect(await vermelhos(a.site)).toContain('atraso de cópia: 3 unidades há mais de 30 dias')
  }))

  it('o atraso conta o que não existe e o mês sem selo (Phil I6)', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    await unidade(a.site, DAILY, a.canal); await unidade(a.site, EARLY, a.canal)
    await hoje('2026-12-04')
    const itens = (await c.query(`select tipo, classe from public.obs_archive_atraso_itens($1) order by 1, 2`, [a.site])).rows
    expect(itens.filter(i => i.tipo === 'unidade' && i.classe === 'serie')).toEqual([])      // todas recebidas
    expect(itens.filter(i => i.tipo === 'mes' && i.classe === 'serie')).toHaveLength(1)      // e nenhum resumo: o mês espera o selo
    expect((await atraso(a.site)).meses_sem_selo).toBe(itens.filter(i => i.tipo === 'mes').length)
    await hoje('2026-12-29')
    expect((await vermelhos(a.site)).some(v => v.startsWith('mês sem selo há mais de 30 dias'))).toBe(true)
  }))

  it('resumos e manifestos pelo plano; canal sem unidade impede os dois (Phil C1); unidade nova em mês selado reabre', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    const b = await semearCanal(c, { site: a.site, videos: 1 }); await semearDiaria(c, b.videos, '2026-10-01', 31)
    await unidade(a.site, DAILY, a.canal); await unidade(a.site, EARLY, a.canal)
    let p = await plano(a.site)
    expect(p.resumos.filter(r => r.classe === 'serie').map(r => r.canal)).toEqual([a.canal])       // B ainda sem unidade
    expect(p.manifestos.filter(m => m.classe === 'serie')).toEqual([])
    await unidade(a.site, DAILY, b.canal); await unidade(a.site, EARLY, b.canal)
    p = await plano(a.site)
    expect(p.resumos.filter(r => r.classe === 'serie').map(r => r.canal).sort()).toEqual([a.canal, b.canal].sort())
    await selar(a.site, [a.canal, b.canal])
    p = await plano(a.site)
    expect(p.resumos.filter(r => r.classe === 'serie')).toEqual([]); expect(p.manifestos.filter(m => m.classe === 'serie')).toEqual([])
    const nova = await semearCanal(c, { site: a.site, videos: 1 }); await semearDiaria(c, nova.videos, '2026-10-01', 31)
    await unidade(a.site, DAILY, nova.canal)
    p = await plano(a.site)
    expect(p.manifestos.filter(m => m.classe === 'serie')).toEqual([])                             // falta a early do canal novo
    await unidade(a.site, EARLY, nova.canal)
    p = await plano(a.site)
    expect(p.resumos.filter(r => r.classe === 'serie').map(r => r.canal)).toEqual([nova.canal])
  }))

  it('unidade de canal removido nunca é devida; com arquivo ausente vem em aguardando_dono, com o b2_file_id_bom', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    const u = await unidade(a.site, DAILY, a.canal); await unidade(a.site, EARLY, a.canal)
    await c.query(`insert into public.obs_archive_b2_files (site_id, arquivo_id, class, month, last_ok_at, last_ok_file_id) values ($1, $2, 'serie', $3::date, now(), $4)`, [a.site, `u:${u.id}`, MES, FID(5)])
    await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known, declared_xid) values ($1, $2, 'e10_export', 'guardar', now(), true, pg_current_xact_id())`, [a.site, a.canal])
    await c.query(`delete from public.competitor_channels where id = $1`, [a.canal])
    expect((await plano(a.site)).aguardando_dono).toEqual([])                          // recebida e em dia no NAS: nada a procurar
    await c.query(`update public.obs_archive_units set nas_withdrawn_at = now(), nas_withdrawn_reason = 'ausente' where id = $1`, [u.id])
    const p = await plano(a.site)
    expect(p.exportar.filter(x => x.canal === a.canal)).toEqual([])
    expect(p.aguardando_dono).toHaveLength(1)
    expect(p.aguardando_dono[0]).toMatchObject({ arquivo_id: `u:${u.id}`, b2_file_id_bom: FID(5) })
  }))

  it('unidade expurgada exportada e não recebida vem em a_apagar, sob _recebendo/; há 31 dias, não (Phil M4)', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    const d = await unidade(a.site, DAILY, a.canal, false)
    await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known)
      select distinct site_id, channel_ref, 'botao', 'apagar', now(), true from public.obs_archive_units where site_id = $1 on conflict do nothing`, [a.site])
    await c.query(`update public.obs_archive_units set purged_at = now() - interval '1 day', purged_by = $2, purge_ref = 'teste' where id = $1`, [d.id, randomUUID()])
    const p = await plano(a.site)
    expect(p.a_apagar).toHaveLength(1)
    expect(p.a_apagar[0]!.caminho).toBe(`_recebendo/serie/canais/${a.canal}/${DAILY}/2026-10.v1.csv.gz`)
    await c.query(`update public.obs_archive_units set purged_at = now() - interval '31 days' where id = $1`, [d.id])
    expect((await plano(a.site)).a_apagar).toEqual([])
  }))

  it('reconferir traz todo mês selado sem dropped_at, pelos arquivos de obs_archive_month_files, a cada execução', async () => emTx(async () => {
    const { site, itens } = await mesSelado()
    const esperado = (await c.query(`select arquivo_id from public.obs_archive_month_files($1, 'serie', $2::date)`, [site, MES])).rows.map(r => r.arquivo_id as string).sort()
    expect(esperado).toEqual(itens.map(i => i.arquivo_id).sort())
    for (let n = 0; n < 2; n++) expect((await plano(site)).reconferir.map(x => x.arquivo_id).sort()).toEqual(esperado)
    await c.query(`update public.obs_archive_months set dropped_at = now() where site_id = $1 and class = 'serie'`, [site])
    const informe = async (quando: string | null): Promise<void> => {
      await c.query(`update public.obs_archive_units set nas_reported_at = $2::timestamptz where site_id = $1`, [site, quando])
      await c.query(`update public.obs_archive_summaries set nas_reported_at = $2::timestamptz where site_id = $1`, [site, quando])
      await c.query(`update public.obs_archive_months set manifest_nas_reported_at = $2::timestamptz where site_id = $1`, [site, quando])
    }
    await informe(null)
    expect((await plano(site)).reconferir.length).toBe(esperado.length)                // descartado sem informe do NAS: entra no rodízio
    await informe(new Date(Date.now() - 15 * 86400_000).toISOString())
    expect((await plano(site)).reconferir.length).toBe(esperado.length)                // relido há 15 dias: volta ao rodízio de 14
    await informe(new Date(Date.now() - 13 * 86400_000).toISOString())
    expect((await plano(site)).reconferir).toEqual([])                                 // relido há 13 dias: fora
  }))

  it('reconferir pagina sempre: 1.500 arquivos, página de 1.000 com cursor, a segunda com 500 e null (Yannis I5)', async () => emTx(async () => {
    const site = randomUUID()
    await muitos(site, 1500)
    const p1 = await plano(site)
    expect(p1.reconferir).toHaveLength(1000); expect(p1.cursor_seguinte).toBe(p1.reconferir[999]!.arquivo_id)
    expect(JSON.stringify(p1).length).toBeLessThan(4_000_000)
    const p2 = await plano(site, false, p1.cursor_seguinte)
    expect(p2.reconferir).toHaveLength(500); expect(p2.cursor_seguinte).toBeNull()
    expect(p2.exportar).toEqual([]); expect(p2.aguardando_dono).toEqual([]); expect(p2.vermelhos).toEqual([])
    expect(new Set([...p1.reconferir, ...p2.reconferir].map(x => x.arquivo_id)).size).toBe(1500)
    expect(p1.modo).toBe('normal')
    expect((await plano(site, false, 'x'.repeat(201))).erro).toBe('cursor_invalido')
  }))

  it('primeira_selagem: nula sem mês selado, 2026-10 depois do selo; nada a conferir no B2 vira nada_devido (M3a, K1)', async () => emTx(async () => {
    const vazio = await semearCanal(c, { site: randomUUID(), videos: 0 })
    expect((await plano(vazio.site)).primeira_selagem).toBeNull()
    const { site, itens } = await mesSelado()
    expect((await plano(site)).primeira_selagem).toBe('2026-10')
    for (const i of itens) await c.query(`insert into public.obs_archive_b2_files (site_id, arquivo_id, class, month, last_ok_at) values ($1, $2, 'serie', $3::date, public.obs_archive_agora())`, [site, i.arquivo_id, MES])
    const b2 = (await c.query(`select public.obs_archive_b2_plan($1, false, null) as r`, [site])).rows[0].r as PlanoB2
    expect(b2.arquivos).toEqual([]); expect(b2.estado.numerico).toBe('nada_devido')
  }))

  it('vermelhos (134): cada item entra quando acontece; âmbar não entra; nunca nulo', async () => emTx(async () => {
    const { site, itens } = await mesSelado()
    await agora(new Date().toISOString())                                              // o recebimento é de agora: nada atrasado
    expect(await vermelhos(site)).toEqual([])
    const u = itens.find(i => i.arquivo_id.startsWith('u:'))!
    const uid = u.arquivo_id.slice(2)
    // retirada do NAS e conteúdo divergente
    await c.query(`update public.obs_archive_units set nas_withdrawn_at = now(), nas_withdrawn_reason = 'ausente' where id = $1`, [uid])
    expect(await vermelhos(site)).toContain('NAS: 1 arquivos ausentes ou diferentes')
    await c.query(`update public.obs_archive_units set nas_withdrawn_reason = 'conteudo_divergente' where id = $1`, [uid])
    expect(await vermelhos(site)).toContain('conteúdo divergente em 1 arquivos')
    await c.query(`update public.obs_archive_units set nas_withdrawn_at = null, nas_withdrawn_reason = null where id = $1`, [uid])
    // retirada do B2
    await c.query(`update public.obs_archive_months set b2_withdrawn_at = now(), b2_withdrawn_reason = 'divergente', b2_withdrawn_via = 'forja' where site_id = $1 and table_name = $2`, [site, DAILY])
    expect(await vermelhos(site)).toContain('B2: 1 meses com a conferência retirada')
    await c.query(`update public.obs_archive_months set b2_withdrawn_at = null, b2_withdrawn_reason = null, b2_withdrawn_via = null where site_id = $1`, [site])
    // canário: dois dias é âmbar, seis é vermelho
    await c.query(`insert into public.obs_archive_canaries (site_id, filho, dia, sha256, informed_at) values ($1, 'numerico', '2026-11-27', $2, public.obs_archive_agora() - interval '2 days')`, [site, HEX('a')])
    expect((await vermelhos(site)).some(v => v.startsWith('canário'))).toBe(false)
    await c.query(`update public.obs_archive_canaries set informed_at = public.obs_archive_agora() - interval '6 days' where site_id = $1`, [site])
    expect(await vermelhos(site)).toContain('canário do filho numerico sem chegar ao B2 há 6 dias')
    await c.query(`update public.obs_archive_canaries set regravado_at = public.obs_archive_agora(), b2_ok_at = public.obs_archive_agora() where site_id = $1`, [site])
    expect(await vermelhos(site)).toContain('canario_regravado:numerico')
    // Phil M3: passados 30 dias o alarme fica até um canário NOVO do mesmo filho chegar ao B2 (evidência, não só relógio)
    await c.query(`update public.obs_archive_canaries set regravado_at = public.obs_archive_agora() - interval '40 days', b2_ok_at = public.obs_archive_agora() - interval '41 days' where site_id = $1`, [site])
    expect(await vermelhos(site)).toContain('canario_regravado:numerico')
    await c.query(`insert into public.obs_archive_canaries (site_id, filho, dia, sha256, informed_at, b2_ok_at) values ($1, 'texto', '2026-10-20', $2, public.obs_archive_agora() - interval '30 days', public.obs_archive_agora() - interval '30 days')`, [site, HEX('c')])
    expect(await vermelhos(site)).toContain('canario_regravado:numerico')               // canário de OUTRO filho não encerra
    await c.query(`insert into public.obs_archive_canaries (site_id, filho, dia, sha256, informed_at, b2_ok_at) values ($1, 'numerico', '2026-10-21', $2, public.obs_archive_agora() - interval '39 days', public.obs_archive_agora() - interval '39 days')`, [site, HEX('d')])
    expect(await vermelhos(site)).not.toContain('canario_regravado:numerico')           // um novo do mesmo filho, depois da regravação, encerra
    // ilegíveis
    await c.query(`update public.obs_archive_units set nas_unreadable_at = now() where id = $1`, [uid])
    expect(await vermelhos(site)).toContain(`nas_ilegivel:u:${uid}`)
    await c.query(`update public.obs_archive_units set nas_unreadable_at = null where id = $1`, [uid])
    await c.query(`insert into public.obs_archive_b2_files (site_id, arquivo_id, class, month, ilegivel_at) values ($1, $2, 'serie', $3::date, now())`, [site, u.arquivo_id, MES])
    expect(await vermelhos(site)).toContain(`b2_ilegivel:${u.arquivo_id}`)
    await c.query(`update public.obs_archive_b2_files set last_ok_at = now() + interval '1 second' where site_id = $1`, [site])
    expect((await vermelhos(site)).some(v => v.startsWith('b2_ilegivel'))).toBe(false)
    // recusa de fileId em 3 execuções seguidas
    for (let n = 0; n < 3; n++) await c.query(`insert into public.obs_archive_b2_runs (site_id, started_at, expires_at, modo, negative_name, negative_filho, canary_days, file_id_recusado)
      values ($1, public.obs_archive_agora() - make_interval(hours => $2::int), public.obs_archive_agora(), 'normal', '_controle/x', 'texto', '{}'::jsonb, true)`, [site, n + 1])
    expect(await vermelhos(site)).toContain('B2 recusou o fileId em 3 execuções seguidas')
    // 80% do NAS
    await batida(site, 'copiador', { total_bytes: { numerico: 100, texto: 100 }, livre_bytes: { numerico: 19, texto: 21 } })
    const v = await vermelhos(site)
    expect(v).toContain('nas_80:numerico'); expect(v).not.toContain('nas_80:texto')
    // tabela da política ausente
    await c.query(`alter table public.competitor_video_early rename to competitor_video_early_x`)
    expect(await vermelhos(site)).toContain('tabela_ausente:competitor_video_early')
    await c.query(`alter table public.competitor_video_early_x rename to competitor_video_early`)
    // piso do B2 acima do teto do mês
    await c.query(`update public.obs_archive_units set file_bytes = 700000000000 where id = $1`, [uid])
    expect(await vermelhos(site)).toContain('b2_piso_acima_do_teto')
  }))

  it('varredura aberta pelo batimento depois de casa desligada (172; Phil C2 da forja): batimento bom primeiro, plano depois', async () => emTx(async () => {
    const { site } = await mesSelado()
    await c.query(`update public.obs_archive_units set nas_reported_at = null where site_id = $1`, [site])        // nenhum informe do NAS: a varredura tem o que reler
    await c.query(`insert into public.obs_archive_heartbeat (site_id, worker, nas_ok, nas_checked_at, updated_at) values ($1, 'copiador', true, now() - interval '3 days', now() - interval '3 days')`, [site])
    const r = await batida(site, 'copiador')
    expect(r.gravado).toBe(true)
    const sw = await q1(c, `select motivo, due_since < now() - interval '2 days' as antigo, nas_back_at is not null as voltou, finished_at is null as aberta from public.obs_archive_sweeps where site_id = $1`, [site])
    expect(sw).toEqual({ motivo: 'silencio_nas', antigo: true, voltou: true, aberta: true })
    expect((await plano(site)).modo).toBe('completo')
    // sem nenhum batimento antes e sem unidade recebida: não abre
    const vazio = await semearCanal(c, { site: randomUUID(), videos: 0 })
    await batida(vazio.site, 'copiador')
    expect(await escalar(c, `select count(*)::int from public.obs_archive_sweeps where site_id = $1`, [vazio.site])).toBe(0)
    // sem batimento antes, com unidade recebida: abre
    const outro = await mesSelado()
    await c.query(`update public.obs_archive_units set nas_reported_at = null where site_id = $1`, [outro.site])
    await batida(outro.site, 'copiador')
    expect(await escalar(c, `select count(*)::int from public.obs_archive_sweeps where site_id = $1`, [outro.site])).toBe(1)
  }))

  it('silêncio e varredura são só do copiador (Pedido 6)', async () => emTx(async () => {
    const { site } = await mesSelado()
    await c.query(`insert into public.obs_archive_heartbeat (site_id, worker, nas_ok, nas_checked_at, updated_at) values ($1, 'copiador', true, now() - interval '25 hours', now() - interval '25 hours')`, [site])
    await batida(site, 'conferir_b2')
    await batida(site, 'respondedor')
    expect(await escalar(c, `select count(*)::int from public.obs_archive_sweeps where site_id = $1`, [site])).toBe(0)
    expect((await plano(site)).modo).toBe('completo')
    const sw = await q1(c, `select nas_checked_at < now() - interval '24 hours' as antigo from public.obs_archive_heartbeat where site_id = $1 and worker = 'copiador'`, [site])
    expect(sw.antigo).toBe(true)                                                       // o do copiador não mudou
    expect(await escalar(c, `select nas_checked_at is null from public.obs_archive_heartbeat where site_id = $1 and worker = 'conferir_b2'`, [site])).toBe(true)
  }))

  it.skipIf(!corridasLigadas())('uma varredura só com dois planos simultâneos (Yannis M12; duas conexões, só com M3B_CORRIDAS=1)', async () => {
    const site = randomUUID(); sitesReais.push(site)
    const b = new Client({ connectionString: PG_URL }); await b.connect()
    try {
      await c.query(`insert into public.obs_archive_heartbeat (site_id, worker, nas_ok, nas_checked_at, updated_at) values ($1, 'copiador', true, now() - interval '30 hours', now() - interval '30 hours')`, [site])
      const [x, y] = await Promise.all([plano(site, false, null, c), plano(site, false, null, b)])
      expect(x.modo).toBe('completo'); expect(y.modo).toBe('completo')
      expect(await escalar(c, `select count(*)::int from public.obs_archive_sweeps where site_id = $1 and finished_at is null`, [site])).toBe(1)
    } finally { await b.end() }
  })

  it('varredura completa (172): páginas, só as que faltam, termina quando todas foram relidas; purged_at não segura', async () => emTx(async () => {
    const site = randomUUID()
    await muitos(site, 1500)
    await c.query(`insert into public.obs_archive_heartbeat (site_id, worker, nas_ok, nas_checked_at, updated_at) values ($1, 'copiador', true, now() - interval '25 hours', now() - interval '25 hours')`, [site])
    const p1 = await plano(site)                                                       // o silêncio abre a varredura
    expect(p1.modo).toBe('completo'); expect(p1.reconferir).toHaveLength(1000); expect(p1.cursor_seguinte).not.toBeNull()
    const p2 = await plano(site, false, p1.cursor_seguinte)
    expect(p2.modo).toBe('completo'); expect(p2.reconferir).toHaveLength(500)
    expect(await escalar(c, `select started_at is not null and nas_back_at is null from public.obs_archive_sweeps where site_id = $1`, [site])).toBe(true)
    // o NAS volta (batimento bom): a volta fica registrada; a execução anterior foi cortada
    await batida(site, 'copiador')
    expect(await escalar(c, `select nas_back_at is not null from public.obs_archive_sweeps where site_id = $1 and finished_at is null`, [site])).toBe(true)
    await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known)
      select distinct site_id, channel_ref, 'botao', 'apagar', now(), true from public.obs_archive_units where site_id = $1 on conflict do nothing`, [site])
    await c.query(`update public.obs_archive_units set purged_at = now(), purged_by = $2, purge_ref = 'teste' where site_id = $1 and id in (select id from public.obs_archive_units where site_id = $1 order by id limit 5)`, [site, randomUUID()])   // expurgada: não segura
    await c.query(`update public.obs_archive_units set nas_reported_at = now() + interval '1 minute' where site_id = $1 and id in (select id from public.obs_archive_units where site_id = $1 and purged_at is null order by id limit 700)`, [site])
    const restantes = await plano(site)                                                // silêncio já < 24 h: continua só com as que faltam
    expect(restantes.modo).toBe('completo'); expect(restantes.reconferir).toHaveLength(795)
    await c.query(`update public.obs_archive_units set nas_reported_at = now() + interval '1 minute' where site_id = $1 and purged_at is null`, [site])
    const fim = await plano(site)
    expect(fim.modo).toBe('normal')
    expect(await escalar(c, `select finished_at is not null from public.obs_archive_sweeps where site_id = $1`, [site])).toBe(true)
  }))

  it('relógio da forja adiantado ou 23 h de silêncio: modo normal (172)', async () => emTx(async () => {
    const { site } = await mesSelado()
    await batida(site, 'copiador', { hora_maquina: new Date(Date.now() + 3 * 86400_000).toISOString() })
    expect((await plano(site)).modo).toBe('normal')
    await c.query(`update public.obs_archive_heartbeat set nas_checked_at = now() - interval '23 hours' where site_id = $1`, [site])
    expect((await plano(site)).modo).toBe('normal')
    expect((await plano(site, true)).modo).toBe('completo')                           // o pedido manual
  }))

  it('batimento: uma gravação por 30 s, hora do banco, nunca forja_heartbeat (30)', async () => emTx(async () => {
    const site = randomUUID()
    const antes = await escalar(c, `select count(*)::int from public.forja_heartbeat`)
    const corpo = JSON.stringify({ versao: 'v1', hora_maquina: '2020-01-01T00:00:00Z', nas_ok: true, montagens_ok: { numerico: true, texto: true }, sentinela_ok: { numerico: true, texto: true },
      livre_bytes: { numerico: 1, texto: 1 }, total_bytes: { numerico: 2, texto: 2 }, parado_no_teto: null, ultimo_erro: null })
    const um = (await c.query(`select public.obs_archive_heartbeat_write($1, 'copiador', $2::jsonb) as r`, [site, corpo])).rows[0].r
    const dois = (await c.query(`select public.obs_archive_heartbeat_write($1, 'copiador', $2::jsonb) as r`, [site, corpo])).rows[0].r
    expect(um).toEqual({ gravado: true, teto: null }); expect(dois).toEqual({ gravado: false, teto: null })
    const h = await q1(c, `select updated_at > now() - interval '1 minute' as agora, machine_time < '2021-01-01' as hora_da_forja from public.obs_archive_heartbeat where site_id = $1`, [site])
    expect(h).toEqual({ agora: true, hora_da_forja: true })
    expect(await escalar(c, `select count(*)::int from public.forja_heartbeat`)).toBe(antes)
    expect((await falha(`select public.obs_archive_heartbeat_write($1, 'outro', $2::jsonb)`, [site, corpo]))?.message).toBe('forma')
  }))

  it('batimento: total_bytes e os 80%; parado_no_teto do conferir_b2 gravado em stopped_at_cap (Pedido 5)', async () => emTx(async () => {
    const site = randomUUID()
    await batida(site, 'copiador', { total_bytes: { numerico: 100, texto: 100 }, livre_bytes: { numerico: 21, texto: 20 } })
    const v = await vermelhos(site)
    expect(v).not.toContain('nas_80:numerico'); expect(v).toContain('nas_80:texto')   // exatamente 80%
    await batida(site, 'conferir_b2', { parado_no_teto: 'dia' })
    expect(await escalar(c, `select stopped_at_cap from public.obs_archive_heartbeat where site_id = $1 and worker = 'conferir_b2'`, [site])).toBe('dia')
  }))

  it('teto de bytes: fronteira de dias seguidos (r2.2, M6 do Phil)', async () => emTx(async () => {
    const site = randomUUID()
    const execucao = async (dia: string, cap: 'dia' | null | 'sem'): Promise<{ teto: string | null; vermelhos: string[] }> => {
      await agora(T('10:00', dia))
      await c.query(`select public.obs_archive_b2_plan($1, false, null)`, [site])
      if (cap === 'sem') return { teto: null, vermelhos: await vermelhos(site) }      // execução de --prova: plano sem batimento
      const r = await batida(site, 'conferir_b2', { parado_no_teto: cap })
      return { teto: r.teto, vermelhos: await vermelhos(site) }
    }
    const d1 = await execucao('2026-12-01', 'dia')
    expect(d1.teto).toBe('ambar'); expect(d1.vermelhos).not.toContain('b2_teto_2_dias')
    const d2 = await execucao('2026-12-02', 'dia')
    expect(d2.teto).toBe('vermelho'); expect(d2.vermelhos).toContain('b2_teto_2_dias')
    const d3 = await execucao('2026-12-03', null)
    expect(d3.teto).toBe('verde'); expect(d3.vermelhos).not.toContain('b2_teto_2_dias')
    // não seguidos: dia 5 com teto, dia 6 sem execução, dia 7 com teto
    await execucao('2026-12-05', 'dia')
    const d7 = await execucao('2026-12-07', 'dia')
    expect(d7.teto).toBe('ambar')
    const prova = await execucao('2026-12-08', 'sem')                                    // a --prova não conta como dia sem estouro
    expect(await escalar(c, `select public.obs_archive_b2_teto_cor($1)`, [site])).toBe('ambar')
    expect(prova.vermelhos).not.toContain('b2_teto_2_dias')
    const copiador = await batida(site, 'copiador')
    expect(copiador.teto).toBeNull()
    // o segundo batimento em 10 s (gravado: false) ainda marca a execução e devolve a cor
    await agora(T('10:00', '2026-12-09'))
    await c.query(`select public.obs_archive_b2_plan($1, false, null)`, [site])
    const logo = (await c.query(`select public.obs_archive_heartbeat_write($1, 'conferir_b2', $2::jsonb) as r`, [site, JSON.stringify({ versao: 'v', hora_maquina: new Date().toISOString(), nas_ok: true,
      montagens_ok: { numerico: true, texto: true }, sentinela_ok: { numerico: true, texto: true }, livre_bytes: { numerico: 1, texto: 1 }, total_bytes: { numerico: 2, texto: 2 }, parado_no_teto: 'dia', ultimo_erro: null })])).rows[0].r
    expect(logo.gravado).toBe(false); expect(logo.teto).toBe('ambar')                       // dia 8 não teve batimento: o estouro de 7 e o de 9 não são seguidos
  }))

  it('completo atrasado (r2.2, I3 do Phil): aberto há 36 dias vermelho, 34 não; fechado ou aberto ontem não', async () => emTx(async () => {
    const site = randomUUID()
    const run = (desde: string, fechado: boolean, inicio: string) => c.query(`insert into public.obs_archive_b2_runs (site_id, started_at, expires_at, modo, negative_name, negative_filho, canary_days, completo_desde, completo_fechado_em)
      values ($1, public.obs_archive_agora() - $2::interval, public.obs_archive_agora(), 'completo', '_controle/x', 'texto', '{}'::jsonb, public.obs_archive_agora() - $3::interval, case when $4 then public.obs_archive_agora() end)`,
      [site, inicio, desde, fechado])
    await run('36 days', false, '1 day')
    expect((await vermelhos(site)).some(v => v.startsWith('b2_completo_atrasado'))).toBe(true)
    await c.query(`delete from public.obs_archive_b2_runs where site_id = $1`, [site])
    await run('34 days', false, '1 day')
    expect((await vermelhos(site)).some(v => v.startsWith('b2_completo_atrasado'))).toBe(false)
    await c.query(`delete from public.obs_archive_b2_runs where site_id = $1`, [site])
    await run('100 days', true, '100 days')
    expect((await vermelhos(site)).some(v => v.startsWith('b2_completo_atrasado'))).toBe(false)
    await run('1 day', false, '12 hours')                                              // aberto ontem, a última cobertura completa há 100 dias
    expect((await vermelhos(site)).some(v => v.startsWith('b2_completo_atrasado'))).toBe(false)
  }))

  it('b2_atrasado e descartado dos dois lados (N2 do Phil)', async () => emTx(async () => {
    const { site, itens } = await mesSelado()
    const t0 = (await c.query(`select (now() + interval '100 days')::text as t`)).rows[0].t as string
    const b2atrasado = async (dias: number): Promise<boolean> => {
      await agora((await c.query(`select (now() + make_interval(days => $1))::text as t`, [dias])).rows[0].t as string)
      return (await vermelhos(site)).some(v => v.startsWith('b2_atrasado'))
    }
    expect(await b2atrasado(7)).toBe(false); expect(await b2atrasado(8)).toBe(true)
    // descartado: NAS em dia, B2 numa data só
    await agora(t0)
    await c.query(`update public.obs_archive_months set dropped_at = $2::timestamptz where site_id = $1 and class = 'serie'`, [site, t0])
    const nas = (quando: string) => Promise.all([
      c.query(`update public.obs_archive_units set nas_reported_at = $2::timestamptz where site_id = $1`, [site, quando]),
      c.query(`update public.obs_archive_summaries set nas_reported_at = $2::timestamptz where site_id = $1`, [site, quando]),
      c.query(`update public.obs_archive_months set manifest_nas_reported_at = $2::timestamptz where site_id = $1`, [site, quando])])
    const b2 = async (quando: string, um: string | null = null): Promise<void> => {
      await c.query(`delete from public.obs_archive_b2_files where site_id = $1`, [site])
      for (const [n, i] of itens.entries()) await c.query(`insert into public.obs_archive_b2_files (site_id, arquivo_id, class, month, last_ok_at) values ($1, $2, 'serie', $3::date, $4::timestamptz)`,
        [site, i.arquivo_id, MES, n === 0 && um ? um : quando])
    }
    const conta = async (d: number): Promise<number> => escalar(c, `select public.obs_archive_descartados_sem_releitura($1, $2)`, [site, d])
    await nas(t0)
    await b2(t0, (await c.query(`select ($1::timestamptz - interval '45 days')::text as t`, [t0])).rows[0].t); expect(await conta(45)).toBe(0)
    await b2(t0, (await c.query(`select ($1::timestamptz - interval '46 days')::text as t`, [t0])).rows[0].t); expect(await conta(45)).toBe(1)
    expect((await vermelhos(site)).some(v => v.startsWith('mês descartado sem releitura há mais de 45 dias'))).toBe(true)
    expect(await conta(21)).toBe(1)
    await b2(t0, (await c.query(`select ($1::timestamptz - interval '21 days')::text as t`, [t0])).rows[0].t); expect(await conta(21)).toBe(0)
    await b2(t0, (await c.query(`select ($1::timestamptz - interval '22 days')::text as t`, [t0])).rows[0].t); expect(await conta(21)).toBe(1)
    // o inverso: B2 em dia, NAS há 46 dias em um arquivo
    await b2(t0)
    await nas((await c.query(`select ($1::timestamptz - interval '46 days')::text as t`, [t0])).rows[0].t)
    expect(await conta(45)).toBe(1)
  }))

  it('pode_desligar: mes_nao_recebido, b2_vencido_mes_fora, automatico_armado; sem nada, pode (C11)', async () => emTx(async () => {
    const { site } = await mesSelado()
    const ler = async (): Promise<{ pode: boolean; faltam: Array<{ motivo: string }> }> => (await c.query(`select public.obs_archive_pode_desligar($1) as r`, [site])).rows[0].r
    expect(await ler()).toEqual({ pode: true, faltam: [] })
    await c.query(`update public.obs_archive_units set received_at = null where site_id = $1 and row_count > 0`, [site])
    let r = await ler(); expect(r.pode).toBe(false); expect(r.faltam.map(f => f.motivo)).toContain('mes_nao_recebido')
    await c.query(`update public.obs_archive_units set received_at = now() where site_id = $1`, [site])
    expect((await ler()).pode).toBe(true)
    await c.query(`update public.obs_archive_months set dropped_at = now() where site_id = $1 and class = 'serie'`, [site])
    r = await ler(); expect(r.faltam.map(f => f.motivo)).toContain('b2_vencido_mes_fora')    // nunca conferido no B2
    await c.query(`update public.obs_archive_months set dropped_at = null where site_id = $1`, [site])
    await c.query(`insert into public.obs_archive_switch (site_id, class, armed_at, expires_at) values ($1, 'horaria', now(), now() + interval '1 day') on conflict (site_id, class) do update set armed_at = now(), expires_at = now() + interval '1 day', disarmed_at = null`, [site])
    r = await ler(); expect(r.faltam.map(f => f.motivo)).toContain('automatico_armado')
    expect(await escalar(c, `select has_function_privilege('postgres', 'public.obs_archive_pode_desligar(uuid)', 'execute')`)).toBe(true)
  }))

  it('despausar um canal não toca o registro (29): competitor_channel_unpause, da E10 (Yannis 4)', async (ctx) => {
    // sem skip incondicional: a função certa é competitor_channel_unpause(uuid,uuid,uuid); só pula se o banco não a tiver
    if (await escalar<boolean>(c, `select to_regprocedure('public.competitor_channel_unpause(uuid,uuid,uuid)') is null`)) ctx.skip()
    await emTx(async () => {
      const { site, canal } = await mesSelado()
      const registro = async (): Promise<string> => JSON.stringify((await c.query(`select
        (select count(*) from public.obs_archive_units where site_id = $1) u, (select count(*) from public.obs_archive_summaries where site_id = $1) s,
        (select count(*) from public.obs_archive_months where site_id = $1) m, (select md5(string_agg(id::text || coalesce(received_at::text, ''), ',' order by id)) from public.obs_archive_units where site_id = $1) h,
        (select md5(string_agg(sealed_at::text, ',' order by class, table_name, month)) from public.obs_archive_months where site_id = $1) sm`, [site])).rows[0])
      const antes = await registro()
      const faceDoPlano = async (): Promise<string> => { const p = await plano(site); return JSON.stringify([p.exportar, p.resumos, p.manifestos, p.reconferir, p.aguardando_dono]) }
      const planoAntes = await faceDoPlano()
      const org = (await c.query(`select org_id from public.sites where id = $1`, [site])).rows[0].org_id as string
      const ator = randomUUID()
      await c.query(`insert into auth.users (id, instance_id, aud, role, email) values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2)`, [ator, `m3b-${ator}@t.test`])
      await c.query(`insert into public.organization_members (org_id, user_id, role) values ($1, $2, 'org_admin')`, [org, ator])
      // pausa plantada direto (competitor_channel_pause recusa quando a M10a recria competitor_series_health sem o remendo da pausa: assunto da A5)
      await c.query(`update public.competitor_channels set collection_paused_at = now() - interval '1 hour', collection_paused_by = $2 where id = $1`, [canal, ator])
      await c.query(`insert into public.competitor_collection_pauses (site_id, competitor_channel_id, paused_at, paused_by) values ($1, $2, now() - interval '1 hour', $3)`, [site, canal, ator])
      expect((await c.query(`select public.competitor_channel_unpause($1, $2, $3) as r`, [site, canal, ator])).rows[0].r).toMatchObject({ status: expect.any(String) })
      expect(await escalar(c, `select collection_paused_at is null from public.competitor_channels where id = $1`, [canal])).toBe(true)
      expect(await registro()).toBe(antes)                                                // o registro da M3b não mudou
      expect(await faceDoPlano()).toBe(planoAntes)                                        // e o plano do copiador continua o mesmo
    })
  })

  it('as constantes do atraso nos dois lados (5 e 30) e o texto dos vermelhos sem nome de canal', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    await plano(a.site)
    for (const [d, am, ve] of [['2026-12-03', 0, 0], ['2026-12-04', 3, 0], ['2026-12-28', 6, 0], ['2026-12-29', 3, 3]] as const) {   // série devida em 28/11 (3 unidades): 5 dias neutro, 6 amarelo, 30 amarelo, 31 vermelho; o texto (15/12, 3 tabelas) entra amarelo a partir de 21/12
      await hoje(d)
      const r = await atraso(a.site)
      expect([r.amarelos, r.vermelhos]).toEqual([am, ve])
    }
    expect((await vermelhos(a.site)).join('|')).not.toContain(a.canal)
  }))

  it('catálogo de privilégios da parte 5 e a conta do devido nas funções do plano, do atraso e dos vermelhos (D19, D20)', async () => emTx(async () => {
    const priv = async (f: string, quem: string): Promise<boolean> => escalar(c, `select has_function_privilege($1, $2, 'execute')`, [quem, f])
    for (const f of ['obs_archive_plan(uuid,boolean,text)', 'obs_archive_atraso(uuid)', 'obs_archive_vermelhos(uuid)', 'obs_archive_heartbeat_write(uuid,text,jsonb)', 'obs_archive_pode_desligar(uuid)']) {
      expect(await priv(`public.${f}`, 'service_role'), f).toBe(true)
      for (const q of ['anon', 'authenticated']) expect(await priv(`public.${f}`, q), `${f} ${q}`).toBe(false)
    }
    for (const f of ['obs_archive_b2_teto_cor(uuid)', 'obs_archive_first_month(uuid,text)', 'obs_archive_meses_devidos(uuid,boolean)', 'obs_archive_resumo_devido(uuid,text,date,text)',
                     'obs_archive_nas_cobertura(uuid)', 'obs_archive_atraso_itens(uuid)', 'obs_archive_descartados_sem_releitura(uuid,integer)', 'obs_archive_b2_atrasados(uuid,integer)'])
      for (const q of ['service_role', 'anon', 'authenticated']) expect(await priv(`public.${f}`, q), `${f} ${q}`).toBe(false)
    const corpoDe = async (nome: string): Promise<string> => ((await c.query(`select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1`, [nome])).rows[0]?.prosrc as string | undefined) ?? ''
    for (const f of ['obs_archive_meses_devidos', 'obs_archive_atraso_itens']) expect(await corpoDe(f), f).toContain('obs_archive_due_on')
    expect(await corpoDe('obs_archive_atraso_itens')).toContain('obs_archive_expected_units')
    expect(await corpoDe('obs_archive_plan')).toContain('obs_archive_expected_units')
    expect(await corpoDe('obs_archive_atraso')).toContain('obs_archive_atraso_itens')
    expect(await corpoDe('obs_archive_vermelhos')).toContain('obs_archive_atraso_itens')
    expect(await corpoDe('obs_archive_plan')).toContain('obs_archive_meses_devidos')
  }))
})
