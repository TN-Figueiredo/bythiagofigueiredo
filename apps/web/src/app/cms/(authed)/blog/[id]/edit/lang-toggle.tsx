'use client'

import { useState } from 'react'
import { Plus, X, AlertTriangle, Archive } from 'lucide-react'
import { toast } from 'sonner'
import { useEditorState, useEditorDispatch } from './context'
import { isEmptyVersion } from './helpers'
import type { VersionContent } from './types'

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

type Lang = 'pt' | 'en'

const LANG_META: Record<Lang, { flag: string; label: string }> = {
  pt: { flag: '\u{1F1E7}\u{1F1F7}', label: 'PT-BR' },
  en: { flag: '\u{1F1FA}\u{1F1F8}', label: 'EN' },
}

function otherLang(lang: Lang): Lang {
  return lang === 'pt' ? 'en' : 'pt'
}

/* ------------------------------------------------------------------ */
/*  ConfirmPopover                                                    */
/* ------------------------------------------------------------------ */

interface ConfirmPopoverProps {
  lang: Lang
  version: VersionContent
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmPopover({ lang, version, onConfirm, onCancel }: ConfirmPopoverProps) {
  const isPublished = version.published
  const message = isPublished
    ? 'Esta versão está publicada no site. Removê-la aqui só apaga o rascunho — despublique no site antes, se preciso.'
    : 'Esta versão tem conteúdo. Essa ação não pode ser desfeita.'

  return (
    <>
      <div className="lang-confirm-scrim" onClick={onCancel} aria-hidden="true" />
      <div className="lang-confirm" role="dialog" aria-modal="true" aria-labelledby="lang-confirm-title" data-testid="lang-confirm">
        <div className="lc-title" id="lang-confirm-title">
          <AlertTriangle className="lucide" size={14} />
          Remover versão {LANG_META[lang].label}?
        </div>
        <div className="lc-tx">{message}</div>
        <div className="lc-actions">
          <button type="button" className="btn sm" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn sm danger"
            onClick={onConfirm}
          >
            <Archive className="lucide" size={13} />
            Remover
          </button>
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  LangToggle                                                        */
/* ------------------------------------------------------------------ */

export function LangToggle() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const [confirmLang, setConfirmLang] = useState<Lang | null>(null)

  const langs = Object.keys(state.content) as Lang[]
  const activeLang = state.activeLang
  const isSingle = langs.length === 1

  /* ---- Single version ---- */
  if (isSingle) {
    const currentLang = langs[0]!
    const addLang = otherLang(currentLang)
    const meta = LANG_META[currentLang]

    return (
      <div className="lang-toggle single" role="group" aria-label="Versão de idioma">
        <span className="lang-current">
          {meta.flag} {meta.label}
        </span>
        <button
          type="button"
          className="ver-add"
          data-testid="lang-add"
          title={`Adicionar versão ${LANG_META[addLang].label}`}
          onClick={() => {
            dispatch({ type: 'ADD_VERSION', lang: addLang })
            toast.info(`Versão ${LANG_META[addLang].label} criada`)
          }}
        >
          <Plus className="lucide" size={12} />
          {addLang === 'en' ? 'EN' : 'PT-BR'}
        </button>
      </div>
    )
  }

  /* ---- Two versions — segmented toggle ---- */

  function tryRemove(lang: Lang) {
    const version = state.content[lang]
    if (!version || isEmptyVersion(version)) {
      dispatch({ type: 'REMOVE_VERSION', lang })
      toast.info('Versão removida')
    } else {
      setConfirmLang(lang)
    }
  }

  return (
    <div className="lang-wrap">
      <div className="lang-toggle" role="group" aria-label="Versão de idioma">
        {(['pt', 'en'] as const).map((lang) => {
          if (!state.content[lang]) return null
          const isActive = lang === activeLang
          const meta = LANG_META[lang]

          return (
            <span key={lang} className={`lang-seg${isActive ? ' on' : ''}`}>
              <button
                type="button"
                className={`lang-opt${isActive ? ' on' : ''}`}
                aria-pressed={isActive}
                onClick={() => {
                  if (!isActive) {
                    dispatch({ type: 'SET_LANG', lang })
                  }
                }}
              >
                {meta.flag} {meta.label}
              </button>
              {!isActive && (
                <button
                  type="button"
                  className="lang-x"
                  data-testid={`lang-remove-${lang}`}
                  title={`Remover versão ${meta.label}`}
                  aria-label={`Remover versão ${meta.label}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    tryRemove(lang)
                  }}
                >
                  <X className="lucide" size={12} />
                </button>
              )}
            </span>
          )
        })}
      </div>
      {confirmLang && state.content[confirmLang] && (
        <ConfirmPopover
          lang={confirmLang}
          version={state.content[confirmLang]!}
          onConfirm={() => {
            dispatch({ type: 'REMOVE_VERSION', lang: confirmLang })
            toast.info('Versão removida')
            setConfirmLang(null)
          }}
          onCancel={() => setConfirmLang(null)}
        />
      )}
    </div>
  )
}
