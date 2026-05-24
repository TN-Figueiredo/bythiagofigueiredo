'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createPipelineItem } from '../actions'

interface CreateItemModalProps {
  format: string
  open: boolean
  onClose: () => void
}

export function CreateItemModal({ format, open, onClose }: CreateItemModalProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState<'pt-br' | 'en' | 'both'>('pt-br')

  if (!open) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    startTransition(async () => {
      const titles = language === 'both'
        ? { title_pt: title.trim(), title_en: title.trim() }
        : language === 'en'
          ? { title_en: title.trim() }
          : { title_pt: title.trim() }
      const result = await createPipelineItem({
        format,
        ...titles,
        language,
        stage: 'idea',
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success('Item criado')
      setTitle('')
      onClose()
      router.refresh()
    })
  }

  return (
    <div
      data-testid="modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl p-6 space-y-4"
        style={{ background: 'var(--gem-surface)', color: 'var(--gem-text)' }}
      >
        <h2 className="text-lg font-semibold">
          Novo {format.replace('_', ' ')}
        </h2>

        <div>
          <label htmlFor="create-title" className="block text-sm mb-1 opacity-70">
            Título
          </label>
          <input
            id="create-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{
              background: 'var(--gem-well)',
              border: '1px solid var(--gem-border)',
              color: 'var(--gem-text)',
            }}
          />
        </div>

        <div>
          <label htmlFor="create-language" className="block text-sm mb-1 opacity-70">
            Idioma
          </label>
          <select
            id="create-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'pt-br' | 'en' | 'both')}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{
              background: 'var(--gem-well)',
              border: '1px solid var(--gem-border)',
              color: 'var(--gem-text)',
            }}
          >
            <option value="pt-br">Português</option>
            <option value="en">English</option>
            <option value="both">Bilíngue</option>
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg opacity-70 hover:opacity-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending || !title.trim()}
            className="px-4 py-2 text-sm rounded-lg font-medium disabled:opacity-40"
            style={{ background: 'var(--gem-accent)', color: 'white' }}
          >
            {isPending ? 'Criando...' : 'Criar'}
          </button>
        </div>
      </form>
    </div>
  )
}
