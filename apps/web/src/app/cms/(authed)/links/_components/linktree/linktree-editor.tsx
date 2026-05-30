'use client'

import { useState, useCallback, useTransition, useEffect } from 'react'
import type { z } from 'zod'
import type { LinktreeConfigSchema, LinktreePageData } from '@/app/go/linktree/_lib/types'
import { saveLinktreeConfig } from '../../actions'
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
      <div style={{
        height: 56, flexShrink: 0,
        borderBottom: '1px solid var(--line)',
        background: 'var(--bg-side, var(--surface))',
        display: 'flex', alignItems: 'center',
        padding: '0 24px', gap: 14,
      }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <a href="/cms/links" style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink-dim)', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 15l6-6" /><path d="M10 6l1-1a4 4 0 016 6l-1 1" /><path d="M14 18l-1 1a4 4 0 01-6-6l1-1" />
            </svg>
            Links
          </a>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ink-faint)', opacity: 0.7, flexShrink: 0 }}>
            <path d="M9 6l6 6-6 6" />
          </svg>
          <a href="/cms/links?tab=tree" style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink-dim)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Linktree
          </a>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ink-faint)', opacity: 0.7, flexShrink: 0 }}>
            <path d="M9 6l6 6-6 6" />
          </svg>
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220, flexShrink: 1 }}>
            Editar
          </span>
        </div>

        {/* Badge */}
        <span className="mono" style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 9px', borderRadius: 999,
          fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
          background: 'var(--amber-soft)', color: 'var(--amber)',
          marginLeft: 4,
        }}>
          porta de entrada
        </span>

        {/* Domain */}
        {domain && (
          <span className="mono" style={{ fontSize: '11.5px', color: 'var(--ink-dim)', marginLeft: 4 }}>
            {domain}
          </span>
        )}

        {/* Actions (right) */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          {lastSaved && (
            <span style={{ fontSize: 11, color: 'var(--ink-faint)', alignSelf: 'center' }}>
              Salvo há {Math.round((Date.now() - lastSaved.getTime()) / 60000)} min
            </span>
          )}
          {error && <span style={{ fontSize: 11, color: 'var(--red)', alignSelf: 'center' }}>{error}</span>}
          <a
            href="/cms/links"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '6px 11px', fontSize: '12.5px', fontWeight: 600,
              borderRadius: 9, border: '1px solid var(--line-strong)',
              background: 'transparent', color: 'var(--ink-dim)',
              textDecoration: 'none', letterSpacing: '-0.01em', whiteSpace: 'nowrap',
            }}
          >
            Cancelar
          </a>
          <button
            onClick={handleSave}
            disabled={!hasChanges || readOnly || isPending}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '6px 11px', fontSize: '12.5px', fontWeight: 600,
              borderRadius: 9, border: '1px solid var(--accent)',
              background: 'var(--accent)', color: 'rgb(26, 18, 12)',
              letterSpacing: '-0.01em', whiteSpace: 'nowrap',
              cursor: 'pointer', opacity: (!hasChanges || readOnly || isPending) ? 0.5 : 1,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            {isPending ? 'Salvando...' : 'Salvar'}
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
