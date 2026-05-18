'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CardComposition } from '@tn-figueiredo/links/qr'
import { PublishDialog } from '../../_components/publish-dialog'

interface PublishDialogClientProps {
  siteId: string
  postId: string
  slides: CardComposition[]
  caption?: string
}

export function PublishDialogClient({
  siteId,
  postId,
  slides,
  caption,
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
          siteId={siteId}
          postId={postId}
          slides={slides}
          caption={caption}
          onClose={() => setOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  )
}
