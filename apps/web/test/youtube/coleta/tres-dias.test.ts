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
import { MAX_DOWNLOADS } from '@/lib/youtube/coleta/reports-step'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { criarReportingClient, empacotarCsv, type ReportingClient } from '@/lib/youtube/reporting/client'
import { REACH_TYPES, REPORT_TYPES_ENABLED, ReportingHttpError, type Job, type Report } from '@/lib/youtube/reporting/types'
import { fanOutToSiteAdmins } from '@/lib/notifications/fan-out-to-admins'
import { getSiteOwners } from '@/lib/notifications/get-site-owners'
import { comE11Padrao, comReachApply, fakeSupabase, type FakeDb, type Row } from './fake-supabase'

const DIA_MS = 86_400_000
// O cron roda às 12:00 UTC. Três execuções em dias seguidos.
const DIA_1 = new Date('2026-10-05T12:00:00.000Z')
const DIA_2 = new Date(DIA_1.getTime() + DIA_MS)
const DIA_3 = new Date(DIA_1.getTime() + 2 * DIA_MS)
/** Jobs de produção: 2 canais x todos os tipos habilitados. Derivado da lista, nunca um número fixo. */
const N_JOBS = 2 * REPORT_TYPES_ENABLED.length
/** Relatórios de histórico que o Google gera por job quando ele é criado: o menor número que deixa o total acima de
 *  MAX_DOWNLOADS + 10 (com 4 tipos: 2 x 4 x 14 = 112 > 100). O teto de downloads CORTA o dia 2 e a retomada nos dias
 *  seguintes fica provada; com o total abaixo do teto tudo cabia no mesmo dia e o corte deixava de ser testado. */
const HISTORICO_POR_JOB = Math.ceil((MAX_DOWNLOADS + 10) / N_JOBS)
const TOTAL_HISTORICO = N_JOBS * HISTORICO_POR_JOB
/** Relatórios de alcance do histórico, por canal (2 tipos de alcance x histórico por job). */
const ALCANCE_POR_CANAL = REACH_TYPES.length * HISTORICO_POR_JOB

// Os dois canais de produção: um sem nenhum vídeo, outro com vídeos cuja última publicação é antiga.
// (A5 E11: os ids têm a FORMA real, `UC` + 22 caracteres e vídeo com 11: o leitor dos dois relatórios da E11 recusa linha com id fora da forma.)
const SEM_VIDEO = { id: 'ch-vazio', channel_id: 'UCvazio'.padEnd(24, '0'), site_id: 'site-1', name: 'Canal Sem Vídeo', sync_enabled: true, collection_status: 'ok' as const, video_count: 0 }
const ANTIGO = { id: 'ch-antigo', channel_id: 'UCantigo'.padEnd(24, '0'), site_id: 'site-1', name: 'Canal Antigo', sync_enabled: true, collection_status: 'ok' as const, video_count: 1 }
const idDoVideo = (canal: string, n: number): string => `ytv${canal === 'ch-antigo' ? 'Antigo' : 'Vazio0'}${String(n).padStart(2, '0')}`
const video = (n: number, canal: string, publicadoEm: string): Row => ({
  id: `v-${canal}-${n}`, youtube_video_id: idDoVideo(canal, n), channel_id: canal, site_id: 'site-1',
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
// A5 E11: os dois tipos de E11 têm normalizador de verdade, então o CSV de cada um precisa ter o cabeçalho do SEU tipo (antes, todo tipo
// vinha com o cabeçalho do alcance básico e só o básico era lido). Só o alcance básico leva a coluna extra do teste "cabeçalho muda".
const CABECALHO_COMBINADO = 'date,channel_id,video_id,device_type,operating_system,traffic_source_type,traffic_source_detail,video_thumbnail_impressions,video_thumbnail_impressions_ctr'
const CABECALHO_TRAFEGO = 'date,channel_id,video_id,live_or_on_demand,subscribed_status,country_code,traffic_source_type,traffic_source_detail,views,engaged_views,watch_time_minutes,average_view_duration_seconds,average_view_duration_percentage,red_views,red_watch_time_minutes'
const csvDoTipo = (tipo: string, uc: string, videoId: string, dia: string, semDado: boolean, colunaExtra: boolean): Buffer => {
  if (tipo === 'channel_reach_combined_a1') {
    return Buffer.from(semDado ? `${CABECALHO_COMBINADO}\n` : `${CABECALHO_COMBINADO}\n${dia},${uc},${videoId},102,2,5,XXXX,100,0.05\n`)
  }
  if (tipo === 'channel_traffic_source_a3') {
    return Buffer.from(semDado ? `${CABECALHO_TRAFEGO}\n` : `${CABECALHO_TRAFEGO}\n${dia},${uc},${videoId},on_demand,not_subscribed,BR,4,XXXX,3,2,1.5,30,0.5,0,0\n`)
  }
  return semDado ? csvSoCabecalho() : csvComDado(uc, videoId, dia, colunaExtra && tipo === 'channel_reach_basic_a1')
}
/** O primeiro vídeo do canal dono do UC…. */
const primeiroVideoDe = (uc: string): string => idDoVideo(uc === ANTIGO.channel_id ? ANTIGO.id : SEM_VIDEO.id, 1)

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
          this.csv.set(url, csvDoTipo(job.reportTypeId, uc, primeiroVideoDe(uc), dia, this.semDado.has(uc), this.colunaExtra))
        }
        this.relatorios.set(job.id, lista)
      }
    }
  }
}

