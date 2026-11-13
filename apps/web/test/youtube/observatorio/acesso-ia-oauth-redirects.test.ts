// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }))

import { clienteDoRedirect, clienteDaLista } from '../../../src/lib/youtube/observatorio/acesso-ia/oauth/redirects'

const CHATGPT = 'https://chatgpt.com/connector_platform_oauth_redirect'
const CLAUDE_AI = 'https://claude.ai/api/mcp/auth_callback'
const CLAUDE_COM = 'https://claude.com/api/mcp/auth_callback'
const ID64 = 'a'.repeat(64)

describe('clienteDoRedirect', () => {
  it('aceita as 3 URIs', () => {
    expect(clienteDoRedirect(CHATGPT)).toBe('chatgpt')
    expect(clienteDoRedirect(CLAUDE_AI)).toBe('claude')
    expect(clienteDoRedirect(CLAUDE_COM)).toBe('claude')
  })
  it.each([
    'https://claude.ai/api/mcp/auth_callback/../x',
    'https://claude.ai/api/mcp/auth_callback%2Fx',
    'https://claude.ai/api/mcp/auth_callback%2fx',
    `${CLAUDE_AI}?x=1`,
    `${CLAUDE_AI}#a`,
    'https://chatgpt.com.evil.com/connector_platform_oauth_redirect',
    'https://user@chatgpt.com/connector_platform_oauth_redirect',
    'https://chatgpt.com:443/connector_platform_oauth_redirect',
    'http://chatgpt.com/connector_platform_oauth_redirect',
    'https://*.chatgpt.com/connector_platform_oauth_redirect',
    'http://localhost:3000/cb',
    'http://127.0.0.1/cb',
    'nao e url',
  ])('recusa %s', (u) => {
    expect(clienteDoRedirect(u)).toBeNull()
  })
  it('regex estrita do chatgpt', () => {
    expect(clienteDoRedirect('https://chatgpt.com/connector/oauth/abc_DEF-123')).toBe('chatgpt')
    expect(clienteDoRedirect(`https://chatgpt.com/connector/oauth/${ID64}`)).toBe('chatgpt')
    expect(clienteDoRedirect('https://chatgpt.com/connector/oauth/')).toBeNull()
    expect(clienteDoRedirect('https://chatgpt.com/connector/oauth/a/b')).toBeNull()
    expect(clienteDoRedirect(`https://chatgpt.com/connector/oauth/${ID64}a`)).toBeNull()
    expect(clienteDoRedirect('https://evil.com/connector/oauth/x')).toBeNull()
    expect(clienteDoRedirect('https://chatgpt.com/connector/oauth/x?x=1')).toBeNull()
    expect(clienteDoRedirect('https://chatgpt.com/connector/oauth/x#a')).toBeNull()
    expect(clienteDoRedirect('https://chatgpt.com/connector/oauth/x%2Fy')).toBeNull()
  })
})

describe('clienteDaLista', () => {
  it('aceita lista de um cliente só', () => {
    expect(clienteDaLista([CLAUDE_AI, CLAUDE_COM])).toEqual({ ok: true, cliente: 'claude', uris: [CLAUDE_AI, CLAUDE_COM] })
    expect(clienteDaLista([CHATGPT, 'https://chatgpt.com/connector/oauth/x'])).toMatchObject({ ok: true, cliente: 'chatgpt' })
  })
  it('recusa mista, vazia, > 5, não-array e item não-string', () => {
    expect(clienteDaLista([CHATGPT, CLAUDE_AI])).toMatchObject({ ok: false })
    expect(clienteDaLista([])).toEqual({ ok: false, host: null })
    expect(clienteDaLista(Array(6).fill(CLAUDE_AI))).toMatchObject({ ok: false })
    expect(clienteDaLista('x')).toEqual({ ok: false, host: null })
    expect(clienteDaLista([1])).toEqual({ ok: false, host: null })
  })
  it('recusa devolve o host seguro da 1ª URI recusada', () => {
    expect(clienteDaLista([CLAUDE_AI, 'https://evil.com/x?t=segredo'])).toEqual({ ok: false, host: 'evil.com' })
    expect(clienteDaLista([CHATGPT, CLAUDE_AI])).toEqual({ ok: false, host: 'claude.ai' })
  })
})
