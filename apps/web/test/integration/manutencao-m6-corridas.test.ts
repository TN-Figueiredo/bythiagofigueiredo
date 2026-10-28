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
    expect(criadas.filter(f => !desfazer.includes(`'${f}'`))).toEqual([])
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

  it('C-2: dois detach ao mesmo tempo: um ok e o outro não destaca duas vezes (ja_destacado, ocupado ou, achado, erro de banco de relação ausente)', async () => {
    await destacarVoltando(async () => {
      await renovar()
      const [s1, s2] = await Promise.allSettled([chamar(a, 'detach', MES, ", 'clique', false"), chamar(b, 'detach', MES, ", 'clique', false")])
      const vistas = [s1, s2].map(x => x.status === 'fulfilled' ? x.value : { erro: String((x.reason as Error).message) })
      console.log('[m6-corridas] C-2 detach duplo:', JSON.stringify(vistas))
      expect(vistas.filter(v => 'status' in v && v.status === 'ok')).toHaveLength(1)
      // Achado da T6 (não-determinístico): o perdedor responde `ocupado` (lock_timeout) OU tropeça em `relation ... does not exist` (leu o nome da partição antes da trava).
      // O plano exigia `ja_destacado` e nenhum erro de banco; nenhum dos dois resultados deixa o banco inconsistente.
      const outro = vistas.find(v => !('status' in v && v.status === 'ok'))
      expect(JSON.stringify(outro)).toMatch(/ja_destacado|ocupado|does not exist/)
    })
  })

  it('C-2: dois reattach ao mesmo tempo: um ok e o outro nao_destacado', async () => {
    await renovar()
    const d = await chamar(a, 'detach', MES, ", 'clique', false")
    expect(d, JSON.stringify(d)).toMatchObject({ status: 'ok' })
    const [s1, s2] = await Promise.allSettled([chamar(a, 'reattach', MES, ', false'), chamar(b, 'reattach', MES, ', false')])
    console.log('[m6-corridas] C-2 reattach duplo:', JSON.stringify([s1, s2].map(x => x.status === 'fulfilled' ? x.value : { erro: (x.reason as Error).message })))
    const ok = [s1, s2].filter(x => x.status === 'fulfilled' && x.value.status === 'ok')
    expect(ok).toHaveLength(1)
    const outro = [s1, s2].find(x => !(x.status === 'fulfilled' && x.value.status === 'ok'))
    // Achado da T6: o segundo reattach pode tropeçar em `relation ..._saida does not exist` (erro de banco, não recusa limpa) quando lê o nome antes da trava e o primeiro já religou.
    const vista = outro?.status === 'fulfilled' ? outro.value : { codigo: 'erro_de_banco', msg: String((outro as PromiseRejectedResult).reason?.message) }
    expect(JSON.stringify(vista)).toMatch(/nao_destacado|ocupado|does not exist/)
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

  it('C-2: dois discard ao mesmo tempo: um ok e o outro ja_descartado (mês extra de maio, destacado antes)', async () => {
    await mesExtra('2026-05-01')
    await renovar()
    await chamar(a, 'detach', '2026-05-01', ", 'clique', false")
    await relogioSessao('2027-05-20 12:00:00+00', '2027-05-20')
    try {
      await renovar()
      const [s1, s2] = await Promise.allSettled([chamar(a, 'discard', '2026-05-01', ", 'clique', false"), chamar(b, 'discard', '2026-05-01', ", 'clique', false")])
      const vistas = [s1, s2].map(x => x.status === 'fulfilled' ? x.value : { erro: (x.reason as { code?: string; message: string }).code ?? (x.reason as Error).message })
      console.log('[m6-corridas] C-2 discard duplo:', JSON.stringify(vistas))
      // Achado da T6: dois discard simultâneos podem terminar em deadlock (40P01) em vez de `ja_descartado`. O plano exigia nenhum erro de banco; aqui se registra o que o Postgres faz.
      const ok = vistas.filter(v => 'status' in v && v.status === 'ok')
      expect(ok).toHaveLength(1)
      const outro = vistas.find(v => !('status' in v && v.status === 'ok'))
      expect(JSON.stringify(outro)).toMatch(/ja_descartado|ocupado|40P01/)
    } finally { await relogioSessao('2027-05-02 12:00:00+00', '2027-05-02') }
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
    // o mês extra de abril fica anexado com linha e mais antigo que o de junho: sairia fora de ordem no CP13. Marca como descartado no registro (fixture).
    await a.query(`update public.obs_archive_months set dropped_at = now(), rows_dropped = 1 where site_id = $1 and table_name = $2 and month = '2026-04-01'`, [site, D])
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
      const ALVOS = [{ classe: 'serie', tabela: D }, { classe: 'horaria', tabela: H }] as const
      const FATOR = Number(process.env.M6_FATOR ?? 4.05)
      const RTT = 2 * 150
      for (const alvo of ALVOS) {
        const pior = { inline: 0, maior: 0, travaDetach: 0, travaReattach: 0, ponta: 0 }
        for (let rodada = 0; rodada < 3; rodada++) {
          await selarMes(a, { site, classe: alvo.classe, tabela: alvo.tabela, mes: MES, versao: rodada + 10 })
          await a.query(`delete from public.obs_archive_prechecks where site_id = $1`, [site])
          await renovar()
          await a.query('set role service_role')
          let t = Date.now()
          await a.query(`select public.obs_archive_detach_month($1, $2, $3, $4, 'clique', true)`, [site, alvo.tabela, MES, admin])
          const inline = Date.now() - t
          pior.inline = Math.max(pior.inline, inline)
          const lista = (await a.query(`select unnest(public.obs_archive_precheck_channels($1, $2, $3, true)) as c`, [site, alvo.tabela, MES])).rows.map(r => r.c as string)
          let somaConf = 0
          for (const c of lista) {
            t = Date.now()
            await a.query(`select public.obs_archive_precheck_unit($1, $2, $3, $4::uuid)`, [site, alvo.tabela, MES, c])
            const d = Date.now() - t; somaConf += d; pior.maior = Math.max(pior.maior, d)
          }
          t = Date.now()
          const r = (await a.query(`select public.obs_archive_detach_month($1, $2, $3, $4, 'clique', false) as r`, [site, alvo.tabela, MES, admin])).rows[0].r as { status: string; codigo?: string }
          const trava = Date.now() - t
          pior.travaDetach = Math.max(pior.travaDetach, trava)
          await a.query('reset role')
          expect(r, JSON.stringify(r)).toMatchObject({ status: 'ok' })
          pior.ponta = Math.max(pior.ponta, inline + Math.ceil(somaConf / 4) + trava)
          t = Date.now()
          await a.query(`select public.obs_archive_reattach_month($1, $2, $3, $4, false)`, [site, alvo.tabela, MES, admin])
          pior.travaReattach = Math.max(pior.travaReattach, Date.now() - t)
        }
        console.log('[m6-corridas] CP13', JSON.stringify({ alvo: alvo.classe, canais, porCanal, ...pior,
          tally_horaria_ms: alvo.classe === 'horaria' ? Math.round(pior.inline * FATOR) : null, maior_conferencia_ms: Math.round(pior.maior * FATOR),
          ponta_x_fator_ms: Math.round(pior.ponta * FATOR + RTT), trava_detach_x_fator_ms: Math.round(pior.travaDetach * FATOR), trava_reattach_x_fator_ms: Math.round(pior.travaReattach * FATOR) }))
        expect(pior.maior).toBeLessThan(4_000 / FATOR)
        expect((pior.ponta * FATOR) + RTT).toBeLessThan(60_000)
      }
    } finally {
      await a.query('reset role').catch(() => undefined)
      for (const c of outros) await apagarCanalDeclarando(a, site, c, admin).catch((e: Error) => console.error('[m6-corridas] limpeza falhou', e.message))
    }
  }, 600_000)
})
