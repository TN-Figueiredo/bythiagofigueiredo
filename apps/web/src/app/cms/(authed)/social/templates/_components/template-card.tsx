'use client'

import { useState, useTransition } from 'react'
import type { SocialTemplate } from '@/lib/social/template-schemas'
import { deleteTemplate, duplicateTemplate, setDefaultTemplate } from '@/lib/social/actions/templates'
import { useRouter } from 'next/navigation'

interface TemplateCardProps {
  template: SocialTemplate
  siteId: string
}

export function TemplateCard({ template, siteId }: TemplateCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const isSystem = template.site_id === null

  function handleDuplicate() {
    setMenuOpen(false)
    startTransition(async () => {
      await duplicateTemplate(template.id)
      router.refresh()
    })
  }

  function handleSetDefault() {
    setMenuOpen(false)
    startTransition(async () => {
      await setDefaultTemplate(template.id, siteId)
      router.refresh()
    })
  }

  function handleDelete() {
    setConfirmDelete(false)
    setMenuOpen(false)
    startTransition(async () => {
      await deleteTemplate(template.id)
      router.refresh()
    })
  }

  // Aspect ratio for card preview sizing
  const aspectClass =
    template.aspect_ratio === '9:16'
      ? 'aspect-[9/16]'
      : template.aspect_ratio === '1:1'
        ? 'aspect-square'
        : 'aspect-video'

  return (
    <div className={`group relative overflow-hidden rounded-lg border border-cms-border bg-cms-surface transition-colors hover:border-cms-accent/40 ${isPending ? 'opacity-50' : ''}`}>
      {/* Thumbnail preview */}
      <div className={`${aspectClass} relative bg-cms-bg`}>
        {template.thumbnail_url ? (
          <img
            src={template.thumbnail_url}
            alt={template.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-cms-text-dim text-xs">
            No preview
          </div>
        )}

        {/* Default star badge */}
        {template.is_default && (
          <div className="absolute left-2 top-2 rounded-full bg-amber-500/90 p-1" title="Default template">
            <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
        )}

        {/* System badge */}
        {isSystem && (
          <div className="absolute right-2 top-2 rounded bg-cms-bg/80 px-1.5 py-0.5 text-[10px] font-medium text-cms-text-dim backdrop-blur">
            System
          </div>
        )}
      </div>

      {/* Info bar */}
      <div className="flex items-center justify-between p-2">
        <span className="truncate text-sm font-medium text-cms-text">{template.name}</span>

        {/* Overflow menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded p-1 text-cms-text-dim hover:bg-cms-border hover:text-cms-text"
            aria-label="Template actions"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-40 rounded-md border border-cms-border bg-cms-surface py-1 shadow-lg">
                {!isSystem && (
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      router.push(`/cms/social/templates/${template.id}/edit`)
                    }}
                    className="flex w-full items-center px-3 py-1.5 text-sm text-cms-text hover:bg-cms-border"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={handleDuplicate}
                  className="flex w-full items-center px-3 py-1.5 text-sm text-cms-text hover:bg-cms-border"
                >
                  Duplicate
                </button>
                <button
                  onClick={handleSetDefault}
                  className="flex w-full items-center px-3 py-1.5 text-sm text-cms-text hover:bg-cms-border"
                >
                  Set as Default
                </button>
                {!isSystem && (
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      setConfirmDelete(true)
                    }}
                    className="flex w-full items-center px-3 py-1.5 text-sm text-red-400 hover:bg-cms-border"
                  >
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-cms-bg/80 backdrop-blur-sm">
          <div className="mx-4 rounded-lg border border-cms-border bg-cms-surface p-4 shadow-xl">
            <p className="text-sm text-cms-text">Delete &quot;{template.name}&quot;?</p>
            <p className="mt-1 text-xs text-cms-text-dim">This cannot be undone.</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded px-3 py-1.5 text-sm text-cms-text hover:bg-cms-border"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
