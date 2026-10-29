// @vitest-environment node
/** M9 Tarefa 4: prova de ausência (NAS, snapshots, B2), marcos da remoção, reaparecimento e fechamento dos alvos no "Apagar canal". Tudo em begin … rollback (54422). */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { m3bNoBanco, aplicarM3b, escalar, tenta, semearCanal } from '../helpers/m3b'
import { aplicarM9 } from '../helpers/m9'
import { travarDdl } from '../helpers/ddl-testes'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const H = (ch: string): string => ch.repeat(64)
const DAILY = 'competitor_video_daily'
const EARLY = 'competitor_video_early'
const COMENT = 'competitor_video_comments'
const MES = '2026-09-01'

type Cena = { site: string; canal: string; video: string }
type Linha = Record<string, unknown>
type Filhos = Record<string, { montado: boolean; sentinela: boolean }>
const FILHOS_OK: Filhos = { numerico: { montado: true, sentinela: true }, texto: { montado: true, sentinela: true } }

describe.skipIf(skipIfNoLocalDb())('M9 parte 4: prova de ausência, reaparecimento e fechamento dos alvos', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })

  async function emTx(fn: (c: Cena) => Promise<void>): Promise<void> {
    await pg.query('begin'); await pg.query('select pg_advisory_xact_lock(7339001)')
    try {
      if (!(await m3bNoBanco(pg))) await aplicarM3b(pg)
      await travarDdl(pg)
      await aplicarM9(pg, 4)
      // obs_archive_item_advance nasce na parte 5 (Tarefa 5): enquanto não existe, um vazio dentro da transação desfeita.
      await pg.query(`do $$ begin if to_regprocedure('public.obs_archive_item_advance(uuid)') is null then
        execute 'create function public.obs_archive_item_advance(p_site uuid) returns void language sql as ''select 1''';
      end if; end $$`)
      const s = await semearCanal(pg, { videos: 1 })
      await fn({ site: s.site, canal: s.canal, video: s.videos[0]! })
    } finally { await pg.query('rollback') }
  }

  const ligar = (c: Cena, v = true) => pg.query(
    `insert into public.obs_archive_m9_interruptor (site_id, ligado) values ($1, $2) on conflict (site_id) do update set ligado = excluded.ligado`, [c.site, v])

  async function unidade(c: Cena, o: { classe?: string; tabela?: string } = {}): Promise<string> {
    return (await pg.query(
      `insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, control_sum, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, parts, received_at)
       values ($1, $2, $3, $4, $5::date, 1, 10, 100, $6, $7, $8, $9, 100, 1, now()) returning id`,
      [c.site, o.classe ?? 'serie', o.tabela ?? DAILY, c.canal, MES, H('a'), H('b'), H('c'), H('d')])).rows[0].id as string
  }
  async function alvo(c: Cena, unit: string, o: { tabela?: string; estado?: string; motivo?: string | null; classe?: string; ref?: string } = {}): Promise<number> {
    return Number((await pg.query(
      `insert into public.obs_archive_item_targets (site_id, item_kind, item_refs, item_id, class, table_name, channel_ref, month, keys, esperadas, from_unit_id, from_version, estado, motivo)
       values ($1, 'video', array[$8], 1, $2, $3, $4, $5::date, array[$6], 4, $7, 1, $9, $10) returning id`,
      [c.site, o.classe ?? 'serie', o.tabela ?? DAILY, c.canal, MES, c.video, unit, o.ref ?? 'yt1', o.estado ?? 'copiar', o.motivo ?? null])).rows[0].id)
  }
  /** Uma linha de ausência. `extra` é um trecho `col = valor, …` aplicado depois (respeita os checks encadeados). */
  async function linha(c: Cena, o: { alvo: string; filho?: string; prefixo: string; ePrefixo?: boolean; alvoId?: number; unidadeId?: string; canalRef?: string; liberada?: boolean; extra?: string }): Promise<number> {
    const id = Number((await pg.query(
      `insert into public.obs_archive_absence (site_id, alvo, canal_ref, alvo_id, unidade_id, filho, prefixo, e_prefixo, sha256, liberado_em)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, case when $10 then now() end) returning id`,
      [c.site, o.alvo, o.canalRef ?? null, o.alvoId ?? null, o.unidadeId ?? null, o.filho ?? 'numerico', o.prefixo, o.ePrefixo ?? true,
       o.ePrefixo === false ? H('e') : null, o.liberada !== false])).rows[0].id)
    if (o.extra) await pg.query(`update public.obs_archive_absence set ${o.extra} where id = $1`, [id])
    return id
  }
  const lerLinha = async (id: number): Promise<Linha> => (await pg.query(`select * from public.obs_archive_absence where id = $1`, [id])).rows[0] as Linha
  /** Linha de canal (alvo `canal:<ref>`) pronta para as provas de ausência. */
  const linhaCanal = (c: Cena, prefixo = 'serie/canais/x', extra?: string) => linha(c, { alvo: `canal:${c.canal}`, canalRef: c.canal, prefixo, extra })
  async function removerCanal(c: Cena, o: { blobs?: string[]; conhecido?: boolean } = {}): Promise<void> {
    await pg.query(
      `insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known, blobs_pending)
       values ($1, $2, 'botao', 'apagar', now(), $3, $4::text[])`, [c.site, c.canal, o.conhecido ?? true, o.blobs ?? []])
  }
  const attest = (c: Cena, fonte: string, itens: unknown[], o: { filhos?: Filhos; execucao?: string } = {}) =>
    tenta(pg, `select public.obs_archive_attest_prefixos($1, $2, $3, $4::jsonb, $5::jsonb) as r`,
      [c.site, fonte, o.execucao ?? randomUUID(), JSON.stringify(o.filhos ?? FILHOS_OK), JSON.stringify(itens)])
  const item = (c: Cena, estado: string, extra: Record<string, unknown> = {}, prefixo = 'serie/canais/x', filho = 'numerico') =>
    ({ alvo: `canal:${c.canal}`, filho, prefixo, estado, ...extra })
  async function ok(r: Awaited<ReturnType<typeof tenta>>): Promise<Linha> {
    expect(r.ok, JSON.stringify(r)).toBe(true)
    return r.ok ? (r.rows[0]!.r as Linha) : {}
  }
  const respostas = (r: Linha): Linha[] => r.prefixos as Linha[]
  async function corrida(c: Cena, o: { estado?: string; expira?: string } = {}): Promise<string> {
    return (await pg.query(
      `insert into public.obs_archive_b2_runs (site_id, expires_at, modo, negative_name, negative_filho, canary_days, estado)
       values ($1, now() + $2::interval, 'normal', 'neg', 'numerico', '[]'::jsonb, $3) returning id`, [c.site, o.expira ?? '1 hour', o.estado ?? 'controle_ok'])).rows[0].id as string
  }

  it('canal_apagado_fecha_alvos_de_item', async () => {
    await emTx(async c => {
      const u1 = await unidade(c)
      const u2 = await unidade(c, { classe: 'texto', tabela: COMENT })
      const a1 = await alvo(c, u1)                                                                       // copiar
      const a2 = await alvo(c, u1, { tabela: EARLY, estado: 'bloqueado', motivo: 'antiga_ausente', ref: 'yt2' })   // bloqueado
      const l1 = await linha(c, { alvo: `alvo:${a1}`, alvoId: a1, prefixo: 'serie/a.csv', ePrefixo: false })
      const l2 = await linha(c, { alvo: `alvo:${a2}`, alvoId: a2, prefixo: 'serie/b.csv', ePrefixo: false })
      const l3 = await linha(c, { alvo: `antiga:${u2}`, unidadeId: u2, prefixo: 'texto/antiga.csv', ePrefixo: false, filho: 'texto' })
      await removerCanal(c)
      for (const id of [a1, a2]) {
        const t = (await pg.query(`select estado, motivo, motivo_fim, done_at from public.obs_archive_item_targets where id = $1`, [id])).rows[0]
        expect(t).toMatchObject({ estado: 'concluido', motivo: null, motivo_fim: 'canal_apagado' })
        expect(t.done_at).not.toBeNull()
      }
      for (const id of [l1, l2, l3]) expect((await lerLinha(id)).encerrada_at).not.toBeNull()
      const canal = (await pg.query(`select filho, prefixo, e_prefixo, liberado_em from public.obs_archive_absence where site_id = $1 and alvo = $2 order by filho, prefixo`, [c.site, `canal:${c.canal}`])).rows
      expect(canal.map(x => `${x.filho}:${x.prefixo}`)).toEqual([
        `numerico:_recebendo/_quarentena/serie/canais/${c.canal}`, `numerico:_recebendo/serie/canais/${c.canal}`, `numerico:serie/canais/${c.canal}`,
        `texto:_recebendo/_quarentena/texto/canais/${c.canal}`, `texto:_recebendo/texto/canais/${c.canal}`, `texto:texto/canais/${c.canal}`,
      ])
      expect(canal.every(x => x.e_prefixo === true && x.liberado_em !== null)).toBe(true)
      // o Mac ainda manda o grupo do alvo fechado: recusa em vez de 409 em loop
      const rec = await tenta(pg, `select public.obs_archive_expurgo_record($1, 1, $2::jsonb) as r`, [c.site, JSON.stringify({
        classe: 'serie', canal: c.canal, mes: '2026-09', alvos: [{ alvo_id: a1, removidas: 4, unidade: { row_count: 6, control_sum: 90, hash_conteudo: H('e'), schema_fp: H('b'), sha256_bytes: H('f'), csv_sha256: H('1'), file_bytes: 50, partes: 1, parts: [] } }],
        resumo: { versao: 1, vazio: false, canal_sha256: H('2'), canal_bytes: 10, canal_rows: 6, video_sha256: null, video_bytes: null, video_rows: null, tabelas_lidas: [DAILY] } })])
      expect(await ok(rec)).toMatchObject({ status: 'recusado', motivo: 'alvo_fora_de_copiar' })
    })
  })

  it('sonda_custo_ausencia: o plano das listas usa índice parcial, sem Seq Scan na ausência', async () => {
    await emTx(async c => {
      // 5.000 linhas (4.950 já encerradas, como acontece com o tempo) e 2.000 alvos
      await pg.query(
        `insert into public.obs_archive_absence (site_id, alvo, alvo_id, filho, prefixo, e_prefixo, liberado_em, encerrada_at, canal_ref)
         select $1, 'alvo:' || g, g, 'numerico', 'serie/p' || g, true, now(), case when g > 50 then now() end, null from generate_series(1, 5000) g`, [c.site])
      await pg.query(
        `insert into public.obs_archive_item_targets (site_id, item_kind, item_refs, class, table_name, channel_ref, month, keys, from_unit_id, from_version)
         select $1, 'video', array['y' || g], 'serie', $2, gen_random_uuid()::text, $3::date, array['k'], gen_random_uuid(), 1 from generate_series(1, 2000) g`, [c.site, DAILY, MES])
      await pg.query('analyze public.obs_archive_absence'); await pg.query('analyze public.obs_archive_item_targets')
      const plano = async (sql: string): Promise<string> => (await pg.query(`explain (analyze, buffers) ${sql}`, [c.site])).rows.map(r => r['QUERY PLAN'] as string).join('\n')
      const nas = await plano(`select a.* from public.obs_archive_absence a where a.site_id = $1 and a.liberado_em is not null and a.encerrada_at is null
        order by coalesce(a.nas_last_absent_at, a.nas_present_at) nulls first, a.id limit 2000`)
      const b2 = await plano(`select a.* from public.obs_archive_absence a where a.site_id = $1 and a.liberado_em is not null and a.encerrada_at is null
        and a.snap_absent_at is not null and a.b2_absent_at is null and a.nas_last_absent_at > now() - interval '24 hours' order by a.b2_checked_at nulls first, a.id limit 2000`)
      console.log('SONDA nas:\n' + nas + '\nSONDA b2:\n' + b2)
      expect(nas).not.toMatch(/Seq Scan on obs_archive_absence/)
      expect(b2).not.toMatch(/Seq Scan on obs_archive_absence/)
      // a função inteira também roda com o volume
      await ligar(c)
      const t0 = Date.now()
      expect(await escalar<number>(pg, `select jsonb_array_length(public.obs_archive_prefixos_ausentes($1, 'nas'))::int`, [c.site])).toBe(50)
      console.log('SONDA função nas, 5000 linhas: ' + (Date.now() - t0) + ' ms')
    })
  })

  it('prefixos_ausentes: desligado', async () => {
    await emTx(async c => {
      await linhaCanal(c)
      expect(await escalar<string>(pg, `select public.obs_archive_prefixos_ausentes($1, 'nas')::text`, [c.site])).toBe('[]')
      expect(await escalar<string>(pg, `select public.obs_archive_prefixos_ausentes($1, 'b2')::text`, [c.site])).toBe('[]')
      await ligar(c, false)
      expect(await escalar<string>(pg, `select public.obs_archive_prefixos_ausentes($1, 'nas')::text`, [c.site])).toBe('[]')
    })
  })

  it('prefixos_ausentes: nas e b2', async () => {
    await emTx(async c => {
      await ligar(c)
      const nasOk = "nas_absent_first_at = now() - interval '20 hours', nas_absent_at = now() - interval '5 hours', nas_last_absent_at = now() - interval '1 hour'"
      const r1 = await linhaCanal(c, 'serie/r1', nasOk)                                                               // provar_snapshots verdadeiro
      const r2 = await linhaCanal(c, 'serie/r2', `${nasOk}, snap_absent_at = now(), snap_checked_at = now()`)           // b2: sim
      const r3 = await linhaCanal(c, 'serie/r3', `${nasOk.replace("interval '1 hour'", "interval '30 hours'")}, snap_absent_at = now()`)   // b2: não (NAS velho)
      const r4 = await linhaCanal(c, 'serie/r4', `${nasOk}, snap_absent_at = now(), b2_absent_at = now()`)             // b2: não (já provada)
      const r5 = await linha(c, { alvo: `canal:${c.canal}`, canalRef: c.canal, prefixo: 'serie/r5', liberada: false })  // fora: não liberada
      const r6 = await linhaCanal(c, 'serie/r6', 'encerrada_at = now()')                                                // fora: encerrada
      const r0 = await linhaCanal(c, 'serie/r0')                                                                        // nunca vista: primeiro
      const nas = JSON.parse(await escalar<string>(pg, `select public.obs_archive_prefixos_ausentes($1, 'nas')::text`, [c.site])) as Linha[]
      expect(nas.map(x => x.prefixo)).toEqual(['serie/r0', 'serie/r3', 'serie/r1', 'serie/r2', 'serie/r4'])
      expect(nas.find(x => x.prefixo === 'serie/r1')).toMatchObject({ alvo: `canal:${c.canal}`, filho: 'numerico', e_prefixo: true, provar_snapshots: true })
      expect(nas.find(x => x.prefixo === 'serie/r2')).toMatchObject({ provar_snapshots: false })
      expect(nas.find(x => x.prefixo === 'serie/r0')).toMatchObject({ provar_snapshots: false })
      expect(nas.some(x => x.prefixo === 'serie/r5' || x.prefixo === 'serie/r6')).toBe(false)
      expect([r0, r1, r2, r5, r6].every(x => x > 0)).toBe(true)
      const b2 = JSON.parse(await escalar<string>(pg, `select public.obs_archive_prefixos_ausentes($1, 'b2')::text`, [c.site])) as Linha[]
      expect(b2.map(x => x.prefixo)).toEqual(['serie/r2'])
      expect(Object.keys(b2[0]!).sort()).toEqual(['alvo', 'e_prefixo', 'filho', 'prefixo'])
      expect(await escalar<string>(pg, `select public.obs_archive_prefixos_ausentes($1, 'outra')::text`, [c.site])).toBe('[]')
      expect(r3).toBeGreaterThan(0); expect(r4).toBeGreaterThan(0)
    })
  })

  it('prefixos_ausentes: teto de 2000 e ordem estável (último visto, nulos primeiro, depois id)', async () => {
    await emTx(async c => {
      await ligar(c)
      await pg.query(
        `insert into public.obs_archive_absence (site_id, alvo, canal_ref, filho, prefixo, e_prefixo, liberado_em, nas_present_at)
         select $1, $2, $3, 'numerico', 'serie/t' || g, true, now(), case when g <= 3 then now() - (g || ' hours')::interval end from generate_series(1, 2005) g`, [c.site, `canal:${c.canal}`, c.canal])
      const nas = JSON.parse(await escalar<string>(pg, `select public.obs_archive_prefixos_ausentes($1, 'nas')::text`, [c.site])) as Linha[]
      expect(nas).toHaveLength(2000)
      // nulos primeiro (g = 4..), por id; os três já vistos só entrariam depois deles, e ficam de fora pelo teto
      expect(nas[0]!.prefixo).toBe('serie/t4')
      expect(nas[1999]!.prefixo).toBe('serie/t2003')
      expect(nas.some(x => x.prefixo === 'serie/t1')).toBe(false)
    })
  })

  it('ausente_sem_sentinela_nao_conta', async () => {
    await emTx(async c => {
      await ligar(c)
      const id = await linhaCanal(c)
      const antes = await lerLinha(id)
      const r = await ok(await attest(c, 'nas', [item(c, 'ausente')], { filhos: { numerico: { montado: true, sentinela: false }, texto: { montado: true, sentinela: true } } }))
      expect(respostas(r)[0]).toMatchObject({ resposta: 'recusado', motivo: 'filho_fora' })
      expect(await lerLinha(id)).toEqual(antes)
      const r2 = await ok(await attest(c, 'nas', [item(c, 'ausente')], { filhos: {} }))
      expect(respostas(r2)[0]).toMatchObject({ resposta: 'recusado', motivo: 'filho_fora' })
    })
  })

  it('ausente: duas execuções com 11 h', async () => {
    await emTx(async c => {
      await ligar(c)
      const id = await linhaCanal(c)
      expect(respostas(await ok(await attest(c, 'nas', [item(c, 'ausente')])))[0]).toMatchObject({ resposta: 'aceito' })
      let l = await lerLinha(id)
      expect(l.nas_absent_first_at).not.toBeNull(); expect(l.nas_last_absent_at).not.toBeNull(); expect(l.nas_absent_at).toBeNull()
      const primeiro = l.nas_absent_first_at
      await attest(c, 'nas', [item(c, 'ausente')])      // 2ª, com menos de 11 h
      l = await lerLinha(id)
      expect(l.nas_absent_at).toBeNull(); expect(l.nas_absent_first_at).toEqual(primeiro)
      await pg.query(`update public.obs_archive_absence set nas_absent_first_at = now() - interval '11 hours' where id = $1`, [id])
      await attest(c, 'nas', [item(c, 'ausente')])      // 3ª
      l = await lerLinha(id)
      expect(l.nas_absent_at).not.toBeNull()
    })
  })

  it('snapshot_presente_segura_o_b2', async () => {
    await emTx(async c => {
      await ligar(c)
      const nasOk = "nas_absent_first_at = now() - interval '20 hours', nas_absent_at = now() - interval '5 hours'"
      const id = await linhaCanal(c, 'serie/s1', nasOk)
      await attest(c, 'nas', [item(c, 'ausente', { snapshots: 'presente', snapshot_mais_antigo: '2026-10-15' }, 'serie/s1')])
      let l = await lerLinha(id)
      expect(l.snap_checked_at).not.toBeNull(); expect(String(l.snap_oldest)).toContain('2026'); expect(l.snap_absent_at).toBeNull()
      expect(JSON.parse(await escalar<string>(pg, `select public.obs_archive_prefixos_ausentes($1, 'b2')::text`, [c.site]))).toEqual([])
      // indisponível: só snap_checked_at (a data não muda)
      const oldest = l.snap_oldest
      await pg.query(`update public.obs_archive_absence set snap_checked_at = null where id = $1`, [id])
      await attest(c, 'nas', [item(c, 'ausente', { snapshots: 'indisponivel' }, 'serie/s1')])
      l = await lerLinha(id)
      expect(l.snap_checked_at).not.toBeNull(); expect(l.snap_oldest).toEqual(oldest); expect(l.snap_absent_at).toBeNull()
      // ausente antes de nas_absent_at: ignorado
      const id2 = await linhaCanal(c, 'serie/s2')
      await attest(c, 'nas', [item(c, 'ausente', { snapshots: 'ausente' }, 'serie/s2')])
      l = await lerLinha(id2)
      expect(l.nas_absent_at).toBeNull(); expect(l.snap_absent_at).toBeNull(); expect(l.snap_checked_at).toBeNull()
    })
  })

  it('snapshot ausente libera o b2', async () => {
    await emTx(async c => {
      await ligar(c)
      const id = await linhaCanal(c, 'serie/s1', "nas_absent_first_at = now() - interval '20 hours', nas_absent_at = now() - interval '5 hours'")
      await attest(c, 'nas', [item(c, 'ausente', { snapshots: 'ausente' }, 'serie/s1')])
      expect((await lerLinha(id)).snap_absent_at).not.toBeNull()
      const b2 = JSON.parse(await escalar<string>(pg, `select public.obs_archive_prefixos_ausentes($1, 'b2')::text`, [c.site])) as Linha[]
      expect(b2.map(x => x.prefixo)).toEqual(['serie/s1'])
    })
  })

  it('b2_sem_canario_nao_conta', async () => {
    await emTx(async c => {
      await ligar(c)
      const pronto = "nas_absent_first_at = now() - interval '20 hours', nas_absent_at = now() - interval '5 hours', nas_last_absent_at = now() - interval '1 hour', snap_absent_at = now()"
      const id = await linhaCanal(c, 'serie/b1', pronto)
      for (const run of [await corrida(c, { estado: 'aguardando_controle' }), await corrida(c, { estado: 'controle_falhou' }), await corrida(c, { expira: '-1 minute' }), randomUUID()]) {
        const r = await ok(await attest(c, 'b2', [item(c, 'ausente', { nomes: [] }, 'serie/b1')], { execucao: run }))
        expect(respostas(r)[0]).toMatchObject({ resposta: 'recusado', motivo: 'controle_pendente' })
      }
      expect((await lerLinha(id)).b2_absent_at).toBeNull()
      const run = await corrida(c)
      const sem = await linhaCanal(c, 'serie/b2', "nas_absent_first_at = now() - interval '20 hours', nas_absent_at = now() - interval '5 hours', nas_last_absent_at = now() - interval '1 hour'")
      expect(respostas(await ok(await attest(c, 'b2', [item(c, 'ausente', { nomes: [] }, 'serie/b2')], { execucao: run })))[0]).toMatchObject({ motivo: 'snapshots_pendentes' })
      const velha = await linhaCanal(c, 'serie/b3', "nas_absent_first_at = now() - interval '40 hours', nas_absent_at = now() - interval '35 hours', nas_last_absent_at = now() - interval '30 hours', snap_absent_at = now()")
      expect(respostas(await ok(await attest(c, 'b2', [item(c, 'ausente', { nomes: [] }, 'serie/b3')], { execucao: run })))[0]).toMatchObject({ motivo: 'conferencia_nas_velha' })
      expect((await lerLinha(sem)).b2_absent_at).toBeNull(); expect((await lerLinha(velha)).b2_absent_at).toBeNull()
    })
  })

  it('b2: ausente e presente', async () => {
    await emTx(async c => {
      await ligar(c)
      const run = await corrida(c)
      const pronto = "nas_absent_first_at = now() - interval '20 hours', nas_absent_at = now() - interval '5 hours', nas_last_absent_at = now() - interval '1 hour', snap_absent_at = now()"
      const id = await linhaCanal(c, 'serie/b1', pronto)
      expect(respostas(await ok(await attest(c, 'b2', [item(c, 'ausente', { nomes: [] }, 'serie/b1')], { execucao: run })))[0]).toMatchObject({ resposta: 'aceito' })
      let l = await lerLinha(id)
      expect(l.b2_absent_at).not.toBeNull(); expect(l.b2_checked_at).not.toBeNull()
      // 'ausente' com nomes é forma; 'presente' sem nomes também
      expect(respostas(await ok(await attest(c, 'b2', [item(c, 'ausente', { nomes: ['x'] }, 'serie/b1')], { execucao: run })))[0]).toMatchObject({ motivo: 'forma' })
      expect(respostas(await ok(await attest(c, 'b2', [item(c, 'presente', { nomes: [] }, 'serie/b1')], { execucao: run })))[0]).toMatchObject({ motivo: 'forma' })
      // presente (qualquer nome, no máximo 20 guardados) reabre só o B2
      const nomes = Array.from({ length: 25 }, (_, i) => `arq${i}.csv`)
      expect(respostas(await ok(await attest(c, 'b2', [item(c, 'presente', { nomes }, 'serie/b1')], { execucao: run })))[0]).toMatchObject({ resposta: 'aceito' })
      l = await lerLinha(id)
      expect(l.b2_absent_at).toBeNull(); expect(l.b2_present_at).not.toBeNull(); expect((l.b2_nomes as string[]).length).toBe(20)
      expect(l.nas_absent_at).not.toBeNull(); expect(l.snap_absent_at).not.toBeNull()
    })
  })

  it('prefixo_presente_reabre_e_conta', async () => {
    await emTx(async c => {
      await ligar(c)
      const ate = "nas_absent_first_at = now() - interval '20 hours', nas_absent_at = now() - interval '5 hours', nas_last_absent_at = now() - interval '1 hour', snap_absent_at = now(), snap_oldest = '2026-10-15', snap_checked_at = now(), b2_absent_at = now(), b2_checked_at = now()"
      // linha de alvo: o alvo voltou de conferir_b2 para apagar_antigas e a bandeira do item religa
      const u = await unidade(c)
      const t = await alvo(c, u, { estado: 'conferir_b2' })
      await pg.query(`insert into public.competitor_removed_items (site_id, kind, youtube_id, competitor_channel_id, decided_by, rows_deleted, archive_pending, archive_note)
        values ($1, 'video', 'yt1', $2, gen_random_uuid(), '{}'::jsonb, false, 'concluído')`, [c.site, c.canal])
      const la = await linha(c, { alvo: `alvo:${t}`, alvoId: t, prefixo: 'serie/a.csv', ePrefixo: false, extra: ate })
      const r = await ok(await attest(c, 'nas', [{ alvo: `alvo:${t}`, filho: 'numerico', prefixo: 'serie/a.csv', estado: 'presente' }]))
      expect(respostas(r)[0]).toMatchObject({ resposta: 'aceito' })
      const l = await lerLinha(la)
      for (const col of ['nas_absent_first_at', 'nas_absent_at', 'nas_last_absent_at', 'snap_absent_at', 'snap_oldest', 'snap_checked_at', 'b2_absent_at', 'b2_checked_at']) expect(l[col], col).toBeNull()
      expect(l.nas_present_at).not.toBeNull(); expect(l.b2_nomes).toEqual([])
      expect((await pg.query(`select estado, done_at from public.obs_archive_item_targets where id = $1`, [t])).rows[0]).toMatchObject({ estado: 'apagar_antigas', done_at: null })
      expect((await pg.query(`select archive_pending, archive_note from public.competitor_removed_items where site_id = $1 and youtube_id = 'yt1'`, [c.site])).rows[0]).toMatchObject({ archive_pending: true, archive_note: null })
      // linha de canal: remoção concluída volta a aberta e reappeared_count sobe
      await removerCanal(c)
      const lc = await linhaCanal(c, 'serie/c1', ate)
      await pg.query(`update public.obs_archive_channel_removals set completed_at = now(), nas_absent_at = now(), b2_absent_at = now(), snapshots_clear_on = current_date where site_id = $1`, [c.site])
      await attest(c, 'nas', [item(c, 'presente', {}, 'serie/c1')])
      expect((await pg.query(`select completed_at, nas_absent_at, b2_absent_at, snapshots_clear_on, reappeared_count, reappeared_at from public.obs_archive_channel_removals where site_id = $1`, [c.site])).rows[0])
        .toMatchObject({ completed_at: null, nas_absent_at: null, b2_absent_at: null, snapshots_clear_on: null, reappeared_count: 1 })
      expect((await lerLinha(lc)).nas_absent_at).toBeNull()
    })
  })

  it('presenca_normal_nao_reabre', async () => {
    await emTx(async c => {
      await ligar(c)
      await removerCanal(c)
      const id = await linhaCanal(c, 'serie/n1', "nas_absent_first_at = now() - interval '2 hours', nas_last_absent_at = now() - interval '1 hour'")
      await attest(c, 'nas', [item(c, 'presente', {}, 'serie/n1')])
      const l = await lerLinha(id)
      expect(l.nas_absent_first_at).toBeNull(); expect(l.nas_present_at).not.toBeNull(); expect(l.nas_last_absent_at).toBeNull()
      expect((await pg.query(`select reappeared_count, reappeared_at, completed_at from public.obs_archive_channel_removals where site_id = $1`, [c.site])).rows[0]).toMatchObject({ reappeared_count: 0, reappeared_at: null, completed_at: null })
    })
  })

  describe('removal_advance', () => {
    const tudo = (n: string) => `nas_absent_first_at = now() - interval '20 hours', nas_absent_at = now() - interval '5 hours', nas_last_absent_at = now() - interval '1 hour'${n}`
    const snap = ", snap_absent_at = now()"
    const b2 = ", b2_absent_at = now()"
    const adv = (c: Cena) => pg.query(`select public.obs_archive_removal_advance($1)`, [c.site])
    const rem = async (c: Cena): Promise<Linha> => (await pg.query(`select * from public.obs_archive_channel_removals where site_id = $1`, [c.site])).rows[0] as Linha
    // com a remoção feita (e uma unidade serie), o gatilho cria 3 linhas do canal; as ajustamos por coluna
    async function comUnidade(c: Cena): Promise<number[]> {
      await unidade(c); await removerCanal(c)
      return (await pg.query(`select id from public.obs_archive_absence where site_id = $1 and alvo = $2 order by id`, [c.site, `canal:${c.canal}`])).rows.map(x => Number(x.id))
    }
    const set = (ids: number[], extra: string) => pg.query(`update public.obs_archive_absence set ${extra} where id = any($1)`, [ids])

    it('marcos e conclusão', async () => {
      await emTx(async c => {
        await ligar(c)
        const ids = await comUnidade(c)
        expect(ids).toHaveLength(3)
        await adv(c)
        expect((await rem(c)).nas_absent_at).toBeNull()
        await set(ids.slice(0, 2), tudo(''))
        await adv(c)
        expect((await rem(c)).nas_absent_at).toBeNull()      // falta uma
        await set(ids, tudo(''))
        await adv(c)
        let r = await rem(c)
        expect(r.nas_absent_at).not.toBeNull(); expect(r.nas_last_absent_at).not.toBeNull(); expect(r.snapshots_clear_on).toBeNull(); expect(r.completed_at).toBeNull()
        await set(ids, snap.slice(2))
        await adv(c)
        r = await rem(c)
        expect(String(r.snapshots_clear_on).length).toBeGreaterThan(0); expect(r.b2_absent_at).toBeNull(); expect(r.completed_at).toBeNull()
        await set(ids.slice(0, 2), b2.slice(2))
        await adv(c)
        expect((await rem(c)).completed_at).toBeNull()       // falta uma do B2
        await set(ids, b2.slice(2))
        await adv(c)
        r = await rem(c)
        expect(r.b2_absent_at).not.toBeNull(); expect(r.completed_at).not.toBeNull()
        expect((await pg.query(`select count(*)::int as n from public.obs_archive_absence where site_id = $1 and alvo = $2 and encerrada_at is null`, [c.site, `canal:${c.canal}`])).rows[0].n).toBe(0)
      })
    })

    it('não conclui com blobs pendentes, thumbs desconhecidas ou desligado', async () => {
      await emTx(async c => {
        const ids = await comUnidade(c)
        await set(ids, tudo(snap + b2))
        await adv(c)                                          // interruptor desligado: nada avança
        expect((await rem(c)).completed_at).toBeNull(); expect((await rem(c)).nas_absent_at).toBeNull()
        await ligar(c)
        await pg.query(`update public.obs_archive_channel_removals set blobs_pending = array['https://x/y.jpg'] where site_id = $1`, [c.site])
        await adv(c)
        expect((await rem(c)).completed_at).toBeNull()
        await pg.query(`update public.obs_archive_channel_removals set blobs_pending = '{}', online_thumbs_known = false where site_id = $1`, [c.site])
        await adv(c)
        expect((await rem(c)).completed_at).toBeNull()
        await pg.query(`update public.obs_archive_channel_removals set thumbs_unknown_ack_at = now() where site_id = $1`, [c.site])
        await adv(c)
        expect((await rem(c)).completed_at).not.toBeNull()
      })
    })

    it('canal sem nenhuma linha e sem blobs conclui ("canal sem arquivo conhecido")', async () => {
      await emTx(async c => {
        await ligar(c)
        await removerCanal(c)
        expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_absence where site_id = $1`, [c.site])).toBe(0)
        await adv(c)
        expect((await rem(c)).completed_at).not.toBeNull()
      })
    })

    it('lote_e10_aberto_segura', async () => {
      await emTx(async c => {
        await ligar(c)
        const ids = await comUnidade(c)
        await set(ids, tudo(snap + b2))
        const lote = (await pg.query(
          `insert into public.obs_archive_batches (site_id, batch, kind, table_name, channel_ref, period_start, period_end, row_count, file_sha256, csv_sha256, exported_at)
           values ($1, 'lote-m9', 'canal', $2, $3, '2026-09-01', '2026-09-30', 1, $4, $4, now()) returning id`, [c.site, DAILY, c.canal, H('a')])).rows[0].id
        await adv(c)
        expect((await rem(c)).completed_at).toBeNull()
        await pg.query(`update public.obs_archive_batches set closed_at = now(), closed_reason = 'canal_apagado' where id = $1`, [lote])
        await adv(c)
        expect((await rem(c)).completed_at).not.toBeNull()
      })
    })

    it('ordem estável: dois canais, percorridos por channel_ref', async () => {
      await emTx(async c => {
        await ligar(c)
        const outro = randomUUID()
        await pg.query(`insert into public.competitor_channels (id, site_id, channel_id, channel_name, added_at) values ($1::uuid, $2, 'UC' || substr(md5($1::text), 1, 22), 'outro', now())`, [outro, c.site])
        await removerCanal(c)
        await removerCanal({ ...c, canal: outro })
        await adv(c)
        expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_channel_removals where site_id = $1 and completed_at is not null`, [c.site])).toBe(2)
        const src = await escalar<string>(pg, `select prosrc from pg_proc where proname = 'obs_archive_removal_advance' and pronamespace = 'public'::regnamespace`)
        expect(src).toMatch(/order by x\.channel_ref for update/)
      })
    })
  })

  it('permissões', async () => {
    await emTx(async () => {
      const prv = async (fn: string, role: string): Promise<boolean> => (await pg.query(`select has_function_privilege($1, $2::regprocedure, 'execute') as p`, [role, fn])).rows[0].p as boolean
      for (const fn of ['public.obs_archive_prefixos_ausentes(uuid,text)', 'public.obs_archive_attest_prefixos(uuid,text,uuid,jsonb,jsonb)']) {
        expect(await prv(fn, 'service_role'), fn).toBe(true)
        expect(await prv(fn, 'anon'), fn).toBe(false); expect(await prv(fn, 'authenticated'), fn).toBe(false)
      }
      for (const fn of ['public.obs_archive_reabrir(bigint,text)', 'public.obs_archive_removal_advance(uuid)', 'public.obs_archive_removal_open_rows(uuid,text)', 'public.obs_archive_canal_apagado()']) {
        for (const role of ['service_role', 'anon', 'authenticated']) expect(await prv(fn, role), `${fn} ${role}`).toBe(false)
      }
    })
  })
})

