// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { nomeDoPais } from '@/lib/youtube/observatorio/proprio/pais-pt'

describe('nome do país em português', () => {
  it('BR: Brasil, do Brasil', () => expect(nomeDoPais('BR')).toEqual({ nome: 'Brasil', de: 'do Brasil' }))
  it('US: dos Estados Unidos', () => expect(nomeDoPais('US')).toEqual({ nome: 'Estados Unidos', de: 'dos Estados Unidos' }))
  it('PT: de Portugal', () => expect(nomeDoPais('PT')).toEqual({ nome: 'Portugal', de: 'de Portugal' }))
  it('AR: da Argentina', () => expect(nomeDoPais('AR')).toEqual({ nome: 'Argentina', de: 'da Argentina' }))
  it('NL: dos Países Baixos', () => expect(nomeDoPais('NL')).toEqual({ nome: 'Países Baixos', de: 'dos Países Baixos' }))
  it('CD: da República Democrática do Congo', () => expect(nomeDoPais('CD')).toEqual({ nome: 'República Democrática do Congo', de: 'da República Democrática do Congo' }))
  it('minúsculas valem', () => expect(nomeDoPais('br').de).toBe('do Brasil'))
  it('país fora da tabela: "de {nome}" (o padrão)', () => {
    const r = nomeDoPais('QA')
    expect(r.nome).toBe('Catar')
    expect(r.de).toBe('de Catar')
  })
  it('ZZ: não identificado', () => expect(nomeDoPais('ZZ')).toEqual({ nome: 'Não identificado', de: 'de país não identificado' }))
  it('"xx" inválido não lança', () => {
    expect(nomeDoPais('xx!')).toEqual({ nome: 'xx!', de: 'de xx!' })
    expect(nomeDoPais('')).toEqual({ nome: '', de: 'de ' })
    expect(nomeDoPais(null as unknown as string).nome).toBe('')
  })
  it('a tabela de artigos cobre 60 países ou mais', async () => {
    const m = await import('@/lib/youtube/observatorio/proprio/pais-pt')
    expect(m.PAISES_COM_ARTIGO_TOTAL).toBeGreaterThanOrEqual(60)
  })
})
