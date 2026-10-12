// Cliente da YouTube Reporting API. Todas as chamadas levam o token do canal dono.
// O `fetch` é injetado: quem chama passa um fetch que já aplica o prazo do passo.
import { createHash } from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'
import { motivoDoGoogle } from '@/lib/youtube/coleta/google-erro'
import { ArquivoGrandeDemaisError, ReportingHttpError, type Job, type Report, type ReportType } from './types'

export const REPORTING_BASE = 'https://youtubereporting.googleapis.com/v1'
const MAX_PAGINAS = 20

/** A lista ainda tinha `nextPageToken` depois do limite de páginas: o que veio é parcial e NÃO pode ser usado como se fosse inteiro. */
export class PaginacaoExcedidaError extends Error {
  constructor(recurso: string) {
    super(`a lista ${recurso} passou de ${MAX_PAGINAS} páginas; a resposta do YouTube está incompleta`)
    this.name = 'PaginacaoExcedidaError'
  }
}

/** Teto do corpo que CHEGA da rede (o gzip). O maior relatório real até hoje tem 564 bytes comprimidos. Vale para o
 *  `Content-Length` e, na falta dele, para a leitura do corpo, que aborta ao ultrapassar. */
export const MAX_GZ_BYTES = 10 * 1024 * 1024
/** Teto do CSV DESCOMPRIMIDO, em bytes. Os relatórios são CSV (razão de compressão de 10x a 20x): 10 MB de gzip podem ser
 *  100 a 200 MB, e uma bomba, bem mais. Conta de memória (função da Vercel com 1 GB no pior caso): `empacotarCsv` segura ao
 *  mesmo tempo o buffer (N), a string do `toString` (N a 2N) e o array do `split` (até 2N com o custo por linha), cerca de
 *  5N no pico, mais ~300 MB de base do Next. Com N = 64 MB são ~320 MB de pico, ~620 MB no total: cabe com folga. 100 MB
 *  já passaria de 800 MB. Mais de 64 MB de CSV é mais de 100 vezes o maior real (564 bytes comprimidos). */
export const MAX_CSV_BYTES = 64 * 1024 * 1024

export interface PacoteCsv {
  /** Sempre gzip. */
  gz: Buffer
  /** Do CSV descomprimido. */
  sha256: string
  /** Linhas de dado (sem o cabeçalho). */
  rowCount: number
}

export interface ReportingClient {
  reportTypesList(): Promise<ReportType[]>
  jobsList(): Promise<Job[]>
  jobsCreate(i: { reportTypeId: string; name: string }): Promise<Job>
  reportsList(jobId: string, o?: { createdAfter?: string; pageToken?: string }): Promise<{ reports: Report[]; nextPageToken: string | null }>
  download(downloadUrl: string): Promise<PacoteCsv>
}

/** `csv_gz` é sempre gzip: se os dois primeiros bytes são 1f 8b guarda como veio; senão comprime.
 *  Lança `ArquivoGrandeDemaisError` (lado `descomprimido`) quando o CSV passa de MAX_CSV_BYTES: a descompressão para no teto,
 *  nunca materializa o resto. Bytes que o zlib não abre continuam lançando o erro `Z_*` do zlib. */
export function empacotarCsv(bruto: Buffer): PacoteCsv {
  const jaGzip = bruto.length >= 2 && bruto[0] === 0x1f && bruto[1] === 0x8b
  const recusar = (): never => {
    throw new ArquivoGrandeDemaisError('descomprimido', bruto.length, `${bruto.length} bytes comprimidos descomprimem a mais de ${MAX_CSV_BYTES} bytes; teto ${MAX_CSV_BYTES} descomprimido`)
  }
  let csv: Buffer
  if (jaGzip) {
    try {
      csv = gunzipSync(bruto, { maxOutputLength: MAX_CSV_BYTES })
    } catch (e) {
      if ((e as { code?: unknown } | null)?.code === 'ERR_BUFFER_TOO_LARGE') return recusar()
      throw e
    }
  } else {
    if (bruto.length > MAX_CSV_BYTES) return recusar()
    csv = bruto
  }
  const gz = jaGzip ? bruto : gzipSync(bruto)
  const linhas = csv.toString('utf8').split('\n').filter(l => l.trim().length > 0).length
  return { gz, sha256: createHash('sha256').update(csv).digest('hex'), rowCount: Math.max(0, linhas - 1) }
}

/**
 * Lê o corpo do download com limite. `Content-Length` acima do teto: recusa sem ler o corpo. Sem ele (ou ilegível): lê em
 * pedaços e aborta ao passar do teto, em vez de `arrayBuffer()` cego. Corpo de 0 byte ou ausente NÃO é "relatório vazio":
 * um CSV da API sempre tem ao menos o cabeçalho; 0 byte é resposta cortada, e a falha é passageira (tenta amanhã).
 */
