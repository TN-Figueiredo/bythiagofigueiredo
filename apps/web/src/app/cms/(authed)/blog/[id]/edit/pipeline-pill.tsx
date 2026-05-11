'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { GEM_CSS_VARS } from '@/lib/pipeline/gem-design'
import { linkToPipelineItem, unlinkFromPipeline, searchPipelineItems } from './actions'

interface PipelineItemInfo {
  id: string
  code: string
  title_pt: string | null
  title_en: string | null
  stage: string
  format: string
  priority: number
}

interface SearchResult {
  id: string
  code: string
  title: string
  format: string
  stage: string
  blog_post_id: string | null
}

interface Props {
  postId: string
  siteId: string
  initialItem: PipelineItemInfo | null
}

const STAGE_COLORS: Record<string, string> = {
  idea: '#6366f1',
  draft: '#a855f7',
  ready: '#06b6d4',
  scheduled: '#14b8a6',
  published: '#10b981',
}

export function PipelinePill({ postId, siteId, initialItem }: Props) {
  const router = useRouter()
  const [item, setItem] = useState<PipelineItemInfo | null>(initialItem)
  const [showSearch, setShowSearch] = useState(false)
  const [showPopover, setShowPopover] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLinking, setIsLinking] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pillRef = useRef<HTMLDivElement>(null)

  useEffect(() => setItem(initialItem), [initialItem])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pillRef.current && !pillRef.current.contains(e.target as Node)) {
        setShowPopover(false)
        setShowSearch(false)
        setShowConfirm(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const data = await searchPipelineItems(siteId, query.trim())
      setResults(data)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, siteId])

  const handleLink = useCallback(async (pipelineItemId: string) => {
    setIsLinking(true)
    const result = await linkToPipelineItem(postId, pipelineItemId)
    if (!result.ok) {
      toast.error(result.error)
    } else {
      toast.success('Vinculado ao pipeline')
      setShowSearch(false)
      router.refresh()
    }
    setIsLinking(false)
  }, [postId, router])

  const handleUnlink = useCallback(async () => {
    const result = await unlinkFromPipeline(postId)
    if (!result.ok) {
      toast.error(result.error)
    } else {
      setItem(null)
      setShowPopover(false)
      setShowConfirm(false)
      toast.success('Desvinculado do pipeline')
    }
  }, [postId])

  const stageColor = item ? (STAGE_COLORS[item.stage] ?? GEM_CSS_VARS['--gem-dim']) : undefined
  const title = item ? (item.title_pt || item.title_en || 'Untitled') : null

  return (
    <div ref={pillRef} className="relative inline-block mb-2" style={GEM_CSS_VARS as React.CSSProperties}>
      {item ? (
        <button
          onClick={() => setShowPopover(!showPopover)}
          className="text-xs px-2.5 py-1 rounded-full border transition-colors hover:bg-white/5"
          style={{ borderColor: stageColor, color: stageColor }}
        >
          {item.code} · {item.stage}
        </button>
      ) : (
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="text-xs px-2.5 py-1 rounded-full border border-dashed transition-colors hover:bg-white/5"
          style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-dim)' }}
        >
          + Pipeline
        </button>
      )}

      {showPopover && item && (
        <div
          className="absolute left-0 top-full mt-1 w-64 rounded-lg border p-3 z-50 shadow-lg"
          style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}
        >
          <p className="text-xs font-medium" style={{ color: 'var(--gem-text)' }}>{title}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: `${stageColor}20`, color: stageColor }}>{item.stage}</span>
            <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>P{item.priority}</span>
          </div>
          <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: '1px solid var(--gem-border)' }}>
            <a href={`/cms/pipeline/items/${item.id}`} target="_blank" rel="noopener" className="text-xs" style={{ color: 'var(--gem-accent)' }}>
              Abrir pipeline &rarr;
            </a>
            {showConfirm ? (
              <div className="ml-auto flex gap-1">
                <button onClick={() => setShowConfirm(false)} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: 'var(--gem-dim)' }}>Não</button>
                <button onClick={handleUnlink} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: 'var(--gem-danger)' }}>Sim, desvincular</button>
              </div>
            ) : (
              <button onClick={() => setShowConfirm(true)} className="text-xs ml-auto" style={{ color: 'var(--gem-danger)' }}>
                Desvincular
              </button>
            )}
          </div>
        </div>
      )}

      {showSearch && !item && (
        <div
          className="absolute left-0 top-full mt-1 w-80 rounded-lg border shadow-lg z-50"
          style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}
        >
          <div className="p-2 border-b" style={{ borderColor: 'var(--gem-border)' }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por código ou título..."
              className="w-full bg-transparent text-xs outline-none"
              style={{ color: 'var(--gem-text)' }}
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {results.length === 0 && query && (
              <p className="text-[11px] p-2 text-center" style={{ color: 'var(--gem-dim)' }}>Nenhum item encontrado</p>
            )}
            {results.map(r => {
              const disabled = !!r.blog_post_id
              return (
                <button
                  key={r.id}
                  disabled={disabled || isLinking}
                  onClick={() => handleLink(r.id)}
                  className="w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors hover:bg-white/5"
                  style={{ opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer', color: 'var(--gem-text)' }}
                  title={disabled ? 'Já vinculado a outro post' : undefined}
                >
                  <span className="font-mono text-[10px] mr-1.5" style={{ color: 'var(--gem-accent)' }}>{r.code}</span>
                  {r.title}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
