// @vitest-environment node
/** M9 Tarefa 5, parte 5: avanço dos itens, versões superadas de texto, "já rodei", listas de apagar. Tudo em begin … rollback (54422). */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { m3bNoBanco, aplicarM3b, escalar, tenta, semearCanal } from '../helpers/m3b'
import { criarUsuario } from '../helpers/mg6'
import { aplicarM9 } from '../helpers/m9'
import { travarDdl } from '../helpers/ddl-testes'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const H = (ch: string): string => ch.repeat(64)
const DAILY = 'competitor_video_daily'
const COMENT = 'competitor_video_comments'
const MES = '2026-09-01'

type Cena = { site: string; canal: string; video: string; admin: string }
type Linha = Record<string, unknown>

describe.skipIf(skipIfNoLocalDb())('M9 parte 5: avanço dos itens, versões superadas e já rodei', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })

  async function emTx(fn: (c: Cena) => Promise<void>): Promise<void> {
    await pg.query('begin'); await pg.query('select pg_advisory_xact_lock(7339001)')
    try {
      if (!(await m3bNoBanco(pg))) await aplicarM3b(pg)
      await travarDdl(pg)
      await aplicarM9(pg, 5)
      const s = await semearCanal(pg, { videos: 1 })
      const admin = await criarUsuario(pg)
      const org = await escalar<string>(pg, `select org_id from public.sites where id = $1`, [s.site])
      await pg.query(`insert into public.organization_members (org_id, user_id, role) values ($1, $2, 'org_admin')`, [org, admin])
      await fn({ site: s.site, canal: s.canal, video: s.videos[0]!, admin })
    } finally { await pg.query('rollback') }
  }

  const ligar = (c: Cena, v = true) => pg.query(
    `insert into public.obs_archive_m9_interruptor (site_id, ligado) values ($1, $2) on conflict (site_id) do update set ligado = excluded.ligado`, [c.site, v])

  /** Uma unidade. `idade` em dias para trás nos marcos de recebimento/atestado. */
  async function unidade(c: Cena, o: { v: number; tabela?: string; classe?: string; linhas?: number; recebida?: boolean; atestada?: boolean; superada?: boolean; partes?: number; idade?: number; atestadaHa?: string; retirada?: boolean; perdida?: boolean }): Promise<string> {
    const idade = `${o.idade ?? 1} days`
    const id = (await pg.query(
      `insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, control_sum, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, parts,
         received_at, nas_attested_at, superseded_at, nas_withdrawn_at, nas_withdrawn_reason, lost_at, lost_by, lost_reason)
       values ($1, $2, $3, $4, $5::date, $6, $7, 100, $8, $9, $10, $11, 100, $12,
         case when $13 then now() - $15::interval end, case when $14 then now() - coalesce($17, $15)::interval end, case when $16 then now() - interval '1 hour' end,
         case when $18 then now() end, case when $18 then 'ausente' end, case when $19 then now() end, case when $19 then 'teste' end, case when $19 then 'nunca_recebida' end) returning id`,
      [c.site, o.classe ?? 'serie', o.tabela ?? DAILY, c.canal, MES, o.v, o.linhas ?? 10, H('a'), H('b'), H(String(o.v)), H('c'), o.partes ?? 1,
       o.recebida ?? true, o.atestada ?? true, idade, o.superada ?? false, o.atestadaHa ?? null, o.retirada ?? false, o.perdida ?? false])).rows[0].id as string
    if ((o.partes ?? 1) > 1) {
      for (let p = 1; p <= (o.partes ?? 1); p++) {
        await pg.query(`insert into public.obs_archive_unit_parts (unit_id, part, sha256_bytes, csv_sha256, file_bytes, row_count, control_sum, row_offset) values ($1, $2, $3, $4, 50, 5, 50, $5)`,
          [id, p, H(String(p)), H('d'), (p - 1) * 5])
      }
    }
    return id
  }
  const b2 = (c: Cena, arquivo: string, classe = 'serie', dias = 0) => pg.query(
    `insert into public.obs_archive_b2_files (site_id, arquivo_id, class, month, last_ok_at) values ($1, $2, $3, $4::date, now() - $5::interval)`, [c.site, arquivo, classe, MES, `${dias} days`])
  const mes = (c: Cena, o: { selado?: string; razao?: string | null; b2?: string | null } = {}) => pg.query(
    `insert into public.obs_archive_months (site_id, class, table_name, month, sealed_at, unsealed_reason, unsealed_at, b2_attested_at)
     values ($1, 'serie', $2, $3::date, now() - $4::interval, $5, case when $5::text is not null then now() end, case when $6::text is null then null else now() - $6::interval end)`,
    [c.site, DAILY, MES, o.selado ?? '30 minutes', o.razao ?? null, o.b2 === undefined ? '10 minutes' : o.b2])
  async function alvo(c: Cena, de: string, para: string | null, o: { estado?: string; ref?: string; item?: number; kind?: string; geracao?: number } = {}): Promise<number> {
    return Number((await pg.query(
      `insert into public.obs_archive_item_targets (site_id, item_kind, item_refs, item_id, class, table_name, channel_ref, month, keys, esperadas, from_unit_id, from_version, estado, to_unit_id, to_version, geracao)
       values ($1, $8, array[$2], $3, 'serie', $4, $5, $6::date, array[$7], 4, $9, 1, $10, $11, case when $11::uuid is null then null else 2 end, $12) returning id`,
      [c.site, o.ref ?? 'yt1', o.item ?? null, DAILY, c.canal, MES, c.video, o.kind ?? 'video', de, o.estado ?? 'aguardando_nova', para, o.geracao ?? 1])).rows[0].id)
  }
  /** Item removido com a bandeira ligada à força (o gatilho de inserção a derivaria dos alvos abertos). */
  async function itemRemovido(c: Cena, ref: string): Promise<string> {
    const id = (await pg.query(
      `insert into public.competitor_removed_items (site_id, kind, youtube_id, competitor_channel_id, decided_at, decided_by, rows_deleted)
       values ($1, 'video', $2, $3, now(), $4, '{}'::jsonb) returning id`, [c.site, ref, c.canal, c.admin])).rows[0].id as string
    await pg.query(`update public.competitor_removed_items set archive_pending = true where id = $1`, [id])
    return id
  }
  async function ausencia(c: Cena, alvoId: number, prefixo: string, extra = ''): Promise<number> {
    const id = Number((await pg.query(
      `insert into public.obs_archive_absence (site_id, alvo, alvo_id, filho, prefixo, e_prefixo, sha256) values ($1, $2, $3, 'numerico', $4, false, $5) returning id`,
      [c.site, `alvo:${alvoId}`, alvoId, prefixo, H('e')])).rows[0].id)
    if (extra) await pg.query(`update public.obs_archive_absence set ${extra} where id = $1`, [id])
    return id
  }
  const lerAlvo = async (id: number): Promise<Linha> => (await pg.query(`select * from public.obs_archive_item_targets where id = $1`, [id])).rows[0] as Linha
  const lerAus = async (id: number): Promise<Linha> => (await pg.query(`select * from public.obs_archive_absence where id = $1`, [id])).rows[0] as Linha
  const falta = (id: number) => escalar<string | null>(pg, `select public.obs_archive_item_falta($1)`, [id])
  const advance = (c: Cena) => escalar<number>(pg, `select public.obs_archive_item_advance($1)`, [c.site])
  /** Cena inteira "nova pronta": v1 antiga, v2 nova recebida, atestada, no B2 e mês selado depois. */
  async function pronta(c: Cena): Promise<{ v1: string; v2: string; t: number; aus: number }> {
    const v1 = await unidade(c, { v: 1, superada: false, idade: 5 })
    const v2 = await unidade(c, { v: 2, idade: 1 })
    await b2(c, `u:${v2}`)
    await mes(c)
    const t = await alvo(c, v1, v2, { item: 1 })
    const aus = await ausencia(c, t, `serie/canais/${c.canal}/a.csv.gz`)
    return { v1, v2, t, aus }
  }

  it('item_falta: a ordem', async () => {
    await emTx(async c => {
      const v1 = await unidade(c, { v: 1, idade: 5 })
      // nova sem received_at
      const vn = await unidade(c, { v: 2, recebida: false, atestada: false })
      const t = await alvo(c, v1, vn)
      expect(await falta(t)).toBe('unidade_no_nas')
      await pg.query(`update public.obs_archive_units set received_at = now() where id = $1`, [vn])
      expect(await falta(t)).toBe('unidade_no_nas')
      await pg.query(`update public.obs_archive_units set nas_attested_at = now() where id = $1`, [vn])
      // nova vazia: dispensa recebimento e B2
      await pg.query(`update public.obs_archive_units set received_at = null, nas_attested_at = null, row_count = 0, sha256_bytes = null where id = $1`, [vn])
      await ligar(c)
      expect(await falta(t)).toBeNull()
      await pg.query(`update public.obs_archive_units set row_count = 10, sha256_bytes = $2, received_at = now() - interval '1 hour', nas_attested_at = now() - interval '1 hour' where id = $1`, [vn, H('c')])
      // resumo do expurgo sem received_at/nas_attested_at
      const sm = (await pg.query(`insert into public.obs_archive_summaries (site_id, class, channel_ref, month, version, empty, canal_sha256, unit_hashes, origem)
        values ($1, 'serie', $2, $3::date, 1, false, $4, '{}'::jsonb, 'expurgo') returning id`, [c.site, c.canal, MES, H('f')])).rows[0].id as string
      expect(await falta(t)).toBe('resumo')
      await pg.query(`update public.obs_archive_summaries set received_at = now(), nas_attested_at = now() where id = $1`, [sm])
      // mês com unsealed_reason = expurgo
      await mes(c, { razao: 'expurgo' })
      expect(await falta(t)).toBe('manifesto')
      await pg.query(`update public.obs_archive_months set unsealed_reason = null, unsealed_at = null, sealed_at = now() - interval '2 hours' where site_id = $1`, [c.site])
      expect(await falta(t)).toBe('manifesto')   // selado ANTES do recebimento da unidade
      await pg.query(`update public.obs_archive_months set sealed_at = now() - interval '10 minutes', b2_attested_at = now() where site_id = $1`, [c.site])
      expect(await falta(t)).toBe('b2_nova')     // sem b2_files da unidade
      await b2(c, `u:${vn}`)
      expect(await falta(t)).toBe('b2_nova')     // falta o papel do resumo
      await b2(c, `s:${sm}:canal`)
      expect(await falta(t)).toBeNull()
      await pg.query(`update public.obs_archive_m9_interruptor set ligado = false where site_id = $1`, [c.site])
      expect(await falta(t)).toBe('m9_desligado')
    })
  })

  it('antiga_so_sai_depois_da_nova_conferida (Review Focus 1)', async () => {
    await emTx(async c => {
      const { v1, t, aus } = await pronta(c)
      await pg.query(`delete from public.obs_archive_b2_files where site_id = $1`, [c.site])   // a nova perde a conferência do B2
      await ligar(c)
      expect(await falta(t)).toBe('b2_nova')
      await advance(c)
      expect((await lerAlvo(t)).estado).toBe('aguardando_nova')
      expect((await lerAus(aus)).liberado_em).toBeNull()
      const v2 = (await pg.query(`select id from public.obs_archive_units where site_id = $1 and version = 2`, [c.site])).rows[0].id as string
      await b2(c, `u:${v2}`)
      expect(await falta(t)).toBeNull()
      expect(await advance(c)).toBeGreaterThan(0)
      expect((await lerAlvo(t)).estado).toBe('apagar_antigas')
      expect((await lerAus(aus)).liberado_em).not.toBeNull()
      expect((await pg.query(`select superseded_at from public.obs_archive_units where id = $1`, [v1])).rows[0].superseded_at).not.toBeNull()
    })
  })

  it('item_advance: desligado', async () => {
    await emTx(async c => {
      const { t } = await pronta(c)
      const item = await itemRemovido(c, 'yt-livre')
      await advance(c)
      expect((await lerAlvo(t)).estado).toBe('aguardando_nova')
      const r = (await pg.query(`select archive_pending, archive_note from public.competitor_removed_items where id = $1`, [item])).rows[0]
      expect(r.archive_pending).toBe(false)
      expect(r.archive_note).toBe('arquivo limpo')
    })
  })

  it('apagar_antigas -> conferir_b2 -> concluido', async () => {
    await emTx(async c => {
      await ligar(c)
      const v1 = await unidade(c, { v: 1, idade: 5 })
      const v2 = await unidade(c, { v: 2 })
      const t = await alvo(c, v1, v2, { estado: 'apagar_antigas', item: 1 })
      const a1 = await ausencia(c, t, 'serie/a.csv.gz', `liberado_em = now()`)
      const a2 = await ausencia(c, t, 'serie/b.csv.gz', `liberado_em = now()`)
      await advance(c)
      expect((await lerAlvo(t)).estado).toBe('apagar_antigas')
      await pg.query(`update public.obs_archive_absence set nas_absent_first_at = now(), nas_absent_at = now(), snap_absent_at = now() where id = any($1)`, [[a1, a2]])
      await advance(c)
      expect((await lerAlvo(t)).estado).toBe('conferir_b2')
      await pg.query(`update public.obs_archive_absence set b2_absent_at = now() where id = any($1)`, [[a1, a2]])
      await advance(c)
      const f = await lerAlvo(t)
      expect(f.estado).toBe('concluido'); expect(f.done_at).not.toBeNull()
      expect((await lerAus(a1)).encerrada_at).not.toBeNull()
      // alvo sem nenhuma linha de ausência: concluído direto
      const v3 = await unidade(c, { v: 3 })
      const t2 = await alvo(c, v1, v3, { estado: 'apagar_antigas', ref: 'yt2', item: 2, geracao: 2 })
      await advance(c)
      expect((await lerAlvo(t2)).estado).toBe('concluido')
    })
  })

  it('bandeira por chave', async () => {
    await emTx(async c => {
      await ligar(c)
      const v1 = await unidade(c, { v: 1, idade: 5 })
      const v2 = await unidade(c, { v: 2 })
      const i1 = await itemRemovido(c, 'yt1'); const i2 = await itemRemovido(c, 'yt2'); const i3 = await itemRemovido(c, 'yt3')
      const tA = await alvo(c, v1, v2, { estado: 'apagar_antigas', ref: 'yt1', item: Number(i1) })
      await pg.query(`update public.obs_archive_item_targets set item_refs = array['yt1', 'yt2'] where id = $1`, [tA])
      // yt3 tem alvo ainda aberto em outro mês
      const v1b = await unidade(c, { v: 1, tabela: 'competitor_video_early', idade: 5 })
      const v2b = await unidade(c, { v: 2, tabela: 'competitor_video_early' })
      await pg.query(
        `insert into public.obs_archive_item_targets (site_id, item_kind, item_refs, item_id, class, table_name, channel_ref, month, keys, esperadas, from_unit_id, from_version, estado, to_unit_id, to_version)
         values ($1, 'video', array['yt3'], $2, 'serie', 'competitor_video_early', $3, $4::date, array[$5], 4, $6, 1, 'aguardando_nova', $7, 2)`, [c.site, Number(i3), c.canal, MES, c.video, v1b, v2b])
      await advance(c)   // alvo A (sem linhas) conclui
      const flags = async (): Promise<Record<string, boolean>> => Object.fromEntries((await pg.query(
        `select youtube_id, archive_pending from public.competitor_removed_items where site_id = $1`, [c.site])).rows.map(r => [r.youtube_id as string, r.archive_pending as boolean]))
      expect(await flags()).toEqual({ yt1: false, yt2: false, yt3: true })
      expect((await pg.query(`select archive_note from public.competitor_removed_items where id = $1`, [i1])).rows[0].archive_note).toBe('arquivo limpo')
      expect((await pg.query(`select archive_note from public.competitor_removed_items where id = $1`, [i2])).rows[0].archive_note).toBe('arquivo limpo')
      expect((await pg.query(`select archive_note from public.competitor_removed_items where id = $1`, [i3])).rows[0].archive_note).toBeNull()
      // reabrir religa a bandeira (archive_note nulo)
      // (reabrir de alvo concluído com keys esvaziadas viola o check D-M9-25b: anotado no ledger; aqui um alvo ainda em conferir_b2)
      const v1c = await unidade(c, { v: 1, tabela: 'competitor_video_hourly', classe: 'horaria', idade: 5 })
      const tB = await alvo(c, v1c, null, { estado: 'conferir_b2', ref: 'yt1', item: Number(i1), geracao: 2 })
      await pg.query(`update public.obs_archive_item_targets set class = 'horaria', table_name = 'competitor_video_hourly' where id = $1`, [tB])
      const linha = await ausencia(c, tB, 'serie/volta.csv.gz', `liberado_em = now()`)
      await pg.query(`select public.obs_archive_reabrir($1, 'nas')`, [linha])
      expect(await flags()).toEqual({ yt1: true, yt2: false, yt3: true })
      expect((await pg.query(`select archive_note from public.competitor_removed_items where id = $1`, [i1])).rows[0].archive_note).toBeNull()
    })
  })

  it('reabrir: linha de alvo concluído não muda nada e não erra (ponto 2 do controlador; check D-M9-25b intacto)', async () => {
    await emTx(async c => {
      await ligar(c)
      const i1 = await itemRemovido(c, 'yt1')
      const v1 = await unidade(c, { v: 1, idade: 5 })
      const v2 = await unidade(c, { v: 2 })
      const t = await alvo(c, v1, v2, { estado: 'apagar_antigas', item: Number(i1) })
      const linha = await ausencia(c, t, 'serie/a.csv.gz', `liberado_em = now(), nas_absent_first_at = now(), nas_absent_at = now(), snap_absent_at = now(), b2_absent_at = now(), encerrada_at = now()`)
      await advance(c)
      const antes = await lerAlvo(t)
      expect(antes.estado).toBe('concluido'); expect(antes.keys).toEqual([])
      const ausAntes = await lerAus(linha)
      const flagAntes = (await pg.query(`select archive_pending, archive_note from public.competitor_removed_items where id = $1`, [i1])).rows[0]
      for (const nivel of ['nas', 'b2']) {
        const r = await tenta(pg, `select public.obs_archive_reabrir($1, $2)`, [linha, nivel])
        expect(r.ok, JSON.stringify(r)).toBe(true)
      }
      expect(await lerAlvo(t)).toEqual(antes)
      expect(await lerAus(linha)).toEqual(ausAntes)
      expect((await pg.query(`select archive_pending, archive_note from public.competitor_removed_items where id = $1`, [i1])).rows[0]).toEqual(flagAntes)
    })
  })

  it('índices da ausência: (site_id, prefixo) existe e item_advance filtra por site_id', async () => {
    await emTx(async () => {
      expect(await escalar<number>(pg, `select count(*)::int from pg_indexes where schemaname = 'public' and tablename = 'obs_archive_absence' and indexname = 'idx_oaa_prefixo' and indexdef like '%(site_id, prefixo)%'`)).toBe(1)
      const src = await escalar<string>(pg, `select prosrc from pg_proc where oid = 'public.obs_archive_item_advance(uuid)'::regprocedure`)
      expect(src).not.toMatch(/obs_archive_absence a where a\.alvo_id/)
      expect(src).not.toMatch(/absence set encerrada_at = now\(\) where alvo_id/)
    })
  })

  it('manifesto antigo', async () => {
    await emTx(async c => {
      const v1 = await unidade(c, { v: 1, idade: 5 })
      const v2 = await unidade(c, { v: 2 })
      await mes(c)
      const t = await alvo(c, v1, v2, { item: 1 })
      await pg.query(`update public.obs_archive_months set manifest_version = 1, manifest_sha256 = $2, manifest_list_sha256 = $3 where site_id = $1`, [c.site, H('1'), H('2')])
      await pg.query(`update public.obs_archive_months set manifest_version = 2, manifest_sha256 = $2, manifest_list_sha256 = $3 where site_id = $1`, [c.site, H('3'), H('4')])
      const l = (await pg.query(`select * from public.obs_archive_absence where site_id = $1 and alvo = $2 order by prefixo`, [c.site, `alvo:${t}`])).rows
      expect(l).toHaveLength(2)
      expect(l.map(x => x.sha256).sort()).toEqual([H('1'), H('2')].sort())
      expect(l.map(x => x.nova_sha256).sort()).toEqual([H('3'), H('4')].sort())
      // mês sem alvo aberto: nenhuma
      await pg.query(`update public.obs_archive_item_targets set estado = 'concluido', done_at = now() where id = $1`, [t])
      await pg.query(`update public.obs_archive_months set manifest_version = 3, manifest_sha256 = $2, manifest_list_sha256 = $3 where site_id = $1`, [c.site, H('5'), H('6')])
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_absence where site_id = $1`, [c.site])).toBe(2)
    })
  })

  it('reconferir não pede a antiga superada', async () => {
    await emTx(async c => {
      await ligar(c)
      const { v1, t } = await pronta(c)
      await advance(c)
      expect((await lerAlvo(t)).estado).toBe('apagar_antigas')
      expect((await pg.query(`select superseded_at from public.obs_archive_units where id = $1`, [v1])).rows[0].superseded_at).not.toBeNull()
      const plano = (await pg.query(`select public.obs_archive_plan($1, true, null) as p`, [c.site])).rows[0].p as Record<string, unknown>
      expect(JSON.stringify(plano.reconferir ?? [])).not.toContain(`u:${v1}`)
    })
  })

  const antigasQ = (c: Cena) => pg.query(`select * from public.obs_archive_absence where site_id = $1 and alvo like 'antiga:%' order by prefixo`, [c.site])
  it('texto superado aos 30 dias', async () => {
    await emTx(async c => {
      const o = { classe: 'texto', tabela: COMENT } as const
      const v1 = await unidade(c, { ...o, v: 1, superada: true, idade: 60 })
      const v2 = await unidade(c, { ...o, v: 2, idade: 31, atestadaHa: '1 hour' })   // recebida há 31 d, o NAS a confirmou há 1 h (Phil C1 a)
      await b2(c, `u:${v2}`, 'texto', 1)
      expect(await escalar<number>(pg, `select public.obs_archive_antigas_open($1)`, [c.site])).toBe(1)
      const l = (await antigasQ(c)).rows
      expect(l).toHaveLength(1)
      expect(l[0].alvo).toBe(`antiga:${v1}`); expect(l[0].liberado_em).not.toBeNull()
      // idempotente
      expect(await escalar<number>(pg, `select public.obs_archive_antigas_open($1)`, [c.site])).toBe(0)
    })
    await emTx(async c => {   // 29 dias: nada
      const o = { classe: 'texto', tabela: COMENT } as const
      await unidade(c, { ...o, v: 1, superada: true, idade: 60 })
      const v2 = await unidade(c, { ...o, v: 2, idade: 29, atestadaHa: '1 hour' })
      await b2(c, `u:${v2}`, 'texto', 1)
      expect(await escalar<number>(pg, `select public.obs_archive_antigas_open($1)`, [c.site])).toBe(0)
    })
    await emTx(async c => {   // classe serie: nunca
      await unidade(c, { v: 1, superada: true, idade: 60 })
      const v2 = await unidade(c, { v: 2, idade: 40, atestadaHa: '1 hour' })
      await b2(c, `u:${v2}`, 'serie', 1)
      expect(await escalar<number>(pg, `select public.obs_archive_antigas_open($1)`, [c.site])).toBe(0)
    })
    await emTx(async c => {   // canal com remoção: nunca
      const o = { classe: 'texto', tabela: COMENT } as const
      await unidade(c, { ...o, v: 1, superada: true, idade: 60 })
      const v2 = await unidade(c, { ...o, v: 2, idade: 40, atestadaHa: '1 hour' })
      await b2(c, `u:${v2}`, 'texto', 1)
      await pg.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known) values ($1, $2, 'botao', 'apagar', now(), true)`, [c.site, c.canal])
      expect(await escalar<number>(pg, `select public.obs_archive_antigas_open($1)`, [c.site])).toBe(0)
    })
    await emTx(async c => {   // versão com linha alvo: do expurgo: nunca duplica
      const o = { classe: 'texto', tabela: COMENT } as const
      const v1 = await unidade(c, { ...o, v: 1, superada: true, idade: 60 })
      const v2 = await unidade(c, { ...o, v: 2, idade: 40, atestadaHa: '1 hour' })
      await b2(c, `u:${v2}`, 'texto', 1)
      const cam = await escalar<string>(pg, `select (public.obs_archive_arquivos_da_unidade($1)->0->>'caminho')`, [v1])
      const t = await alvo(c, v1, v2, { estado: 'apagar_antigas', item: 1 })
      await pg.query(`update public.obs_archive_item_targets set class = 'texto', table_name = $2 where id = $1`, [t, COMENT])
      await pg.query(`insert into public.obs_archive_absence (site_id, alvo, alvo_id, filho, prefixo, e_prefixo, sha256) values ($1, $2, $3, 'texto', $4, false, $5)`, [c.site, `alvo:${t}`, t, cam, H('e')])
      expect(await escalar<number>(pg, `select public.obs_archive_antigas_open($1)`, [c.site])).toBe(0)
    })
  })

  it('texto superado em partes da antiga: uma linha por parte (ponto 1 do controlador)', async () => {
    await emTx(async c => {
      const o = { classe: 'texto', tabela: COMENT } as const
      await unidade(c, { ...o, v: 1, superada: true, idade: 60, partes: 2 })
      const v2 = await unidade(c, { ...o, v: 2, idade: 40, atestadaHa: '1 hour' })
      await b2(c, `u:${v2}`, 'texto', 1)
      expect(await escalar<number>(pg, `select public.obs_archive_antigas_open($1)`, [c.site])).toBe(2)
      expect((await antigasQ(c)).rows).toHaveLength(2)
    })
  })

  it('antigas_open: os 30 dias contam do recebimento da nova, não da última conferência (Phil C1, b a e)', async () => {
    const o = { classe: 'texto', tabela: COMENT } as const
    const abre = (c: Cena) => escalar<number>(pg, `select public.obs_archive_antigas_open($1)`, [c.site])
    await emTx(async c => {   // b: recebida há 31 d, atestada há 31 d (copiador parado) => 0
      await unidade(c, { ...o, v: 1, superada: true, idade: 60 })
      const v2 = await unidade(c, { ...o, v: 2, idade: 31 })
      await b2(c, `u:${v2}`, 'texto', 1)
      expect(await abre(c)).toBe(0)
    })
    await emTx(async c => {   // B2 conferiu há 31 d (rodízio parado) => 0
      await unidade(c, { ...o, v: 1, superada: true, idade: 60 })
      const v2 = await unidade(c, { ...o, v: 2, idade: 31, atestadaHa: '1 hour' })
      await b2(c, `u:${v2}`, 'texto', 31)
      expect(await abre(c)).toBe(0)
    })
    await emTx(async c => {   // c: nova retirada do NAS (nas_withdrawn_at) => 0
      await unidade(c, { ...o, v: 1, superada: true, idade: 60 })
      const v2 = await unidade(c, { ...o, v: 2, idade: 31, atestadaHa: '1 hour', retirada: true })
      await b2(c, `u:${v2}`, 'texto', 1)
      expect(await abre(c)).toBe(0)
    })
    await emTx(async c => {   // d: nova com 2 partes, só a :01 no B2 => 0; as duas => 2 linhas (antiga inteira, 1 parte)
      await unidade(c, { ...o, v: 1, superada: true, idade: 60 })
      const v2 = await unidade(c, { ...o, v: 2, idade: 31, atestadaHa: '1 hour', partes: 2 })
      await b2(c, `p:${v2}:01`, 'texto', 1)
      expect(await abre(c)).toBe(0)
      await b2(c, `p:${v2}:02`, 'texto', 1)
      expect(await abre(c)).toBe(1)
    })
    await emTx(async c => {   // e: a nova está perdida (lost_at) e a anterior superada => 0
      await unidade(c, { ...o, v: 1, superada: true, idade: 60 })
      const v2 = await unidade(c, { ...o, v: 2, idade: 31, atestadaHa: '1 hour', perdida: true })
      await b2(c, `u:${v2}`, 'texto', 1)
      expect(await abre(c)).toBe(0)
    })
  })

  it('marcar_rodado', async () => {
    await emTx(async c => {
      const outro = await criarUsuario(pg)
      const item = (await pg.query(
        `insert into public.competitor_removed_items (site_id, kind, youtube_id, competitor_channel_id, decided_at, decided_by, rows_deleted)
         values ($1, 'video', 'yt1', $2, now(), $3, '{}'::jsonb) returning id`, [c.site, c.canal, c.admin])).rows[0].id as string
      await pg.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known) values ($1, $2, 'botao', 'apagar', now(), true)`, [c.site, c.canal])
      const m = (id: string, actor: string, desfazer = false) => tenta(pg, `select public.obs_archive_marcar_rodado($1, $2, $3, $4) as r`, [c.site, id, actor, desfazer])
      const sem = await m(`item:${item}`, outro)
      expect(sem.ok).toBe(false); if (!sem.ok) expect(sem.message).toContain('sem_permissao')
      expect((await m(`item:${item}`, c.admin)).ok).toBe(true)
      expect((await pg.query(`select marcado_rodado_em from public.competitor_removed_items where id = $1`, [item])).rows[0].marcado_rodado_em).not.toBeNull()
      expect((await m(`canal:${c.canal}`, c.admin)).ok).toBe(true)
      expect((await pg.query(`select marcado_rodado_em from public.obs_archive_channel_removals where site_id = $1`, [c.site])).rows[0].marcado_rodado_em).not.toBeNull()
      const inv = await m(`antiga:${randomUUID()}`, c.admin)
      expect(inv.ok).toBe(false); if (!inv.ok) expect(inv.message).toContain('item_invalido')
      expect((await m(`item:${item}`, c.admin, true)).ok).toBe(true)
      expect((await pg.query(`select marcado_rodado_em from public.competitor_removed_items where id = $1`, [item])).rows[0].marcado_rodado_em).toBeNull()
      const des = await m('item:999999999', c.admin)
      expect(des.ok).toBe(false); if (!des.ok) expect(des.message).toContain('item_desconhecido')
    })
  })

  it('arquivos_do_canal', async () => {
    await emTx(async c => {
      const v1 = await unidade(c, { v: 1, superada: true, idade: 5 })
      const v2 = await unidade(c, { v: 2 })
      // D-M9-10: o registro é o que se conhece, também o perdido e o purgado (gatilhos de perda/purga desligados só nesta transação desfeita)
      await pg.query(`set local session_replication_role = replica`)
      await pg.query(`update public.obs_archive_units set lost_at = now(), lost_by = 'teste', lost_reason = 'nunca_recebida' where id = $1`, [v1])
      await pg.query(`update public.obs_archive_units set purged_at = now(), purged_by = $2, purge_ref = 'teste' where id = $1`, [v2, c.admin])
      await pg.query(`set local session_replication_role = origin`)
      const v3 = await unidade(c, { v: 3, partes: 2 })
      await pg.query(`insert into public.obs_archive_summaries (site_id, class, channel_ref, month, version, empty, canal_sha256, video_sha256, unit_hashes, origem)
        values ($1, 'serie', $2, $3::date, 1, false, $4, $5, '{}'::jsonb, 'expurgo')`, [c.site, c.canal, MES, H('7'), H('8')])
      const lista = (await pg.query(`select public.obs_archive_arquivos_do_canal($1, $2) as l`, [c.site, c.canal])).rows[0].l as Array<{ caminho: string; sha256: string; filho: string }>
      expect(v2).toBeTruthy(); expect(v3).toBeTruthy()
      // v1 + v2 (arquivo único) + 2 partes da v3 (a v3 não tem sha de arquivo único) + 2 papéis de resumo
      expect(lista).toHaveLength(6)
      expect(lista.every(x => /^[0-9a-f]{64}$/.test(x.sha256))).toBe(true)
      expect(lista.filter(x => x.caminho.includes('/resumo/'))).toHaveLength(2)
      expect(await escalar<number>(pg, `select jsonb_array_length(public.obs_archive_arquivos_do_canal($1, $2))`, [c.site, randomUUID()])).toBe(0)
    })
  })

  it('sonda_custo_item_advance: 2.000 alvos, 4.000 linhas de ausência', async () => {
    await emTx(async c => {
      await ligar(c)
      await pg.query(
        `insert into public.obs_archive_item_targets (site_id, item_kind, item_refs, class, table_name, channel_ref, month, keys, from_unit_id, from_version, estado)
         select $1, 'video', array['y' || g], 'serie', $2, gen_random_uuid()::text, $3::date, array['k'], gen_random_uuid(), 1, case when g <= 1500 then 'apagar_antigas' else 'aguardando_nova' end
           from generate_series(1, 2000) g`, [c.site, DAILY, MES])
      await pg.query(
        `insert into public.obs_archive_absence (site_id, alvo, alvo_id, filho, prefixo, e_prefixo, liberado_em, encerrada_at)
         select $1, 'alvo:' || t.id, t.id, 'numerico', 'serie/p' || t.id || '/' || k, true, now(), case when t.id % 20 <> 0 then now() end
           from public.obs_archive_item_targets t, generate_series(1, 2) k where t.site_id = $1 and t.estado = 'apagar_antigas'`, [c.site])
      await pg.query('analyze public.obs_archive_absence'); await pg.query('analyze public.obs_archive_item_targets')
      const t0 = Date.now()
      const n = await escalar<number>(pg, `select public.obs_archive_item_advance($1)`, [c.site])
      const ms = Date.now() - t0
      console.log(`SONDA item_advance: ${ms} ms para 2.000 alvos (1.500 apagar_antigas com 3.000 linhas, 2.850 encerradas; 500 aguardando_nova); avançou ${n}`)
      expect(ms).toBeLessThan(5000)
    })
  })

  it('permissões', async () => {
    await emTx(async () => {
      const prv = (r: string, f: string): Promise<boolean> => escalar<boolean>(pg, `select has_function_privilege($1, $2::regprocedure, 'execute')`, [r, f])
      const fns = ['public.obs_archive_item_falta(bigint)', 'public.obs_archive_item_advance(uuid)', 'public.obs_archive_antigas_open(uuid)', 'public.obs_archive_manifesto_antigo()',
        'public.obs_archive_apagar_do_item(uuid,bigint)', 'public.obs_archive_apagar_da_antiga(uuid,text)', 'public.obs_archive_arquivos_do_canal(uuid,text)',
        'public.obs_archive_etapa(bigint,bigint,bigint,timestamptz,bigint,boolean,timestamptz)']
      for (const f of fns) for (const r of ['anon', 'authenticated', 'service_role']) expect(await prv(r, f), `${r} ${f}`).toBe(false)
      const mr = 'public.obs_archive_marcar_rodado(uuid,text,uuid,boolean)'
      expect(await prv('service_role', mr)).toBe(true)
      expect(await prv('anon', mr)).toBe(false); expect(await prv('authenticated', mr)).toBe(false)
    })
  })
})
