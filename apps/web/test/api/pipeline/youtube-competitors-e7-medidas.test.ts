// @vitest-environment node
// A5 · E7, Tarefa 13: `listCompetitorChannels` com as medidas (Lote 2). Falso de PostgREST da E7 (`e7-fixture`); o motor é trocado por
// funções simples (carga, dataset e observatório) para o teste controlar quando ele lança, quando nunca responde e quando responde.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sentry = vi.hoisted(() => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@sentry/nextjs', () => sentry)

const motor = vi.hoisted(() => ({ loadRows: vi.fn(), rowsToDataset: vi.fn(), createObservatory: vi.fn() }))
vi.mock('@/lib/youtube/observatorio/load', () => ({ loadRows: motor.loadRows, rowsToDataset: motor.rowsToDataset }))
vi.mock('@/lib/youtube/observatorio', () => ({ createObservatory: motor.createObservatory }))

const leitores = vi.hoisted(() => ({ ler: null as null | typeof import('@/lib/youtube/observatorio/medidas/ler') }))
vi.mock('@/lib/youtube/observatorio/medidas/ler', async (importar) => {
  const real = await importar<typeof import('@/lib/youtube/observatorio/medidas/ler')>()
  leitores.ler = real
  return { ...real, lerCanal: vi.fn(real.lerCanal), lerVideosDoCanal: vi.fn(real.lerVideosDoCanal), lerMarcasDoCanal: vi.fn(real.lerMarcasDoCanal), lerRetratosDoCanal: vi.fn(real.lerRetratosDoCanal) }
})
const medidasMod = vi.hoisted(() => ({ real: null as null | typeof import('@/lib/pipeline/services/competitors-medidas') }))
vi.mock('@/lib/pipeline/services/competitors-medidas', async (importar) => {
  const real = await importar<typeof import('@/lib/pipeline/services/competitors-medidas')>()
  medidasMod.real = real
  return { ...real, medidasDosCanais: vi.fn(real.medidasDosCanais) }
})

import * as ler from '@/lib/youtube/observatorio/medidas/ler'
import * as medidasServ from '@/lib/pipeline/services/competitors-medidas'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { listCompetitorChannels, listCompetitorChanges } from '@/lib/pipeline/services/competitors'
import { baseE7, criarBancoFalso, contextoDe, CANAL_A1, CANAL_A2, CANAL_A3, SITE_A, type BancoFalso } from './e7-fixture'

const RETRATOS = join(process.cwd(), 'test/api/pipeline/__retratos__')
const retratoDeChannels = () => JSON.parse(readFileSync(join(RETRATOS, 'e7-channels-hoje.json'), 'utf8')) as { channels: Array<Record<string, unknown>>; count: number }
const SITE_VAZIO = 'cccccccc-0000-4000-8000-00000000000c'
const NOVE_CHAVES = ['id', 'channel_id', 'channel_name', 'thumbnail_url', 'subscriber_count', 'video_count', 'last_synced_at', 'added_at', 'avg_engagement']

function mundo(): BancoFalso { return criarBancoFalso(baseE7()) }
const ctx = (b: BancoFalso, site: string = SITE_A) => contextoDe(b, site)

beforeEach(() => {
  vi.clearAllMocks()
  motor.loadRows.mockImplementation(async () => ({ sintetico: true }))
  motor.rowsToDataset.mockImplementation(() => ({ sintetico: true }))
  motor.createObservatory.mockImplementation(() => ({ videos: [] }))
  const real = leitores.ler!
  vi.mocked(ler.lerCanal).mockImplementation(real.lerCanal)
  vi.mocked(ler.lerVideosDoCanal).mockImplementation(real.lerVideosDoCanal)
  vi.mocked(ler.lerMarcasDoCanal).mockImplementation(real.lerMarcasDoCanal)
  vi.mocked(ler.lerRetratosDoCanal).mockImplementation(real.lerRetratosDoCanal)
  vi.mocked(medidasServ.medidasDosCanais).mockImplementation(medidasMod.real!.medidasDosCanais)
})
afterEach(() => { vi.useRealTimers() })

