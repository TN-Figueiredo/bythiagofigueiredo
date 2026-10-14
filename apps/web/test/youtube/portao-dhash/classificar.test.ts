import { describe, it, expect } from 'vitest'
import { classificar, primeiraEstavel, lacunas, horas } from '@/lib/youtube/portao-dhash/classificar'

const ORIG = '0000000000000000', TESTE = 'ffffffffffffffff'
describe('classificar', () => {
  it('perto do teste → teste; perto da original → original', () => {
    expect(classificar('000000000000000f', { original: ORIG, teste: TESTE }).leitura).toBe('original') // d=4
    expect(classificar('fffffffffffffff0', { original: ORIG, teste: TESTE }).leitura).toBe('teste')
  })
  it('longe dos dois → outra; dhash nulo → sem_dado', () => {
    expect(classificar('00000000ffffffff', { original: ORIG, teste: TESTE }).leitura).toBe('outra')
    expect(classificar(null, { original: ORIG, teste: TESTE })).toEqual({ leitura: 'sem_dado', dOriginal: null, dTeste: null })
  })
})
describe('primeiraEstavel', () => {
  const L = (s: string) => s.split('').map((c) => ({ leitura: c === 't' ? 'teste' as const : c === 'o' ? 'original' as const : 'sem_dado' as const }))
  it('devolve o índice da primeira de n seguidas', () => { expect(primeiraEstavel(L('ootottt'), 'teste', 3)).toBe(4) })
  it('sem_dado quebra a sequência', () => { expect(primeiraEstavel(L('tt-tt'), 'teste', 3)).toBeNull() })
})
describe('lacunas e horas', () => {
  it('conta intervalos maiores que o dobro do previsto', () => { expect(lacunas([0, 300_000, 900_000, 2_000_000], 300_000)).toBe(1) })
  it('arredonda para duas casas', () => { expect(horas(5_400_000)).toBe(1.5) })
})
