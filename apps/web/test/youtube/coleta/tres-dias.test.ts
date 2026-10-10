// @vitest-environment node
// Três dias seguidos com os passos DE VERDADE e os critérios DE VERDADE, num banco só. É o teste que pega o
// "vermelho para sempre" e o "verde sem dado": os outros arquivos da pasta ou simulam os passos (index.test.ts)
// ou olham um passo de cada vez. Aqui só a rede é simulada: o cliente da Reporting API, a sonda e o arquivo da
// thumbnail, o token e a entrega do aviso. O carimbo do aviso (ops_alert_claim) roda no banco em memória.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/thumb-fingerprint', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/thumb-fingerprint')>()),
  probeThumb: vi.fn(async () => ({ etag: null, lastModified: null, dhash: 'ffffffffffffffff', bytes: Buffer.from('img'), url: 'u' })),
  archiveThumb: vi.fn(async () => 'https://blob.test/a.jpg'),
}))
vi.mock('@/lib/social/token-refresh', async (orig) => ({
  ...(await orig<typeof import('@/lib/social/token-refresh')>()),
  ensureFreshToken: vi.fn(),
}))
vi.mock('@/lib/youtube/coleta/videos-list', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/coleta/videos-list')>()),
  // O passo de metadados chama videos.list com o token do canal: aqui a rede é simulada, o YouTube devolve todos como públicos.
  videosList: vi.fn(async (_token: string, ids: readonly string[]) => new Map(ids.map(id => [id, {
    id, title: null, description: null, tags: ['a'], durationSeconds: null, privacyStatus: 'public',
  }]))),
}))
vi.mock('@/lib/youtube/coleta/analytics-diario', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/coleta/analytics-diario')>()),
  // O passo `diario` chama a Analytics API por vídeo: aqui a rede é simulada. Os dias da resposta são 'AAAA-MM-DD' (metricVersion(day)).
  diarioDoVideo: vi.fn(),
}))
vi.mock('@/lib/youtube/reporting/client', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/reporting/client')>()),
  criarReportingClient: vi.fn(),
}))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdmins: vi.fn() }))
vi.mock('@/lib/notifications/get-site-owners', () => ({
  SEM_DESTINATARIO: 'sem_destinatario',
  getSiteOwners: vi.fn(),
  logSemDestinatario: vi.fn(),
}))

import { ehMetadadosAntes, rodarColeta } from '@/lib/youtube/coleta'
import { marcarReautorizar } from '@/lib/youtube/coleta/autorizacao'
import { diarioDoVideo } from '@/lib/youtube/coleta/analytics-diario'
import { criarRelogio } from '@/lib/youtube/coleta/clock'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { criarReportingClient, empacotarCsv, type ReportingClient } from '@/lib/youtube/reporting/client'
import { REACH_TYPES, REPORT_TYPES_ENABLED, ReportingHttpError, type Job, type Report } from '@/lib/youtube/reporting/types'
import { fanOutToSiteAdmins } from '@/lib/notifications/fan-out-to-admins'
import { getSiteOwners } from '@/lib/notifications/get-site-owners'
import { comReachApply, fakeSupabase, type FakeDb, type Row } from './fake-supabase'

const DIA_MS = 86_400_000
// O cron roda às 12:00 UTC. Três execuções em dias seguidos.
const DIA_1 = new Date('2026-10-05T12:00:00.000Z')
const DIA_2 = new Date(DIA_1.getTime() + DIA_MS)
const DIA_3 = new Date(DIA_1.getTime() + 2 * DIA_MS)
/** Relatórios de histórico que o Google gera por job quando ele é criado. 2 canais x 4 tipos x 8 = 64. */
const HISTORICO_POR_JOB = 8