const nove = (m: medidasServ.MedidasDoCanalParaCowork) => [
  m.direcao_do_canal, m.estado_do_canal.parado, m.estado_do_canal.queda,
  m.por_formato.long.direcao_dos_videos_novos, m.por_formato.long.ritmo, m.por_formato.long.taxa_de_acerto,
  m.por_formato.short.direcao_dos_videos_novos, m.por_formato.short.ritmo, m.por_formato.short.taxa_de_acerto,
]

describe('channels com medidas', () => {
  it('as nove chaves de hoje não mudaram', async () => {
    const { data } = await listCompetitorChannels(ctx(mundo()))
    const hoje = retratoDeChannels()
    expect(data.channels.map(c => Object.fromEntries(NOVE_CHAVES.map(k => [k, (c as unknown as Record<string, unknown>)[k]])))).toEqual(hoje.channels)
    expect(data.count).toBe(hoje.count)
  })

  it('todo canal tem medidas, e o topo tem medidas_indisponiveis e medidas_meta', async () => {
    const { data } = await listCompetitorChannels(ctx(mundo()))
    expect(data.channels).toHaveLength(3)
    for (const c of data.channels) {
      expect(nove(c.medidas)).toHaveLength(9)
      for (const x of nove(c.medidas)) if (x.estado === 'nao_medido') expect(x.frase.length).toBeGreaterThan(0)
    }
    expect(data.medidas_indisponiveis.total).toBe(24)
    expect(Object.values(data.medidas_indisponiveis.por_motivo).reduce((a, b) => a + b, 0)).toBe(data.medidas_indisponiveis.indisponiveis)
    expect(data.medidas_meta.regra).toBe(MEASURE_RULES.ruleVersion)
    expect(Object.keys(data.medidas_meta).sort()).toEqual(['calculado_em', 'canais_cortados_por_tempo', 'duracao_ms', 'regra'])
  })

  it('site sem canal: nenhuma carga do motor nem leitor por canal', async () => {
    const b = mundo()
    const { data } = await listCompetitorChannels(ctx(b, SITE_VAZIO))
    expect(data.channels).toEqual([])
    expect(data.count).toBe(0)
    expect(data.medidas_indisponiveis).toEqual({ total: 0, indisponiveis: 0, por_motivo: {} })
    expect(motor.loadRows).not.toHaveBeenCalled()
    expect(ler.lerCanal).not.toHaveBeenCalled()
  })

  it('o motor que lança não derruba a lista', async () => {
    motor.loadRows.mockRejectedValue(new Error('SENTINELA-MOTOR'))
    const { data } = await listCompetitorChannels(ctx(mundo()))
    expect(data.channels).toHaveLength(3)
    for (const c of data.channels) {
      expect(NOVE_CHAVES.every(k => k in c)).toBe(true)
      expect(c.perfil.estado).toBeDefined()
      expect(c.medidas.por_formato.long.taxa_de_acerto).toMatchObject({ estado: 'nao_medido', motivo: 'leitura_falhou' })
    }
    expect(sentry.captureException).toHaveBeenCalled()
    expect(JSON.stringify(data)).not.toContain('SENTINELA-MOTOR')
  })

  it('medidasDosCanais que lança não derruba a lista', async () => {
    vi.mocked(medidasServ.medidasDosCanais).mockRejectedValue(new Error('SENTINELA-DEFEITO'))
    const { data } = await listCompetitorChannels(ctx(mundo()))
    expect(data.channels).toHaveLength(3)
    for (const c of data.channels) {
      expect(NOVE_CHAVES.every(k => k in c)).toBe(true)
      nove(c.medidas).forEach((x, i) => expect(x).toMatchObject({ estado: 'nao_medido', motivo: i === 6 ? 'nao_se_aplica' : 'leitura_falhou' }))
      expect(c.medidas.estado_do_canal.situacao).toBe('nao_determinada')
    }
    expect(data.medidas_indisponiveis).toMatchObject({ total: 24, indisponiveis: 24, por_motivo: { leitura_falhou: 24 } })
    expect(JSON.stringify(data)).not.toContain('SENTINELA-DEFEITO')
  })

  it('changes, outliers e insights não mudaram', async () => {
    const hoje = JSON.parse(readFileSync(join(RETRATOS, 'e7-changes-hoje.json'), 'utf8')) as Record<string, { changes: unknown[]; count: number }>
    const r = await listCompetitorChanges(ctx(mundo()), {})
    expect(JSON.stringify(r.data)).toBe(JSON.stringify(hoje['sem_filtro']))
  })

  it('a rota declara maxDuration 60', () => {
    const texto = readFileSync(join(process.cwd(), 'src/app/api/pipeline/youtube/competitors/channels/route.ts'), 'utf8')
    expect(texto).toMatch(/export const maxDuration = 60\b/)
  })
})

