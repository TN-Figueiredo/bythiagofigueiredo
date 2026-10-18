// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const sentry = vi.hoisted(() => ({ captureMessage: vi.fn() }))
vi.mock('@sentry/nextjs', () => sentry)
const saude = vi.hoisted(() => ({ recordCronFailure: vi.fn(), recordCronSuccess: vi.fn() }))
vi.mock('@/lib/cron-health', () => saude)
const espiao = vi.hoisted(() => ({ montar: vi.fn() }))
vi.mock('@/lib/youtube/ab-gravacao/retrato', async (orig) => {
  const real = await orig<typeof import('@/lib/youtube/ab-gravacao/retrato')>()
  espiao.montar.mockImplementation(real.montarRetrato)
  return { ...real, montarRetrato: espiao.montar }
})

import { rodarRetrato } from '@/lib/youtube/ab-gravacao/retrato-step'
import { janelaDesde } from '@/lib/youtube/ab-gravacao/retrato'
import { addDays, ontemPt } from '@/lib/youtube/coleta/day-pt'
import { criarFakeSb, type Linha } from '../../helpers/fake-sb-gravacao'

const VID = 'abcdefghijk'
const DIA_MS = 86_400_000
const agora = () => new Date()
const ha = (d: number) => new Date(Date.now() - d * DIA_MS).toISOString()

function teste(id: string, o: Linha = {}): Linha {
  return {
    id, site_id: 's1', status: 'active', test_type: 'thumbnail', regra_duracao: 'v1', paused_at: null, completed_at: null,
    original_title: null, started_at: ha(5), youtube_videos: { youtube_video_id: VID, channel_id: 'ch1' }, ...o,
  }
}
function ciclo(testId: string, inicio: string, fim: string | null = null, n = 1): Linha {
  return { id: `c-${testId}-${n}`, test_id: testId, variant_id: 'v-a', started_at: inicio, ended_at: fim, applied_metadata: null }
}
function aberta(testId: string, day: string): Linha {
  return { test_id: testId, day_pt: day, final: false }
}
function rpc(f: ReturnType<typeof criarFakeSb>, nome: string) { return f.rpcs.filter((r) => r.nome === nome) }
function linhasApply(f: ReturnType<typeof criarFakeSb>): Array<Record<string, unknown>> {
  return rpc(f, 'ab_test_dias_apply').flatMap((r) => r.args.p_rows as Array<Record<string, unknown>>)
}

beforeEach(() => { vi.clearAllMocks() })

