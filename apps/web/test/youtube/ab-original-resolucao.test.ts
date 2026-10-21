// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { LARGURA_ALTA, publicaBaixa, dimensoesDeTexto } from '@/lib/youtube/ab-original-resolucao'
import { originalBaixaResolucao } from '@/app/cms/(authed)/youtube/ab-lab/_components/encerrar-props'

describe('regra única de baixa resolução', () => {
  it('a constante é 1280', () => { expect(LARGURA_ALTA).toBe(1280) })
  it('1279 é baixa, 1280 não', () => {
    expect(publicaBaixa(1279)).toBe(true)
    expect(publicaBaixa(1280)).toBe(false)
  })
  it('nulo, 0 e indefinido são baixa', () => {
    for (const v of [null, undefined, 0]) expect(publicaBaixa(v)).toBe(true)
  })
  it('dimensoesDeTexto lê "LxA" e devolve null no resto', () => {
    expect(dimensoesDeTexto('1920x1080')).toEqual({ largura: 1920, altura: 1080 })
    for (const d of [null, undefined, '', '0x0', '480x0', 'abc', '1920X1080 ']) expect(dimensoesDeTexto(d)).toBeNull()
  })
  it('diálogo de encerrar: selo com nulo, 0x0, 480, 640 e 1279; sem selo com 1280', () => {
    for (const d of [null, undefined, '0x0', '480x360', '640x480', '1279x719', 'lixo']) {
      expect(originalBaixaResolucao(d)).toBe(true)
    }
    expect(originalBaixaResolucao('1280x720')).toBe(false)
    expect(originalBaixaResolucao('1920x1080')).toBe(false)
  })
})
