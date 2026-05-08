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

// Card composition (QR Card Builder)
export {
  CardCompositionSchema,
  ASPECT_RATIO_PRESETS,
  AVAILABLE_FONTS,
  MAX_ELEMENTS,
  MAX_HISTORY,
  MIN_CANVAS,
  MAX_CANVAS,
  createDefaultComposition,
  createQrElement,
  createTextElement,
  createImageElement,
  migrateLegacyQrConfig,
} from './qr/card-composition.js'
export type {
  CardComposition,
  CardElement,
  QrElement,
  TextElement,
  ImageElement,
  Background,
  GradientStop,
  Canvas,
  AspectRatioPreset,
} from './qr/card-composition.js'
