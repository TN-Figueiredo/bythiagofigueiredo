'use client'
import { useState } from 'react'
import type { LinkSummary, QrConfig } from '../types'

export interface QrComposerProps {
  link: LinkSummary
  onGenerate: (config: QrConfig) => Promise<{ svgContent: string }>
  onDownload: (config: QrConfig) => void
}

const DEFAULT_CONFIG: QrConfig = {
  foregroundColor: '#000000',
  backgroundColor: '#ffffff',
  logoDataUrl: null,
  errorCorrectionLevel: 'M',
  size: 512,
  format: 'svg',
}

export function QrComposer({ link, onGenerate, onDownload }: QrComposerProps) {
  const [config, setConfig] = useState<QrConfig>(DEFAULT_CONFIG)
  const [generated, setGenerated] = useState(false)
  const [svgPreview, setSvgPreview] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const result = await onGenerate(config)
      setSvgPreview(result.svgContent)
      setGenerated(true)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setConfig((prev) => ({ ...prev, logoDataUrl: reader.result as string }))
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-6" data-testid="qr-composer-panel">
      <h3 className="text-lg font-semibold text-foreground">QR Code Configuration</h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Configuration */}
        <div className="space-y-4">
          {/* Foreground Color */}
          <div>
            <label htmlFor="qr-fg-color" className="block text-sm font-medium text-foreground">
              Foreground Color
            </label>
            <input
              id="qr-fg-color"
              type="color"
              value={config.foregroundColor}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, foregroundColor: e.target.value }))
              }
              className="mt-1 h-10 w-full cursor-pointer rounded border border"
            />
          </div>

          {/* Background Color */}
          <div>
            <label htmlFor="qr-bg-color" className="block text-sm font-medium text-foreground">
              Background Color
            </label>
            <input
              id="qr-bg-color"
              type="color"
              value={config.backgroundColor}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, backgroundColor: e.target.value }))
              }
              className="mt-1 h-10 w-full cursor-pointer rounded border border"
            />
          </div>

          {/* Error Correction Level */}
          <div>
            <label htmlFor="qr-ecl" className="block text-sm font-medium text-foreground">
              Error Correction Level
            </label>
            <select
              id="qr-ecl"
              value={config.errorCorrectionLevel}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  errorCorrectionLevel: e.target.value as QrConfig['errorCorrectionLevel'],
                }))
              }
              className="mt-1 block w-full rounded-md border border px-3 py-2 text-sm"
            >
              <option value="L">L (7% recovery)</option>
              <option value="M">M (15% recovery)</option>
              <option value="Q">Q (25% recovery)</option>
              <option value="H">H (30% recovery)</option>
            </select>
          </div>

          {/* Size */}
          <div>
            <label htmlFor="qr-size" className="block text-sm font-medium text-foreground">
              Size (px)
            </label>
            <input
              id="qr-size"
              type="number"
              min={128}
              max={2048}
              value={config.size}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, size: Number(e.target.value) }))
              }
              className="mt-1 block w-full rounded-md border border px-3 py-2 text-sm"
            />
          </div>

          {/* Format */}
          <div>
            <label htmlFor="qr-format" className="block text-sm font-medium text-foreground">
              Format
            </label>
            <select
              id="qr-format"
              value={config.format}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, format: e.target.value as 'svg' | 'png' }))
              }
              className="mt-1 block w-full rounded-md border border px-3 py-2 text-sm"
            >
              <option value="svg">SVG</option>
              <option value="png">PNG</option>
            </select>
          </div>

          {/* Logo Upload */}
          <div>
            <p className="text-sm font-medium text-foreground">Logo (center overlay)</p>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="mt-1 block w-full text-sm text-muted-foreground"
            />
            {config.logoDataUrl && <p className="mt-1 text-xs text-green-600 dark:text-green-400">Logo loaded</p>}
          </div>
        </div>

        {/* Preview */}
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border p-4">
          <div
            data-testid="qr-preview"
            className="flex h-48 w-48 items-center justify-center"
            style={{ backgroundColor: config.backgroundColor }}
          >
            {svgPreview ? (
              <div dangerouslySetInnerHTML={{ __html: svgPreview }} />
            ) : (
              <p className="text-sm text-muted-foreground">Preview will appear here</p>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">/go/{link.code}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isGenerating ? 'Generating...' : 'Generate QR'}
        </button>
        {generated && (
          <button
            type="button"
            onClick={() => onDownload(config)}
            className="rounded-md border border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Download
          </button>
        )}
      </div>
    </div>
  )
}
