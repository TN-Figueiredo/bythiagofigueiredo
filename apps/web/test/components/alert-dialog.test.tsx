import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
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
} from '../../src/components/ui/alert-dialog'
import { DeletePostButton } from '../../src/app/cms/blog/_components/delete-post-button'

function Harness({ onConfirm }: { onConfirm?: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger>Abrir</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Título</AlertDialogTitle>
          <AlertDialogDescription>Descrição curta</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirmar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

describe('AlertDialog wrapper', () => {
  it('opens on trigger click and shows title + description', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('Abrir'))
    await waitFor(() => {
      expect(screen.getByText('Título')).toBeTruthy()
      expect(screen.getByText('Descrição curta')).toBeTruthy()
    })
  })

  it('fires confirm callback when action clicked', async () => {
    const onConfirm = vi.fn()
    render(<Harness onConfirm={onConfirm} />)
    fireEvent.click(screen.getByText('Abrir'))
    await waitFor(() => screen.getByText('Confirmar'))
    fireEvent.click(screen.getByText('Confirmar'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('closes on cancel', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('Abrir'))
    await waitFor(() => screen.getByText('Cancelar'))
    fireEvent.click(screen.getByText('Cancelar'))
    await waitFor(() => {
      expect(screen.queryByText('Título')).toBeNull()
    })
  })
})

describe('DeletePostButton', () => {
  it('opens dialog with post title in description', async () => {
    render(
      <DeletePostButton
        postId="p1"
        postTitle="Meu Post"
        onDelete={vi.fn().mockResolvedValue({ ok: true })}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Excluir Meu Post/i }))
    await waitFor(() => {
      expect(screen.getByText('Excluir post?')).toBeTruthy()
      expect(screen.getByText(/Meu Post.*será removido/)).toBeTruthy()
    })
  })

  it('calls onDelete and shows success state on confirm', async () => {
    const onDelete = vi.fn().mockResolvedValue({ ok: true })
    render(<DeletePostButton postId="p1" postTitle="Meu Post" onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: /Excluir Meu Post/i }))
    await waitFor(() => screen.getByText('Confirmar exclusão'))
    fireEvent.click(screen.getByText('Confirmar exclusão'))
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('p1')
      expect(screen.getByRole('status').textContent).toContain('Excluído')
    })
  })

  it('shows error message when onDelete throws', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('boom'))
    render(<DeletePostButton postId="p1" postTitle="Meu Post" onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: /Excluir Meu Post/i }))
    await waitFor(() => screen.getByText('Confirmar exclusão'))
    fireEvent.click(screen.getByText('Confirmar exclusão'))
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('boom')
    })
  })

  it('does not render trigger when already deleted (after successful delete)', async () => {
    const onDelete = vi.fn().mockResolvedValue({ ok: true })
    render(<DeletePostButton postId="p1" postTitle="Meu Post" onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: /Excluir Meu Post/i }))
    await waitFor(() => screen.getByText('Confirmar exclusão'))
    fireEvent.click(screen.getByText('Confirmar exclusão'))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Excluir Meu Post/i })).toBeNull()
    })
  })
})