async function lerCorpoLimitado(res: Response): Promise<Buffer> {
  const declarado = res.headers.get('content-length')?.trim() ?? ''
  if (/^\d+$/.test(declarado) && Number(declarado) > MAX_GZ_BYTES) {
    await res.body?.cancel().catch(() => undefined)
    throw new ArquivoGrandeDemaisError('comprimido', Number(declarado), `${declarado} bytes comprimidos (Content-Length); teto ${MAX_GZ_BYTES}`)
  }
  if (!res.body) throw new ReportingHttpError(res.status, 'corpo_vazio')
  const leitor = res.body.getReader()
  const partes: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_GZ_BYTES) {
      await leitor.cancel().catch(() => undefined)
      throw new ArquivoGrandeDemaisError('comprimido', total, `mais de ${MAX_GZ_BYTES} bytes comprimidos lidos sem Content-Length confiável (parou em ${total}); teto ${MAX_GZ_BYTES}`)
    }
    partes.push(value)
  }
  if (total === 0) throw new ReportingHttpError(res.status, 'corpo_vazio')
  return Buffer.concat(partes, total)
}

/** Forma em que o PostgREST aceita e devolve `bytea`: `\x` + hex. */
export function paraBytea(buf: Buffer): string {
  return `\\x${buf.toString('hex')}`
}

export function deBytea(s: string): Buffer {
  return Buffer.from(s.slice(2), 'hex')
}

/** O `downloadUrl` vem da API e fica no banco antes de ser usado: o token só vai para hosts do Google, por https. */
function urlDeDownloadPermitida(url: string): boolean {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return false
  }
  if (u.protocol !== 'https:') return false
  return ['googleapis.com', 'google.com'].some(d => u.hostname === d || u.hostname.endsWith(`.${d}`))
}

export function classificarErro(e: unknown): 'api_nao_ativada' | 'sem_acesso' | 'nao_encontrado' | 'url_inesperada' | 'outro' {
  if (!(e instanceof ReportingHttpError)) return 'outro'
  if (e.reason === 'url_inesperada') return 'url_inesperada'
  if (e.status === 403 && (e.reason === 'accessNotConfigured' || e.reason === 'SERVICE_DISABLED')) return 'api_nao_ativada'
  if (e.status === 401) return 'sem_acesso'
  if (e.status === 403 && (e.reason === 'insufficientPermissions' || e.reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT')) return 'sem_acesso'
  if (e.status === 404) return 'nao_encontrado'
  return 'outro'
}

export function criarReportingClient(accessToken: string, f: typeof fetch): ReportingClient {
  const headers = { Authorization: `Bearer ${accessToken}` }

  async function pedir<T>(url: URL, init?: RequestInit): Promise<T> {
    const res = await f(url.toString(), { ...init, headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) } })
    if (!res.ok) throw new ReportingHttpError(res.status, await motivoDoGoogle(res))
    return (await res.json()) as T
  }

  async function paginar<T>(caminho: string, chave: string): Promise<T[]> {
    const todos: T[] = []
    let pageToken: string | undefined
    for (let i = 0; i < MAX_PAGINAS; i++) {
      const url = new URL(`${REPORTING_BASE}/${caminho}`)
      if (pageToken) url.searchParams.set('pageToken', pageToken)
      const body = await pedir<Record<string, unknown>>(url)
      todos.push(...((body[chave] as T[] | undefined) ?? []))
      pageToken = typeof body.nextPageToken === 'string' && body.nextPageToken ? body.nextPageToken : undefined
      if (!pageToken) break
    }
    // Saiu do laço com página seguinte pendente: lista incompleta. Devolvê-la calada faria um tipo ou job sumir sem aviso.
    if (pageToken) throw new PaginacaoExcedidaError(chave)
    return todos
  }

  return {
    reportTypesList: () => paginar<ReportType>('reportTypes', 'reportTypes'),

    jobsList: () => paginar<Job>('jobs', 'jobs'),

    jobsCreate: ({ reportTypeId, name }) =>
      pedir<Job>(new URL(`${REPORTING_BASE}/jobs`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportTypeId, name }),
      }),

    async reportsList(jobId, o = {}) {
      const url = new URL(`${REPORTING_BASE}/jobs/${encodeURIComponent(jobId)}/reports`)
      if (o.createdAfter) url.searchParams.set('createdAfter', o.createdAfter)
      if (o.pageToken) url.searchParams.set('pageToken', o.pageToken)
      const body = await pedir<{ reports?: Report[]; nextPageToken?: string }>(url)
      return { reports: body.reports ?? [], nextPageToken: body.nextPageToken ? body.nextPageToken : null }
    },

    async download(downloadUrl) {
      if (!urlDeDownloadPermitida(downloadUrl)) throw new ReportingHttpError(0, 'url_inesperada')
      const res = await f(downloadUrl, { headers: { ...headers, 'Accept-Encoding': 'gzip' } })
      if (!res.ok) throw new ReportingHttpError(res.status, await motivoDoGoogle(res))
      return empacotarCsv(await lerCorpoLimitado(res))
    },
  }
}
