'use client'

import { useCallback, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { useEditorState, useEditorDispatch, useEditorVersion } from '../context'
import { BlogCoworkButton } from '../blog-cowork-button'
import { swapBlogDirection } from '../pipeline-actions'
import { bodyHasContent } from '../helpers'

export function StageIdeia() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const version = useEditorVersion()

  const { shared, activeLang } = state
  const titleRef = useRef<HTMLHeadingElement>(null)
  const hookRef = useRef<HTMLDivElement>(null)
  const synopsisRef = useRef<HTMLDivElement>(null)

  const handleTitleInput = useCallback(() => {
    const text = titleRef.current?.textContent ?? ''
    dispatch({ type: 'SET_TITLE', title: text })
  }, [dispatch])

  const handleHookInput = useCallback(() => {
    const text = hookRef.current?.textContent ?? ''
    dispatch({ type: 'SET_SHARED', field: 'hook', value: text })
  }, [dispatch])

  const handleSynopsisInput = useCallback(() => {
    const text = synopsisRef.current?.textContent ?? ''
    dispatch({ type: 'SET_SHARED', field: 'synopsis', value: text })
  }, [dispatch])

  const goToRascunho = useCallback(() => {
    dispatch({ type: 'SET_STAGE', stage: 'rascunho' })
  }, [dispatch])

  const [swapping, setSwapping] = useState<string | null>(null)
  const hasPipeline = !!state.pipelineItemId
  const isPublished = shared.status === 'published'
  const hasBody = bodyHasContent(version)

  const onSwap = async (alt: string) => {
    if (!state.postId || swapping) return
    setSwapping(alt)
    const res = await swapBlogDirection(state.postId, alt)
    setSwapping(null)
    if (res.ok && res.direction) {
      dispatch({ type: 'SET_DIRECTION', direction: res.direction, alts: res.directionAlts ?? [] })
      toast.success('Direção trocada')
    } else if (res.error === 'version_conflict' || res.error === 'stale_alternative') {
      toast.error('O Cowork mexeu nessa ideia agora — recarregue a página')
    } else if (res.error === 'published_readonly') {
      toast.error('Post publicado — a ideia fica congelada')
    } else {
      toast.error('Não consegui trocar a direção')
    }
  }

  const langLabel = activeLang === 'pt' ? 'PT-BR' : 'EN'
  const hookEmpty = !shared.hook
  const synopsisEmpty = !shared.synopsis

  return (
    <div className="idea-canvas">
      <div className="idea-kicker">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
          <path d="M5 19l.6 1.7L7.5 21l-1.9.6L5 23l-.6-1.4L2.5 21l1.9-.7z" />
        </svg>
        <span> Conceito · </span>
        {langLabel}
      </div>

      <h1
        ref={titleRef}
        className="idea-title"
        role="textbox"
        aria-label="Título de trabalho"
        contentEditable
        spellCheck={false}
        suppressContentEditableWarning
        data-empty={!(version?.title) ? 'true' : 'false'}
        data-ph="Título de trabalho do post…"
        onInput={handleTitleInput}
        onBlur={handleTitleInput}
      >
        {version?.title}
      </h1>

      <div className="idea-brief">
        <div className="brief-card hook">
          <div className="bc-head">
            <span className="bc-ico">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 14a1 1 0 0 1-.8-1.6l9.9-10.2a.5.5 0 0 1 .9.5l-1.9 6a1 1 0 0 0 .9 1.3h7a1 1 0 0 1 .8 1.6l-9.9 10.2a.5.5 0 0 1-.9-.5l1.9-6a1 1 0 0 0-.9-1.3z"/>
              </svg>
            </span>
            <span> Hook </span>
            <span className="bc-sub">a promessa que prende o leitor</span>
          </div>
          <div
            ref={hookRef}
            className="bc-text"
            role="textbox"
            aria-label="Hook do post"
            aria-multiline="true"
            contentEditable
            spellCheck={false}
            suppressContentEditableWarning
            data-empty={hookEmpty ? 'true' : 'false'}
            data-ph="Em uma frase: por que alguém pararia pra ler isto?"
            onInput={handleHookInput}
            onBlur={handleHookInput}
          >
            {shared.hook}
          </div>
        </div>

        <div className="brief-card">
          <div className="bc-head">
            <span className="bc-ico alt">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
                <path d="M11 8v6" />
                <path d="M8 11h6" />
              </svg>
            </span>
            <span> Sinopse </span>
            <span className="bc-sub">o que o artigo cobre, em resumo</span>
          </div>
          <div
            ref={synopsisRef}
            className="bc-text"
            role="textbox"
            aria-label="Sinopse do post"
            aria-multiline="true"
            contentEditable
            spellCheck={false}
            suppressContentEditableWarning
            data-empty={synopsisEmpty ? 'true' : 'false'}
            data-ph="Os pontos e a linha de raciocínio que o artigo desenvolve…"
            onInput={handleSynopsisInput}
            onBlur={handleSynopsisInput}
          >
            {shared.synopsis}
          </div>
        </div>
      </div>

      {hasPipeline && (
        <>
          <div className="idea-direction" data-testid="idea-direction">
            <div className="id-head">
              <span className="id-kick">✦ A direção</span>
              <span className="id-sub">o ângulo que o artigo vai desenvolver — ainda solto, de propósito</span>
            </div>
            <div className="id-body" data-empty={!shared.direction ? 'true' : 'false'}>
              {shared.direction || 'Sem direção ainda — peça ao Cowork pra propor uma.'}
            </div>
          </div>

          {/* ideia é read-only após publicar (PUBLISHED_READONLY_BASES no service
              layer recusa o próprio Cowork) — esconder geração/swap, manter o display */}
          {!isPublished && (
            <div className="idea-alts" data-testid="idea-alts">
              <div className="ia-head">
                <span className="ia-kick">✦ Outras direções do Cowork</span>
                <BlogCoworkButton stage="ideia" label="Gerar mais" compact />
              </div>
              {shared.directionAlts.length === 0 ? (
                <div className="ia-empty">Sem alternativas ainda — peça ao Cowork pra gerar algumas.</div>
              ) : (
                <div className="ia-list">
                  {shared.directionAlts.map((alt) => (
                    <button
                      key={alt}
                      type="button"
                      className="ia-alt"
                      disabled={swapping !== null}
                      onClick={() => onSwap(alt)}
                      title="Usar esta direção"
                    >
                      {swapping === alt ? 'trocando…' : alt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <button type="button" className="idea-next" onClick={goToRascunho}>
        {hasBody
          ? <>Abrir o conteúdo <ArrowRight size={15} /></>
          : <>Conceito definido — gerar o conteúdo <ArrowRight size={15} /></>}
      </button>
    </div>
  )
}
