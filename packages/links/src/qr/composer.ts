import type { QrComposeOptions, QrComposedResult } from '../types.js'
import { ASPECT_RATIOS, computeQrSize } from './aspect-ratios.js'
import { generateQrSvg } from './generator.js'

/**
 * Compose a QR code centered within an aspect-ratio canvas.
 * Optionally overlays a logo in the center.
 */
export async function composeQr(options: QrComposeOptions): Promise<QrComposedResult> {
  const aspectRatioName = options.aspectRatio ?? 'square'
  const ratio = ASPECT_RATIOS[aspectRatioName]
  const padding = options.padding ?? 32
  const backgroundColor = options.backgroundColor ?? '#ffffff'

  const qrSize = computeQrSize(ratio.width, ratio.height, padding)
  const qrResult = await generateQrSvg({
    ...options,
    size: qrSize,
  })

  // Center QR in canvas
  const qrX = (ratio.width - qrSize) / 2
  const qrY = (ratio.height - qrSize) / 2

  // Build composed SVG
  let innerSvg = qrResult.svg

  // Extract the inner content of the QR SVG (strip the outer <svg> wrapper)
  const innerMatch = innerSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/)
  const qrInner = innerMatch ? innerMatch[1]! : innerSvg

  let logoElement = ''
  if (options.logoBase64) {
    const logoSize = qrSize * (options.logoSize ?? 0.2)
    const logoX = ratio.width / 2 - logoSize / 2
    const logoY = ratio.height / 2 - logoSize / 2
    logoElement = `<image x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" href="${options.logoBase64}" />`
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ratio.width}" height="${ratio.height}" viewBox="0 0 ${ratio.width} ${ratio.height}">
  <rect width="${ratio.width}" height="${ratio.height}" fill="${backgroundColor}" />
  <g transform="translate(${qrX}, ${qrY})">
    <svg width="${qrSize}" height="${qrSize}" viewBox="0 0 ${qrSize} ${qrSize}">
      ${qrInner}
    </svg>
  </g>
  ${logoElement}
</svg>`

  return {
    svg,
    width: ratio.width,
    height: ratio.height,
    qrSize,
  }
}
