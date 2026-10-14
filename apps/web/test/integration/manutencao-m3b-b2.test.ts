// apps/web/test/integration/manutencao-m3b-b2.test.ts
// @vitest-environment node
/**
 * Manutenção M3b, parte 4 do SQL (plano M3b-site, Tarefa 6): a conferência do B2 pela forja, o controle negativo, o canário e o fileId bom.
 * Banco: SÓ o `bythiago_int` (54422), tudo em `begin … rollback`. O relógio do B2 é `obs_archive.agora` (gancho de teste declarado).
 * Os vermelhos (`b2_ilegivel`, `b2_piso_acima_do_teto`, recusa de fileId em 3 execuções) são afirmados em manutencao-m3b-plano.test.ts (Tarefa 7).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID, createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { aplicarM2 } from '../helpers/m2'
import { aplicarM3b, escalar, q1, semearCanal, semearDiaria } from '../helpers/m3b'
import { M10A_SQL } from './video-antigo-m10a-caminho'
import { exportarUnidade } from '@/lib/youtube/observatorio/arquivo/exportar'
import { serializarResumo, type LinhasDoResumo } from '@/lib/youtube/observatorio/arquivo-mensal/resumo'
import { montarManifesto, type LinhasDoManifesto } from '@/lib/youtube/observatorio/arquivo-mensal/manifesto-mensal'
import { RespostaPlanoB2, RespostaAtestarB2 } from '@/lib/youtube/observatorio/arquivo-mensal/contrato'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const MES = '2026-10-01'
const DAILY = 'competitor_video_daily'
const EARLY = 'competitor_video_early'
const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex')
const HEX = (n: string): string => n.repeat(64).slice(0, 64)
const FID = (n = 1): string => `4_z${n.toString(16).padStart(24, '0')}_f001_d20261029_m000000_c001_v0001`
const T = (hora: string, dia = '2026-11-29'): string => `${dia} ${hora}-03`
const CAN_NUM = HEX('a')
const CAN_TEX = HEX('b')

interface Lida { rows: Array<Array<string | null>>; row_count: string; control_sum: string | null; hash_conteudo: string; columns: Array<{ nome: string }>; schema_fp: string; first_key: string | null; last_key: string | null }
interface Gravada { status: string; arquivo_id?: string; versao?: number }
interface Unidade extends Gravada { sha256: string; bytes: number; soma: string | null; linhas: number }
interface Item { arquivo_id: string; sha256: string; bytes: number; linhas: number | null; soma: string | null }
interface Plano {
  execucao_id: string; modo: string; cursor_seguinte: string | null; retomado_de: string | null; cobertura: { paginas_aceitas: number; paginas_total: number } | null
  estado: { numerico: string; texto: string }; arquivos: Array<{ arquivo_id: string; filho: string; tipo: string }>; teto_bytes_dia: number; teto_bytes_mes: number
  controle_negativo: { caminho: string; filho: string }; canarios: Array<{ arquivo_id: string; caminho: string | null }>; primeira_selagem: string | null; vermelhos: string[]; erro?: string
}
interface Resp { execucao: { estado: string; negativo_ok: boolean; canario_ok: { numerico: boolean; texto: boolean } }; itens: Array<{ arquivo_id: string; resposta: string; motivo?: string }> }

describe.skipIf(skipIfNoLocalDb())('M3b parte 4: conferência do B2 pela forja', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c.end() })

  async function emTx<T2>(fn: () => Promise<T2>): Promise<T2> {
    await c.query('begin')
    try {
      await aplicarM2(c)
      await c.query(readFileSync(M10A_SQL, 'utf8'))
      await aplicarM3b(c, 4)
      await c.query(`select set_config('obs_archive.hoje', '2026-11-28', true)`)
      await agora(T('12:00'))
      return await fn()
    } finally { await c.query('rollback') }
  }
  const agora = (ts: string): Promise<unknown> => c.query(`select set_config('obs_archive.agora', $1, true)`, [ts])
  async function falha(sql: string, params: unknown[] = []): Promise<{ code: string; message: string } | null> {
    await c.query('savepoint f_b2')
    try { await c.query(sql, params); await c.query('release savepoint f_b2'); return null } catch (e) {
      await c.query('rollback to savepoint f_b2')
      const o = e as { code?: string; message?: string }
      return { code: o.code ?? '', message: o.message ?? '' }
    }
  }

  // ---- a gravação da série pela rota (copiado da Tarefa 5) ----
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
  async function unidade(site: string, tabela: string, canal: string): Promise<Unidade> {
    const l = await lidaCompleta(site, tabela, canal)
    const n = Number(l.row_count)
    const exp = await exportarUnidade({ ler: async () => ({ colunas: l.columns.map(x => x.nome), linhas: l.todas, contagem: n, soma: l.control_sum }) }, null,
      { tabela, canal, de: MES, ate: MES, rotulo: 'x', colunasDeOrdem: null })
    const payload = { classe: 'serie', tabela, canal, mes: MES, row_count: n, control_sum: l.control_sum, hash_conteudo: l.hash_conteudo, schema_fp: l.schema_fp,
      sha256_bytes: n ? exp.sha256 : '', csv_sha256: n ? exp.csvSha256 : '', file_bytes: n ? exp.bytes : 0, partes: 1, min_key: l.first_key, max_key: l.last_key }
    const r = (await c.query(`select public.obs_archive_record($1, 'unidade', $2::jsonb) as r`, [site, JSON.stringify(payload)])).rows[0].r as Gravada
    return { ...r, sha256: exp.sha256, bytes: exp.bytes, soma: l.control_sum, linhas: n }
  }
  const receber = async (site: string, itens: Item[]): Promise<void> => { await c.query(`select public.obs_archive_receive($1, $2::jsonb)`, [site, JSON.stringify(itens)]) }
  /** O mês de série inteiro até o selo; devolve os itens (com sha256 e linhas) de todos os arquivos do mês. */
  async function selar(site: string, canais: string[]): Promise<Item[]> {
    const todos: Item[] = []
    for (const canal of canais) for (const t of [DAILY, EARLY]) {
      const u = await unidade(site, t, canal)
      if (u.linhas > 0) { const i = { arquivo_id: u.arquivo_id!, sha256: u.sha256, bytes: u.bytes, linhas: u.linhas, soma: u.soma }; await receber(site, [i]); todos.push(i) }
    }
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
        await receber(site, its); todos.push(...its)
      }
    }
    const rows = (await c.query(`select public.obs_archive_manifest_rows($1, 'serie', $2::date) as r`, [site, MES])).rows[0].r as LinhasDoManifesto
    const m = montarManifesto(rows, site)
    await c.query(`select public.obs_archive_record_manifest($1, 'serie', $2::date, $3, $4, $5, $6, $7)`, [site, MES, rows.versao, sha(m.json), m.json.length, sha(m.lista), m.lista.length])
    const base = `m:serie:2026-10:v${rows.versao}`
    const mi: Item[] = [{ arquivo_id: `${base}:json`, sha256: sha(m.json), bytes: m.json.length, linhas: null, soma: null },
                        { arquivo_id: `${base}:sha256`, sha256: sha(m.lista), bytes: m.lista.length, linhas: null, soma: null }]
    await receber(site, mi); todos.push(...mi)
    return todos
  }
  /** Um site com um canal e o mês de série de outubro selado. */
  async function mesSelado(): Promise<{ site: string; canal: string; itens: Item[] }> {
    const a = await semearCanal(c, { site: randomUUID(), videos: 2 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    const itens = await selar(a.site, [a.canal])
    expect(await escalar(c, `select count(*)::int from public.obs_archive_months where site_id = $1 and class = 'serie' and sealed_at is not null`, [a.site])).toBeGreaterThan(0)
    return { site: a.site, canal: a.canal, itens }
  }
  /** 1.200 (ou n) unidades de série recebidas, de canais fictícios, num mês selado: só para paginar. */
  async function muitos(site: string, n: number): Promise<void> {
    await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, units_total, units_empty, rows_total, sealed_at, sealed_version, sealed_kind)
      values ($1, 'serie', $2, $3::date, $4::int, 0, ($4::int)::bigint, now() - interval '30 days', 1, 'com_dado')`, [site, DAILY, MES, n])
    await c.query(`insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, received_at, received_sha256, received_row_count)
      select $1, 'serie', $2, gen_random_uuid()::text, $3::date, 1, 1, md5(g::text) || md5(g::text), md5('s') || md5('s'), md5(g::text) || md5(g::text), md5('c') || md5('c'), 100, now() - interval '20 days', md5(g::text) || md5(g::text), 1
        from generate_series(1, $4::int) g`, [site, DAILY, MES, n])
  }
  async function canarios(site: string, informadoEm = T('02:00'), dia = '2026-11-28'): Promise<void> {
    await c.query(`insert into public.obs_archive_canaries (site_id, filho, dia, sha256, informed_at) values ($1, 'numerico', $2::date, $3, $5::timestamptz), ($1, 'texto', $2::date, $4, $5::timestamptz)
      on conflict (site_id, filho, dia) do nothing`, [site, dia, CAN_NUM, CAN_TEX, informadoEm])
  }
  const plano = async (site: string, completo = false, cursor: string | null = null): Promise<Plano> =>
    (await c.query(`select public.obs_archive_b2_plan($1, $2, $3) as r`, [site, completo, cursor])).rows[0].r as Plano
  const informar = async (site: string, run: string, itens: unknown[]): Promise<Resp> => {
    const r = (await c.query(`select public.obs_archive_attest_b2($1, $2::jsonb) as r`, [site, JSON.stringify({ fonte: 'b2', execucao_id: run, itens })])).rows[0].r as Resp
    expect(RespostaAtestarB2.safeParse(r).success).toBe(true)
    return r
  }
  const NEG = { arquivo_id: 'controle_negativo', resultado: 'ausente' }
  const canOk = (filho: 'numerico' | 'texto'): Record<string, unknown> =>
    ({ arquivo_id: `canario:${filho}`, resultado: 'presente', sha256: filho === 'numerico' ? CAN_NUM : CAN_TEX, file_id: FID(7), upload_timestamp: 1_760_000_000_000 })
  const controle = (site: string, run: string): Promise<Resp> => informar(site, run, [NEG, canOk('numerico'), canOk('texto')])
  /** Plano normal com o controle já aceito. */
  async function aberto(site: string, completo = false): Promise<Plano> {
    await canarios(site)
    const p = await plano(site, completo)
    const r = await controle(site, p.execucao_id)
    expect(r.execucao.estado).toBe('controle_ok')
    return p
  }
  const presente = (i: Item, n = 1, extra: Record<string, unknown> = {}): Record<string, unknown> =>
    ({ arquivo_id: i.arquivo_id, resultado: 'presente', sha256: i.sha256, linhas: i.linhas, soma: i.soma, file_id: FID(n), upload_timestamp: 1_760_000_000_000, tentativa: 1, ...extra })
  const errado = (i: Item, n = 1, sh = HEX('e')): Record<string, unknown> => presente(i, n, { sha256: sh })
  const mes = async (site: string): Promise<Record<string, unknown>> =>
    q1(c, `select b2_attested_at, b2_attested_via, b2_forja_ok_at, b2_dono_ok_at, b2_withdrawn_at, b2_withdrawn_via, b2_withdrawn_reason, b2_last_attempt_result, b2_forja_diverged_at
             from public.obs_archive_months where site_id = $1 and class = 'serie' and table_name = $2 and month = $3::date`, [site, DAILY, MES])
  const arq = async (site: string, id: string): Promise<Record<string, unknown>> =>
    q1(c, `select last_ok_at, last_ok_file_id, last_attempt_result, pending_mismatch, ilegivel_at from public.obs_archive_b2_files where site_id = $1 and arquivo_id = $2`, [site, id])
  const unidDaily = (itens: Item[]): Item => itens.find(i => i.arquivo_id.startsWith('u:'))!
  const idsMes = async (site: string): Promise<string[]> =>
    (await c.query(`select arquivo_id from public.obs_archive_month_files($1, 'serie', $2::date) order by arquivo_id collate "C"`, [site, MES])).rows.map(r => r.arquivo_id as string)

  it('o plano do B2 nunca traz hash esperado e a resposta cabe no esquema (132, modo normal)', async () => emTx(async () => {
    const { site, itens } = await mesSelado()
    await canarios(site)
    const p = await plano(site)
    for (const chave of ['sha256', 'row_count', 'control_sum', 'hash_conteudo', 'linhas', 'soma'])
      expect(await escalar(c, `select jsonb_path_exists($1::jsonb, '$.**.${chave}')`, [JSON.stringify(p)])).toBe(false)
    expect(p.arquivos.map(a => a.arquivo_id).sort()).toEqual(itens.map(i => i.arquivo_id).sort())
    const lido = RespostaPlanoB2.safeParse(p)
    expect(lido.success).toBe(true)
    expect(p.modo).toBe('normal'); expect(p.retomado_de).toBeNull(); expect(p.cobertura).toBeNull()
    const run = await q1(c, `select completo_desde, retomado_de, paginas_total, cursor_aceito, paginas_aceitas, paginas from public.obs_archive_b2_runs where id = $1`, [p.execucao_id])
    expect(run).toEqual({ completo_desde: null, retomado_de: null, paginas_total: null, cursor_aceito: null, paginas_aceitas: 0, paginas: [] })
  }))

  it('informe de arquivo antes do controle: recusado; o canário do outro filho não basta (132, Phil I3)', async () => emTx(async () => {
    const { site, itens } = await mesSelado(); await canarios(site)
    const u = unidDaily(itens)
    const p = await plano(site)
    const antes = await informar(site, p.execucao_id, [presente(u)])
    expect(antes.itens[0]).toMatchObject({ resposta: 'recusado', motivo: 'controle_pendente' })
    expect(await escalar(c, `select count(*)::int from public.obs_archive_b2_files where site_id = $1`, [site])).toBe(0)
    await informar(site, p.execucao_id, [NEG, canOk('texto')])                     // o arquivo é do filho numérico
    const depois = await informar(site, p.execucao_id, [presente(u)])
    expect(depois.itens[0]).toMatchObject({ resposta: 'recusado', motivo: 'controle_pendente' })
    expect(depois.execucao.estado).toBe('aguardando_controle')
  }))

  it('negativo sem acesso (ou chave ausente) deixa o controle pendente, nunca controle_falhou (Phil I3)', async () => emTx(async () => {
    const { site, itens } = await mesSelado(); await canarios(site)
    for (const resultado of ['sem_acesso', 'chave_ausente']) {
      const p = await plano(site)
      const r = await informar(site, p.execucao_id, [{ arquivo_id: 'controle_negativo', resultado }])
      expect(r.itens[0]).toMatchObject({ resposta: 'aceito' })
      expect(r.execucao).toMatchObject({ estado: 'aguardando_controle', negativo_ok: false })
      const dep = await informar(site, p.execucao_id, [presente(unidDaily(itens))])
      expect(dep.itens[0]).toMatchObject({ resposta: 'recusado', motivo: 'controle_pendente' })
      await agora(T('12:01'))                                                       // a execução seguinte tem started_at próprio
    }
  }))

  it('negativo presente sem sha256 é aceito na forma e dá controle_falhou (Pedido 10)', async () => emTx(async () => {
    const { site, itens } = await mesSelado(); await canarios(site)
    const p = await plano(site)
    const r = await informar(site, p.execucao_id, [{ arquivo_id: 'controle_negativo', resultado: 'presente', file_id: FID(), upload_timestamp: 1_760_000_000_000 }])
    expect(r.execucao).toMatchObject({ estado: 'controle_falhou', negativo_ok: false })
    const dep = await informar(site, p.execucao_id, [presente(unidDaily(itens))])
    expect(dep.itens[0]).toMatchObject({ resposta: 'recusado', motivo: 'controle_falhou' })
  }))

  it('controle negativo presente: controle_falhou, nada atesta nem retira, a atestação anterior continua (132)', async () => emTx(async () => {
    const { site, itens } = await mesSelado()
    const p1 = await aberto(site)
    await informar(site, p1.execucao_id, itens.map(i => presente(i)))
    const antes = await mes(site)
    expect(antes.b2_attested_at).not.toBeNull()
    await agora(T('13:00'))
    await canarios(site, T('02:00'), '2026-11-29')
    const p2 = await plano(site)
    const r = await informar(site, p2.execucao_id, [{ arquivo_id: 'controle_negativo', resultado: 'presente', sha256: HEX('0'), file_id: FID(2), upload_timestamp: 1 }])
    expect(r.execucao.estado).toBe('controle_falhou')
    const dep = await informar(site, p2.execucao_id, itens.map(i => errado(i)))
    expect(dep.itens.every(x => x.resposta === 'recusado' && x.motivo === 'controle_falhou')).toBe(true)
    const depois = await mes(site)
    expect(depois.b2_attested_at).toEqual(antes.b2_attested_at); expect(depois.b2_withdrawn_at).toBeNull()
  }))

  it('canário adulterado: controle_falhou e nenhuma retirada, mesmo com todos os arquivos errados (132)', async () => emTx(async () => {
    const { site, itens } = await mesSelado(); await canarios(site)
    const p = await plano(site)
    await informar(site, p.execucao_id, [NEG])
    const r = await informar(site, p.execucao_id, [{ ...canOk('numerico'), sha256: HEX('9') }, canOk('texto')])
    expect(r.execucao.estado).toBe('controle_falhou'); expect(r.execucao.canario_ok.numerico).toBe(false)
    const dep = await informar(site, p.execucao_id, itens.map(i => errado(i)))
    expect(dep.itens.every(x => x.motivo === 'controle_falhou')).toBe(true)
    expect((await mes(site)).b2_withdrawn_at).toBeNull()
    expect(await escalar(c, `select b2_failed_at is not null from public.obs_archive_canaries where site_id = $1 and filho = 'numerico'`, [site])).toBe(true)
  }))

  it('nao_decifra é divergente já no primeiro informe, sem controle_ok é recusado (K4, Pedido 1)', async () => emTx(async () => {
    const { site, itens } = await mesSelado(); await canarios(site)
    const u = unidDaily(itens)
    const p0 = await plano(site)
    const sem = await informar(site, p0.execucao_id, [{ arquivo_id: u.arquivo_id, resultado: 'nao_decifra', file_id: FID(3), upload_timestamp: 1 }])
    expect(sem.itens[0]).toMatchObject({ resposta: 'recusado', motivo: 'controle_pendente' })
    const canBom = await informar(site, p0.execucao_id, [NEG, { ...canOk('numerico'), resultado: 'nao_decifra' }])
    expect(canBom.execucao.estado).toBe('controle_falhou')                          // canário que não decifra: o controle falhou
    await agora(T('12:05'))
    const p = await plano(site); await controle(site, p.execucao_id)
    await informar(site, p.execucao_id, [presente(u, 1)])                           // uma conferência boa antes, com o file_id A
    const r = await informar(site, p.execucao_id, [{ arquivo_id: u.arquivo_id, resultado: 'nao_decifra', file_id: FID(3), upload_timestamp: 1 }])
    expect(r.itens[0]).toMatchObject({ resposta: 'aceito' })
    const m = await mes(site)
    expect(m.b2_withdrawn_at).not.toBeNull(); expect(m.b2_last_attempt_result).toBe('divergente'); expect(m.b2_attested_at).toBeNull()
    const a = await arq(site, u.arquivo_id)
    expect(a.ilegivel_at).not.toBeNull(); expect(a.last_ok_file_id).toBe(FID(1)); expect(a.last_attempt_result).toBe('divergente')
  }))

  it('estado por filho decidido pelo site (K1, Pedido 4)', async () => emTx(async () => {
    const vazio = await semearCanal(c, { site: randomUUID(), videos: 0 }); await canarios(vazio.site)
    const pv = await plano(vazio.site)
    expect(pv.estado).toEqual({ numerico: 'aguardando_primeira_selagem', texto: 'aguardando_primeira_selagem' })
    expect(pv.primeira_selagem).toBeNull(); expect(pv.arquivos).toEqual([])
    const { site, itens } = await mesSelado(); await canarios(site)
    const p = await plano(site)
    expect(p.estado).toEqual({ numerico: 'com_pedidos', texto: 'aguardando_primeira_selagem' })
    expect(p.primeira_selagem).toBe('2026-10')
    const r = await controle(site, p.execucao_id)
    expect(r.execucao.canario_ok).toEqual({ numerico: true, texto: true })
    await informar(site, p.execucao_id, itens.map(i => presente(i)))
    await agora(T('12:00', '2026-12-01'))
    const dois = await plano(site)
    expect(dois.estado).toEqual({ numerico: 'nada_devido', texto: 'aguardando_primeira_selagem' })
    expect(dois.arquivos).toEqual([])
  }))

  it('canários: sempre dois, caminho nulo no filho sem canário de 6 horas; o recém-informado não vale (Pedido 8)', async () => emTx(async () => {
    const { site } = await mesSelado()
    await c.query(`insert into public.obs_archive_canaries (site_id, filho, dia, sha256, informed_at) values ($1, 'numerico', '2026-11-28', $2, $3::timestamptz)`, [site, CAN_NUM, T('02:00')])
    await c.query(`insert into public.obs_archive_canaries (site_id, filho, dia, sha256, informed_at) values ($1, 'texto', '2026-11-28', $2, $3::timestamptz)`, [site, CAN_TEX, T('09:00')])
    const p = await plano(site)
    expect(p.canarios).toEqual([{ arquivo_id: 'canario:numerico', filho: 'numerico', caminho: '_canario/2026-11-28' }, { arquivo_id: 'canario:texto', filho: 'texto', caminho: null }])
    const r = await informar(site, p.execucao_id, [NEG, canOk('numerico')])
    expect(r.execucao.estado).toBe('aguardando_controle')                           // falta o controle positivo do outro filho
  }))

  it('o canário prova-m3a nunca entra, nem como atestação de mês (M3a, 134)', async () => emTx(async () => {
    const { site } = await mesSelado()
    const r = (await c.query(`select public.obs_archive_attest_nas($1, $2::jsonb) as r`, [site, JSON.stringify({ fonte: 'nas', plano_id: randomUUID(),
      filhos: { numerico: { montado: true, sentinela: true }, texto: { montado: true, sentinela: true } }, canarios: [{ filho: 'numerico', dia: 'prova-m3a', sha256: HEX('c') }], itens: [] })])).rows[0].r as { canarios: Array<{ resposta: string; motivo?: string }> }
    expect(r.canarios[0]).toMatchObject({ resposta: 'recusado', motivo: 'dia_invalido' })
    expect(await escalar(c, `select count(*)::int from public.obs_archive_canaries where site_id = $1`, [site])).toBe(0)
    const p = await aberto(site)
    expect(p.canarios.every(x => x.caminho === '_canario/2026-11-28')).toBe(true)
    expect(await escalar(c, `select count(*)::int from public.obs_archive_b2_files where site_id = $1`, [site])).toBe(0)
    expect((await mes(site)).b2_attested_at).toBeNull()
  }))

  it('páginas do completo: o mesmo execucao_id, três páginas, uma só linha de execução (Pedido 7)', async () => {
    await emTx(async () => {
      const s = await semearCanal(c, { site: randomUUID(), videos: 0 }); await muitos(s.site, 1200); await canarios(s.site)
      const p1 = await plano(s.site, true)
      expect(p1.arquivos).toHaveLength(500); expect(p1.cursor_seguinte).toMatch(/^[0-9a-f-]{36}\|u:/)
      const p2 = await plano(s.site, false, p1.cursor_seguinte)
      const p3 = await plano(s.site, false, p2.cursor_seguinte)
      expect([p2.arquivos.length, p3.arquivos.length]).toEqual([500, 200])
      expect(new Set([p1.execucao_id, p2.execucao_id, p3.execucao_id]).size).toBe(1)
      expect(p3.cursor_seguinte).toBeNull(); expect(p2.modo).toBe('completo')
      const ids = [...p1.arquivos, ...p2.arquivos, ...p3.arquivos].map(a => a.arquivo_id)
      expect(new Set(ids).size).toBe(1200)
      expect(ids).toEqual([...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
      expect(await escalar(c, `select count(*)::int from public.obs_archive_b2_runs where site_id = $1`, [s.site])).toBe(1)
      expect(p1.cobertura).toEqual({ paginas_aceitas: 0, paginas_total: 3 })
      expect(RespostaPlanoB2.safeParse(p2).success).toBe(true)
      expect((await falha(`select public.obs_archive_b2_plan($1, false, $2)`, [s.site, `${randomUUID()}|u:x`]))).toBeNull()
      expect((await plano(s.site, false, `${randomUUID()}|u:x`)).erro).toBe('cursor_invalido')
      expect((await plano(s.site, false, 'lixo')).erro).toBe('cursor_invalido')
    })
  }, 60_000)

  it('validade renovada a cada página e retomada pelo cursor (X1)', async () => {
    await emTx(async () => {
      const s = await semearCanal(c, { site: randomUUID(), videos: 0 }); await muitos(s.site, 1200); await canarios(s.site, T('02:00'))
      await agora(T('10:00')); const p1 = await plano(s.site, true)
      await agora(T('11:50')); const p2 = await plano(s.site, false, p1.cursor_seguinte)
      await agora(T('13:40')); expect((await controle(s.site, p1.execucao_id)).execucao.estado).toBe('controle_ok')   // prazo renovado às 11:50
      await agora(T('13:51'))
      const v = await informar(s.site, p1.execucao_id, [{ arquivo_id: p1.arquivos[0]!.arquivo_id, resultado: 'sem_acesso' }])
      expect(v.itens[0]).toMatchObject({ resposta: 'recusado', motivo: 'execucao_vencida' })
      await agora(T('14:00')); const p3 = await plano(s.site, false, p2.cursor_seguinte)
      expect(p3.execucao_id).not.toBe(p1.execucao_id)
      expect(p3.controle_negativo.caminho).not.toBe(p1.controle_negativo.caminho)
      const r = await q1(c, `select estado, modo from public.obs_archive_b2_runs where id = $1`, [p3.execucao_id])
      expect(r).toEqual({ estado: 'aguardando_controle', modo: 'completo' })
      const ult2 = p2.arquivos[p2.arquivos.length - 1]!.arquivo_id
      expect(p3.arquivos.length).toBe(200)
      expect(p3.arquivos.every(a => a.arquivo_id > ult2)).toBe(true)
      const outro = await semearCanal(c, { site: randomUUID(), videos: 0 })
      expect((await plano(outro.site, false, p1.cursor_seguinte)).erro).toBe('cursor_invalido')
    })
  }, 60_000)

  it('teto_bytes_mes é metade da franquia e teto_bytes_dia é 2 x file_bytes do registro, 1 MiB se vazio (P59)', async () => emTx(async () => {
    const vazio = await semearCanal(c, { site: randomUUID(), videos: 0 })
    const pv = await plano(vazio.site)
    expect(pv.teto_bytes_dia).toBe(1048576)
    const { site } = await mesSelado()
    const p = await plano(site)
    const franquia = Number(await escalar<string>(c, `select public.obs_archive_b2_franquia_mes()`))
    expect(franquia).toBe(2_444_400_000_000)
    expect(p.teto_bytes_mes).toBe(franquia / 2)
    const soma = Number(await escalar<string>(c, `select (coalesce((select sum(file_bytes) from public.obs_archive_units where site_id = $1), 0)
      + coalesce((select sum(coalesce(canal_bytes, 0) + coalesce(video_bytes, 0) + coalesce(ficha_bytes, 0)) from public.obs_archive_summaries where site_id = $1), 0))::text`, [site]))
    expect(p.teto_bytes_dia).toBe(Math.max(2 * soma, 1048576))
  }))

  it('primeiro informe diferente responde repetir e não retira; segundo igual é divergente e retira (132)', async () => emTx(async () => {
    const { site, itens } = await mesSelado(); const p = await aberto(site)
    const u = unidDaily(itens)
    const um = await informar(site, p.execucao_id, [errado(u, 1)])
    expect(um.itens[0]).toMatchObject({ resposta: 'repetir' })
    expect((await mes(site)).b2_withdrawn_at).toBeNull(); expect((await mes(site)).b2_last_attempt_result).toBe('divergencia_a_confirmar')
    expect((await arq(site, u.arquivo_id)).pending_mismatch).not.toBeNull()
    const dois = await informar(site, p.execucao_id, [errado(u, 1, HEX('e'))])
    expect(dois.itens[0]).toMatchObject({ resposta: 'aceito' })
    const m = await mes(site)
    expect(m.b2_withdrawn_at).not.toBeNull(); expect(m.b2_withdrawn_reason).toBe('divergente'); expect(m.b2_withdrawn_via).toBe('forja'); expect(m.b2_last_attempt_result).toBe('divergente')
  }))

  it('segundo informe com outros valores é sem_acesso e não retira (132)', async () => emTx(async () => {
    const { site, itens } = await mesSelado(); const p = await aberto(site)
    const u = unidDaily(itens)
    await informar(site, p.execucao_id, [errado(u, 1, HEX('e'))])
    await informar(site, p.execucao_id, [errado(u, 1, HEX('d'))])
    const m = await mes(site)
    expect(m.b2_withdrawn_at).toBeNull(); expect(m.b2_last_attempt_result).toBe('sem_acesso')
    expect((await arq(site, u.arquivo_id)).pending_mismatch).toBeNull()
  }))

  it('segundo informe que não vem em 48 horas é divergente na leitura seguinte do plano (132)', async () => emTx(async () => {
    const { site, itens } = await mesSelado(); const p = await aberto(site)
    await informar(site, p.execucao_id, [errado(unidDaily(itens))])
    expect((await mes(site)).b2_withdrawn_at).toBeNull()
    await agora(T('11:00', '2026-12-01'))                                            // 47 h depois: ainda pendente
    await plano(site); expect((await mes(site)).b2_withdrawn_at).toBeNull()
    await agora(T('13:00', '2026-12-01'))                                            // 49 h depois
    await plano(site)
    const m = await mes(site)
    expect(m.b2_withdrawn_at).not.toBeNull(); expect(m.b2_withdrawn_reason).toBe('divergente')
  }))

  it('arquivo ausente recebido há mais de 48 h: arquivo_ausente e retira; há menos: aguardando_b2, não atesta nem retira (132)', async () => emTx(async () => {
    const { site, itens } = await mesSelado()
    const u = unidDaily(itens)
    const recente = (await c.query(`select (now() + interval '1 hour')::text as t`)).rows[0].t as string
    await agora(recente)
    await canarios(site, (await c.query(`select (now() - interval '7 hours')::text as t`)).rows[0].t as string)
    const p2 = await plano(site)
    await controle(site, p2.execucao_id)
    const r1 = await informar(site, p2.execucao_id, [{ arquivo_id: u.arquivo_id, resultado: 'ausente' }])
    expect(r1.itens[0]).toMatchObject({ resposta: 'aceito' })
    expect((await mes(site)).b2_withdrawn_at).toBeNull(); expect((await mes(site)).b2_last_attempt_result).toBe('aguardando_b2')
    expect((await mes(site)).b2_attested_at).toBeNull()
    await agora(T('12:30'))
    const p3 = await plano(site); await controle(site, p3.execucao_id)
    await informar(site, p3.execucao_id, [{ arquivo_id: u.arquivo_id, resultado: 'ausente' }])
    const m = await mes(site)
    expect(m.b2_withdrawn_at).not.toBeNull(); expect(m.b2_withdrawn_reason).toBe('arquivo_ausente'); expect(m.b2_last_attempt_result).toBe('arquivo_ausente')
  }))

  it('sem file_id, ou file_id fora do formato: não atesta (132)', async () => emTx(async () => {
    const { site, itens } = await mesSelado(); const p = await aberto(site)
    const u = unidDaily(itens)
    const a = await informar(site, p.execucao_id, [{ ...presente(u), file_id: undefined, upload_timestamp: undefined }])
    expect(a.itens[0]).toMatchObject({ resposta: 'recusado', motivo: 'sem_file_id' })
    expect((await arq(site, u.arquivo_id)).last_attempt_result).toBe('sem_acesso')
    const b = await informar(site, p.execucao_id, [presente(u, 1, { file_id: 'qualquer coisa' })])
    expect(b.itens[0]).toMatchObject({ resposta: 'recusado', motivo: 'file_id_invalido' })
    expect((await arq(site, u.arquivo_id)).last_ok_at).toBeNull()
    expect((await mes(site)).b2_attested_at).toBeNull()
    expect(await escalar(c, `select file_id_recusado from public.obs_archive_b2_runs where id = $1`, [p.execucao_id])).toBe(true)
  }))

  it('upload_timestamp anterior ao received_at é aceito (132)', async () => emTx(async () => {
    const { site, itens } = await mesSelado(); const p = await aberto(site)
    const u = unidDaily(itens)
    const r = await informar(site, p.execucao_id, [presente(u, 1, { upload_timestamp: 1 })])
    expect(r.itens[0]).toMatchObject({ resposta: 'aceito' })
    expect((await arq(site, u.arquivo_id)).last_ok_at).not.toBeNull()
  }))

  it('execução cortada depois de N arquivos mantém os N (132)', async () => emTx(async () => {
    const { site, itens } = await mesSelado(); const p = await aberto(site)
    await informar(site, p.execucao_id, itens.slice(0, 2).map(i => presente(i)))
    for (const i of itens.slice(0, 2)) expect((await arq(site, i.arquivo_id)).last_ok_at).not.toBeNull()
    expect(await escalar(c, `select count(*)::int from public.obs_archive_b2_files where site_id = $1 and last_ok_at is not null`, [site])).toBe(2)
    expect((await mes(site)).b2_attested_at).toBeNull()                              // o conjunto não está completo
  }))

  it('b2_attested_at só com todos os arquivos do mês ok, e com a hora da conferência mais antiga do conjunto (133, Phil I2)', async () => emTx(async () => {
    const { site, itens } = await mesSelado(); const p = await aberto(site)
    expect(itens.length).toBe(5)                                                     // a early vazia não tem arquivo
    await informar(site, p.execucao_id, itens.slice(0, 4).map(i => presente(i)))
    expect((await mes(site)).b2_attested_at).toBeNull(); expect((await mes(site)).b2_forja_ok_at).toBeNull()
    await agora(T('13:00'))
    await informar(site, p.execucao_id, [presente(itens[4]!)])
    const m = await mes(site)
    expect(m.b2_attested_via).toBe('forja')
    expect(new Date(m.b2_attested_at as Date).toISOString()).toBe('2026-11-29T15:00:00.000Z')      // 12:00 -03: a conferência mais antiga do conjunto
  }))

  it('origens não se sobrescrevem; ok da forja depois do dono não encurta os 35 dias (133)', async () => emTx(async () => {
    const { site, itens } = await mesSelado()
    await agora(T('12:00')); const dono = (await c.query(`select public.obs_archive_attest_b2_dono($1, 'serie', $2::date, 'thiago', $3::jsonb) as r`,
      [site, MES, JSON.stringify(itens.map(i => ({ arquivo_id: i.arquivo_id, resultado: 'ok' })))])).rows[0].r as { ok: boolean }
    expect(dono.ok).toBe(true)
    let m = await mes(site); expect(m.b2_attested_via).toBe('dono'); const doOk = m.b2_dono_ok_at
    await agora(T('12:00', '2026-12-09'))                                            // 10 dias depois: a forja confere
    await canarios(site, T('02:00', '2026-12-09'), '2026-12-08')
    const p = await plano(site, true); await controle(site, p.execucao_id)
    await informar(site, p.execucao_id, itens.map(i => presente(i)))
    m = await mes(site)
    expect(m.b2_dono_ok_at).toEqual(doOk); expect(m.b2_forja_ok_at).not.toBeNull()
    expect(m.b2_attested_via).toBe('dono')                                           // dono + 35 d vence forja + 7 d
    await agora(T('12:00', '2027-01-08'))                                            // 40 dias depois do dono: a forja confere de novo
    await canarios(site, T('02:00', '2027-01-08'), '2027-01-07')
    const p2 = await plano(site, true); await controle(site, p2.execucao_id)
    await informar(site, p2.execucao_id, itens.map(i => presente(i)))
    m = await mes(site)
    expect(m.b2_dono_ok_at).toEqual(doOk); expect(m.b2_attested_via).toBe('forja')
  }))

  it('retirada pelo dono não é limpa por ok da forja; retirada pela forja é limpa pelo dono e registra a divergência (133)', async () => emTx(async () => {
    const { site, itens } = await mesSelado()
    const donoOk = (resultado: string) => c.query(`select public.obs_archive_attest_b2_dono($1, 'serie', $2::date, 'thiago', $3::jsonb) as r`,
      [site, MES, JSON.stringify(itens.map((i, n) => ({ arquivo_id: i.arquivo_id, resultado: n === 0 ? resultado : 'ok' })))])
    await donoOk('divergente')
    expect((await mes(site)).b2_withdrawn_via).toBe('dono')
    const p = await aberto(site)
    await informar(site, p.execucao_id, itens.map(i => presente(i)))
    let m = await mes(site)
    expect(m.b2_withdrawn_at).not.toBeNull(); expect(m.b2_withdrawn_via).toBe('dono'); expect(m.b2_attested_at).toBeNull()
    await donoOk('ok')
    m = await mes(site); expect(m.b2_withdrawn_at).toBeNull(); expect(m.b2_attested_via).toBe('dono')
    // agora a forja retira e o dono limpa
    await agora(T('13:00')); await canarios(site, T('02:00'), '2026-11-27')
    const p2 = await plano(site); await controle(site, p2.execucao_id)
    const u = unidDaily(itens)
    await informar(site, p2.execucao_id, [errado(u, 1, HEX('e'))]); await informar(site, p2.execucao_id, [errado(u, 1, HEX('e'))])
    m = await mes(site); expect(m.b2_withdrawn_via).toBe('forja'); expect(m.b2_forja_diverged_at).toBeNull()
    await agora(T('14:00')); await donoOk('ok')
    m = await mes(site)
    expect(m.b2_withdrawn_at).toBeNull(); expect(m.b2_forja_diverged_at).not.toBeNull(); expect(m.b2_attested_via).toBe('dono')
  }))

  it('o plano do B2 lista partes, nunca a unidade em partes, e nunca unidade vazia (Phil I2)', async () => emTx(async () => {
    const a = await semearCanal(c, { site: randomUUID(), videos: 1 }); await semearDiaria(c, a.videos, '2026-10-01', 31)
    const l = await lidaCompleta(a.site, DAILY, a.canal)
    const payload = { classe: 'serie', tabela: DAILY, canal: a.canal, mes: MES, row_count: 58, control_sum: l.control_sum, hash_conteudo: l.hash_conteudo, schema_fp: l.schema_fp,
      sha256_bytes: HEX('c'), csv_sha256: HEX('d'), file_bytes: 1000, partes: 2, min_key: l.first_key, max_key: l.last_key,
      parts: [{ parte: 1, sha256_bytes: HEX('1'), csv_sha256: HEX('2'), file_bytes: 500, row_count: 30, control_sum: '30000', row_offset: 0, min_key: 'a', max_key: 'b' },
              { parte: 2, sha256_bytes: HEX('3'), csv_sha256: HEX('4'), file_bytes: 500, row_count: 28, control_sum: '28000', row_offset: 30, min_key: 'c', max_key: 'd' }] }
    const g = (await c.query(`select public.obs_archive_record($1, 'unidade', $2::jsonb) as r`, [a.site, JSON.stringify(payload)])).rows[0].r as Gravada
    const id = g.arquivo_id!.slice(2)
    await c.query(`update public.obs_archive_units set received_at = now() where id = $1`, [id])
    await c.query(`update public.obs_archive_unit_parts set received_at = now() where unit_id = $1`, [id])
    await unidade(a.site, EARLY, a.canal)                                            // early vazia
    await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, sealed_at, sealed_version, sealed_kind) values ($1, 'serie', $2, $3::date, now(), 1, 'com_dado')
      on conflict (site_id, class, table_name, month) do update set sealed_at = now(), sealed_version = 1, sealed_kind = 'com_dado'`, [a.site, DAILY, MES])
    await canarios(a.site)
    const p = await plano(a.site)
    const ids = p.arquivos.map(x => x.arquivo_id)
    expect(ids).toContain(`p:${id}:01`); expect(ids).toContain(`p:${id}:02`)
    expect(ids).not.toContain(`u:${id}`)
    expect(p.arquivos.filter(x => x.tipo === 'unidade')).toHaveLength(0)
    expect(await escalar(c, `select count(*)::int from public.obs_archive_months where site_id = $1 and class = 'serie' and b2_forja_ok_at is not null`, [a.site])).toBe(0)
  }))

  it('o fileId da última conferência boa fica, não o do último informe (Su1)', async () => emTx(async () => {
    const { site, itens } = await mesSelado(); const p = await aberto(site)
    const u = unidDaily(itens)
    await informar(site, p.execucao_id, [presente(u, 10)])                           // file_id A
    await informar(site, p.execucao_id, [errado(u, 11)]); await informar(site, p.execucao_id, [errado(u, 11)])   // B, duas vezes: divergente
    const a = await arq(site, u.arquivo_id)
    expect(a.last_ok_file_id).toBe(FID(10)); expect(a.last_attempt_result).toBe('divergente')
  }))

  it('permissões: públicas só para service_role; internas para ninguém (K3)', async () => emTx(async () => {
    const priv = async (f: string, quem: string): Promise<boolean> => escalar(c, `select has_function_privilege($1, $2, 'execute')`, [quem, f])
    for (const f of ['public.obs_archive_b2_plan(uuid,boolean,text)', 'public.obs_archive_attest_b2(uuid,jsonb)', 'public.obs_archive_attest_b2_dono(uuid,text,date,text,jsonb)',
                     'public.obs_archive_b2_month_state(uuid,text,date)', 'public.obs_archive_b2_franquia_mes()']) {
      expect(await priv(f, 'service_role'), f).toBe(true)
      for (const quem of ['anon', 'authenticated']) expect(await priv(f, quem), `${f} ${quem}`).toBe(false)
    }
    for (const f of ['public.obs_archive_b2_run_gate(uuid,uuid,jsonb)', 'public.obs_archive_agora()', 'public.obs_archive_b2_aceitar_paginas(uuid,uuid)',
                     'public.obs_archive_b2_recompute_month(uuid,text,date,text,text)', 'public.obs_archive_b2_retirar(uuid,text,text,text)', 'public.obs_archive_b2_file_info(uuid,text)',
                     'public.obs_archive_b2_teto_dia(uuid)', 'public.obs_archive_b2_pede_completo(uuid)', 'public.obs_archive_filho_do_arquivo(uuid,text)'])
      for (const quem of ['service_role', 'anon', 'authenticated']) expect(await priv(f, quem), `${f} ${quem}`).toBe(false)
  }))

  // ---- a retomada do completo (r2.2, I3 do Phil) ----
  /** Informa como conclusivos (arquivo_ausente: o recebimento é antigo) os arquivos dados. */
  const ausentes = (site: string, run: string, ids: string[]): Promise<Resp> => informar(site, run, ids.map(arquivo_id => ({ arquivo_id, resultado: 'ausente' })))

  it('completo retomado entre execuções (r2.2, I3 do Phil)', async () => {
    await emTx(async () => {
      const s = await semearCanal(c, { site: randomUUID(), videos: 0 }); await muitos(s.site, 1200); await canarios(s.site)
      await c.query(`update public.obs_archive_units set received_at = '2026-10-01' where site_id = $1`, [s.site])
      await agora(T('12:00')); const a1 = await plano(s.site, true)
      expect(a1.cobertura).toEqual({ paginas_aceitas: 0, paginas_total: 3 }); expect(a1.retomado_de).toBeNull()
      const a2 = await plano(s.site, false, a1.cursor_seguinte)
      await controle(s.site, a1.execucao_id)
      await ausentes(s.site, a1.execucao_id, [...a1.arquivos.map(x => x.arquivo_id), ...a2.arquivos.slice(0, 250).map(x => x.arquivo_id)])
      const ultimaP1 = a1.arquivos[499]!.arquivo_id
      expect(await escalar(c, `select paginas_aceitas from public.obs_archive_b2_runs where id = $1`, [a1.execucao_id])).toBe(1)
      // a forja para; novo plano completo abre a execução B
      await agora(T('12:30')); const b1 = await plano(s.site, true)
      expect(b1.execucao_id).not.toBe(a1.execucao_id)
      expect(b1.retomado_de).toBe(`${a1.execucao_id}|${ultimaP1}`); expect(b1.cobertura).toEqual({ paginas_aceitas: 1, paginas_total: 3 })
      expect(b1.arquivos[0]!.arquivo_id).toBe(a2.arquivos[0]!.arquivo_id)
      const todosA1 = new Set(a1.arquivos.map(x => x.arquivo_id))
      expect(b1.arquivos.some(x => todosA1.has(x.arquivo_id))).toBe(false)
      expect(await escalar(c, `select completo_desde = $2::timestamptz from public.obs_archive_b2_runs where id = $1`, [b1.execucao_id, T('12:00')])).toBe(true)
      const b2 = await plano(s.site, false, b1.cursor_seguinte)
      await controle(s.site, b1.execucao_id)
      await ausentes(s.site, b1.execucao_id, [...b1.arquivos.map(x => x.arquivo_id), ...b2.arquivos.map(x => x.arquivo_id)])
      const fim = await q1(c, `select completo_fechado_em is not null as fechado, paginas_aceitas from public.obs_archive_b2_runs where id = $1`, [b1.execucao_id])
      expect(fim).toEqual({ fechado: true, paginas_aceitas: 3 })
      await agora(T('13:00')); const c1 = await plano(s.site, true)
      expect(c1.retomado_de).toBeNull(); expect(c1.cobertura).toEqual({ paginas_aceitas: 0, paginas_total: 3 })
      expect(c1.arquivos[0]!.arquivo_id).toBe(a1.arquivos[0]!.arquivo_id)
    })
  }, 120_000)

  it('página com sem_acesso não é aceita e segura o cursor (r2.2)', async () => {
    await emTx(async () => {
      const s = await semearCanal(c, { site: randomUUID(), videos: 0 }); await muitos(s.site, 1200); await canarios(s.site)
      await c.query(`update public.obs_archive_units set received_at = '2026-10-01' where site_id = $1`, [s.site])
      const a1 = await plano(s.site, true); const a2 = await plano(s.site, false, a1.cursor_seguinte)
      await controle(s.site, a1.execucao_id)
      const ids1 = a1.arquivos.map(x => x.arquivo_id)
      await informar(s.site, a1.execucao_id, [{ arquivo_id: ids1[0], resultado: 'sem_acesso' }, ...ids1.slice(1).map(arquivo_id => ({ arquivo_id, resultado: 'ausente' }))])
      await ausentes(s.site, a1.execucao_id, a2.arquivos.map(x => x.arquivo_id))
      const r = await q1(c, `select cursor_aceito, paginas_aceitas from public.obs_archive_b2_runs where id = $1`, [a1.execucao_id])
      expect(r).toEqual({ cursor_aceito: null, paginas_aceitas: 0 })
      await agora(T('12:30')); const b = await plano(s.site, true)
      expect(b.retomado_de).toBeNull(); expect(b.arquivos[0]!.arquivo_id).toBe(ids1[0])
      expect(await escalar(c, `select completo_desde = $2::timestamptz from public.obs_archive_b2_runs where id = $1`, [b.execucao_id, T('12:00')])).toBe(true)
    })
  }, 120_000)

  it('retomada dentro e entre execuções juntas (r2.2 com X1)', async () => {
    await emTx(async () => {
      const s = await semearCanal(c, { site: randomUUID(), videos: 0 }); await muitos(s.site, 1200); await canarios(s.site, T('02:00'))
      await c.query(`update public.obs_archive_units set received_at = '2026-10-01' where site_id = $1`, [s.site])
      await agora(T('10:00')); const b1 = await plano(s.site, true); const b2 = await plano(s.site, false, b1.cursor_seguinte)
      await controle(s.site, b1.execucao_id)
      await ausentes(s.site, b1.execucao_id, [...b1.arquivos.map(x => x.arquivo_id), ...b2.arquivos.slice(0, 250).map(x => x.arquivo_id)])
      await agora(T('14:00'))                                                         // B vence (a última página pedida foi às 10:00)
      const c1 = await plano(s.site, false, b1.cursor_seguinte)
      expect(c1.execucao_id).not.toBe(b1.execucao_id); expect(c1.modo).toBe('completo')
      const herdado = await q1(c, `select paginas_aceitas, cursor_aceito, completo_desde = $2::timestamptz as desde, retomado_de from public.obs_archive_b2_runs where id = $1`, [c1.execucao_id, T('10:00')])
      expect(herdado).toMatchObject({ paginas_aceitas: 1, desde: true, retomado_de: b1.cursor_seguinte })
      expect(c1.arquivos[0]!.arquivo_id).toBe(b2.arquivos[0]!.arquivo_id)
      await controle(s.site, c1.execucao_id)
      await ausentes(s.site, c1.execucao_id, c1.arquivos.slice(250).map(x => x.arquivo_id))   // a metade já informada em B não é reinformada
      expect(await escalar(c, `select paginas_aceitas from public.obs_archive_b2_runs where id = $1`, [c1.execucao_id])).toBe(2)
    })
  }, 120_000)

  it('completo pedido pelo pode-desligar também retoma (r2.2)', async () => emTx(async () => {
    const { site } = await mesSelado(); await canarios(site)
    await c.query(`update public.obs_archive_months set detached_at = now() - interval '1 day' where site_id = $1`, [site])
    const p = await plano(site)                                                      // sem p_completo: mês fora do banco e B2 nunca atestado
    expect(p.modo).toBe('completo'); expect(p.cobertura).not.toBeNull()
    expect(RespostaPlanoB2.safeParse(p).success).toBe(true)
    await agora(T('12:30')); const p2 = await plano(site)
    expect(p2.modo).toBe('completo'); expect(p2.retomado_de).toBeNull()              // nada aceito ainda: o ponto é o começo
  }))

  it('o purgo de 90 dias não apaga o completo em aberto, a execução mais recente do site (r2.2)', async () => emTx(async () => {
    const s = await semearCanal(c, { site: randomUUID(), videos: 0 })
    await c.query(`insert into public.obs_archive_b2_runs (site_id, started_at, expires_at, modo, negative_name, negative_filho, canary_days, completo_desde, paginas_total)
      values ($1, $2::timestamptz - interval '100 days', $2::timestamptz - interval '100 days' + interval '2 hours', 'completo', '_controle/x', 'texto', '{}'::jsonb, $2::timestamptz - interval '100 days', 3)`, [s.site, T('12:00')])
    const velho = await q1(c, `select id from public.obs_archive_b2_runs where site_id = $1`, [s.site])
    const outro = await c.query(`insert into public.obs_archive_b2_runs (site_id, started_at, expires_at, modo, negative_name, negative_filho, canary_days)
      values ($1, $2::timestamptz - interval '95 days', $2::timestamptz - interval '95 days' + interval '2 hours', 'normal', '_controle/y', 'texto', '{}'::jsonb) returning id`, [s.site, T('12:00')])
    await plano(s.site)
    const ids = (await c.query(`select id from public.obs_archive_b2_runs where site_id = $1`, [s.site])).rows.map(r => r.id as string)
    expect(ids).toContain(velho.id as string); expect(ids).not.toContain(outro.rows[0].id as string)
  }))

  it('o estado do mês para a página (month_state)', async () => emTx(async () => {
    const { site, itens } = await mesSelado(); const p = await aberto(site)
    await informar(site, p.execucao_id, itens.map(i => presente(i)))
    const st = (await c.query(`select public.obs_archive_b2_month_state($1, 'serie', $2::date) as r`, [site, MES])).rows[0].r as Record<string, unknown>
    expect(st.via).toBe('forja'); expect(st.retirada).toBeNull(); expect(st.idade_dias).toBe(0)
    const nada = (await c.query(`select public.obs_archive_b2_month_state($1, 'serie', '2020-01-01') as r`, [site])).rows[0].r
    expect(nada).toEqual({ atestada_em: null, retirada: null })
  }))
})
