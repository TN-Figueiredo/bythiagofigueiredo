'use client'

import { useCallback, useRef, useEffect, useMemo, type ChangeEvent } from 'react'
import dynamic from 'next/dynamic'
import { ImageIcon, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import type { Editor } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'
import { useEditorState, useEditorDispatch, useEditorVersion } from '../context'
import { resolveCategory } from '../helpers'
import { BlogImageExtension } from '../image-block/blog-image-extension'

const TipTapEditor = dynamic(
  () =>
    import('@/app/cms/(authed)/_shared/editor/tiptap-editor').then((m) => ({
      default: m.TipTapEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div data-testid="tiptap-slot" className="stage-skel" style={{ minHeight: 200 }} aria-hidden="true">
        <div className="skel-line" />
        <div className="skel-line" />
        <div className="skel-line short" />
      </div>
    ),
  },
)

export function StageRascunho() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const version = useEditorVersion()

  const { shared, activeLang } = state
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const editorRef = useRef<Editor | null>(null)

  const blogExtensions = useMemo(() => [BlogImageExtension], [])

  const handleEditorChange = useCallback(
    (json: JSONContent, html: string) => {
      const wordCount =
        editorRef.current?.storage?.characterCount?.words?.() ?? 0
      const readTime = wordCount > 0 ? Math.ceil(wordCount / 200) : 0
      dispatch({ type: 'SET_BODY', body: json, html, words: wordCount, readTime })
    },
    [dispatch],
  )

  const handleImageUpload = useCallback(
    async (_file: File): Promise<string | null> => {
      toast.info('Upload de imagem em breve — use a aba Imagens')
      return null
    },
    [],
  )

  /* ---- Cross-stage scroll: Imagens -> Rascunho ---- */

  useEffect(() => {
    if (!state.scrollToImageId) return

    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-image-id="${state.scrollToImageId}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('scroll-highlight')
        setTimeout(() => el.classList.remove('scroll-highlight'), 600)
      }
      dispatch({ type: 'CLEAR_SCROLL_TARGET' })
    })
  }, [state.scrollToImageId, dispatch])

  /* ---- Initial word count from pre-loaded content ---- */

  useEffect(() => {
    const timer = setTimeout(() => {
      const ed = editorRef.current
      if (!ed || ed.isDestroyed) return
      const wc = ed.storage?.characterCount?.words?.() ?? 0
      if (wc > 0 && (version?.words ?? 0) === 0) {
        dispatch({
          type: 'SET_BODY',
          body: ed.getJSON(),
          html: ed.getHTML(),
          words: wc,
          readTime: Math.ceil(wc / 200),
        })
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [dispatch, version?.words])

  /* ---- Auto-grow title textarea ---- */

  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [version?.title])

  /* ---- Title handler ---- */

  const handleTitleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      dispatch({ type: 'SET_TITLE', title: e.target.value })
    },
    [dispatch],
  )

  /* ---- Excerpt (dek) handler ---- */

  const excerptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = excerptRef.current
    if (!el || document.activeElement === el) return
    const next = version?.excerpt ?? ''
    if (el.textContent !== next) {
      el.textContent = next
      el.setAttribute('data-empty', next ? 'false' : 'true')
    }
  }, [version?.excerpt])

  const handleExcerptInput = useCallback(() => {
    const el = excerptRef.current
    const text = el?.textContent ?? ''
    el?.setAttribute('data-empty', text ? 'false' : 'true')
    dispatch({ type: 'SET_EXCERPT', excerpt: text })
  }, [dispatch])

  const excerptLen = (version?.excerpt ?? '').length

  /* ---- Derived values ---- */

  const langLabel = activeLang === 'pt' ? '\u{1F1E7}\u{1F1F7} PT-BR' : '\u{1F1FA}\u{1F1F8} EN'
  const cat = resolveCategory(shared.category, activeLang, state.categories)
  const readTime = version && version.readTime > 0 ? `${version.readTime} min de leitura` : 'rascunho novo'
  const wordCount = (version?.words ?? 0).toLocaleString('pt-BR')

  /* ---- Render ---- */

  const coverUrl = version?.coverImageUrl ?? null

  return (
    <div>
      {/* Cover image */}
      {coverUrl ? (
        <div className="doc-cover has-img">
          <img src={coverUrl} alt="Imagem de capa do post" className="dc-img" />
          <span className="dc-label">capa · 1200×675</span>
          <button
            type="button"
            className="dc-swap"
            onClick={() => dispatch({ type: 'SET_STAGE', stage: 'imagens' })}
          >
            <RefreshCw size={13} />
            Trocar capa
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="doc-cover pending"
          title="Adicionar capa em Imagens"
          onClick={() => dispatch({ type: 'SET_STAGE', stage: 'imagens' })}
        >
          <div className="di-thumb"><ImageIcon size={20} /></div>
          <div className="di-info">
            <span className="di-id">
              cover · 1200×675
              <span className="di-wait">sem capa</span>
            </span>
            {shared.coverPrompt && (
              <span className="di-alt">{shared.coverPrompt}</span>
            )}
          </div>
          <span className="dc-add">
            <Plus size={13} />
            <span> Adicionar capa</span>
          </span>
        </button>
      )}

      {/* Editable title */}
      <textarea
        ref={titleRef}
        data-testid="doc-title"
        value={version?.title ?? ''}
        onChange={handleTitleChange}
        placeholder="Sem título"
        rows={1}
        className="doc-title"
      />

      {/* Excerpt / dek */}
      <div className="doc-dek-wrap">
        <div
          ref={excerptRef}
          className="doc-dek"
          role="textbox"
          aria-label="Resumo do post"
          aria-multiline="false"
          contentEditable
          spellCheck={false}
          data-empty={!version?.excerpt ? 'true' : 'false'}
          data-testid="doc-dek"
          onInput={handleExcerptInput}
          suppressContentEditableWarning
        >
          {version?.excerpt ?? ''}
        </div>
        <div className="doc-dek-hint">
          {excerptLen} caracteres · resumo da listagem & card social · ideal 120–160
        </div>
      </div>

      {/* Meta line */}
      <div className="doc-meta" data-testid="doc-meta">
        <span className="dm-tag">{langLabel}</span>
        {cat && (
          <>
            <span className="msep">·</span>
            <span className="dm-tag">
              <span className="cdot" style={{ background: cat.color }} />
              {cat.label}
            </span>
          </>
        )}
        <span className="msep">·</span>
        <span>{readTime}</span>
        <span className="msep">·</span>
        <span>{wordCount} palavras</span>
      </div>

      {/* TipTap editor */}
      <div className="doc-prose">
        <TipTapEditor
          content={version?.body ?? (version?.bodyHtml || null)}
          onChange={handleEditorChange}
          onImageUpload={handleImageUpload}
          editable={true}
          placeholder="Comece a escrever..."
          editorInstanceRef={editorRef}
          extraExtensions={blogExtensions}
        />
      </div>
    </div>
  )
}
