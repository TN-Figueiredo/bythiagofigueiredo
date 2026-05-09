import QRCode from 'qrcode'
import type { QrDotStyle } from '@tn-figueiredo/links/qr'

interface QrMatrix {
  size: number
  data: Uint8Array
}

function getModule(m: QrMatrix, row: number, col: number): boolean {
  if (row < 0 || col < 0 || row >= m.size || col >= m.size) return false
  return m.data[row * m.size + col] === 1
}

function isFinderZone(row: number, col: number, size: number): boolean {
  return (
    (row < 7 && col < 7) ||
    (row < 7 && col >= size - 7) ||
    (row >= size - 7 && col < 7)
  )
}

function cellXY(row: number, col: number, cell: number, margin: number) {
  return { x: margin + col * cell, y: margin + row * cell }
}

function squarePath(row: number, col: number, cell: number, margin: number): string {
  const { x, y } = cellXY(row, col, cell, margin)
  return `M${x},${y}h${cell}v${cell}h${-cell}Z`
}

function dotPath(row: number, col: number, cell: number, margin: number): string {
  const cx = margin + col * cell + cell / 2
  const cy = margin + row * cell + cell / 2
  const r = cell * 0.42
  return `M${cx - r},${cy}a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 ${-r * 2},0`
}

function roundedPath(
  row: number, col: number, cell: number, margin: number, m: QrMatrix,
): string {
  const { x, y } = cellXY(row, col, cell, margin)
  const s = cell
  const r = s * 0.3

  const top = getModule(m, row - 1, col)
  const bottom = getModule(m, row + 1, col)
  const left = getModule(m, row, col - 1)
  const right = getModule(m, row, col + 1)

  const rtl = (!top && !left) ? r : 0
  const rtr = (!top && !right) ? r : 0
  const rbr = (!bottom && !right) ? r : 0
  const rbl = (!bottom && !left) ? r : 0

  let d = `M${x + rtl},${y}`
  d += `h${s - rtl - rtr}`
  d += rtr > 0 ? `a${rtr},${rtr} 0 0 1 ${rtr},${rtr}` : ''
  d += `v${s - rtr - rbr}`
  d += rbr > 0 ? `a${rbr},${rbr} 0 0 1 ${-rbr},${rbr}` : ''
  d += `h${-(s - rbl - rbr)}`
  d += rbl > 0 ? `a${rbl},${rbl} 0 0 1 ${-rbl},${-rbl}` : ''
  d += `v${-(s - rtl - rbl)}`
  d += rtl > 0 ? `a${rtl},${rtl} 0 0 1 ${rtl},${-rtl}` : ''
  d += 'Z'
  return d
}

function finderSvg(
  startRow: number, startCol: number,
  cell: number, margin: number, fg: string, bg: string,
  rounded: boolean,
): string {
  const { x, y } = cellXY(startRow, startCol, cell, margin)
  const outer = cell * 7
  const inner = cell * 5
  const core = cell * 3
  const ix = x + cell
  const iy = y + cell
  const cx = x + cell * 2
  const cy = y + cell * 2

  if (rounded) {
    const r1 = cell * 1.2
    const r2 = cell * 0.8
    const r3 = cell * 0.5
    return (
      `<rect x="${x}" y="${y}" width="${outer}" height="${outer}" rx="${r1}" fill="${fg}"/>` +
      `<rect x="${ix}" y="${iy}" width="${inner}" height="${inner}" rx="${r2}" fill="${bg}"/>` +
      `<rect x="${cx}" y="${cy}" width="${core}" height="${core}" rx="${r3}" fill="${fg}"/>`
    )
  }

  return (
    `<rect x="${x}" y="${y}" width="${outer}" height="${outer}" fill="${fg}"/>` +
    `<rect x="${ix}" y="${iy}" width="${inner}" height="${inner}" fill="${bg}"/>` +
    `<rect x="${cx}" y="${cy}" width="${core}" height="${core}" fill="${fg}"/>`
  )
}

export function generateStyledQrSvg(
  url: string,
  fg: string,
  bg: string,
  ec: 'L' | 'M' | 'Q' | 'H',
  style: QrDotStyle,
  size = 512,
): string {
  const qr = QRCode.create(url, { errorCorrectionLevel: ec })
  const matrix: QrMatrix = { size: qr.modules.size, data: qr.modules.data }
  const marginModules = 2
  const totalModules = matrix.size + marginModules * 2
  const cell = size / totalModules
  const margin = marginModules * cell

  const roundedFinders = style === 'classy' || style === 'rounded' || style === 'dots'
  const finders =
    finderSvg(0, 0, cell, margin, fg, bg, roundedFinders) +
    finderSvg(0, matrix.size - 7, cell, margin, fg, bg, roundedFinders) +
    finderSvg(matrix.size - 7, 0, cell, margin, fg, bg, roundedFinders)

  const paths: string[] = []

  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (!getModule(matrix, row, col)) continue
      if (isFinderZone(row, col, matrix.size)) continue

      switch (style) {
        case 'square':
          paths.push(squarePath(row, col, cell, margin))
          break
        case 'dots':
        case 'classy':
          paths.push(dotPath(row, col, cell, margin))
          break
        case 'rounded':
          paths.push(roundedPath(row, col, cell, margin, matrix))
          break
      }
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`,
    `<rect width="${size}" height="${size}" fill="${bg}"/>`,
    finders,
    `<path d="${paths.join('')}" fill="${fg}"/>`,
    '</svg>',
  ].join('')
}
