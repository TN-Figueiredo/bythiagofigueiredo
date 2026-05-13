import type { Provider } from './types.js'

export interface MediaSpec {
  maxDuration?: number
  minDuration?: number
  aspectRatio?: string
  maxFileSize: number
  allowedFormats: string[]
  resolution?: { width: number; height: number }
}

const MB = 1024 * 1024
const GB = 1024 * MB

export const MEDIA_SPECS: Record<string, MediaSpec> = {
  'instagram:story': {
    aspectRatio: '9:16',
    maxDuration: 60,
    maxFileSize: 8 * MB,
    allowedFormats: ['mp4', 'mov', 'jpg', 'png'],
  },
  'instagram:reel': {
    aspectRatio: '9:16',
    minDuration: 5,
    maxDuration: 90,
    maxFileSize: 1 * GB,
    allowedFormats: ['mp4', 'mov'],
  },
  'instagram:feed': {
    maxFileSize: 8 * MB,
    allowedFormats: ['jpg', 'png'],
  },
  'youtube:video': {
    maxFileSize: 256 * GB,
    maxDuration: 43_200, // 12 hours
    allowedFormats: ['mp4', 'mov', 'avi', 'wmv', 'webm'],
  },
  'youtube:short': {
    aspectRatio: '9:16',
    maxDuration: 180,
    maxFileSize: 256 * GB,
    allowedFormats: ['mp4', 'mov'],
  },
  'bluesky:image': {
    maxFileSize: 1 * MB,
    allowedFormats: ['jpg', 'png', 'gif'],
  },
  'bluesky:video': {
    maxDuration: 180,
    maxFileSize: 100 * MB,
    allowedFormats: ['mp4'],
  },
}

export interface MediaFile {
  size: number
  format: string
  duration?: number
  width?: number
  height?: number
}

export function getMediaSpec(
  provider: Provider,
  placement: string,
): MediaSpec | undefined {
  return MEDIA_SPECS[`${provider}:${placement}`]
}

export function validateMedia(
  file: MediaFile,
  provider: Provider,
  placement: string,
): { valid: boolean; errors: string[] } {
  const spec = getMediaSpec(provider, placement)
  if (!spec) {
    return { valid: false, errors: [`Unknown placement "${placement}" for provider "${provider}"`] }
  }

  const errors: string[] = []

  const normalizedFormat = file.format.toLowerCase().replace(/^\./, '')
  if (!spec.allowedFormats.includes(normalizedFormat)) {
    errors.push(
      `Format "${normalizedFormat}" not allowed. Accepted: ${spec.allowedFormats.join(', ')}`,
    )
  }

  if (file.size > spec.maxFileSize) {
    const maxMB = spec.maxFileSize / MB
    const fileMB = (file.size / MB).toFixed(1)
    errors.push(`File size ${fileMB}MB exceeds limit of ${maxMB}MB`)
  }

  if (spec.maxDuration != null && file.duration != null && file.duration > spec.maxDuration) {
    errors.push(`Duration ${file.duration}s exceeds max ${spec.maxDuration}s`)
  }

  if (spec.minDuration != null && file.duration != null && file.duration < spec.minDuration) {
    errors.push(`Duration ${file.duration}s below min ${spec.minDuration}s`)
  }

  if (spec.aspectRatio && file.width != null && file.height != null) {
    const [rw, rh] = spec.aspectRatio.split(':').map(Number) as [number, number]
    const expected = rw / rh
    const actual = file.width / file.height
    const tolerance = 0.05
    if (Math.abs(actual - expected) > tolerance) {
      errors.push(
        `Aspect ratio ${file.width}:${file.height} does not match required ${spec.aspectRatio}`,
      )
    }
  }

  return { valid: errors.length === 0, errors }
}
