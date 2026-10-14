// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import {
  PASSOS_COM_INTERRUPTOR, passoDesligado, nomesDesconhecidos, notaNomesDesconhecidos, type PassoComInterruptor,
} from '@/lib/youtube/coleta/passos-desligados'

const ORIGINAL = process.env.YT_OWN_STEPS_OFF
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.YT_OWN_STEPS_OFF
  else process.env.YT_OWN_STEPS_OFF = ORIGINAL
})

const NOMES: PassoComInterruptor[] = ['retencao', 'dimensoes', 'versoes', 'normalizadores']
const desligados = (env: NodeJS.ProcessEnv) => NOMES.filter(n => passoDesligado(n, env))

describe('YT_OWN_STEPS_OFF', () => {
  it('a lista são os quatro nomes', () => {
    expect([...PASSOS_COM_INTERRUPTOR]).toEqual(['retencao', 'dimensoes', 'versoes', 'normalizadores'])
  })
  it('variável APAGADA (padrão do processo): nada desligado, sem desconhecidos, nota nula', () => {
    delete process.env.YT_OWN_STEPS_OFF
    for (const n of NOMES) expect(passoDesligado(n)).toBe(false)
    expect(nomesDesconhecidos()).toEqual([])
    expect(notaNomesDesconhecidos()).toBeNull()
  })
  it('lê process.env quando o env não é passado', () => {
    process.env.YT_OWN_STEPS_OFF = 'dimensoes'
    expect(passoDesligado('dimensoes')).toBe(true)
    expect(passoDesligado('retencao')).toBe(false)
  })
  it("'retencao' desliga só a retenção", () => {
    const env = { YT_OWN_STEPS_OFF: 'retencao' }
    expect(desligados(env)).toEqual(['retencao'])
    expect(notaNomesDesconhecidos(env)).toBeNull()
  })
  it("' Retencao , versoes ' desliga os dois (espaço e maiúscula toleradas)", () => {
    const env = { YT_OWN_STEPS_OFF: ' Retencao , versoes ' }
    expect(desligados(env)).toEqual(['retencao', 'versoes'])
    expect(nomesDesconhecidos(env)).toEqual([])
  })
  it("'RETENCAO' em maiúsculas desliga", () => {
    expect(desligados({ YT_OWN_STEPS_OFF: 'RETENCAO,NORMALIZADORES' })).toEqual(['retencao', 'normalizadores'])
  })
  it("'retençao' (erro de digitação): nada desligado, desconhecido, nota com o texto exato", () => {
    const env = { YT_OWN_STEPS_OFF: 'retençao' }
    expect(desligados(env)).toEqual([])
    expect(nomesDesconhecidos(env)).toEqual(['retençao'])
    expect(notaNomesDesconhecidos(env)).toBe('YT_OWN_STEPS_OFF tem nome desconhecido: retençao')
  })
  it("'' e só espaços: nada, sem nota", () => {
    for (const v of ['', '   ', ' , ,, ']) {
      const env = { YT_OWN_STEPS_OFF: v }
      expect(desligados(env)).toEqual([])
      expect(nomesDesconhecidos(env)).toEqual([])
      expect(notaNomesDesconhecidos(env)).toBeNull()
    }
  })
  it('vírgula sobrando não gera nome vazio nem desliga a mais', () => {
    const env = { YT_OWN_STEPS_OFF: ',retencao,,dimensoes,' }
    expect(desligados(env)).toEqual(['retencao', 'dimensoes'])
    expect(nomesDesconhecidos(env)).toEqual([])
  })
  it('um conhecido e um desconhecido: desliga o conhecido, nomeia o outro; vários desconhecidos vão na mesma nota', () => {
    const env = { YT_OWN_STEPS_OFF: 'retencao, foo, bar' }
    expect(desligados(env)).toEqual(['retencao'])
    expect(nomesDesconhecidos(env)).toEqual(['foo', 'bar'])
    expect(notaNomesDesconhecidos(env)).toBe('YT_OWN_STEPS_OFF tem nome desconhecido: foo, bar')
  })
  it('nome repetido é nomeado uma vez; texto gigante é cortado na nota', () => {
    expect(nomesDesconhecidos({ YT_OWN_STEPS_OFF: 'foo,FOO,foo' })).toEqual(['foo'])
    const nota = notaNomesDesconhecidos({ YT_OWN_STEPS_OFF: 'z'.repeat(500) })
    expect(nota).toBe(`YT_OWN_STEPS_OFF tem nome desconhecido: ${'z'.repeat(40)}`)
  })
  it('a nota é sempre o mesmo texto para a mesma entrada (pushUnico não a repete)', () => {
    const env = { YT_OWN_STEPS_OFF: 'foo' }
    expect(notaNomesDesconhecidos(env)).toBe(notaNomesDesconhecidos(env))
  })
})
