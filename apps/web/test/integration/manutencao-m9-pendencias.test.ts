// @vitest-environment node
/** M9 Tarefa 5, parte 6: wrappers do plano (sem editar função da M3b), lista de canais e pendências do dono na versao 2. Tudo em begin … rollback (54422). */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { m3bNoBanco, aplicarM3b, escalar, tenta, semearCanal } from '../helpers/m3b'
import { criarUsuario } from '../helpers/mg6'
import { aplicarM9, sqlM9Resolvido, m9NoBanco } from '../helpers/m9'
import { travarDdl } from '../helpers/ddl-testes'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const H = (ch: string): string => ch.repeat(64)
const DAILY = 'competitor_video_daily'
const MES = '2026-09-01'
const FNS_BASE = ['obs_archive_plan', 'obs_archive_b2_plan', 'obs_archive_removed_channel_list'] as const

type Cena = { site: string; canal: string; video: string; admin: string; md5Original: Record<string, string> }
type Pend = { versao: number; total: number; itens: Array<Record<string, unknown>> }
const CHAVES = ['item_id', 'kind', 'tempo', 'falta', 'motivo', 'desde', 'mes', 'channel_ref', 'youtube_id', 'marcado_rodado_em', 'bloqueados', 'snapshot_mais_antigo', 'snap_espera_desde', 'snap_libera_em', 'snap_bloqueio', 'apagar', 'b2_nomes', 'prefixos']

