// @tn-figueiredo/links/qr — QR subpath entry point

export { generateQrSvg } from './qr/generator.js'
export type { QrSvgResult } from './qr/generator.js'
export { composeQr } from './qr/composer.js'
export { ASPECT_RATIOS, computeQrSize } from './qr/aspect-ratios.js'

// Re-export QR-relevant types
export type {
  QrAspectRatioName,
  QrAspectRatio,
  QrGenerateOptions,
  QrComposeOptions,
  QrComposedResult,
} from './qr/types.js'
