// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { destinoDoLogin } from '@/app/cms/login/destino'

describe('destinoDoLogin (Ruling T21b: aba da IA sobrevive ao login)', () => {
  it('next exato + ia=claude recompõe a aba', () => {
    expect(destinoDoLogin('/cms/conectar-ia', 'claude')).toBe('/cms/conectar-ia?ia=claude')
    expect(destinoDoLogin('/cms/conectar-ia', 'chatgpt')).toBe('/cms/conectar-ia?ia=chatgpt')
  })
  it('ia fora da lista ou com lixo fica sem aba', () => {
    expect(destinoDoLogin('/cms/conectar-ia', 'gemini')).toBe('/cms/conectar-ia')
    expect(destinoDoLogin('/cms/conectar-ia', 'claude&x=1')).toBe('/cms/conectar-ia')
    expect(destinoDoLogin('/cms/conectar-ia', undefined)).toBe('/cms/conectar-ia')
  })
  it('outro next não leva ia', () => {
    expect(destinoDoLogin('/cms/outra', 'claude')).toBe('/cms/outra')
  })
  it('open redirect continua recusado', () => {
    expect(destinoDoLogin('//evil.com', 'claude')).toBe('/cms')
  })
  it('sem next vai ao /cms', () => {
    expect(destinoDoLogin(undefined, 'claude')).toBe('/cms')
  })
})
