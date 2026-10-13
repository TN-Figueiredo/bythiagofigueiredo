// @vitest-environment node
// A4, ajuste final de UX aprovado pelo dono (13/10): a grade de Capas a 390 px mostra 24 cartões e "mostrar mais" de 24 em 24.
// O modelo é puro: quantos cartões aparecem, o que o botão diz e o que sobra, para 0, 1, 24, 25, 48 e 49 cartões.
import { describe, it, expect } from 'vitest'
import { TAMANHO_PAGINA, paginarGrade } from '@/app/cms/(authed)/youtube/competitors/_canal/grade-paginacao'

describe('paginarGrade', () => {
  it('o tamanho da página é 24', () => { expect(TAMANHO_PAGINA).toBe(24) })

  it('0 cartões: nada a mostrar, sem botão', () => {
    expect(paginarGrade(0, 1)).toEqual({ limite: 24, mostrando: 0, ocultos: 0, proximo: 0, botao: null, frase: null })
  })
  it('1 cartão: mostra o único, sem botão', () => {
    const p = paginarGrade(1, 1)
    expect(p).toMatchObject({ mostrando: 1, ocultos: 0, proximo: 0, botao: null, frase: null })
  })
  it('24 cartões: cabem na primeira página, sem botão', () => {
    expect(paginarGrade(24, 1)).toMatchObject({ mostrando: 24, ocultos: 0, proximo: 0, botao: null })
  })
  it('25 cartões: 24 aparecem e o botão traz o último vídeo', () => {
    const p = paginarGrade(25, 1)
    expect(p).toMatchObject({ mostrando: 24, ocultos: 1, proximo: 1, botao: 'Mostrar o último vídeo' })
    expect(p.frase).toBe('Falta 1 vídeo. Depois dele não falta nenhum.')
  })
  it('48 cartões: a segunda página fecha a conta, sem botão', () => {
    expect(paginarGrade(48, 1)).toMatchObject({ mostrando: 24, ocultos: 24, proximo: 24, botao: 'Mostrar os últimos 24 vídeos' })
    expect(paginarGrade(48, 2)).toMatchObject({ mostrando: 48, ocultos: 0, proximo: 0, botao: null, frase: null })
  })
  it('49 cartões: dois lotes cheios e um parcial de 1', () => {
    expect(paginarGrade(49, 1)).toMatchObject({ mostrando: 24, ocultos: 25, proximo: 24, botao: 'Mostrar mais 24 vídeos' })
    expect(paginarGrade(49, 1).frase).toBe('Faltam 25 vídeos. Depois dos próximos 24 falta 1.')
    expect(paginarGrade(49, 2)).toMatchObject({ mostrando: 48, ocultos: 1, proximo: 1, botao: 'Mostrar o último vídeo' })
    expect(paginarGrade(49, 3)).toMatchObject({ mostrando: 49, ocultos: 0, botao: null })
  })
  it('58 cartões: o último lote parcial diz quantos são', () => {
    expect(paginarGrade(58, 2)).toMatchObject({ mostrando: 48, ocultos: 10, proximo: 10, botao: 'Mostrar os últimos 10 vídeos' })
  })
  it('lotes fora do domínio (0, negativo, fração) valem 1; lote além do fim mostra tudo', () => {
    expect(paginarGrade(60, 0).mostrando).toBe(24)
    expect(paginarGrade(60, -3).mostrando).toBe(24)
    expect(paginarGrade(60, 1.9).mostrando).toBe(24)
    expect(paginarGrade(60, 99)).toMatchObject({ mostrando: 60, ocultos: 0, botao: null })
  })
  it('nenhuma frase usa a palavra interna "lote" (restrição global: palavras internas não aparecem em tela)', () => {
    for (const total of [25, 30, 48, 49, 58, 73, 200]) for (const lotes of [1, 2, 3]) {
      const p = paginarGrade(total, lotes)
      expect(`${p.botao ?? ''} ${p.frase ?? ''}`).not.toMatch(/\blotes?\b|pacote|dataset/i)
    }
  })
  it('a soma fecha: mostrando + ocultos é sempre o total', () => {
    for (const total of [0, 1, 23, 24, 25, 47, 48, 49, 72, 73, 200]) for (const lotes of [1, 2, 3, 4]) {
      const p = paginarGrade(total, lotes)
      expect(p.mostrando + p.ocultos).toBe(total)
      expect(p.proximo).toBeLessThanOrEqual(TAMANHO_PAGINA)
    }
  })
})