// Os dois canais de produção: um sem nenhum vídeo, outro com vídeos cuja última publicação é antiga.
const SEM_VIDEO = { id: 'ch-vazio', channel_id: 'UCvazio', site_id: 'site-1', name: 'Canal Sem Vídeo', sync_enabled: true, collection_status: 'ok' as const, video_count: 0 }
const ANTIGO = { id: 'ch-antigo', channel_id: 'UCantigo', site_id: 'site-1', name: 'Canal Antigo', sync_enabled: true, collection_status: 'ok' as const, video_count: 1 }
const video = (n: number, canal: string, publicadoEm: string): Row => ({
  id: `v-${canal}-${n}`, youtube_video_id: `yt-${canal}-${n}`, channel_id: canal, site_id: 'site-1',
  title: `Título ${n}`, description: `Descrição ${n}`, tags: ['a'], duration_seconds: 600, published_at: publicadoEm,
})
// Mais de 90 dias antes do dia 1.
const VIDEOS_ANTIGOS = [1, 2, 3].map(n => video(n, ANTIGO.id, new Date(DIA_1.getTime() - (200 + n) * DIA_MS).toISOString()))

// O CSV de alcance real: cabeçalho exato; o channel_id da linha é o UC… do dono do job e o video_id é um vídeo dele.
const CABECALHO_ALCANCE = 'date,channel_id,video_id,video_thumbnail_impressions,video_thumbnail_impressions_ctr'
const csvComDado = (uc: string, videoId: string, dia: string, colunaExtra = false): Buffer =>
  Buffer.from(colunaExtra
    ? `${CABECALHO_ALCANCE},extra\n${dia},${uc},${videoId},100,0.05,x\n`
    : `${CABECALHO_ALCANCE}\n${dia},${uc},${videoId},100,0.05\n`)
const csvSoCabecalho = (): Buffer => Buffer.from(`${CABECALHO_ALCANCE}\n`)
/** O primeiro vídeo do canal dono do UC… (para ANTIGO, `yt-ch-antigo-1`). */
const primeiroVideoDe = (uc: string): string => `yt-${uc === ANTIGO.channel_id ? ANTIGO.id : SEM_VIDEO.id}-1`

/** O lado do Google, em memória. Um job por (canal, tipo); os relatórios pertencem ao job. */
class Google {
  ativada = true
  jobs = new Map<string, Job[]>() // por UC…
  relatorios = new Map<string, Report[]>() // por job id
  csv = new Map<string, Buffer>() // por downloadUrl
  chamadas = { reportsList: 0, download: 0, jobsCreate: 0 }
  /** Canais (UC…) cujo relatório de ALCANCE vem só com o cabeçalho. Os outros tipos desses canais também. */
  semDado = new Set<string>()
  /** Os relatórios publicados daqui em diante trazem uma coluna a mais no cabeçalho (o Google mudou o formato). */
  colunaExtra = false

  cliente(uc: string): ReportingClient {
    const naoAtivada = () => new ReportingHttpError(403, 'accessNotConfigured')
    return {
      reportTypesList: async () => {
        if (!this.ativada) throw naoAtivada()
        return REPORT_TYPES_ENABLED.map(id => ({ id }))
      },
      jobsList: async () => {
        if (!this.ativada) throw naoAtivada()
        return this.jobs.get(uc) ?? []
      },
      jobsCreate: async ({ reportTypeId }) => {
        if (!this.ativada) throw naoAtivada()
        this.chamadas.jobsCreate++
        const job: Job = { id: `job-${uc}-${reportTypeId}`, reportTypeId, createTime: new Date().toISOString() }
        this.jobs.set(uc, [...(this.jobs.get(uc) ?? []), job])
        return job
      },
      reportsList: async (jobId, o = {}) => {
        if (!this.ativada) throw naoAtivada()
        this.chamadas.reportsList++
        const todos = this.relatorios.get(jobId) ?? []
        const desde = o.createdAfter ? Date.parse(o.createdAfter) : null
        return { reports: todos.filter(r => desde === null || Date.parse(r.createTime) > desde), nextPageToken: null }
      },
      download: async (url) => {
        this.chamadas.download++
        const bruto = this.csv.get(url)
        if (!bruto) throw new ReportingHttpError(404, null)
        return empacotarCsv(bruto)
      },
    }
  }

