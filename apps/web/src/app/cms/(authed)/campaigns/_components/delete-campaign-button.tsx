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

export type DeleteCampaignActionResult =
  | { ok: true }
  | { ok: false; error: 'already_published' | 'not_found' | 'db_error'; message?: string }

export interface DeleteCampaignButtonProps {
  campaignId: string
  campaignLabel: string
  onDelete: (id: string) => Promise<DeleteCampaignActionResult>
}

function describeDeleteError(
  r: Extract<DeleteCampaignActionResult, { ok: false }>,
): string {
  switch (r.error) {
    case 'already_published':
      return 'Esta campanha foi publicada e não pode mais ser excluída. Recarregue a lista.'
    case 'not_found':
      return 'Campanha não encontrada (pode já ter sido excluída).'
    case 'db_error':
      return r.message ?? 'Falha no banco ao excluir.'
  }
}

export function DeleteCampaignButton({
  campaignId,
  campaignLabel,
  onDelete,
}: DeleteCampaignButtonProps) {
  const [open, setOpen] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await onDelete(campaignId)
        if (result.ok) {
          setDeleted(true)
          setOpen(false)
        } else {
          setError(describeDeleteError(result))
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Falha ao excluir')
      }
    })
  }

  if (deleted) {
    return (
      <span role="status" className="text-sm text-[var(--cms-green,#22c55e)]">
        Excluído
      </span>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        aria-label={`Excluir ${campaignLabel}`}
        className="inline-flex items-center rounded-md border border-[rgba(239,68,68,.4)] px-2 py-1 text-xs text-[var(--cms-red,#ef4444)] transition-colors hover:bg-[rgba(239,68,68,.1)] cursor-pointer"
      >
        Excluir
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
          <AlertDialogDescription>
            {`Esta ação é permanente. '${campaignLabel}' será removida.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="mt-2 text-sm text-[var(--cms-red,#ef4444)]">
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
