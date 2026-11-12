// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { EMISSOR, RECURSO, ESCOPO } from '@/lib/youtube/observatorio/acesso-ia/oauth/config'
import {
  metadadoDoRecurso,
  metadadoDoEmissor,
} from '@/lib/youtube/observatorio/acesso-ia/oauth/metadados'
import { GET as getRecurso } from '@/app/.well-known/oauth-protected-resource/route'
import { GET as getRecursoMcp } from '@/app/.well-known/oauth-protected-resource/api/mcp/route'
import { GET as getEmissor } from '@/app/.well-known/oauth-authorization-server/route'
import { config } from '@/middleware'

const req = (host: string) =>
  new NextRequest('http://x/.well-known/y', { headers: { host } })

describe('metadados OAuth', () => {
  const antes = { ...process.env }
  beforeEach(() => {
    process.env.OBSERVATORIO_IA_OAUTH = 'on'
  })
  afterEach(() => {
    process.env = { ...antes }
  })

  it('C1-3: recurso sem barra final, um emissor', () => {
    const m = metadadoDoRecurso() as Record<string, unknown>
    expect(m.resource).toBe(RECURSO)
    expect(String(m.resource).endsWith('/')).toBe(false)
    expect(m.authorization_servers).toEqual([EMISSOR])
    expect(m.scopes_supported).toEqual([ESCOPO])
    expect(m.bearer_methods_supported).toEqual(['header'])
  })

  it('C1-3: responde sem x-site-id', async () => {
    for (const h of [getRecurso, getRecursoMcp]) {
      const r = await h(req('bythiagofigueiredo.com'))
      expect(r.status).toBe(200)
      expect((await r.json()).resource).toBe(RECURSO)
      expect(r.headers.get('access-control-allow-origin')).toBeNull()
    }
  })

  it('C1-3: matcher não casa .well-known e casa as rotas OAuth', () => {
    const re = new RegExp('^' + config.matcher[0] + '$')
    expect(re.test('/.well-known/oauth-protected-resource/api/mcp')).toBe(false)
    expect(re.test('/.well-known/oauth-authorization-server')).toBe(false)
    expect(re.test('/api/oauth/authorize')).toBe(true)
    expect(re.test('/oauth/consentimento')).toBe(true)
  })

  it('C1-4: emissor', async () => {
    const m = metadadoDoEmissor() as Record<string, unknown>
    expect(m.issuer).toBe(EMISSOR)
    expect(m.authorization_endpoint).toBe(`${EMISSOR}/api/oauth/authorize`)
    expect(m.token_endpoint).toBe(`${EMISSOR}/api/oauth/token`)
    expect(m.registration_endpoint).toBe(`${EMISSOR}/api/oauth/register`)
    expect(m.revocation_endpoint).toBe(`${EMISSOR}/api/oauth/revoke`)
    expect(m.code_challenge_methods_supported).toEqual(['S256'])
    expect(m.token_endpoint_auth_methods_supported).toEqual(['none'])
    expect(m.grant_types_supported).toEqual(['authorization_code', 'refresh_token'])
    expect(m.response_types_supported).toEqual(['code'])
    expect(m.authorization_response_iss_parameter_supported).toBe(true)
    expect(JSON.stringify(m)).not.toMatch(/openid/i)
    const r = await getEmissor(req('bythiagofigueiredo.com'))
    expect(r.status).toBe(200)
    expect((await r.json()).issuer).toBe(EMISSOR)
  })

  it('C1-2: sem a variável = 404 nos dois', async () => {
    delete process.env.OBSERVATORIO_IA_OAUTH
    expect((await getRecurso(req('bythiagofigueiredo.com'))).status).toBe(404)
    expect((await getRecursoMcp(req('bythiagofigueiredo.com'))).status).toBe(404)
    expect((await getEmissor(req('bythiagofigueiredo.com'))).status).toBe(404)
  })

  it('D13: host fora da lista = 404', async () => {
    for (const h of [getRecurso, getRecursoMcp, getEmissor]) {
      expect((await h(req('x.vercel.app'))).status).toBe(404)
    }
  })
})
