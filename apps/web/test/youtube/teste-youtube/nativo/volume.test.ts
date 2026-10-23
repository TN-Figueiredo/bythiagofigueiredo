// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { IMPRESSOES_POR_VERSAO, JANELA_TESTE_DIAS, pisoPorDia, volumeDoVideo } from '@/lib/youtube/teste-youtube/nativo/volume'

describe('piso de volume (D-4)', () => {
  it('constantes e piso por versão', () => {
    expect(IMPRESSOES_POR_VERSAO).toBe(1540)
    expect(JANELA_TESTE_DIAS).toBe(14)
    expect(pisoPorDia(2)).toBe(220)
    expect(pisoPorDia(3)).toBe(330)
  })
  it('fronteira 219 / 220 (k=2)', () => {
    expect(volumeDoVideo({ soma: 219 * 7, diasCobertos: 7 }, 2).acimaDoPiso).toBe(false)
    expect(volumeDoVideo({ soma: 220 * 7, diasCobertos: 7 }, 2).acimaDoPiso).toBe(true)
    expect(volumeDoVideo({ soma: 219, diasCobertos: 1 + 2 }, 2).porDia).toBe(73)
  })
  it('3 linhas de 200 em 14 dias cobertos: 600/14 = 42,9 arredonda para cima, 43/dia', () => {
    const v = volumeDoVideo({ soma: 600, diasCobertos: 14 }, 2)
    expect(v.porDia).toBe(43)
    expect(v.acimaDoPiso).toBe(false)
    expect(v.diasAtePiso).toBe(Math.ceil(3080 / 43))
  })
  it('tudo fora dos 14 dias cobertos (soma 0): porDia 0, abaixo do piso, diasAtePiso nulo', () => {
    expect(volumeDoVideo({ soma: 0, diasCobertos: 14 }, 2)).toEqual({ porDia: 0, acimaDoPiso: false, diasAtePiso: null })
  })
  it('relatório vazio conta como zero medido (porDia 0, não nulo)', () => {
    expect(volumeDoVideo({ soma: 0, diasCobertos: 5 }, 2).porDia).toBe(0)
  })
  it('menos de 3 dias cobertos ou sem dado: tudo nulo, nunca 0', () => {
    const nulo = { porDia: null, acimaDoPiso: null, diasAtePiso: null }
    expect(volumeDoVideo({ soma: 9999, diasCobertos: 2 }, 2)).toEqual(nulo)
    expect(volumeDoVideo({ soma: 0, diasCobertos: 0 }, 2)).toEqual(nulo)
    expect(volumeDoVideo(null, 2)).toEqual(nulo)
  })
  it('3 dias cobertos já vale', () => {
    expect(volumeDoVideo({ soma: 3, diasCobertos: 3 }, 2).porDia).toBe(1)
  })
  it('diasAtePiso usa o k pedido', () => {
    expect(volumeDoVideo({ soma: 1000, diasCobertos: 10 }, 3).diasAtePiso).toBe(Math.ceil(4620 / 100))
  })
})
