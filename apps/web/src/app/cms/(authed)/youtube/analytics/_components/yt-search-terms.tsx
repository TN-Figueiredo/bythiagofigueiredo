/**
 * SearchView — REFERENCE IMPLEMENTATION for interactive tables.
 *
 * Features:
 * - Sortable headers (Views, CTR) with function-inline sortTh (NOT component)
 * - aria-sort, chevron rotation 180deg on asc, active header in accent
 * - Rows: role="button", tabIndex={0}, hover bg, focus-visible outline
 * - onClick -> toast "Roteiro pro termo '{term}' enviado ao pipeline."
 * - Affordance "Criar roteiro ->" (.search-cta) revealed on hover/focus
 * - Tendencia column (trendUp/trendDown/flat icons)
 * - Card wrapper with title + "N termos . ultimos 28 dias" counter
 */
'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createPipelineItem } from '@/app/cms/(authed)/pipeline/actions'
import type { YtSearchTerm } from '@/lib/youtube/analytics-types'
import { fmtC, brDec } from '@/lib/youtube/format'

interface Props {
  terms: YtSearchTerm[]
  apiError?: string
}

type SortKey = 'views' | 'ctr'
type SortDir = 'asc' | 'desc'

/** Estimate CTR for terms that only have views + watch time */
function estimateCtr(t: YtSearchTerm): number {
  if (t.views === 0) return 0
  // Use watch-time-to-views ratio as rough CTR proxy (capped at 15%)
  return Math.min((t.estimatedMinutesWatched / t.views) * 2, 15)
}

/** Estimate trend from watch time ratio */
function estimateTrend(t: YtSearchTerm): 'up' | 'down' | 'flat' {
  const ratio = t.views > 0 ? t.estimatedMinutesWatched / t.views : 0
  if (ratio > 3) return 'up'
  if (ratio < 1) return 'down'
  return 'flat'
}

export function YtSearchTermsView({ terms, apiError }: Props) {
  const router = useRouter()
  const [creatingTerm, setCreatingTerm] = useState<string | null>(null)
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'views',
    dir: 'desc',
  })

  const activeTerms = terms

  const enriched = useMemo(
    () =>
      activeTerms.map((t) => ({
        ...t,
        ctr: estimateCtr(t),
        trend: estimateTrend(t),
      })),
    [activeTerms],
  )

  const sorted = useMemo(() => {
    const arr = [...enriched]
    const mul = sort.dir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      const va = sort.key === 'views' ? a.views : a.ctr
      const vb = sort.key === 'views' ? b.views : b.ctr
      return (va - vb) * mul
    })
    return arr
  }, [enriched, sort])

  if (activeTerms.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-cms-border p-8 text-center">
        {apiError === 'scope' ? (
          <>
            <p className="text-sm text-cms-text-muted">
              Permissao insuficiente para acessar termos de busca.
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs text-cms-text-dim">
              O token OAuth do YouTube nao tem o escopo{' '}
              <code className="rounded bg-cms-border px-1">yt-analytics.readonly</code>.
              Reconecte o canal em Conexoes para solicitar a permissao necessaria.
            </p>
          </>
        ) : apiError ? (
          <>
            <p className="text-sm text-cms-text-muted">
              Erro ao carregar termos de busca da API do YouTube.
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs text-cms-text-dim">
              A API retornou um erro temporario. Tente novamente em alguns minutos.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-cms-text-muted">
              Termos de busca nao disponiveis para este canal.
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs text-cms-text-dim">
              O YouTube so libera dados de termos de busca quando o canal recebe um
              volume minimo de trafego de pesquisa no periodo.
            </p>
          </>
        )}
      </div>
    )
  }

  const handleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: 'desc' },
    )
  }

  const handleRowClick = async (term: string) => {
    if (creatingTerm) return
    setCreatingTerm(term)
    try {
      const result = await createPipelineItem({
        format: 'video',
        title_pt: `Roteiro: ${term}`,
        synopsis: `Video baseado no termo de busca "${term}".`,
        tags: ['search-term', 'youtube-analytics'],
      })
      if (result.ok) {
        toast.success(`Roteiro "${term}" criado no pipeline.`)
        router.push(`/cms/pipeline/${result.data.id}`)
      } else {
        toast.error(result.error || 'Erro ao criar roteiro.')
      }
    } catch {
      toast.error('Erro ao criar roteiro. Tente novamente.')
    } finally {
      setCreatingTerm(null)
    }
  }

  const handleRowKeyDown = (e: React.KeyboardEvent, term: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleRowClick(term)
    }
  }

  /**
   * Sort header — FUNCTION INLINE, not a component.
   * This prevents remount on re-render (preserves focus, avoids flicker).
   * See spec section 5: "Do not render as nested component."
   */
  function sortTh(key: SortKey, label: string) {
    const isActive = sort.key === key
    const ariaSortVal: 'ascending' | 'descending' | 'none' = isActive
      ? sort.dir === 'asc'
        ? 'ascending'
        : 'descending'
      : 'none'

    return (
      <th
        key={key}
        scope="col"
        role="button"
        tabIndex={0}
        aria-sort={ariaSortVal}
        title={`Ordenar por ${label}`}
        onClick={() => handleSort(key)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleSort(key)
          }
        }}
        className={`sortable ta-r${isActive ? ' on' : ''}`}
      >
        <span className="sort-h">
          {label}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{
              opacity: isActive ? 1 : 0.32,
              transform: isActive && sort.dir === 'asc' ? 'rotate(180deg)' : 'none',
              transition: 'transform var(--t-fast) var(--ease-out), opacity var(--t-fast) var(--ease-out)',
            }}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </th>
    )
  }

  return (
    <div className="fade-in card">
      <div className="card-head">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
        <span className="card-title">Termos de busca que trazem views</span>
        <span className="dim" style={{ fontSize: 11.5, marginLeft: 'auto' }}>
          {activeTerms.length} termos &middot; ultimos 28 dias
        </span>
      </div>
      <table className="search-table">
          <thead>
            <tr>
              <th scope="col">
                Termo
              </th>
              {sortTh('views', 'Views')}
              {sortTh('ctr', 'CTR')}
              <th scope="col" className="ta-r">
                Tendencia
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const isCreating = creatingTerm === t.term
              return (
              <tr
                key={t.term}
                className="search-row"
                role="button"
                tabIndex={0}
                title={`Criar roteiro para "${t.term}"`}
                onClick={() => handleRowClick(t.term)}
                onKeyDown={(e) => handleRowKeyDown(e, t.term)}
                style={isCreating ? { opacity: 0.55, pointerEvents: 'none' } : undefined}
              >
                <td>
                  <span className="search-term">
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{t.term}</span>
                    <span className="search-cta">
                      {isCreating ? 'Criando...' : 'Criar roteiro'}
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </span>
                  </span>
                </td>
                <td className="tnum ta-r">
                  {fmtC(t.views)}
                </td>
                <td className="tnum ta-r" style={{ color: 'var(--accent)' }}>
                  {brDec(t.ctr, 1)}%
                </td>
                <td className="ta-r">
                  {t.trend === 'up' && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Em alta" style={{ display: 'inline' }}><path d="M22 7l-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/></svg>
                  )}
                  {t.trend === 'down' && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Em queda" style={{ display: 'inline' }}><path d="M22 17l-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/></svg>
                  )}
                  {t.trend === 'flat' && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Estavel" style={{ display: 'inline' }}><path d="M5 12h14"/></svg>
                  )}
                </td>
              </tr>
              )
            })}
          </tbody>
      </table>
    </div>
  )
}
