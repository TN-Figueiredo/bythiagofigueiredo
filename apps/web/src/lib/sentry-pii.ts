// Sprint 4 H1 — Sentry PII scrubber (expanded Sprint 5a ops audit).
//
// LGPD + defensive hygiene: even though we've set `sendDefaultPii: false`,
// free-form error messages, breadcrumbs, and serialized request bodies
// regularly contain PII (Supabase RPC errors, user-facing validation
// strings, template rendering failures, fetch-breadcrumb bodies, etc).
// Run every outgoing event and breadcrumb through the scrubber before it
// leaves the SDK.
//
// Coverage (Sprint 5a expansion):
//   - Email addresses -> <email>
//   - Brazilian-shaped phone numbers -> [REDACTED_PHONE]
//   - CPF (Brazilian taxpayer id) -> [REDACTED_CPF]
//
// Scrubbed surfaces:
//   - event.message
//   - event.exception.values[].value
//   - event.breadcrumbs[].message
//   - event.breadcrumbs[].data (string values only — fetch request/response
//     payloads, fetch URLs, console args are typically here)
//   - event.request.headers (string values only)
//   - event.request.data (string payloads)
//
// Extracted from the `sentry.*.config.ts` trio so it can be unit-tested
// without wiring the full Sentry SDK into a mock.

import { redactSecrets } from './redact-secrets'
import {
  redigirQueryString,
  redigirSegredosDeUrl,
  redigirValorProfundo,
} from './redigir-segredos-de-url'