  /** O Google publica `quantos` relatórios novos em cada job existente, criados na madrugada de `agora`. */
  publicar(agora: Date, quantos: number, rotulo: string): void {
    for (const [uc, jobs] of this.jobs) {
      for (const job of jobs) {
        const lista = this.relatorios.get(job.id) ?? []
        for (let i = 0; i < quantos; i++) {
          const id = `${rotulo}-${job.id}-${i}`
          const fim = agora.getTime() - (quantos - i) * DIA_MS
          const url = `https://youtubereporting.googleapis.com/v1/media/${id}`
          lista.push({
            id, jobId: job.id,
            startTime: new Date(fim - DIA_MS).toISOString(), endTime: new Date(fim).toISOString(),
            createTime: new Date(agora.getTime() - 6 * 3_600_000 + i * 1000).toISOString(),
            jobExpireTime: new Date(agora.getTime() + 60 * DIA_MS).toISOString(),
            downloadUrl: url,
          })
          const dia = new Date(fim - DIA_MS).toISOString().slice(0, 10).replaceAll('-', '')
          this.csv.set(url, this.semDado.has(uc) ? csvSoCabecalho() : csvComDado(uc, primeiroVideoDe(uc), dia, this.colunaExtra))
        }
        this.relatorios.set(job.id, lista)
      }
    }
  }
}

/** Banco em memória com as sete tabelas novas vazias, a limpeza do bruto, a função de alcance e o carimbo de aviso (janela em dias). */
function banco(videos: Row[]): FakeDb {
  const db = comReachApply(fakeSupabase({
    youtube_channels: [SEM_VIDEO, ANTIGO],
    youtube_videos: videos,
    yt_own_video_meta_daily: [], yt_reporting_jobs: [], yt_reporting_reports: [], yt_reporting_report_blobs: [], yt_own_collection_attempts: [],
    yt_own_video_daily: [], yt_own_video_reach_daily: [],
  }))
  db.rpcHandlers.yt_reporting_blobs_purge = () => ({ data: 0, error: null })
  db.rpcHandlers.ops_alert_claim = (a) => {
    const t = (db.tables.ops_alert_state ??= [])
    const janelaMs = Number(String(a.p_min_interval).split(' ')[0]) * DIA_MS
    const linha = t.find(r => r.key === a.p_key)
    if (linha && Date.now() - Date.parse(linha.last_at as string) < janelaMs) return { data: false, error: null }
    if (linha) linha.last_at = new Date().toISOString()
    else t.push({ key: a.p_key, last_at: new Date().toISOString() })
    return { data: true, error: null }
  }
  return db
}

interface Dia {
  falhas: string[]
  acao_do_dono: string[]
  antes: Record<string, unknown>
  depois: Record<string, unknown>
}

/** Uma execução do cron: as duas fases de rodarColeta com o mesmo relógio, como a rota faz. */
async function rodarDia(db: FakeDb, agora: Date): Promise<Dia> {
  vi.setSystemTime(agora)
  const relogio = criarRelogio()
  const antes = await rodarColeta({ supabase: db.client, relogio, fase: 'antes' })
  const meta = ehMetadadosAntes(antes.resumo.metadados) ? antes.resumo.metadados : undefined
  // Como a rota: quem passou e quem foi negado na fase 'antes' segue para a fase 'depois' (aqui não há parte antiga).
  const depois = await rodarColeta({
    supabase: db.client, relogio, fase: 'depois', ...(meta && { metadadosAntes: meta }),
    autorizadosAntes: (antes.resumo.autorizados as string[] | undefined) ?? [],
    negadosAntes: (antes.resumo.negados as string[] | undefined) ?? [],
  })
  const acao = [...((antes.resumo.acao_do_dono as string[] | undefined) ?? []), ...((depois.resumo.acao_do_dono as string[] | undefined) ?? [])]
  return { falhas: [...antes.falhas, ...depois.falhas], acao_do_dono: [...new Set(acao)], antes: antes.resumo, depois: depois.resumo }
}

const porStatus = (db: FakeDb, canal: string, status: string, tipos: readonly string[] = REPORT_TYPES_ENABLED) =>
  (db.tables.yt_reporting_reports ?? []).filter(r => r.channel_id === canal && r.status === status && tipos.includes(r.report_type_id as string)).length
const relatoriosDe = (d: Dia) => d.depois.relatorios as Record<string, number>

