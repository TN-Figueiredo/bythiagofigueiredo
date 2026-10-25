// @vitest-environment node
/**
 * A/B Lab S8-F4: validação por simulação. Semeia um teste `regra_duracao='v2'` no `bythiago_int`, escreve dia a dia
 * alcance/meta do canal (semente fixa, mulberry32), avança o relógio (fake Date) e roda o caminho real do cron:
 * rodarRetrato -> rodarDecisaoV2. O YouTube (settleOnAir), o Sentry e o cron-health são mocks; nada sai da máquina.
 * Banco: SÓ o bythiago_int:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-s8-f4-simulacao.test.ts --no-file-parallelism
 * Roteiro dos cenários: .superpowers/sdd/ab-lab/s8f4/simulacao-roteiro.md
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico, q, SUPABASE_URL } from '../helpers/db-seed'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/cron-health', () => ({ recordCronFailure: vi.fn(async () => undefined), recordCronSuccess: vi.fn(async () => undefined) }))
vi.mock('@/lib/youtube/ab-settle', async (orig) => {
  const m = await orig<typeof import('@/lib/youtube/ab-settle')>()
  return { ...m, settleOnAir: vi.fn() }
})

import * as Sentry from '@sentry/nextjs'
import { recordCronFailure } from '@/lib/cron-health'
import { settleOnAir } from '@/lib/youtube/ab-settle'
import { rodarRetrato } from '@/lib/youtube/ab-gravacao/retrato-step'
import { rodarDecisaoV2, type ResultadoDecisao } from '@/lib/youtube/ab-gravacao/decisao-v2-step'
import { tetoDoTesteV2, volumeMinimo } from '@/lib/youtube/ab-gravacao/decisao-v2'
import { getVariantForCycle } from '@/lib/youtube/ab-rotation'
import { addDays, boundsAnalytics, dayPt } from '@/lib/youtube/coleta/day-pt'

vi.setConfig({ testTimeout: 600_000, hookTimeout: 120_000 })

const HORA = 3_600_000
const D0 = addDays(dayPt(new Date()), -90) // dia 0 simulado: 90 dias atrás (os testes-semente de outras suítes nascem hoje e não geram linhas nessa janela)

// ---------------------------------------------------------------------------------------------
// Gerador determinístico
// ---------------------------------------------------------------------------------------------
function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function gauss(r: () => number): number {
  let u = 0
  while (u === 0) u = r()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r())
}

const diaIdx = (k: number) => addDays(D0, k)
const iniDia = (k: number) => boundsAnalytics(diaIdx(k)).start
const manha = (k: number) => new Date(iniDia(k) + 8 * HORA)

// ---------------------------------------------------------------------------------------------
// Semente e perfil
// ---------------------------------------------------------------------------------------------
interface Perfil {
  V: 2 | 3
  /** CTR verdadeiro por índice de variante (0 = original). */
  p: number[]
  /** impressões do dia para a variante `vi` no dia `d` */
  imp: (vi: number, d: number, r: () => number) => number
  /** dias de atraso do relatório no dia `k` (linha do dia d existe quando d <= k-1-lag) */
  lag: (k: number) => number
  /** dias sem linha de alcance para a variante 0 (original), por índice de dia */
  semLinha?: Set<number>
  /** sem 14 dias de base antes do início (base_estimada) */
  semBase?: boolean
  config?: Record<string, unknown>
  seed: number
}

interface Cena {
  testId: string; siteId: string; vid: string; canal: string
  vars: string[] // [original, B, (C)]
  perfil: Perfil
  rnd: () => number
  /** cycle_number do dia d (undefined = sem ciclo, ex.: pausa) */
  cicloDoDia: Map<number, number>
  cicloAberto: number | null
  proximoCiclo: number
  linhasAlcance: Set<number>
  ultimoDia: number
}