describe('rodarRetrato: carga em lote e falhas', () => {
  it('leitura de yt_reporting_reports com erro: nada é escrito e a falha é registrada', async () => {
    const f = criarFakeSb({ ab_tests: [teste('t1')], ab_test_cycles: [ciclo('t1', ha(5))] })
    f.erros.yt_reporting_reports = 'boom'
    const r = await rodarRetrato(f.sb, agora())
    expect(r).toMatchObject({ status: 'error', health_written: true })
    expect(f.rpcs).toHaveLength(0)
    expect(saude.recordCronFailure).toHaveBeenCalledWith('ab-retrato', expect.stringContaining('yt_reporting_reports'))
  })

  it('com 3 testes faz no máximo 10 consultas lógicas (lote, não por teste)', async () => {
    const f = criarFakeSb({
      ab_tests: [teste('t1'), teste('t2'), teste('t3')],
      ab_test_cycles: [ciclo('t1', ha(5)), ciclo('t2', ha(5)), ciclo('t3', ha(5))],
    })
    const r = await rodarRetrato(f.sb, agora())
    expect(r.status).toBe('ok')
    expect(f.consultasLogicas()).toBeLessThanOrEqual(10)
    expect(linhasApply(f).length).toBeGreaterThan(0)
  })

  it('sondas: 1.000 na primeira página e 500 na segunda chegam inteiras ao montarRetrato', async () => {
    const sondas: Linha[] = Array.from({ length: 1500 }, (_, i) => ({
      test_id: 't1', hora: new Date(Date.now() - (i + 1) * 60_000).toISOString(), lida_em: new Date(Date.now() - (i + 1) * 60_000).toISOString(),
      leitura_estado: 'bate', variante_vista: 'v-a',
    }))
    const f = criarFakeSb({ ab_tests: [teste('t1')], ab_test_cycles: [ciclo('t1', ha(5))], ab_test_sondas: sondas })
    await rodarRetrato(f.sb, agora())
    const entradas = espiao.montar.mock.calls[0]![0] as { sondasPorTesteDia: Map<string, unknown[]> }
    const total = [...entradas.sondasPorTesteDia.values()].reduce((s, l) => s + l.length, 0)
    expect(total).toBe(1500)
  })

  it('sondas acima do teto: falha registrada e rpc nunca chamado', async () => {
    const sondas: Linha[] = Array.from({ length: 20_001 }, (_, i) => ({ test_id: 't1', hora: new Date(Date.now() - i * 1000).toISOString(), lida_em: ha(1), leitura_estado: 'bate', variante_vista: 'v-a' }))
    const f = criarFakeSb({ ab_tests: [teste('t1')], ab_test_cycles: [ciclo('t1', ha(5))], ab_test_sondas: sondas })
    const r = await rodarRetrato(f.sb, agora())
    expect(r.status).toBe('error')
    expect(f.rpcs).toHaveLength(0)
    expect(saude.recordCronFailure).toHaveBeenCalledWith('ab-retrato', expect.stringContaining('ab_test_sondas'))
  })

  it('zero teste e zero linha aberta: ok, sem escrita', async () => {
    const f = criarFakeSb({})
    const r = await rodarRetrato(f.sb, agora())
    expect(r).toMatchObject({ status: 'ok', testes: 0, linhas: 0 })
    expect(f.rpcs).toHaveLength(0)
  })
})

describe('rodarRetrato: janela de leitura (B2 e N1)', () => {
  it('B2: teste pausado iniciado há 45 dias: nenhuma linha antes de janelaDesde e fechar_antigas com a constante', async () => {
    const desde = janelaDesde(ontemPt(agora()))
    const f = criarFakeSb({
      ab_tests: [teste('t1', { status: 'paused', started_at: ha(45), paused_at: ha(20) })],
      ab_test_cycles: [ciclo('t1', ha(45), ha(20))],
    })
    await rodarRetrato(f.sb, agora())
    const linhas = linhasApply(f)
    expect(linhas.length).toBeGreaterThan(0)
    expect(linhas.every((l) => (l.day_pt as string) >= desde)).toBe(true)
    expect(rpc(f, 'ab_test_dias_fechar_antigas')[0]!.args).toEqual({ p_antes: desde })
  })

  it('N1: dois testes (iniciados há 5 e há 30 dias): p_antes é sempre ontem-40 e a linha aberta do mais velho segue no apply', async () => {
    const ontem = ontemPt(agora())
    const f = criarFakeSb({
      ab_tests: [teste('tA', { started_at: ha(5) }), teste('tB', { started_at: ha(30) })],
      ab_test_cycles: [ciclo('tA', ha(5)), ciclo('tB', ha(30))],
      ab_test_dias: [aberta('tB', addDays(ontem, -9))],
    })
    await rodarRetrato(f.sb, agora())
    expect(rpc(f, 'ab_test_dias_fechar_antigas')[0]!.args).toEqual({ p_antes: addDays(ontem, -40) })
    const b = linhasApply(f).find((l) => l.test_id === 'tB' && l.day_pt === addDays(ontem, -9))
    expect(b).toBeDefined()
    expect(b!.final).toBe(false)
  })

  it('N1 (variante): teste de 45 dias e outro iniciado ontem: p_antes ontem-40 e as linhas do novo seguem no apply', async () => {
    const ontem = ontemPt(agora())
    const f = criarFakeSb({
      ab_tests: [teste('tOld', { started_at: ha(45) }), teste('tNew', { started_at: ha(1) })],
      ab_test_cycles: [ciclo('tOld', ha(45)), ciclo('tNew', ha(1))],
    })
    await rodarRetrato(f.sb, agora())
    expect(rpc(f, 'ab_test_dias_fechar_antigas')[0]!.args).toEqual({ p_antes: addDays(ontem, -40) })
    expect(linhasApply(f).some((l) => l.test_id === 'tNew')).toBe(true)
  })
})

