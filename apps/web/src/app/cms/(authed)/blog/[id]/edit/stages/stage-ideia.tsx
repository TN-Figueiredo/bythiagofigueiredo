'use client'

import { useCallback, useRef } from 'react'
import { ArrowRight } from 'lucide-react'
import { useEditorState, useEditorDispatch, useEditorVersion } from '../context'

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

      <button type="button" className="idea-next" onClick={goToRascunho}>
        Conceito definido — escrever o conteúdo <ArrowRight size={15} />
      </button>
    </div>
  )
}
