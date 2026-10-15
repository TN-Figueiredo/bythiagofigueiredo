// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { ORIGEM_LOTE, APARELHO_LOTE } from '@/lib/youtube/reporting/codigos'
import {
  ORDEM_ORIGEM, ROTULO_ORIGEM, ORDEM_APARELHO, ROTULO_APARELHO, grupoDaOrigem, grupoDoAparelho, grupoDeInscrito,
} from '@/lib/youtube/observatorio/proprio/origem-grupos'

describe('grupos de origem', () => {
  it('os seis grupos com um valor de cada, pelo nome da API e pelo código', () => {
    const casos: Array<[string, string, string]> = [
      ['pesquisa', 'YT_SEARCH', '5'], ['sugeridos', 'RELATED_VIDEO', '7'], ['navegacao', 'SUBSCRIBER', '3'],
      ['shorts', 'SHORTS', '24'], ['externa', 'EXT_URL', '9'], ['outras', 'PLAYLIST', '14'],
    ]
    for (const [g, nome, cod] of casos) {
      expect(grupoDaOrigem(nome), nome).toEqual({ grupo: g, catalogado: true })
      expect(grupoDaOrigem(cod), cod).toEqual({ grupo: g, catalogado: true })
    }
    expect(grupoDaOrigem('32')).toEqual({ grupo: 'sugeridos', catalogado: true })
  })
  it('a ordem fixa e os rótulos do mockup', () => {
    expect(ORDEM_ORIGEM).toEqual(['pesquisa', 'sugeridos', 'navegacao', 'shorts', 'externa', 'outras'])
    expect(ROTULO_ORIGEM.pesquisa).toEqual({ nome: 'Pesquisa do YouTube', de: 'da pesquisa do YouTube' })
    expect(ROTULO_ORIGEM.navegacao.nome).toBe('Início e inscrições')
    expect(ROTULO_ORIGEM.externa.de).toBe('de sites e apps de fora do YouTube')
    expect(Object.keys(ROTULO_ORIGEM).sort()).toEqual([...ORDEM_ORIGEM].sort())
  })
  it('código que não existe: outras, catalogado falso', () => {
    expect(grupoDaOrigem('999')).toEqual({ grupo: 'outras', catalogado: false })
    expect(grupoDaOrigem('CAMPAIGN_CARD')).toEqual({ grupo: 'outras', catalogado: false })
  })
  it('string vazia e nulo tratado como desconhecido, nunca lança', () => {
    expect(grupoDaOrigem('')).toEqual({ grupo: 'outras', catalogado: false })
    expect(grupoDaOrigem(null as unknown as string)).toEqual({ grupo: 'outras', catalogado: false })
    expect(grupoDoAparelho('')).toEqual({ grupo: 'outros', catalogado: false })
    expect(grupoDoAparelho(undefined as unknown as string)).toEqual({ grupo: 'outros', catalogado: false })
    expect(grupoDeInscrito('')).toBeNull()
  })
  it('todo código de ORIGEM_LOTE cai em algum grupo, catalogado', () => {
    for (const cod of Object.keys(ORIGEM_LOTE)) {
      const r = grupoDaOrigem(cod)
      expect(ORDEM_ORIGEM, cod).toContain(r.grupo)
      expect(r.catalogado, cod).toBe(true)
    }
  })
})

describe('grupos de aparelho', () => {
  it('MOBILE|ANDROID e MOBILE|IOS são celular; só a parte antes da barra decide', () => {
    expect(grupoDoAparelho('MOBILE|ANDROID')).toEqual({ grupo: 'celular', catalogado: true })
    expect(grupoDoAparelho('MOBILE|IOS')).toEqual({ grupo: 'celular', catalogado: true })
    expect(grupoDoAparelho('DESKTOP|WINDOWS')).toEqual({ grupo: 'computador', catalogado: true })
  })
  it('aparelho sem barra, pelo nome e pelo código', () => {
    const casos: Array<[string, string, string]> = [
      ['celular', 'MOBILE', '104'], ['computador', 'DESKTOP', '101'], ['tv', 'TV', '102'], ['tablet', 'TABLET', '105'],
    ]
    for (const [g, nome, cod] of casos) {
      expect(grupoDoAparelho(nome)).toEqual({ grupo: g, catalogado: true })
      expect(grupoDoAparelho(cod)).toEqual({ grupo: g, catalogado: true })
    }
  })
  it('console, plataforma desconhecida e desconhecidos vão para outros', () => {
    expect(grupoDoAparelho('GAME_CONSOLE')).toEqual({ grupo: 'outros', catalogado: true })
    expect(grupoDoAparelho('UNKNOWN_PLATFORM')).toEqual({ grupo: 'outros', catalogado: true })
    expect(grupoDoAparelho('WEARABLE')).toEqual({ grupo: 'outros', catalogado: false })
    expect(grupoDoAparelho('999')).toEqual({ grupo: 'outros', catalogado: false })
  })
  it('todo código de APARELHO_LOTE cai em algum grupo', () => {
    for (const cod of Object.keys(APARELHO_LOTE)) expect(ORDEM_APARELHO).toContain(grupoDoAparelho(cod).grupo)
  })
  it('rótulos', () => {
    expect(ROTULO_APARELHO).toEqual({ celular: 'Celular', computador: 'Computador', tv: 'TV', tablet: 'Tablet', outros: 'Outros aparelhos' })
  })
})

describe('inscritos', () => {
  it('SUBSCRIBED, UNSUBSCRIBED, outro valor nulo', () => {
    expect(grupoDeInscrito('SUBSCRIBED')).toBe('inscritos')
    expect(grupoDeInscrito('UNSUBSCRIBED')).toBe('nao_inscritos')
    expect(grupoDeInscrito('OUTRO')).toBeNull()
  })
})