describe('rodarRetrato: testes fora da primeira leitura, apagados e notas (D2)', () => {
  it('teste archived com completed_at nulo e linha aberta entra no apply', async () => {
    const f = criarFakeSb({
      ab_tests: [teste('tArq', { status: 'archived', completed_at: null, started_at: ha(8), _soNaSegunda: true })],
      ab_test_cycles: [ciclo('tArq', ha(8), ha(7))],
      ab_test_dias: [aberta('tArq', addDays(ontemPt(agora()), -6))],
    })
    const r = await rodarRetrato(f.sb, agora())
    expect(r.status).toBe('ok')
    expect(linhasApply(f).some((l) => l.test_id === 'tArq')).toBe(true)
    expect(rpc(f, 'ab_test_dias_fechar_apagados')).toHaveLength(0)
  })

  it('teste aberto em ab_test_dias e ausente de ab_tests: fechar_apagados com o id', async () => {
    const f = criarFakeSb({ ab_test_dias: [aberta('sumiu', addDays(ontemPt(agora()), -3))] })
    f.rpcRetorno.ab_test_dias_fechar_apagados = 1
    const r = await rodarRetrato(f.sb, agora())
    expect(rpc(f, 'ab_test_dias_fechar_apagados')[0]!.args).toEqual({ p_test_ids: ['sumiu'] })
    expect(r).toMatchObject({ status: 'ok', fechadas_apagados: 1 })
  })

  it('6 dias de teste ativo com alcance aguardando: 1 captureMessage info; 4 dias: nenhuma', async () => {
    let f = criarFakeSb({ ab_tests: [teste('t6', { started_at: ha(6) })], ab_test_cycles: [ciclo('t6', ha(6))] })
    const r = await rodarRetrato(f.sb, agora())
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(sentry.captureMessage).toHaveBeenCalledWith('ab-retrato: alcance aguardando', expect.objectContaining({ level: 'info' }))
    expect(r.status === 'ok' && r.notas).toHaveLength(1)
    expect(saude.recordCronFailure).not.toHaveBeenCalled()

    vi.clearAllMocks()
    f = criarFakeSb({ ab_tests: [teste('t4', { started_at: ha(4) })], ab_test_cycles: [ciclo('t4', ha(4))] })
    await rodarRetrato(f.sb, agora())
    expect(sentry.captureMessage).not.toHaveBeenCalled()
  })

  it('erro na rpc de apply: falha registrada e status error', async () => {
    const f = criarFakeSb({ ab_tests: [teste('t1')], ab_test_cycles: [ciclo('t1', ha(3))] })
    f.erros['rpc:ab_test_dias_apply'] = 'rpc quebrou'
    const r = await rodarRetrato(f.sb, agora())
    expect(r).toMatchObject({ status: 'error', health_written: true })
    expect(saude.recordCronFailure).toHaveBeenCalledWith('ab-retrato', expect.stringContaining('rpc quebrou'))
  })

  it('mais de 500 linhas: apply em blocos de 500', async () => {
    const ts = Array.from({ length: 30 }, (_, i) => teste(`t${i}`, { started_at: ha(30) }))
    const cs = ts.map((t) => ciclo(t.id as string, ha(30)))
    const f = criarFakeSb({ ab_tests: ts, ab_test_cycles: cs })
    await rodarRetrato(f.sb, agora())
    const chamadas = rpc(f, 'ab_test_dias_apply')
    expect(chamadas.length).toBeGreaterThan(1)
    expect(chamadas.every((c) => (c.args.p_rows as unknown[]).length <= 500)).toBe(true)
  })
})
