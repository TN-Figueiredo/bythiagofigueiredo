// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { langChip, listPt, ownTexts } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-channels'

describe('own-channels (textos e marcas dos canais próprios)', () => {
  it('ownTexts: um canal próprio (ou nenhum) fala no singular', () => {
    expect(ownTexts(false)).toEqual({
      slot: 'o seu canal não ocupa vaga',
      count: 'o seu canal não conta',
      sync: 'Seu canal não entra nesta rodada; ele sincroniza pelo Painel.',
    })
  })
  it('ownTexts: mais de um canal próprio fala no plural', () => {
    expect(ownTexts(true)).toEqual({
      slot: 'os seus canais não ocupam vaga',
      count: 'os seus canais não contam',
      sync: 'Seus canais não entram nesta rodada; eles sincronizam pelo Painel.',
    })
  })
  it('langChip: só com mais de um canal próprio, e só para idioma conhecido', () => {
    expect(langChip('pt', true)).toEqual({ code: 'PT', title: 'Canal em português' })
    expect(langChip('en', true)).toEqual({ code: 'EN', title: 'Canal em inglês' })
    expect(langChip('pt', false)).toBeNull()
    expect(langChip('en', false)).toBeNull()
    expect(langChip('', true)).toBeNull()
    expect(langChip('es', true)).toBeNull()
    // nome de propriedade herdada não vira idioma
    expect(langChip('toString', true)).toBeNull()
    expect(langChip('constructor', true)).toBeNull()
  })
  it('listPt: "A", "A e B", "A, B e C"', () => {
    expect(listPt([])).toBe('')
    expect(listPt(['A'])).toBe('A')
    expect(listPt(['A', 'B'])).toBe('A e B')
    expect(listPt(['A', 'B', 'C'])).toBe('A, B e C')
    expect(listPt(['A', 'B', 'C', 'D'])).toBe('A, B, C e D')
  })
})