async function semear(perfil: Perfil): Promise<Cena> {
  const t = await semearTesteAb({ cicloAberto: null, status: 'active' })
  const [v] = await q<{ vid: string; canal: string }>(
    'select yv.youtube_video_id as vid, yv.channel_id as canal from ab_tests a join youtube_videos yv on yv.id = a.youtube_video_id where a.id = $1', [t.testId])
  const vars = [t.varA, t.varB]
  if (perfil.V === 3) {
    const [c] = await q<{ id: string }>("insert into ab_test_variants (test_id, label, is_original, sort_order) values ($1, 'C', false, 2) returning id", [t.testId])
    vars.push(c!.id)
  }
  const inicio = new Date(iniDia(0) + 12 * HORA).toISOString()
  const config = { rotation_pattern: 'abba', ...(perfil.config ?? {}) }
  await q("update ab_tests set regra_duracao = 'v2', started_at = $2, config = $3::jsonb where id = $1", [t.testId, inicio, JSON.stringify(config)])
  const cena: Cena = {
    testId: t.testId, siteId: t.siteId, vid: v!.vid, canal: v!.canal, vars, perfil, rnd: mulberry32(perfil.seed),
    cicloDoDia: new Map(), cicloAberto: null, proximoCiclo: 0, linhasAlcance: new Set(), ultimoDia: -1,
  }
  await abrirCiclo(cena, new Date(inicio).getTime(), 0) // ciclo 0: meio-dia do dia 0 (dia parcial, sem variante)
  if (!perfil.semBase) {
    for (let i = 14; i >= 1; i--) await inserirAlcance(cena, addDays(D0, -i), 3000, 0.04)
  }
  return cena
}

async function abrirCiclo(c: Cena, quando: number, dia: number): Promise<void> {
  const n = c.proximoCiclo++
  const vi = getVariantForCycle(c.perfil.V, n)
  await q('insert into ab_test_cycles (test_id, variant_id, cycle_number, started_at) values ($1, $2, $3, $4)', [c.testId, c.vars[vi], n, new Date(quando).toISOString()])
  c.cicloAberto = n
  c.cicloDoDia.set(dia, n)
}

async function fecharCicloAberto(c: Cena, quando: number): Promise<void> {
  await q('update ab_test_cycles set ended_at = $2 where test_id = $1 and ended_at is null', [c.testId, new Date(quando).toISOString()])
  c.cicloAberto = null
}

async function inserirAlcance(c: Cena, day: string, imp: number, ctr: number): Promise<void> {
  await q(`insert into yt_own_video_reach_daily (youtube_video_id, day_pt, site_id, channel_id, thumbnail_impressions, thumbnail_ctr, source_report_id, report_create_time, source, collected_at, metric_version)
           values ($1, $2, $3, $4, $5, $6, 'rep-sim', now(), 'reporting_api', now(), 'views_desde_2026-08-27') on conflict (youtube_video_id, day_pt) do update set thumbnail_impressions = excluded.thumbnail_impressions, thumbnail_ctr = excluded.thumbnail_ctr`,
  [c.vid, day, c.siteId, c.canal, imp, ctr])
}

function variantDoDia(c: Cena, d: number): number | null {
  const n = c.cicloDoDia.get(d)
  return n === undefined ? null : getVariantForCycle(c.perfil.V, n)
}

/** Escreve o que o YouTube teria até a manhã do dia k: meta de ontem e alcance dos dias que já saíram do atraso. */
async function escreverDados(c: Cena, k: number): Promise<void> {
  const ontem = k - 1
  if (ontem >= 0 && variantDoDia(c, ontem) !== null) {
    const vi = variantDoDia(c, ontem)!
    const dia = diaIdx(ontem)
    const b = boundsAnalytics(dia)
    const seg = ontem === 0 ? 12 * 3600 : (b.end - b.start) / 1000 - 300
    await q(`insert into yt_own_video_meta_daily (youtube_video_id, day_pt, site_id, channel_id, ab_test_id, ab_variant_id, seconds_on_air_analytics, captured_at)
             values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict (youtube_video_id, day_pt) do nothing`,
    [c.vid, dia, c.siteId, c.canal, c.testId, c.vars[vi], seg, manha(k).toISOString()])
  }
  const lim = k - 1 - c.perfil.lag(k)
  for (let d = c.ultimoDia + 1; d <= lim; d++) {
    c.ultimoDia = d
    const vi = variantDoDia(c, d)
    if (vi === null) continue // dia sem ciclo (pausa): o YouTube não tem o que reportar para o teste
    if (vi === 0 && c.perfil.semLinha?.has(d)) continue
    const imp = Math.max(1, Math.round(c.perfil.imp(vi, d, c.rnd)))
    const p = c.perfil.p[vi]!
    const cliques = Math.min(imp, Math.max(0, Math.round(imp * p + Math.sqrt(imp * p * (1 - p)) * gauss(c.rnd))))
    await inserirAlcance(c, diaIdx(d), imp, cliques / imp)
    c.linhasAlcance.add(d)
  }
}

