// @vitest-environment node
// H21 (T12 M4): o modelo das réguas não importa a lista de vídeos nem o "Como o canal está" só por duas funções de texto e
// uma constante. O módulo pequeno de formatação é folha: não importa nenhum modelo.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { durText, numNb, POUCO_VOLUME } from '@/app/cms/(authed)/youtube/competitors/_proprio/formato'
import { numNb as numNbDaLista, durText as durTextDaLista } from '@/app/cms/(authed)/youtube/competitors/_canal/videos-model'
import { POUCO_VOLUME as poucoDoComoEsta } from '@/app/cms/(authed)/youtube/competitors/_proprio/como-esta-model'

const RAIZ = join(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')
const fonte = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const importsDe = (rel: string) => [...fonte(rel).matchAll(/^\s*import\s+(?!type\b)[^'"]*from\s*['"]([^'"]+)['"]/gm)].map(m => m[1]!)

describe('formato.ts (H21)', () => {
  const F = { num: (n: number) => (n >= 1_000_000 ? `${n / 1_000_000} mi` : n >= 1000 ? `${n / 1000} mil` : String(n)) }
  it('durText: mm:ss, h:mm:ss, nulo continua nulo', () => {
    expect(durText(125)).toBe('02:05')
    expect(durText(3725)).toBe('1:02:05')
    expect(durText(null)).toBeNull()
  })
  it('numNb: o espaço antes de "mil" e "mi" não quebra linha (NBSP explícito)', () => {
    expect(numNb(F, 1500)).toBe('1.5 mil')
    expect(numNb(F, 2_000_000)).toBe('2 mi')
    expect(numNb(F, 12)).toBe('12')
  })
  it('POUCO_VOLUME = 1.000 impressões', () => {
    expect(POUCO_VOLUME).toBe(1000)
  })
  it('uma definição só: a lista de vídeos e o "Como o canal está" reexportam as mesmas funções e o mesmo valor', () => {
    expect(numNbDaLista).toBe(numNb)
    expect(durTextDaLista).toBe(durText)
    expect(poucoDoComoEsta).toBe(POUCO_VOLUME)
  })
  it('o modelo das réguas não importa mais a lista de vídeos nem o "Como o canal está"', () => {
    const imports = importsDe('_proprio/reguas-model.ts')
    expect(imports).not.toContain('../_canal/videos-model')
    expect(imports).not.toContain('./como-esta-model')
    expect(imports).toContain('./formato')
  })
  it('formato.ts é folha: não importa nenhum modelo, nem o leitor privado', () => {
    const PROIBIDO = /model|proprio\/ler|edicao|leitura-privada|dados/
    for (const i of importsDe('_proprio/formato.ts')) expect(i).not.toMatch(PROIBIDO)
    expect('@/lib/youtube/observatorio/proprio/leitura-privada').toMatch(PROIBIDO) // controle
  })
  it('M1: o espaço sem quebra tem uma definição só (_canal/formato); a lista de canais importa em vez de repetir', () => {
    expect(fonte('_canal/formato.ts')).toMatch(/export const NB\b/)
    expect(fonte('_canais/view-model.ts')).not.toMatch(/const NB\b/)
    expect(importsDe('_canais/view-model.ts')).toContain('../_canal/formato')
    expect(fonte('_canais/view-model.ts')).not.toMatch(/replace\(\/ \(mil\|mi\)\$\//)
  })
})
