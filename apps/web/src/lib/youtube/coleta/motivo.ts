// Catálogo fechado do que vai para a coluna `error` das tentativas. Nenhum texto de fora (corpo do Google, mensagem
// do Postgres, exceção) chega ao banco ou à nota: grava-se o CÓDIGO; o texto do dono sai de `textoDoMotivo`.
import { AnalyticsApiError } from './analytics-diario'

export const REASONS_CONHECIDOS = [
  'quotaExceeded', 'rateLimitExceeded', 'userRateLimitExceeded', 'dailyLimitExceeded', 'forbidden',
  'insufficientPermissions', 'badRequest', 'invalid', 'notFound', 'backendError', 'internalError',
] as const
export const MOTIVOS_FIXOS = ['erro_de_banco', 'forma_inesperada', 'corpo_invalido', 'retorno_inesperado', 'excecao'] as const
/** Sempre um valor que passa em `ehMotivo`. */
export type Motivo = string

const HTTP_RE = /^http_([1-5]\d\d)$/
const HTTP_REASON_RE = /^http_([1-5]\d\d)_(.+)$/
const COTA_RE = /(quota|limit)exceeded/i
const COTA_REASONS: readonly string[] = ['quotaExceeded', 'rateLimitExceeded', 'userRateLimitExceeded', 'dailyLimitExceeded']

const ehFixo = (x: string): boolean => (MOTIVOS_FIXOS as readonly string[]).includes(x)
const ehReasonConhecido = (x: string): boolean => (REASONS_CONHECIDOS as readonly string[]).includes(x)

export function ehMotivo(x: string): boolean {
  if (typeof x !== 'string') return false
  if (ehFixo(x) || HTTP_RE.test(x)) return true
  const m = HTTP_REASON_RE.exec(x)
  return !!m && ehReasonConhecido(m[2]!)
}

/** O objeto de erro do supabase-js: `{ code, message }`, sem ser uma exceção comum (as de sistema, como ECONNRESET, não são). */
function ehErroDeBanco(e: unknown): boolean {
  if (typeof e !== 'object' || e === null || Array.isArray(e)) return false
  const o = e as { code?: unknown; message?: unknown; name?: unknown }
  if (!('code' in o)) return false
  const codeOk = o.code === null || typeof o.code === 'string'
  const msgOk = o.message === undefined || o.message === null || typeof o.message === 'string'
  if (!codeOk || !msgOk) return false
  return !(e instanceof Error) || o.name === 'PostgrestError'
}

export function motivoDoErro(e: unknown): Motivo {
  if (e instanceof AnalyticsApiError) {
    if (e.reason === 'forma_inesperada' || e.reason === 'corpo_invalido') return e.reason
    const s = e.status
    if (!Number.isInteger(s) || s < 100 || s > 599) return 'excecao'
    const base = `http_${s}`
    if (typeof e.reason === 'string') {
      if (ehReasonConhecido(e.reason)) return `${base}_${e.reason}`
      // Cota com nome que não conhecemos: grava o sufixo fixo, nunca o texto (a regra do fim do alarme lê o sufixo).
      if (COTA_RE.test(e.reason)) return `${base}_quotaExceeded`
    }
    return base
  }
  if (ehErroDeBanco(e)) return 'erro_de_banco'
  return 'excecao'
}

const TEXTO_FIXO: Record<string, string> = {
  erro_de_banco: 'erro de banco',
  forma_inesperada: 'a resposta veio em forma inesperada',
  corpo_invalido: 'a resposta do YouTube veio ilegível',
  retorno_inesperado: 'o passo devolveu algo inesperado',
  excecao: 'erro interno (detalhe no Sentry)',
}

const TEXTO_REASON: Record<string, string> = {
  forbidden: 'o YouTube negou o acesso',
  insufficientPermissions: 'a autorização não cobre este dado',
  badRequest: 'o pedido foi recusado como inválido',
  invalid: 'o pedido foi recusado como inválido',
  notFound: 'o YouTube não encontrou o item',
  backendError: 'erro do YouTube',
  internalError: 'erro do YouTube',
}

export function textoDoMotivo(m: string): string {
  if (typeof m !== 'string' || !ehMotivo(m)) return 'erro não classificado'
  if (ehFixo(m)) return TEXTO_FIXO[m]!
  const comReason = HTTP_REASON_RE.exec(m)
  if (comReason) {
    const [, status, reason] = comReason
    if (COTA_REASONS.includes(reason!)) return `o YouTube recusou por cota (${status})`
    return `${TEXTO_REASON[reason!] ?? 'erro do YouTube'} (${status})`
  }
  const status = HTTP_RE.exec(m)![1]!
  const n = Number(status)
  if (n >= 500) return `erro do YouTube (${status})`
  if (n === 404 || n === 410) return `o YouTube não devolveu o vídeo (${status})`
  if (n === 429) return `o YouTube recusou por excesso de pedidos (${status})`
  if (n === 401 || n === 403) return `o YouTube negou o acesso (${status})`
  return `o YouTube recusou o pedido (${status})`
}
