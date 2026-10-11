import { describe, it, expect } from 'vitest'
import { vpdText } from '@/app/cms/(authed)/youtube/competitors/_canal/numeros'
const num = (n: number) => (n >= 1000 ? (Math.round(n / 100) / 10).toString().replace('.', ',') + ' mil' : String(Math.round(n)))

describe('views por dia (spec 19.3)', () => {
  it('nulo não tem texto', () => { expect(vpdText(null, num)).toBeNull() })
  it('zero exato é "0"', () => { expect(vpdText(0, num)).toBe('0') })
  it('abaixo de 10, uma casa', () => { expect(vpdText(0.3, num)).toBe('0,3'); expect(vpdText(9.94, num)).toBe('9,9') })
  it('9,95 arredonda para 10, inteiro', () => { expect(vpdText(9.95, num)).toBe('10') })
  it('de 10 a 999, inteiro', () => { expect(vpdText(480.4, num)).toBe('480') })
  it('de 1.000 em diante, milhar', () => { expect(vpdText(6100, num)).toBe('6,1 mil') })
  it('positivo menor que 0,05 não vira "0,0"', () => { expect(vpdText(0.02, num)).toBe('menos de 0,1') })
  it('negativo (contagem corrigida pelo YouTube) não inventa sinal: não medido', () => { expect(vpdText(-3, num)).toBeNull() })
})