// ---------------------------------------------------------------------------------------------
// Laço do relógio
// ---------------------------------------------------------------------------------------------
interface Foto {
  k: number; status: string; v2: Record<string, any> | null; decisao: ResultadoDecisao // eslint-disable-line @typescript-eslint/no-explicit-any
}

async function ler(testId: string): Promise<{ status: string; completed_at: string | null; completed_reason: string | null; v2: Record<string, any> | null; winner: string | null }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const [r] = await q<{ status: string; completed_at: Date | null; completed_reason: string | null; v2: Record<string, any> | null; winner: string | null }>( // eslint-disable-line @typescript-eslint/no-explicit-any
    "select status, completed_at, completed_reason, result_metadata->'v2' as v2, winner_variant_id as winner from ab_tests where id = $1", [testId])
  return { ...r!, completed_at: r!.completed_at ? r!.completed_at.toISOString() : null }
}

interface Eventos {
  /** executado ANTES do ciclo/dados do dia k (pausa, retomada) */
  antes?: (k: number, c: Cena) => Promise<'pular_ciclo' | void>
}

async function simular(c: Cena, de: number, ate: number, ev: Eventos = {}): Promise<Foto[]> {
  const sb = clienteServico()
  const fotos: Foto[] = []
  for (let k = de; k <= ate; k++) {
    vi.setSystemTime(manha(k))
    const r = k > 0 ? await ev.antes?.(k, c) : undefined
    const atual = await ler(c.testId)
    if (k > 0 && r !== 'pular_ciclo' && atual.status === 'active' && c.cicloDoDia.get(k) === undefined) {
      await fecharCicloAberto(c, iniDia(k) + 5 * 60_000)
      await abrirCiclo(c, iniDia(k) + 5 * 60_000, k)
    }
    await escreverDados(c, k)
    const agora = new Date()
    const ret = await rodarRetrato(sb, agora)
    expect(ret.status === 'error' ? ret.error : 'ok', `retrato no dia ${k}`).toBe('ok')
    const entradas = ret.status === 'ok' ? ret.entradas : undefined
    const decisao = await rodarDecisaoV2(sb, agora, entradas, Date.now())
    const x = await ler(c.testId)
    fotos.push({ k, status: x.status, v2: x.v2, decisao })
  }
  return fotos
}

// ---------------------------------------------------------------------------------------------
// Perfis prontos
// ---------------------------------------------------------------------------------------------
const impFixa = (n: number) => (_vi: number, _d: number, r: () => number): number => n * (0.9 + 0.2 * r())
const lagFixo = (n: number) => () => n

const ctrOrig = 0.04

// v1 ao lado, para provar que a regra nova não toca o que é antigo
async function semearV1(): Promise<{ testId: string; antes: unknown }> {
  const t = await semearTesteAb({ status: 'active', cicloAberto: 0 })
  const antes = await q("select status, completed_at, completed_reason, result_metadata, config, regra_duracao, winner_variant_id from ab_tests where id = $1", [t.testId])
  return { testId: t.testId, antes }
}
async function conferirV1(v1: { testId: string; antes: unknown }): Promise<void> {
  const depois = await q("select status, completed_at, completed_reason, result_metadata, config, regra_duracao, winner_variant_id from ab_tests where id = $1", [v1.testId])
  expect(depois).toEqual(v1.antes)
  expect(settleOnAir).not.toHaveBeenCalledWith(v1.testId, expect.anything())
}

let fetchOriginal: typeof fetch
const idsSemeados: string[] = []

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  fetchOriginal = globalThis.fetch
  // nada de rede real: só o Supabase local passa
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
    // Só o Supabase local em uso (54421 no bythiago_int, 54321 na CI) passa; o resto é rede externa.
    if (!url.startsWith(`${new URL(SUPABASE_URL).origin}/`)) throw new Error(`rede externa bloqueada na simulação: ${url}`)
    return fetchOriginal(input, init)
  }) as typeof fetch
})

afterAll(async () => {
  globalThis.fetch = fetchOriginal
  vi.useRealTimers()
  for (const id of idsSemeados) await q('delete from ab_tests where id = $1', [id]).catch(() => undefined)
})

