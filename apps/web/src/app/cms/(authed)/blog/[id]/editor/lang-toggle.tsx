'use client'

import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { useEditorState, useEditorDispatch } from './context'
import { isEmptyVersion } from './helpers'
import type { VersionContent } from './types'
import { EMPTY_VERSION } from './types'

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
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onCancel()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onCancel])

  const isPublished = version.published
  const message = isPublished
    ? `Esta versão está publicada. Remover aqui não despublica — apenas remove o rascunho.`
    : `Remover versão ${LANG_META[lang].label}? Esta ação não pode ser desfeita.`

  return (
    <div
      ref={popoverRef}
      data-testid="lang-confirm"
      className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-border bg-popover p-3 shadow-lg"
    >
      <p className="mb-3 text-sm text-muted-foreground">{message}</p>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
          onClick={onConfirm}
        >
          Remover
        </button>
      </div>
    </div>
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
    const addMeta = LANG_META[addLang]

    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          {meta.flag} {meta.label}
        </span>
        <button
          type="button"
          data-testid="lang-add"
          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => {
            dispatch({ type: 'ADD_VERSION', lang: addLang })
            toast.info(`Versao ${LANG_META[addLang].label} criada`)
          }}
        >
          + {addMeta.label}
        </button>
      </div>
    )
  }

  /* ---- Two versions — segmented toggle ---- */
  const canRemove = langs.length > 1

  return (
    <div className="relative flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {langs.map((lang) => {
        const isActive = lang === activeLang
        const meta = LANG_META[lang]
        const version = state.content[lang]
        const showRemove = canRemove && !isActive

        return (
          <div key={lang} className="group relative">
            <button
              type="button"
              data-active={isActive ? 'true' : 'false'}
              className={[
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
              onClick={() => {
                if (!isActive) {
                  dispatch({ type: 'SET_LANG', lang })
                }
              }}
            >
              {meta.flag} {meta.label}
            </button>

            {showRemove && (
              <button
                type="button"
                data-testid={`lang-remove-${lang}`}
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-muted-foreground/20 text-xs opacity-0 transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  if (!version || isEmptyVersion(version)) {
                    dispatch({ type: 'REMOVE_VERSION', lang })
                    toast.info('Versao removida')
                  } else {
                    setConfirmLang(lang)
                  }
                }}
              >
                &times;
              </button>
            )}

            {confirmLang === lang && version && (
              <ConfirmPopover
                lang={lang}
                version={version}
                onConfirm={() => {
                  dispatch({ type: 'REMOVE_VERSION', lang })
                  toast.info('Versao removida')
                  setConfirmLang(null)
                }}
                onCancel={() => setConfirmLang(null)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
