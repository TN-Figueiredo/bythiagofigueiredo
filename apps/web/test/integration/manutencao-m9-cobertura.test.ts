// @vitest-environment node
/**
 * M9 Tarefa 14: cobertura dos itens do `06-aceite-e-riscos` que a M9 fecha. Cada `it` chama a função dona e afirma o efeito (banco de integração, begin … rollback).
 *
 * Numeração do `06-aceite-e-riscos` (texto real do item, não o do Passo 1 do plano; Yannis I4, Phil I4):
 * | Item  | O que o 06 pede                                              | Quem prova                                                              | Falta |
 * |-------|--------------------------------------------------------------|-------------------------------------------------------------------------|-------|
 * | 65    | "apagar" com cópia deixa "arquivo pendente"                  | `it` "item 65" (purge real, alvos e bandeira)                           | "Já rodei" fecha: manutencao-m9-avanco `marcar_rodado`; 31/61 dias: it.todo |
 * | 66    | nova recebida antes de passar de aguardando_nova             | `it` "item 66" + manutencao-m9-avanco `item_falta: a ordem`             | partes do expurgar: arquivo-expurgar.test |
 * | 67    | competitor_removed_items sem rotina que a pode               | `it` "item 67" (advance + prosrc de pg_proc)                            | nada |
 * | 109   | lista gravada antes da cascata, em qualquer versão           | `it` "item 65" (captura no purge); `item_capture` olha a versão mais nova | versões anteriores: manutencao-m9-captura |
 * | 110   | todas as versões; texto aos 30 dias; numérica só com item    | `it` "versão antiga superada" (texto, 29 d x 31 d) + avanco `antigas_open` | nada |
 * | 111   | "Já rodei" + reconferência devolve o item, em âmbar          | NINGUÉM (avanco só grava e desfaz a marca)                              | it.todo abaixo |
 * | 120   | nenhum arquivo do mês contém o item; reconferência acusa     | NINGUÉM para unidade/resumo/manifesto; `it` "120" prova só o canal sem snap | it.todo abaixo |
 * | 109/110/111 de canal | pedido, apagado_nas, apagado_b2, concluido   | `it` "canal: marcos" + manutencao-m9b-canal (de ponta a ponta)       | tela: T7 |
 * | 120 (canal) | sem snap_absent_at o canal não passa de apagado_nas   | `it` "canal sem snap_absent_at"                                         | nada |
 * | 161/163 | `expurgar --canal` (não existe, Decisão 1 da M9b), tela    | 161: `it` "item 161 relido" + manutencao-m9b-canal (T6); 163: ação T2, provas de fim T6 | 163: tela (T7, it.todo) |
 * | 165   | restauração pula canal removido; `purged_at` não é arquivo_ausente | canal: `it` "item 165, parte canal"; purged_at do plano: T6; no kit: it.todo (núcleo, dívida no runbook) | kit (núcleo) |
 * | emergência/desbloqueio/ligar | comandos do runbook                    | este arquivo + manutencao-m9-leitores-ts                                | nada |
 * Nada neste arquivo cobre 31/61 dias nem "Já rodei" + reconferência: afirmar o contrário é erro (Yannis I4).
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
const RAIZ_REPO = resolve(__dirname, '../../../..')
const secaoDoRunbook = (): string => { const r = readFileSync(resolve(RAIZ_REPO, 'docs/ops/runbook-arquivo-mensal.md'), 'utf8'); return r.slice(r.indexOf('## Expurgo enxuto (M9, Tarefa 14)')) }
/** Todo SQL que o runbook manda o dono rodar: blocos ```sql e `select ...;` em linha. */
const sqlDoRunbook = (secao: string): string[] => [...new Set([
  ...[...secao.matchAll(/```sql\n([\s\S]*?)```/g)].map(m => m[1]!.trim()),
  ...[...secao.matchAll(/`(select [^`]+;)`/g)].map(m => m[1]!),
])]
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
      const v2 = await unidade(c, { v: 2, recebida: false, atestada: true })   // atestada sem recebida: mata o mutante M1 (Yannis M1)
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
      // a guarda do item 67: nenhuma função do schema public apaga dessa tabela (inclui obs_archive_absence_prune)
      expect(await escalar<number>(pg, `select count(*)::int from pg_proc where pronamespace = 'public'::regnamespace and prosrc ~* 'delete\\s+from\\s+(public\\.)?competitor_removed_items'`)).toBe(0)
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

    it('canal: marcos pedido, apagado_nas, apagado_b2 e concluido só com os três atestados', async () => {
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

    it('canal sem snap_absent_at fica em apagado_nas: o B2 é recusado antes (a prova é direta, sem retenção)', async () => {
      await emTx(async c => {
        await ligar(c)
        const ids = await comCanal(c)
        await set(ids, tudo)
        const antes = await tenta(pg, `update public.obs_archive_absence set b2_absent_at = now() where id = any($1)`, [ids])
        expect(antes.ok).toBe(false); if (!antes.ok) expect(antes.code).toBe('23514')   // o B2 só depois da prova de snapshots (check do banco)
        await adv(c)
        const r = await rem(c)
        expect(r.nas_absent_at).not.toBeNull()
        expect(r.snapshots_clear_on).toBeNull()
        expect(r.completed_at).toBeNull()
      })
    })
  })

  describe('versão antiga superada (161, 163, 165)', () => {
    it('só sai depois da nova conferida no B2 e do mês selado', async () => {
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

    it('b2_attested_at do mês: nulo ou anterior ao selo segura em b2_nova; depois do selo libera (Yannis I2, mutante M4)', async () => {
      await emTx(async c => {
        await ligar(c)
        const v1 = await unidade(c, { v: 1, idade: '5 days' })
        const v2 = await unidade(c, { v: 2, idade: '1 days' })
        await pg.query(`insert into public.obs_archive_months (site_id, class, table_name, month, sealed_at, b2_attested_at) values ($1, 'serie', $2, $3::date, now() - interval '30 minutes', null)`, [c.site, DAILY, MES])
        await b2(c, `u:${v2}`)
        const t = await alvo(c, v1, v2)
        const falta = () => escalar<string | null>(pg, `select public.obs_archive_item_falta($1)`, [t])
        expect(await falta()).toBe('b2_nova')                                    // nulo
        await advance(c); expect((await lerAlvo(t)).estado).toBe('aguardando_nova')
        await pg.query(`update public.obs_archive_months set b2_attested_at = sealed_at - interval '1 hour' where site_id = $1`, [c.site])
        expect(await falta()).toBe('b2_nova')                                    // anterior ao selo
        await pg.query(`update public.obs_archive_months set b2_attested_at = sealed_at + interval '10 minutes' where site_id = $1`, [c.site])
        expect(await falta()).toBeNull()
        await advance(c); expect((await lerAlvo(t)).estado).not.toBe('aguardando_nova')   // sem linha de ausência, concluído direto (como no item 67)
      })
    })

    it('texto superado entra em antiga:<uuid> aos 30 dias do recebimento da nova (received_at), nunca antes', async () => {
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

  it('todo SQL do runbook roda sem erro, com <site> e <alvo_id> reais (assinatura errada ou função inventada falha aqui)', async () => {
    await emTx(async c => {
      const v1 = await unidade(c, { v: 1 })
      const t = await alvo(c, v1, null, 'copiar')
      const sqls = sqlDoRunbook(secaoDoRunbook())
      expect(sqls.length).toBeGreaterThanOrEqual(8)
      for (const q of sqls) {
        const r = await tenta(pg, q.replaceAll('<site>', c.site).replaceAll('<alvo_id>', String(t)).replaceAll('<canal>', c.canal))
        expect(r.ok, `${q.slice(0, 120)} => ${r.ok ? '' : r.message}`).toBe(true)
      }
    })
  })

  it('item 161 relido (Decisão 1 da M9b): não há `expurgar --canal`; as provas de fim estão na T6 e o CLI recusa o comando', () => {
    const t6 = readFileSync(resolve(RAIZ_REPO, 'apps/web/test/integration/manutencao-m9b-canal.test.ts'), 'utf8')
    for (const prova of ['concluido', 'sem_destino', 'online_thumbs_known', 'blobs_pending']) expect(t6, prova).toContain(prova)
  })
  it.todo('item 163 (tela: estados com texto exato, sem_destino, ação): ação e provas de fim fechadas (T2, T6); falta a TELA, da Tarefa 7 da M9b')
  it.todo('item 65: 31 dias sem rodar dá amarelo e 61 vermelho (nenhum teste nem código achado; decisão da Hanna: entra na M9 ou sai)')
  it.todo('item 65: "Já rodei" fecha o item em "arquivo pendente" (só há marcar_rodado no banco, em manutencao-m9-avanco; falta a ligação com o item)')
  it.todo('item 111: "Já rodei" + reconferência que ainda acha os registros devolve o item à lista, em âmbar (manutencao-m9-avanco só grava e desfaz a marca)')
  it.todo('item 120: nenhum arquivo do mês (unidade, resumo, manifesto, qualquer versão não apagada) contém o item; a reconferência acusa (nenhum teste de ponta a ponta)')
  it('item 165, parte canal: a consulta do comandos-recarga (obs_archive_channel_is_removed) distingue canal que existe, apagar, guardar e sem_destino', async () => {
    await emTx(async c => {
      const consulta = async (ref: string) => (await pg.query(`select public.obs_archive_channel_is_removed($1, $2) as r`, [c.site, ref])).rows[0]!.r as { removido: boolean; decisao: string | null; sem_destino: boolean }
      expect(await consulta(c.canal)).toEqual({ removido: false, decisao: null, sem_destino: false })
      const ref = async (dec: string): Promise<string> => {
        const id = (await pg.query(`select gen_random_uuid()::text as id`)).rows[0]!.id as string
        await pg.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known) values ($1, $2, $3, $4, now(), true)`, [c.site, id, dec === 'guardar' ? 'e10_export' : 'botao', dec])
        return id
      }
      expect(await consulta(await ref('apagar'))).toEqual({ removido: true, decisao: 'apagar', sem_destino: false })
      expect(await consulta(await ref('guardar'))).toEqual({ removido: true, decisao: 'guardar', sem_destino: false })
      const solto = (await pg.query(`select gen_random_uuid()::text as id`)).rows[0]!.id as string
      expect(await consulta(solto)).toEqual({ removido: true, decisao: null, sem_destino: true })
    })
  })
  it('item 165, parte purged_at do plano (obs_archive_plan): fechada na T6 (filtro purged_at is null)', () => {
    expect(readFileSync(resolve(RAIZ_REPO, 'apps/web/test/integration/manutencao-m9b-canal.test.ts'), 'utf8')).toContain('purged_at: unidade de canal removido fora do aguardando_dono')
  })
  it.todo('item 165, parte purged_at no kit (arquivo de unidade/resumo com purged_at não é arquivo_ausente em conferir-b2, atestar-b2, ensaiar-restauracao e restauração; unidade expurgada/perdida listada, nunca zero): é do NÚCLEO, dívida nomeada no runbook, falta teste no kit')
})

