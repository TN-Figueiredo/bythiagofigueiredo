'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface BlogPostInfo {
  id: string
  title: string
  status: string
  locales: string[]
}

interface Props {
  itemId: string
  linkedPost: BlogPostInfo | null
  onGraduate: () => Promise<{ entity_id?: string } | void>
  onShowSearch: () => void
}

export function BlogPostCard({ itemId, linkedPost, onGraduate, onShowSearch }: Props) {
  const router = useRouter()
  const [isGraduating, setIsGraduating] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isUnlinking, setIsUnlinking] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showMenu) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showMenu])

  const handleGraduate = useCallback(async () => {
    setIsGraduating(true)
    try {
      const result = await onGraduate()
      const entityId = result && 'entity_id' in result ? result.entity_id : undefined
      toast.success('Blog post criado', {
        action: entityId ? { label: 'Abrir editor →', onClick: () => window.open(`/cms/blog/${entityId}/edit`, '_blank') } : undefined,
      })
      router.refresh()
    } catch {
      toast.error('Erro ao criar blog post')
    } finally {
      setIsGraduating(false)
    }
  }, [onGraduate, router])

  const handleUnlink = useCallback(async () => {
    setIsUnlinking(true)
    try {
      const res = await fetch(`/api/pipeline/items/${itemId}/unlink`, { method: 'POST' })
      if (!res.ok) throw new Error()
      toast.success('Post desvinculado')
      router.refresh()
    } catch {
      toast.error('Erro ao desvincular')
    } finally {
      setIsUnlinking(false)
      setShowConfirm(false)
    }
  }, [itemId, router])

  const isPublished = linkedPost?.status === 'published'

  return (
    <div
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--gem-surface)',
        borderColor: 'var(--gem-border)',
        borderLeftColor: isPublished ? 'var(--gem-done)' : undefined,
        borderLeftWidth: isPublished ? 3 : undefined,
      }}
    >
      <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--gem-text)' }}>Blog Post</h3>

      {linkedPost ? (
        <div>
          <p className="text-xs font-medium truncate" style={{ color: 'var(--gem-text)' }}>{linkedPost.title}</p>
          <div className="flex items-center gap-1.5 mt-1">
            {linkedPost.locales.map(l => (
              <span key={l} className="text-[10px] px-1 py-0.5 rounded bg-slate-700/50 text-slate-300">{l.toUpperCase()}</span>
            ))}
            <span
              className="text-[10px] px-1 py-0.5 rounded font-medium"
              style={{
                backgroundColor: isPublished ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                color: isPublished ? 'var(--gem-done)' : 'var(--gem-warn)',
              }}
            >
              {linkedPost.status}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <a
              href={`/cms/blog/${linkedPost.id}/edit`}
              target="_blank"
              rel="noopener"
              className="text-xs px-2 py-1 rounded transition-colors hover:bg-white/5"
              style={{ color: 'var(--gem-accent)' }}
            >
              Abrir editor →
            </a>
            <div ref={menuRef} className="relative ml-auto">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="text-xs px-1.5 py-0.5 rounded hover:bg-white/5"
                style={{ color: 'var(--gem-dim)' }}
              >
                ···
              </button>
              {showMenu && (
                <div
                  className="absolute right-0 top-full mt-1 rounded-lg border p-1 z-50 min-w-28 shadow-lg"
                  style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                >
                  <button
                    onClick={() => { setShowMenu(false); setShowConfirm(true) }}
                    className="w-full text-left px-2.5 py-1.5 text-xs rounded hover:bg-red-500/10 transition-colors"
                    style={{ color: 'var(--gem-danger)' }}
                  >
                    Desvincular
                  </button>
                </div>
              )}
            </div>
          </div>
          {showConfirm && (
            <div className="mt-2 p-2 rounded border" style={{ borderColor: 'var(--gem-danger)', backgroundColor: 'rgba(239,68,68,0.05)' }}>
              <p className="text-xs mb-2" style={{ color: 'var(--gem-muted)' }}>
                Desvincular &ldquo;{linkedPost.title}&rdquo;? O post continuará existindo independentemente.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="text-xs px-2 py-1 rounded border"
                  style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-muted)' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUnlink}
                  disabled={isUnlinking}
                  className="text-xs px-2 py-1 rounded"
                  style={{ backgroundColor: 'var(--gem-danger)', color: 'white', opacity: isUnlinking ? 0.5 : 1 }}
                >
                  {isUnlinking ? 'Desvinculando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <p className="text-xs mb-2" style={{ color: 'var(--gem-dim)' }}>Nenhum post vinculado</p>
          <div className="flex gap-2">
            <button
              onClick={handleGraduate}
              disabled={isGraduating}
              className="text-xs px-2.5 py-1.5 rounded transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--gem-done)', color: 'white', opacity: isGraduating ? 0.5 : 1 }}
            >
              {isGraduating ? 'Criando...' : 'Criar novo post'}
            </button>
            <button
              onClick={onShowSearch}
              className="text-xs px-2.5 py-1.5 rounded border transition-colors hover:bg-white/5"
              style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-muted)' }}
            >
              Buscar existente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
