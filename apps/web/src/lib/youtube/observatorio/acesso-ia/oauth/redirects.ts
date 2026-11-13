import type { Cliente } from '../liberacao'
import { REDIRECTS } from './config'
import { hostSeguro } from './aviso'

// Única regex permitida (r2c, D14).
const CHATGPT_CONECTOR = /^https:\/\/chatgpt\.com\/connector\/oauth\/[A-Za-z0-9_-]{1,64}$/

const MAX_URIS = 5

/** Cliente dono da URI de redirect, ou null se fora da lista fechada. */
export function clienteDoRedirect(u: string): Cliente | null {
  if (typeof u !== 'string') return null
  let url: URL
  try {
    url = new URL(u)
  } catch {
    return null
  }
  if (url.href !== u) return null
  if (url.hash || u.includes('#')) return null
  if (url.username || url.password || url.port || url.search || u.includes('?')) return null
  if (/%2f/i.test(url.pathname) || url.pathname.split('/').includes('..')) return null
  if (Object.prototype.hasOwnProperty.call(REDIRECTS, u)) return REDIRECTS[u] ?? null
  if (CHATGPT_CONECTOR.test(u)) return 'chatgpt'
  return null
}

export function clienteDaLista(
  uris: unknown,
): { ok: true; cliente: Cliente; uris: string[] } | { ok: false; host: string | null } {
  if (!Array.isArray(uris) || uris.length === 0) return { ok: false, host: null }
  const recusa = (i: number): { ok: false; host: string | null } => {
    const x: unknown = uris[i]
    return { ok: false, host: typeof x === 'string' ? hostSeguro(x) : null }
  }
  if (uris.length > MAX_URIS) return recusa(MAX_URIS)
  let cliente: Cliente | null = null
  for (let i = 0; i < uris.length; i++) {
    const x: unknown = uris[i]
    const c = typeof x === 'string' ? clienteDoRedirect(x) : null
    if (c === null) return recusa(i)
    if (cliente === null) cliente = c
    else if (c !== cliente) return recusa(i)
  }
  if (cliente === null) return { ok: false, host: null }
  return { ok: true, cliente, uris: uris as string[] }
}
