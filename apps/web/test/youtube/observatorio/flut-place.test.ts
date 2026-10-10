// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { place, maxWidthFor, EDGE, type Box } from '@/app/cms/(authed)/youtube/competitors/_chrome/flut/place'

const VP = { w: 1440, h: 900 }
const box = (left: number, top: number, w = 24, h = 24): Box => ({ left, top, right: left + w, bottom: top + h })
const cobre = (p: { left: number; top: number }, s: { w: number; h: number }, a: Box) =>
  !(p.left + s.w <= a.left || p.left >= a.right || p.top + s.h <= a.top || p.top >= a.bottom)
const dentro = (p: { left: number; top: number; maxHeight: number | null }, s: { w: number; h: number }, vp = VP) =>
  p.left >= 0 && p.top >= 0 && p.left + s.w <= vp.w && p.top + Math.min(s.h, p.maxHeight ?? s.h) <= vp.h

describe('flut · place', () => {
  const S = { w: 270, h: 120 }
  it('prefere abaixo, com a borda direita alinhada à do gatilho', () => {
    const a = box(700, 400), p = place(a, S, VP)
    expect(p).toEqual({ left: a.right - S.w, top: a.bottom + 6, maxHeight: null, side: 'baixo' })
  })
  it('vira para cima quando não cabe embaixo', () => {
    const a = box(700, 860), p = place(a, S, VP)
    expect(p.side).toBe('cima')
    expect(p.top).toBe(a.top - 6 - S.h)
  })
  it('linha do meio encostada no pé da janela: inteira na janela e sem cobrir o gatilho', () => {
    const a = box(300, 900 - 24 - 2), p = place(a, S, VP)
    expect(dentro(p, S)).toBe(true)
    expect(cobre(p, S, a)).toBe(false)
  })
  it('desloca na horizontal para não encostar na borda', () => {
    expect(place(box(4, 400), S, VP).left).toBe(EDGE)
    expect(place(box(1430, 400, 8, 24), S, VP, { align: 'inicio' }).left).toBe(VP.w - S.w - EDGE)
  })
  it('align meio centraliza no gatilho; cx centraliza no ponto pedido', () => {
    const a = box(700, 400)
    expect(place(a, S, VP, { align: 'meio' }).left).toBe(Math.round(712 - S.w / 2))
    expect(place(a, S, VP, { cx: 500 }).left).toBe(500 - S.w / 2)
  })
  it('pref cima abre para cima quando cabe e cai para baixo quando não', () => {
    expect(place(box(700, 400), S, VP, { pref: 'cima' }).side).toBe('cima')
    expect(place(box(700, 20), S, VP, { pref: 'cima' }).side).toBe('baixo')
  })
  it('não cabe em cima nem embaixo: usa o lado maior e limita a altura, com rolagem interna', () => {
    const alto = { w: 270, h: 800 }, a = box(700, 500), p = place(a, alto, VP)
    expect(p.side).toBe('cima')
    expect(p.maxHeight).toBe(a.top - 6 - EDGE)
    expect(dentro(p, alto)).toBe(true)
    expect(cobre({ left: p.left, top: p.top }, { w: alto.w, h: p.maxHeight! }, a)).toBe(false)
  })
  it('pref lado: à direita do gatilho; sem espaço, à esquerda; sem nenhum, cai para baixo', () => {
    const a = box(700, 400)
    expect(place(a, S, VP, { pref: 'lado' })).toMatchObject({ left: a.right + 6, top: a.top, side: 'lado' })
    const b = box(1400, 400)
    expect(place(b, S, VP, { pref: 'lado' })).toMatchObject({ left: b.left - 6 - S.w, side: 'lado' })
    expect(place(box(180, 400), S, { w: 390, h: 844 }, { pref: 'lado' }).side).toBe('baixo')
  })
  it('lado esquerda: tenta a esquerda primeiro; sem espaço, a direita; sem nenhum, acima com queda cima', () => {
    const a = box(700, 400)
    expect(place(a, S, VP, { pref: 'lado', lado: 'esquerda' })).toMatchObject({ left: a.left - 6 - S.w, top: a.top, side: 'lado' })
    const b = box(100, 400)
    expect(place(b, S, VP, { pref: 'lado', lado: 'esquerda' })).toMatchObject({ left: b.right + 6, side: 'lado' })
    const estreita = { w: 390, h: 844 }, c = box(180, 400)
    expect(place(c, S, estreita, { pref: 'lado', lado: 'esquerda' }).side).toBe('baixo')
    const alta = place(c, S, estreita, { pref: 'lado', lado: 'esquerda', queda: 'cima', align: 'inicio' })
    expect(alta).toMatchObject({ side: 'cima', left: estreita.w - S.w - EDGE, top: c.top - 6 - S.h }) // 'inicio' = 180, pushed back inside the window
  })
  it('outroLado: false: sem espaço no lado preferido a dica sobe em vez de saltar para o outro lado, onde cobriria os controles vizinhos (Histórico 768 px)', () => {
    // "Fixar vídeo" a 76..231 x 595..635 numa janela de 768 px, dica de 300x105: à esquerda não cabe; à direita caberia, em cima de "Abrir no YouTube"
    const botao: Box = { left: 76, top: 595, right: 231, bottom: 635 }, hint = { w: 300, h: 105 }, vp = { w: 768, h: 900 }
    const o = { pref: 'lado', lado: 'esquerda', queda: 'cima', align: 'inicio', gap: 8, maxW: 300 } as const
    const saltou = place(botao, hint, vp, o)
    expect(saltou).toMatchObject({ side: 'lado', left: botao.right + 8 }) // o comportamento que cobria o vizinho
    const sobe = place(botao, hint, vp, { ...o, outroLado: false })
    expect(sobe).toEqual({ left: botao.left, top: botao.top - 8 - hint.h, maxHeight: null, side: 'cima' })
    expect(cobre(sobe, hint, botao)).toBe(false)
    // havendo espaço no lado preferido, nada muda
    const largo = box(700, 400, 155, 40)
    expect(place(largo, hint, { w: 1440, h: 900 }, { ...o, outroLado: false })).toEqual(place(largo, hint, { w: 1440, h: 900 }, o))
    // lado direita: idem, sem saltar para a esquerda
    const perto = box(1300, 400, 120, 40)
    expect(place(perto, hint, { w: 1440, h: 900 }, { pref: 'lado', lado: 'direita', queda: 'cima', outroLado: false }).side).toBe('cima')
  })
  it('lado direita explícito é o padrão; gap vale para o lado e para a queda', () => {
    const a = box(700, 400)
    expect(place(a, S, VP, { pref: 'lado', lado: 'direita' })).toEqual(place(a, S, VP, { pref: 'lado' }))
    expect(place(a, S, VP, { pref: 'lado', lado: 'esquerda', gap: 8 }).left).toBe(a.left - 8 - S.w)
    expect(place(box(180, 400), S, { w: 390, h: 844 }, { pref: 'lado', queda: 'cima', gap: 8 }).top).toBe(400 - 8 - S.h)
  })
  it('gapQueda: a distância da queda para cima/baixo pode ser diferente da do lado (Fixar vídeo: 8 ao lado, 6 em cima)', () => {
    const c = box(180, 400), estreita = { w: 390, h: 844 }
    expect(place(c, S, estreita, { pref: 'lado', queda: 'cima', gap: 8, gapQueda: 6 }).top).toBe(400 - 6 - S.h)
    expect(place(c, S, estreita, { pref: 'lado', queda: 'cima', gap: 8 }).top).toBe(400 - 8 - S.h) // sem gapQueda vale o gap
    const a = box(700, 400)
    expect(place(a, S, VP, { pref: 'lado', gap: 8, gapQueda: 6 }).left).toBe(a.right + 8) // o lado segue o gap
  })
  it('janela baixa (320×180): a caixa fica inteira na janela, com altura limitada e sem cobrir o gatilho', () => {
    const vp = { w: 320, h: 180 }, a = box(150, 80), p = place(a, S, vp)
    expect(p.maxHeight).not.toBeNull()
    expect(dentro(p, S, vp)).toBe(true)
    expect(cobre(p, { w: S.w, h: p.maxHeight! }, a)).toBe(false)
  })
  it('janela muito baixa (661×188, caixa alta): o espaço do lado escolhido é menor que 80 px e ainda assim não cobre o gatilho', () => {
    const vp = { w: 661, h: 188 }, a = box(300, 68, 38, 38), alta = { w: 318, h: 224 }, p = place(a, alta, vp)
    expect(p.maxHeight).not.toBeNull()
    expect(p.maxHeight!).toBeLessThan(80)
    expect(cobre(p, { w: alta.w, h: p.maxHeight! }, a)).toBe(false)
    expect(p.top).toBeGreaterThanOrEqual(EDGE)
  })
  it('caixa mais larga que a janela menos 16: a borda esquerda fica em EDGE (nunca negativa)', () => {
    const p = place(box(300, 400), { w: 400, h: 100 }, { w: 390, h: 844 })
    expect(p.left).toBe(EDGE)
    expect(place(box(300, 400), { w: 400, h: 100 }, { w: 390, h: 844 }, { align: 'inicio' }).left).toBe(EDGE)
    expect(place(box(300, 400), { w: 400, h: 100 }, { w: 390, h: 844 }, { cx: 10 }).left).toBe(EDGE)
  })
  it('medida zerada (superfície e gatilho sem layout): posição finita no canto, sem NaN', () => {
    const p = place({ left: 0, top: 0, right: 0, bottom: 0 }, { w: 0, h: 0 }, VP)
    expect(Number.isFinite(p.left) && Number.isFinite(p.top)).toBe(true)
    expect(p).toMatchObject({ left: EDGE, maxHeight: null })
    const q = place(box(700, 400), { w: 0, h: 0 }, VP, { pref: 'lado' })
    expect(Number.isFinite(q.left) && Number.isFinite(q.top)).toBe(true)
  })
  it('em 390 px a largura máxima é a janela menos 16', () => {
    expect(maxWidthFor(390)).toBe(374)
    expect(maxWidthFor(1440, 310)).toBe(310)
    const p = place(box(300, 400), { w: 374, h: 100 }, { w: 390, h: 844 })
    expect(p.left).toBe(EDGE)
  })
})
