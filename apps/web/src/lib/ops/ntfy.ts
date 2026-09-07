// Transporte único do canal de garantia. Antes de C2 o único emissor mandava
// process.env.NTFY_URL cru para o fetch (uptime-probe/route.ts:44) e não olhava
// res.ok — endurecer o tópico ("põe atrás de auth") exigiria mudança de código
// no meio de um incidente. Com isto, endurecer o tópico é mudança de VALOR DE
// ENV: basic-auth na própria URL é extraída e vira header.
//
// REGRA-PII-NTFY (§0): o tópico é compartilhado e não autenticado. Nenhum
// `title` nem `body` que passe por aqui pode carregar @handle, token_error,
// ids ou tokens. A regra é imposta pelos emissores; este módulo é o transporte.

export type NtfyPriority = 'min' | 'low' | 'default' | 'high' | 'urgent'

export interface INtfyAlert {
  title: string
  /** Obrigatório e de forma fixa — nunca texto vindo da Meta. */
  body: string
  priority: NtfyPriority
  /** Valor FIXO por emissor (MUST) — literal, nunca calculado. */
  tags?: string[]
  /** Vira o header `Click`. */
  click?: string
}

export interface INtfyResult {
  alerted: boolean
  /** MUST: `ntfyStatus`, nunca `status` — o uptime-probe espalha isto num
   *  objeto que já tem `status` ('ok'|'degraded'|'down'). */
  ntfyStatus?: number
  reason?: string
  alertError?: string
}

const NTFY_TIMEOUT_MS = 4_000
const RETRY_BACKOFF_MS = 1_000
const MAX_ATTEMPTS = 2

/** Terminal = o tópico recusou por configuração (auth/inexistente), não por carga. */
export function isTerminalRefusal(r: INtfyResult): boolean {
  if (r.alerted) return false
  if (r.ntfyStatus === undefined) return false // rede/timeout => transitório
  return r.ntfyStatus !== 429 && r.ntfyStatus < 500
}

function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function splitCredentials(raw: string): { url: string; authorization: string | null } | null {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  const user = u.username
  const pass = u.password
  u.username = ''
  u.password = ''
  if (!user) return { url: u.toString(), authorization: null }
  const pair = `${decodeURIComponent(user)}:${decodeURIComponent(pass)}`
  return { url: u.toString(), authorization: `Basic ${Buffer.from(pair).toString('base64')}` }
}

export async function sendNtfyAlert(alert: INtfyAlert): Promise<INtfyResult> {
  const raw = process.env.NTFY_URL
  if (!raw) return { alerted: false, reason: 'NTFY_URL unset' }

  const parsed = splitCredentials(raw)
  if (!parsed) return { alerted: false, reason: 'NTFY_URL malformed' }

  const headers: Record<string, string> = {
    Title: alert.title,
    Priority: alert.priority,
  }
  if (alert.tags && alert.tags.length > 0) headers.Tags = alert.tags.join(',')
  if (alert.click) headers.Click = alert.click
  if (parsed.authorization) headers.Authorization = parsed.authorization

  let last: INtfyResult = { alerted: false, reason: 'not attempted' }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS))
    try {
      const res = await fetch(parsed.url, {
        method: 'POST',
        headers,
        body: alert.body,
        signal: AbortSignal.timeout(NTFY_TIMEOUT_MS),
      })
      if (res.ok) return { alerted: true, ntfyStatus: res.status }
      last = { alerted: false, ntfyStatus: res.status }
      // Terminal não re-tenta: 401/403/404 não melhoram em 1 s.
      if (!isTransientStatus(res.status)) return last
    } catch (err) {
      last = { alerted: false, alertError: err instanceof Error ? err.message : String(err) }
    }
  }

  return last
}

export async function sendNtfyHeartbeat(): Promise<INtfyResult> {
  return sendNtfyAlert({
    title: 'Instagram ops heartbeat',
    body: 'alert channel alive',
    priority: 'low',
    tags: ['white_check_mark'],
  })
}
