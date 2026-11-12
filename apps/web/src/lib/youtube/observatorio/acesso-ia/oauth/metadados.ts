import { NextResponse, type NextRequest } from 'next/server'
import { EMISSOR, ESCOPO, RECURSO, hostDoRecurso, oauthLigado } from './config'

/** RFC 9728. */
export function metadadoDoRecurso(): object {
  return {
    resource: RECURSO,
    authorization_servers: [EMISSOR],
    scopes_supported: [ESCOPO],
    bearer_methods_supported: ['header'],
  }
}

/** RFC 8414. */
export function metadadoDoEmissor(): object {
  return {
    issuer: EMISSOR,
    authorization_endpoint: `${EMISSOR}/api/oauth/authorize`,
    token_endpoint: `${EMISSOR}/api/oauth/token`,
    registration_endpoint: `${EMISSOR}/api/oauth/register`,
    revocation_endpoint: `${EMISSOR}/api/oauth/revoke`,
    scopes_supported: [ESCOPO],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    authorization_response_iss_parameter_supported: true,
  }
}

/** Trava fechada ou host fora da lista = 404 (D13). Sem CORS, de propósito. */
export function responderMetadado(req: NextRequest, corpo: () => object): NextResponse {
  const host = req.headers.get('host') ?? ''
  if (!oauthLigado() || !hostDoRecurso(host)) {
    return new NextResponse(null, { status: 404 })
  }
  return NextResponse.json(corpo())
}
