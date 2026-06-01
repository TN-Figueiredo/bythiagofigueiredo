'use client'

import { useState, useEffect } from 'react'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type SaveState = 'idle' | 'saving' | 'success' | 'error'

export interface SiteData {
  id: string
  logo_url: string | null
  primary_color: string | null
  identity_type: string
  twitter_handle: string | null
  seo_default_og_image: string | null
  supported_locales: string[]
  default_locale: string
  cms_enabled: boolean
  slug: string
  timezone: string
}

/* ------------------------------------------------------------------ */
/*  Hooks                                                             */
/* ------------------------------------------------------------------ */

export function useSaveState(): [SaveState, (s: SaveState) => void] {
  const [state, setState] = useState<SaveState>('idle')
  useEffect(() => {
    if (state === 'success' || state === 'error') {
      const t = setTimeout(() => setState('idle'), state === 'success' ? 2000 : 3000)
      return () => clearTimeout(t)
    }
  }, [state])
  return [state, setState]
}

/* ------------------------------------------------------------------ */
/*  Shared UI components                                              */
/* ------------------------------------------------------------------ */

export function SaveButton({
  state,
  label = 'Save',
  disabled = false,
}: {
  state: SaveState
  label?: string
  disabled?: boolean
}) {
  return (
    <div className="space-y-1">
      <button
        type="submit"
        disabled={state === 'saving' || disabled}
        className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
          state === 'error'
            ? 'bg-red-500 hover:bg-red-400'
            : 'bg-indigo-500 hover:bg-indigo-400'
        }`}
      >
        {state === 'saving' && (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        )}
        {state === 'success' ? 'Salvo' : state === 'error' ? 'Erro' : label}
      </button>
      {state === 'error' && (
        <p role="alert" className="text-xs text-red-400">Save failed. Try again.</p>
      )}
    </div>
  )
}

export function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null
  return <p className="mt-1 text-sm text-red-400">{message}</p>
}

export function CharCount({ current, max }: { current: number; max: number }) {
  const ratio = current / max
  const cls = ratio >= 1
    ? 'text-red-400 font-medium'
    : ratio >= 0.9
      ? 'text-amber-400'
      : 'text-slate-500'
  return (
    <span className={`text-xs ${cls}`}>
      {current}/{max}{ratio >= 1 ? ' !' : ''}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Shared CSS class helpers                                          */
/* ------------------------------------------------------------------ */

export function inputCls(hasError: boolean) {
  return `w-full rounded-md border px-3 py-2 text-sm bg-slate-800 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
    hasError ? 'border-red-500' : 'border-slate-600'
  }`
}

export function labelCls() {
  return 'block text-sm font-medium text-slate-300 mb-1'
}

export function sectionCls() {
  return 'space-y-6 rounded-lg border border-slate-700 bg-slate-800/50 p-6'
}
