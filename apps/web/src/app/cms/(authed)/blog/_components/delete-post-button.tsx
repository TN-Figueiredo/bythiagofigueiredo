'use client'

import { useState, useTransition } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { BlogHubStrings } from '../_i18n/types'

export type DeletePostActionResult =
  | { ok: true }
  | { ok: false; error: 'already_published' | 'not_found' | 'db_error'; message?: string }

export interface DeletePostButtonProps {
  postId: string
  postTitle: string
  onDelete: (id: string) => Promise<DeletePostActionResult>
  strings?: BlogHubStrings['deletePost']
}

function describeDeleteError(
  r: Extract<DeletePostActionResult, { ok: false }>,
  s?: BlogHubStrings['deletePost'],
): string {
  switch (r.error) {
    case 'already_published':
      return s?.errorAlreadyPublished ?? 'This post has been published and can no longer be deleted. Reload the list.'
    case 'not_found':
      return s?.errorNotFound ?? 'Post not found (may have already been deleted).'
    case 'db_error':
      return r.message ?? s?.errorDb ?? 'Database error while deleting.'
  }
}

export function DeletePostButton({ postId, postTitle, onDelete, strings: s }: DeletePostButtonProps) {
  const [open, setOpen] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await onDelete(postId)
        if (result.ok) {
          setDeleted(true)
          setOpen(false)
        } else {
          setError(describeDeleteError(result, s))
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : (s?.errorUnknown ?? 'Failed to delete'))
      }
    })
  }

  if (deleted) {
    return (
      <span role="status" className="text-sm text-[var(--cms-green,#22c55e)]">
        {s?.successStatus ?? 'Deleted'}
      </span>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        aria-label={s?.triggerAriaLabel.replace('{title}', postTitle) ?? `Delete ${postTitle}`}
        className="inline-flex items-center rounded-md border border-[rgba(239,68,68,.4)] px-2 py-1 text-xs text-[var(--cms-red,#ef4444)] transition-colors hover:bg-[rgba(239,68,68,.1)] cursor-pointer"
      >
        {s?.triggerLabel ?? 'Delete'}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{s?.dialogTitle ?? 'Delete post?'}</AlertDialogTitle>
          <AlertDialogDescription>
            {s?.dialogDescription.replace('{title}', postTitle) ?? `This action is permanent. '${postTitle}' will be removed.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="mt-2 text-sm text-[var(--cms-red,#ef4444)]">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{s?.cancel ?? 'Cancel'}</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
          >
            {isPending ? (s?.confirming ?? 'Deleting…') : (s?.confirm ?? 'Confirm deletion')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
