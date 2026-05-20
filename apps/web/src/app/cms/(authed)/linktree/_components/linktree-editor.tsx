'use client'

import { useState, useCallback, useTransition, useEffect } from 'react'
import type { z } from 'zod'
import type { LinktreeConfigSchema, LinktreePageData } from '@/app/go/linktree/_lib/types'
import { saveLinktreeConfig } from '../actions'
import { GeneralSection } from './general-section'
import { HighlightSection } from './highlight-section'
import { SharedLinksSection } from './shared-links-section'
import { EditorPreview } from './editor-preview'

type Config = z.infer<typeof LinktreeConfigSchema>

interface Props {
  initialConfig: Config
  domain: string
  siteId: string
  readOnly: boolean
  pageData: LinktreePageData
}

export function LinktreeEditor({ initialConfig, domain, siteId: _siteId, readOnly, pageData }: Props) {
  const [config, setConfig] = useState<Config>(initialConfig)
  const [savedConfig, setSavedConfig] = useState<Config>(initialConfig)
  const [isPending, startTransition] = useTransition()
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasChanges = JSON.stringify(config) !== JSON.stringify(savedConfig)

  const handleSave = useCallback(() => {
    startTransition(async () => {
      setError(null)
      const result = await saveLinktreeConfig(config)
      if (result.ok) {
        setSavedConfig(config)
        setLastSaved(new Date())
      } else {
        setError(result.error)
      }
    })
  }, [config])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (hasChanges && !readOnly) handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, hasChanges, readOnly])

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (hasChanges) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasChanges])

  const updateConfig = useCallback((patch: Partial<Config>) => {
    setConfig((prev) => ({ ...prev, ...patch }))
  }, [])

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-3">
          <a href="/cms/links" className="text-muted-foreground hover:text-foreground">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </a>
          <h1 className="text-sm font-bold text-foreground">Editar Linktree</h1>
          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
            Porta de Entrada
          </span>
          {domain && (
            <a
              href={`https://${domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {domain}
            </a>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lastSaved && (
            <span className="text-[11px] text-muted-foreground">
              Salvo há {Math.round((Date.now() - lastSaved.getTime()) / 60000)} min
            </span>
          )}
          {hasChanges && (
            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
              Alterações não salvas
            </span>
          )}
          {error && <span className="text-[11px] text-red-400">{error}</span>}
          <a
            href="/cms/links"
            className="rounded border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent/5"
          >
            Cancelar
          </a>
          <button
            onClick={handleSave}
            disabled={!hasChanges || readOnly || isPending}
            className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {isPending ? 'Salvando...' : 'Salvar'}{' '}
            <kbd className="ml-1 text-[9px] opacity-60">⌘S</kbd>
          </button>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Form panel */}
        <div className="flex-1 overflow-y-auto p-6" style={{ maxWidth: '60%' }}>
          <div className="mx-auto max-w-2xl space-y-8">
            <GeneralSection config={config} onChange={updateConfig} readOnly={readOnly} />
            <HighlightSection config={config} onChange={updateConfig} readOnly={readOnly} />
            <SharedLinksSection config={config} onChange={updateConfig} readOnly={readOnly} />
          </div>
        </div>

        <div className="w-[400px] border-l border-border">
          <EditorPreview config={config} pageData={pageData} />
        </div>
      </div>
    </div>
  )
}
