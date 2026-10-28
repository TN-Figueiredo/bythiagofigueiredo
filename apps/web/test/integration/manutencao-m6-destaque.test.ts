// apps/web/test/integration/manutencao-m6-destaque.test.ts
// @vitest-environment node
/** M6 parte 4 (plano M6, Tarefa 4; itens 42, 89, 115): o destaque e a volta. begin … rollback (o destaque nunca é confirmado aqui; o item 128 é da Tarefa 6). */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { escalar, tenta, semearCanal, semearDiaria } from '../helpers/m3b'
import { prepararM6, relogio, liberarClasses, novoAdmin, selarMes, particaoDe } from '../helpers/m6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const MES = '2026-10-01'
const D = 'competitor_video_daily'
type Resp = { status: string; codigo?: string; faltam?: Array<{ codigo: string }>; linhas?: number; volta_fora_de_ordem?: boolean; conteudo_mudou?: boolean; protecao_faltam?: string[] }

describe.skipIf(skipIfNoLocalDb())('M6 parte 4: tirar das telas e trazer de volta', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c?.end() })
  async function emTransacao(f: () => Promise<void>): Promise<void> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')
    try { await prepararM6(c, 4); await c.query('delete from public.competitor_video_daily'); await c.query(`update public.obs_archive_months set dropped_at = now() where detached_at is not null and dropped_at is null`); await f() } finally { await c.query('rollback') }
  }
  async function cenario(): Promise<{ site: string; canal: string; videos: string[]; admin: string }> {
    await relogio(c, '2027-05-02 12:00:00+00')
    await liberarClasses(c, ['serie', 'ensaio'])
    const s = await semearCanal(c, { videos: 2 })
    await semearDiaria(c, s.videos, MES, 31)
    await selarMes(c, { site: s.site, classe: 'serie', tabela: D, mes: MES })
    await c.query(`insert into public.competitor_video_marks (video_id, age_days, site_id, views, gap_hours, age_base_at, read_before_at, read_after_at)
                   select v, 30, $2, 1, 1, now(), now(), now() from unnest($1::uuid[]) v on conflict do nothing`, [s.videos, s.site])
    return { ...s, admin: await novoAdmin(c, s.site) }
  }
  const detach = (site: string, por: string | null, o: { modo?: string; simular?: boolean; mes?: string } = {}): Promise<Resp> =>
    escalar<Resp>(c, `select public.obs_archive_detach_month($1, $2, $3, $4, $5, $6)`, [site, D, o.mes ?? MES, por, o.modo ?? 'clique', o.simular ?? false])
  const reattach = (site: string, por: string | null, o: { simular?: boolean; mes?: string } = {}): Promise<Resp> =>
    escalar<Resp>(c, `select public.obs_archive_reattach_month($1, $2, $3, $4, $5)`, [site, D, o.mes ?? MES, por, o.simular ?? false])
  const existe = (rel: string): Promise<boolean> => escalar<boolean>(c, `select to_regclass($1) is not null`, [rel])

  it('42: destaca o mês verde: a partição sai da mãe com sufixo _saida, sem FK, e as telas não leem mais o mês', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      const antes = await escalar<string>(c, `select count(*)::text from public.competitor_video_daily where snap_date >= $1 and snap_date < ($1::date + interval '1 month')`, [MES])
      const r = await detach(site, admin)
      expect(r).toMatchObject({ status: 'ok', linhas: Number(antes) })
      expect(await existe(particaoDe(D, MES))).toBe(false)
      expect(await existe(particaoDe(D, MES) + '_saida')).toBe(true)
      expect(await escalar<string>(c, `select count(*)::text from public.competitor_video_daily where snap_date >= $1 and snap_date < ($1::date + interval '1 month')`, [MES])).toBe('0')
      expect(await escalar<number>(c, `select count(*)::int from pg_constraint where conrelid = to_regclass($1) and contype = 'f'`, [particaoDe(D, MES) + '_saida'])).toBe(0)
      expect(await escalar<boolean>(c, `select detached_at is not null and detached_by = $2 from public.obs_archive_months where site_id = $1 and month = $3 and table_name = $4`, [site, admin, MES, D])).toBe(true)
    })
  })

  it('89: com o mês destacado, o vigia de cobertura da M2 segue vazio e o ensure não recria a partição do mês', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await detach(site, admin)
      expect(await escalar<unknown[]>(c, `select coalesce(to_jsonb(public.obs_archive_uncovered()), '[]'::jsonb)`)).toEqual([])
      await c.query(`select public.obs_partitions_ensure(12)`)
      expect(await existe(particaoDe(D, MES))).toBe(false)
    })
  })

  it('simulação: devolve a contagem, não trava, não muda nada', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      const L = `select count(*)::int from pg_locks where relation = to_regclass($1) and mode = 'AccessExclusiveLock'`
      const antes = await escalar<number>(c, L, [particaoDe(D, MES)])   // a transação já segura a sua própria trava da criação da partição
      const r = await detach(site, admin, { simular: true })
      expect(r.status).toBe('simulado')
      expect(r.linhas).toBeGreaterThan(0)
      expect(await existe(particaoDe(D, MES))).toBe(true)
      expect(await escalar<number>(c, L, [particaoDe(D, MES)])).toBe(antes)
    })
  })

  it('recusas da porta: tabela de faixa, partição ausente, mês já destacado, gatilho desligado; nenhuma destaca', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      expect(await escalar<Resp>(c, `select public.obs_archive_detach_month($1, 'competitor_video_comments', $2, $3)`, [site, MES, admin])).toMatchObject({ status: 'recusado', codigo: 'tabela_invalida' })
      expect(await detach(site, admin, { mes: '2019-01-01' })).toMatchObject({ status: 'recusado', codigo: 'particao_ausente' })
      await c.query(`alter table public.competitor_videos disable trigger obs_archive_a_mes_destacado`)
      expect(await detach(site, admin)).toMatchObject({ status: 'recusado', codigo: 'gatilho_ausente' })
      await c.query(`alter table public.competitor_videos enable trigger obs_archive_a_mes_destacado`)
      expect((await detach(site, admin)).status).toBe('ok')
      expect(await detach(site, admin)).toMatchObject({ status: 'recusado', codigo: 'ja_destacado' })
    })
  })

  it('o portão recusa com a lista e nada sai; conteúdo mudado fora da simulação dessela', async () => {
    await emTransacao(async () => {
      const { site, admin, videos } = await cenario()
      await c.query(`update public.competitor_video_daily set views = views + 3 where video_id = $1 and snap_date = '2026-10-07'`, [videos[0]])
      const r = await detach(site, admin)
      expect(r.status).toBe('recusado')
      expect(r.faltam?.map(f => f.codigo)).toContain('conteudo_mudou')
      expect(await existe(particaoDe(D, MES))).toBe(true)
      expect(await escalar<string>(c, `select unsealed_reason from public.obs_archive_months where site_id = $1 and month = $2`, [site, MES])).toBe('conteudo_mudou')
    })
  })

  it('115(a): volta igual: a partição volta à mãe com o nome original, FK validadas, detached_at nulo, reattached_at gravado', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      const soma = await escalar<string>(c, `select sum(views)::text from ${particaoDe(D, MES)}`)
      await detach(site, admin)
      const r = await reattach(site, admin)
      expect(r).toMatchObject({ status: 'ok', conteudo_mudou: false, volta_fora_de_ordem: false, protecao_faltam: [] })
      expect(await existe(particaoDe(D, MES))).toBe(true)
      expect(await escalar<string>(c, `select sum(views)::text from public.competitor_video_daily where snap_date >= $1 and snap_date < ($1::date + interval '1 month')`, [MES])).toBe(soma)
      expect(await escalar<boolean>(c, `select bool_and(convalidated) from pg_constraint where conrelid = to_regclass($1) and contype = 'f'`, [particaoDe(D, MES)])).toBe(true)
      expect(await escalar<boolean>(c, `select detached_at is null and reattached_at is not null and unsealed_at is null from public.obs_archive_months where site_id = $1 and month = $2`, [site, MES])).toBe(true)
    })
  })

  it('115(b): voltou diferente: o mês volta e fica desselado com mudou_no_destaque', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await detach(site, admin)
      await c.query(`update ${particaoDe(D, MES)}_saida set views = views + 1 where snap_date = '2026-10-03'`)
      const r = await reattach(site, admin)
      expect(r).toMatchObject({ status: 'ok', conteudo_mudou: true })
      expect(await escalar<string>(c, `select unsealed_reason from public.obs_archive_months where site_id = $1 and month = $2`, [site, MES])).toBe('mudou_no_destaque')
    })
  })

  it('115(c): registro órfão na tabela destacada: recusa orfa_inesperada e nada é desfeito pela metade', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await detach(site, admin)
      await c.query(`insert into ${particaoDe(D, MES)}_saida (video_id, snap_date, views, taken_at) values (gen_random_uuid(), '2026-10-09', 1, now())`)
      expect(await reattach(site, admin)).toMatchObject({ status: 'recusado', codigo: 'orfa_inesperada' })
      expect(await existe(particaoDe(D, MES) + '_saida')).toBe(true)
      expect(await existe(particaoDe(D, MES))).toBe(false)
      expect(await escalar<boolean>(c, `select detached_at is not null from public.obs_archive_months where site_id = $1 and month = $2`, [site, MES])).toBe(true)
    })
  })

  it('115(d): sem direito e mês não destacado recusam; descartado recusa com ja_descartado; _saida sumida recusa com particao_ausente', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      expect(await reattach(site, admin)).toMatchObject({ status: 'recusado', codigo: 'nao_destacado' })
      await detach(site, admin)
      expect(await reattach(site, '00000000-0000-0000-0000-00000000dead')).toMatchObject({ status: 'recusado', codigo: 'sem_direito' })
      await c.query(`alter table ${particaoDe(D, MES)}_saida rename to m6_sumiu`)
      expect(await reattach(site, admin)).toMatchObject({ status: 'recusado', codigo: 'particao_ausente' })
      await c.query(`alter table obs_part.m6_sumiu rename to ${particaoDe(D, MES).slice('obs_part.'.length)}_saida`)
      await c.query(`update public.obs_archive_months set dropped_at = now() where site_id = $1 and month = $2`, [site, MES])
      expect(await reattach(site, admin)).toMatchObject({ status: 'recusado', codigo: 'ja_descartado' })
    })
  })

  it('115(e) e R27: voltar outubro com novembro fora volta assim mesmo, marcado volta_fora_de_ordem', async () => {
    await emTransacao(async () => {
      const { site, admin, videos } = await cenario()
      await relogio(c, '2027-06-02 12:00:00+00')
      await semearDiaria(c, videos, '2026-11-01', 30)
      await selarMes(c, { site, classe: 'serie', tabela: D, mes: '2026-11-01' })
      await selarMes(c, { site, classe: 'serie', tabela: D, mes: MES, versao: 2 })
      expect((await detach(site, admin)).status).toBe('ok')
      expect((await detach(site, admin, { mes: '2026-11-01' })).status).toBe('ok')
      const r = await reattach(site, admin)
      expect(r).toMatchObject({ status: 'ok', volta_fora_de_ordem: true })
      expect(await escalar<boolean>(c, `select reattach_out_of_order from public.obs_archive_months where site_id = $1 and month = $2`, [site, MES])).toBe(true)
    })
  })

  it('115(f): voltou sem a proteção instalada: volta, e o retorno traz o que falta', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await detach(site, admin)
      await c.query(`drop trigger obs_archive_a_mes_destacado_truncate on public.competitor_videos`)
      const r = await reattach(site, admin)
      expect(r).toMatchObject({ status: 'ok', protecao_faltam: ['competitor_videos.obs_archive_a_mes_destacado_truncate'] })
    })
  })

  it('91: partição com linha de outro site verde: destaca para os dois sites', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      const outro = await semearCanal(c, { site: '00000000-0000-0000-0000-00000000a3b1', videos: 1 })
      await semearDiaria(c, outro.videos, MES, 3)
      await selarMes(c, { site: outro.site, classe: 'serie', tabela: D, mes: MES })
      const r = await detach(site, admin)
      expect(r.status).toBe('ok')
      expect(await escalar<number>(c, `select count(*)::int from public.obs_archive_months where month = $1 and table_name = $2 and detached_at is not null and dropped_at is null`, [MES, D])).toBe(2)
    })
  })

  it('I-1: sem o 6º argumento a função SIMULA (default true): a partição continua na mãe', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      const r = await escalar<Resp>(c, `select public.obs_archive_detach_month($1, $2, $3, $4)`, [site, D, MES, admin])
      expect(r.status).toBe('simulado')
      expect(await existe(particaoDe(D, MES))).toBe(true)
      const v = await escalar<Resp>(c, `select public.obs_archive_reattach_month($1, $2, $3, $4)`, [site, D, MES, admin])
      expect(v).toMatchObject({ status: 'recusado', codigo: 'nao_destacado' })
    })
  })

  it('m-4: a simulação devolve fracao_da_classe pelo rows_total do registro (sem contar a mãe inteira)', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      const r = await escalar<Resp & { fracao_da_classe: number }>(c, `select public.obs_archive_detach_month($1, $2, $3, $4, 'clique', true)`, [site, D, MES, admin])
      expect(Number(r.fracao_da_classe)).toBeGreaterThan(0)
      expect(Number(r.fracao_da_classe)).toBeLessThanOrEqual(1)
      const src = await escalar<string>(c, `select prosrc from pg_proc where oid = 'public.obs_archive_detach_month(uuid, text, date, uuid, text, boolean)'::regprocedure`)
      expect(src).not.toMatch(/select count\(\*\) from %s/)
    })
  })

  it('129(a): canal removido pelo botão entre a selagem e o destaque: passa sem conteudo_mudou e o mês não volta a não selado', async () => {
    await emTransacao(async () => {
      const { site, admin, canal } = await cenario()
      const outro = await semearCanal(c, { site, videos: 1 })
      await semearDiaria(c, outro.videos, MES, 5)
      await selarMes(c, { site, classe: 'serie', tabela: D, mes: MES, versao: 2 })
      expect(await tenta(c, `select public.competitor_channel_remove($1, $2, 'apagar', 'botao', $3)`, [site, canal, admin])).toMatchObject({ ok: true })
      const r = await detach(site, admin)
      expect(r.status).toBe('ok')
      expect(r.conteudo_mudou).not.toBe(true)
      expect(await escalar<boolean>(c, `select unsealed_at is null from public.obs_archive_months where site_id = $1 and month = $2 and table_name = $3`, [site, MES, D])).toBe(true)
    })
  })

  it('129(b): item de fila cujas unidades já têm todas purged_at não segura o destaque', async () => {
    await emTransacao(async () => {
      const { site, admin, canal } = await cenario()
      const outro = await semearCanal(c, { site, videos: 1 })
      await semearDiaria(c, outro.videos, MES, 5)
      await selarMes(c, { site, classe: 'serie', tabela: D, mes: MES, versao: 2 })
      expect(await tenta(c, `select public.competitor_channel_remove($1, $2, 'apagar', 'botao', $3)`, [site, canal, admin])).toMatchObject({ ok: true })
      await c.query(`insert into public.competitor_removed_items (site_id, kind, youtube_id, competitor_channel_id, decided_by, rows_deleted, archive_pending)
                     values ($1, 'video', 'm6purged', $2, $3, '{}'::jsonb, true)`, [site, canal, admin])
      expect((await detach(site, admin)).status).toBe('ok')
    })
  })

  it('129(c): vídeo avulso apagado de canal que continua: conteudo_mudou e o mês dessela', async () => {
    await emTransacao(async () => {
      const { site, admin, videos } = await cenario()
      await c.query(`delete from public.competitor_videos where id = $1`, [videos[0]])
      const r = await detach(site, admin)
      expect(r.status).toBe('recusado')
      expect(r.faltam?.map(f => f.codigo)).toContain('conteudo_mudou')
    })
  })

  it('I3: a mãe ganhou uma coluna enquanto o mês estava fora: a volta acrescenta a coluna à _saida, volta ok e marca conteudo_mudou', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await detach(site, admin)
      await c.query(`alter table public.competitor_video_daily add column m6_extra integer`)
      const r = await reattach(site, admin)
      expect(r).toMatchObject({ status: 'ok', conteudo_mudou: true })
      expect(await existe(particaoDe(D, MES))).toBe(true)
      expect(await escalar<string>(c, `select unsealed_reason from public.obs_archive_months where site_id = $1 and month = $2`, [site, MES])).toBe('mudou_no_destaque')
    })
  })

  it('I3: esquema que o plano não sabe consertar (coluna a mais só na _saida) recusa esquema_divergente e nada muda', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await detach(site, admin)
      await c.query(`alter table ${particaoDe(D, MES)}_saida add column m6_so_aqui integer`)
      expect(await reattach(site, admin)).toMatchObject({ status: 'recusado', codigo: 'esquema_divergente' })
      expect(await existe(particaoDe(D, MES) + '_saida')).toBe(true)
    })
  })

  it('I-7: linha de outro mês na tabela destacada: o CHECK validado ANTES de travar a mãe recusa fora_do_mes', async () => {
    await emTransacao(async () => {
      const { site, admin, videos } = await cenario()
      await detach(site, admin)
      await c.query(`insert into ${particaoDe(D, MES)}_saida (video_id, snap_date, views, taken_at) values ($1, '2026-11-02', 1, now())`, [videos[0]])
      expect(await reattach(site, admin)).toMatchObject({ status: 'recusado', codigo: 'fora_do_mes' })
      expect(await existe(particaoDe(D, MES))).toBe(false)
    })
  })

  it('o dado não existe: mês sem registro recusa com nao_selado e nunca destaca', async () => {
    await emTransacao(async () => {
      await relogio(c, '2027-05-02 12:00:00+00')
      await liberarClasses(c, ['serie'])
      const { site, videos } = await semearCanal(c, { videos: 1 })
      await semearDiaria(c, videos, MES, 3)
      const admin = await novoAdmin(c, site)
      const r = await detach(site, admin)
      expect(r.status).toBe('recusado')
      expect(r.faltam?.map(f => f.codigo)).toContain('nao_selado')
      expect(await existe(particaoDe(D, MES))).toBe(true)
    })
  })

  it('a função não aceita chamada de anon nem de authenticated', async () => {
    await emTransacao(async () => {
      // chamar sem EXECUTE derruba o Postgres do int (SIGSEGV medido na T2): confere o privilégio pelo catálogo
      for (const f of ['obs_archive_detach_month(uuid, text, date, uuid, text, boolean)', 'obs_archive_reattach_month(uuid, text, date, uuid, boolean)']) {
        for (const papel of ['anon', 'authenticated', 'public']) {
          expect(await escalar<boolean>(c, `select has_function_privilege($1, 'public.${f}', 'execute')`, [papel === 'public' ? 'public' : papel]), `${papel} ${f}`).toBe(false)
        }
        expect(await escalar<boolean>(c, `select has_function_privilege('service_role', 'public.${f}', 'execute')`), f).toBe(true)
      }
    })
  })
})