let google: Google

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: DIA_1, toFake: ['Date'] })
  google = new Google()
  vi.mocked(ensureFreshToken).mockImplementation(async (_site, _rede, uc) => ({ accessToken: `tok:${uc}`, connectionId: 'c1' }) as never)
  vi.mocked(criarReportingClient).mockImplementation((token) => google.cliente(token.slice('tok:'.length)))
  vi.mocked(getSiteOwners).mockResolvedValue([{ userId: 'u1', email: 'dono@example.test' }])
  vi.mocked(fanOutToSiteAdmins).mockResolvedValue(1)
  vi.mocked(diarioDoVideo).mockResolvedValue({ dias: [{ day: '2026-10-03', valores: { views: 1 } }], estendidas: 'ok' })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('três dias seguidos, passos e critérios de verdade', () => {
  it('(a) Reporting API ativada: jobs no dia 1, histórico listado no dia 2 (40 baixados), o resto no dia 3 — verde nos três dias', async () => {
    google.semDado.add(SEM_VIDEO.channel_id)
    const db = banco(VIDEOS_ANTIGOS)

    // ── Dia 1: os jobs nascem; o Google ainda não gerou relatório nenhum.
    const d1 = await rodarDia(db, DIA_1)
    expect(d1.falhas).toEqual([])
    expect(d1.acao_do_dono).toEqual([])
    expect(google.chamadas.jobsCreate).toBe(8)
    expect((db.tables.yt_reporting_jobs ?? []).map(j => j.status)).toEqual(Array(8).fill('ativo'))
    expect(db.tables.yt_reporting_reports).toEqual([])
    expect(d1.antes.metadados).toMatchObject({ gravados: 3, pendentes: 0 })
    expect(relatoriosDe(d1)).toMatchObject({ vistos: 0, baixados: 0, vazios: 0, pendentes: 0 })
    expect(d1.depois.vazios_sem_publicacao).toEqual([])

    // ── Dia 2: o Google publicou o histórico dos dois canais; o teto de 40 downloads corta a fila.
    google.publicar(DIA_2, HISTORICO_POR_JOB, 'hist')
    const d2 = await rodarDia(db, DIA_2)
    expect(d2.falhas).toEqual([])
    expect(d2.acao_do_dono).toEqual([])
    expect(google.chamadas.jobsCreate).toBe(8) // nada recriado
    expect(relatoriosDe(d2)).toMatchObject({ vistos: 64, pendentes: 24, erros_download: 0, expirados: 0 })
    expect(relatoriosDe(d2).baixados! + relatoriosDe(d2).vazios!).toBe(40)
    expect(google.chamadas.download).toBe(40)
    // A prioridade pôs o alcance na frente: o canal sem vídeo já tem os 16 de alcance, todos só com cabeçalho.
    expect(porStatus(db, SEM_VIDEO.id, 'vazio', REACH_TYPES)).toBe(16)
    expect(porStatus(db, ANTIGO.id, 'baixado', REACH_TYPES)).toBe(16)
    expect(d2.antes.metadados).toMatchObject({ gravados: 3, dias_sem_meta: { [ANTIGO.id]: 0, [SEM_VIDEO.id]: 0 } })

    // ── Dia 3: mais um relatório por job; a fila esvazia.
    google.publicar(DIA_3, 1, 'dia3')
    const d3 = await rodarDia(db, DIA_3)
    expect(d3.falhas).toEqual([])
    expect(d3.acao_do_dono).toEqual([])
    expect(relatoriosDe(d3)).toMatchObject({ pendentes: 0, erros_download: 0, expirados: 0, perdidos: 0, atrasados: 0 })
    expect(relatoriosDe(d3).baixados! + relatoriosDe(d3).vazios!).toBe(32)
    expect(google.chamadas.download).toBe(72)
    expect((db.tables.yt_reporting_reports ?? []).filter(r => r.status === 'listado')).toEqual([])
    expect(db.tables.yt_reporting_report_blobs).toHaveLength(72)
    // O canal sem vídeo tem os 4 relatórios de alcance mais recentes vazios, e isso NÃO é falha: é informação.
    expect(d3.depois.vazios_sem_publicacao).toEqual([SEM_VIDEO.name])
    expect(porStatus(db, SEM_VIDEO.id, 'vazio')).toBe(36)
    expect(porStatus(db, ANTIGO.id, 'baixado')).toBe(36)
    // Uma linha de metadados por vídeo por dia, nos três dias; nenhuma tentativa diferente de ok em dia nenhum.
    expect(db.tables.yt_own_video_meta_daily).toHaveLength(9)
    expect((db.tables.yt_own_collection_attempts ?? []).filter(t => t.outcome !== 'ok')).toEqual([])
    expect(fanOutToSiteAdmins).not.toHaveBeenCalled()
  })

  it('(b) Reporting API não ativada (403 accessNotConfigured): verde nos três dias, estado em acao_do_dono, um aviso por canal e não um por dia', async () => {
    google.ativada = false
    const db = banco(VIDEOS_ANTIGOS)

    for (const agora of [DIA_1, DIA_2, DIA_3]) {
      const d = await rodarDia(db, agora)
      expect(d.falhas).toEqual([])
      expect(d.acao_do_dono).toEqual(expect.arrayContaining([
        `${SEM_VIDEO.name}: api_nao_ativada`,
        `${ANTIGO.name}: api_nao_ativada`,
        `${SEM_VIDEO.name}: channel_reach_basic_a1 em api_nao_ativada`,
        `${ANTIGO.name}: channel_reach_basic_a1 em api_nao_ativada`,
      ]))
      expect((db.tables.yt_reporting_jobs ?? []).map(j => j.status)).toEqual(Array(8).fill('api_nao_ativada'))
      // Os metadados não dependem da Reporting API: continuam sendo gravados.
      expect(d.antes.metadados).toMatchObject({ gravados: 3, pendentes: 0 })
      expect(d.depois.vazios_sem_publicacao).toEqual([])
    }

    // O aviso saiu no dia 1, uma vez por canal; os dias 2 e 3 caíram dentro da janela de 7 dias.
    expect(fanOutToSiteAdmins).toHaveBeenCalledTimes(2)
    const tipos = vi.mocked(fanOutToSiteAdmins).mock.calls.map(c => c[0].type)
    expect(tipos).toEqual(['youtube.coleta_api_nao_ativada', 'youtube.coleta_api_nao_ativada'])
    expect(google.chamadas).toEqual({ reportsList: 0, download: 0, jobsCreate: 0 })
    expect(db.tables.yt_reporting_reports).toEqual([])
    expect(db.tables.yt_own_video_meta_daily).toHaveLength(9)
  })

  it('controle negativo de (a): o mesmo canal, mas com um vídeo publicado há 10 dias, e 4 relatórios de alcance vazios => vermelho no dia 3', async () => {
    google.semDado.add(SEM_VIDEO.channel_id)
    const recente = video(1, SEM_VIDEO.id, new Date(DIA_3.getTime() - 10 * DIA_MS).toISOString())
    const db = banco([...VIDEOS_ANTIGOS, recente])

    await rodarDia(db, DIA_1)
    google.publicar(DIA_2, HISTORICO_POR_JOB, 'hist')
    await rodarDia(db, DIA_2)
    google.publicar(DIA_3, 1, 'dia3')
    const d3 = await rodarDia(db, DIA_3)

    expect(d3.falhas).toEqual([
      `relatórios: ${SEM_VIDEO.name} recebeu 4 relatórios channel_reach_basic_a1 vazios seguidos`,
      `relatórios: ${SEM_VIDEO.name} recebeu 4 relatórios channel_reach_combined_a1 vazios seguidos`,
    ])
    expect(d3.depois.vazios_sem_publicacao).toEqual([])
  })
})

