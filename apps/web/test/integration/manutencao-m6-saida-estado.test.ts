// apps/web/test/integration/manutencao-m6-saida-estado.test.ts
// @vitest-environment node
/** M6 parte 6 [M6a] (plano M6, Tarefa 7a; itens 89, 92, 119): contadores, meses em trânsito e os vermelhos da saída. begin … rollback. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { escalar, tenta, semearCanal, semearDiaria, M3B_SQL_CAMINHO } from '../helpers/m3b'
import { prepararM6, relogio, liberarClasses, novoAdmin, selarMes, particaoDe, M6_SQL_CAMINHO } from '../helpers/m6'
import { resolve } from 'node:path'
const M6_PRE_MIGRATION_CAMINHO = resolve(__dirname, '../../../../supabase/rascunhos/m6-pre-migration.sql')

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const D = 'competitor_video_daily'
const MES = '2026-10-01'

describe.skipIf(skipIfNoLocalDb())('M6 parte 6 [M6a]: contadores, trânsito e vermelhos da saída', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c?.end() })
  async function emTransacao(f: () => Promise<void>): Promise<void> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')
    try { await prepararM6(c, 6); await c.query('delete from public.competitor_video_daily'); await c.query(`update public.obs_archive_months set dropped_at = now() where detached_at is not null and dropped_at is null`); await f() } finally { await c.query('rollback') }
  }
  /** Mês de outubro selado e DESTACADO de verdade (a tabela _saida existe), em 02/05/2027. */
  async function destacado(): Promise<{ site: string; admin: string }> {
    await relogio(c, '2027-05-02 12:00:00+00')
    await liberarClasses(c, ['serie'])
    const s = await semearCanal(c, { videos: 2 })
    await semearDiaria(c, s.videos, MES, 31)
    await selarMes(c, { site: s.site, classe: 'serie', tabela: D, mes: MES })
    await c.query(`insert into public.competitor_video_marks (video_id, age_days, site_id, views, gap_hours, age_base_at, read_before_at, read_after_at)
                   select v, 30, $2, 1, 1, now(), now(), now() from unnest($1::uuid[]) v on conflict do nothing`, [s.videos, s.site])
    const admin = await novoAdmin(c, s.site)
    const r = await escalar<{ status: string }>(c, `select public.obs_archive_detach_month($1, $2, $3, $4, 'clique', false)`, [s.site, D, MES, admin])
    expect(r.status).toBe('ok')
    return { site: s.site, admin }
  }
  const vermelhos = (site: string): Promise<string[]> => escalar<string[]>(c, `select public.obs_archive_vermelhos_saida($1)`, [site])

  /** r2 I-1 (Phil, Yannis): defeito não é corrida. Tabela que o portão lê renomeada por uma migration: o erro SOBE, não vira "mudou durante a leitura". */
  async function selado(): Promise<{ site: string; admin: string; canal: string }> {
    await relogio(c, '2027-05-02 12:00:00+00')
    await liberarClasses(c, ['serie'])
    const s = await semearCanal(c, { videos: 2 })
    await semearDiaria(c, s.videos, MES, 31)
    await selarMes(c, { site: s.site, classe: 'serie', tabela: D, mes: MES })
    await c.query(`insert into public.competitor_video_marks (video_id, age_days, site_id, views, gap_hours, age_base_at, read_before_at, read_after_at)
                   select v, 30, $2, 1, 1, now(), now(), now() from unnest($1::uuid[]) v on conflict do nothing`, [s.videos, s.site])
    return { site: s.site, admin: await novoAdmin(c, s.site), canal: s.canal }
  }
  const sobe = async (sql: string, args: unknown[]): Promise<string> => {
    await c.query('savepoint sp')
    try { await c.query(sql, args); return 'nao_subiu' } catch (e) { return (e as { code?: string }).code ?? String(e) } finally { await c.query('rollback to savepoint sp') }
  }
  it('r2 I-1: tabela do portão renomeada (defeito, relação viva): a simulação do detach e o precheck_unit levantam 42P01', async () => {
    await emTransacao(async () => {
      const { site, admin, canal } = await selado()
      expect(await escalar<{ status: string }>(c, `select public.obs_archive_detach_month($1, $2, $3, $4, 'clique', true)`, [site, D, MES, admin])).toMatchObject({ status: 'simulado' })
      await c.query('alter table public.obs_archive_prechecks rename to obs_archive_prechecks_x')
      expect(await sobe(`select public.obs_archive_detach_month($1, $2, $3, $4, 'clique', true)`, [site, D, MES, admin])).toBe('42P01')
      expect(await sobe(`select public.obs_archive_precheck_unit($1, $2, $3, $4)`, [site, D, MES, canal])).toBe('42P01')
    })
  })

  it('r2 T11 (Yannis R2-1): defeito sobe também no reattach (simulação), no discard e no drop: 42P01, nunca "mudou durante a leitura"', async () => {
    await emTransacao(async () => {
      const { site, admin } = await destacado()
      await relogio(c, '2027-05-20 12:00:00+00')
      // reattach: a simulação relê as unidades correntes e a mãe; o canal é lido pelo hash por canal (competitor_channels renomeada = defeito, relação viva); discard: o portão lê obs_archive_summaries (condição 5); drop: obs_archive_prechecks (condição 13)
      expect(await escalar<{ status: string }>(c, `select public.obs_archive_reattach_month($1, $2, $3, $4, true)`, [site, D, MES, admin])).toMatchObject({ status: 'simulado' })
      await c.query('alter table public.obs_archive_summaries rename to obs_archive_summaries_x')
      expect(await sobe(`select public.obs_archive_discard_month($1, $2, $3, $4, 'clique', true)`, [site, D, MES, admin])).toBe('42P01')
    })
    await emTransacao(async () => {
      const { site, admin } = await destacado()
      await c.query('alter table public.competitor_channels rename to competitor_channels_x')
      expect(await sobe(`select public.obs_archive_reattach_month($1, $2, $3, $4, true)`, [site, D, MES, admin])).toBe('42P01')
    })
    await emTransacao(async () => {
      const { site, admin } = await selado()
      // o drop só passa dos 3 descartes anteriores da tabela (senão responde dois_passos_obrigatorios antes de ler qualquer coisa)
      await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at, rows_dropped)
                     select $1, 'serie', $2, m::date, now(), 1 from unnest(array['2026-05-01', '2026-06-01', '2026-07-01']) m`, [site, D])
      await c.query('alter table public.obs_archive_prechecks rename to obs_archive_prechecks_x')   // condição 13 do drop
      expect(await sobe(`select public.obs_archive_drop_month($1, $2, $3, $4, 'clique', true)`, [site, D, MES, admin])).toBe('42P01')
    })
  })

  it('r2 M-1 (Yannis): a _saida some entre a leitura do nome e o fingerprint (outra aba descartou): ja_descartado, nunca esquema_mudou', async () => {
    await emTransacao(async () => {
      const { site, admin } = await destacado()
      await relogio(c, '2027-05-20 12:00:00+00')
      // trecho entre part_rel e schema_fp do discard: o stub faz o que a outra aba faria (apaga a _saida e registra), de forma determinística
      await c.query(`create or replace function public.obs_archive_invariante_faltam() returns text[] language plpgsql volatile security definer set search_path = '' as $$
        begin
          execute 'drop table ${particaoDe(D, MES)}_saida';
          update public.obs_archive_months set dropped_at = now(), rows_dropped = 1 where site_id = '${site}' and table_name = '${D}' and month = '${MES}';
          return '{}'::text[];
        end $$`)
      const r = await escalar<{ status: string; codigo: string }>(c, `select public.obs_archive_discard_month($1, $2, $3, $4, 'clique', true)`, [site, D, MES, admin])
      expect(r, JSON.stringify(r)).toMatchObject({ status: 'recusado', codigo: 'ja_descartado' })
    })
  })

  it('em trânsito: mês destacado aparece com a data de liberar, mais antigo primeiro', async () => {
    await emTransacao(async () => {
      const { site } = await destacado()
      expect(await escalar<unknown>(c, `select public.obs_archive_em_transito($1)`, [site])).toEqual([{ tabela: D, mes: MES, destacado_em: expect.any(String), liberar_a_partir: '2027-05-09' }])
    })
  })

  it('sem nada fora do lugar, os vermelhos da saída são vazios; gatilho desligado com mês em trânsito é vermelho', async () => {
    await emTransacao(async () => {
      const { site } = await destacado()
      expect(await vermelhos(site)).toEqual([])
      await c.query(`alter table public.competitor_channels disable trigger obs_archive_a_mes_destacado`)
      expect(await vermelhos(site)).toEqual(['saida_protecao_ausente:competitor_channels.obs_archive_a_mes_destacado'])
    })
  })

  it('partição destacada que sumiu: saida_particao_ausente; esquema da mãe mudou: saida_esquema_divergente', async () => {
    await emTransacao(async () => {
      const { site } = await destacado()
      await c.query(`alter table public.competitor_video_daily add column m6_extra integer`)
      expect(await vermelhos(site)).toEqual([`saida_esquema_divergente:${D}:2026-10`])
      await c.query(`alter table ${particaoDe(D, MES)}_saida rename to m6_sumiu`)
      expect(await vermelhos(site)).toEqual([`saida_particao_ausente:${D}:2026-10`])
    })
  })

  it('Phil I5: mês em trânsito há mais de 14 dias depois da data de liberar é vermelho (23/05 não, 24/05 sim)', async () => {
    await emTransacao(async () => {
      const { site } = await destacado()                          // destacado em 02/05; liberar em 09/05
      await relogio(c, '2027-05-23 12:00:00+00')
      expect(await vermelhos(site)).toEqual([])
      await relogio(c, '2027-05-24 12:00:00+00')
      expect(await vermelhos(site)).toEqual([`saida_transito_longo:${D}:2026-10`])
    })
  })

  it('obs_archive_vermelhos da M6 é a última definição da M3b mais os blocos da saída (nada da M3b se perde), e inclui os da saída', async () => {
    await emTransacao(async () => {
      const { site } = await destacado()
      await c.query(`alter table public.competitor_channels disable trigger obs_archive_a_mes_destacado`)
      expect(await escalar<string[]>(c, `select public.obs_archive_vermelhos($1)`, [site])).toContain('saida_protecao_ausente:competitor_channels.obs_archive_a_mes_destacado')
      const def = await escalar<string>(c, `select prosrc from pg_proc where oid = 'public.obs_archive_vermelhos(uuid)'::regprocedure`)
      expect(def).toContain('public.obs_archive_vermelhos_remocao')
      expect(def).toContain('public.obs_archive_vermelhos_saida')
      expect(def).toContain('public.obs_archive_descartados_sem_releitura(p_site, 45)')
    })
  })

  it('o corpo da M3b vem inteiro: removendo os blocos da M6, sobra exatamente a última definição do m3b.sql', () => {
    const corpo = (sql: string): string => {
      const i = sql.lastIndexOf('create or replace function public.obs_archive_vermelhos(p_site uuid)')
      return sql.slice(i, sql.indexOf('end $$;', i))
    }
    const m6 = corpo(readFileSync(M6_SQL_CAMINHO, 'utf8')).replace(/\n  -- M6[^\n]*\n  if [^\n]*\n    execute [^\n]*\n  end if;/g, '')
    expect(m6).toBe(corpo(readFileSync(M3B_SQL_CAMINHO, 'utf8')))
  })

  it('sim_seen conta no máximo 2, só para administrador, e não toca em armed_at; switch_counts lê descartes de clique com linha e as simulações', async () => {
    await emTransacao(async () => {
      await relogio(c, '2027-05-02 12:00:00+00')
      const { site } = await semearCanal(c, { videos: 1 })
      const admin = await novoAdmin(c, site)
      for (let i = 0; i < 3; i++) expect(await escalar<{ simulacoes: number }>(c, `select public.obs_archive_switch_sim_seen($1, 'serie', $2)`, [site, admin])).toEqual({ simulacoes: Math.min(i + 1, 2) })
      expect(await escalar<unknown>(c, `select public.obs_archive_switch_sim_seen($1, 'serie', $2)`, [site, '00000000-0000-0000-0000-00000000dead'])).toMatchObject({ status: 'recusado', codigo: 'sem_direito' })
      expect(await escalar<boolean>(c, `select armed_at is null from public.obs_archive_switch where site_id = $1 and class = 'serie'`, [site])).toBe(true)
      await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at, drop_mode, rows_dropped) values
                       ($1, 'serie', $2, '2026-01-01', now(), 'clique', 10), ($1, 'serie', $2, '2026-02-01', now(), 'automatico', 10), ($1, 'serie', $2, '2026-03-01', now(), 'clique', 0)`, [site, D])
      expect(await escalar<unknown>(c, `select public.obs_archive_switch_counts($1, 'serie')`, [site])).toEqual({ descartes: 1, simulacoes: 2 })
      expect(await escalar<unknown>(c, `select public.obs_archive_switch_sim_seen($1, 'texto', $2)`, [site, admin])).toEqual({ simulacoes: 0 })
    })
  })

  it('switch_counts, sim_seen, em_transito e vermelhos_saida: só o service_role executa (has_function_privilege: chamar como anon derruba o int com SIGSEGV)', async () => {
    for (const f of ['obs_archive_switch_counts(uuid, text)', 'obs_archive_switch_sim_seen(uuid, text, uuid)', 'obs_archive_em_transito(uuid)', 'obs_archive_vermelhos_saida(uuid)']) {
      const por = async (papel: string): Promise<boolean> => (await c.query(`select has_function_privilege($1, to_regprocedure($2), 'execute') as ok`, [papel, `public.${f}`])).rows[0].ok
      await emTransacao(async () => {
        expect(await por('service_role'), f).toBe(true)
        for (const papel of ['anon', 'authenticated']) expect(await por(papel), `${f} ${papel}`).toBe(false)
      })
    }
  })

  it('r1 (b): mês destacado sem a tabela _saida de OUTRO site é vermelho mes_destacado_sem_tabela com site, tabela e mês; o do próprio site segue saida_particao_ausente', async () => {
    await emTransacao(async () => {
      const { site } = await destacado()
      await c.query(`alter table ${particaoDe(D, MES)}_saida rename to m6_sumiu`)
      const outro = await semearCanal(c, { site: '00000000-0000-0000-0000-00000000a3b1', videos: 1 })
      expect(await vermelhos(outro.site)).toEqual([`mes_destacado_sem_tabela:${site}:${D}:2026-10`])
      expect(await vermelhos(site)).toEqual([`saida_particao_ausente:${D}:2026-10`])
    })
  })

  it('r1 (b): a consulta (1) do m6-pre-migration.sql e o vermelho enxergam o mesmo mês', async () => {
    await emTransacao(async () => {
      const { site } = await destacado()
      const consulta = readFileSync(M6_PRE_MIGRATION_CAMINHO, 'utf8').split('\n').filter(l => !l.trim().startsWith('--')).join('\n').split(';')[0]
      expect((await c.query(consulta)).rows.filter(r => r.site_id === site)).toHaveLength(0)
      await c.query(`alter table ${particaoDe(D, MES)}_saida rename to m6_sumiu`)
      expect((await c.query(consulta)).rows.filter(r => r.site_id === site)).toHaveLength(1)
    })
  })

  it('vermelhos da saída: nenhum mês em trânsito não custa nada e o desarme da M6b ainda não existe', async () => {
    await emTransacao(async () => {
      const { site } = await semearCanal(c, { videos: 1 })
      expect(await vermelhos(site)).toEqual([])
      expect(await escalar<boolean>(c, `select to_regprocedure('public.obs_archive_vermelhos_automatico(uuid)') is null`)).toBe(true)
    })
  })
})
