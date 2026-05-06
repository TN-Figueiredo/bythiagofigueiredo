import type { QrAspectRatio, QrAspectRatioName } from '../types.js'

/**
 * 5 preset aspect ratios for QR code compositions.
 */
export const ASPECT_RATIOS: Record<QrAspectRatioName, QrAspectRatio> = {
  square: { name: 'square', width: 512, height: 512 },
  landscape: { name: 'landscape', width: 640, height: 480 },
  portrait: { name: 'portrait', width: 480, height: 640 },
  wide: { name: 'wide', width: 800, height: 450 },
  story: { name: 'story', width: 450, height: 800 },
}

/**
 * Compute the maximum QR size that fits within the given canvas
 * dimensions with padding on all sides.
 */
export function computeQrSize(
  canvasWidth: number,
  canvasHeight: number,
  padding: number,
): number {
  const availableWidth = canvasWidth - padding * 2
  const availableHeight = canvasHeight - padding * 2
  return Math.min(availableWidth, availableHeight)
}
