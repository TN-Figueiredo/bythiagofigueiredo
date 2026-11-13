import { ESCOPO, LIMITES, RECURSO } from './config'

export type PedidoValido = {
  clientId: string
  redirectUri: string
  codeChallenge: string
  state: string | null
  scope: 'observatorio:read'
  resource: string
}

export type ResultadoPedido =
  | { ok: true; p: PedidoValido }
  | { ok: false; erro: 'cliente' | 'redirect' }
  | { ok: false; erro: 'invalid_request' | 'invalid_scope' | 'invalid_target'; descricao: string }

const CHALLENGE = /^[A-Za-z0-9_-]{43}$/

/** Pura: `registrado` é a linha já lida do cliente. `redirect_uri` por igualdade de string. */
export function validarPedido(q: URLSearchParams, registrado: { redirect_uris: string[] }): ResultadoPedido {
  const clientId = q.get('client_id')
  if (!clientId || q.getAll('client_id').length > 1) return { ok: false, erro: 'cliente' }
  const redirectUri = q.get('redirect_uri')
  if (!redirectUri || q.getAll('redirect_uri').length > 1 || !registrado.redirect_uris.includes(redirectUri)) {
    return { ok: false, erro: 'redirect' }
  }
  for (const k of ['code_challenge', 'code_challenge_method', 'state', 'scope', 'resource']) {
    if (q.getAll(k).length > 1) {
      return { ok: false, erro: 'invalid_request', descricao: `repeated parameter ${k}` }
    }
  }

  const codeChallenge = q.get('code_challenge')
  if (!codeChallenge) return { ok: false, erro: 'invalid_request', descricao: 'code_challenge required' }
  if (q.get('code_challenge_method') !== 'S256') {
    return { ok: false, erro: 'invalid_request', descricao: 'code_challenge_method must be S256' }
  }
  if (!CHALLENGE.test(codeChallenge)) {
    return { ok: false, erro: 'invalid_request', descricao: 'code_challenge must be 43 base64url characters' }
  }
  const state = q.get('state')
  if (state !== null && state.length > LIMITES.stateMax) {
    return { ok: false, erro: 'invalid_request', descricao: `state longer than ${LIMITES.stateMax} characters` }
  }
  const scope = q.get('scope')
  if (scope !== null) {
    const itens = scope.split(' ').filter((s) => s !== '')
    if (itens.some((s) => s !== ESCOPO && s !== 'offline_access')) {
      return { ok: false, erro: 'invalid_scope', descricao: `use only ${ESCOPO} and offline_access` }
    }
  }
  const resource = q.get('resource')
  if (resource !== null && resource !== RECURSO) {
    return { ok: false, erro: 'invalid_target', descricao: `use ${RECURSO}` }
  }
  return { ok: true, p: { clientId, redirectUri, codeChallenge, state, scope: ESCOPO, resource: RECURSO } }
}
