'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { usePostEditor } from '../post-editor-context'
import { SectionBar } from '../section-bar'
import { ReadinessRing } from '../readiness-ring'
import { savePostSeo } from '../../actions'
import type { SectionStatus } from '@/lib/posts/types'

function computeSeoScore(metaTitle: string, metaDesc: string, slug: string, hasOgImage: boolean): { score: number; items: Array<{ label: string; ok: boolean; detail: string }> } {
  const items: Array<{ label: string; ok: boolean; detail: string }> = []

  const titleLen = metaTitle.length
  const titleOk = titleLen >= 50 && titleLen <= 60
  items.push({ label: 'Título SEO', ok: titleOk, detail: titleOk ? `${titleLen} chars (ideal)` : titleLen === 0 ? 'Vazio' : `${titleLen} chars (ideal: 50-60)` })

  const descLen = metaDesc.length
  const descOk = descLen >= 150 && descLen <= 160
  items.push({ label: 'Meta Description', ok: descOk, detail: descOk ? `${descLen} chars (ideal)` : descLen === 0 ? 'Vazio' : `${descLen} chars (ideal: 150-160)` })

  const slugOk = slug.length > 0 && !slug.includes(' ')
  items.push({ label: 'Slug', ok: slugOk, detail: slugOk ? slug : 'Slug inválido' })

  items.push({ label: 'OG Image', ok: hasOgImage, detail: hasOgImage ? 'Definida' : 'Usando fallback' })

  const passCount = items.filter(i => i.ok).length
  const score = Math.round((passCount / items.length) * 100)
  return { score, items }
}

export function SeoTab() {
  const { state, dispatch } = usePostEditor()
  const { post, activeLocale } = state
  const tx = post.translations.find(t => t.locale === activeLocale) ?? post.translations[0]

  const [metaTitle, setMetaTitle] = useState(tx?.metaTitle ?? '')
  const [metaDescription, setMetaDescription] = useState(tx?.metaDescription ?? '')
  const [ogImageUrl, setOgImageUrl] = useState(tx?.ogImageUrl ?? null)
  const [isSaving, setIsSaving] = useState(false)

  const localeRef = useRef(activeLocale)
  useEffect(() => { localeRef.current = activeLocale }, [activeLocale])

  useEffect(() => {
    const t = post.translations.find(t => t.locale === activeLocale) ?? post.translations[0]
    if (t) {
      setMetaTitle(t.metaTitle ?? '')
      setMetaDescription(t.metaDescription ?? '')
      setOgImageUrl(t.ogImageUrl ?? null)
    }
  }, [activeLocale, post.translations])

  const slug = tx?.slug ?? ''
  const { score, items } = useMemo(() => computeSeoScore(metaTitle, metaDescription, slug, !!ogImageUrl || !!post.coverImageUrl), [metaTitle, metaDescription, slug, ogImageUrl, post.coverImageUrl])

  const markDirty = useCallback(() => {
    dispatch({ type: 'SET_DIRTY', tab: 'seo', dirty: true })
  }, [dispatch])

  const handleSave = useCallback(async () => {
    if (!tx) return
    setIsSaving(true)
    try {
      const result = await savePostSeo(post.id, localeRef.current, { metaTitle, metaDescription, ogImageUrl })
      if (result.ok) {
        dispatch({ type: 'SAVE_TAB', tab: 'seo' })
        toast.success('SEO salvo')
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setIsSaving(false)
    }
  }, [post.id, activeLocale, metaTitle, metaDescription, ogImageUrl, tx, dispatch])

  useEffect(() => {
    const handler = () => { if (state.dirty.seo) void handleSave() }
    document.addEventListener('posts:save-tab', handler)
    return () => document.removeEventListener('posts:save-tab', handler)
  }, [handleSave, state.dirty.seo])

  const sectionStatus: SectionStatus = score >= 70 ? 'done' : metaTitle || metaDescription ? 'warn' : 'empty'

  return (
    <div className="flex flex-col gap-4">
      <SectionBar label="SEO" status={sectionStatus} statusText={`${score}/100`} isDirty={state.dirty.seo} isSaving={isSaving} onSave={handleSave} />

      {/* SEO Score */}
      <div className="flex items-start gap-4 rounded-lg border p-4" style={{ background: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
        <ReadinessRing score={score} size={64} strokeWidth={5} />
        <div className="flex-1 space-y-1.5">
          {items.map(item => (
            <div key={item.label} className="flex items-center gap-2 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.ok ? 'var(--gem-done)' : 'var(--gem-warn)' }} />
              <span style={{ color: 'var(--gem-muted)' }}>{item.label}</span>
              <span className="ml-auto" style={{ color: item.ok ? 'var(--gem-done)' : 'var(--gem-warn)' }}>{item.detail}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Meta Title */}
      <div>
        <label htmlFor="seo-meta-title" className="text-xs font-medium mb-1 block" style={{ color: 'var(--gem-text)' }}>Meta Title</label>
        <input
          id="seo-meta-title"
          type="text"
          value={metaTitle}
          onChange={e => { setMetaTitle(e.target.value); markDirty() }}
          placeholder="Título para motores de busca"
          className="w-full bg-transparent rounded-lg border px-3 py-2 text-sm focus:border-[var(--gem-accent)] focus:outline-none transition-colors"
          style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-text)' }}
        />
        <div className="flex justify-end mt-1">
          <CharCounter current={metaTitle.length} min={50} max={60} />
        </div>
      </div>

      {/* Meta Description */}
      <div>
        <label htmlFor="seo-meta-desc" className="text-xs font-medium mb-1 block" style={{ color: 'var(--gem-text)' }}>Meta Description</label>
        <textarea
          id="seo-meta-desc"
          value={metaDescription}
          onChange={e => { setMetaDescription(e.target.value); markDirty() }}
          placeholder="Descrição para resultados de busca"
          rows={3}
          className="w-full bg-transparent rounded-lg border px-3 py-2 text-sm resize-y focus:border-[var(--gem-accent)] focus:outline-none transition-colors"
          style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-text)' }}
        />
        <div className="flex justify-end mt-1">
          <CharCounter current={metaDescription.length} min={150} max={160} />
        </div>
      </div>

      {/* SERP Preview */}
      <div className="rounded-lg border p-4" style={{ background: 'var(--gem-well)', borderColor: 'var(--gem-border)' }}>
        <h4 className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--gem-dim)' }}>Prévia Google</h4>
        <div className="space-y-0.5">
          <p className="text-sm" style={{ color: '#8ab4f8' }}>{metaTitle || tx?.title || 'Título do post'}</p>
          <p className="text-[11px]" style={{ color: '#bdc1c6' }}>bythiagofigueiredo.com/blog/{slug || 'slug'}</p>
          <p className="text-[11px] line-clamp-2" style={{ color: '#969ba1' }}>{metaDescription || 'Adicione uma meta description...'}</p>
        </div>
      </div>
    </div>
  )
}

function CharCounter({ current, min, max }: { current: number; min: number; max: number }) {
  const inRange = current >= min && current <= max
  return (
    <span className="text-[10px]" style={{ color: inRange ? 'var(--gem-done)' : current > max ? 'var(--gem-danger)' : 'var(--gem-dim)' }}>
      {current}/{max}
    </span>
  )
}
