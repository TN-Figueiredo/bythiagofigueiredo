'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { uploadMediaAction } from '../../media/actions'
import { MediaCropEditor } from './media-crop-editor'
import type { CropPreset, MediaAssetResult } from './types'
import { getMediaGalleryStrings } from './_i18n/types'
import type { MediaFolder } from '@/lib/media/types'

// SVG files are accepted here but sanitized server-side: uploadMediaAction ->
// uploadMediaAsset -> processImage -> sanitizeSvg (DOMPurify with SVG profile,
// strips <script>, foreignObject, event handlers). No client-side sanitization
// needed — the raw file never renders untrusted; only the server-processed
// version is stored in Blob storage.
const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml'

const FOLDER_OPTIONS: Array<{ value: MediaFolder; labelKey: keyof ReturnType<typeof getMediaGalleryStrings>['library'] }> = [
  { value: 'general', labelKey: 'folderGeneral' },
  { value: 'authors', labelKey: 'folderAuthors' },
  { value: 'blog', labelKey: 'folderBlog' },
  { value: 'pipeline', labelKey: 'folderPipeline' },
  { value: 'newsletters', labelKey: 'folderNewsletters' },
  { value: 'branding', labelKey: 'folderBranding' },
  { value: 'og', labelKey: 'folderOg' },
  { value: 'ads', labelKey: 'folderAds' },
  { value: 'links', labelKey: 'folderLinks' },
]

interface UploadTabProps {
  onSelect: (asset: MediaAssetResult) => void
  folder?: string
  cropPreset?: CropPreset
  locale: 'en' | 'pt-BR'
  siteId: string
}

