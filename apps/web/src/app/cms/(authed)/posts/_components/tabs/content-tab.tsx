'use client'

import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { usePostEditor } from '../post-editor-context'
import { SectionBar } from '../section-bar'
import { savePostContent } from '../../actions'
import type { SectionStatus } from '@/lib/posts/types'

export function ContentTab() {
  const { state, dispatch } = usePostEditor()
  const { post, activeLocale } = state
  const tx = post.translations.find(t => t.locale === activeLocale) ?? post.translations[0]

  const [title, setTitle] = useState(tx?.title ?? '')
  const [excerpt, setExcerpt] = useState(tx?.excerpt ?? '')
  const [contentJson, setContentJson] = useState(tx?.contentJson ?? null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const t = post.translations.find(t => t.locale === activeLocale) ?? post.translations[0]
    if (t) {
      setTitle(t.title)
      setExcerpt(t.excerpt ?? '')
      setContentJson(t.contentJson)
    }
  }, [activeLocale, post.translations])

  const markDirty = useCallback(() => {
    dispatch({ type: 'SET_DIRTY', tab: 'content', dirty: true })
  }, [dispatch])

  const handleTitleChange = useCallback((val: string) => {
    setTitle(val)
    markDirty()
  }, [markDirty])

  const handleExcerptChange = useCallback((val: string) => {
    setExcerpt(val)
    markDirty()
  }, [markDirty])

  const handleSave = useCallback(async () => {
    if (!tx) return
    setIsSaving(true)
    try {
      const result = await savePostContent(post.id, activeLocale, {
        title,
        excerpt: excerpt || undefined,
        contentJson: contentJson ?? undefined,
      })
      if (result.ok) {
        dispatch({ type: 'SAVE_TAB', tab: 'content' })
        toast.success('Conteúdo salvo')
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setIsSaving(false)
    }
  }, [post.id, activeLocale, title, excerpt, contentJson, tx, dispatch])

  useEffect(() => {
    const handler = () => { if (state.dirty.content) void handleSave() }
    document.addEventListener('posts:save-tab', handler)
    return () => document.removeEventListener('posts:save-tab', handler)
  }, [handleSave, state.dirty.content])

  const sectionStatus: SectionStatus = title && contentJson ? 'done' : title ? 'warn' : 'empty'

  return (
    <div className="flex flex-col gap-3.5">
      <SectionBar
        label="Conteúdo"
        status={sectionStatus}
        statusText={title ? `rev.${post.translations.length}` : undefined}
        isDirty={state.dirty.content}
        isSaving={isSaving}
        onSave={handleSave}
      />

      <input
        type="text"
        value={title}
        onChange={e => handleTitleChange(e.target.value)}
        placeholder="Título do post"
        aria-label="Title"
        className="w-full bg-transparent border border-transparent rounded-lg hover:border-[var(--gem-border)] focus:border-[var(--gem-accent)] focus:outline-none transition-all"
        style={{ color: 'var(--gem-text)', fontSize: 24, fontWeight: 700, padding: '10px 14px' }}
      />

      <input
        type="text"
        value={excerpt}
        onChange={e => handleExcerptChange(e.target.value)}
        placeholder="Hook — o que prende a audiência em uma frase?"
        aria-label="Excerpt"
        className="w-full bg-transparent border-l-[3px] rounded-r-lg hover:bg-[var(--gem-surface-hi)] focus:border-[var(--gem-accent)] focus:outline-none transition-all"
        style={{ color: 'var(--gem-muted)', fontSize: 15, padding: '10px 14px', borderLeftColor: excerpt ? 'var(--gem-accent)' : 'var(--gem-faint)' }}
      />

      <div className="rounded-lg border overflow-hidden min-h-[300px] flex items-center justify-center" style={{ borderColor: 'var(--gem-border)', background: 'var(--gem-surface)' }}>
        <p className="text-xs" style={{ color: 'var(--gem-dim)' }}>Editor de conteúdo (TipTap)</p>
      </div>
    </div>
  )
}
