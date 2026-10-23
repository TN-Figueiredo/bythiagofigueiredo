// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { lerFiltroDeIds, lerTotal, montarFaixa } from '@/app/cms/(authed)/youtube/videos/filtro-ids'
import { FaixaSugestao } from '@/app/cms/(authed)/youtube/videos/faixa-sugestao'

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

describe('lerFiltroDeIds', () => {
  it('2 uuids viram 2', () => expect(lerFiltroDeIds(`${u(1)},${u(2)}`)).toEqual([u(1), u(2)]))
  it('lixo e repetido são descartados', () =>
    expect(lerFiltroDeIds(`${u(1)},abc,${u(1)},'; drop,${u(2)}`)).toEqual([u(1), u(2)]))
  it('25 viram 20', () =>
    expect(lerFiltroDeIds(Array.from({ length: 25 }, (_, i) => u(i + 1)).join(','))).toHaveLength(20))
  it('vazio, lixo, ausente e array → null', () => {
    expect(lerFiltroDeIds('')).toBeNull()
    expect(lerFiltroDeIds('x,y')).toBeNull()
    expect(lerFiltroDeIds(undefined)).toBeNull()
    expect(lerFiltroDeIds([u(1)])).toBeNull()
  })
  it('entrada gigante não explode', () => expect(lerFiltroDeIds('a,'.repeat(100000))).toBeNull())
})

describe('lerTotal', () => {
  it('inteiro 1–10000', () => {
    expect(lerTotal('25')).toBe(25)
    expect(lerTotal('10000')).toBe(10000)
  })
  it('lixo → null', () => {
    for (const v of ['abc', '0', '10001', '2.5', '-3', '', undefined, ['3']]) expect(lerTotal(v)).toBeNull()
  })
})

describe('montarFaixa', () => {
  it('sem ids → null', () => expect(montarFaixa(null, null, 5)).toBeNull())
  it('total=25 com 20 ids → corte', () => expect(montarFaixa(new Array(20).fill('x'), 25, 20)).toEqual({ mostrados: 20, total: 25 }))
  it('sem total usa o nº de ids', () => expect(montarFaixa(['a', 'b'], null, 2)).toEqual({ mostrados: 2, total: 2 }))
  it('outro site → 0 mostrados', () => expect(montarFaixa(['a'], null, 0)).toEqual({ mostrados: 0, total: 1 }))
})

describe('FaixaSugestao', () => {
  it('sem corte', () => {
    render(<FaixaSugestao mostrados={2} total={2} />)
    expect(screen.getByText('Mostrando 2 vídeos da sugestão')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver todos' }).getAttribute('href')).toBe('/cms/youtube/videos')
  })
  it('com corte', () => {
    render(<FaixaSugestao mostrados={20} total={25} />)
    expect(screen.getByText('Mostrando 20 de 25 vídeos da sugestão')).toBeTruthy()
  })
  it('ids de outro site', () => {
    render(<FaixaSugestao mostrados={0} total={2} />)
    expect(screen.getByText('Nenhum destes vídeos está neste site')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver todos' })).toBeTruthy()
  })
})
