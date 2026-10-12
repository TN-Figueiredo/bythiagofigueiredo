// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import { criarReportingClient, classificarErro, empacotarCsv, paraBytea, deBytea, REPORTING_BASE, MAX_GZ_BYTES, MAX_CSV_BYTES } from '@/lib/youtube/reporting/client'
import { REPORT_TYPES_ENABLED, REACH_TYPES, SEM_NORMALIZADOR, ReportingHttpError, ArquivoGrandeDemaisError } from '@/lib/youtube/reporting/types'
import { PaginacaoExcedidaError } from '@/lib/youtube/reporting/client'

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

  it('E12 onda 4: lista que ainda tem nextPageToken depois de 20 páginas é erro visível, nunca uma lista curta devolvida em silêncio', async () => {
    const infinita = () => vi.fn().mockImplementation(async () => json({ reportTypes: [{ id: 'x' }], nextPageToken: 'mais' }))
    const f = infinita()
    const e = await criarReportingClient('tok', f as unknown as typeof fetch).reportTypesList().catch(x => x)
    expect(e).toBeInstanceOf(PaginacaoExcedidaError)
    expect((e as Error).message).toContain('20')
    expect(f).toHaveBeenCalledTimes(20)
    const g = infinita()
    expect(await criarReportingClient('tok', g as unknown as typeof fetch).jobsList().catch(x => x)).toBeInstanceOf(PaginacaoExcedidaError)
  })

  it('E12 onda 4: exatamente 20 páginas, a última sem nextPageToken, é lista completa', async () => {
    let n = 0
    const f = vi.fn().mockImplementation(async () => { n++; return json(n < 20 ? { reportTypes: [{ id: `t${n}` }], nextPageToken: `p${n}` } : { reportTypes: [{ id: `t${n}` }] }) })
    const tipos = await criarReportingClient('tok', f as unknown as typeof fetch).reportTypesList()
    expect(tipos).toHaveLength(20)
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

describe('download: tetos de tamanho (comprimido no fio, descomprimido na memória)', () => {
  const URL_OK = 'https://youtubereporting.googleapis.com/v1/media/x?alt=media'
  const MB = 1024 * 1024

  /** Corpo em pedaços de `chunk` bytes que registra quantos pedaços foram puxados e se foi cancelado. */
  const corpo = (pedacos: number, chunk: number, headers: Record<string, string> = {}) => {
    const estado = { puxados: 0, cancelado: false }
    let i = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        estado.puxados++
        if (i++ >= pedacos) c.close()
        else c.enqueue(new Uint8Array(chunk))
      },
      cancel() { estado.cancelado = true },
    })
    return { estado, res: new Response(stream, { headers }) }
  }
  const baixar = (res: Response) => criarReportingClient('tok', vi.fn().mockResolvedValue(res) as unknown as typeof fetch).download(URL_OK)

  it('os tetos: 10 MB comprimido e 64 MB descomprimido (a conta está no relatório da onda 3)', () => {
    expect(MAX_GZ_BYTES).toBe(10 * MB)
    expect(MAX_CSV_BYTES).toBe(64 * MB)
  })

  it('Content-Length acima do teto: recusa ANTES de ler o corpo (nenhum pedaço puxado) e cancela a resposta', async () => {
    const { estado, res } = corpo(3, MB, { 'content-length': String(MAX_GZ_BYTES + 1) })
    const e = await baixar(res).catch(x => x)
    expect(e).toBeInstanceOf(ArquivoGrandeDemaisError)
    expect(e).toMatchObject({ lado: 'comprimido', bytes: MAX_GZ_BYTES + 1 })
    expect(e.detalhe).toContain(`${MAX_GZ_BYTES + 1} bytes comprimidos`)
    expect(estado.cancelado).toBe(true)
    expect(estado.puxados).toBeLessThanOrEqual(1) // o ReadableStream puxa 1 vez ao nascer; nenhum pedaço foi lido por nós
    expect(classificarErro(e)).toBe('outro')
  })

  it('sem Content-Length e corpo que passa do teto no meio do fluxo: aborta ao ultrapassar, sem ler o resto', async () => {
    const { estado, res } = corpo(200, MB) // 200 MB se fosse lido inteiro
    const e = await baixar(res).catch(x => x)
    expect(e).toBeInstanceOf(ArquivoGrandeDemaisError)
    expect(e).toMatchObject({ lado: 'comprimido' })
    expect(e.bytes).toBeGreaterThan(MAX_GZ_BYTES)
    expect(e.bytes).toBeLessThanOrEqual(MAX_GZ_BYTES + 2 * MB)
    expect(e.detalhe).toContain('sem Content-Length')
    expect(estado.cancelado).toBe(true)
    expect(estado.puxados).toBeLessThan(20)
  })

  it('Content-Length ilegível ("abc") não vale como ausência de limite: lê com limite', async () => {
    const { res } = corpo(200, MB, { 'content-length': 'abc' })
    await expect(baixar(res)).rejects.toBeInstanceOf(ArquivoGrandeDemaisError)
  })

  it('gzip pequeno que descomprime acima do teto (bomba): recusa como descomprimido, com o tamanho comprimido, sem erro de zlib', async () => {
    const bomba = gzipSync(Buffer.alloc(MAX_CSV_BYTES + 1, 'a'))
    expect(bomba.length).toBeLessThan(MB) // pequeno no fio
    const e = await baixar(new Response(bomba)).catch(x => x)
    expect(e).toBeInstanceOf(ArquivoGrandeDemaisError)
    expect(e).toMatchObject({ lado: 'descomprimido', bytes: bomba.length })
    expect(e.detalhe).toContain(`${bomba.length} bytes comprimidos`)
    expect(e.detalhe).toContain(`${MAX_CSV_BYTES}`)
    expect((e as { code?: string }).code).toBeUndefined() // não é erro Z_ do zlib: não pode cair em gzip_invalido
    expect(classificarErro(e)).toBe('outro')
  })

  it('exatamente no teto descomprimido passa', async () => {
    const csv = Buffer.alloc(MAX_CSV_BYTES, 'a')
    csv.write('date,views\n', 0)
    const p = await baixar(new Response(gzipSync(csv)))
    expect(p.sha256).toBe(createHash('sha256').update(csv).digest('hex'))
  })

  it('caso normal intacto: Content-Length correto e corpo pequeno viram o mesmo pacote de sempre', async () => {
    const gz = gzipSync(Buffer.from('date,video_id\n20261006,abc\n20261006,def\n'))
    const p = await baixar(new Response(gz, { headers: { 'content-length': String(gz.length) } }))
    expect(p.rowCount).toBe(2)
    expect(p.gz.equals(gz)).toBe(true)
  })

  it('CSV puro acima do teto descomprimido (sem ser gzip) também é recusado em empacotarCsv', () => {
    const e = (() => { try { empacotarCsv(Buffer.alloc(MAX_CSV_BYTES + 1, 'a')) } catch (x) { return x } })()
    expect(e).toBeInstanceOf(ArquivoGrandeDemaisError)
    expect(e).toMatchObject({ lado: 'descomprimido' })
  })

  it('corpo vazio (0 byte) NÃO vira relatório "vazio": é falha passageira (corpo_vazio), tenta amanhã', async () => {
    const e = await baixar(new Response(new Uint8Array(0))).catch(x => x)
    expect(e).toBeInstanceOf(ReportingHttpError)
    expect(e).toMatchObject({ reason: 'corpo_vazio' })
  })

  it('resposta sem corpo (null) também é corpo_vazio', async () => {
    const e = await baixar(new Response(null, { status: 200 })).catch(x => x)
    expect(e).toMatchObject({ reason: 'corpo_vazio' })
  })

  it('erro durante a leitura do corpo (rede cortada, abort) chega a quem chamou, sem virar sucesso', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(new Uint8Array(10)); c.error(new DOMException('aborted', 'TimeoutError')) },
    })
    const e = await baixar(new Response(stream)).catch(x => x)
    expect(e).toMatchObject({ name: 'TimeoutError' })
  })
})
