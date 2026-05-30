'use client'

import { useCallback } from 'react'
import { QrCardBuilder } from '@tn-figueiredo/links-admin/client'
import type { QrTemplate } from '@tn-figueiredo/links-admin'
import type { CardComposition } from '@tn-figueiredo/links/qr'
import {
  saveQrTemplate,
  deleteQrTemplate,
  exportQrCard,
  uploadQrImage,
} from './actions'
import { createQrCard, updateQrCard } from './card-actions'

interface Props {
  link: { id: string; code: string; title: string | null }
  shortUrl: string
  initialComposition: CardComposition
  templates: QrTemplate[]
  cardId: string | null
  cardName: string
}

export function QrCardBuilderPage({ link, shortUrl, initialComposition, templates, cardId, cardName }: Props) {
  const handleSave = useCallback(async (composition: CardComposition) => {
    if (cardId) {
      const result = await updateQrCard(cardId, link.id, { composition })
      if (!result.ok) {
        console.error('[QR Card] updateQrCard failed:', result.error)
      }
    } else {
      const result = await createQrCard(link.id, cardName, composition)
      if (result.ok) {
        window.location.href = `/cms/links/${link.id}/qr?card=${result.cardId}`
        return
      }
      console.error('[QR Card] createQrCard failed:', result.error)
    }
  }, [link.id, cardId, cardName])

  const handleExport = useCallback(async (blob: Blob, metadata: { format: 'png' | 'svg'; scale: number; width: number; height: number }) => {
    const fd = new FormData()
    fd.append('file', blob, `qr-card.${metadata.format}`)
    fd.append('format', metadata.format)
    const result = await exportQrCard(link.id, fd)
    return result.ok ? { url: result.url } : null
  }, [link.id])

  const handleSaveTemplate = useCallback(async (name: string, composition: CardComposition, thumbnail: Blob) => {
    const fd = new FormData()
    fd.append('thumbnail', thumbnail, 'thumbnail.png')
    await saveQrTemplate(name, composition, fd)
  }, [])

  const handleDeleteTemplate = useCallback(async (id: string) => {
    await deleteQrTemplate(id)
  }, [])

  const handleImageUpload = useCallback(async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const result = await uploadQrImage(fd)
    if (!result.ok) {
      console.error('[QR Card] uploadQrImage failed:', result.error)
    }
    return result.ok ? result.url : ''
  }, [])

  return (
    <QrCardBuilder
      link={link}
      shortUrl={shortUrl}
      initialComposition={initialComposition}
      templates={templates}
      onSave={handleSave}
      onExport={handleExport}
      onSaveTemplate={handleSaveTemplate}
      onDeleteTemplate={handleDeleteTemplate}
      onImageUpload={handleImageUpload}
    />
  )
}
