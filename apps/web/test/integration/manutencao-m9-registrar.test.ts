// @vitest-environment node
/** M9 Tarefa 3: abrir, registrar, bloquear e desbloquear o expurgo (o que a rota C14 chama). Tudo em begin … rollback (54422). */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { m3bNoBanco, aplicarM3b, escalar, tenta, semearCanal } from '../helpers/m3b'
import { aplicarM9 } from '../helpers/m9'
import { travarDdl } from '../helpers/ddl-testes'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const H = (ch: string): string => ch.repeat(64)
const DAILY = 'competitor_video_daily'
const EARLY = 'competitor_video_early'
const MES = '2026-09-01'

type Cena = { site: string; canal: string; video: string }
type Linha = Record<string, unknown>
type Alvo = { id: number; unit: string }

describe.skipIf(skipIfNoLocalDb())('M9 parte 3: abrir, registrar, bloquear e desbloquear o expurgo', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })

  async function emTx(fn: (c: Cena) => Promise<void>): Promise<void> {
    await pg.query('begin'); await pg.query('select pg_advisory_xact_lock(7339001)')
    try {
      if (!(await m3bNoBanco(pg))) await aplicarM3b(pg)
      await travarDdl(pg)
      await aplicarM9(pg, 3)
      const s = await semearCanal(pg, { videos: 1 })
      await fn({ site: s.site, canal: s.canal, video: s.videos[0]! })
    } finally { await pg.query('rollback') }
  }

  async function unidade(c: Cena, o: { classe?: string; tabela?: string; versao?: number; rows?: number; recebida?: boolean; partes?: number; mes?: string } = {}): Promise<string> {
    const rows = o.rows ?? 10
    const partes = o.partes ?? 1
    const id = (await pg.query(
      `insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, control_sum, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, parts, received_at)
       values ($1, $2, $3, $4, $5::date, $6, $7::bigint, 100, $8, $9, case when $7::bigint = 0 then null else $10 end, case when $7::bigint = 0 then null else $11 end, 100, $12, case when $13 then now() end) returning id`,
      [c.site, o.classe ?? 'serie', o.tabela ?? DAILY, c.canal, o.mes ?? MES, o.versao ?? 1, rows, H('a'), H('b'), H('c'), H('d'), partes, o.recebida !== false])).rows[0].id as string
    if (partes > 1) {
      for (let p = 1; p <= partes; p++) {
        await pg.query(`insert into public.obs_archive_unit_parts (unit_id, part, sha256_bytes, csv_sha256, file_bytes, row_count, row_offset) values ($1, $2, $3, $4, 50, $5, $6)`,
          [id, p, H(String(p)), H('d'), rows / partes, (p - 1) * (rows / partes)])
      }
    }
    return id
  }
  async function alvo(c: Cena, unit: string, o: { item?: number; classe?: string; tabela?: string; kind?: string; esperadas?: number | null; versao?: number; estado?: string; motivo?: string; mes?: string } = {}): Promise<Alvo> {
    const id = (await pg.query(
      `insert into public.obs_archive_item_targets (site_id, item_kind, item_refs, item_id, class, table_name, channel_ref, month, keys, esperadas, from_unit_id, from_version, estado, motivo)
       values ($1, $2, array['yt1'], $3, $4, $5, $6, $7::date, array[$8], $9, $10, $11, $12, $13) returning id`,
      [c.site, o.kind ?? 'video', o.item ?? 1, o.classe ?? 'serie', o.tabela ?? DAILY, c.canal, o.mes ?? MES, c.video, o.esperadas === undefined ? 4 : o.esperadas, unit, o.versao ?? 1,
       o.estado ?? 'copiar', o.motivo ?? null])).rows[0].id as string
    return { id: Number(id), unit }
  }
  async function resumo(c: Cena, o: { versao?: number; recebida?: boolean; vazio?: boolean; video?: boolean; classe?: string } = {}): Promise<void> {
    const vazio = o.vazio === true
    await pg.query(
      `insert into public.obs_archive_summaries (site_id, class, channel_ref, month, version, empty, canal_sha256, canal_bytes, canal_rows, video_sha256, video_bytes, video_rows, unit_hashes, received_at)
       values ($1, $2, $3, $4::date, $5, $6, $7, 10, 5, $8, 10, 5, '{}'::jsonb, case when $9 then now() end)`,
      [c.site, o.classe ?? 'serie', c.canal, MES, o.versao ?? 1, vazio, vazio ? null : H('7'), o.video === false || vazio ? null : H('8'), o.recebida !== false])
  }
  async function mesSelado(c: Cena, o: { fora?: boolean; tabela?: string } = {}): Promise<void> {
    await pg.query(`insert into public.obs_archive_months (site_id, class, table_name, month, sealed_at, sealed_version, sealed_kind, dropped_at)
      values ($1, 'serie', $2, $3::date, now(), 1, 'com_dado', case when $4 then now() end)`, [c.site, o.tabela ?? DAILY, MES, o.fora === true])
  }
  /** A trava de purga exige decisão 'apagar'; o teste só precisa do estado, então desliga os gatilhos de usuário na transação desfeita. */
  async function purgar(unit: string): Promise<void> {
    await pg.query(`set local session_replication_role = replica`)
    await pg.query(`update public.obs_archive_units set purged_at = now(), purged_by = gen_random_uuid(), purge_ref = 'teste' where id = $1`, [unit])
    await pg.query(`set local session_replication_role = origin`)
  }
  const abrir = (c: Cena, item = 1) => tenta(pg, `select public.obs_archive_expurgo_open($1, $2) as r`, [c.site, item])
  const registrar = (c: Cena, grupo: unknown, item = 1) => tenta(pg, `select public.obs_archive_expurgo_record($1, $2, $3::jsonb) as r`, [c.site, item, JSON.stringify(grupo)])
  const unidadeNova = (rows: number, extra: Record<string, unknown> = {}) => ({
    row_count: rows, control_sum: 90, hash_conteudo: H('e'), schema_fp: H('b'), sha256_bytes: rows === 0 ? null : H('f'), csv_sha256: rows === 0 ? null : H('1'), file_bytes: 50, partes: 1, parts: [], ...extra,
  })
  const resumoNovo = (extra: Record<string, unknown> = {}) => ({
    versao: 1, vazio: false, canal_sha256: H('2'), canal_bytes: 10, canal_rows: 6, video_sha256: null, video_bytes: null, video_rows: null, tabelas_lidas: [DAILY], ...extra,
  })
  const grupo = (c: Cena, alvos: unknown[], res: unknown = resumoNovo()) => ({ classe: 'serie', canal: c.canal, mes: '2026-09', alvos, resumo: res })
  const corpoPadrao = (c: Cena, a: Alvo, removidas = 4, nova = 6, res: unknown = resumoNovo()) =>
    grupo(c, [{ alvo_id: a.id, removidas, unidade: unidadeNova(nova) }], res)
  async function ok(r: Awaited<ReturnType<typeof tenta>>): Promise<Linha> {
    expect(r.ok, JSON.stringify(r)).toBe(true)
    return r.ok ? (r.rows[0]!.r as Linha) : {}
  }
  const contagens = async (c: Cena): Promise<string> => JSON.stringify((await pg.query(
    `select (select count(*) from public.obs_archive_units where site_id = $1) u, (select count(*) from public.obs_archive_summaries where site_id = $1) s,
            (select count(*) from public.obs_archive_absence where site_id = $1) a, (select string_agg(estado || ':' || coalesce(motivo, ''), ',' order by id) from public.obs_archive_item_targets where site_id = $1) t`, [c.site])).rows[0])
  const alvoLinha = async (id: number): Promise<Linha> => (await pg.query(`select * from public.obs_archive_item_targets where id = $1`, [id])).rows[0]

  it('open: grupo pronto (forma, caminho, partes, outras, vazias)', async () => {
    await emTx(async c => {
      const u = await unidade(c)
      const a = await alvo(c, u)
      await unidade(c, { tabela: EARLY, rows: 5 })                           // corrente com linhas, não é alvo: outras
      await resumo(c)
      await mesSelado(c)
      const r = await ok(await abrir(c))
      const g = (r.grupos as Linha[])[0]!
      expect(r.esperando).toBe(0)
      expect(g).toMatchObject({ classe: 'serie', canal: c.canal, mes: '2026-09', filho: 'numerico', mes_online: true, dias_do_mes: 30, resumo: { versao: 1, canal: H('7'), video: H('8') } })
      const al = (g.alvos as Linha[])[0]!
      expect(al).toMatchObject({ alvo_id: a.id, tabela: DAILY, versao: 1, linhas: 10, soma: 100, coluna_controle: 'views', schema_fp: H('b'), hash_conteudo: H('a'), esperadas: 4, chaves: [c.video], refs: ['yt1'] })
      expect(al.arquivos).toEqual([{ caminho: `serie/canais/${c.canal}/${DAILY}/2026-09.v1.csv.gz`, sha256: H('c'), parte: 1 }])
      expect(g.outras).toMatchObject([{ tabela: EARLY, versao: 1, linhas: 5 }])
      expect((g.outras as Linha[])[0]!.arquivos).toHaveLength(1)
      expect(g.vazias).toEqual([])
      expect(Object.keys(g).sort()).toEqual(['alvos', 'canal', 'classe', 'dias_do_mes', 'filho', 'mes', 'mes_online', 'outras', 'resumo', 'vazias'])
    })
  })

  it('open: unidade em partes (.pNN.) e unidade vazia em vazias; mês fora do banco', async () => {
    await emTx(async c => {
      const u = await unidade(c, { classe: 'texto', tabela: 'competitor_video_comments', rows: 10, partes: 2, mes: MES })
      await unidade(c, { classe: 'texto', tabela: 'competitor_video_comment_marks', rows: 0, mes: MES })
      await alvo(c, u, { classe: 'texto', tabela: 'competitor_video_comments', kind: 'comentario' })
      const r = await ok(await abrir(c))
      const g = (r.grupos as Linha[])[0]!
      const arq = ((g.alvos as Linha[])[0]!.arquivos as Linha[])
      expect(arq.map(x => x.caminho)).toEqual([
        `texto/canais/${c.canal}/competitor_video_comments/2026-09.v1.p01.csv.gz`, `texto/canais/${c.canal}/competitor_video_comments/2026-09.v1.p02.csv.gz`])
      expect(arq.map(x => x.parte)).toEqual([1, 2])
      expect(g.vazias).toEqual([{ tabela: 'competitor_video_comment_marks', hash_conteudo: H('a') }])
      expect(g.outras).toEqual([])
      await pg.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at) values ($1, 'texto', 'competitor_video_comments', $2::date, now())`, [c.site, MES])
      const g2 = ((await ok(await abrir(c))).grupos as Linha[])[0]!
      expect(g2.mes_online).toBe(false)
    })
  })

  it('open: versão em curso (unidade corrente com linhas e sem recebimento; resumo sem recebimento)', async () => {
    await emTx(async c => {
      const u = await unidade(c)
      await alvo(c, u)
      await unidade(c, { versao: 2, recebida: false })
      const r = await ok(await abrir(c))
      expect(r).toEqual({ grupos: [], esperando: 1 })
    })
    await emTx(async c => {
      const u = await unidade(c)
      await alvo(c, u)
      await resumo(c, { recebida: false })
      expect(await ok(await abrir(c))).toEqual({ grupos: [], esperando: 1 })
    })
  })

  it('open: rebase (corrente recebida reaponta; vazia ou purgada vira sem_linhas)', async () => {
    await emTx(async c => {
      const u = await unidade(c)
      const a = await alvo(c, u)
      const v2 = await unidade(c, { versao: 2, rows: 8 })
      const g = ((await ok(await abrir(c))).grupos as Linha[])[0]!
      expect(((g.alvos as Linha[])[0]!)).toMatchObject({ alvo_id: a.id, versao: 2, linhas: 8 })
      expect(await alvoLinha(a.id)).toMatchObject({ from_unit_id: v2, from_version: 2, estado: 'copiar' })
    })
    for (const vazia of [true, false]) {
      await emTx(async c => {
        const u = await unidade(c)
        const a = await alvo(c, u)
        if (vazia) await unidade(c, { versao: 2, rows: 0 })
        else await purgar(u)
        const r = await ok(await abrir(c))
        expect(r.grupos).toEqual([])
        expect(await alvoLinha(a.id)).toMatchObject({ estado: 'sem_linhas' })
        expect((await alvoLinha(a.id)).done_at).not.toBeNull()
      })
    }
  })

  it('open e record: item desconhecido', async () => {
    await emTx(async c => {
      const r = await abrir(c, 99)
      expect(r).toMatchObject({ ok: false, code: 'P0001', message: 'item_desconhecido' })
      const r2 = await registrar(c, grupo(c, []), 99)
      expect(r2).toMatchObject({ ok: false, code: 'P0001', message: 'item_desconhecido' })
    })
  })

  it('open: alvo de outro item no mesmo grupo não entra em alvos, aparece em outras', async () => {
    await emTx(async c => {
      const u = await unidade(c)
      const a1 = await alvo(c, u)
      const u2 = await unidade(c, { tabela: EARLY, rows: 5 })
      await alvo(c, u2, { item: 2, tabela: EARLY, esperadas: 2 })
      const g = ((await ok(await abrir(c, 1))).grupos as Linha[])[0]!
      expect((g.alvos as Linha[]).map(x => x.alvo_id)).toEqual([a1.id])
      expect((g.outras as Linha[]).map(x => x.tabela)).toEqual([EARLY])
    })
  })

  it('record: caminho feliz (unidade nova, resumo, hashes, ausência por versão, selo reaberto)', async () => {
    await emTx(async c => {
      const u = await unidade(c)
      const a = await alvo(c, u)
      await mesSelado(c)
      const r = await ok(await registrar(c, corpoPadrao(c, a)))
      expect(r.status).toBe('ok')
      const nova = (await pg.query(`select * from public.obs_archive_units where site_id = $1 and version = 2`, [c.site])).rows[0] as Linha
      expect(nova).toMatchObject({ origem: 'expurgo', row_count: '6', table_name: DAILY })
      const resumoLinha = (await pg.query(`select * from public.obs_archive_summaries where site_id = $1 and version = 1`, [c.site])).rows[0] as Linha
      expect(resumoLinha).toMatchObject({ origem: 'expurgo', empty: false, canal_sha256: H('2') })
      expect(resumoLinha.unit_hashes).toEqual(JSON.parse(await escalar<string>(pg, `select public.obs_archive_channel_unit_hashes($1, 'serie', $2, $3::date)::text`, [c.site, c.canal, MES])))
      expect(resumoLinha.unit_hashes).toHaveProperty(`u:${nova.id}`)
      expect(await alvoLinha(a.id)).toMatchObject({ estado: 'aguardando_nova', to_unit_id: nova.id, to_version: 2, rows_removed: '4' })
      const aus = (await pg.query(`select * from public.obs_archive_absence where site_id = $1 order by id`, [c.site])).rows as Linha[]
      expect(aus).toHaveLength(1)
      expect(aus[0]).toMatchObject({ alvo: `alvo:${a.id}`, alvo_id: String(a.id), filho: 'numerico', e_prefixo: false, sha256: H('c'),
        prefixo: `serie/canais/${c.canal}/${DAILY}/2026-09.v1.csv.gz`, nova_caminho: `serie/canais/${c.canal}/${DAILY}/2026-09.v2.csv.gz`, nova_sha256: H('f') })
      expect(await escalar<string>(pg, `select unsealed_reason from public.obs_archive_months where site_id = $1`, [c.site])).toBe('expurgo')
      expect(r.resumo).toMatchObject({ versao: 1 })
    })
  })

  it('record: uma ausência por versão anterior, inteira ou por parte', async () => {
    await emTx(async c => {
      const v1 = await unidade(c, { rows: 10, partes: 2 })
      await unidade(c, { versao: 2, rows: 10 })
      await pg.query(`update public.obs_archive_units set received_at = now() where id = $1`, [v1])
      const a = await alvo(c, (await pg.query(`select id from public.obs_archive_units where site_id = $1 and version = 2`, [c.site])).rows[0].id as string, { versao: 2 })
      const r = await ok(await registrar(c, corpoPadrao(c, a)))
      expect(r.status).toBe('ok')
      const aus = (await pg.query(`select prefixo from public.obs_archive_absence where site_id = $1 order by prefixo`, [c.site])).rows.map(x => x.prefixo as string)
      expect(aus).toEqual([
        `serie/canais/${c.canal}/${DAILY}/2026-09.v1.p01.csv.gz`, `serie/canais/${c.canal}/${DAILY}/2026-09.v1.p02.csv.gz`, `serie/canais/${c.canal}/${DAILY}/2026-09.v2.csv.gz`])
    })
  })

  it('record: resumo anterior com os papéis canal e video, novo só com canal: duas ausências, a do video com nova nula', async () => {
    await emTx(async c => {
      const u = await unidade(c)
      const a = await alvo(c, u)
      await resumo(c, { versao: 1 })
      const r = await ok(await registrar(c, corpoPadrao(c, a, 4, 6, resumoNovo({ versao: 2 }))))
      expect(r.status).toBe('ok')
      const aus = (await pg.query(`select * from public.obs_archive_absence where site_id = $1 and prefixo like '%/resumo/%' order by prefixo`, [c.site])).rows as Linha[]
      expect(aus).toHaveLength(2)
      expect(aus[0]).toMatchObject({ prefixo: `serie/canais/${c.canal}/resumo/2026-09.v1.canal.csv.gz`, sha256: H('7'), nova_sha256: H('2'),
        nova_caminho: `serie/canais/${c.canal}/resumo/2026-09.v2.canal.csv.gz`, alvo_id: String(a.id) })
      expect(aus[1]).toMatchObject({ prefixo: `serie/canais/${c.canal}/resumo/2026-09.v1.video.csv.gz`, sha256: H('8'), nova_caminho: null, nova_sha256: null })
    })
  })

  it('record: nova vazia (removidas = todas as linhas)', async () => {
    await emTx(async c => {
      const u = await unidade(c)
      const a = await alvo(c, u, { esperadas: 10 })
      const r = await ok(await registrar(c, corpoPadrao(c, a, 10, 0, resumoNovo({ vazio: true, canal_sha256: null, canal_bytes: null, canal_rows: null }))))
      expect(r.status).toBe('ok')
      const nova = (await pg.query(`select * from public.obs_archive_units where site_id = $1 and version = 2`, [c.site])).rows[0] as Linha
      expect(nova).toMatchObject({ row_count: '0', sha256_bytes: null })
      expect(nova.received_at).not.toBeNull()
      const aus = (await pg.query(`select * from public.obs_archive_absence where site_id = $1`, [c.site])).rows as Linha[]
      expect(aus).toHaveLength(1)
      expect(aus[0]).toMatchObject({ nova_caminho: null, nova_sha256: null })
      const s = (await pg.query(`select * from public.obs_archive_summaries where site_id = $1`, [c.site])).rows[0] as Linha
      expect(s).toMatchObject({ empty: true, canal_sha256: null })
      expect(s.received_at).not.toBeNull()
    })
  })

  const recusas: Array<[string, (c: Cena, a: Alvo) => Promise<unknown>, string]> = [
    ['alvo_de_outro_item', async (c, a) => {
      const u2 = await unidade(c, { tabela: EARLY, rows: 5 })
      const b = await alvo(c, u2, { item: 2, tabela: EARLY })
      return grupo(c, [{ alvo_id: a.id, removidas: 4, unidade: unidadeNova(6) }, { alvo_id: b.id, removidas: 4, unidade: unidadeNova(1, { }) }])
    }, 'alvo_de_outro_item'],
    ['alvo_fora_de_copiar', async (c, a) => {
      await pg.query(`update public.obs_archive_item_targets set estado = 'bloqueado', motivo = 'antiga_ausente' where id = $1`, [a.id])
      return corpoPadrao(c, a)
    }, 'alvo_fora_de_copiar'],
    ['grupo_incompleto', async (c, a) => {
      const u2 = await unidade(c, { tabela: EARLY, rows: 5 })
      await alvo(c, u2, { tabela: EARLY })
      return corpoPadrao(c, a)
    }, 'grupo_incompleto'],
    ['base_mudou', async (c, a) => { await unidade(c, { versao: 2, rows: 9 }); return corpoPadrao(c, a) }, 'base_mudou'],
    ['resumo_com_unidade_nao_lida', async (c, a) => corpoPadrao(c, a, 4, 6, resumoNovo({ tabelas_lidas: [] })), 'resumo_com_unidade_nao_lida'],
    ['resumo_versao_mudou', async (c, a) => corpoPadrao(c, a, 4, 6, resumoNovo({ versao: 5 })), 'resumo_versao_mudou'],
    ['resumo_forma', async (c, a) => corpoPadrao(c, a, 4, 6, resumoNovo({ vazio: true })), 'resumo_forma'],
  ]
  for (const [nome, monta, motivo] of recusas) {
    it(`record: recusa ${nome} sem escrever nada`, async () => {
      await emTx(async c => {
        const u = await unidade(c)
        const a = await alvo(c, u)
        const corpo = await monta(c, a)
        const antes = await contagens(c)
        const r = await ok(await registrar(c, corpo))
        expect(r).toMatchObject({ status: 'recusado', motivo })
        expect(await contagens(c)).toBe(antes)
      })
    })
  }

  const contagemErrada: Array<[string, number | null, number, number]> = [
    ['removidas = 0 com esperadas > 0', 4, 0, 10], ['removidas > esperadas', 4, 5, 5], ['row_count diferente de antiga - removidas', 4, 4, 7],
  ]
  for (const [nome, esperadas, rem, nova] of contagemErrada) {
    it(`registrar_recusa_contagem_errada: ${nome} bloqueia e o commit persiste`, async () => {
      await emTx(async c => {
        const u = await unidade(c)
        const a = await alvo(c, u, { esperadas })
        const antes = JSON.parse(await contagens(c)) as Linha
        const r = await ok(await registrar(c, corpoPadrao(c, a, rem, nova)))
        expect(r).toMatchObject({ status: 'recusado', motivo: 'contagem_divergente', alvo_id: a.id })
        expect(await alvoLinha(a.id)).toMatchObject({ estado: 'bloqueado', motivo: 'contagem_divergente' })
        const depois = JSON.parse(await contagens(c)) as Linha
        expect({ ...depois, t: null }).toEqual({ ...antes, t: null })
      })
    })
  }

  it('record: mês fora do banco (esperadas nulo, removidas 0 => sem_linhas; mês online com esperadas nulo => bloqueia)', async () => {
    await emTx(async c => {
      const u = await unidade(c)
      const a = await alvo(c, u, { esperadas: null })
      await mesSelado(c, { fora: true })
      const antes = await contagens(c)
      const r = await ok(await registrar(c, corpoPadrao(c, a, 0, 10)))
      expect(r).toMatchObject({ status: 'ok', alvos: [{ alvo_id: a.id, estado: 'sem_linhas' }], resumo: null })
      expect(await alvoLinha(a.id)).toMatchObject({ estado: 'sem_linhas' })
      expect(JSON.parse(await contagens(c)).u).toBe(JSON.parse(antes).u)
    })
    await emTx(async c => {
      const u = await unidade(c)
      const a = await alvo(c, u, { esperadas: null })
      const r = await ok(await registrar(c, corpoPadrao(c, a, 0, 10)))
      expect(r).toMatchObject({ status: 'recusado', motivo: 'contagem_divergente' })
      expect(await alvoLinha(a.id)).toMatchObject({ estado: 'bloqueado', motivo: 'contagem_divergente' })
    })
  })

  it('record: guarda do insert (mês dropped passa pelo record; insert direto sem a marca falha)', async () => {
    await emTx(async c => {
      const u = await unidade(c)
      await pg.query(`update public.obs_archive_units set dropped_at = now() where id = $1`, [u])
      const a = await alvo(c, u, { esperadas: 4 })
      const r = await ok(await registrar(c, corpoPadrao(c, a)))
      expect(r.status).toBe('ok')
      await pg.query(`select set_config('obs_archive.origem', '', true)`)      // a marca vale a transação inteira: o teste a limpa
      const dir = await tenta(pg, `insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp)
        values ($1, 'serie', $2, $3, $4::date, 9, 0, $5, $5)`, [c.site, DAILY, c.canal, MES, H('a')])
      expect(dir).toMatchObject({ ok: false, message: 'unidade_retirada' })
    })
  })

  it('record: duas chamadas com o mesmo corpo (a segunda recusa, nada duplica)', async () => {
    await emTx(async c => {
      const u = await unidade(c)
      const a = await alvo(c, u)
      const corpo = corpoPadrao(c, a)
      expect((await ok(await registrar(c, corpo))).status).toBe('ok')
      const antes = await contagens(c)
      expect(await ok(await registrar(c, corpo))).toMatchObject({ status: 'recusado', motivo: 'alvo_fora_de_copiar' })
      expect(await contagens(c)).toBe(antes)
    })
  })

  it('block e unblock', async () => {
    await emTx(async c => {
      const u = await unidade(c)
      const a = await alvo(c, u)
      const blq = (alvoId: number, m: string) => tenta(pg, `select public.obs_archive_expurgo_block($1, $2, $3) as r`, [c.site, alvoId, m])
      const desb = (alvoId: number) => tenta(pg, `select public.obs_archive_expurgo_unblock($1, $2) as r`, [c.site, alvoId])
      expect(await ok(await blq(a.id, 'depende_m10b'))).toMatchObject({ status: 'recusado', motivo: 'forma' })
      expect(await alvoLinha(a.id)).toMatchObject({ estado: 'copiar' })
      expect(await ok(await blq(a.id, 'antiga_ausente'))).toMatchObject({ status: 'ok' })
      expect(await alvoLinha(a.id)).toMatchObject({ estado: 'bloqueado', motivo: 'antiga_ausente' })
      expect(await ok(await blq(a.id, 'antiga_ausente'))).toMatchObject({ status: 'recusado', motivo: 'alvo_fora_de_copiar' })
      expect(await ok(await desb(a.id))).toMatchObject({ status: 'ok' })
      expect(await alvoLinha(a.id)).toMatchObject({ estado: 'copiar', motivo: null })
      expect(await ok(await desb(a.id))).toMatchObject({ status: 'recusado', motivo: 'alvo_fora_de_bloqueado' })
      await pg.query(`update public.obs_archive_item_targets set estado = 'bloqueado', motivo = 'depende_m10b' where id = $1`, [a.id])
      expect(await ok(await desb(a.id))).toMatchObject({ status: 'recusado', motivo: 'depende_m10b' })
      expect(await blq(999999, 'antiga_ausente')).toMatchObject({ ok: false, message: 'item_desconhecido' })
    })
  })

  it('permissões (has_function_privilege)', async () => {
    await emTx(async () => {
      const prv = (fn: string, role: string) => escalar<boolean>(pg, `select has_function_privilege($1, $2, 'EXECUTE')`, [role, fn])
      for (const fn of ['obs_archive_expurgo_open(uuid,bigint)', 'obs_archive_expurgo_record(uuid,bigint,jsonb)', 'obs_archive_expurgo_block(uuid,bigint,text)']) {
        expect(await prv(`public.${fn}`, 'service_role'), fn).toBe(true)
        expect(await prv(`public.${fn}`, 'anon'), fn).toBe(false)
        expect(await prv(`public.${fn}`, 'authenticated'), fn).toBe(false)
      }
      const fechadas = ['obs_archive_expurgo_unblock(uuid,bigint)', 'obs_archive_cur_group(uuid,text,text,date)', 'obs_archive_grupo_pronto(uuid,text,text,date)',
        'obs_archive_arquivos_da_unidade(uuid)', 'obs_archive_caminho_unidade(text,text,text,date,integer,integer)']
      for (const fn of fechadas) for (const r of ['service_role', 'anon', 'authenticated']) expect(await prv(`public.${fn}`, r), `${fn} ${r}`).toBe(false)
    })
  })
})
