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
  if (!clientId) return { ok: false, erro: 'cliente' }
  const redirectUri = q.get('redirect_uri')
  if (!redirectUri || !registrado.redirect_uris.includes(redirectUri)) return { ok: false, erro: 'redirect' }

  const codeChallenge = q.get('code_challenge')
  if (!codeChallenge) return { ok: false, erro: 'invalid_request', descricao: 'code_challenge é obrigatório' }
  if (q.get('code_challenge_method') !== 'S256') {
    return { ok: false, erro: 'invalid_request', descricao: 'code_challenge_method deve ser S256' }
  }
  if (!CHALLENGE.test(codeChallenge)) {
    return { ok: false, erro: 'invalid_request', descricao: 'code_challenge deve ter 43 caracteres base64url' }
  }
  const state = q.get('state')
  if (state !== null && state.length > LIMITES.stateMax) {
    return { ok: false, erro: 'invalid_request', descricao: `state passa de ${LIMITES.stateMax} caracteres` }
  }
  const scope = q.get('scope')
  if (scope !== null) {
    const itens = scope.split(' ').filter((s) => s !== '')
    if (itens.some((s) => s !== ESCOPO && s !== 'offline_access')) {
      return { ok: false, erro: 'invalid_scope', descricao: `use apenas ${ESCOPO} e offline_access` }
    }
  }
  const resource = q.get('resource')
  if (resource !== null && resource !== RECURSO) {
    return { ok: false, erro: 'invalid_target', descricao: `use ${RECURSO}` }
  }
  return { ok: true, p: { clientId, redirectUri, codeChallenge, state, scope: ESCOPO, resource: RECURSO } }
}
