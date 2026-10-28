// @vitest-environment node
/**
 * M6, item 128 (plano M6, Tarefa 6): o apagamento e o destaque disputando a mesma linha, em read committed, com duas conexões de verdade.
 * Só com M6_CORRIDAS=1 e SUPABASE_DB_URL no 54422; em série: `npx vitest run --no-file-parallelism test/integration/manutencao-m6-corridas.test.ts`.
 * Desvios do plano (T6, 28/10): M3b/M5 já são migrations no int (só a M6 é confirmada/desfeita); reattach com p_dry_run = false explícito nos
 * finally (o default é true); renovar() antes das chamadas; política restaurada no afterAll.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cpus, loadavg } from 'node:os'
import { urlDasCorridas, semearCanal, semearDiaria, SITE_TESTE } from '../helpers/m3b'
import { apagarCanais } from '../helpers/limpa-cena'
import { corridasM6Ligadas, confirmarM6ParaCorridas, desfazerM6DasCorridas, selarMes, particaoDe, novoAdmin, semearHoraria, semearEarly, apagarCanalDeclarando, M6_SQL_CAMINHO, M6_DESFAZER_CAMINHO } from '../helpers/m6'

const D = 'competitor_video_daily'
// Desvio (T6): o int tem ~38 mil linhas de outros sites em set e out/2026 (outro_site_na_particao e saida_fora_de_ordem); as corridas usam meses sem dado alheio.
const MES = '2026-06-01'

describe('M6 desfazer das corridas: cobre toda função do m6.sql', () => {
  it('toda função obs_archive_* que o m6.sql cria está na lista do m6-desfazer.sql', () => {
    const criadas = [...new Set([...readFileSync(M6_SQL_CAMINHO, 'utf8').matchAll(/function public\.(obs_archive_[a-z_0-9]*)/g)].map(m => m[1]))]
    const desfazer = readFileSync(M6_DESFAZER_CAMINHO, 'utf8')
    expect(criadas.length).toBeGreaterThan(20)
    // obs_archive_vermelhos é função da M3b que a M6 só redefine (os blocos novos ficam atrás de to_regprocedure): o desfazer não a derruba
    expect(criadas.filter(f => f !== 'obs_archive_vermelhos' && !desfazer.includes(`'${f}'`))).toEqual([])
    void resolve
  })
})

describe.skipIf(!corridasM6Ligadas())('M6 item 128: corridas entre apagar e destacar', () => {
  vi.setConfig({ testTimeout: 60_000 })   // o padrão de 5 s derruba as corridas que esperam o lock_timeout de 3 s
  let a: Client, b: Client, site: string, canal: string, admin: string, videos: string[], politicaOriginal = ''
  const dorme = (ms: number): Promise<void> => new Promise(res => setTimeout(res, ms))
  const relogioSessao = async (agora: string, hoje: string): Promise<void> => {
    for (const c of [a, b]) { await c.query(`select set_config('obs_archive.agora', $1, false)`, [agora]); await c.query(`select set_config('obs_archive.hoje', $1, false)`, [hoje]) }
  }
  /** O selo (NAS 24 h, B2 7 d) vence com o relógio simulado: renova só o site da corrida (o int tem seed de outros sites). */
  const renovar = (): Promise<unknown> => a.query(`update public.obs_archive_months set nas_attested_at = public.obs_archive_agora(),
      b2_forja_ok_at = case when b2_withdrawn_at is null and b2_forja_ok_at is not null then public.obs_archive_agora() else b2_forja_ok_at end
      where site_id = $1 and dropped_at is null and nas_attested_at is not null`, [site])
  const religar = (): Promise<unknown> => a.query(`select public.obs_archive_reattach_month($1, $2, $3, $4, false)`, [site, D, MES, admin]).catch(() => undefined)

  /** Deixa o site de teste e as partições dos meses das corridas como estavam: roda no início (resto de corrida abortada) e no fim. */
  const limparSite = async (): Promise<void> => {
    for (const c of [a, b]) await c.query('rollback').catch(() => undefined)
    await a.query('reset role').catch(() => undefined)
    const det = (await a.query(`select table_name, month::text as m from public.obs_archive_months where site_id = $1 and detached_at is not null and dropped_at is null`, [SITE_TESTE])).rows
    const por = det.length ? (admin ?? await novoAdmin(a, SITE_TESTE)) : null
    for (const d of det) {
      const r = (await a.query(`select public.obs_archive_reattach_month($1, $2, $3::date, $4, false) as r`, [SITE_TESTE, d.table_name, d.m, por])).rows[0].r
      if (r.status !== 'ok') console.error('[m6-corridas] limpeza: reattach recusado', JSON.stringify(r))
    }
    await apagarCanais(a, 'site_id = $1', [SITE_TESTE])
    for (const t of ['obs_archive_prechecks', 'obs_archive_units', 'obs_archive_months', 'obs_archive_restores']) await a.query(`delete from public.${t} where site_id = $1`, [SITE_TESTE])
    for (const m of ['202605', '202604']) {
      await a.query(`drop table if exists obs_part.competitor_video_daily_${m}_saida`)
      await a.query(`select obs_part.criar_particao('public.competitor_video_daily'::regclass, $1::date)`, [`${m.slice(0, 4)}-${m.slice(4)}-01`])
    }
  }

  /**
   * O int tem o seed e2e da M5 com 6 meses destacados e não descartados (outro site): o gatilho da M6 recusa todo apagamento enquanto houver mês assim.
   * As corridas marcam esses meses como descartados (commitado) e, no fim, voltam o dropped_at para nulo. Desvio do plano (T6).
   */
  let semente: Array<{ site_id: string; class: string; table_name: string; month: string }> = []
  const neutralizarSemente = async (): Promise<void> => {
    semente = (await a.query(`update public.obs_archive_months set dropped_at = now() where detached_at is not null and dropped_at is null and site_id <> $1
      returning site_id, class, table_name, month::text as month`, [SITE_TESTE])).rows as typeof semente
  }
  const devolverSemente = async (): Promise<void> => {
    for (const m of semente) await a.query(`update public.obs_archive_months set dropped_at = null where site_id = $1 and class = $2 and table_name = $3 and month = $4::date`, [m.site_id, m.class, m.table_name, m.month])
  }

  beforeAll(async () => {
    await confirmarM6ParaCorridas()
    a = new Client({ connectionString: urlDasCorridas() }); await a.connect()
    b = new Client({ connectionString: urlDasCorridas() }); await b.connect()
    await neutralizarSemente()
    await limparSite()
    await relogioSessao('2027-05-02 12:00:00+00', '2027-05-02')
    politicaOriginal = (await a.query(`select pg_get_functiondef('public.obs_archive_policy()'::regprocedure) as d`)).rows[0].d as string
    const nova = politicaOriginal.replace(`('serie', 'competitor_video_daily', 'particao', 6, 28, 7, 'depois_de_3', false,`, `('serie', 'competitor_video_daily', 'particao', 6, 28, 7, 'depois_de_3', true,`)
    if (nova !== politicaOriginal) await a.query(nova)   // no int a série já pode estar liberada; então nada a trocar
    const s = await semearCanal(a, { videos: 2 }); site = s.site; canal = s.canal; videos = s.videos
    await semearDiaria(a, s.videos, MES, 31)
    await selarMes(a, { site, classe: 'serie', tabela: D, mes: MES })
    await a.query(`insert into public.competitor_video_marks (video_id, age_days, site_id, views, gap_hours, age_base_at, read_before_at, read_after_at)
                   select v, 30, $2, 1, 1, now(), now(), now() from unnest($1::uuid[]) v on conflict do nothing`, [s.videos, site])
    admin = await novoAdmin(a, site)
  }, 120_000)
  afterAll(async () => {
    try {
      if (a) {
        await limparSite().catch((e: Error) => console.error('[m6-corridas] limpeza do site falhou', e.message))
        if (politicaOriginal) await a.query(politicaOriginal).catch(() => undefined)
        await devolverSemente()
      }
    } finally {
      await a?.end(); await b?.end()
      await desfazerM6DasCorridas()
    }
  }, 120_000)

  async function destacarVoltando<T>(f: () => Promise<T>): Promise<T> {
    try { return await f() } finally { await religar() }
  }

  it('(i) apagar canal ANTES do destaque confirmar: o apagamento espera a trava e, ao seguir, enxerga o destaque e recusa', async () => {
    await destacarVoltando(async () => {
      await renovar()
      await a.query('begin')
      try {
        const r = (await a.query(`select public.obs_archive_detach_month($1, $2, $3, $4, 'clique', false) as r`, [site, D, MES, admin])).rows[0].r as { status: string }
        expect(r, JSON.stringify(r)).toMatchObject({ status: 'ok' })
        // Desvio do plano (T6): com a M3b, o apagamento cru recusa por destino não declarado antes de esperar qualquer trava; o caminho real declara o destino primeiro.
        await b.query('begin')
        await b.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known, declared_xid)
          values ($1, $2, 'botao', 'apagar', now(), true, pg_current_xact_id())`, [site, canal])
        const t0 = Date.now()
        const apagar = b.query(`delete from public.competitor_channels where id = $1`, [canal]).then(() => 'apagou', (e: { message: string }) => e.message)
        await dorme(500)
        await a.query('commit')
        const resultado = await apagar
        console.log('[m6-corridas] (i) apagar canal durante o destaque:', resultado, Date.now() - t0, 'ms')
        await b.query('rollback')
        expect(resultado).toBe('mes_destacado_em_transito')
      } catch (e) { await a.query('rollback').catch(() => undefined); await b.query('rollback').catch(() => undefined); throw e }
    })
  })

  it('(ii) destacar com um apagamento aberto: o destaque espera até 3 s e responde ocupado; nada muda', async () => {
    await renovar()
    await b.query('begin')
    await b.query(`delete from public.competitor_video_daily where video_id in (select id from public.competitor_videos where competitor_channel_id = $1) and snap_date = '2026-06-02'`, [canal])
    try {
      const t0 = Date.now()
      const r = (await a.query(`select public.obs_archive_detach_month($1, $2, $3, $4, 'clique', false) as r`, [site, D, MES, admin])).rows[0].r as { status: string; codigo?: string }
      expect(r, JSON.stringify(r)).toMatchObject({ status: 'recusado', codigo: 'ocupado' })
      expect(Date.now() - t0).toBeLessThan(6_000)
    } finally { await b.query('rollback') }
    expect((await a.query(`select to_regclass($1) is not null as e`, [particaoDe(D, MES)])).rows[0].e).toBe(true)
  })

  it('(iii) leitor com transação aberta (repeatable read) segura a mãe: o destaque cede (ocupado) e o retrato nunca mostra órfã; depois do commit do leitor, o destaque passa e o leitor não vê linha', async () => {
    // Desvio do plano (T6): o plano esperava o destaque passar com o leitor em repeatable read e o retrato antigo ainda mostrar a linha (rr = antes).
    // Na prática o select do leitor segura ACCESS SHARE na mãe até o commit e o detach (ACCESS EXCLUSIVE) espera o lock_timeout e responde ocupado: pior que o plano previa só no tempo.
    await destacarVoltando(async () => {
      await renovar()
      const cont = async (): Promise<number> => Number((await b.query(`select count(*) as n from public.competitor_video_daily where snap_date >= $1 and snap_date < ($1::date + interval '1 month') and video_id = any($2::uuid[])`, [MES, videos])).rows[0].n)
      await b.query('begin isolation level repeatable read')
      try {
        const antes = await cont()
        expect(antes).toBeGreaterThan(0)
        const t0 = Date.now()
        const r = (await a.query(`select public.obs_archive_detach_month($1, $2, $3, $4, 'clique', false) as r`, [site, D, MES, admin])).rows[0].r as { status: string; codigo?: string }
        console.log('[m6-corridas] (iii) detach com leitor RR aberto:', JSON.stringify(r), Date.now() - t0, 'ms')
        expect(r, JSON.stringify(r)).toMatchObject({ status: 'recusado', codigo: 'ocupado' })
        expect(await cont()).toBe(antes)
      } finally { await b.query('rollback') }
      await renovar()
      expect((await a.query(`select public.obs_archive_detach_month($1, $2, $3, $4, 'clique', false) as r`, [site, D, MES, admin])).rows[0].r.status).toBe('ok')
      expect(Number((await b.query(`select count(*) as n from public.competitor_video_daily where snap_date >= $1 and snap_date < ($1::date + interval '1 month') and video_id = any($2::uuid[])`, [MES, videos])).rows[0].n)).toBe(0)
    })
  })

  const chamar = (c: Client, fn: string, mes: string, extra = ''): Promise<{ status: string; codigo?: string; faltam?: Array<{ codigo: string }> }> =>
    c.query(`select public.obs_archive_${fn}_month($1, $2, $3, $4${extra}) as r`, [site, D, mes, admin]).then(r => r.rows[0].r)

  type Vista = { status?: string; codigo?: string; erro?: string }
  const REPETICOES = 20
  /** r1 I-1: o perdedor responde exatamente o código esperado; erro de banco (relação ausente, deadlock) ou `ocupado` reprova. */
  async function disputa(fn: string, mes: string, extra: string, codigo: string, rep: number): Promise<void> {
    const r = await Promise.allSettled([chamar(a, fn, mes, extra), chamar(b, fn, mes, extra)])
    const vistas: Vista[] = r.map(x => x.status === 'fulfilled' ? x.value : { erro: String((x.reason as Error).message) })
    const ctx = `${fn} rep ${rep}: ${JSON.stringify(vistas)}`
    expect(vistas.filter(v => v.erro), ctx).toEqual([])
    expect(vistas.filter(v => v.status === 'ok'), ctx).toHaveLength(1)
    expect(vistas.find(v => v.status !== 'ok'), ctx).toMatchObject({ status: 'recusado', codigo })
  }
  /** Zera o registro e as tabelas de um mês extra, para a próxima repetição partir do mesmo estado. */
  async function zerarMes(mes: string): Promise<void> {
    for (const t of ['obs_archive_prechecks', 'obs_archive_units', 'obs_archive_months']) await a.query(`delete from public.${t} where site_id = $1 and table_name = $2 and month = $3`, [site, D, mes])
    const nome = particaoDe(D, mes)
    await a.query(`drop table if exists ${nome}_saida`)
    await a.query(`drop table if exists ${nome}`)
  }

  it(`C-2 (r1 I-1): dois detach ao mesmo tempo, ${REPETICOES} vezes: um ok e o outro EXATAMENTE ja_destacado, sem erro de banco`, async () => {
    for (let rep = 0; rep < REPETICOES; rep++) {
      await renovar()
      try { await disputa('detach', MES, ", 'clique', false", 'ja_destacado', rep) } finally { await religar() }
    }
  })

  it(`C-2 (r1 I-1): dois reattach ao mesmo tempo, ${REPETICOES} vezes: um ok e o outro EXATAMENTE nao_destacado, sem erro de banco`, async () => {
    for (let rep = 0; rep < REPETICOES; rep++) {
      await renovar()
      const d = await chamar(a, 'detach', MES, ", 'clique', false")
      expect(d, `rep ${rep}`).toMatchObject({ status: 'ok' })
      try { await disputa('reattach', MES, ', false', 'nao_destacado', rep) } finally { await religar() }
    }
  })

  /**
   * Re-revisão r1 (Phil item 2 = Yannis R-1): a simulação não trava e lê o nome da relação que a ação está renomeando. O erro cru
   * (relation ... does not exist) vira a resposta do que mudou: nunca erro de banco para quem só olhava.
   */
  const CODIGOS_DE_QUEM_PERDEU = ['ja_destacado', 'nao_destacado', 'ja_descartado', 'mudou_durante_a_leitura']
  it('R-1 (determinístico): simulação do detach lendo enquanto a ação renomeia a partição responde ja_destacado, sem erro de banco', async () => {
    await renovar()
    try {
      await b.query('begin')
      expect((await b.query(`select public.obs_archive_detach_month($1, $2, $3, $4, 'clique', false) as r`, [site, D, MES, admin])).rows[0].r).toMatchObject({ status: 'ok' })
      const sim = chamar(a, 'detach', MES, ", 'clique', true").then(x => ({ x, erro: undefined as string | undefined }), (e: Error) => ({ x: undefined, erro: e.message }))
      await dorme(1000)
      await b.query('commit')
      const v = await sim
      expect(v.erro, JSON.stringify(v)).toBeUndefined()
      expect(v.x, JSON.stringify(v)).toMatchObject({ status: 'recusado', codigo: 'ja_destacado' })   // r2 M-3: o código exato, não qualquer um dos 4
    } finally { await b.query('rollback').catch(() => undefined); await religar() }
  })

  it('R-1 (determinístico): simulação do reattach lendo enquanto a ação renomeia a _saida responde nao_destacado, sem erro de banco', async () => {
    await renovar()
    try {
      expect(await chamar(a, 'detach', MES, ", 'clique', false")).toMatchObject({ status: 'ok' })
      await b.query('begin')
      expect((await b.query(`select public.obs_archive_reattach_month($1, $2, $3, $4, false) as r`, [site, D, MES, admin])).rows[0].r).toMatchObject({ status: 'ok' })
      const sim = chamar(a, 'reattach', MES, ', true').then(x => ({ x, erro: undefined as string | undefined }), (e: Error) => ({ x: undefined, erro: e.message }))
      await dorme(1000)
      await b.query('commit')
      const v = await sim
      expect(v.erro, JSON.stringify(v)).toBeUndefined()
      expect(v.x, JSON.stringify(v)).toMatchObject({ status: 'recusado', codigo: 'nao_destacado' })   // r2 M-3
    } finally { await b.query('rollback').catch(() => undefined); await religar() }
  })

  async function simulacaoContraAcao(fnSim: string, fnAcao: string, extraAcao: string, preparar: () => Promise<void>): Promise<void> {
    for (let rep = 0; rep < REPETICOES; rep++) {
      await renovar(); await preparar()
      try {
        const [s, ac] = await Promise.allSettled([chamar(a, fnSim, MES, fnSim === 'detach' ? ", 'clique', true" : ', true'), chamar(b, fnAcao, MES, extraAcao)])
        const ctx = `${fnSim} x ${fnAcao} rep ${rep}: ${JSON.stringify([s, ac])}`
        expect(s.status, ctx).toBe('fulfilled')                       // a simulação nunca pode devolver erro de banco
        expect(ac.status, ctx).toBe('fulfilled')
        const sv = (s as PromiseFulfilledResult<{ status: string; codigo?: string }>).value
        if (sv.status === 'recusado' && CODIGOS_DE_QUEM_PERDEU.includes(sv.codigo ?? '')) continue
        expect(['simulado', 'recusado'], ctx).toContain(sv.status)
      } finally { await religar() }
    }
  }
  it(`R-1: simulação do detach contra a ação do detach, ${REPETICOES} vezes: nunca erro de banco`, async () => {
    await simulacaoContraAcao('detach', 'detach', ", 'clique', false", async () => undefined)
  })
  it(`R-1: simulação do reattach contra a ação do reattach, ${REPETICOES} vezes: nunca erro de banco`, async () => {
    await simulacaoContraAcao('reattach', 'reattach', ', false', async () => { await chamar(a, 'detach', MES, ", 'clique', false") })
  })

  it('(iv) coleta já escreveu na série e vai escrever nos vídeos: o destaque cede (ocupado), a coleta nunca é a abortada', async () => {
    await renovar()
    await b.query('begin')
    try {
      await b.query(`insert into public.competitor_video_daily (video_id, snap_date, views, taken_at) values ($1, current_date, 1, now()) on conflict do nothing`, [videos[0]])
      const emVoo = chamar(a, 'detach', MES, ", 'clique', false")
      await dorme(300)
      await b.query(`update public.competitor_videos set last_checked_at = now() where id = $1`, [videos[0]])
      await b.query('commit')
      const r = await emVoo
      expect(r.codigo ?? r.status).toMatch(/ocupado|ok/)
    } catch (e) { await b.query('rollback').catch(() => undefined); throw e }
    finally { await religar() }
  })

  it('(v) coleta já escreveu nos vídeos e vai escrever na série: o destaque espera a coleta terminar; a coleta nunca é a abortada', async () => {
    await renovar()
    await b.query('begin')
    try {
      await b.query(`update public.competitor_videos set last_checked_at = now() where id = $1`, [videos[0]])
      const emVoo = chamar(a, 'detach', MES, ", 'clique', false")
      await dorme(300)
      await b.query(`insert into public.competitor_video_daily (video_id, snap_date, views, taken_at) values ($1, current_date, 1, now()) on conflict do nothing`, [videos[0]])
      await b.query('commit')
      expect((await emVoo).status).toMatch(/ok|recusado/)
    } catch (e) { await b.query('rollback').catch(() => undefined); throw e }
    finally { await religar() }
  })

  it('statement_timeout por papel: o service_role cabe nos 8 s do PostgREST; anotar a medida', async () => {
    await renovar()
    const st = (await a.query(`select rolname, rolconfig from pg_roles where rolname in ('service_role', 'authenticator', 'authenticated')`)).rows
    console.log('[m6-corridas] statement_timeout por papel:', JSON.stringify(st))
    const t0 = Date.now()
    await a.query(`select public.obs_archive_detach_month($1, $2, $3, $4, 'clique', true)`, [site, D, MES, admin])
    const ms = Date.now() - t0
    console.log('[m6-corridas] simulação de destaque (2 canais, 31 dias):', ms, 'ms')
    expect(ms).toBeLessThan(8_000)
  })

  async function mesExtra(mes: string): Promise<void> {
    await a.query(`select obs_part.criar_particao('public.competitor_video_daily'::regclass, $1)`, [mes])
    await semearDiaria(a, videos, mes, 28)
    await selarMes(a, { site, classe: 'serie', tabela: D, mes })
  }
  async function tresDescartes(): Promise<void> {
    for (const mes of ['2026-01-01', '2026-02-01', '2026-03-01']) {
      await a.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at, rows_dropped) values ($1, 'serie', $2, $3, now(), 10) on conflict do nothing`, [site, D, mes])
    }
  }

  it(`C-2 (r1 I-1): dois discard ao mesmo tempo, ${REPETICOES} vezes: um ok e o outro EXATAMENTE ja_descartado, sem deadlock`, async () => {
    for (let rep = 0; rep < REPETICOES; rep++) {
      await zerarMes('2026-05-01')
      await mesExtra('2026-05-01')
      await relogioSessao('2027-05-02 12:00:00+00', '2027-05-02')
      await renovar()
      const d = await chamar(a, 'detach', '2026-05-01', ", 'clique', false")
      expect(d, `rep ${rep}`).toMatchObject({ status: 'ok' })
      await relogioSessao('2027-05-20 12:00:00+00', '2027-05-20')
      try {
        await renovar()
        await disputa('discard', '2026-05-01', ", 'clique', false", 'ja_descartado', rep)
      } finally { await relogioSessao('2027-05-02 12:00:00+00', '2027-05-02') }
    }
    await zerarMes('2026-05-01')
    await a.query(`select obs_part.criar_particao('public.competitor_video_daily'::regclass, '2026-05-01')`)
  })

  it(`C-2 (r1 I-1): dois drop ao mesmo tempo, ${REPETICOES} vezes: um ok e o outro EXATAMENTE ja_descartado, sem erro de banco`, async () => {
    await tresDescartes()
    for (let rep = 0; rep < REPETICOES; rep++) {
      await zerarMes('2026-04-01')
      await mesExtra('2026-04-01')
      await renovar()
      await disputa('drop', '2026-04-01', ", 'clique', false", 'ja_descartado', rep)
    }
    await zerarMes('2026-04-01')
    await a.query(`select obs_part.criar_particao('public.competitor_video_daily'::regclass, '2026-04-01')`)
  })

  /**
   * r2 I-3 (Phil I-3 = Yannis I-2): o molde determinístico do R-1 para discard, drop e precheck_unit, mais o ramo syntax_error (OID morto).
   * B abre a ação sem confirmar (e, se pedido, segura uma tabela que o portão lê); A simula e fica esperando; B confirma; A tem de responder o código exato, sem erro.
   * As corridas de 20 repetições acima são fumaça: passam até sem o handler (m6a-t7a-vermelho-corrida.txt).
   */
  async function simulaContraAcaoAberta<T>(acaoSql: string, params: unknown[], sim: () => Promise<T>, antes?: string): Promise<{ x?: T; erro?: string }> {
    await b.query('begin')
    try {
      if (antes) await b.query(antes)
      expect((await b.query(acaoSql, params)).rows[0].r, 'a ação de B').toMatchObject({ status: 'ok' })
      const p = sim().then(x => ({ x, erro: undefined as string | undefined }), (e: Error) => ({ x: undefined, erro: e.message }))
      await dorme(1000)
      await b.query('commit')
      return await p
    } finally { await b.query('rollback').catch(() => undefined) }
  }
  async function prepararDescartavel(mes: string): Promise<void> {
    await zerarMes(mes); await mesExtra(mes)
    await relogioSessao('2027-05-02 12:00:00+00', '2027-05-02')
    await renovar()
    expect(await chamar(a, 'detach', mes, ", 'clique', false")).toMatchObject({ status: 'ok' })
    await relogioSessao('2027-05-20 12:00:00+00', '2027-05-20')
    await renovar()
  }
  async function restaurarMes(mes: string): Promise<void> {
    await relogioSessao('2027-05-02 12:00:00+00', '2027-05-02')
    await zerarMes(mes)
    await a.query(`select obs_part.criar_particao('public.competitor_video_daily'::regclass, $1::date)`, [mes])
  }
  const acaoSql = (fn: string, extra: string): string => `select public.obs_archive_${fn}_month($1, $2, $3, $4${extra}) as r`

  it('R-1 (determinístico): simulação do discard lendo enquanto a ação apaga a _saida responde ja_descartado, sem erro de banco', async () => {
    await prepararDescartavel('2026-05-01')
    try {
      const v = await simulaContraAcaoAberta(acaoSql('discard', ", 'clique', false"), [site, D, '2026-05-01', admin], () => chamar(a, 'discard', '2026-05-01', ", 'clique', true"))
      expect(v.erro, JSON.stringify(v)).toBeUndefined()
      expect(v.x, JSON.stringify(v)).toMatchObject({ status: 'recusado', codigo: 'ja_descartado' })
    } finally { await restaurarMes('2026-05-01') }
  })

  it('R-1 (determinístico): simulação do drop lendo enquanto a ação destaca e apaga a partição responde ja_descartado, sem erro de banco', async () => {
    await tresDescartes(); await zerarMes('2026-04-01'); await mesExtra('2026-04-01'); await renovar()
    try {
      const v = await simulaContraAcaoAberta(acaoSql('drop', ", 'clique', false"), [site, D, '2026-04-01', admin], () => chamar(a, 'drop', '2026-04-01', ", 'clique', true"))
      expect(v.erro, JSON.stringify(v)).toBeUndefined()
      expect(v.x, JSON.stringify(v)).toMatchObject({ status: 'recusado', codigo: 'ja_descartado' })
    } finally { await restaurarMes('2026-04-01') }
  })

  it('R-1 (determinístico): o precheck_unit lendo enquanto a ação destaca devolve mudou_durante_a_leitura, sem erro de banco', async () => {
    await renovar()
    try {
      const v = await simulaContraAcaoAberta(acaoSql('detach', ", 'clique', false"), [site, D, MES, admin],
        () => a.query(`select public.obs_archive_precheck_unit($1, $2, $3, $4) as r`, [site, D, MES, canal]).then(r => r.rows[0].r as { ok: boolean; codigo?: string }))
      expect(v.erro, JSON.stringify(v)).toBeUndefined()
      expect(v.x, JSON.stringify(v)).toEqual({ ok: false, codigo: 'mudou_durante_a_leitura' })
    } finally { await religar() }
  })

  it('R-1 (determinístico, syntax_error): OID morto na hora de montar o SQL do portão (a ação apaga a partição enquanto a simulação espera dentro de invariante_faltam) responde ja_descartado', async () => {
    // O SQL do portão formata o regclass com `%s`: o OID de uma relação já apagada vira número e o erro é de sintaxe (42601), não de relação ausente.
    // Para a simulação esperar ANTES de formatar, invariante_faltam (lida depois de part_rel e antes do portão) ganha uma espera numa trava consultiva que B segura; restaurada no fim.
    const original = (await a.query(`select pg_get_functiondef('public.obs_archive_invariante_faltam()'::regprocedure) as d`)).rows[0].d as string
    const corpo = original.split('$function$')[1].trim().replace(/;$/, '')
    await tresDescartes(); await zerarMes('2026-04-01'); await mesExtra('2026-04-01'); await renovar()
    await a.query(`create or replace function public.obs_archive_invariante_faltam() returns text[] language plpgsql volatile security definer set search_path = '' as $$
      begin perform pg_advisory_xact_lock(7771); return (${corpo}); end $$`)
    try {
      const v = await simulaContraAcaoAberta(acaoSql('drop', ", 'clique', false"), [site, D, '2026-04-01', admin],
        () => chamar(a, 'drop', '2026-04-01', ", 'clique', true"), 'select pg_advisory_xact_lock(7771)')
      expect(v.erro, JSON.stringify(v)).toBeUndefined()
      expect(v.x, JSON.stringify(v)).toMatchObject({ status: 'recusado', codigo: 'ja_descartado' })
    } finally { await a.query(original); await restaurarMes('2026-04-01') }
  })

  it('r1 I-1: a trava consultiva do mês: a ação espera até 20 s e responde ocupado; a simulação não espera; nada muda', async () => {
    await renovar()
    await destacarVoltando(async () => {
      await b.query('begin')
      try {
        await b.query(`select pg_advisory_xact_lock(pg_catalog.hashtextextended('obs_archive_saida|' || $1::text || '|' || $2::text, 0))`, [D, MES])
        let t = Date.now()
        const sim = (await a.query(`select public.obs_archive_detach_month($1, $2, $3, $4, 'clique', true) as r`, [site, D, MES, admin])).rows[0].r as Vista
        expect(sim.codigo, JSON.stringify(sim)).not.toBe('ocupado')
        expect(Date.now() - t, 'a simulação não pega a trava').toBeLessThan(8_000)
        t = Date.now()
        const r = (await a.query(`select public.obs_archive_detach_month($1, $2, $3, $4, 'clique', false) as r`, [site, D, MES, admin])).rows[0].r as Vista
        const ms = Date.now() - t
        expect(r, JSON.stringify(r)).toMatchObject({ status: 'recusado', codigo: 'ocupado' })
        expect(ms).toBeGreaterThan(19_000)
        expect(ms).toBeLessThan(30_000)
      } finally { await b.query('rollback') }
      expect((await a.query(`select to_regclass($1) is not null as e`, [particaoDe(D, MES)])).rows[0].e).toBe(true)
    })
  })

  it('C-2 no drop: B2 retirado gravado por OUTRA conexão entre o portão e a trava: recusa b2_sem_atestacao e a partição existe', async () => {
    await mesExtra('2026-04-01')
    await tresDescartes()
    await renovar()
    await b.query('begin')
    await b.query(`select 1 from public.obs_archive_months where site_id = $1 and class = 'serie' and table_name = $2 and month = '2026-04-01' for update`, [site, D])
    const emVoo = chamar(a, 'drop', '2026-04-01', ", 'clique', false")
    await dorme(500)
    await b.query(`update public.obs_archive_months set b2_withdrawn_at = now(), b2_withdrawn_reason = 'ausente', b2_withdrawn_via = 'forja' where site_id = $1 and table_name = $2 and month = '2026-04-01'`, [site, D])
    await b.query('commit')
    const r = await emVoo
    expect(r.status).toBe('recusado')
    expect(r.faltam?.map(f => f.codigo)).toEqual(['b2_sem_atestacao'])
    expect((await a.query(`select to_regclass($1) is not null as e`, [particaoDe(D, '2026-04-01')])).rows[0].e).toBe(true)
    // o mês extra de abril fica anexado com linha e mais antigo que o de junho: sairia fora de ordem no CP13. r1 I-2: marcar dropped_at no registro com a
    // partição anexada e com linha é o estado `registro_diverge`; a fixture agora tira o mês de verdade (tabela e registro) e deixa uma partição vazia.
    await zerarMes('2026-04-01')
    await a.query(`select obs_part.criar_particao('public.competitor_video_daily'::regclass, '2026-04-01')`)
  })

  it('CP13 por razão medida: conferência por canal, a mãe travada e a ação ponta a ponta contra o maxDuration de 60 s, na diária E na horária (3 rodadas, vale a pior)', async () => {
    const canais = Number(process.env.M6_CANAIS ?? 75), porCanal = Number(process.env.M6_VIDEOS_POR_CANAL ?? 23)
    const H = 'competitor_video_hourly'
    const outros: string[] = []
    try {
      for (let i = 0; i < canais - 1; i++) {
        const cauda = i === 0
        const s = await semearCanal(a, { site, videos: cauda ? 204 : porCanal }); outros.push(s.canal)
        await semearDiaria(a, s.videos, MES, 31)
        await semearHoraria(a, s.videos, MES, Math.ceil((cauda ? 14_100 : 1_500) / s.videos.length))
        await semearEarly(a, s.videos, MES, cauda ? 40 : 4)
      }
      // Condição 8 do portão (horária): cada par vídeo-dia precisa estar no registro de soma das horas.
      await a.query(`insert into public.competitor_hour_fold_log (video_id, day, site_id, intervals_clean, intervals_long)
        select distinct h.video_id, (h.hour_slot at time zone 'America/Sao_Paulo')::date, h.site_id, 1, 0 from public.competitor_video_hourly h
         where h.site_id = $1 and h.hour_slot >= $2::timestamptz and h.hour_slot < ($2::date + interval '1 month')::timestamptz + interval '1 day' on conflict do nothing`, [site, MES])
      // sem estatística o planejador escolhe varredura sequencial em tabela recém-semeada; em produção o autovacuum já analisou
      await a.query('analyze public.competitor_videos, public.competitor_video_daily, public.competitor_video_hourly')
      const ALVOS = [{ classe: 'serie', tabela: D }, { classe: 'horaria', tabela: H }] as const
      const FATOR = Number(process.env.M6_FATOR ?? 4.05)
      const RTT = 2 * 150
      // r1 M-1: (1) o TRABALHO, determinístico: linhas lidas pela conferência de cada canal (pg_stat_xact_user_tables), que pega varredura no lugar do índice
      // em qualquer carga; (2) o TEMPO da melhor de 3 rodadas, dividido por uma consulta de calibração medida no mesmo instante. Máquina carregada: nao_medido.
      const REF_QUIETA_MS = Number(process.env.M6_REF_QUIETA_MS ?? 173)   // a calibração em máquina quieta (load 3 em 14 CPUs, mínimo das rodadas, 28/10)
      const calibrar = async (): Promise<number> => {
        let melhor = Infinity
        for (let i = 0; i < 3; i++) { const t0 = Date.now(); await a.query('select sum(hashtext(g::text)) from generate_series(1, 2000000) g'); melhor = Math.min(melhor, Date.now() - t0) }
        return melhor
      }
      const lidas = async (tabela: string): Promise<number> => Number((await a.query(
        `select coalesce(sum(seq_tup_read + idx_tup_fetch), 0) as n from pg_stat_xact_user_tables where schemaname = 'obs_part' and relname like $1`, [`${tabela}\\_%`])).rows[0].n)
      for (const alvo of ALVOS) {
        const pior = { inline: 0, maior: 0, travaDetach: 0, travaReattach: 0, ponta: 0, maeDetach: 0, maeReattach: 0, lidasPorLinha: 0 }
        const rodadasMaior: number[] = [], calibracoes: number[] = []
        const linhasDoCanal = new Map<string, number>()
        const linhasDaParticao = Number((await a.query(`select count(*) as n from ${particaoDe(alvo.tabela, MES)}`)).rows[0].n)
        for (let rodada = 0; rodada < 3; rodada++) {
          await selarMes(a, { site, classe: alvo.classe, tabela: alvo.tabela, mes: MES, versao: rodada + 10 })
          await a.query(`delete from public.obs_archive_prechecks where site_id = $1`, [site])
          await renovar()
          calibracoes.push(await calibrar())
          await a.query('set role service_role')
          let t = Date.now()
          await a.query(`select public.obs_archive_detach_month($1, $2, $3, $4, 'clique', true)`, [site, alvo.tabela, MES, admin])
          const inline = Date.now() - t
          pior.inline = Math.max(pior.inline, inline)
          const lista = (await a.query(`select unnest(public.obs_archive_precheck_channels($1, $2, $3, true)) as c`, [site, alvo.tabela, MES])).rows.map(r => r.c as string)
          let somaConf = 0, maiorDaRodada = 0
          for (const c of lista) {
            if (!linhasDoCanal.has(c)) {
              await a.query('reset role')
              linhasDoCanal.set(c, Number((await a.query(`select count(*) as n from public.${alvo.tabela} t join public.competitor_videos v on v.id = t.video_id where v.competitor_channel_id = $1::uuid`, [c])).rows[0].n))
              await a.query('set role service_role')
            }
            await a.query('begin')
            const antes = await lidas(alvo.tabela)
            t = Date.now()
            await a.query(`select public.obs_archive_precheck_unit($1, $2, $3, $4::uuid)`, [site, alvo.tabela, MES, c])
            const d = Date.now() - t; somaConf += d; maiorDaRodada = Math.max(maiorDaRodada, d)
            const lidasCanal = (await lidas(alvo.tabela)) - antes
            await a.query('commit')
            const linhas = linhasDoCanal.get(c) ?? 0
            pior.lidasPorLinha = Math.max(pior.lidasPorLinha, lidasCanal / Math.max(linhasDaParticao, 1))
            // Medido (28/10): a conferência faz 3 leituras do canal (resumo da linha, hash, resumo de novo) e o planejador lê a partição inteira em cada uma
            // (varredura sequencial + hash: a premissa do parecer, "índice", não vale neste tamanho). O teto é 3 passadas + folga; uma leitura por vídeo (~47x) estoura.
            expect(lidasCanal, `${alvo.classe} canal ${c}: linhas lidas pela conferência (${linhas} no canal, ${linhasDaParticao} na partição)`).toBeLessThanOrEqual(3 * linhasDaParticao + 1_000)
          }
          pior.maior = Math.max(pior.maior, maiorDaRodada); rodadasMaior.push(maiorDaRodada)
          t = Date.now()
          const r = (await a.query(`select public.obs_archive_detach_month($1, $2, $3, $4, 'clique', false) as r`, [site, alvo.tabela, MES, admin])).rows[0].r as { status: string; codigo?: string; mae_travada_ms?: number }
          const trava = Date.now() - t
          pior.travaDetach = Math.max(pior.travaDetach, trava)
          await a.query('reset role')
          expect(r, JSON.stringify(r)).toMatchObject({ status: 'ok' })
          pior.maeDetach = Math.max(pior.maeDetach, r.mae_travada_ms ?? Infinity)
          pior.ponta = Math.max(pior.ponta, inline + Math.ceil(somaConf / 4) + trava)
          t = Date.now()
          const rv = (await a.query(`select public.obs_archive_reattach_month($1, $2, $3, $4, false) as r`, [site, alvo.tabela, MES, admin])).rows[0].r as { status: string; mae_travada_ms?: number }
          pior.travaReattach = Math.max(pior.travaReattach, Date.now() - t)
          expect(rv, JSON.stringify(rv)).toMatchObject({ status: 'ok' })
          pior.maeReattach = Math.max(pior.maeReattach, rv.mae_travada_ms ?? Infinity)
        }
        // o tempo: melhor rodada, normalizada pela calibração da própria rodada
        const norm = Math.min(...rodadasMaior.map((m, i) => m / calibracoes[i]!))
        const maiorQuieto = norm * REF_QUIETA_MS
        const carregada = loadavg()[0]! > cpus().length
        const tempo = carregada ? 'nao_medido' : (maiorQuieto * FATOR < 4_000 ? 'ok' : 'estourou')
        console.log('[m6-corridas] CP13', JSON.stringify({ alvo: alvo.classe, canais, porCanal, ...pior, tempo, load1: Math.round(loadavg()[0]! * 10) / 10, cpus: cpus().length,
          calibracoes, rodadasMaior, maior_quieto_x_fator_ms: Math.round(maiorQuieto * FATOR), lidas_por_linha_da_particao_max: Math.round(pior.lidasPorLinha * 100) / 100,
          tally_horaria_ms: alvo.classe === 'horaria' ? Math.round(pior.inline * FATOR) : null, maior_conferencia_ms: Math.round(pior.maior * FATOR),
          ponta_x_fator_ms: Math.round(pior.ponta * FATOR + RTT), mae_travada_detach_x_fator_ms: Math.round(pior.maeDetach * FATOR), mae_travada_reattach_x_fator_ms: Math.round(pior.maeReattach * FATOR) }))
        if (carregada) console.warn('[m6-corridas] CP13: tempo NAO_MEDIDO (load1 acima do número de CPUs); o trabalho foi afirmado, o relógio não')
        else expect(maiorQuieto * FATOR, 'melhor de 3 rodadas, normalizada pela calibração').toBeLessThan(4_000)
        expect((pior.ponta * FATOR) + RTT).toBeLessThan(60_000)
        expect(pior.maeDetach * FATOR, 'mãe travada no detach (medida pela função)').toBeLessThan(2_000)
        expect(pior.maeReattach * FATOR, 'mãe travada no reattach (medida pela função)').toBeLessThan(2_000)
      }
    } finally {
      await a.query('reset role').catch(() => undefined)
      for (const c of outros) await apagarCanalDeclarando(a, site, c, admin).catch((e: Error) => console.error('[m6-corridas] limpeza falhou', e.message))
    }
  }, 600_000)
})