beforeEach(() => {
  vi.mocked(Sentry.captureException).mockClear()
  vi.mocked(Sentry.captureMessage).mockClear()
  vi.mocked(recordCronFailure).mockClear()
  vi.mocked(settleOnAir).mockReset()
  vi.mocked(settleOnAir).mockImplementation(async (testId: string) => {
    const s = clienteServico()
    const r = await s.rpc('ab_settle_claim', { p_test_id: testId, p_seq: 0, p_de: ['active'], p_para: 'completed', p_end_reason: 'regra_v2', p_restore_status: {}, p_extra: { completed_reason: 'regra_v2' } })
    if (r.error) throw new Error(r.error.message)
    const agora = new Date().toISOString() // relógio simulado
    await q("update ab_tests set completed_at = $2 where id = $1", [testId, agora])
    await q("update ab_test_cycles set ended_at = $2 where test_id = $1 and end_reason = 'regra_v2'", [testId, agora])
    return { resultado: 'feito', campos: {} } as never
  })
})

function primeiroEncerramento(fotos: Foto[]): Foto | undefined {
  return fotos.find((f) => f.v2?.desfecho !== undefined && f.v2?.desfecho !== null)
}

async function comTeste(c: Cena): Promise<Cena> { idsSemeados.push(c.testId); return c }

