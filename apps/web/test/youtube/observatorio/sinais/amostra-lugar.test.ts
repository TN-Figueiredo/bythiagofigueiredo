// @vitest-environment node
/** F2 · T6b: partes puras do script da amostra de precisão do lugar (sorteio, complemento, precisão `pais:` com Wilson, CSV). */
import { describe, expect, it } from 'vitest'
import {
  aleatorio, embaralhar, sortearComComplemento, wilson, calcularPrecisaoPais, paraCsv, TITULOS_NEGATIVOS, soPais,
} from '../../../../scripts/f2-amostra-lugar'

const ids = Array.from({ length: 50 }, (_, i) => `v${String(i).padStart(2, '0')}`)

describe('sorteio com semente fixa', () => {
  it('mesma semente, mesma ordem; independe da ordem de entrada; outra semente difere', () => {
    const a = embaralhar(ids, x => x, 7)
    expect(embaralhar([...ids].reverse(), x => x, 7)).toEqual(a)
    expect(embaralhar(ids, x => x, 8)).not.toEqual(a)
    expect([...a].sort()).toEqual(ids)
    expect(aleatorio(1)()).toBe(aleatorio(1)())
  })
})

describe('sortearComComplemento', () => {
  const chavesDe = (x: string) => (Number(x.slice(1)) % 2 === 0 ? ['local:x', 'pais:BR'] : [])
  const base = { todos: ids, id: (x: string) => x, chavesDe, semente: 3 }
  it('sem falta de chaves não complementa', () => {
    const r = sortearComComplemento({ ...base, n: 10, alvo: 1, paisesFixos: 0 })
    expect(r.sorteados).toHaveLength(10)
    expect(r.complementares).toBe(0)
    expect(r.completo).toBe(true)
  })
  it('complementa até o alvo contando só pais:, incluindo as fixas', () => {
    const r = sortearComComplemento({ ...base, n: 4, alvo: 20, paisesFixos: 2 })
    expect(r.paises).toBeGreaterThanOrEqual(20)
    expect(r.completo).toBe(true)
    expect(r.complementares).toBeGreaterThan(0)
    expect(r.sorteados.reduce((s, x) => s + soPais(chavesDe(x)).length, 2)).toBe(r.paises)
    expect(r.sorteados.slice(0, 4)).toEqual(embaralhar(ids, x => x, 3).slice(0, 4))
  })
  it('pool esgotado antes do alvo: completo = false, nunca silêncio', () => {
    const r = sortearComComplemento({ ...base, n: 4, alvo: 500, paisesFixos: 0 })
    expect(r.completo).toBe(false)
    expect(r.sorteados).toHaveLength(50)
    expect(r.paises).toBe(25)
  })
})

describe('wilson', () => {
  it('54/60 fica perto de 0,80 a 0,96', () => {
    const w = wilson(54, 60)!
    expect(w.inferior).toBeCloseTo(0.795, 2)
    expect(w.superior).toBeCloseTo(0.958, 2)
  })
  it('n = 0 devolve null, 100% não passa de 1', () => {
    expect(wilson(0, 0)).toBeNull()
    expect(wilson(60, 60)!.superior).toBeLessThanOrEqual(1)
  })
})

describe('calcularPrecisaoPais', () => {
  const l = (calc: string, ok: string) => ({ chaves_calculadas: calc, chaves_corretas: ok })
  it('conta só pais: (local: não infla a taxa)', () => {
    const p = calcularPrecisaoPais([l('local:vn-phu-quoc;pais:VN', 'local:vn-phu-quoc;pais:VN'), l('local:a;pais:TH', '')])
    expect(p.calculadas).toBe(2)
    expect(p.corretas).toBe(1)
    expect(p.precisao).toBe(0.5)
  })
  it('54 de 60: precisão 0,90 passa, mas o limite inferior < 0,80 pede completar até 100', () => {
    const linhas = Array.from({ length: 60 }, (_, i) => l('pais:BR', i < 54 ? 'pais:BR' : ''))
    const p = calcularPrecisaoPais(linhas)
    expect(p.precisao).toBeCloseTo(0.9)
    expect(p.passa).toBe(true)
    expect(p.wilson95!.inferior).toBeLessThan(0.8)
    expect(p.completarAte100).toBe(true)
  })
  it('menos de 60 chaves não passa; zero chaves dá precisao null, não 1', () => {
    expect(calcularPrecisaoPais(Array.from({ length: 59 }, () => l('pais:BR', 'pais:BR'))).passa).toBe(false)
    const vazio = calcularPrecisaoPais([l('', '')])
    expect(vazio.precisao).toBeNull()
    expect(vazio.passa).toBe(false)
  })
  it('100 chaves com 97 certas: não pede mais amostra', () => {
    const p = calcularPrecisaoPais(Array.from({ length: 100 }, (_, i) => l('pais:BR', i < 97 ? 'pais:BR' : '')))
    expect(p.completarAte100).toBe(false)
    expect(p.passa).toBe(true)
  })
})

describe('paraCsv e negativos', () => {
  it('escapa vírgula e aspas, com coluna chaves_corretas vazia', () => {
    const csv = paraCsv([{ video_id: 'a', canal: 'C, D', formato: 'long', titulo: 'Diz "oi"', chaves: ['local:x', 'pais:BR'], fonte: 'texto' }])
    expect(csv.split('\n')[0]).toBe('video_id,canal,formato,titulo,chaves_calculadas,fonte,chaves_corretas')
    expect(csv.split('\n')[1]).toBe('a,"C, D",long,"Diz ""oi""",local:x;pais:BR,texto,')
  })
  it('são 20 títulos negativos distintos', () => {
    expect(new Set(TITULOS_NEGATIVOS).size).toBe(20)
  })
})