describe('channels: o prazo', () => {
  it('motor que nunca responde não segura a resposta', async () => {
    vi.useFakeTimers()
    motor.loadRows.mockImplementation(() => new Promise(() => undefined))
    const promessa = listCompetitorChannels(ctx(mundo()))
    await vi.advanceTimersByTimeAsync(medidasServ.PRAZO_DO_MOTOR_MS)
    const { data } = await promessa
    expect(data.channels).toHaveLength(3)
    for (const c of data.channels) {
      expect(NOVE_CHAVES.every(k => k in c)).toBe(true)
      expect(c.medidas.por_formato.long.taxa_de_acerto).toMatchObject({ estado: 'nao_medido', motivo: 'leitura_falhou' })
      expect(c.medidas.por_formato.short.taxa_de_acerto).toMatchObject({ estado: 'nao_medido', motivo: 'leitura_falhou' })
    }
    expect(sentry.captureMessage).toHaveBeenCalledWith('e7.motor_fora_do_prazo')
  })

  it('leitor de canal que nunca responde não segura a resposta', async () => {
    vi.useFakeTimers()
    const real = leitores.ler!.lerRetratosDoCanal
    vi.mocked(ler.lerRetratosDoCanal).mockImplementation((s, e) => e.channelId === CANAL_A2 ? new Promise(() => undefined) : real(s, e))
    const promessa = listCompetitorChannels(ctx(mundo()))
    await vi.advanceTimersByTimeAsync(medidasServ.PRAZO_DO_PEDIDO_MS)
    const { data } = await promessa
    expect(data.channels).toHaveLength(3)
    expect(data.medidas_meta.canais_cortados_por_tempo).toBe(1)
    const preso = data.channels.find(c => c.id === CANAL_A2)!
    nove(preso.medidas).forEach((x, i) => expect(x).toMatchObject({ estado: 'nao_medido', motivo: i === 6 ? 'nao_se_aplica' : 'leitura_falhou' }))
    expect(preso.medidas.estado_do_canal.situacao).toBe('nao_determinada')
    for (const c of data.channels) expect(NOVE_CHAVES.every(k => k in c)).toBe(true)
  })

  it('o prazo conta do início do pedido', async () => {
    let chamadas = 0
    const relogio = () => (chamadas++ === 0 ? 0 : 41_000) // a primeira leitura é o início; depois das consultas de hoje já passou do prazo
    const { data } = await listCompetitorChannels(ctx(mundo()), { relogio })
    expect(motor.loadRows).not.toHaveBeenCalled()
    expect(ler.lerCanal).not.toHaveBeenCalled()
    expect(data.medidas_meta.canais_cortados_por_tempo).toBe(3)
    for (const c of data.channels) {
      nove(c.medidas).forEach((x, i) => expect(x).toMatchObject({ estado: 'nao_medido', motivo: i === 6 ? 'nao_se_aplica' : 'leitura_falhou' }))
      expect(NOVE_CHAVES.every(k => k in c)).toBe(true)
      expect(c.perfil.estado).toBeDefined()
    }
  })

  it('os canais pedidos são os do site, na ordem de hoje', async () => {
    const { data } = await listCompetitorChannels(ctx(mundo()))
    expect(data.channels.map(c => c.id)).toEqual([CANAL_A3, CANAL_A2, CANAL_A1])
  })
})
