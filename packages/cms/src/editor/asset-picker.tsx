'use client'

import * as React from 'react'
import { getEditorStrings } from './strings'

export interface AssetPickerProps {
  locale: string
  onUpload: (file: File) => Promise<{ url: string }>
  accept?: string
}

export function AssetPicker({ locale, onUpload, accept = 'image/*' }: AssetPickerProps) {
  const s = getEditorStrings(locale)
  const [uploading, setUploading] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          setUploading(true)
          try {
            await onUpload(file)
          } finally {
            setUploading(false)
            if (inputRef.current) inputRef.current.value = ''
          }
        }}
      />
      <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? s.assetPickerUploading : s.assetPickerButton}
      </button>
    </>
  )
}
