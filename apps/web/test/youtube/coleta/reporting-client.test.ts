// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import { criarReportingClient, classificarErro, empacotarCsv, paraBytea, deBytea, REPORTING_BASE } from '@/lib/youtube/reporting/client'
import { REPORT_TYPES_ENABLED, REACH_TYPES, SEM_NORMALIZADOR, ReportingHttpError } from '@/lib/youtube/reporting/types'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const chamada = (f: ReturnType<typeof vi.fn>, i: number) => f.mock.calls[i] as unknown as [string, RequestInit | undefined]

describe('constantes', () => {
  it('tipos habilitados na ordem de prioridade de download, e os derivados', () => {
    expect([...REPORT_TYPES_ENABLED]).toEqual(['channel_reach_basic_a1', 'channel_reach_combined_a1', 'channel_traffic_source_a3', 'channel_basic_a3'])
    expect([...REACH_TYPES]).toEqual(['channel_reach_basic_a1', 'channel_reach_combined_a1'])
    expect(SEM_NORMALIZADOR).toEqual(['channel_reach_combined_a1', 'channel_traffic_source_a3', 'channel_basic_a3'])
    expect(REPORTING_BASE).toBe('https://youtubereporting.googleapis.com/v1')
  })
})

describe('chamadas', () => {
  it('reportTypesList manda o Bearer do canal e percorre nextPageToken', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(json({ reportTypes: [{ id: 'a' }], nextPageToken: 'p2' }))
      .mockResolvedValueOnce(json({ reportTypes: [{ id: 'b' }] }))
    const tipos = await criarReportingClient('tok', f as unknown as typeof fetch).reportTypesList()
    expect(tipos.map(t => t.id)).toEqual(['a', 'b'])
    expect(chamada(f, 0)[0]).toBe('https://youtubereporting.googleapis.com/v1/reportTypes')
    expect(new Headers(chamada(f, 0)[1]!.headers).get('authorization')).toBe('Bearer tok')
    expect(new URL(chamada(f, 1)[0]).searchParams.get('pageToken')).toBe('p2')
  })

  it('jobsList devolve [] quando a resposta não traz a chave jobs', async () => {
    const f = vi.fn().mockResolvedValue(json({}))
    expect(await criarReportingClient('tok', f as unknown as typeof fetch).jobsList()).toEqual([])
  })

  it('jobsCreate faz POST com reportTypeId e name', async () => {
    const f = vi.fn().mockResolvedValue(json({ id: 'job-1', reportTypeId: 'channel_basic_a3', createTime: '2026-10-07T12:00:00Z' }))
    const job = await criarReportingClient('tok', f as unknown as typeof fetch).jobsCreate({ reportTypeId: 'channel_basic_a3', name: 'n' })
    expect(job.id).toBe('job-1')
    expect(chamada(f, 0)[0]).toBe('https://youtubereporting.googleapis.com/v1/jobs')
    expect(chamada(f, 0)[1]!.method).toBe('POST')
    expect(JSON.parse(chamada(f, 0)[1]!.body as string)).toEqual({ reportTypeId: 'channel_basic_a3', name: 'n' })
  })

  it('reportsList passa createdAfter e pageToken, e devolve nextPageToken nulo no fim', async () => {
    const f = vi.fn().mockResolvedValue(json({ reports: [{ id: 'r1', startTime: 's', endTime: 'e', createTime: 'c', downloadUrl: 'u' }] }))
    const r = await criarReportingClient('tok', f as unknown as typeof fetch).reportsList('job/1', { createdAfter: '2026-10-01T00:00:00.000Z', pageToken: 'p' })
    const url = new URL(chamada(f, 0)[0])
    expect(url.pathname).toBe('/v1/jobs/job%2F1/reports')
    expect(url.searchParams.get('createdAfter')).toBe('2026-10-01T00:00:00.000Z')
    expect(url.searchParams.get('pageToken')).toBe('p')
    expect(r).toEqual({ reports: [{ id: 'r1', startTime: 's', endTime: 'e', createTime: 'c', downloadUrl: 'u' }], nextPageToken: null })
  })

  it('reportsList sem opções não manda createdAfter', async () => {
    const f = vi.fn().mockResolvedValue(json({}))
    const r = await criarReportingClient('tok', f as unknown as typeof fetch).reportsList('job-1')
    expect(new URL(chamada(f, 0)[0]).search).toBe('')
    expect(r).toEqual({ reports: [], nextPageToken: null })
  })

  it('download usa a URL como veio, com o mesmo token e Accept-Encoding gzip', async () => {
    const f = vi.fn().mockResolvedValue(new Response('date,video_id\n20261006,abc\n'))
    const pacote = await criarReportingClient('tok', f as unknown as typeof fetch).download('https://youtubereporting.googleapis.com/v1/media/CHANNEL/x/jobs/j/reports/r?alt=media')
    expect(chamada(f, 0)[0]).toBe('https://youtubereporting.googleapis.com/v1/media/CHANNEL/x/jobs/j/reports/r?alt=media')
    const h = new Headers(chamada(f, 0)[1]!.headers)
    expect(h.get('authorization')).toBe('Bearer tok')
    expect(h.get('accept-encoding')).toBe('gzip')
    expect(pacote.rowCount).toBe(1)
  })
})

