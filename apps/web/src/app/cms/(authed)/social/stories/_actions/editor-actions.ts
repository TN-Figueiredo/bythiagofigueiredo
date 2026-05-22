'use server'

import { requireEditAccess } from '@/lib/social/actions/_shared'
import { createTemplate, deleteTemplate } from '@/lib/social/actions/templates'
import { uploadMediaAction } from '@/app/cms/(authed)/media/actions'
import type { CardComposition } from '@tn-figueiredo/links/qr'

const ALLOWED_VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'avi'])

export async function exportSlideToBlob(
  blob: Blob,
  metadata: { format: 'png'; scale: number; width: number; height: number },
): Promise<{ url: string } | null> {
  try {
    await requireEditAccess()
    const { put } = await import('@vercel/blob')
    const filename = `stories/${crypto.randomUUID()}-slide.${metadata.format}`
    const result = await put(filename, blob, {
      access: 'public',
      contentType: `image/${metadata.format}`,
    })
    return { url: result.url }
  } catch (err) {
    console.error('[exportSlideToBlob]', err)
    return null
  }
}

export async function saveTemplate(
  name: string,
  composition: CardComposition,
  thumbnail: Blob,
): Promise<void> {
  await requireEditAccess()
  const thumbnailBuffer = Buffer.from(await thumbnail.arrayBuffer())
  const thumbnailBase64 = `data:image/png;base64,${thumbnailBuffer.toString('base64')}`
  await createTemplate({
    name,
    aspectRatio: '9:16',
    composition,
    thumbnailBase64,
  })
}

export async function removeTemplate(templateId: string): Promise<void> {
  await requireEditAccess()
  await deleteTemplate(templateId)
}

export async function uploadImage(file: File): Promise<string> {
  await requireEditAccess()
  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', 'general')
  const result = await uploadMediaAction(formData)
  if (!result.ok) throw new Error(result.error)
  return result.asset.blobUrl
}

export async function uploadVideo(file: File): Promise<string> {
  await requireEditAccess()
  const maxSize = 50 * 1024 * 1024
  if (file.size > maxSize) throw new Error('Video exceeds 50MB limit')
  const allowed = ['video/mp4', 'video/webm', 'video/quicktime']
  if (!allowed.includes(file.type)) throw new Error('Unsupported video format')
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (!ALLOWED_VIDEO_EXTENSIONS.has(ext)) throw new Error('Unsupported video extension')
  const { put } = await import('@vercel/blob')
  const filename = `stories/${crypto.randomUUID()}-video.${ext}`
  const result = await put(filename, file, { access: 'public', contentType: file.type })
  return result.url
}
