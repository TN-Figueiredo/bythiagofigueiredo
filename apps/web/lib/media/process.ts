import sharp from 'sharp'
import { sanitizeSvg } from './sanitize-svg'

export interface ProcessResult {
  buffer: Buffer
  width: number | null
  height: number | null
  mimeType: string
}

const RASTER_TYPES_FOR_SHARP = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

export async function processImage(
  buffer: Buffer,
  mimeType: string,
): Promise<ProcessResult> {
  if (mimeType === 'image/svg+xml') {
    const sanitized = sanitizeSvg(buffer.toString('utf-8'))
    return {
      buffer: Buffer.from(sanitized, 'utf-8'),
      width: null,
      height: null,
      mimeType,
    }
  }

  if (mimeType === 'image/gif') {
    const meta = await sharp(buffer).metadata()
    return {
      buffer,
      width: meta.width ?? null,
      height: meta.height ?? null,
      mimeType,
    }
  }

  if (RASTER_TYPES_FOR_SHARP.has(mimeType)) {
    const { data, info } = await sharp(buffer)
      .rotate()
      .toBuffer({ resolveWithObject: true })
    return {
      buffer: data,
      width: info.width,
      height: info.height,
      mimeType,
    }
  }

  return { buffer, width: null, height: null, mimeType }
}
