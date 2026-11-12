import type { Cliente } from '../liberacao'

export const EMISSOR = 'https://bythiagofigueiredo.com'
export const RECURSO = 'https://bythiagofigueiredo.com/api/mcp'
export const ESCOPO = 'observatorio:read'
export const PRAZOS = {
  acessoS: 3600,
  refreshDias: 30,
  codigoMin: 10,
  pedidoMin: 10,
  carenciaRefreshS: 30,
} as const
export const LIMITES = {
  registerHora: 30,
  registerDia: 200,
  authorizeHora: 60,
  authorizeDia: 2000,
  stateMax: 512,
} as const

/** As 3 URIs literais (D5). A regex do chatgpt `connector/oauth/<id>` é da T15b. */
export const REDIRECTS: Readonly<Record<string, Cliente>> = {
  'https://chatgpt.com/connector_platform_oauth_redirect': 'chatgpt',
  'https://claude.ai/api/mcp/auth_callback': 'claude',
  'https://claude.com/api/mcp/auth_callback': 'claude',
}

/** Lido a cada chamada: só o valor exato `on` liga. */
export function oauthLigado(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OBSERVATORIO_IA_OAUTH === 'on'
}

/** base64 de exatamente 32 bytes; ausente, vazio ou de outro tamanho = null. */
export function segredoDeIp(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  const v = env.OBSERVATORIO_IA_IP_SEGREDO
  if (!v) return null
  const b = Buffer.from(v, 'base64')
  return b.length === 32 ? b : null
}

/** Host aceito como recurso; localhost só fora de produção. */
export function hostDoRecurso(host: string, env: NodeJS.ProcessEnv = process.env): boolean {
  if (host === 'bythiagofigueiredo.com') return true
  if (env.NODE_ENV !== 'production' && /^localhost:\d{1,5}$/.test(host)) return true
  return false
}
