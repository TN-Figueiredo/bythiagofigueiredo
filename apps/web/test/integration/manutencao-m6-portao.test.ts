// apps/web/test/integration/manutencao-m6-portao.test.ts
// @vitest-environment node
/** M6 parte 3 (plano M6, Tarefa 3; itens 40, 90, 91, 122, 129 e R27): uma recusa por condição, medida no instante. begin … rollback. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { escalar, q1, semearCanal, semearDiaria, SITE_TESTE } from '../helpers/m3b'
import { prepararM6, relogio, liberarClasses, novoAdmin, selarMes, particaoDe } from '../helpers/m6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const MES = '2026-10-01'
const D = 'competitor_video_daily'
type Falta = { codigo: string } & Record<string, unknown>

describe.skipIf(skipIfNoLocalDb())('M6 parte 3: o portão', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c?.end() })

  /** Um mês verde de verdade: canal com 3 vídeos, outubro inteiro na diária, selado, NAS de 1 h, B2 da forja de 1 dia, ensaio de 10 dias. */
  async function cenario(): Promise<{ site: string; canal: string; videos: string[]; admin: string }> {
    await relogio(c, '2027-05-02 12:00:00+00')
    await liberarClasses(c, ['serie', 'horaria', 'ensaio'])
    const s = await semearCanal(c, { videos: 3 })
    await semearDiaria(c, s.videos, MES, 31)
    await selarMes(c, { site: s.site, classe: 'serie', tabela: D, mes: MES })
    await c.query(`insert into public.competitor_video_marks (video_id, age_days, site_id, views, gap_hours, age_base_at, read_before_at, read_after_at)
                   select v, 30, $2, 1, 1, now(), now(), now() from unnest($1::uuid[]) v on conflict do nothing`, [s.videos, s.site])
    return { ...s, admin: await novoAdmin(c, s.site) }
  }
  async function portao(site: string, por: string | null, conds: number[], o: { modo?: string; simular?: boolean; mes?: string; tabela?: string } = {}): Promise<Falta[]> {
    const tabela = o.tabela ?? D, mes = o.mes ?? MES
    return escalar<Falta[]>(c, `select public.obs_archive_gate($1, public.obs_archive_exit_class($2), $2, $3, $4, $5, public.obs_archive_part_rel($2, $3, false), $6::int[], $7)`,
      [site, tabela, mes, por, o.modo ?? 'clique', conds, o.simular ?? true])
  }
  const codigos = (f: Falta[]): string[] => f.map(x => x.codigo)
  async function emTransacao(f: () => Promise<void>): Promise<void> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')
    try { await prepararM6(c, 3); await c.query('delete from public.competitor_video_daily'); await f() } finally { await c.query('rollback') }
  }
  const TODAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 20]

  it('o mês verde passa por todas as condições', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      expect(await portao(site, admin, TODAS)).toEqual([])
    })
  })

  it('1: classe não liberada', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await c.query(`select 1`)  // a política volta ao original só com nova recriação:
      const def = await escalar<string>(c, `select pg_get_functiondef('public.obs_archive_policy()'::regprocedure)`)
      await c.query(def.replace(`('serie', 'competitor_video_daily', 'particao', 6, 28, 7, 'depois_de_3', true,`, `('serie', 'competitor_video_daily', 'particao', 6, 28, 7, 'depois_de_3', false,`))
      expect(codigos(await portao(site, admin, [1]))).toEqual(['classe_nao_liberada'])
    })
  })

  it('2: dentro da janela em dia de São Paulo: 30/04 recusa com pode_sair_em 2027-05-01; 01/05 passa', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await relogio(c, '2027-05-01 02:59:00+00')                 // 23:59 de 30/04 em SP
      expect(await portao(site, admin, [2])).toEqual([{ codigo: 'ainda_na_janela', pode_sair_em: '2027-05-01' }])
      await relogio(c, '2027-05-01 03:00:00+00')                 // 00:00 de 01/05 em SP
      expect(await portao(site, admin, [2])).toEqual([])
    })
  })

  it('2 e D15: a data do portão é a da função única obs_archive_pode_sair_em (a M7 usa a mesma)', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await relogio(c, '2027-04-20 12:00:00+00')
      const [f] = await portao(site, admin, [2])
      expect(f).toEqual({ codigo: 'ainda_na_janela', pode_sair_em: '2027-05-01' })
      expect(await escalar<string>(c, `select public.obs_archive_pode_sair_em($1::date, 6)::text`, [MES])).toBe('2027-05-01')
    })
  })

  it('3: não selado; e canal com linha e sem unidade', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await c.query(`update public.obs_archive_months set unsealed_at = now(), unsealed_reason = 'unidade_nova' where site_id = $1`, [site])
      expect(codigos(await portao(site, admin, [3]))).toEqual(['nao_selado'])
      await c.query(`update public.obs_archive_months set unsealed_at = null, unsealed_reason = null where site_id = $1`, [site])
      const outro = await semearCanal(c, { videos: 1 })
      await semearDiaria(c, outro.videos, MES, 2)
      const f = await portao(site, admin, [3])
      expect(f).toEqual([{ codigo: 'canal_sem_unidade', canais: [outro.canal] }])
    })
  })

  it('4: linha inserida depois da selagem recusa e, fora da simulação, o mês volta a não selado', async () => {
    await emTransacao(async () => {
      const { site, admin, videos } = await cenario()
      await c.query(`update public.competitor_video_daily set views = views + 1 where video_id = $1 and snap_date = '2026-10-05'`, [videos[0]])
      expect(codigos(await portao(site, admin, [4], { simular: true }))).toEqual(['conteudo_mudou'])
      expect(await escalar<string | null>(c, `select unsealed_reason from public.obs_archive_months where site_id = $1`, [site])).toBeNull()
      expect(codigos(await portao(site, admin, [4], { simular: false }))).toEqual(['conteudo_mudou'])
      expect(await escalar<string | null>(c, `select unsealed_reason from public.obs_archive_months where site_id = $1`, [site])).toBe('conteudo_mudou')
    })
  })

  it('4 (CP13, C-1): a conferência fresca dispensa o recálculo no portão, mas NÃO a comparação do resumo da linha inteira sob a trava; de 11 minutos, o portão recalcula', async () => {
    await emTransacao(async () => {
      const { site, admin, canal, videos } = await cenario()
      const r = await escalar<{ ok: boolean }>(c, `select public.obs_archive_precheck_unit($1, $2, $3, $4)`, [site, D, MES, canal])
      expect(r).toEqual({ ok: true })
      expect(await escalar<string | null>(c, `select row_digest::text from public.obs_archive_prechecks where site_id = $1 and channel_ref = $2::text`, [site, canal])).not.toBeNull()
      // muda uma coluna que NÃO é a de controle DEPOIS da conferência: com ela fresca o portão não recalcula e passa...
      await c.query(`update public.competitor_video_daily set likes = coalesce(likes, 0) + 7 where video_id = $1 and snap_date = '2026-10-05'`, [videos[0]])
      expect(await portao(site, admin, [4], { simular: false })).toEqual([])
      // ...mas o tally COM resumo, que é o que roda sob a trava, pega; sem resumo (simulação) só vê contagem e soma.
      const rel = `public.obs_archive_part_rel($2, $3, false)`
      const com = await escalar<{ codigo: string | null }>(c, `select public.obs_archive_tally($1, 'serie', $2, $3, ${rel}, true)`, [site, D, MES])
      expect(com.codigo).toBe('conteudo_mudou')
      const sem = await escalar<{ codigo: string | null }>(c, `select public.obs_archive_tally($1, 'serie', $2, $3, ${rel}, false)`, [site, D, MES])
      expect(sem.codigo).toBeNull()
      await relogio(c, '2027-05-02 12:11:00+00')
      expect(codigos(await portao(site, admin, [4]))).toEqual(['conteudo_mudou'])
    })
  })

  it('M2: a conferência que não bate apaga a anterior; sem conferência, o tally com resumo recusa', async () => {
    await emTransacao(async () => {
      const { site, canal, videos } = await cenario()
      expect(await escalar(c, `select public.obs_archive_precheck_unit($1, $2, $3, $4)`, [site, D, MES, canal])).toEqual({ ok: true })
      await c.query(`update public.competitor_video_daily set views = views + 1 where video_id = $1 and snap_date = '2026-10-06'`, [videos[0]])
      expect(await escalar(c, `select public.obs_archive_precheck_unit($1, $2, $3, $4)`, [site, D, MES, canal])).toEqual({ ok: false, codigo: 'conteudo_mudou' })
      expect(await escalar<number>(c, `select count(*)::int from public.obs_archive_prechecks where site_id = $1 and channel_ref = $2::text`, [site, canal])).toBe(0)
      const t = await escalar<{ codigo: string | null }>(c, `select public.obs_archive_tally($1, 'serie', $2, $3, public.obs_archive_part_rel($2, $3, false), true)`, [site, D, MES])
      expect(t.codigo).toBe('conteudo_mudou')
    })
  })

  it('só os velhos: canal conferido há menos de 8 minutos sai da lista; com 9 minutos volta', async () => {
    await emTransacao(async () => {
      const { site, canal } = await cenario()
      expect(await escalar<string[]>(c, `select public.obs_archive_precheck_channels($1, $2, $3, true)`, [site, D, MES])).toEqual([canal])
      await escalar(c, `select public.obs_archive_precheck_unit($1, $2, $3, $4)`, [site, D, MES, canal])
      expect(await escalar<string[]>(c, `select public.obs_archive_precheck_channels($1, $2, $3, true)`, [site, D, MES])).toEqual([])
      expect(await escalar<string[]>(c, `select public.obs_archive_precheck_channels($1, $2, $3)`, [site, D, MES])).toEqual([canal])
      await relogio(c, '2027-05-02 12:09:00+00')
      expect(await escalar<string[]>(c, `select public.obs_archive_precheck_channels($1, $2, $3, true)`, [site, D, MES])).toEqual([canal])
    })
  })

  it('5 e 122: NAS de 25 horas recusa com as horas, em qualquer modo', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await c.query(`update public.obs_archive_months set nas_attested_at = public.obs_archive_agora() - interval '25 hours' where site_id = $1`, [site])
      for (const modo of ['clique', 'automatico']) {
        const f = await portao(site, admin, [5], { modo })
        expect(f, modo).toEqual([expect.objectContaining({ codigo: 'nas_sem_atestacao', horas: 25 })])
      }
    })
  })

  it('6: B2 da forja de 8 dias e do dono de 36 recusam por prazo; do dono de 34, passa; retirada recusa mesmo recente', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await c.query(`update public.obs_archive_months set b2_forja_ok_at = public.obs_archive_agora() - interval '8 days', b2_dono_ok_at = public.obs_archive_agora() - interval '36 days', b2_dono_manifest_sha256 = manifest_sha256 where site_id = $1`, [site])
      expect(await portao(site, admin, [6])).toEqual([{ codigo: 'b2_sem_atestacao', motivo: 'prazo', dias_forja: 8, dias_dono: 36 }])
      await c.query(`update public.obs_archive_months set b2_dono_ok_at = public.obs_archive_agora() - interval '34 days' where site_id = $1`, [site])
      expect(await portao(site, admin, [6])).toEqual([])
      await c.query(`update public.obs_archive_months set b2_withdrawn_at = public.obs_archive_agora() - interval '1 hour', b2_withdrawn_reason = 'divergente', b2_withdrawn_via = 'forja' where site_id = $1`, [site])
      expect(await portao(site, admin, [6])).toEqual([expect.objectContaining({ codigo: 'b2_sem_atestacao', motivo: 'retirada', razao: 'divergente' })])
    })
  })

  it('7 e 90: ensaio de 181 dias recusa nomeando a tabela; o da early não vale para a diária; ensaio sem linha não vale; coluna nova = esquema_mudou', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await c.query(`update public.obs_archive_restores set done_at = public.obs_archive_agora() - interval '181 days' where site_id = $1`, [site])
      expect(await portao(site, admin, [7])).toEqual([expect.objectContaining({ codigo: 'restauracao_vencida', classe: 'serie', tabela: D })])
      await c.query(`insert into public.obs_archive_restores (site_id, class, table_name, schema_fp, origem, chave, units_checked, rows_restored, diff_rows, done_by)
                     values ($1, 'serie', 'competitor_video_early', public.obs_archive_schema_fp('public.competitor_video_early'::regclass), 'b2', 'cofre', 1, 5, 0, 'd')`, [site])
      expect(codigos(await portao(site, admin, [7]))).toEqual(['restauracao_vencida'])
      await c.query(`insert into public.obs_archive_restores (site_id, class, table_name, schema_fp, origem, chave, units_checked, rows_restored, diff_rows, done_by)
                     values ($1, 'serie', $2, public.obs_archive_schema_fp('public.competitor_video_daily'::regclass), 'b2', 'cofre', 1, 0, 0, 'd')`, [site, D])
      expect(codigos(await portao(site, admin, [7]))).toEqual(['restauracao_vencida'])
      await c.query(`update public.obs_archive_restores set done_at = public.obs_archive_agora() - interval '10 days', rows_restored = 10 where site_id = $1 and table_name = $2`, [site, D])
      await c.query(`alter table public.competitor_video_daily add column coluna_nova_m6 int`)
      expect(await portao(site, admin, [7])).toEqual([{ codigo: 'esquema_mudou', tabela: D }])
    })
  })

  it('8: leitura horária com par (vídeo, dia de SP) sem soma no mapa', async () => {
    await emTransacao(async () => {
      await relogio(c, '2027-02-02 12:00:00+00')
      await liberarClasses(c, ['horaria'])
      const { site, videos } = await semearCanal(c, { videos: 1 })
      const admin = await novoAdmin(c, site)
      await c.query(`select obs_part.criar_particao('public.competitor_video_hourly'::regclass, $1)`, [MES])
      await c.query(`insert into public.competitor_video_hourly (video_id, hour_slot, taken_at, site_id, views) values ($1, '2026-10-10 15:00+00', '2026-10-10 15:05+00', $2, 10)`, [videos[0], site])
      const f = await portao(site, admin, [8], { tabela: 'competitor_video_hourly' })
      expect(f).toEqual([{ codigo: 'dia_nao_somado', pares: 1 }])
      await c.query(`insert into public.competitor_hour_fold_log (video_id, day, site_id, intervals_clean, intervals_long) values ($1, '2026-10-10', $2, 1, 0)`, [videos[0], site])
      expect(await portao(site, admin, [8], { tabela: 'competitor_video_hourly' })).toEqual([])
    })
  })

  it('9: marca de 30 dias pendente; tabela de marcas ausente', async () => {
    await emTransacao(async () => {
      const { site, admin, canal } = await cenario()
      await c.query(`insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at) values ($1, 'm6marcapend', 'v', '2026-09-20 12:00+00')`, [canal])
      expect(await portao(site, admin, [9])).toEqual([{ codigo: 'marca_pendente', videos: 1 }])
      await c.query(`alter table public.competitor_video_mark_misses rename to competitor_video_mark_misses_m6`)
      expect(codigos(await portao(site, admin, [9]))).toEqual(['marcas_ausentes'])
    })
  })

  it('10: expurgo pendente de vídeo segura o mês (o caso 129(b), item com todas as unidades purged_at, está na Tarefa 4)', async () => {
    await emTransacao(async () => {
      const { site, admin, canal } = await cenario()
      const admin2 = admin
      await c.query(`insert into public.competitor_removed_items (site_id, kind, youtube_id, competitor_channel_id, decided_by, rows_deleted, archive_pending)
                     values ($1, 'video', 'm6exp', $2, $3, '{}'::jsonb, true)`, [site, canal, admin2])
      expect(await portao(site, admin, [10])).toEqual([{ codigo: 'expurgo_pendente', itens: 1 }])
    })
  })

  it('11: quem não administra recusa com sem_direito; automático sem interruptor armado, interruptor_desligado', async () => {
    await emTransacao(async () => {
      const { site } = await cenario()
      const qualquer = '00000000-0000-0000-0000-00000000dead'
      expect(codigos(await portao(site, qualquer, [11]))).toEqual(['sem_direito'])
      expect(codigos(await portao(site, null, [11]))).toEqual(['sem_direito'])
      expect(codigos(await portao(site, null, [11], { modo: 'automatico' }))).toEqual(['interruptor_desligado'])
      await c.query(`insert into public.obs_archive_switch (site_id, class, armed_at, expires_at) values ($1, 'serie', public.obs_archive_agora(), public.obs_archive_agora() + interval '90 days')`, [site])
      expect(await portao(site, null, [11], { modo: 'automatico' })).toEqual([])
      await relogio(c, '2027-08-01 12:00:00+00')
      expect(codigos(await portao(site, null, [11], { modo: 'automatico' }))).toEqual(['interruptor_desligado'])
    })
  })

  it('13 e 91: linha de outro site na partição, sem mês selado e verde dele, recusa; com o mês dele verde, passa', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      const outro = await semearCanal(c, { site: '00000000-0000-0000-0000-00000000a3b1', videos: 1 })
      await semearDiaria(c, outro.videos, MES, 3)
      expect(codigos(await portao(site, admin, [13]))).toEqual(['outro_site_na_particao'])
      await selarMes(c, { site: outro.site, classe: 'serie', tabela: D, mes: MES })
      expect(await portao(site, admin, [13])).toEqual([])
    })
  })

  it('R27: mês anterior com linha ainda online recusa com saida_fora_de_ordem', async () => {
    await emTransacao(async () => {
      const { site, admin, videos } = await cenario()
      await semearDiaria(c, videos, '2026-09-01', 30)
      await selarMes(c, { site, classe: 'serie', tabela: D, mes: '2026-09-01' })
      expect(await portao(site, admin, [20])).toEqual([{ codigo: 'saida_fora_de_ordem', antes: '2026-09-01' }])
      // r1 I-2: uma saída real de setembro (a partição sai da mãe e o registro diz que saiu), não só uma marca no registro
      await c.query(`alter table public.competitor_video_daily detach partition ${particaoDe(D, '2026-09-01')}`)
      await c.query(`alter table ${particaoDe(D, '2026-09-01')} rename to competitor_video_daily_202609_saida`)
      await c.query(`update public.obs_archive_months set detached_at = now() where site_id = $1 and month = '2026-09-01'`, [site])
      expect(await portao(site, admin, [20])).toEqual([])
    })
  })

  it('r1 I-2: registro diz dropped_at ou detached_at mas a partição segue anexada com linha: registro_diverge (nunca passa calado), nada muda', async () => {
    for (const marca of ['dropped_at', 'detached_at']) {
      await emTransacao(async () => {
        const { site, admin, videos } = await cenario()
        await semearDiaria(c, videos, '2026-09-01', 30)
        await selarMes(c, { site, classe: 'serie', tabela: D, mes: '2026-09-01' })
        await c.query(`update public.obs_archive_months set ${marca} = now() where site_id = $1 and month = '2026-09-01'`, [site])
        expect(await portao(site, admin, [20]), marca).toEqual([{ codigo: 'registro_diverge', mes: '2026-09-01' }])
        expect(await escalar<boolean>(c, `select to_regclass($1) is not null`, [particaoDe(D, '2026-09-01')])).toBe(true)
      })
    }
  })

  it('I7 (Phil): partição anexada de mês anterior com linha e SEM registro também bloqueia a saída de outubro', async () => {
    await emTransacao(async () => {
      const { site, admin, videos } = await cenario()
      await semearDiaria(c, videos, '2026-09-01', 30)          // setembro tem linha na partição e nenhuma linha em obs_archive_months
      expect(await escalar<number>(c, `select count(*)::int from public.obs_archive_months where site_id = $1 and month = '2026-09-01'`, [site])).toBe(0)
      expect(await portao(site, admin, [20])).toEqual([{ codigo: 'saida_fora_de_ordem', antes: '2026-09-01' }])
    })
  })

  it('o dado não existe: mês sem linha no registro dá nao_selado (nunca passa), e exit_check devolve o estado sem varrer', async () => {
    await emTransacao(async () => {
      await relogio(c, '2027-05-02 12:00:00+00')
      await liberarClasses(c, ['serie'])
      const { site } = await semearCanal(c, { videos: 1 })
      await semearDiaria(c, [], MES, 1)
      const admin = await novoAdmin(c, site)
      expect(codigos(await portao(site, admin, [3]))).toEqual(['nao_selado'])
      const ec = await escalar<{ estado: string; faltam: Falta[]; dois_passos: boolean; descartes: number }>(c, `select public.obs_archive_exit_check($1, $2, $3, $4)`, [site, D, MES, admin])
      expect(ec).toMatchObject({ estado: 'online', dois_passos: true, descartes: 0 })
      expect(codigos(ec.faltam)).toContain('nao_selado')
      expect(await escalar<string>(c, `select public.obs_archive_part_rel($1, $2, false)::text`, [D, MES])).toBe(particaoDe(D, MES))
      expect(await escalar<string | null>(c, `select public.obs_archive_part_rel($1, $2, true)::text`, [D, MES])).toBeNull()
    })
  })
})
