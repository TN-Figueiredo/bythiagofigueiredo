'use client'

import * as React from 'react'
import type { UploadCampaignPdfResult } from '../[id]/edit/actions'

interface PdfUploadFormProps {
  campaignId: string
  currentPdfPath: string | null | undefined
  onUpload: (id: string, formData: FormData) => Promise<UploadCampaignPdfResult>
}

export function PdfUploadForm({ campaignId, currentPdfPath, onUpload }: PdfUploadFormProps) {
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [currentPath, setCurrentPath] = React.useState(currentPdfPath ?? null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const formData = new FormData(form)
    setUploading(true)
    try {
      const result = await onUpload(campaignId, formData)
      if (result.ok) {
        setCurrentPath(result.path)
        form.reset()
      } else {
        setError(result.message)
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <section>
      <h2>PDF da campanha</h2>

      {currentPath ? (
        <p data-testid="pdf-url">{currentPath}</p>
      ) : (
        <p data-testid="pdf-url" data-empty="true">Nenhum PDF enviado.</p>
      )}

      <form onSubmit={handleSubmit} encType="multipart/form-data">
        <label>
          Enviar PDF
          <input
            type="file"
            name="pdf"
            accept="application/pdf"
            data-testid="cms-campaign-upload-pdf-input"
          />
        </label>
        {error && <p role="alert" style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={uploading}>
          {uploading ? 'Enviando…' : 'Enviar PDF'}
        </button>
      </form>
    </section>
  )
}
