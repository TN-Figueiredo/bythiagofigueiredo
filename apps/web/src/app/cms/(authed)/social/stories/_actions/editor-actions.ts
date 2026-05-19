'use server'

import { createTemplate, deleteTemplate } from '@/lib/social/actions/templates'
import { uploadMediaAction } from '@/app/cms/(authed)/media/actions'
import type { CardComposition } from '@tn-figueiredo/links/qr'

export async function exportSlideToBlob(
  blob: Blob,
  metadata: { format: 'png'; scale: number; width: number; height: number },
): Promise<{ url: string } | null> {
  try {
    const { put } = await import('@vercel/blob')
    const filename = `stories/${Date.now()}-slide.${metadata.format}`
    const result = await put(filename, blob, {
      access: 'public',
      contentType: `image/${metadata.format}`,
    })
    return { url: result.url }
  } catch {
    return null
  }
}

export async function saveTemplate(
  name: string,
  composition: CardComposition,
  thumbnail: Blob,
): Promise<void> {
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
  await deleteTemplate(templateId)
}

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', 'general')
  const result = await uploadMediaAction(formData)
  if (!result.ok) throw new Error(result.error)
  return result.asset.blobUrl
}
