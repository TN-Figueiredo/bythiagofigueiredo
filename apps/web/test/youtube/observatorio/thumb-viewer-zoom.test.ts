// @vitest-environment node
// Matemática pura do zoom do visualizador de thumbnail (spec telas v9, 6.3).
import { describe, it, expect } from 'vitest'
import { fit, zoomAt, pan, zoomTo, MAX_SCALE, type View } from '@/app/cms/(authed)/youtube/competitors/_chrome/thumb-viewer/zoom'

const IMG = { w: 1280, h: 720 }
const BOX = { w: 800, h: 600 }

describe('thumb-viewer · zoom', () => {
  it('fit centraliza a imagem na caixa', () => {
    const v = fit(IMG, BOX)
    expect(v.scale).toBeCloseTo(800 / 1280, 6) // limitado pela largura
    expect(v.x).toBeCloseTo(0, 6)
    expect(v.y).toBeCloseTo((600 - 720 * v.scale) / 2, 6)
  })
  it('fit nunca amplia além de 100%: imagem menor que a caixa fica no tamanho real, centrada', () => {
    const v = fit({ w: 320, h: 180 }, { w: 1200, h: 800 })
    expect(v.scale).toBe(1)
    expect(v.x).toBe((1200 - 320) / 2)
    expect(v.y).toBe((800 - 180) / 2)
  })
  it('fit com caixa ou imagem sem tamanho (sem layout) não devolve zero nem NaN', () => {
    for (const v of [fit(IMG, { w: 0, h: 0 }), fit({ w: 0, h: 0 }, BOX)]) {
      expect(Number.isFinite(v.scale) && v.scale > 0).toBe(true)
      expect(Number.isFinite(v.x) && Number.isFinite(v.y)).toBe(true)
    }
  })
  it('zoomAt mantém o ponto da imagem que está sob o cursor', () => {
    const v0 = zoomTo(fit(IMG, BOX), 1, { x: 400, y: 300 }, IMG, BOX) // 100%: a imagem passa da caixa
    const at = { x: 300, y: 200 }
    const sob = { x: (at.x - v0.x) / v0.scale, y: (at.y - v0.y) / v0.scale }
    const v1 = zoomAt(v0, 1.5, at, IMG, BOX)
    expect(v1.scale).toBeCloseTo(1.5, 6)
    expect((at.x - v1.x) / v1.scale).toBeCloseTo(sob.x, 4)
    expect((at.y - v1.y) / v1.scale).toBeCloseTo(sob.y, 4)
  })
  it('limite mínimo é o Ajustar e o máximo é MAX_SCALE', () => {
    const f = fit(IMG, BOX)
    expect(zoomAt(f, 0.1, { x: 400, y: 300 }, IMG, BOX).scale).toBeCloseTo(f.scale, 6)
    expect(zoomAt(f, 1000, { x: 400, y: 300 }, IMG, BOX).scale).toBe(MAX_SCALE)
    expect(MAX_SCALE).toBe(8)
  })
  it('"100%" é um pixel da imagem por pixel da tela', () => {
    const v = zoomTo(fit(IMG, BOX), 1, { x: 400, y: 300 }, IMG, BOX)
    expect(v.scale).toBe(1)
    // com a imagem maior que a caixa, o centro da caixa continua sobre o centro da imagem
    expect((400 - v.x) / v.scale).toBeCloseTo(640, 4)
    expect((300 - v.y) / v.scale).toBeCloseTo(360, 4)
  })
  it('pan não deixa a imagem sair da caixa', () => {
    const v0: View = zoomTo(fit(IMG, BOX), 1, { x: 400, y: 300 }, IMG, BOX)
    const longe = pan(v0, 99999, 99999, IMG, BOX)
    expect(longe.x).toBe(0)
    expect(longe.y).toBe(0)
    const outro = pan(v0, -99999, -99999, IMG, BOX)
    expect(outro.x).toBe(BOX.w - IMG.w) // a borda direita da imagem encosta na da caixa
    expect(outro.y).toBe(BOX.h - IMG.h)
  })
  it('pan com a imagem menor que a caixa em um eixo mantém esse eixo centrado', () => {
    const v0 = zoomTo(fit(IMG, BOX), 1, { x: 400, y: 300 }, IMG, { w: 800, h: 900 }) // alta demais: centra y
    const v = pan(v0, 99999, 99999, IMG, { w: 800, h: 900 })
    expect(v.y).toBe((900 - 720) / 2) // o eixo em que a imagem cabe não anda
    expect(v.x).toBe(0) // o outro encosta na borda
  })
})
