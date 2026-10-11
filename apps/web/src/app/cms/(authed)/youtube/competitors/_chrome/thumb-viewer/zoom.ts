// Matemática pura do zoom do visualizador de thumbnail (spec telas v9, 6.3). Sem DOM: a tela mede a caixa e a imagem e passa os números.
export interface View { scale: number; x: number; y: number }
export interface Size { w: number; h: number }
export interface Point { x: number; y: number }

/** Até 8× (800%): acima disso a imagem só vira borrão. */
export const MAX_SCALE = 8

const ok = (n: number): boolean => Number.isFinite(n) && n > 0

/** A escala de "Ajustar": cabe na caixa e NUNCA passa de 100% (imagem pequena fica no tamanho real). Sem tamanho medido, 1. */
export function fitScale(img: Size, box: Size): number {
  if (!ok(img.w) || !ok(img.h) || !ok(box.w) || !ok(box.h)) return 1
  return Math.min(box.w / img.w, box.h / img.h, 1)
}

/** Deixa a imagem dentro da caixa: o eixo em que ela é menor que a caixa fica centrado; no outro, a borda não se afasta. */
export function clampView(v: View, img: Size, box: Size): View {
  const w = img.w * v.scale, h = img.h * v.scale
  return {
    scale: v.scale,
    x: w <= box.w ? (box.w - w) / 2 : Math.min(0, Math.max(box.w - w, v.x)),
    y: h <= box.h ? (box.h - h) / 2 : Math.min(0, Math.max(box.h - h, v.y)),
  }
}

/** "Ajustar": a imagem inteira, centrada. */
export function fit(img: Size, box: Size): View {
  return clampView({ scale: fitScale(img, box), x: 0, y: 0 }, img, box)
}

/** Vai para uma escala exata mantendo sob `at` o ponto da imagem que já estava ali (limites: o Ajustar e MAX_SCALE). */
export function zoomTo(v: View, scale: number, at: Point, img: Size, box: Size): View {
  const min = fitScale(img, box)
  const ns = Math.min(MAX_SCALE, Math.max(min, scale))
  const k = ns / v.scale
  return clampView({ scale: ns, x: at.x - (at.x - v.x) * k, y: at.y - (at.y - v.y) * k }, img, box)
}

/** Multiplica a escala em torno do cursor. */
export function zoomAt(v: View, factor: number, at: Point, img: Size, box: Size): View {
  return zoomTo(v, v.scale * factor, at, img, box)
}

/** Arrasta a imagem; ela nunca sai da caixa. */
export function pan(v: View, dx: number, dy: number, img: Size, box: Size): View {
  return clampView({ scale: v.scale, x: v.x + dx, y: v.y + dy }, img, box)
}

/**
 * Está no Ajustar? Só quando a escala É a do ajuste (folga relativa de 1 milionésimo, contra o ponto flutuante).
 * Uma folga larga (antes: 0,01 absoluta) descartava como "ainda no Ajustar" cada passo pequeno da roda e do trackpad,
 * e como cada passo parte do Ajustar, ninguém saía dele. `zoomTo` já trava a escala mínima em `fitScale`, então ao
 * ampliar de verdade o resultado é sempre maior que o ajuste.
 */
export function isFit(v: View, img: Size, box: Size): boolean {
  const f = fitScale(img, box)
  return Math.abs(v.scale - f) <= f * 1e-6
}

/** Uma linha de roda do Firefox (`deltaMode` 1) vale 16 px; uma página (`deltaMode` 2), 100 px. */
export function wheelPixels(deltaY: number, deltaMode: number): number {
  return deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 100 : 1)
}

/** O fator de zoom de um evento de roda ou de pinça de trackpad (para cima, deltaY negativo, amplia). */
export function wheelFactor(deltaY: number, deltaMode: number): number {
  return Math.exp(-wheelPixels(deltaY, deltaMode) * 0.0015)
}
