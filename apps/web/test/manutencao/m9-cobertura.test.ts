// @vitest-environment node
/**
 * M9 Tarefa 14: cobertura dos itens do `06-aceite-e-riscos` que a M9 fecha. Cada `it` chama a função dona e afirma o efeito (banco de integração, begin … rollback).
 *
 * | Item     | O que fecha                                                    | Onde                                           |
 * |----------|----------------------------------------------------------------|------------------------------------------------|
 * | 65       | vídeo apagado vira item com alvos e bandeira                   | este arquivo                                   |
 * | 66       | item_advance não passa de aguardando_nova sem a nova recebida  | este arquivo                                   |
 * | 67       | competitor_removed_items nunca é podada                        | este arquivo                                   |
 * | 109/110/111 | canal: pedido, apagado_nas, apagado_b2, concluido com atestados | este arquivo                                |
 * | 120      | sem snap_absent_at o canal não passa de apagado_nas            | este arquivo                                   |
 * | 161/163/165 | versão antiga superada sai só depois da nova conferida      | este arquivo                                   |
 * | emergência/desbloqueio/ligar | comandos do runbook                         | este arquivo (+ manutencao-m9-leitores-ts)     |
 * | 161/163/165 (comando `expurgar --canal`, tela) | FORA: Tarefa 12, vai à M9b | it.todo abaixo                                 |
 * NÃO há linha de "retenção de snapshots" (saiu do desenho: Phil I1).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { m3bNoBanco, aplicarM3b, escalar, tenta, semearCanal, semearDiaria } from '../helpers/m3b'
import { criarUsuario } from '../helpers/mg6'
import { aplicarM9 } from '../helpers/m9'
import { travarDdl } from '../helpers/ddl-testes'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const H = (ch: string): string => ch.repeat(64)
const DAILY = 'competitor_video_daily'
const COMENT = 'competitor_video_comments'
const MES = '2026-09-01'
type Cena = { site: string; canal: string; videos: string[]; admin: string }

describe.skipIf(skipIfNoLocalDb())('M9 cobertura dos itens (Tarefa 14)', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })

  async function emTx(fn: (c: Cena) => Promise<void>): Promise<void> {
    await pg.query('begin'); await pg.query('select pg_advisory_xact_lock(7339001)')
    try {
      if (!(await m3bNoBanco(pg))) await aplicarM3b(pg)
      await travarDdl(pg)
      await aplicarM9(pg, 6)
      const s = await semearCanal(pg, { videos: 2 })
      const admin = await criarUsuario(pg)
      await pg.query(`insert into public.organization_members (org_id, user_id, role) select s.org_id, $2, 'org_admin' from public.sites s where s.id = $1`, [s.site, admin])
      await fn({ site: s.site, canal: s.canal, videos: s.videos, admin })
    } finally { await pg.query('rollback') }
  }
  const ligar = (c: Cena, v = true) => pg.query(`select public.obs_archive_m9_ligar($1, $2)`, [c.site, v])
  async function unidade(c: Cena, o: { v?: number; classe?: string; tabela?: string; linhas?: number; recebida?: boolean; atestada?: boolean; superada?: boolean; idade?: string; atestadaHa?: string } = {}): Promise<string> {
    const idade = o.idade ?? '1 days'
    return (await pg.query(
      `insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, control_sum, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, parts,
         received_at, nas_attested_at, superseded_at)
       values ($1, $2, $3, $4, $5::date, $6, $7, 100, $8, $9, $10, $11, 100, 1,
         case when $12 then now() - $14::interval end, case when $13 then now() - coalesce($16, $14)::interval end, case when $15 then now() - interval '1 hour' end) returning id`,
      [c.site, o.classe ?? 'serie', o.tabela ?? DAILY, c.canal, MES, o.v ?? 1, o.linhas ?? 10, H('a'), H('b'), H(String(o.v ?? 1)), H('c'),
       o.recebida ?? true, o.atestada ?? true, idade, o.superada ?? false, o.atestadaHa ?? null])).rows[0].id as string
  }
  const b2 = (c: Cena, arquivo: string, classe = 'serie') => pg.query(
    `insert into public.obs_archive_b2_files (site_id, arquivo_id, class, month, last_ok_at) values ($1, $2, $3, $4::date, now())`, [c.site, arquivo, classe, MES])
  async function alvo(c: Cena, de: string, para: string | null, estado = 'aguardando_nova', ref = 'yt1', item = 1, tabela = DAILY): Promise<number> {
    return Number((await pg.query(
      `insert into public.obs_archive_item_targets (site_id, item_kind, item_refs, item_id, class, table_name, channel_ref, month, keys, esperadas, from_unit_id, from_version, estado, to_unit_id, to_version)
       values ($1, 'video', array[$2], $3, 'serie', $4, $5, $6::date, array[$7], 4, $8, 1, $9, $10, case when $10::uuid is null then null else 2 end) returning id`,
      [c.site, ref, item, tabela, c.canal, MES, c.videos[0], de, estado, para])).rows[0].id)
  }
  const lerAlvo = async (id: number) => (await pg.query(`select * from public.obs_archive_item_targets where id = $1`, [id])).rows[0] as Record<string, unknown>
  const advance = (c: Cena) => escalar<number>(pg, `select public.obs_archive_item_advance($1)`, [c.site])

  it('item 65: vídeo removido vira item com alvos antes da cascata e a bandeira ligada', async () => {
    await emTx(async c => {
      await pg.query(`update public.competitor_videos set missing_since = current_date - 3 where id = $1`, [c.videos[0]])
      await semearDiaria(pg, c.videos, '2026-09-25', 10)
      const online = await escalar<number>(pg, `select count(*)::int from public.competitor_video_daily t join public.competitor_videos v on v.id = t.video_id
        where v.competitor_channel_id = $1 and t.snap_date >= $2::date and t.snap_date < ($2::date + interval '1 month')`, [c.canal, MES])
      for (const m of ['2026-09-01', '2026-10-01']) {
        const n = m === MES ? online : await escalar<number>(pg, `select count(*)::int from public.competitor_video_daily t join public.competitor_videos v on v.id = t.video_id
          where v.competitor_channel_id = $1 and t.snap_date >= $2::date and t.snap_date < ($2::date + interval '1 month')`, [c.canal, m])
        await pg.query(
          `insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, received_at)
           values ($1, 'serie', $2, $3, $4::date, 1, $5, repeat('a', 64), repeat('b', 64), repeat('c', 64), repeat('d', 64), 100, now())`, [c.site, DAILY, c.canal, m, n])
      }
      await ligar(c)
      await pg.query('set local role service_role')
      const r = await tenta(pg, `select public.competitor_video_purge($1, $2, $3, 60, '203.0.113.7', 'ua') as r`, [c.site, c.videos[0], c.admin])
      await pg.query('reset role')
      expect(r.ok, JSON.stringify(r)).toBe(true)
      const alvos = (await pg.query(`select item_kind, estado, keys from public.obs_archive_item_targets where site_id = $1`, [c.site])).rows
      expect(alvos.length).toBeGreaterThan(0)
      expect(alvos.every(a => a.item_kind === 'video' && a.estado === 'copiar' && (a.keys as string[]).includes(c.videos[0]!))).toBe(true)
      expect(await escalar<boolean>(pg, `select archive_pending from public.competitor_removed_items where site_id = $1 and kind = 'video'`, [c.site])).toBe(true)
      expect(await escalar(pg, `select count(*)::int from public.competitor_videos where id = $1`, [c.videos[0]])).toBe(0)
    })
  })

  it('item 66: item_advance não passa de aguardando_nova sem a nova recebida (falta = unidade_no_nas)', async () => {
    await emTx(async c => {
      const v1 = await unidade(c, { v: 1, idade: '5 days' })
      const v2 = await unidade(c, { v: 2, recebida: false, atestada: false })
      const t = await alvo(c, v1, v2)
      await ligar(c)
      expect(await escalar<string | null>(pg, `select public.obs_archive_item_falta($1)`, [t])).toBe('unidade_no_nas')
      await advance(c)
      expect((await lerAlvo(t)).estado).toBe('aguardando_nova')
    })
  })

  it('item 67: competitor_removed_items continua lá depois de item_advance até concluido (nenhuma poda)', async () => {
    await emTx(async c => {
      await ligar(c)
      const v1 = await unidade(c, { v: 1, idade: '5 days' })
      const v2 = await unidade(c, { v: 2 })
      const item = (await pg.query(
        `insert into public.competitor_removed_items (site_id, kind, youtube_id, competitor_channel_id, decided_at, decided_by, rows_deleted)
         values ($1, 'video', 'yt1', $2, now(), $3, '{}'::jsonb) returning id`, [c.site, c.canal, c.admin])).rows[0].id as string
      const t = await alvo(c, v1, v2, 'apagar_antigas')
      await advance(c)                       // sem linha de ausência: concluído direto
      expect((await lerAlvo(t)).estado).toBe('concluido')
      expect(await escalar(pg, `select count(*)::int from public.competitor_removed_items where id = $1`, [item])).toBe(1)
    })
  })

  describe('canal removido (109, 110, 111, 120)', () => {
    const tudo = `nas_absent_first_at = now() - interval '20 hours', nas_absent_at = now() - interval '5 hours', nas_last_absent_at = now() - interval '1 hour'`
    async function comCanal(c: Cena): Promise<number[]> {
      await unidade(c)
      await pg.query(
        `insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known) values ($1, $2, 'botao', 'apagar', now(), true)`, [c.site, c.canal])
      return (await pg.query(`select id from public.obs_archive_absence where site_id = $1 and alvo = $2 order by id`, [c.site, `canal:${c.canal}`])).rows.map(x => Number(x.id))
    }
    const adv = (c: Cena) => pg.query(`select public.obs_archive_removal_advance($1)`, [c.site])
    const rem = async (c: Cena) => (await pg.query(`select * from public.obs_archive_channel_removals where site_id = $1`, [c.site])).rows[0] as Record<string, unknown>
    const set = (ids: number[], extra: string) => pg.query(`update public.obs_archive_absence set ${extra} where id = any($1)`, [ids])

    it('109/110/111: pedido, apagado_nas, apagado_b2 e concluido só com os três atestados', async () => {
      await emTx(async c => {
        await ligar(c)
        const ids = await comCanal(c)
        expect(ids).toHaveLength(3)
        await adv(c)
        expect((await rem(c)).nas_absent_at).toBeNull()                         // pedido
        await set(ids, tudo)
        await adv(c)
        expect((await rem(c)).nas_absent_at).not.toBeNull()                     // apagado_nas
        expect((await rem(c)).completed_at).toBeNull()
        await set(ids, 'snap_absent_at = now()')
        await adv(c)
        expect((await rem(c)).completed_at).toBeNull()                          // falta o B2
        await set(ids, 'b2_absent_at = now()')
        await adv(c)
        expect((await rem(c)).b2_absent_at).not.toBeNull()                      // apagado_b2
        expect((await rem(c)).completed_at).not.toBeNull()                      // concluido
      })
    })

    it('120: sem snap_absent_at o canal fica em apagado_nas, mesmo com NAS e B2 provados (a prova é direta, sem retenção)', async () => {
      await emTx(async c => {
        await ligar(c)
        const ids = await comCanal(c)
        await set(ids, tudo)
        const antes = await tenta(pg, `update public.obs_archive_absence set b2_absent_at = now() where id = any($1)`, [ids])
        expect(antes.ok).toBe(false)                                            // o B2 só depois da prova de snapshots (check do banco)
        await adv(c)
        const r = await rem(c)
        expect(r.nas_absent_at).not.toBeNull()
        expect(r.snapshots_clear_on).toBeNull()
        expect(r.completed_at).toBeNull()
      })
    })
  })

  describe('versão antiga superada (161, 163, 165)', () => {
    it('só sai depois da nova conferida no B2 e do mês selado (a segunda conferência)', async () => {
      await emTx(async c => {
        await ligar(c)
        const v1 = await unidade(c, { v: 1, idade: '5 days' })
        const v2 = await unidade(c, { v: 2, idade: '1 days' })
        await pg.query(`insert into public.obs_archive_months (site_id, class, table_name, month, sealed_at, b2_attested_at) values ($1, 'serie', $2, $3::date, now() - interval '30 minutes', now() - interval '10 minutes')`, [c.site, DAILY, MES])
        const t = await alvo(c, v1, v2)
        const aus = Number((await pg.query(
          `insert into public.obs_archive_absence (site_id, alvo, alvo_id, filho, prefixo, e_prefixo, sha256) values ($1, $2, $3, 'numerico', 'serie/a.csv.gz', false, $4) returning id`, [c.site, `alvo:${t}`, t, H('e')])).rows[0].id)
        await advance(c)                                                         // B2 sem a nova: nada sai
        expect((await lerAlvo(t)).estado).toBe('aguardando_nova')
        expect((await pg.query(`select liberado_em from public.obs_archive_absence where id = $1`, [aus])).rows[0].liberado_em).toBeNull()
        await b2(c, `u:${v2}`)
        await advance(c)
        expect((await lerAlvo(t)).estado).toBe('apagar_antigas')
        expect((await pg.query(`select liberado_em from public.obs_archive_absence where id = $1`, [aus])).rows[0].liberado_em).not.toBeNull()
        expect((await pg.query(`select superseded_at from public.obs_archive_units where id = $1`, [v1])).rows[0].superseded_at).not.toBeNull()
      })
    })

    it('texto superado entra em antiga:<uuid> aos 30 dias da nova atestada, nunca antes', async () => {
      await emTx(async c => {
        const o = { classe: 'texto', tabela: COMENT } as const
        const v1 = await unidade(c, { ...o, v: 1, superada: true, idade: '60 days' })
        const v2 = await unidade(c, { ...o, v: 2, idade: '29 days', atestadaHa: '1 hour' })
        await b2(c, `u:${v2}`, 'texto')
        expect(await escalar<number>(pg, `select public.obs_archive_antigas_open($1)`, [c.site])).toBe(0)
        await pg.query(`update public.obs_archive_units set received_at = now() - interval '31 days' where id = $1`, [v2])
        expect(await escalar<number>(pg, `select public.obs_archive_antigas_open($1)`, [c.site])).toBe(1)
        const l = (await pg.query(`select alvo from public.obs_archive_absence where site_id = $1 and alvo like 'antiga:%'`, [c.site])).rows
        expect(l.map(x => x.alvo)).toEqual([`antiga:${v1}`])
      })
    })
  })

  describe('comandos do runbook', () => {
    it('obs_archive_m9_ligar: liga e desliga (retorno de emergência), sem EXECUTE para anon e authenticated', async () => {
      await emTx(async c => {
        await ligar(c, true)
        expect(await escalar<boolean>(pg, `select ligado from public.obs_archive_m9_interruptor where site_id = $1`, [c.site])).toBe(true)
        await ligar(c, false)
        expect(await escalar<boolean>(pg, `select ligado from public.obs_archive_m9_interruptor where site_id = $1`, [c.site])).toBe(false)
        expect(await escalar<boolean>(pg, `select has_function_privilege('anon', 'public.obs_archive_m9_ligar(uuid,boolean)', 'EXECUTE')`)).toBe(false)
        expect(await escalar<boolean>(pg, `select has_function_privilege('authenticated', 'public.obs_archive_m9_ligar(uuid,boolean)', 'EXECUTE')`)).toBe(false)
      })
    })

    it('obs_archive_expurgo_unblock: bloqueado volta a copiar; depende_m10b e estado fora de bloqueado recusam', async () => {
      await emTx(async c => {
        const v1 = await unidade(c, { v: 1 })
        const t = await alvo(c, v1, null, 'copiar')
        await pg.query(`update public.obs_archive_item_targets set estado = 'bloqueado', motivo = 'antiga_ausente' where id = $1`, [t])
        const r = await escalar<Record<string, unknown>>(pg, `select public.obs_archive_expurgo_unblock($1, $2)`, [c.site, t])
        expect(r).toMatchObject({ status: 'ok' })
        expect(await lerAlvo(t)).toMatchObject({ estado: 'copiar', motivo: null })
        expect(await escalar<Record<string, unknown>>(pg, `select public.obs_archive_expurgo_unblock($1, $2)`, [c.site, t])).toMatchObject({ status: 'recusado', motivo: 'alvo_fora_de_bloqueado' })
        const t2 = await alvo(c, v1, null, 'copiar', 'yt2', 2, 'competitor_video_early')
        await pg.query(`update public.obs_archive_item_targets set estado = 'bloqueado', motivo = 'depende_m10b' where id = $1`, [t2])
        expect(await escalar<Record<string, unknown>>(pg, `select public.obs_archive_expurgo_unblock($1, $2)`, [c.site, t2])).toMatchObject({ status: 'recusado', motivo: 'depende_m10b' })
      })
    })
  })

  it.todo('item 161 (comando `expurgar --canal`, uuid com aspas recusado antes do registro): FORA, Tarefa 12 vai à M9b')
  it.todo('item 163 (tela: limpeza pedida, sem_destino, ação e estados com prova de fim): FORA, Tarefa 12 vai à M9b')
  it.todo('item 165 (comandos de restauração pulam canal com remoção registrada): FORA, M9b')
})

describe('M9 cobertura: todo comando citado no runbook tem teste', () => {
  const RAIZ = resolve(__dirname, '../../../..')
  const runbook = readFileSync(resolve(RAIZ, 'docs/ops/runbook-arquivo-mensal.md'), 'utf8')
  const secao = runbook.slice(runbook.indexOf('## Expurgo enxuto (M9, Tarefa 14)'))
  const testes = (d: string): string[] => readdirSync(d, { recursive: true, encoding: 'utf8' }).filter(f => /\.test\.tsx?$/.test(f)).map(f => resolve(d, f))
  const corpus = [...testes(resolve(RAIZ, 'apps/web/test'))].filter(f => !f.endsWith('m9-cobertura.test.ts')).map(f => readFileSync(f, 'utf8')).join('\n')
  const proprio = readFileSync(__filename, 'utf8').split('describe(\'M9 cobertura: todo comando')[0]!

  it('a seção existe e cita comandos', () => {
    expect(secao.length).toBeGreaterThan(500)
  })
  const funcoes = [...new Set([...secao.matchAll(/\b(obs_archive_[a-z0-9_]+)\b/g)].map(m => m[1]!))]
  it('as funções citadas são as esperadas (lista fixa: nova citação exige teste)', () => {
    expect(funcoes.sort()).toEqual(['obs_archive_expurgo_unblock', 'obs_archive_item_falta', 'obs_archive_m9_ligar', 'obs_archive_owner_pending', 'obs_archive_removal_advance'].sort())
  })
  for (const f of ['obs_archive_expurgo_unblock', 'obs_archive_item_falta', 'obs_archive_m9_ligar', 'obs_archive_owner_pending', 'obs_archive_removal_advance']) {
    it(`função ${f} é chamada em algum teste`, () => { expect(corpus + proprio).toContain(f) })
  }
  for (const [nome, marca] of [['obs:arquivo', 'obs:arquivo'], ['obs:expurgar', 'obs:expurgar'], ['m9-emergencia.sql', 'm9-emergencia.sql']] as const) {
    it(`comando ${nome} citado no runbook e coberto por teste`, () => {
      expect(secao).toContain(marca)
      expect(corpus).toContain(marca)
    })
  }
})