describe.skipIf(skipIfNoLocalDb())('M9 parte 6: wrappers do plano, lista de canais e pendências na versao 2', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })

  async function emTx(fn: (c: Cena) => Promise<void>): Promise<void> {
    await pg.query('begin'); await pg.query('select pg_advisory_xact_lock(7339001)')
    try {
      if (!(await m3bNoBanco(pg))) await aplicarM3b(pg)
      await travarDdl(pg)
      // o corpo original da M3b, lido ANTES de a M9 renomear (dentro da transação desfeita)
      // Com a M9 já instalada (CI/produção) o corpo da M3b vive em <nome>_base e o nome original é o wrapper: lê a _base.
      const md5Original = Object.fromEntries((await pg.query(
        `select p.proname, md5(p.prosrc) as m from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any($1)`, [FNS_BASE])).rows.map(r => [r.proname as string, r.m as string]))
      if (await m9NoBanco(pg)) for (const f of FNS_BASE) md5Original[f] = await escalar<string>(pg, `select md5(prosrc) from pg_proc where pronamespace = 'public'::regnamespace and proname = $1`, [f + '_base'])
      await aplicarM9(pg, 6)
      const s = await semearCanal(pg, { videos: 1 })
      const admin = await criarUsuario(pg)
      await fn({ site: s.site, canal: s.canal, video: s.videos[0]!, admin, md5Original })
    } finally { await pg.query('rollback') }
  }
  const ligar = (c: Cena, v = true) => pg.query(
    `insert into public.obs_archive_m9_interruptor (site_id, ligado) values ($1, $2) on conflict (site_id) do update set ligado = excluded.ligado`, [c.site, v])
  const pend = async (c: Cena): Promise<Pend> => (await pg.query(`select public.obs_archive_owner_pending($1) as r`, [c.site])).rows[0].r as Pend
  const um = async (c: Cena, id: string): Promise<Record<string, unknown>> => {
    const r = (await pend(c)).itens.filter(x => x.item_id === id)
    expect(r, `item ${id}`).toHaveLength(1)
    return r[0]!
  }

  async function unidade(c: Cena, o: { v: number; tabela?: string; classe?: string; linhas?: number; recebida?: boolean; atestada?: boolean; origem?: string | null }): Promise<string> {
    return (await pg.query(
      `insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, control_sum, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, parts, origem, received_at, nas_attested_at)
       values ($1, $2, $3, $4, $5::date, $6, $7, 100, $8, $9, $10, $11, 100, 1, coalesce($12, 'rota'), case when $13 then now() - interval '1 day' end, case when $14 then now() - interval '1 day' end) returning id`,
      [c.site, o.classe ?? 'serie', o.tabela ?? DAILY, c.canal, MES, o.v, o.linhas ?? 10, H('a'), H('b'), H(String(o.v)), H('c'), o.origem ?? null, o.recebida ?? true, o.atestada ?? true])).rows[0].id as string
  }
  async function itemRemovido(c: Cena, ref: string): Promise<number> {
    return Number((await pg.query(
      `insert into public.competitor_removed_items (site_id, kind, youtube_id, competitor_channel_id, decided_at, decided_by, rows_deleted)
       values ($1, 'video', $2, $3, now(), $4, '{}'::jsonb) returning id`, [c.site, ref, c.canal, c.admin])).rows[0].id)
  }
  async function alvo(c: Cena, item: number, de: string, o: { estado: string; para?: string | null; tabela?: string; motivo?: string; ref?: string }): Promise<number> {
    const id = Number((await pg.query(
      `insert into public.obs_archive_item_targets (site_id, item_kind, item_refs, item_id, class, table_name, channel_ref, month, keys, esperadas, from_unit_id, from_version, estado, to_unit_id, to_version, motivo, done_at)
       values ($1, 'video', array[$2], $3, 'serie', $4, $5, $6::date, array[$7], 4, $8, 1, $9, $10, case when $10::uuid is null then null else 2 end, $11, case when $9 = 'concluido' then now() end) returning id`,
      [c.site, o.ref ?? 'yt1', item, o.tabela ?? DAILY, c.canal, MES, c.video, de, o.estado, o.para ?? null, o.motivo ?? null])).rows[0].id)
    return id
  }
  async function linha(c: Cena, alvoTxt: string, prefixo: string, o: { alvoId?: number; unidadeId?: string; canalRef?: string; extra?: string } = {}): Promise<number> {
    const id = Number((await pg.query(
      `insert into public.obs_archive_absence (site_id, alvo, canal_ref, alvo_id, unidade_id, filho, prefixo, e_prefixo, sha256, liberado_em)
       values ($1, $2, $3, $4, $5, 'numerico', $6, false, $7, now()) returning id`,
      [c.site, alvoTxt, o.canalRef ?? null, o.alvoId ?? null, o.unidadeId ?? null, prefixo, H('e')])).rows[0].id)
    if (o.extra) await pg.query(`update public.obs_archive_absence set ${o.extra} where id = $1`, [id])
    return id
  }
  const stub = (fn: string, assinatura: string, corpo: unknown) => pg.query(
    `create or replace function public.${fn}${assinatura} returns jsonb language sql as $$ select '${JSON.stringify(corpo)}'::jsonb $$`)

  it('wrappers: renomeio idempotente', async () => {
    await emTx(async c => {
      await pg.query(await sqlM9Resolvido(pg, 6))   // aplicar a M9 pela segunda vez
      for (const f of FNS_BASE) {
        expect(await escalar<number>(pg, `select count(*)::int from pg_proc where pronamespace = 'public'::regnamespace and proname = $1`, [f + '_base'])).toBe(1)
        expect(await escalar<number>(pg, `select count(*)::int from pg_proc where pronamespace = 'public'::regnamespace and proname = $1`, [f])).toBe(1)
        // a base não foi editada: mesmo md5 do texto da M3b
        expect(await escalar<string>(pg, `select md5(prosrc) from pg_proc where pronamespace = 'public'::regnamespace and proname = $1`, [f + '_base'])).toBe(c.md5Original[f])
      }
      const prv = (r: string, f: string): Promise<boolean> => escalar<boolean>(pg, `select has_function_privilege($1, $2::regprocedure, 'execute')`, [r, f])
      for (const r of ['anon', 'authenticated', 'service_role', 'public']) {
        for (const f of ['obs_archive_plan_base(uuid,boolean,text)', 'obs_archive_b2_plan_base(uuid,boolean,text)', 'obs_archive_removed_channel_list_base(uuid)']) {
          if (r !== 'public') expect(await prv(r, `public.${f}`), `${r} ${f}`).toBe(false)
        }
      }
    })
  })

  it('plan: filtra o que o expurgo está refazendo', async () => {
    await emTx(async c => {
      const base = { exportar: [{ classe: 'serie', tabela: DAILY, canal: c.canal, mes: '2026-09', motivo: 'x' }, { classe: 'serie', tabela: DAILY, canal: c.canal, mes: '2026-08', motivo: 'x' }],
        resumos: [{ classe: 'serie', canal: c.canal, mes: '2026-09' }, { classe: 'serie', canal: c.canal, mes: '2026-08' }],
        aguardando_dono: [], manifestos: [], vermelhos: [], a_apagar: [], reconferir: [], prefixos_ausentes: [] }
      await stub('obs_archive_plan_base', '(p_site uuid, p_completo boolean, p_cursor text)', base)
      const v1 = await unidade(c, { v: 1 })
      const item = await itemRemovido(c, 'yt1')
      for (const estado of ['copiar', 'aguardando_nova', 'bloqueado']) {
        const t = await alvo(c, item, v1, { estado, motivo: estado === 'bloqueado' ? 'antiga_ausente' : undefined })
        const p = (await pg.query(`select public.obs_archive_plan($1, false, null) as p`, [c.site])).rows[0].p as { exportar: Array<{ mes: string }>; resumos: Array<{ mes: string }> }
        expect(p.exportar.map(e => e.mes), estado).toEqual(['2026-08']); expect(p.resumos.map(e => e.mes), estado).toEqual(['2026-08'])
        await pg.query(`delete from public.obs_archive_item_targets where id = $1`, [t])
      }
      const tc = await alvo(c, item, v1, { estado: 'concluido' })
      expect(tc).toBeGreaterThan(0)
      const p = (await pg.query(`select public.obs_archive_plan($1, false, null) as p`, [c.site])).rows[0].p as { exportar: unknown[]; resumos: unknown[] }
      expect(p.exportar).toHaveLength(2); expect(p.resumos).toHaveLength(2)
    })
  })

  it('plan: aguardando_dono e manifestos do expurgo', async () => {
    await emTx(async c => {
      await stub('obs_archive_plan_base', '(p_site uuid, p_completo boolean, p_cursor text)',
        { exportar: [], resumos: [], aguardando_dono: [], manifestos: [], vermelhos: [], a_apagar: [], reconferir: [], prefixos_ausentes: [] })
      const u = await unidade(c, { v: 2, recebida: false, atestada: false, origem: 'expurgo' })
      const sm = (await pg.query(`insert into public.obs_archive_summaries (site_id, class, channel_ref, month, version, empty, canal_sha256, video_sha256, unit_hashes, origem)
        values ($1, 'serie', $2, $3::date, 1, false, $4, $5, '{}'::jsonb, 'expurgo') returning id`, [c.site, c.canal, MES, H('7'), H('8')])).rows[0].id as string
      await pg.query(`insert into public.obs_archive_months (site_id, class, table_name, month, unsealed_at, unsealed_reason) values ($1, 'serie', $2, $3::date, now(), 'expurgo')`, [c.site, DAILY, MES])
      const plano = async (): Promise<{ aguardando_dono: Array<{ arquivo_id: string; tipo: string; caminho: string; versao: number }>; manifestos: Array<{ classe: string; mes: string }> }> =>
        (await pg.query(`select public.obs_archive_plan($1, false, null) as p`, [c.site])).rows[0].p
      let p = await plano()
      const ids = p.aguardando_dono.map(x => x.arquivo_id)
      expect(ids).toEqual(expect.arrayContaining([`u:${u}`, `s:${sm}:canal`, `s:${sm}:video`]))
      expect(p.aguardando_dono.find(x => x.arquivo_id === `u:${u}`)).toMatchObject({ tipo: 'unidade', versao: 2 })
      expect(p.aguardando_dono.find(x => x.arquivo_id === `s:${sm}:canal`)?.tipo).toBe('resumo')
      expect(p.manifestos).toHaveLength(0)   // ainda nada recebido
      await pg.query(`update public.obs_archive_units set received_at = now() where id = $1`, [u])
      await pg.query(`update public.obs_archive_summaries set received_at = now(), received_papers = array['canal', 'video'] where id = $1`, [sm])
      p = await plano()
      expect(p.aguardando_dono.map(x => x.arquivo_id)).not.toContain(`u:${u}`)
      expect(p.manifestos).toEqual([{ classe: 'serie', mes: '2026-09' }])
    })
  })

  it('plan: prefixos_ausentes e captura', async () => {
    await emTx(async c => {
      const vazio = { exportar: [], resumos: [], aguardando_dono: [], manifestos: [], vermelhos: [], a_apagar: [], reconferir: [], prefixos_ausentes: [] }
      await stub('obs_archive_plan_base', '(p_site uuid, p_completo boolean, p_cursor text)', vazio)
      await stub('obs_archive_b2_plan_base', '(p_site uuid, p_completo boolean, p_cursor text)', { arquivos: [], prefixos_ausentes: [] })
      const item = await itemRemovido(c, 'yt1')
      const v1 = await unidade(c, { v: 1 }); const v2 = await unidade(c, { v: 2 })
      const t = await alvo(c, item, v1, { estado: 'apagar_antigas', para: v2 })
      await linha(c, `alvo:${t}`, 'serie/a.csv.gz', { alvoId: t, extra: `nas_absent_first_at = now(), nas_absent_at = now(), nas_last_absent_at = now(), snap_absent_at = now()` })
      const nas = async (): Promise<unknown> => (await pg.query(`select public.obs_archive_plan($1, false, null) as p`, [c.site])).rows[0].p
      expect((await nas() as { prefixos_ausentes: unknown[] }).prefixos_ausentes).toEqual([])   // desligado
      await ligar(c)
      const p = await nas() as { prefixos_ausentes: unknown[]; vermelhos: string[] }
      expect(p.prefixos_ausentes).toEqual((await pg.query(`select public.obs_archive_prefixos_ausentes($1, 'nas') as r`, [c.site])).rows[0].r)
      expect(p.prefixos_ausentes).toHaveLength(1)
      // sem a captura nas funções da E9 e interruptor ligado
      expect(await escalar<boolean>(pg, `select public.obs_archive_m9_captura_presente()`)).toBe(true)
      expect(p.vermelhos.some(x => x.startsWith('captura_ausente'))).toBe(false)
      await pg.query(`create or replace function public.competitor_video_purge_fake() returns void language sql as 'select 1'`)
      await pg.query(`do $d$ declare r record; begin
        for r in select p.oid::regprocedure as f, pg_get_functiondef(p.oid) as d from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'competitor_video_purge' loop
          execute replace(r.d, 'obs_archive_item_capture', 'obs_archive_item_capturx');
        end loop; end $d$`)
      const p2 = await nas() as { vermelhos: string[] }
      expect(p2.vermelhos.some(x => x.startsWith('captura_ausente'))).toBe(true)
      // b2_plan: 'b2' na 1ª página, [] nas seguintes
      const b = async (cur: string | null): Promise<{ prefixos_ausentes: unknown[] }> => (await pg.query(`select public.obs_archive_b2_plan($1, false, $2) as p`, [c.site, cur])).rows[0].p
      expect((await b(null)).prefixos_ausentes).toEqual((await pg.query(`select public.obs_archive_prefixos_ausentes($1, 'b2') as r`, [c.site])).rows[0].r)
      expect((await b('x')).prefixos_ausentes).toEqual([])
    })
  })

  it('plan: avança antes de montar', async () => {
    await emTx(async c => {
      await stub('obs_archive_plan_base', '(p_site uuid, p_completo boolean, p_cursor text)',
        { exportar: [], resumos: [], aguardando_dono: [], manifestos: [], vermelhos: [], a_apagar: [], reconferir: [], prefixos_ausentes: [] })
      await ligar(c)
      const v1 = await unidade(c, { v: 1 }); const v2 = await unidade(c, { v: 2 })
      const item = await itemRemovido(c, 'yt1')
      const t = await alvo(c, item, v1, { estado: 'aguardando_nova', para: v2 })
      await pg.query(`insert into public.obs_archive_b2_files (site_id, arquivo_id, class, month, last_ok_at) values ($1, $2, 'serie', $3::date, now())`, [c.site, `u:${v2}`, MES])
      await pg.query(`insert into public.obs_archive_months (site_id, class, table_name, month, sealed_at, b2_attested_at) values ($1, 'serie', $2, $3::date, now(), now())`, [c.site, DAILY, MES])
      await pg.query(`update public.obs_archive_units set received_at = now() - interval '1 hour' where id = $1`, [v2])
      await linha(c, `alvo:${t}`, 'serie/a.csv.gz', { alvoId: t })   // com linha aberta o alvo fica em apagar_antigas (sem linha, iria a concluido)
      await pg.query(`update public.obs_archive_absence set liberado_em = null where alvo_id = $1`, [t])
      await pg.query(`select public.obs_archive_plan($1, false, null)`, [c.site])
      expect(await escalar<string>(pg, `select estado from public.obs_archive_item_targets where id = $1`, [t])).toBe('apagar_antigas')
    })
  })

  it('lista de canais', async () => {
    await emTx(async c => {
      const outro = randomUUID()
      await stub('obs_archive_removed_channel_list_base', '(p_site uuid)', [
        { channel_ref: c.canal, estado: 'sem_arquivo' }, { channel_ref: outro, estado: 'sem_destino' }])
      await pg.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known, completed_at) values ($1, $2, 'botao', 'apagar', now(), true, now())`, [c.site, c.canal])
      const lista = async (): Promise<Array<Record<string, unknown>>> => (await pg.query(`select public.obs_archive_removed_channel_list($1) as l`, [c.site])).rows[0].l
      let l = await lista()
      expect(l.find(x => x.channel_ref === c.canal)?.estado).toBe('concluido')
      expect(l.find(x => x.channel_ref === outro)?.estado).toBe('sem_destino')
      for (const k of ['nas_last_absent_at', 'marcado_rodado_em', 'lote_e10_aberto', 'prefixos_total', 'prefixos_ausentes_nas', 'snap_ok', 'completed_at', 'snapshot_mais_antigo']) {
        expect(Object.keys(l.find(x => x.channel_ref === c.canal)!), k).toContain(k)
      }
      await pg.query(`update public.obs_archive_channel_removals set completed_at = null where site_id = $1`, [c.site])
      await linha(c, `canal:${c.canal}`, 'serie/x.csv.gz', { canalRef: c.canal, extra: `nas_absent_first_at = now(), nas_absent_at = now()` })
      await pg.query(`update public.obs_archive_channel_removals set nas_absent_at = now() where site_id = $1`, [c.site])
      l = await lista(); expect(l.find(x => x.channel_ref === c.canal)).toMatchObject({ estado: 'apagado_nas', prefixos_total: 1, prefixos_ausentes_nas: 1, snap_ok: 0 })
      await pg.query(`update public.obs_archive_channel_removals set b2_absent_at = now() where site_id = $1`, [c.site])
      l = await lista(); expect(l.find(x => x.channel_ref === c.canal)?.estado).toBe('apagado_b2')
    })
  })

  it('pendências: forma do C12 v2', async () => {
    await emTx(async c => {
      expect(await pend(c)).toMatchObject({ versao: 2, total: 0, itens: [] })
      await ligar(c)
      const v1 = await unidade(c, { v: 1 }); const v2 = await unidade(c, { v: 2 })
      const item = await itemRemovido(c, 'yt1')
      const t = await alvo(c, item, v1, { estado: 'apagar_antigas', para: v2 })
      await linha(c, `alvo:${t}`, 'serie/a.csv.gz', { alvoId: t })
      const p = await pend(c)
      expect(p.total).toBe(1); expect(p.itens).toHaveLength(1)
      const i = p.itens[0]!
      expect(Object.keys(i).sort()).toEqual([...CHAVES].sort())
      expect(i.tempo).toBe('apagar_antigas'); expect((i.apagar as unknown[]).length).toBeGreaterThan(0)
      expect(i.b2_nomes).toEqual([])
    })
  })

  it('pendências: só lê', async () => {
    await emTx(async () => {
      const def = await escalar<string>(pg, `select pg_get_functiondef('public.obs_archive_owner_pending(uuid)'::regprocedure)`)
      expect(def).not.toMatch(/\b(insert|update|delete)\b/i)
      expect(await escalar<string>(pg, `select provolatile::text from pg_proc where oid = 'public.obs_archive_owner_pending(uuid)'::regprocedure`)).toBe('s')
    })
  })

  it('pendências: copiar vence bloqueado', async () => {
    await emTx(async c => {
      const v1 = await unidade(c, { v: 1 })
      const item = await itemRemovido(c, 'yt1')
      const tc = await alvo(c, item, v1, { estado: 'copiar' })
      await alvo(c, item, v1, { estado: 'bloqueado', tabela: 'competitor_video_early', motivo: 'antiga_ausente' })
      const i = await um(c, `item:${item}`)
      expect(i).toMatchObject({ tempo: 'copiar', bloqueados: 1 })
      // só bloqueado
      await pg.query(`delete from public.obs_archive_item_targets where id = $1`, [tc])
      expect(await um(c, `item:${item}`)).toMatchObject({ tempo: 'bloqueado', motivo: 'antiga_ausente' })
      // copiar sem grupo pronto: a versão corrente não foi recebida
      await pg.query(`delete from public.obs_archive_item_targets where item_id = $1`, [item])
      await unidade(c, { v: 2, recebida: false })
      await alvo(c, item, v1, { estado: 'copiar' })
      expect(await um(c, `item:${item}`)).toMatchObject({ tempo: 'sem_comando', falta: 'versao_em_curso' })
    })
  })

  it('pendências: aguardando_nova', async () => {
    await emTx(async c => {
      const v1 = await unidade(c, { v: 1 })
      const vn = await unidade(c, { v: 2, recebida: false, atestada: false })
      const item = await itemRemovido(c, 'yt1')
      await alvo(c, item, v1, { estado: 'aguardando_nova', para: vn })
      expect(await um(c, `item:${item}`)).toMatchObject({ tempo: 'sem_comando', falta: 'unidade_no_nas' })
      await pg.query(`update public.obs_archive_units set received_at = now() - interval '1 hour', nas_attested_at = now() - interval '1 hour' where id = $1`, [vn])
      await pg.query(`insert into public.obs_archive_months (site_id, class, table_name, month, sealed_at, b2_attested_at) values ($1, 'serie', $2, $3::date, now(), now())`, [c.site, DAILY, MES])
      await pg.query(`insert into public.obs_archive_b2_files (site_id, arquivo_id, class, month, last_ok_at) values ($1, $2, 'serie', $3::date, now())`, [c.site, `u:${vn}`, MES])
      expect(await um(c, `item:${item}`)).toMatchObject({ falta: 'm9_desligado' })
      const sm = (await pg.query(`insert into public.obs_archive_summaries (site_id, class, channel_ref, month, version, empty, canal_sha256, unit_hashes, origem)
        values ($1, 'serie', $2, $3::date, 1, false, $4, '{}'::jsonb, 'expurgo') returning id`, [c.site, c.canal, MES, H('7')])).rows[0].id as string
      expect(await um(c, `item:${item}`)).toMatchObject({ falta: 'resumo' })
      await pg.query(`update public.obs_archive_summaries set received_at = now(), nas_attested_at = now() where id = $1`, [sm])
      expect(await um(c, `item:${item}`)).toMatchObject({ falta: 'b2_nova' })
      await pg.query(`update public.obs_archive_months set sealed_at = now() - interval '2 days' where site_id = $1`, [c.site])
      expect(await um(c, `item:${item}`)).toMatchObject({ falta: 'manifesto' })
    })
  })

  it('pendências: apagar → segunda conferência → snapshots → b2', async () => {
    await emTx(async c => {
      await ligar(c)
      const v1 = await unidade(c, { v: 1 }); const v2 = await unidade(c, { v: 2 })
      const item = await itemRemovido(c, 'yt1')
      const t = await alvo(c, item, v1, { estado: 'apagar_antigas', para: v2 })
      const l = await linha(c, `alvo:${t}`, 'serie/a.csv.gz', { alvoId: t })
      const id = `item:${item}`
      const set = (x: string) => pg.query(`update public.obs_archive_absence set ${x} where id = $1`, [l])
      expect(await um(c, id)).toMatchObject({ tempo: 'apagar_antigas', falta: null })
      expect((await um(c, id)).apagar as unknown[]).toHaveLength(1)
      await set(`nas_absent_first_at = now() - interval '12 hours'`)
      expect(await um(c, id)).toMatchObject({ tempo: 'sem_comando', falta: 'segunda_conferencia' })
      await set(`nas_absent_at = now(), nas_last_absent_at = now(), snap_oldest = '2026-10-20'`)
      expect(await um(c, id)).toMatchObject({ tempo: 'sem_comando', falta: 'snapshots', snapshot_mais_antigo: '2026-10-20' })
      await set(`snap_absent_at = now(), nas_last_absent_at = now() - interval '48 hours'`)
      expect(await um(c, id)).toMatchObject({ falta: 'conferencia_nas_recente' })
      await set(`nas_last_absent_at = now()`)
      expect(await um(c, id)).toMatchObject({ falta: 'b2_sync' })
      await set(`b2_checked_at = now(), b2_nomes = array['x.csv']`)
      await pg.query(`update public.obs_archive_item_targets set estado = 'conferir_b2' where id = $1`, [t])
      const f = await um(c, id)
      expect(f).toMatchObject({ tempo: 'conferir_b2', falta: null, b2_nomes: ['numerico/x.csv'] }); expect(f.apagar).toEqual([])
    })
  })

  it('pendências: canal', async () => {
    await emTx(async c => {
      await ligar(c)
      const rem = (extra: string) => pg.query(`update public.obs_archive_channel_removals set ${extra} where site_id = $1`, [c.site])
      await unidade(c, { v: 1 })   // a remoção recusa unidade nova depois (canal_removido): o arquivo conhecido nasce antes
      await pg.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known) values ($1, $2, 'botao', 'apagar', now(), true)`, [c.site, c.canal])
      const id = `canal:${c.canal}`
      const lc = await linha(c, id, 'serie/canais/x', { canalRef: c.canal })
      await pg.query(`update public.obs_archive_absence set e_prefixo = true, sha256 = null where id = $1`, [lc])
      await linha(c, id, '_recebendo/y.csv.gz', { canalRef: c.canal })
      // com arquivos conhecidos
      const a = await um(c, id)
      expect(a).toMatchObject({ tempo: 'apagar_antigas', falta: null })
      expect((a.apagar as unknown[]).length).toBeGreaterThan(0)
      expect(a.prefixos).toContain('serie/canais/x')   // o abrir da remoção já declarou o prefixo do canal; a linha _recebendo/ fica de fora
      expect((a.prefixos as string[]).some(x => x.startsWith('_recebendo'))).toBe(false)
      // sem arquivo conhecido e linhas por abrir
      await pg.query(`set local session_replication_role = replica`)
      await pg.query(`delete from public.obs_archive_units where site_id = $1`, [c.site])
      await pg.query(`set local session_replication_role = origin`)
      expect(await um(c, id)).toMatchObject({ tempo: 'sem_comando', falta: 'so_prefixo' })
      // sem linhas abertas
      await pg.query(`update public.obs_archive_absence set encerrada_at = now() where site_id = $1`, [c.site])
      await rem(`blobs_pending = array['b1']`)
      expect(await um(c, id)).toMatchObject({ falta: 'blobs' })
      await rem(`blobs_pending = '{}', online_thumbs_known = false`)
      expect(await um(c, id)).toMatchObject({ falta: 'imagens' })
      await rem(`online_thumbs_known = true`)
      await pg.query(`insert into public.obs_archive_batches (site_id, batch, kind, table_name, channel_ref, period_start, period_end, row_count, file_sha256, csv_sha256, exported_at)
        values ($1, 'lote-um', 'canal', 'competitor_video_daily', $2, '2026-09-01', '2026-09-30', 1, $3, $3, now())`, [c.site, c.canal, H('1')])
      expect(await um(c, id)).toMatchObject({ falta: 'lote_e10' })
      // interruptor desligado depois do apagar
      await pg.query(`delete from public.obs_archive_batches where site_id = $1`, [c.site])
      await pg.query(`update public.obs_archive_absence set encerrada_at = null, nas_absent_first_at = now() where site_id = $1 and prefixo = 'serie/canais/x'`, [c.site])
      await ligar(c, false)
      expect(await um(c, id)).toMatchObject({ tempo: 'sem_comando', falta: 'm9_desligado' })
    })
  })

  it('pendências: versão superada', async () => {
    await emTx(async c => {
      await ligar(c)
      const v1 = await unidade(c, { v: 1, classe: 'texto', tabela: 'competitor_video_comments' })
      const l = await linha(c, `antiga:${v1}`, 'texto/a.csv.gz', { unidadeId: v1 })
      const id = `antiga:${v1}`
      expect(await um(c, id)).toMatchObject({ kind: 'versao', tempo: 'apagar_antigas' })
      await pg.query(`update public.obs_archive_absence set nas_absent_first_at = now() where id = $1`, [l])
      expect(await um(c, id)).toMatchObject({ kind: 'versao', tempo: 'sem_comando', falta: 'segunda_conferencia' })
    })
  })

  it('permissões', async () => {
    await emTx(async () => {
      const prv = (r: string, f: string): Promise<boolean> => escalar<boolean>(pg, `select has_function_privilege($1, $2::regprocedure, 'execute')`, [r, f])
      for (const f of ['public.obs_archive_owner_pending(uuid)', 'public.obs_archive_plan(uuid,boolean,text)', 'public.obs_archive_b2_plan(uuid,boolean,text)', 'public.obs_archive_removed_channel_list(uuid)']) {
        expect(await prv('service_role', f), `service_role ${f}`).toBe(true)
        expect(await prv('anon', f), `anon ${f}`).toBe(false); expect(await prv('authenticated', f), `authenticated ${f}`).toBe(false)
      }
      expect(await prv('postgres', 'public.obs_archive_owner_pending(uuid)')).toBe(true)
    })
  })

  it('interruptor: apagar a variável', async () => {
    await emTx(async c => {
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_m9_interruptor where site_id = $1`, [c.site])).toBe(0)
      expect(await escalar<boolean>(pg, `select public.obs_archive_m9_ligado($1)`, [c.site])).toBe(false)
      expect(await escalar<unknown>(pg, `select public.obs_archive_prefixos_ausentes($1, 'nas')`, [c.site])).toEqual([])
      const r = await tenta(pg, `select 1`)
      expect(r.ok).toBe(true)
    })
  })
})
