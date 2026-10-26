// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { LARGURA_ALTA, publicaBaixa, dimensoesDeTexto, textoAvisoOriginalBaixa, AVISO_INDISPONIVEL, tituloDoBanner, NOTA_ATIVAR } from '@/lib/youtube/ab-original-resolucao'
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
    expect(a?.texto).toContain('Sem uma maior, pode ativar assim mesmo.')
    expect(a?.texto).toContain('o teste guarda a nova ao ativar, mesmo que este aviso continue aqui')
    expect(textoAvisoOriginalBaixa('480x360', true)?.texto).toContain('480×360')
  })
  it('medida mas ilegível (nula, 0x0, lixo): baixa, sem número, sem "undefined"/"null"/"NaN"', () => {
    for (const d of [null, undefined, '', '0x0', 'lixo']) {
      const a = textoAvisoOriginalBaixa(d, true)
      expect(a?.kind).toBe('baixa')
      expect(a?.texto).toContain('está abaixo do mínimo de 1280 px de largura')
      expect(a?.texto).not.toMatch(/undefined|null|NaN/)
    }
  })
  it('não medida: selo e texto próprios, nunca "baixa"', () => {
    for (const d of [null, undefined, '0x0', '480x360']) {
      const a = textoAvisoOriginalBaixa(d, false)
      expect(a?.kind).toBe('nao-medida')
      expect(a?.selo).toBe('Resolução não medida')
      expect(a?.texto).toContain('Resolução não medida. O teste mede ao ativar')
      expect(a?.texto).toContain('troque-a antes de ativar')
      expect(a?.texto).not.toMatch(/baixa resolução|ative assim mesmo|undefined|null|NaN/i)
    }
  })
  it('a linha de leitura que falhou é neutra e fixa', () => {
    expect(AVISO_INDISPONIVEL).toEqual({ kind: 'indisponivel', selo: null, texto: 'Não consegui conferir a resolução da original agora. Isso não impede de ativar.' })
  })
})

describe('tituloDoBanner e NOTA_ATIVAR', () => {
  it('Tudo pronto só sem aviso (undefined ou null)', () => {
    expect(tituloDoBanner(undefined)).toBe('Tudo pronto.')
    expect(tituloDoBanner(null)).toBe('Tudo pronto.')
  })
  it('pendente e leitura que falhou: "Pronto para ativar."', () => {
    expect(tituloDoBanner('pendente')).toBe('Pronto para ativar.')
    expect(tituloDoBanner(AVISO_INDISPONIVEL)).toBe('Pronto para ativar.')
  })
  it('baixa e não medida: "Pronto para ativar, com um aviso abaixo."', () => {
    expect(tituloDoBanner(textoAvisoOriginalBaixa('480x360', true))).toBe('Pronto para ativar, com um aviso abaixo.')
    expect(tituloDoBanner(textoAvisoOriginalBaixa(null, false))).toBe('Pronto para ativar, com um aviso abaixo.')
  })
  it('D-M6-8: ordem faltaThumb > aviso visível > leitura sem resposta > tudo pronto', () => {
    const volume = { estado: 'nao_chega', texto: 'x' }
    expect(tituloDoBanner(textoAvisoOriginalBaixa('480x360', true), { volume, faltaThumb: 'B' })).toBe('Falta a thumbnail da variante B.')
    expect(tituloDoBanner('pendente', { volume })).toBe('Pronto para ativar, com um aviso abaixo.')
    expect(tituloDoBanner(null, { volume })).toBe('Pronto para ativar, com um aviso abaixo.')
    expect(tituloDoBanner(null, { volume: 'pendente' })).toBe('Pronto para ativar.')
    expect(tituloDoBanner(null, { volume: 'indisponivel' })).toBe('Pronto para ativar.')
    expect(tituloDoBanner(null, { volume: null })).toBe('Tudo pronto.')
    expect(tituloDoBanner(undefined, {})).toBe('Tudo pronto.')
  })
  it('a nota diz "para começar"', () => {
    expect(NOTA_ATIVAR).toBe('Clique em Ativar teste para começar. As variantes começam a alternar depois que o teste for ativado no YouTube.')
  })
})