export function MediaUploadTab({ onSelect, folder, cropPreset, locale }: UploadTabProps) {
  const t = getMediaGalleryStrings(locale)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null)
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null)
  const [croppedDims, setCroppedDims] = useState<{ width: number; height: number } | null>(null)
  const [showCrop, setShowCrop] = useState(false)

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  useEffect(() => {
    if (croppedBlob) {
      const url = URL.createObjectURL(croppedBlob)
      setCroppedPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setCroppedPreviewUrl(null)
  }, [croppedBlob])

  const [altText, setAltText] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<MediaFolder>((folder as MediaFolder) ?? 'general')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [altError, setAltError] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [isDragOver, setIsDragOver] = useState(false)

  const handleFile = useCallback(
    (file: File) => {
      setSelectedFile(file)
      setCroppedBlob(null)
      setCroppedDims(null)
      setUploadError(null)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(file))

      if (cropPreset && file.type !== 'image/svg+xml' && file.type !== 'image/gif') {
        setShowCrop(true)
      } else {
        setShowCrop(false)
      }
    },
    [cropPreset, previewUrl],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleCropConfirm = useCallback(
    (blob: Blob, dims: { width: number; height: number }) => {
      setCroppedBlob(blob)
      setCroppedDims(dims)
      setShowCrop(false)
    },
    [],
  )

  const handleCropCancel = useCallback(() => {
    setShowCrop(false)
    setCroppedBlob(null)
  }, [])

  const addTag = useCallback(() => {
    const raw = tagInput.trim()
    if (!raw) { setTagInput(''); return }
    const newTags = raw
      .split(/[,\s]+/)
      .map((t) => t.replace(/^#/, '').trim().toLowerCase())
      .filter((t) => t && !tags.includes(t))
    if (newTags.length > 0) setTags((prev) => [...prev, ...newTags])
    setTagInput('')
  }, [tagInput, tags])

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag))
  }, [])

  const handleSubmit = useCallback(async () => {
    setAltError(false)
    if (!altText.trim()) {
      setAltError(true)
      return
    }

    const fileToUpload = croppedBlob ?? selectedFile
    if (!fileToUpload) return

    setUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      if (croppedBlob) {
        const file = new File([croppedBlob], 'cropped.webp', { type: 'image/webp' })
        formData.append('file', file)
      } else {
        formData.append('file', fileToUpload as File)
      }
      formData.append('folder', selectedFolder)
      formData.append('altText', altText.trim())
      if (tags.length > 0) formData.append('tags', tags.join(','))

      const result = await uploadMediaAction(formData)

      if (!result.ok) {
        setUploadError(t.upload.errorCodes?.[result.error] ?? result.error)
        return
      }

      onSelect({
        id: result.asset.id,
        url: result.asset.blobUrl,
        alt: result.asset.altText ?? altText.trim(),
        width: croppedDims?.width ?? result.asset.width ?? 0,
        height: croppedDims?.height ?? result.asset.height ?? 0,
        mimeType: result.asset.mimeType,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[media-upload]', msg)
      setUploadError(`${t.upload.uploadError}: ${msg}`)
    } finally {
      setUploading(false)
    }
  }, [altText, croppedBlob, croppedDims, selectedFile, selectedFolder, tags, onSelect, t])

  if (showCrop && previewUrl && cropPreset) {
    return (
      <MediaCropEditor
        imageUrl={previewUrl}
        preset={cropPreset}
        locale={locale}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />
    )
  }

  if (!selectedFile) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors ${
          isDragOver
            ? 'border-cms-accent bg-cms-accent/10'
            : 'border-cms-border hover:border-cms-border'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-testid="drop-zone"
      >
        <svg className="mb-4 h-12 w-12 text-cms-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="mb-2 text-sm text-cms-text-muted">
          {isDragOver ? t.upload.dropHere : t.upload.dragPrompt}
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent/90"
        >
          {t.upload.selectFile}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={handleInputChange}
          data-testid="media-file-input"
        />
      </div>
    )
  }

  return (
    <div className="space-y-4" data-testid="upload-form">
      {previewUrl && (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={croppedPreviewUrl ?? previewUrl}
            alt=""
            className="max-h-48 rounded-lg border border-cms-border"
          />
        </div>
      )}

      <p className="text-center text-xs text-cms-text-dim">
        {selectedFile.name}
        {croppedDims ? ` — ${croppedDims.width}x${croppedDims.height}` : ''}
      </p>

      <div>
        <label htmlFor="media-alt" className="mb-1 block text-sm font-medium text-cms-text-muted">
          {t.upload.altLabel} <span className="text-red-400">*</span>
        </label>
        <input
          id="media-alt"
          type="text"
          value={altText}
          onChange={(e) => { setAltText(e.target.value); setAltError(false) }}
          placeholder={t.upload.altPlaceholder}
          className="w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none"
          data-testid="alt-input"
        />
        {altError && <p className="mt-1 text-xs text-red-400">{t.upload.altRequired}</p>}
      </div>

      <div>
        <label htmlFor="media-folder" className="mb-1 block text-sm font-medium text-cms-text-muted">
          {t.upload.folderLabel}
        </label>
        <select
          id="media-folder"
          value={selectedFolder}
          onChange={(e) => setSelectedFolder(e.target.value as MediaFolder)}
          className="w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text focus:border-cms-accent focus:outline-none"
          data-testid="folder-select"
        >
          {FOLDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t.library[opt.labelKey]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="media-tags" className="mb-1 block text-sm font-medium text-cms-text-muted">
          {t.upload.tagsLabel}
        </label>
        <div className="flex flex-wrap gap-1 mb-1">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-cms-surface px-2 py-0.5 text-xs text-cms-text-muted">
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="text-cms-text-dim hover:text-cms-text">x</button>
            </span>
          ))}
        </div>
        <input
          id="media-tags"
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
          placeholder={t.upload.tagsPlaceholder}
          className="w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none"
          data-testid="tags-input"
        />
      </div>

      {uploadError && (
        <p className="text-sm text-red-400">{uploadError}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => { setSelectedFile(null); setPreviewUrl(null); setCroppedBlob(null) }}
          className="rounded-md px-4 py-2 text-sm text-cms-text-muted hover:bg-cms-surface-hover"
        >
          {t.crop.cropCancel}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={uploading}
          className="rounded-md bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent/90 disabled:opacity-50"
          data-testid="upload-submit"
        >
          {uploading ? t.upload.uploading : t.upload.uploadButton}
        </button>
      </div>
    </div>
  )
}
