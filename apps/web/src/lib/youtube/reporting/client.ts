// Cliente da YouTube Reporting API. Todas as chamadas levam o token do canal dono.
// O `fetch` é injetado: quem chama passa um fetch que já aplica o prazo do passo.
import { createHash } from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'
import { ReportingHttpError, type Job, type Report, type ReportType } from './types'

export const REPORTING_BASE = 'https://youtubereporting.googleapis.com/v1'
const MAX_PAGINAS = 20

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

/** `csv_gz` é sempre gzip: se os dois primeiros bytes são 1f 8b guarda como veio; senão comprime. */
export function empacotarCsv(bruto: Buffer): PacoteCsv {
  const jaGzip = bruto.length >= 2 && bruto[0] === 0x1f && bruto[1] === 0x8b
  const csv = jaGzip ? gunzipSync(bruto) : bruto
  const gz = jaGzip ? bruto : gzipSync(bruto)
  const linhas = csv.toString('utf8').split('\n').filter(l => l.trim().length > 0).length
  return { gz, sha256: createHash('sha256').update(csv).digest('hex'), rowCount: Math.max(0, linhas - 1) }
}

/** Forma em que o PostgREST aceita e devolve `bytea`: `\x` + hex. */
export function paraBytea(buf: Buffer): string {
  return `\\x${buf.toString('hex')}`
}

export function deBytea(s: string): Buffer {
  return Buffer.from(s.slice(2), 'hex')
}

/** Lê só o `reason` do erro do Google (formato antigo `errors[]` e novo `details[]`). O corpo não é guardado. */
async function motivoDoErro(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as {
      error?: { errors?: Array<{ reason?: string }>; details?: Array<{ reason?: string }> }
    }
    return body.error?.errors?.find(e => e.reason)?.reason ?? body.error?.details?.find(d => d.reason)?.reason ?? null
  } catch {
    return null
  }
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
    if (!res.ok) throw new ReportingHttpError(res.status, await motivoDoErro(res))
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
      if (!res.ok) throw new ReportingHttpError(res.status, await motivoDoErro(res))
      return empacotarCsv(Buffer.from(await res.arrayBuffer()))
    },
  }
}
