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
} from '../../../../components/ui/alert-dialog'

export interface DeletePostButtonProps {
  postId: string
  postTitle: string
  onDelete: (id: string) => Promise<void>
}

export function DeletePostButton({ postId, postTitle, onDelete }: DeletePostButtonProps) {
  const [open, setOpen] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      try {
        await onDelete(postId)
        setDeleted(true)
        setOpen(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Falha ao excluir')
      }
    })
  }

  if (deleted) {
    return (
      <span role="status" className="text-sm text-green-600">
        Excluído
      </span>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        aria-label={`Excluir ${postTitle}`}
        className="inline-flex items-center rounded-md border border-red-600/40 px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-600/10 cursor-pointer"
      >
        Excluir
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir post?</AlertDialogTitle>
          <AlertDialogDescription>
            {`Esta ação é permanente. '${postTitle}' será removido.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
          >
            {isPending ? 'Excluindo…' : 'Confirmar exclusão'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
