// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { LARGURA_ALTA, publicaBaixa, dimensoesDeTexto, textoAvisoOriginalBaixa, AVISO_INDISPONIVEL } from '@/lib/youtube/ab-original-resolucao'
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

describe('textoAvisoOriginalBaixa(dimensions, medida)', () => {
  it('1280x720 e acima: sem aviso (medida ou não)', () => {
    expect(textoAvisoOriginalBaixa('1280x720', true)).toBeNull()
    expect(textoAvisoOriginalBaixa('1920x1080', true)).toBeNull()
    expect(textoAvisoOriginalBaixa('1280x720', false)).toBeNull()
  })
  it('1279 avisa com o número, selo Baixa resolução, e traz a saída', () => {
    const a = textoAvisoOriginalBaixa('1279x719', true)
    expect(a?.kind).toBe('baixa')
    expect(a?.selo).toBe('Baixa resolução')
    expect(a?.texto).toContain('A original guardada tem só 1279×719: o vídeo voltaria borrado a cada troca e ficaria assim depois do teste.')
    expect(a?.texto).toContain('ative assim mesmo')
    expect(textoAvisoOriginalBaixa('480x360', true)?.texto).toContain('480×360')
  })
  it('medida mas ilegível (nula, 0x0, lixo): baixa, sem número, sem "undefined"/"null"/"NaN"', () => {
    for (const d of [null, undefined, '', '0x0', 'lixo']) {
      const a = textoAvisoOriginalBaixa(d, true)
      expect(a?.kind).toBe('baixa')
      expect(a?.texto).toContain('é de baixa resolução (mínimo 1280 px de largura)')
      expect(a?.texto).not.toMatch(/undefined|null|NaN/)
    }
  })
  it('não medida: selo e texto próprios, nunca "baixa"', () => {
    for (const d of [null, undefined, '0x0', '480x360']) {
      const a = textoAvisoOriginalBaixa(d, false)
      expect(a?.kind).toBe('nao-medida')
      expect(a?.selo).toBe('Resolução não medida')
      expect(a?.texto).toContain('ainda não foi medida')
      expect(a?.texto).not.toMatch(/baixa resolução|undefined|null|NaN/i)
    }
  })
  it('a linha de leitura que falhou é neutra e fixa', () => {
    expect(AVISO_INDISPONIVEL).toEqual({ kind: 'indisponivel', selo: null, texto: 'Não consegui conferir a resolução da original agora.' })
  })
})