/** Banco em memória com as sete tabelas novas vazias, a limpeza do bruto, a função de alcance e o carimbo de aviso (janela em dias). */
function banco(videos: Row[]): FakeDb {
  const db = comE11Padrao(comReachApply(fakeSupabase({
    youtube_channels: [SEM_VIDEO, ANTIGO],
    youtube_videos: videos,
    yt_own_video_meta_daily: [], yt_reporting_jobs: [], yt_reporting_reports: [], yt_reporting_report_blobs: [], yt_own_collection_attempts: [],
    yt_own_video_daily: [], yt_own_video_reach_daily: [],
  })))
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
  vi.mocked(diarioDoVideo).mockResolvedValue({ dias: [{ day: '2026-10-03', valores: { views: 1, engaged_views: 1 } }], estendidas: 'ok' })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('três dias seguidos, passos e critérios de verdade', () => {
  it('(a) Reporting API ativada: jobs no dia 1; o histórico passa do teto de downloads, o dia 2 baixa o teto com o alcance na frente e o cron verde; o dia 3 retoma os que sobraram — verde nos três dias', async () => {
    google.semDado.add(SEM_VIDEO.channel_id)
    const db = banco(VIDEOS_ANTIGOS)
    expect(TOTAL_HISTORICO).toBeGreaterThan(MAX_DOWNLOADS) // sem isto o teste não prova corte nenhum
    expect(TOTAL_HISTORICO - MAX_DOWNLOADS + N_JOBS).toBeLessThanOrEqual(MAX_DOWNLOADS) // sem isto o dia 3 não esvazia a fila

    // ── Dia 1: os jobs nascem; o Google ainda não gerou relatório nenhum.
    const d1 = await rodarDia(db, DIA_1)
    expect(d1.falhas).toEqual([])
    expect(d1.acao_do_dono).toEqual([])
    expect(google.chamadas.jobsCreate).toBe(N_JOBS)
    expect((db.tables.yt_reporting_jobs ?? []).map(j => j.status)).toEqual(Array(N_JOBS).fill('ativo'))
    expect(db.tables.yt_reporting_reports).toEqual([])
    expect(d1.antes.metadados).toMatchObject({ gravados: 3, pendentes: 0 })
    expect(relatoriosDe(d1)).toMatchObject({ vistos: 0, baixados: 0, vazios: 0, pendentes: 0 })
    expect(d1.depois.vazios_sem_publicacao).toEqual([])

    // ── Dia 2: o Google publicou o histórico dos dois canais (TOTAL_HISTORICO relatórios, acima do teto MAX_DOWNLOADS). O dia CORTA:
    // MAX_DOWNLOADS baixados, o resto fica `listado` para o dia seguinte, e isso NÃO deixa o cron vermelho (falta de vazão não é perda).
    google.publicar(DIA_2, HISTORICO_POR_JOB, 'hist')
    const d2 = await rodarDia(db, DIA_2)
    expect(d2.falhas).toEqual([])
    expect(d2.acao_do_dono).toEqual([])
    expect(google.chamadas.jobsCreate).toBe(N_JOBS) // nada recriado
    expect(relatoriosDe(d2)).toMatchObject({ vistos: TOTAL_HISTORICO, pendentes: TOTAL_HISTORICO - MAX_DOWNLOADS, erros_download: 0, expirados: 0, perdidos: 0, atrasados: 0 })
    expect(relatoriosDe(d2).baixados! + relatoriosDe(d2).vazios!).toBe(MAX_DOWNLOADS)
    expect(google.chamadas.download).toBe(MAX_DOWNLOADS)
    // A prioridade pôs o alcance na frente: os de alcance (ALCANCE_POR_CANAL por canal) entraram todos; o corte pegou só o resto.
    expect(porStatus(db, SEM_VIDEO.id, 'vazio', REACH_TYPES)).toBe(ALCANCE_POR_CANAL)
    expect(porStatus(db, ANTIGO.id, 'baixado', REACH_TYPES)).toBe(ALCANCE_POR_CANAL)
    const pendentes = (db.tables.yt_reporting_reports ?? []).filter(r => r.status === 'listado')
    expect(pendentes).toHaveLength(TOTAL_HISTORICO - MAX_DOWNLOADS)
    expect(pendentes.filter(r => (REACH_TYPES as readonly string[]).includes(r.report_type_id as string))).toEqual([])
    expect(d2.antes.metadados).toMatchObject({ gravados: 3, dias_sem_meta: { [ANTIGO.id]: 0, [SEM_VIDEO.id]: 0 } })

    // ── Dia 3: mais um relatório por job (N_JOBS). Os que sobraram + os novos cabem no teto: a fila esvazia, verde.
    google.publicar(DIA_3, 1, 'dia3')
    const d3 = await rodarDia(db, DIA_3)
    expect(d3.falhas).toEqual([])
    expect(d3.acao_do_dono).toEqual([])
    expect(relatoriosDe(d3)).toMatchObject({ pendentes: 0, erros_download: 0, expirados: 0, perdidos: 0, atrasados: 0 })
    expect(relatoriosDe(d3).baixados! + relatoriosDe(d3).vazios!).toBe(TOTAL_HISTORICO - MAX_DOWNLOADS + N_JOBS)
    expect(google.chamadas.download).toBe(TOTAL_HISTORICO + N_JOBS)
    expect((db.tables.yt_reporting_reports ?? []).filter(r => r.status === 'listado')).toEqual([])
    expect(db.tables.yt_reporting_report_blobs).toHaveLength(TOTAL_HISTORICO + N_JOBS)
    // O canal sem vídeo tem os 4 relatórios de alcance mais recentes vazios, e isso NÃO é falha: é informação.
    expect(d3.depois.vazios_sem_publicacao).toEqual([SEM_VIDEO.name])
    expect(porStatus(db, SEM_VIDEO.id, 'vazio')).toBe((TOTAL_HISTORICO + N_JOBS) / 2)
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
      expect((db.tables.yt_reporting_jobs ?? []).map(j => j.status)).toEqual(Array(N_JOBS).fill('api_nao_ativada'))
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

describe('primeiro dia do deploy da E12: estado de produção (4 tipos ativos, 9 desativados) e erro passageiro da Reporting API', () => {
  const ANTIGOS = REPORT_TYPES_ENABLED.slice(0, 4)
  const NOVOS = REPORT_TYPES_ENABLED.slice(4)
  const canais = [SEM_VIDEO, ANTIGO]

  /** Como a produção estava em 12/10/2026: os 4 tipos antigos com job (criado há 4 dias, relatório de ontem), os 9 novos `desativado` sem job. */
  function bancoDeProducao(): FakeDb {
    const db = banco(VIDEOS_ANTIGOS)
    const criado = new Date(DIA_1.getTime() - 4 * DIA_MS).toISOString()
    const ontem = new Date(DIA_1.getTime() - 6 * 3_600_000).toISOString()
    for (const c of canais) {
      const jobs: Job[] = []
      for (const t of ANTIGOS) {
        const id = `job-${c.channel_id}-${t}`
        jobs.push({ id, reportTypeId: t, createTime: criado })
        db.tables.yt_reporting_jobs!.push({
          channel_id: c.id, site_id: c.site_id, report_type_id: t, status: 'ativo', job_id: id, job_create_time: criado, last_create_time: ontem, created_at: criado, error: null,
        })
      }
      google.jobs.set(c.channel_id, jobs)
      for (const t of NOVOS) {
        db.tables.yt_reporting_jobs!.push({
          channel_id: c.id, site_id: c.site_id, report_type_id: t, status: 'desativado', job_id: null, job_create_time: null, last_create_time: null, created_at: criado, error: null,
        })
      }
    }
    return db
  }
  const notaSemJob = (c: { name: string }) => `jobs: ${c.name} tem ${NOVOS.length} tipo(s) de relatório habilitado(s) sem job: ${[...NOVOS].sort().join(', ')}`
  const estados = (db: FakeDb, canal: string) => (db.tables.yt_reporting_jobs ?? []).filter(j => j.channel_id === canal && NOVOS.includes(j.report_type_id as never)).map(j => j.status)

  it('reportTypes.list devolve 500: os 9 tipos novos ficam em erro SEM job e o cron fica vermelho já na primeira execução', async () => {
    const db = bancoDeProducao()
    vi.mocked(criarReportingClient).mockImplementation((token) => ({
      ...google.cliente(token.slice('tok:'.length)),
      reportTypesList: async () => { throw new ReportingHttpError(500, null) },
    }))

    const d1 = await rodarDia(db, DIA_1)

    expect(estados(db, ANTIGO.id)).toEqual(Array(NOVOS.length).fill('erro'))
    expect(google.chamadas.jobsCreate).toBe(0)
    expect(d1.falhas).toEqual(expect.arrayContaining(canais.map(notaSemJob)))
    expect(d1.falhas).toHaveLength(2) // uma nota por canal, nada duplicado pelo passo de jobs
  })

  it('jobs.create devolve 429 nos 9 tipos novos: erro sem job, vermelho na primeira execução', async () => {
    const db = bancoDeProducao()
    vi.mocked(criarReportingClient).mockImplementation((token) => ({
      ...google.cliente(token.slice('tok:'.length)),
      reportTypesList: async () => REPORT_TYPES_ENABLED.map(id => ({ id })),
      jobsCreate: async () => { throw new ReportingHttpError(429, 'rateLimitExceeded') },
    }))

    const d1 = await rodarDia(db, DIA_1)

    expect(estados(db, SEM_VIDEO.id)).toEqual(Array(NOVOS.length).fill('erro'))
    expect(d1.falhas).toEqual(expect.arrayContaining(canais.map(notaSemJob)))
    expect(d1.falhas).toHaveLength(2)
  })

  it('controle: sem erro nenhum a primeira execução cria os 18 jobs e fica verde', async () => {
    const db = bancoDeProducao()
    const d1 = await rodarDia(db, DIA_1)
    expect(google.chamadas.jobsCreate).toBe(2 * NOVOS.length)
    expect(estados(db, ANTIGO.id)).toEqual(Array(NOVOS.length).fill('ativo'))
    expect(d1.falhas).toEqual([])
  })

  it('erro passageiro num tipo que JÁ teve job (4 antigos, com job_id) segue a regra dos 3 dias: não é "sem job"', async () => {
    const db = bancoDeProducao()
    for (const j of db.tables.yt_reporting_jobs!) if (j.report_type_id === ANTIGOS[2]) j.status = 'erro'
    const d = await rodarDia(db, DIA_1)
    expect(d.falhas.filter(n => n.includes('sem job'))).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// A5 E11 (Tarefa 10): os dois passos novos e os critérios, no cron de verdade, nos três dias do cenário (a).
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('E11 no cron, passos e critérios de verdade', () => {
  const TIPOS_E11_RELATORIO = ['channel_traffic_source_a3', 'channel_reach_combined_a1']
  const FUNCOES_MG7 = ['yt_own_dim_prova', 'yt_own_dim_cover_idle', 'yt_own_dim_apply', 'yt_own_traffic_detail_apply', 'yt_own_reach_dim_apply']
  const PGRST202 = { code: 'PGRST202', message: 'Could not find the function' }
  /** Relatórios dos dois tipos da E11 já baixados e ainda sem normalizar. */
  const naFila = (db: FakeDb) => (db.tables.yt_reporting_reports ?? [])
    .filter(r => TIPOS_E11_RELATORIO.includes(r.report_type_id as string) && ['baixado', 'vazio'].includes(r.status as string) && r.normalized_at == null).length

  /** Os três dias do cenário (a), com o Google novo. Devolve os dias e o banco. */
  async function tresDias(db: FakeDb): Promise<Dia[]> {
    google = new Google()
    vi.mocked(criarReportingClient).mockImplementation((token) => google.cliente(token.slice('tok:'.length)))
    google.semDado.add(SEM_VIDEO.channel_id)
    const d1 = await rodarDia(db, DIA_1)
    google.publicar(DIA_2, HISTORICO_POR_JOB, 'hist')
    const d2 = await rodarDia(db, DIA_2)
    google.publicar(DIA_3, 1, 'dia3')
    const d3 = await rodarDia(db, DIA_3)
    return [d1, d2, d3]
  }
  afterEach(() => { delete process.env.YT_OWN_STEPS_OFF })

  it('com a MG7 (respostas padrão): os relatórios dos dois tipos são normalizados, a prova roda duas vezes por execução (a segunda vê o que o passo gravou) e o cron fica verde', async () => {
    delete process.env.YT_OWN_STEPS_OFF
    const db = banco(VIDEOS_ANTIGOS)
    const vistas: number[] = []
    db.rpcHandlers.yt_own_dim_prova = (a) => {
      vistas.push(naFila(db))
      return {
        data: {
          faltando_cobertura: 0, videos_com_base: 1, videos_base_antes_do_inicio: 0, videos_sem_base: 0, base_ate: a.p_hoje,
          dias_dois_relatorios_detalhe: 0, dias_dois_relatorios_alcance: 0, pendentes_normalizar: naFila(db),
        },
        error: null,
      }
    }
    const [d1, d2, d3] = await tresDias(db)
    for (const d of [d1, d2, d3]) {
      expect(d.falhas).toEqual([])
      expect(d.acao_do_dono).toEqual([])
    }
    // Duas chamadas à prova por execução da fase 'depois' (a da guarda do passo e a dos critérios), três execuções.
    expect(db.rpcCalls.filter(c => c.name === 'yt_own_dim_prova')).toHaveLength(6)
    // Dia 2: a guarda do passo (1ª) vê relatórios na fila, os critérios (2ª) já não vêem nenhum. Dia 1 e 3: não há o que ver.
    expect(vistas[2]).toBeGreaterThan(0)
    expect(vistas[3]).toBe(0)
    expect(d2.depois.normalizadores).toMatchObject({ por_tipo: expect.anything() })
    const n = d2.depois.normalizadores as { por_tipo: Record<string, { normalizados: number; vazios: number }> }
    expect(n.por_tipo.detalhe!.normalizados + n.por_tipo.detalhe!.vazios).toBeGreaterThan(0)
    expect(n.por_tipo.alcance_dim!.normalizados + n.por_tipo.alcance_dim!.vazios).toBeGreaterThan(0)
    expect(d2.depois.e11).toMatchObject({ avaliados: ['dimensoes', 'normalizadores'], desligados: [] })
    expect(naFila(db)).toBe(0)
    const tent = (db.tables.yt_own_collection_attempts ?? []).filter(t => ['dimensoes', 'normalizador_trafego', 'normalizador_alcance_dim'].includes(t.kind as string))
    expect(tent.length).toBeGreaterThan(0)
    expect(tent.filter(t => t.outcome !== 'ok')).toEqual([])
    expect(db.rpcCalls.filter(c => c.name === 'yt_own_traffic_detail_apply').length).toBeGreaterThan(0)
    expect(db.rpcCalls.filter(c => c.name === 'yt_own_reach_dim_apply').length).toBeGreaterThan(0)
  })

  it('ANTES DA MIGRATION (MG7 ausente em produção): os passos novos dão schema_ausente com o nome da migration, e o resumo e o banco dos passos antigos são IDÊNTICOS aos de antes do código novo', async () => {
    // Referência = o código antigo: os dois passos desligados por YT_OWN_STEPS_OFF fazem o cron se comportar como antes da E11.
    process.env.YT_OWN_STEPS_OFF = 'dimensoes,normalizadores'
    const base = banco(VIDEOS_ANTIGOS)
    const antes = await tresDias(base)
    delete process.env.YT_OWN_STEPS_OFF
    expect(base.rpcCalls.filter(c => FUNCOES_MG7.includes(c.name))).toEqual([])

    const db = banco(VIDEOS_ANTIGOS)
    for (const f of FUNCOES_MG7) db.errors[`rpc:${f}`] = PGRST202
    const depois = await tresDias(db)

    const VELHOS = ['relatorios', 'alcance', 'diario', 'perdidos', 'atrasados', 'vazios_sem_publicacao', 'desconhecido', 'autorizados', 'negados', 'reautorizar', 'guarda', 'conferencias_vencidas'] as const
    for (let i = 0; i < 3; i++) {
      for (const k of VELHOS) expect(depois[i]!.depois[k], `dia ${i + 1}, resumo.${k}`).toEqual(antes[i]!.depois[k])
      expect(depois[i]!.antes.metadados).toEqual(antes[i]!.antes.metadados)
      expect(depois[i]!.antes.jobs).toEqual(antes[i]!.antes.jobs)
    }
    // O banco dos passos antigos é o mesmo (os relatórios dos tipos da E11 ficam sem normalizar: a MG7 não existe).
    for (const t of ['yt_reporting_jobs', 'yt_own_video_meta_daily', 'yt_own_video_daily', 'yt_own_video_reach_daily', 'yt_own_video_coverage'] as const) {
      expect(db.tables[t] ?? [], t).toEqual(base.tables[t] ?? [])
    }
    const semE11 = (rs: Row[] | undefined) => (rs ?? []).filter(r => !TIPOS_E11_RELATORIO.includes(r.report_type_id as string)).map(r => ({ ...r }))
    expect(semE11(db.tables.yt_reporting_reports)).toEqual(semE11(base.tables.yt_reporting_reports))
    expect((db.tables.yt_reporting_reports ?? []).filter(r => TIPOS_E11_RELATORIO.includes(r.report_type_id as string) && r.status === 'erro')).toEqual([])
    expect(naFila(db)).toBeGreaterThan(0)
    const velhas = (db: FakeDb) => (db.tables.yt_own_collection_attempts ?? []).filter(t => !['dimensoes', 'normalizador_trafego', 'normalizador_alcance_dim'].includes(t.kind as string))
    expect(velhas(db)).toEqual(velhas(base))

    // Os passos novos: vermelho com o nome da migration, em TODA execução, e só isso a mais.
    for (const d of depois) {
      expect(d.falhas).toEqual(expect.arrayContaining(['schema_ausente: MG7 não aplicada (yt_own_dim_prova)']))
      expect(d.falhas.filter(n => !n.startsWith('schema_ausente') && !n.includes('MG7'))).toEqual([])
    }
    // Referência: nenhuma falha (é o cenário verde (a)).
    for (const d of antes) expect(d.falhas).toEqual([])
    // E o cron do dia 2 não gravou nada nas tabelas novas (elas nem existem).
    expect(db.tables.yt_own_video_dim_daily ?? []).toEqual([])
  })

  it('YT_OWN_STEPS_OFF=dimensoes,normalizadores: os passos não chamam nada, nem a prova, e o critério de desligados registra o estado (nota até a 7ª execução, vermelho da 8ª)', async () => {
    process.env.YT_OWN_STEPS_OFF = 'dimensoes,normalizadores'
    const db = banco(VIDEOS_ANTIGOS)
    const [d1] = await tresDias(db)
    expect(db.rpcCalls.filter(c => FUNCOES_MG7.includes(c.name))).toEqual([])
    expect(d1.depois.dimensoes).toEqual({ desligado: true })
    expect(d1.depois.normalizadores).toEqual({ desligado: true })
    expect(d1.depois.e11).toMatchObject({ avaliados: [], desligados: ['dimensoes', 'normalizadores'] })
    expect(d1.falhas).toEqual([])
    expect(d1.acao_do_dono).toEqual(expect.arrayContaining([
      'dimensoes: passo desligado por YT_OWN_STEPS_OFF (há 1 execuções)',
      'normalizadores: passo desligado por YT_OWN_STEPS_OFF (há 1 execuções)',
    ]))

    // A 8ª execução seguida desligada: vermelho. As 7 anteriores estão em yt_own_collection_runs.
    const db2 = banco(VIDEOS_ANTIGOS)
    db2.tables.yt_own_collection_runs = Array.from({ length: 7 }, (_, i) => ({
      ran_at: new Date(DIA_1.getTime() - (i + 1) * 3_600_000).toISOString(),
      resumo: { dimensoes: { desligado: true }, normalizadores: { desligado: true } },
    }))
    const d = await rodarDia(db2, DIA_1)
    expect(d.falhas.filter(n => n.includes('desligado há 8 execuções ou mais'))).toHaveLength(2)
  })
})