describe('M9 cobertura: todo comando citado no runbook tem teste', () => {
  const RAIZ = RAIZ_REPO
  const secao = secaoDoRunbook()
  const testes = (d: string): string[] => readdirSync(d, { recursive: true, encoding: 'utf8' }).filter(f => /\.test\.tsx?$/.test(f)).map(f => resolve(d, f))
  const corpus = testes(resolve(RAIZ, 'apps/web/test')).map(f => readFileSync(f, 'utf8')).join('\n')
  const TABELAS = ['obs_archive_absence', 'obs_archive_channel_removals', 'obs_archive_item_targets', 'obs_archive_summaries', 'obs_archive_units']   // citadas só em SQL; o `it` que executa o SQL as prova
  const unicos = (re: RegExp): string[] => [...new Set([...secao.matchAll(re)].map(m => m[1] ?? m[0]))].sort()

  it('a seção existe e cita comandos', () => { expect(secao.length).toBeGreaterThan(500) })
  it('funções citadas: lista fechada (citação nova exige teste)', () => {
    expect(unicos(/\bpublic\.([a-z_0-9]+)\(/g)).toEqual(['obs_archive_expurgo_unblock', 'obs_archive_m9_ligar'])
    const nomes = unicos(/\b(obs_archive_[a-z0-9_]+)\b/g).filter(n => !TABELAS.includes(n))
    expect(nomes).toEqual(['obs_archive_expurgo_unblock', 'obs_archive_item_falta', 'obs_archive_m9_ligar', 'obs_archive_owner_pending', 'obs_archive_removal_advance'])
  })
  for (const f of ['obs_archive_expurgo_unblock', 'obs_archive_item_falta', 'obs_archive_m9_ligar', 'obs_archive_owner_pending', 'obs_archive_removal_advance']) {
    it(`função ${f} é chamada (com parêntese) em algum teste`, () => { expect(corpus).toMatch(new RegExp(`\\b${f}\\(`)) })
  }
  it('comandos npm e obs: citados: lista fechada, cada um com teste', () => {
    expect(unicos(/\bnpm run -s [a-z:-]+(?: -- [a-z-]+(?: <n>)?)?/g)).toEqual(['npm run -s obs:arquivo'])
    expect(unicos(/\bobs:[a-z-]+/g)).toEqual(['obs:arquivo', 'obs:expurgar'])
    expect(unicos(/--canal\b/g)).toEqual(['--canal'])   // só como "não existe" (M9b, Decisão 1)
    for (const c of ['obs:arquivo', 'obs:expurgar']) expect(corpus).toContain(c)
  })
  it('arquivos citados existem no repositório e têm teste', () => {
    expect(unicos(/\bsupabase\/rascunhos\/[\w.-]+/g)).toEqual(['supabase/rascunhos/m9-emergencia.sql'])
    for (const f of unicos(/\bsupabase\/rascunhos\/[\w.-]+/g)) expect(() => readFileSync(resolve(RAIZ, f), 'utf8'), f).not.toThrow()
    expect(corpus).toContain('m9-emergencia.sql')
    expect(secao).not.toMatch(/(^|[\s`])comandos\/[\w.-]+/)   // caminho solto fora do git (Phil I3)
  })
  it('o ciclo do canal está escrito (M9b: sem expurgar --canal, sobra de arquivo, lote da E10, reversão) e a frase falsa antiga não voltou', () => {
    expect(secao).toContain('**Ciclo do canal removido (M9b).**')
    expect(secao).toContain('### Sobrou arquivo no canal')
    expect(secao).toContain('### Lote da E10 depois do `concluido`')
    expect(secao).toContain('### Voltar atrás: devolver o canal a `guardado`')
    expect(secao).toContain('**Não existe `expurgar --canal`**')
    expect(secao).not.toContain('Canal removido fica SEGURO')
    expect(secao).not.toContain('NÃO imprime comando de apagar para item `canal:`')
    expect(secao).not.toContain('Não há comando do Mac para ele')
    expect(secao).not.toContain('dar o atestado')
  })
})
