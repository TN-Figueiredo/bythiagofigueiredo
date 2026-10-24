import { describe, expect, it } from 'vitest'
import { nomeDoLugar } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/lugar'

describe('nomeDoLugar', () => {
  it('país conhecido vira nome em pt-BR', () => expect(nomeDoLugar('pais:vn')).toBe('Vietnã'))
  it('país sem nome não lança e devolve o código', () => expect(() => nomeDoLugar('pais:xk')).not.toThrow())
  it('país com código inválido não lança', () => expect(() => nomeDoLugar('pais:1')).not.toThrow())
  it('local vira texto com 1ª maiúscula', () => expect(nomeDoLugar('local:sao-tome')).toBe('Sao tome'))
  it('outro prefixo devolve a chave', () => expect(nomeDoLugar('xx:foo')).toBe('xx:foo'))
})
