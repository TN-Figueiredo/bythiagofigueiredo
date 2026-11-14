import 'server-only'
import * as Sentry from '@sentry/nextjs'

export type TipoDeRecusa = 'limite_register' | 'limite_authorize' | 'teto_dia' | 'redirect'

type Estado = { hora: number; ultimaHoraAvisada: number | null; pendentes: number }

// Memória do processo: o limite de 1 aviso/hora/tipo vale por INSTÂNCIA de função (N instâncias quentes = até N eventos/hora).
const estados = new Map<TipoDeRecusa, Estado>()

const HORA_MS = 3_600_000

/** Só para teste. */
export function __zerarAvisos(): void {
  estados.clear()
}

/** Host em `[a-z0-9.-]{1,100}` ou null; nunca a URL inteira. */
export function hostSeguro(u: string): string | null {
  try {
    const h = new URL(u).hostname.toLowerCase()
    return h.length >= 1 && h.length <= 100 && /^[a-z0-9.-]+$/.test(h) ? h : null
  } catch {
    return null
  }
}

/**
 * Sentry `warning` no máximo 1 por hora (UTC) por tipo. `contagem` = recusas acumuladas desde o último aviso, incluindo esta.
 * Nunca recebe nem grava IP; o host, quando vem, passa por `hostSeguro` na origem (aqui só se confere de novo).
 */
export function avisarRecusa(tipo: TipoDeRecusa, host?: string): void {
  const hora = Math.floor(Date.now() / HORA_MS)
  const e = estados.get(tipo) ?? { hora, ultimaHoraAvisada: null, pendentes: 0 }
  e.pendentes += 1
  estados.set(tipo, e)
  if (e.ultimaHoraAvisada === hora) return
  const contagem = e.pendentes
  e.pendentes = 0
  e.ultimaHoraAvisada = hora
  e.hora = hora
  const h = host !== undefined && /^[a-z0-9.-]{1,100}$/.test(host) ? host : undefined
  Sentry.captureMessage(`acesso-ia: recusa ${tipo}`, {
    level: 'warning',
    tags: { component: 'acesso-ia-oauth', tipo },
    extra: { contagem, host: h },
  })
}