describe('erros', () => {
  it('403 accessNotConfigured → api_nao_ativada', async () => {
    const f = vi.fn().mockResolvedValue(json({ error: { code: 403, errors: [{ reason: 'accessNotConfigured' }] } }, 403))
    const e = await criarReportingClient('tok', f as unknown as typeof fetch).reportTypesList().catch(x => x)
    expect(e).toBeInstanceOf(ReportingHttpError)
    expect(e).toMatchObject({ status: 403, reason: 'accessNotConfigured' })
    expect(classificarErro(e)).toBe('api_nao_ativada')
  })

  it('403 com details SERVICE_DISABLED (formato novo do Google) → api_nao_ativada', async () => {
    const f = vi.fn().mockResolvedValue(json({ error: { code: 403, status: 'PERMISSION_DENIED', details: [{ '@type': 'x', reason: 'SERVICE_DISABLED' }] } }, 403))
    const e = await criarReportingClient('tok', f as unknown as typeof fetch).jobsList().catch(x => x)
    expect(classificarErro(e)).toBe('api_nao_ativada')
  })

  it('401 e 403 insufficientPermissions → sem_acesso; 404 → nao_encontrado; 500, 403 de cota e erro de rede → outro', () => {
    expect(classificarErro(new ReportingHttpError(401, null))).toBe('sem_acesso')
    expect(classificarErro(new ReportingHttpError(403, 'insufficientPermissions'))).toBe('sem_acesso')
    expect(classificarErro(new ReportingHttpError(403, 'ACCESS_TOKEN_SCOPE_INSUFFICIENT'))).toBe('sem_acesso')
    expect(classificarErro(new ReportingHttpError(404, null))).toBe('nao_encontrado')
    expect(classificarErro(new ReportingHttpError(500, null))).toBe('outro')
    expect(classificarErro(new ReportingHttpError(403, 'quotaExceeded'))).toBe('outro')
    expect(classificarErro(new TypeError('fetch failed'))).toBe('outro')
  })

  it('corpo de erro que não é JSON: reason nulo, e a mensagem do erro não carrega o corpo', async () => {
    const f = vi.fn().mockResolvedValue(new Response('<html>ya29.SEGREDO</html>', { status: 502 }))
    const e = await criarReportingClient('tok', f as unknown as typeof fetch).jobsList().catch(x => x) as ReportingHttpError
    expect(e.reason).toBeNull()
    expect(e.message).toBe('YouTube Reporting API HTTP 502')
  })
})

describe('empacotarCsv e bytea', () => {
  const csv = Buffer.from('date,video_id,views\n20261006,abc,10\n20261006,def,20\n')

  it('CSV puro é comprimido: csv_gz é sempre gzip, sha256 é do CSV descomprimido', () => {
    const p = empacotarCsv(csv)
    expect(p.gz[0]).toBe(0x1f)
    expect(p.gz[1]).toBe(0x8b)
    expect(gunzipSync(p.gz).equals(csv)).toBe(true)
    expect(p.sha256).toBe(createHash('sha256').update(csv).digest('hex'))
    expect(p.rowCount).toBe(2)
  })

  it('o que já veio gzip é guardado como veio', () => {
    const gz = gzipSync(csv)
    const p = empacotarCsv(gz)
    expect(p.gz.equals(gz)).toBe(true)
    expect(p.sha256).toBe(createHash('sha256').update(csv).digest('hex'))
    expect(p.rowCount).toBe(2)
  })

  it('só cabeçalho, ou vazio: rowCount 0', () => {
    expect(empacotarCsv(Buffer.from('date,video_id,views\n')).rowCount).toBe(0)
    expect(empacotarCsv(Buffer.from('')).rowCount).toBe(0)
  })

  it('ida e volta do bytea com os bytes 0x00 e 0xff', () => {
    const buf = Buffer.from([0x1f, 0x8b, 0x00, 0xff, 0x00, 0xff])
    const texto = paraBytea(buf)
    expect(texto).toBe('\\x1f8b00ff00ff')
    expect(deBytea(texto).equals(buf)).toBe(true)
  })
})

describe('download: URL só do Google', () => {
  const novo = () => {
    const f = vi.fn().mockResolvedValue(new Response('date,video_id\n20261006,abc\n'))
    return { f, c: criarReportingClient('tok', f as unknown as typeof fetch) }
  }

  it('aceita googleapis.com, google.com e subdomínios', async () => {
    for (const u of [
      'https://youtubereporting.googleapis.com/v1/media/x?alt=media',
      'https://googleapis.com/x',
      'https://www.google.com/x',
      'https://google.com/x',
    ]) {
      const { f, c } = novo()
      await c.download(u)
      expect(f).toHaveBeenCalledTimes(1)
    }
  })

  it.each([
    ['http:', 'http://youtubereporting.googleapis.com/v1/x'],
    ['look-alike sem ponto', 'https://evilgoogleapis.com/x'],
    ['look-alike com sufixo', 'https://googleapis.com.evil.test/x'],
    ['userinfo enganoso', 'https://googleapis.com@evil.test/x'],
    ['não é URL', 'nao-e-url'],
  ])('recusa %s sem chamar a rede', async (_n, url) => {
    const { f, c } = novo()
    const e = await c.download(url).catch(x => x)
    expect(e).toBeInstanceOf(ReportingHttpError)
    expect(e).toMatchObject({ reason: 'url_inesperada' })
    expect(classificarErro(e)).toBe('url_inesperada')
    expect(f).not.toHaveBeenCalled()
  })
})