describe('uma execução em que o canal passa numa chamada e é negado em outra (autorizacao.ts de verdade)', () => {
  const estado = (db: FakeDb) => db.tables.youtube_channels!.find(c => c.id === ANTIGO.id)!.collection_status
  const avisos = () => vi.mocked(fanOutToSiteAdmins).mock.calls.map(c => c[0].type)

  it('videos.list passa na fase antes, a parte antiga é negada: o canal TERMINA em reautorizar, com um aviso de entrada e nenhum de saída', async () => {
    const db = banco(VIDEOS_ANTIGOS)
    const relogio = criarRelogio()

    // Fase 'antes': o token passa e a videos.list responde. É uma chamada autenticada que deu certo.
    const antes = await rodarColeta({ supabase: db.client, relogio, fase: 'antes' })
    expect(antes.falhas).toEqual([])
    expect(antes.resumo.autorizados).toEqual([ANTIGO.id])
    expect(antes.resumo.negados).toEqual([])
    expect(estado(db)).toBe('ok')

    // Parte antiga da rota: a Analytics API nega por permissão. A rota chama marcarReautorizar com os conjuntos da execução.
    const autorizados = new Set(antes.resumo.autorizados as string[])
    const negados = new Set(antes.resumo.negados as string[])
    await marcarReautorizar({ supabase: db.client, falhas: [], tentativas: [], autorizados, negados }, { ...ANTIGO })
    expect(estado(db)).toBe('reautorizar')

    // Fase 'depois': o token do canal CONTINUA passando no refresh (o passo de relatórios o usa), e isso não desfaz nada.
    const meta = ehMetadadosAntes(antes.resumo.metadados) ? antes.resumo.metadados : undefined
    const depois = await rodarColeta({
      supabase: db.client, relogio, fase: 'depois', ...(meta && { metadadosAntes: meta }),
      autorizadosAntes: [...autorizados], negadosAntes: [...negados],
    })
    expect(ensureFreshToken).toHaveBeenCalledWith('site-1', 'youtube', ANTIGO.channel_id)
    expect(estado(db)).toBe('reautorizar')
    expect(depois.resumo.reautorizar).toEqual([ANTIGO.id])
    expect(depois.resumo.acao_do_dono).toContain(`${ANTIGO.name}: reautorizar`)
    expect(depois.falhas).toEqual([])
    expect(avisos()).toEqual(['youtube.coleta_reautorizar'])
  })

  it('controle: sem a negação, um canal em reautorizar com a videos.list passando volta a ok no fim da execução, com o aviso de saída', async () => {
    const db = banco(VIDEOS_ANTIGOS)
    const linha = db.tables.youtube_channels!.find(c => c.id === ANTIGO.id)!
    linha.collection_status = 'reautorizar'
    db.tables.ops_alert_state = [{ key: `sync-analytics:${ANTIGO.id}:reautorizar`, last_at: new Date(DIA_1.getTime() - DIA_MS).toISOString() }]

    const d = await rodarDia(db, DIA_1)
    expect(d.falhas).toEqual([])
    expect(estado(db)).toBe('ok')
    expect(d.depois.reautorizar).toEqual([])
    // No fim da fase 'antes' ainda estava marcado: a volta acontece uma vez, no fim da execução.
    expect(d.antes.reautorizar).toEqual([ANTIGO.id])
    expect(avisos()).toEqual(['youtube.coleta_saida'])
    expect(db.tables.ops_alert_state).toEqual([])
  })
})