export const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g
// Mirrors the regex in apps/web/src/lib/lgpd/redact-third-party-pii.ts so
// both scrubbers stay in lock-step if one is tightened.
export const PHONE_RE = /\+?\d{2,3}[- ]?\(?\d{2,3}\)?[- ]?\d{4,5}[- ]?\d{4}/g
// Matches Brazilian CPF in either punctuated (123.456.789-00) or raw
// (12345678900) form. We don't bother with mod-11 validation: the goal is
// redaction, false positives are acceptable.
export const CPF_RE = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g
// IPv4: standard dotted-decimal (1.2.3.4). Word-boundary anchored to avoid
// matching version numbers like "2.0.0.0" when embedded in identifiers.
export const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g
// IPv6: full (8 groups) and compressed (::) forms. The second alternation
// covers all :: positions: leading (::1), middle (fe80::1, 2001:db8::ff00:42:8329), trailing.
export const IPV6_RE = /(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:(?:[0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4})?::(?:(?:[0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4})?/g

/** Replace email-shaped substrings with '<email>'. */
export function scrubEmail(value: string): string {
  return value.replace(EMAIL_RE, '<email>')
}

/** Run all PII regexes over a string, in redaction order that avoids collisions. */
export function scrubPiiString(value: string): string {
  // C2 (§4): redactSecrets PRIMEIRO — um token com dígitos pode casar
  // PHONE_RE/CPF_RE e sair meio-redigido se a ordem for invertida.
  // CPF first (tighter pattern) so phone RE doesn't eat the digits.
  // A5: `key=` da YouTube Data API, `api_key=`, `token=`, X-Pipeline-Key,
  // Authorization e o formato `AIza...` — redigidos também por NOME de parâmetro.
  return redigirSegredosDeUrl(redactSecrets(value))
    .replace(CPF_RE, '[REDACTED_CPF]')
    .replace(PHONE_RE, '[REDACTED_PHONE]')
    .replace(EMAIL_RE, '<email>')
    .replace(IPV4_RE, '[REDACTED_IP]')
    .replace(IPV6_RE, '[REDACTED_IP]')
}

// Minimal subset of the Sentry Event shape we care about. Typing it locally
// avoids pinning this helper to `@sentry/types` at test time.
interface ScrubbableBreadcrumb {
  message?: string
  data?: Record<string, unknown>
}
interface ScrubbableRequest {
  headers?: Record<string, unknown>
  data?: unknown
  // C2: o token de 60 d viaja em query string (api-client.ts) e chega aqui
  // pelo evento de request e pelo breadcrumb undici.
  url?: string
  // A5: string, objeto `{ nome: valor }` ou lista de pares `[nome, valor]`.
  query_string?: unknown
}
interface ScrubbableSpan {
  description?: string
  data?: Record<string, unknown>
  tags?: Record<string, unknown>
}
interface ScrubbableEvent {
  message?: string
  exception?: {
    values?: Array<{ value?: string }>
  }
  breadcrumbs?: Array<ScrubbableBreadcrumb>
  request?: ScrubbableRequest
  // C2: forma de *transaction*. Num evento de transaction a chamada HTTP é um
  // span `http.client` cuja description e cujo data carregam a URL inteira —
  // sem isto, `beforeSendTransaction` só troca o caminho pelo qual os 10 % de
  // tracesSampleRate sobem o token.
  spans?: Array<ScrubbableSpan>
  // A5: o SDK não limpa estes campos; o código do site grava URL/mensagem neles
  // (`captureException(e, { extra, tags })`) e `contexts.trace.data` de uma
  // transaction carrega `http.query`/`url.query`/`url.full`.
  extra?: Record<string, unknown>
  contexts?: Record<string, unknown>
  tags?: Record<string, unknown>
  logentry?: { message?: string; formatted?: string }
  transaction?: string
}

function scrubRecordStrings(obj: Record<string, unknown> | undefined): void {
  if (!obj) return
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    if (typeof v === 'string') {
      obj[k] = scrubPiiString(v)
    }
  }
}

/**
 * Um erro dentro de um gancho do Sentry não pode derrubar o envio nem a requisição:
 * cada seção roda isolada; se uma falha, `falha` descarta o conteúdo daquela seção
 * (fail-closed: o que não deu para limpar não sobe).
 */
function secao(fn: () => void, falha?: () => void): void {
  try {
    fn()
  } catch {
    try {
      falha?.()
    } catch {
      // nada mais a fazer
    }
  }
}

/** Limpa um registro `data`: strings do 1º nível com a PII completa, o resto (aninhado, por nome) só segredos. */
function scrubDataRecord(obj: Record<string, unknown> | undefined): void {
  if (!obj) return
  scrubRecordStrings(obj)
  redigirValorProfundo(obj)
}

// A5 · E14: as rotas `comments`, `commentThreads` e `channels` da YouTube Data API
// levam na consulta o id de comentário (`Ugx…`) e o id de canal de AUTOR (`UC…`) de
// terceiros. O SDK do Sentry não põe a consulta na URL: ela vai em `http.query` /
// `url.query`, e a URL completa em `http.url` / `url.full`. A regra é POR CAMPO e
// ancorada no CAMINHO, não no host (o teste de HTTP de verdade usa 127.0.0.1).
// `videos`, `playlistItems` e as demais rotas ficam como estão.
const ROTA_COMENTARIOS_RE = /\/youtube\/v3\/(?:comments|commentThreads|channels)(?:[?#\s]|$)/
const REDIGIDO = '[REDACTED]'
const CAMPOS_URL_COMENTARIOS = ['url', 'http.url', 'url.full'] as const
const CAMPOS_CONSULTA_COMENTARIOS = ['http.query', 'url.query', 'http.fragment', 'url.fragment'] as const

/** Corta tudo depois do primeiro `?` (ou `#`, se não houver `?`) de uma URL ou descrição. */
function cortarConsulta(texto: string): string {
  return texto.replace(/[?#][\s\S]*$/, (m) => m[0] + REDIGIDO)
}

const PROFUNDIDADE_ROTA_COMENTARIOS = 4

/**
 * Endurecimento (7a): em `data`, QUALQUER valor texto que case uma das rotas perde o que vem
 * depois do primeiro `?` (ou `#`), seja qual for a chave. Objetos e listas rasos entram até
 * `PROFUNDIDADE_ROTA_COMENTARIOS`; o que não é texto é ignorado. Só estas três rotas.
 */
function cortarRotasEmQualquerChave(valor: unknown, nivel: number): void {
  if (nivel > PROFUNDIDADE_ROTA_COMENTARIOS || valor === null || typeof valor !== 'object') return
  const reg = valor as Record<string, unknown>
  for (const k of Object.keys(reg)) {
    const v = reg[k]
    if (typeof v === 'string') {
      if (ROTA_COMENTARIOS_RE.test(v)) reg[k] = cortarConsulta(v)
    } else {
      cortarRotasEmQualquerChave(v, nivel + 1)
    }
  }
}

/**
 * Se `data` ou a descrição apontam para uma das rotas de comentário, redige a consulta
 * e o fragmento em `data` (no lugar) e devolve a descrição já cortada. Sem casamento,
 * não muda nada. Roda ANTES de `scrubDataRecord`. Pode lançar: quem chama está dentro
 * de `secao`, que descarta o campo (fail-closed).
 */
function redigirConsultaDeComentarios(
  data: Record<string, unknown> | undefined,
  descricao?: string,
): string | undefined {
  const urls: string[] = []
  if (data) {
    cortarRotasEmQualquerChave(data, 0)
    for (const campo of CAMPOS_URL_COMENTARIOS) {
      const v = data[campo]
      if (typeof v === 'string') urls.push(v)
    }
  }
  if (typeof descricao === 'string') urls.push(descricao)
  if (!urls.some((u) => ROTA_COMENTARIOS_RE.test(u))) return descricao
  if (data) {
    for (const campo of CAMPOS_URL_COMENTARIOS) {
      const v = data[campo]
      if (typeof v === 'string') data[campo] = cortarConsulta(v)
    }
    for (const campo of CAMPOS_CONSULTA_COMENTARIOS) {
      // Qualquer tipo (texto, objeto, lista): o que não é texto também sai inteiro.
      if (campo in data) data[campo] = REDIGIDO
    }
  }
  return typeof descricao === 'string' ? cortarConsulta(descricao) : descricao
}

/**
 * Mutates an event in-place, replacing PII substrings in message,
 * exception values, breadcrumb messages + data, and the attached request
 * headers + data. Returns the same object so it can be used directly as a
 * `beforeSend` return value.
 *
 * A5: também redige segredos de URL (`key=` da YouTube Data API, `api_key=`,
 * `token=`, X-Pipeline-Key, Authorization) em TODAS as superfícies, inclusive
 * `http.query`/`url.query`/`http.url`/`url.full` dos spans e breadcrumbs, e em
 * `extra`, `contexts`, `tags`, `logentry`.
 */
export function scrubEventPii<T extends ScrubbableEvent>(event: T): T {
  secao(() => {
    if (event.message) event.message = scrubPiiString(event.message)
  })
  secao(() => {
    if (event.exception?.values) {
      for (const ex of event.exception.values) {
        if (ex.value) ex.value = scrubPiiString(ex.value)
      }
    }
  })
  secao(
    () => {
      if (event.breadcrumbs) {
        for (const b of event.breadcrumbs) scrubBreadcrumbPii(b)
      }
    },
    () => {
      event.breadcrumbs = undefined
    },
  )
  secao(
    () => {
      if (event.request) {
        const req = event.request
        scrubRecordStrings(req.headers)
        redigirValorProfundo(req.headers)
        if (typeof req.data === 'string') {
          req.data = scrubPiiString(req.data)
        } else if (req.data !== null && typeof req.data === 'object') {
          redigirValorProfundo(req.data)
        }
        if (typeof req.url === 'string') {
          req.url = scrubPiiString(req.url)
        }
        if (req.query_string !== undefined) {
          req.query_string =
            typeof req.query_string === 'string'
              ? scrubPiiString(req.query_string)
              : redigirQueryString(req.query_string)
        }
      }
    },
    () => {
      event.request = undefined
    },
  )
  secao(
    () => {
      if (event.spans) {
        for (const span of event.spans) {
          if (typeof span.description === 'string') {
            span.description = redigirConsultaDeComentarios(span.data, span.description) ?? span.description
          } else {
            redigirConsultaDeComentarios(span.data)
          }
          if (span.description) span.description = scrubPiiString(span.description)
          scrubDataRecord(span.data)
          redigirValorProfundo(span.tags)
        }
      }
    },
    () => {
      event.spans = undefined
    },
  )
  secao(
    () => {
      redigirValorProfundo(event.extra)
    },
    () => {
      event.extra = undefined
    },
  )
  secao(
    () => {
      redigirValorProfundo(event.contexts)
    },
    () => {
      event.contexts = undefined
    },
  )
  secao(
    () => {
      redigirValorProfundo(event.tags)
    },
    () => {
      event.tags = undefined
    },
  )
  secao(() => {
    if (event.logentry) {
      if (event.logentry.message) event.logentry.message = redigirSegredosDeUrl(event.logentry.message)
      if (event.logentry.formatted) event.logentry.formatted = redigirSegredosDeUrl(event.logentry.formatted)
    }
  })
  secao(() => {
    if (typeof event.transaction === 'string') event.transaction = redigirSegredosDeUrl(event.transaction)
  })
  return event
}

/**
 * `beforeBreadcrumb` shape — Sentry passes a single breadcrumb at a time.
 * Scrubs the breadcrumb's message + data (the SDK puts the outgoing request's
 * query in `data['http.query']`, apart from `data.url`).
 */
export function scrubBreadcrumbPii<T extends ScrubbableBreadcrumb>(
  breadcrumb: T,
): T {
  secao(() => {
    if (breadcrumb.message) breadcrumb.message = scrubPiiString(breadcrumb.message)
  })
  secao(
    () => {
      redigirConsultaDeComentarios(breadcrumb.data)
      scrubDataRecord(breadcrumb.data)
    },
    () => {
      breadcrumb.data = undefined
    },
  )
  return breadcrumb
}
