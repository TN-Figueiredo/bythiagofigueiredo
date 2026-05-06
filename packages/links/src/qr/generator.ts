import QRCode from 'qrcode'
import type { QrGenerateOptions } from '../types.js'

export interface QrSvgResult {
  svg: string
  size: number
}

/**
 * Generate a QR code as an SVG string using the `qrcode` npm package.
 */
export async function generateQrSvg(options: QrGenerateOptions): Promise<QrSvgResult> {
  if (!options.url) {
    throw new Error('QR URL must not be empty')
  }

  const size = options.size ?? 512
  const margin = options.margin ?? 2
  const darkColor = options.darkColor ?? '#000000'
  const lightColor = options.lightColor ?? '#ffffff'
  const errorCorrection = options.errorCorrection ?? 'M'

  const svg = await QRCode.toString(options.url, {
    type: 'svg',
    width: size,
    margin,
    color: {
      dark: darkColor,
      light: lightColor,
    },
    errorCorrectionLevel: errorCorrection,
  })

  return { svg, size }
}