describe('três dias com alcance e diário de verdade', () => {
  const videosDoAntigo = (quantos: number): Row[] =>
    Array.from({ length: quantos }, (_, i) => video(i + 1, ANTIGO.id, new Date(DIA_1.getTime() - (201 + i) * DIA_MS).toISOString()))
  const alcanceDe = (db: FakeDb, canal: string) =>
    (db.tables.yt_reporting_reports ?? []).filter(r => r.channel_id === canal && r.report_type_id === 'channel_reach_basic_a1')

  it('três dias saudáveis: verde nos três, uma linha de diário por vídeo, alcance gravado e todo relatório de alcance baixado ou vazio normalizado', async () => {
    google.semDado.add(SEM_VIDEO.channel_id)
    const db = banco(VIDEOS_ANTIGOS)

    const d1 = await rodarDia(db, DIA_1)
    expect(d1.falhas).toEqual([])
    google.publicar(DIA_2, HISTORICO_POR_JOB, 'hist')
    const d2 = await rodarDia(db, DIA_2)
    expect(d2.falhas).toEqual([])
    google.publicar(DIA_3, 1, 'dia3')
    const d3 = await rodarDia(db, DIA_3)
    expect(d3.falhas).toEqual([])

    expect((db.tables.yt_own_video_daily ?? []).filter(l => l.channel_id === ANTIGO.id)).toHaveLength(3)
    expect(new Set((db.tables.yt_own_video_daily ?? []).map(l => l.youtube_video_id)).size).toBe(3)
    expect((db.tables.yt_own_video_reach_daily ?? []).length).toBeGreaterThan(0)
    const alcance = [...alcanceDe(db, ANTIGO.id), ...alcanceDe(db, SEM_VIDEO.id)].filter(r => r.status === 'baixado' || r.status === 'vazio')
    expect(alcance.length).toBeGreaterThan(0)
    expect(alcance.filter(r => !r.normalized_at)).toEqual([])
    expect(d3.depois.alcance).toMatchObject({ erros: 0, pendentes: 0 })
    expect(d3.depois.diario).toMatchObject({ gravados: 3 })
  })

  it('diário mudo por três dias (Foco 1): sem nota nos dias 1 e 2, e no dia 3 o canal com 5 vídeos e nenhum diário ok fica vermelho', async () => {
    vi.mocked(diarioDoVideo).mockResolvedValue({ dias: [], estendidas: 'ok' })
    google.semDado.add(SEM_VIDEO.channel_id)
    const db = banco(videosDoAntigo(5))
    const nota = `diário: ${ANTIGO.name} não tem nenhum vídeo com diário ok nas 3 últimas execuções`

    const d1 = await rodarDia(db, DIA_1)
    expect(d1.falhas).not.toContain(nota)
    const d2 = await rodarDia(db, DIA_2)
    expect(d2.falhas).not.toContain(nota)
    const d3 = await rodarDia(db, DIA_3)
    expect(d3.falhas).toContain(nota)
    expect(db.tables.yt_own_video_daily).toEqual([])
  })

  it('cabeçalho que muda no dia 2 (Foco 2/3): o relatório novo vira erro e fica vermelho no mesmo dia; o do dia 1 continua normalizado', async () => {
    google.semDado.add(SEM_VIDEO.channel_id)
    const db = banco(VIDEOS_ANTIGOS)
    const nota = `relatórios: ${ANTIGO.name} tem relatório de alcance channel_reach_basic_a1 em erro`

    await rodarDia(db, DIA_1) // os jobs nascem
    google.publicar(DIA_1, 1, 'dia1') // o Google gera um relatório por job, ainda no formato antigo
    const d1b = await rodarDia(db, new Date(DIA_1.getTime() + 3_600_000))
    expect(d1b.falhas).not.toContain(nota)
    expect(alcanceDe(db, ANTIGO.id).every(r => r.status === 'baixado' && r.normalized_at)).toBe(true)

    google.colunaExtra = true
    google.publicar(DIA_2, 1, 'dia2') // o formato mudou: uma coluna a mais
    const d2 = await rodarDia(db, DIA_2)
    // Vermelho no mesmo dia, uma vez só: a nota do normalizador (com o motivo) cobre o relatório, e o critério de erro não a repete.
    expect(d2.falhas.filter(n => n.includes('não pôde ser normalizado'))).toEqual([
      expect.stringMatching(new RegExp(`^alcance: relatório dia2-.* de ${ANTIGO.name} não pôde ser normalizado \\(cabecalho_inesperado\\)$`)),
    ])
    expect(d2.falhas).not.toContain(nota)
    const doDia1 = alcanceDe(db, ANTIGO.id).filter(r => String(r.report_id).startsWith('dia1-'))
    const doDia2 = alcanceDe(db, ANTIGO.id).filter(r => String(r.report_id).startsWith('dia2-'))
    expect(doDia1).toHaveLength(1)
    expect(doDia1[0]).toMatchObject({ status: 'baixado' })
    expect(doDia1[0]!.normalized_at).toBeTruthy()
    expect(doDia2).toHaveLength(1)
    expect(doDia2[0]).toMatchObject({ status: 'erro', error: 'cabecalho_inesperado' })
  })
})
