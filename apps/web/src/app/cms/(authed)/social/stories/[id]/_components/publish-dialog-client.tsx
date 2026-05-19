'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CardComposition } from '@tn-figueiredo/links/qr'
import { PublishDialog, type PublishDialogCallbacks } from '../../_components/publish-dialog'

interface PublishDialogClientProps extends PublishDialogCallbacks {
  slides: CardComposition[]
  caption?: string
}

export function PublishDialogClient({
  slides,
  caption,
  onSaveDraft,
  onPublishNow,
  onSchedule,
}: PublishDialogClientProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  function handleSuccess() {
    setOpen(false)
    router.push('/cms/social/stories')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-cms-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-cms-accent-hover transition-colors"
      >
        Publicar
      </button>

      {open && (
        <PublishDialog
          slides={slides}
          caption={caption}
          onClose={() => setOpen(false)}
          onSuccess={handleSuccess}
          onSaveDraft={onSaveDraft}
          onPublishNow={onPublishNow}
          onSchedule={onSchedule}
        />
      )}
    </>
  )
}
