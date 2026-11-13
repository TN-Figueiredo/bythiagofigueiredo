// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { validarPedido } from '@/lib/youtube/observatorio/acesso-ia/oauth/pedido'

const CH = 'a'.repeat(43)
const REG = { redirect_uris: ['https://claude.ai/api/mcp/auth_callback'] }
const base = (o: Record<string, string> = {}, tirar: string[] = []) => {
  const q = new URLSearchParams({
    client_id: 'c1', redirect_uri: REG.redirect_uris[0]!, code_challenge: CH, code_challenge_method: 'S256', ...o,
  })
  for (const k of tirar) q.delete(k)
  return q
}

describe('validarPedido', () => {
  it('aceita o mínimo e preenche scope/resource padrão', () => {
    const r = validarPedido(base(), REG)
    expect(r).toEqual({ ok: true, p: { clientId: 'c1', redirectUri: REG.redirect_uris[0], codeChallenge: CH, state: null, scope: 'observatorio:read', resource: 'https://bythiagofigueiredo.com/api/mcp' } })
  })
  it('aceita offline_access + scope e state', () => {
    const r = validarPedido(base({ scope: 'offline_access observatorio:read', state: 'xyz' }), REG)
    expect(r.ok && r.p.state).toBe('xyz')
    expect(r.ok && r.p.scope).toBe('observatorio:read')
  })
  it('client_id ausente = cliente; redirect ausente ou diferente (inclusive barra) = redirect', () => {
    expect(validarPedido(base({}, ['client_id']), REG)).toEqual({ ok: false, erro: 'cliente' })
    expect(validarPedido(base({}, ['redirect_uri']), REG)).toEqual({ ok: false, erro: 'redirect' })
    expect(validarPedido(base({ redirect_uri: REG.redirect_uris[0] + '/' }), REG)).toEqual({ ok: false, erro: 'redirect' })
  })
  it('code_challenge ausente/ruim, método ≠ S256', () => {
    for (const q of [base({}, ['code_challenge']), base({ code_challenge: 'a'.repeat(42) }), base({ code_challenge: 'a'.repeat(42) + '=' }), base({ code_challenge_method: 'plain' }), base({}, ['code_challenge_method'])]) {
      const r = validarPedido(q, REG)
      expect(r.ok === false && 'erro' in r && r.erro).toBe('invalid_request')
    }
  })
  it('state > 512 = invalid_request; 512 ok', () => {
    expect(validarPedido(base({ state: 's'.repeat(513) }), REG)).toMatchObject({ ok: false, erro: 'invalid_request' })
    expect(validarPedido(base({ state: 's'.repeat(512) }), REG).ok).toBe(true)
  })
  it('scope fora = invalid_scope', () => {
    expect(validarPedido(base({ scope: 'observatorio:read admin' }), REG)).toMatchObject({ ok: false, erro: 'invalid_scope' })
  })
  it('resource diferente (inclusive com barra) = invalid_target', () => {
    const r = validarPedido(base({ resource: 'https://bythiagofigueiredo.com/api/mcp/' }), REG)
    expect(r).toEqual({ ok: false, erro: 'invalid_target', descricao: 'use https://bythiagofigueiredo.com/api/mcp' })
  })
})
