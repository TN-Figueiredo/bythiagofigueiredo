// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import {
  EMISSOR,
  RECURSO,
  ESCOPO,
  PRAZOS,
  LIMITES,
  REDIRECTS,
  oauthLigado,
  segredoDeIp,
  hostDoRecurso,
} from '../../../src/lib/youtube/observatorio/acesso-ia/oauth/config'

const ORIG = { ...process.env }
afterEach(() => {
  delete process.env.OBSERVATORIO_IA_OAUTH
  delete process.env.OBSERVATORIO_IA_IP_SEGREDO
  if (ORIG.OBSERVATORIO_IA_OAUTH !== undefined) process.env.OBSERVATORIO_IA_OAUTH = ORIG.OBSERVATORIO_IA_OAUTH
  if (ORIG.OBSERVATORIO_IA_IP_SEGREDO !== undefined) process.env.OBSERVATORIO_IA_IP_SEGREDO = ORIG.OBSERVATORIO_IA_IP_SEGREDO
})

describe('constantes', () => {
  it('valores fixos', () => {
    expect(EMISSOR).toBe('https://bythiagofigueiredo.com')
    expect(RECURSO).toBe('https://bythiagofigueiredo.com/api/mcp')
    expect(ESCOPO).toBe('observatorio:read')
    expect(PRAZOS).toEqual({ acessoS: 3600, refreshDias: 30, codigoMin: 10, pedidoMin: 10, carenciaRefreshS: 30 })
    expect(LIMITES).toEqual({ registerHora: 30, registerDia: 200, authorizeHora: 60, authorizeDia: 2000, stateMax: 512 })
  })
  it('REDIRECTS tem exatamente as 3 URIs', () => {
    expect(REDIRECTS).toEqual({
      'https://chatgpt.com/connector_platform_oauth_redirect': 'chatgpt',
      'https://claude.ai/api/mcp/auth_callback': 'claude',
      'https://claude.com/api/mcp/auth_callback': 'claude',
    })
    expect(Object.keys(REDIRECTS)).toHaveLength(3)
  })
})

describe('oauthLigado', () => {
  it('ausente = false', () => {
    delete process.env.OBSERVATORIO_IA_OAUTH
    expect(oauthLigado()).toBe(false)
  })
  it.each(['ON', 'on ', '1', '', 'off'])('%j = false', (v) => {
    process.env.OBSERVATORIO_IA_OAUTH = v
    expect(oauthLigado()).toBe(false)
  })
  it('on = true, lido a cada chamada', () => {
    process.env.OBSERVATORIO_IA_OAUTH = 'on'
    expect(oauthLigado()).toBe(true)
    process.env.OBSERVATORIO_IA_OAUTH = 'off'
    expect(oauthLigado()).toBe(false)
    expect(oauthLigado({ OBSERVATORIO_IA_OAUTH: 'on' } as NodeJS.ProcessEnv)).toBe(true)
  })
})

describe('segredoDeIp', () => {
  it('ausente = null', () => {
    delete process.env.OBSERVATORIO_IA_IP_SEGREDO
    expect(segredoDeIp()).toBeNull()
  })
  it('vazio = null', () => {
    process.env.OBSERVATORIO_IA_IP_SEGREDO = ''
    expect(segredoDeIp()).toBeNull()
  })
  it('16 bytes = null', () => {
    process.env.OBSERVATORIO_IA_IP_SEGREDO = Buffer.alloc(16, 1).toString('base64')
    expect(segredoDeIp()).toBeNull()
  })
  it('32 bytes = Buffer de 32', () => {
    process.env.OBSERVATORIO_IA_IP_SEGREDO = Buffer.alloc(32, 7).toString('base64')
    const s = segredoDeIp()
    expect(Buffer.isBuffer(s)).toBe(true)
    expect(s?.length).toBe(32)
  })
})

describe('hostDoRecurso', () => {
  const prod = { NODE_ENV: 'production' } as NodeJS.ProcessEnv
  const dev = { NODE_ENV: 'development' } as NodeJS.ProcessEnv
  it('domínio próprio nos dois modos', () => {
    expect(hostDoRecurso('bythiagofigueiredo.com', prod)).toBe(true)
    expect(hostDoRecurso('bythiagofigueiredo.com', dev)).toBe(true)
  })
  it('localhost só fora de produção', () => {
    expect(hostDoRecurso('localhost:3000', prod)).toBe(false)
    expect(hostDoRecurso('localhost:3000', dev)).toBe(true)
  })
  it('vercel.app nunca', () => {
    expect(hostDoRecurso('x.vercel.app', prod)).toBe(false)
    expect(hostDoRecurso('x.vercel.app', dev)).toBe(false)
  })
})