describe.skipIf(skipIfNoLocalDb())('S8-F4 simulação dos desfechos v2 (banco local, YouTube mockado)', () => {
  it('S1 vencedor claro, V=2 (+30%): vencedor_provavel no teto (dia 15), sugere a B, vira final sem repetir histórico', async () => {
    const c = await comTeste(await semear({ V: 2, p: [ctrOrig, ctrOrig * 1.3], imp: impFixa(4000), lag: lagFixo(3), seed: 101 }))
    const v1 = await semearV1()
    expect(tetoDoTesteV2(undefined, 2)).toBe(15)
    const fotos = await simular(c, 0, 27)
    const enc = primeiroEncerramento(fotos)!
    expect(enc.k).toBe(15) // relogio = teto na manhã do dia 15; antes disso "segue até o teto" (ENCERRA_AO_FECHAR_PISOS = false)
    expect(fotos.filter((f) => f.k >= 1 && f.k < 15).every((f) => f.status === 'active' && f.v2?.ultima_avaliacao?.acao === 'seguir')).toBe(true)
    // N congelado no 1º dia, p1 medido da base (14 dias x 3000, 4%)
    const f1 = fotos[1]!.v2!
    expect(f1.base_estimada).toBe(false)
    expect(f1.n).toBe(volumeMinimo(f1.p1, 2))
    expect(f1.p1).toBeCloseTo(0.04, 2)
    const v2 = enc.v2!
    expect(v2).toMatchObject({ desfecho: 'vencedor_provavel', vencedor_sugerido: c.vars[1], desfecho_no_encerramento: 'vencedor_provavel', encerrado_em_dia: diaIdx(14), n: f1.n })
    expect(v2.p_adj).toBeLessThan(0.05)
    expect(v2.historico).toHaveLength(1)
    const fim = await ler(c.testId)
    expect(fim).toMatchObject({ status: 'completed', completed_reason: 'regra_v2', winner: null })
    expect(settleOnAir).toHaveBeenCalledTimes(1)
    expect(settleOnAir).toHaveBeenCalledWith(c.testId, expect.objectContaining({ motivo: 'regra_v2', destino: { tipo: 'original' }, siteId: c.siteId }))
    // vira final: provisorio=false, desfecho_final, histórico sem entrada repetida
    const ult = fotos[fotos.length - 1]!.v2!
    expect(ult).toMatchObject({ provisorio: false, desfecho_final: 'vencedor_provavel', desfecho: 'vencedor_provavel' })
    expect(ult.finalizado_por_prazo).toBeUndefined()
    const hist = ult.historico as Array<{ desfecho: string }>
    expect(hist.every((h, i) => i === 0 || h.desfecho !== hist[i - 1]!.desfecho)).toBe(true)
    expect(JSON.stringify(ult)).not.toMatch(/NaN|Infinity/)
    expect(Sentry.captureException).not.toHaveBeenCalled()
    await conferirV1(v1)
  })

  it('S2 vencedor claro, V=3 (C +30%): vencedor_provavel no teto 17 sugerindo a C, alfa 0,025', async () => {
    const c = await comTeste(await semear({ V: 3, p: [ctrOrig, ctrOrig, ctrOrig * 1.3], imp: impFixa(5000), lag: lagFixo(3), seed: 202 }))
    const v1 = await semearV1()
    expect(tetoDoTesteV2(undefined, 3)).toBe(17)
    const fotos = await simular(c, 0, 18)
    const enc = primeiroEncerramento(fotos)!
    expect(enc.k).toBe(17)
    expect(enc.v2).toMatchObject({ desfecho: 'vencedor_provavel', vencedor_sugerido: c.vars[2], encerrado_em_dia: diaIdx(16) })
    const pv = enc.v2!.por_variante as Array<{ variant_id: string; alfa: number; passa: boolean }>
    expect(pv).toHaveLength(2)
    expect(pv.every((x) => x.alfa === 0.025)).toBe(true)
    expect(pv.find((x) => x.variant_id === c.vars[2])!.passa).toBe(true)
    expect(pv.find((x) => x.variant_id === c.vars[1])!.passa).toBe(false)
    expect(enc.v2!.n).toBe(volumeMinimo(enc.v2!.p1, 3))
    expect(enc.v2!.historico).toHaveLength(1)
    expect((await ler(c.testId)).status).toBe('completed')
    expect(settleOnAir).toHaveBeenCalledTimes(1)
    await conferirV1(v1)
  })

  it('S3 sem diferença detectável com volume cheio: sem_diferenca_detectavel no dia 15, sem sugestão', async () => {
    const c = await comTeste(await semear({ V: 2, p: [ctrOrig, ctrOrig], imp: impFixa(4000), lag: lagFixo(3), seed: 303 }))
    const v1 = await semearV1()
    const fotos = await simular(c, 0, 16)
    const enc = primeiroEncerramento(fotos)!
    expect(enc.k).toBe(15)
    expect(enc.v2).toMatchObject({ desfecho: 'sem_diferenca_detectavel', vencedor_sugerido: null, encerrado_em_dia: diaIdx(14) })
    const vol = enc.v2!.ultima_avaliacao.volume as Record<string, number>
    expect(Object.values(vol).every((x) => x >= enc.v2!.n)).toBe(true) // o piso de volume fechou
    expect((await ler(c.testId)).status).toBe('completed')
    await conferirV1(v1)
  })

  it('S4 inconclusivo por volume (canal de hoje, 1 a 4 impressões por dia): inconclusivo_por_volume no teto', async () => {
    const c = await comTeste(await semear({ V: 2, p: [0.05, 0.05], imp: (_v, _d, r) => 1 + Math.floor(r() * 4), lag: lagFixo(3), semBase: true, seed: 404 }))
    const v1 = await semearV1()
    const fotos = await simular(c, 0, 16)
    const f1 = fotos[1]!.v2!
    expect(f1).toMatchObject({ base_estimada: true, p1: 0.04, n: volumeMinimo(0.04, 2) })
    const enc = primeiroEncerramento(fotos)!
    expect(enc.k).toBe(15)
    expect(enc.v2).toMatchObject({ desfecho: 'inconclusivo_por_volume', vencedor_sugerido: null })
    const dv = enc.v2!.ultima_avaliacao.dias_validos as Record<string, number>
    expect(Object.values(dv).every((x) => x >= 4)).toBe(true) // dias não faltaram: faltou volume
    expect((await ler(c.testId)).status).toBe('completed')
    await conferirV1(v1)
  })

  it('S5 inconclusivo por dado (V=3, teto 17, folga 0, um dia final da original sem linha): inconclusivo_por_dado', async () => {
    // original = ciclos 5,6,11,12 dentro do teto 17 (folga 0). Sem a linha do dia 5, ela fica com 3 dias válidos.
    const c = await comTeste(await semear({ V: 3, p: [ctrOrig, ctrOrig, ctrOrig], imp: impFixa(5000), lag: lagFixo(3), semLinha: new Set([5]), seed: 505 }))
    const v1 = await semearV1()
    const fotos = await simular(c, 0, 18)
    const enc = primeiroEncerramento(fotos)!
    expect(enc.k).toBe(17)
    expect(enc.v2).toMatchObject({ desfecho: 'inconclusivo_por_dado', vencedor_sugerido: null, encerrado_em_dia: diaIdx(16) })
    const dv = enc.v2!.ultima_avaliacao.dias_validos as Record<string, number>
    expect(dv[c.vars[0]!]).toBe(3)
    expect(dv[c.vars[1]!]).toBeGreaterThanOrEqual(4)
    expect(dv[c.vars[2]!]).toBeGreaterThanOrEqual(4)
    await conferirV1(v1)
  })

  it('S6 atraso do YouTube (2 a 3 dias, ATRASO_ALCANCE=3): os pisos fecham cedo, mas a decisão só fecha no teto', async () => {
    const c = await comTeste(await semear({ V: 2, p: [ctrOrig, ctrOrig * 1.3], imp: impFixa(4000), lag: (k) => (k % 2 === 0 ? 2 : 3), seed: 606 }))
    const v1 = await semearV1()
    const fotos = await simular(c, 0, 16)
    const cedo = fotos.find((f) => f.k < 15 && f.v2?.ultima_avaliacao && Object.values(f.v2.ultima_avaliacao.dias_validos as Record<string, number>).every((x) => x >= 4) && Object.values(f.v2.ultima_avaliacao.volume as Record<string, number | null>).every((x) => (x ?? 0) >= f.v2!.n))
    expect(cedo, 'os pisos de dias e volume fecham antes do teto').toBeDefined()
    expect(fotos.filter((f) => f.k >= 1 && f.k < 15).every((f) => f.status === 'active' && f.v2?.ultima_avaliacao?.acao === 'seguir' && f.v2?.desfecho === undefined)).toBe(true)
    // o atraso aparece: a cada manhã faltam as últimas 2 a 3 dias do relógio
    for (const f of fotos.filter((x) => x.k >= 6 && x.k < 15)) {
      const ua = f.v2!.ultima_avaliacao
      const validos = Object.values(ua.dias_validos as Record<string, number>).reduce((a, b) => a + b, 0)
      expect(validos).toBeLessThanOrEqual(ua.dias_relogio - 3)
    }
    const enc = primeiroEncerramento(fotos)!
    expect(enc.k).toBe(15)
    expect(enc.v2).toMatchObject({ desfecho: 'vencedor_provavel', vencedor_sugerido: c.vars[1], encerrado_em_dia: diaIdx(14) })
    expect(settleOnAir).toHaveBeenCalledTimes(1)
    await conferirV1(v1)
  })

  it('S7 atraso de 7 dias (maior que o folga do teto): aguardando_alcance no teto, sem sugestão', async () => {
    const c = await comTeste(await semear({ V: 2, p: [ctrOrig, ctrOrig * 1.3], imp: impFixa(4000), lag: lagFixo(7), seed: 707 }))
    const v1 = await semearV1()
    const fotos = await simular(c, 0, 16)
    const enc = primeiroEncerramento(fotos)!
    expect(enc.k).toBe(15)
    expect(enc.v2).toMatchObject({ desfecho: 'aguardando_alcance', vencedor_sugerido: null })
    expect(enc.v2!.provisorio).toBe(true) // os dias de atraso ainda não são finais
    await conferirV1(v1)
  })

  it('S8 teste pausado no meio e retomado: o relógio não conta os dias pausados e a avaliação não roda pausado', async () => {
    const P = 6, R = 9
    const c = await comTeste(await semear({ V: 2, p: [ctrOrig, ctrOrig * 1.3], imp: impFixa(4000), lag: lagFixo(3), seed: 808 }))
    const v1 = await semearV1()
    const ev: Eventos = {
      antes: async (k, cena) => {
        if (k === P) {
          await fecharCicloAberto(cena, iniDia(P)) // a pausa fecha o ciclo na virada do dia: o dia P não tem ciclo
          await q("update ab_tests set status = 'paused', paused_at = $2 where id = $1", [cena.testId, new Date(iniDia(P)).toISOString()])
          return 'pular_ciclo'
        }
        if (k > P && k < R) return 'pular_ciclo'
        if (k === R) await q("update ab_tests set status = 'active', paused_at = null where id = $1", [cena.testId])
      },
    }
    const fotos = await simular(c, 0, 19, ev)
    const antesPausa = fotos[P - 1]!.v2!.ultima_avaliacao
    for (let k = P; k < R; k++) {
      const f = fotos[k]!
      expect(f.status).toBe('paused')
      expect(f.v2!.ultima_avaliacao.em).toBe(antesPausa.em) // pausado não é avaliado
    }
    expect(fotos[R]!.status).toBe('active')
    const enc = primeiroEncerramento(fotos)!
    expect(enc.k).toBe(15 + (R - P)) // 15 dias com ciclo: a pausa empurra o teto 3 dias
    expect(enc.v2).toMatchObject({ desfecho: 'vencedor_provavel', vencedor_sugerido: c.vars[1], encerrado_em_dia: diaIdx(enc.k - 1) })
    expect(enc.v2!.ultima_avaliacao.dias_relogio).toBe(15)
    expect(settleOnAir).toHaveBeenCalledTimes(1)
    await conferirV1(v1)
  })

  it('S9 teto sem config: 15 com 2 variantes, 17 com 3 (config vazia), e max_duration_days explícito vale', async () => {
    expect(tetoDoTesteV2({}, 2)).toBe(15)
    expect(tetoDoTesteV2({}, 3)).toBe(17)
    expect(tetoDoTesteV2({ max_duration_days: 14 }, 2)).toBe(14)
    const c2 = await comTeste(await semear({ V: 2, p: [ctrOrig, ctrOrig], imp: impFixa(4000), lag: lagFixo(3), seed: 909, config: {} }))
    const c3 = await comTeste(await semear({ V: 3, p: [ctrOrig, ctrOrig, ctrOrig], imp: impFixa(5000), lag: lagFixo(3), seed: 910, config: {} }))
    const cx = await comTeste(await semear({ V: 2, p: [ctrOrig, ctrOrig], imp: impFixa(4000), lag: lagFixo(3), seed: 911, config: { max_duration_days: 13 } }))
    const cfg = await q<{ config: Record<string, unknown> }>('select config from ab_tests where id = $1', [c2.testId])
    expect(cfg[0]!.config.max_duration_days).toBeUndefined() // a semente padrão trazia 14: aqui some
    const v1 = await semearV1()
    // os três testes andam no mesmo relógio, na mesma rodada do cron
    const sb = clienteServico()
    const encerrou: Record<string, number> = {}
    for (let k = 0; k <= 18; k++) {
      vi.setSystemTime(manha(k))
      for (const c of [c2, c3, cx]) {
        const at = await ler(c.testId)
        if (k > 0 && at.status === 'active') { await fecharCicloAberto(c, iniDia(k) + 5 * 60_000); await abrirCiclo(c, iniDia(k) + 5 * 60_000, k) }
        await escreverDados(c, k)
      }
      const agora = new Date()
      const ret = await rodarRetrato(sb, agora)
      await rodarDecisaoV2(sb, agora, ret.status === 'ok' ? ret.entradas : undefined, Date.now())
      for (const [nome, c] of [['c2', c2], ['c3', c3], ['cx', cx]] as const) {
        const x = await ler(c.testId)
        if (x.v2?.desfecho && encerrou[nome] === undefined) encerrou[nome] = k
      }
    }
    expect(encerrou).toEqual({ c2: 15, c3: 17, cx: 13 })
    await conferirV1(v1)
  })

  it('S10 gravação idempotente: rodar a decisão duas vezes no mesmo dia não repete historico nem muda n', async () => {
    const c = await comTeste(await semear({ V: 2, p: [ctrOrig, ctrOrig * 1.3], imp: impFixa(4000), lag: lagFixo(3), seed: 1010 }))
    const fotos = await simular(c, 0, 15)
    const enc = fotos[15]!
    expect(enc.v2!.desfecho).toBe('vencedor_provavel')
    const sb = clienteServico()
    const agora = new Date()
    const ret = await rodarRetrato(sb, agora)
    await rodarDecisaoV2(sb, agora, ret.status === 'ok' ? ret.entradas : undefined, Date.now())
    const depois = await ler(c.testId)
    expect(depois.v2!.historico).toHaveLength(1)
    expect(depois.v2!.n).toBe(enc.v2!.n)
    expect(depois.v2!.encerrado_em_dia).toBe(enc.v2!.encerrado_em_dia)
    expect(settleOnAir).toHaveBeenCalledTimes(1)
  })
})
