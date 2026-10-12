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

/** Teto do que se LÊ do corpo da resposta, em bytes (2 MB; era 10 MB, decisão do dono em 12/10/2026: ninguém provou que o banco
 *  grava um bruto de 10 MB, que viraria 20 MB em hex no upsert, e o maior relatório real tem 564 bytes). Estourar um teto
 *  baixo é falha SEGURA: `grande_demais` terminal, cron vermelho, e o dono sobe o teto com prova e devolve o relatório à fila.
 *  O que ele mede depende do que o `fetch` entrega: com `Content-Encoding: gzip` o fetch descomprime sozinho (gzip de
 *  TRANSPORTE, não o .gz do relatório) e o corpo lido já é o CSV puro; sem ele o corpo é o que veio no fio. Ver `lerCorpoLimitado`. */
export const MAX_GZ_BYTES = 2 * 1024 * 1024
/** Teto do CSV DESCOMPRIMIDO, em bytes, para um corpo que é um .gz de verdade (gzip do relatório, não o de transporte).
 *  Memória MEDIDA em 12/10/2026 (Node 25, `empacotarCsv` com gunzip + contagem + sha256, CSV de 64 MB, base de 123 MB):
 *  contando linhas no Buffer o pico sobe +69 MB (~1,1 N) com linhas de 9, 40 ou 200 bytes; com `toString` + `split` era
 *  +759 MB (linhas de 9 bytes), +265 MB (40 bytes) e +166 MB (200 bytes). Pico absoluto de 192 MB: folga clara num processo
 *  de 1 GB. O maior relatório real tem 564 bytes comprimidos, ou seja, 64 MB já é ordens de grandeza acima do real. */
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
    throw new ArquivoGrandeDemaisError('descomprimido', bruto.length, `${bruto.length} bytes de .gz descomprimem a mais de ${MAX_CSV_BYTES} bytes; teto ${MAX_CSV_BYTES} descomprimido`)
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
  return { gz, sha256: createHash('sha256').update(csv).digest('hex'), rowCount: Math.max(0, contarLinhasComConteudo(csv) - 1) }
}

/** Linhas com algum byte que não seja espaço, tab, CR, VT ou FF, contadas direto no Buffer: sem `toString` nem `split`, a
 *  memória fica em ~N (um CSV de linhas curtas custava 13 N). Igual ao antigo `split('\n').filter(l => l.trim())` para ASCII;
 *  só difere numa linha feita apenas de espaço Unicode (NBSP, BOM), que nunca aparece nos relatórios do YouTube. */
function contarLinhasComConteudo(buf: Buffer): number {
  let linhas = 0
  let temConteudo = false
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i]!
    if (b === 0x0a) {
      if (temConteudo) linhas++
      temConteudo = false
    } else if (b !== 0x20 && b !== 0x09 && b !== 0x0d && b !== 0x0b && b !== 0x0c) {
      temConteudo = true
    }
  }
  return temConteudo ? linhas + 1 : linhas
}

/**
 * Lê o corpo do download com limite. `Content-Length` acima do teto: recusa sem ler o corpo. Sem ele (ou ilegível): lê em
 * pedaços e aborta ao passar do teto, em vez de `arrayBuffer()` cego. Corpo de 0 byte ou ausente NÃO é "relatório vazio":
 * um CSV da API sempre tem ao menos o cabeçalho; 0 byte é resposta cortada, e a falha é passageira (tenta amanhã).
 *
 * O que cada medida é (provado com o fetch real em reporting-client.test.ts):
 *  - `Content-Length` é o tamanho NO FIO. Com `Content-Encoding: gzip` (o `Accept-Encoding: gzip` que mandamos convida a isso)
 *    é o gzip de transporte, bem menor que o CSV.
 *  - O fetch descomprime sozinho esse gzip de transporte: o que `getReader()` entrega já é o CSV puro, e a soma lida é de CSV
 *    descomprimido. Logo o teto de leitura (MAX_GZ_BYTES) limita o CSV que passa por aqui, não "10 MB de gzip".
 *  - O .gz do próprio relatório (corpo que começa com 1f 8b) só aparece quando o servidor não aplica gzip de transporte; é ele
 *    que `empacotarCsv` descomprime sob o outro teto (MAX_CSV_BYTES).
 *  Por isso as notas dizem "bytes lidos do corpo" e só chamam de "comprimidos" o .gz que de fato foi medido como tal.
 */
async function lerCorpoLimitado(res: Response): Promise<Buffer> {
  const declarado = res.headers.get('content-length')?.trim() ?? ''
  if (/^\d+$/.test(declarado) && Number(declarado) > MAX_GZ_BYTES) {
    await res.body?.cancel().catch(() => undefined)
    throw new ArquivoGrandeDemaisError('corpo', Number(declarado), `Content-Length de ${declarado} bytes (tamanho no fio); teto ${MAX_GZ_BYTES} bytes lidos do corpo`)
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
      throw new ArquivoGrandeDemaisError('corpo', total, `mais de ${MAX_GZ_BYTES} bytes lidos do corpo, já depois do gzip de transporte se houver (parou em ${total}); teto ${MAX_GZ_BYTES}`)
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
