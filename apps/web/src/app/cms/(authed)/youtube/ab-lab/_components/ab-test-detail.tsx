'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { AbTestResults, AbTestWithVariants, AbTestTrackedLinkRow } from '@/lib/youtube/ab-types'
import { resumeAbTest, archiveAbTest } from '../actions'
import { ConfidenceChart } from './confidence-chart'
import { ABBATimeline } from './abba-timeline'
import { MultiLine } from './multi-line'
import { VARIANT_COLORS, toDisplayLabel } from './ab-constants'
import type { DisplayLabel } from '@/lib/youtube/ab-types'
import { AbEndTestDialog } from './ab-end-test-dialog'
import { AbPauseDialog } from './ab-pause-dialog'
import { AbVariantCard } from './ab-variant-card'
import { AbVideoHistory } from './ab-video-history'

interface AbTestDetailProps {
  results: AbTestResults
}

function normalCdf(z: number): number {
  if (z < -8) return 0
  if (z > 8) return 1
  let sum = 0
  let term = z
  for (let i = 3; sum + term !== sum; i += 2) {
    sum += term
    term *= (z * z) / i
  }
  return 0.5 + sum * Math.exp(-0.5 * z * z - 0.9189385332)
}

type DataMode = 'confirmed' | 'estimate'

const typeLabels: Record<string, string> = {
  thumbnail: 'Thumbnail',
  title: 'Título',
  description: 'Descrição',
  combo: 'Combo',
}

function formatDate(iso: string | null): string {
  if (!iso) return 'ongoing'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function AbTestDetail({ results }: AbTestDetailProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showEndDialog, setShowEndDialog] = useState(false)
  const [showPauseDialog, setShowPauseDialog] = useState(false)
  const [dataMode, setDataMode] = useState<DataMode>('confirmed')
  const [expandedAiContext, setExpandedAiContext] = useState<Set<string>>(new Set())

  const { test, variants, confidence, is_significant, suggested_winner_id, timeline, tracked_links } = results

  const testWithVariants: AbTestWithVariants = useMemo(
    () => ({
      ...test,
      variants: variants.map((v, i) => ({
        id: v.variant_id,
        test_id: test.id,
        label: v.label,
        is_original: v.is_original,
        blob_url: v.blob_url,
        blob_key: null,
        file_size_bytes: null,
        dimensions: null,
        title_text: v.title_text ?? null,
        description_text: v.description_text ?? null,
        metadata: v.metadata ?? {},
        sort_order: v.is_original ? 0 : i,
        created_at: test.created_at,
        source_variant_id: null,
      })),
      current_cycle: timeline.find(c => !c.ended_at) ?? null,
      total_cycles: timeline.length,
    }),
    [test, variants, timeline],
  )

  const evaluations = useMemo(() => {
    const confirmed = results.timeline
      .filter(c => c.backfill_status === 'confirmed' && c.impressions !== null && c.clicks !== null)
      .sort((a, b) => a.cycle_number - b.cycle_number)

    if (confirmed.length < 2) {
      if (results.confidence > 0) return [{ day: 1, confidence: results.confidence }]
      return []
    }

    const points: { day: number; confidence: number }[] = []
    const variantTotals = new Map<string, { impressions: number; clicks: number }>()

    for (let i = 0; i < confirmed.length; i++) {
      const cycle = confirmed[i]
      if (!cycle) continue
      const existing = variantTotals.get(cycle.variant_id) ?? { impressions: 0, clicks: 0 }
      existing.impressions += cycle.impressions ?? 0
      existing.clicks += cycle.clicks ?? 0
      variantTotals.set(cycle.variant_id, existing)

      // Need at least 2 variants with data to compute confidence
      const activeVariants = Array.from(variantTotals.values()).filter(v => v.impressions > 0)
      if (activeVariants.length < 2) continue

      const ctrs = Array.from(variantTotals.entries()).map(([id, v]) => ({
        id,
        ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
      }))
      const sorted = ctrs.sort((a, b) => b.ctr - a.ctr)
      const best = sorted[0]
      const second = sorted[1]

      if (!best || !second) continue

      const bestData = variantTotals.get(best.id)!
      const secondData = variantTotals.get(second.id)!

      const diff = Math.abs(best.ctr - second.ctr)
      const se = Math.sqrt(
        (best.ctr * (1 - best.ctr)) / Math.max(bestData.impressions, 1) +
          (second.ctr * (1 - second.ctr)) / Math.max(secondData.impressions, 1),
      )
      const z = se > 0 ? diff / se : 0
      const pointConfidence = Math.min(normalCdf(z), 0.999)

      points.push({ day: i + 1, confidence: pointConfidence })
    }

    // If the final confidence from results differs significantly, add it as the last point
    const lastPoint = points[points.length - 1]
    if (lastPoint !== undefined && Math.abs(lastPoint.confidence - results.confidence) > 0.01) {
      points.push({ day: points.length + 1, confidence: results.confidence })
    }

    return points
  }, [results])

  const winnerVariant = useMemo(
    () => variants.find(v => v.variant_id === test.winner_variant_id) ?? null,
    [variants, test.winner_variant_id],
  )

  const leadingVariant = useMemo(() => {
    if (variants.length === 0) return null
    return [...variants].sort((a, b) => b.avg_ctr - a.avg_ctr)[0]
  }, [variants])

  const ctrLift = useMemo(() => {
    if (!winnerVariant) return null
    const original = variants.find(v => v.is_original)
    if (!original || original.avg_ctr === 0) return null
    return (((winnerVariant.avg_ctr - original.avg_ctr) / original.avg_ctr) * 100).toFixed(1)
  }, [winnerVariant, variants])

  const statusBadge: Record<string, string> = {
    active: 'bg-green-900/30 text-green-400',
    paused: 'bg-amber-900/30 text-amber-400',
    completed: 'bg-blue-900/30 text-blue-400',
    draft: 'bg-cms-surface-hover text-cms-text-muted',
    archived: 'bg-cms-surface-hover text-cms-text-dim',
  }

  const badgeClass = statusBadge[test.status] ?? 'bg-cms-surface-hover text-cms-text-muted'

  function handleResume() {
    startTransition(async () => {
      await resumeAbTest(test.id)
      router.refresh()
    })
  }

  function handleArchive() {
    startTransition(async () => {
      await archiveAbTest(test.id)
      router.refresh()
    })
  }

  const variantIdToLabel = useMemo(() => {
    const map = new Map<string, DisplayLabel>()
    for (const v of variants) {
      map.set(v.variant_id, toDisplayLabel(v.label, v.is_original))
    }
    return map
  }, [variants])

  const timelineSeq = useMemo(() => {
    const sorted = [...timeline].sort((a, b) => a.cycle_number - b.cycle_number)
    return sorted.map(c => variantIdToLabel.get(c.variant_id) ?? 'A' as DisplayLabel)
  }, [timeline, variantIdToLabel])

  const timelineDone = useMemo(
    () => timeline.filter(c => c.ended_at !== null).length,
    [timeline],
  )

  const timelineColors = useMemo(
    () => ({ ...VARIANT_COLORS }) as Record<string, string>,
    [],
  )

  const multiLineSeries = useMemo(() => {
    const confirmed = results.timeline
      .filter(c => c.backfill_status === 'confirmed' && c.ctr !== null)
      .sort((a, b) => a.cycle_number - b.cycle_number)

    const series = {} as Record<DisplayLabel, number[]>
    for (const c of confirmed) {
      const label = variantIdToLabel.get(c.variant_id) ?? ('A' as DisplayLabel)
      if (!series[label]) series[label] = []
      series[label].push((c.ctr ?? 0) * 100)
    }
    return series
  }, [results.timeline, variantIdToLabel])

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <nav className="flex items-center gap-2 text-sm text-cms-text-muted">
        <Link href="/cms/youtube/ab-lab" className="hover:text-cms-text transition-colors">
          A/B Lab
        </Link>
        <span>/</span>
        <span className="text-cms-text">{test.name}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <span
          className={[
            'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize',
            badgeClass,
          ].join(' ')}
        >
          {test.status}
        </span>

        <span className="inline-flex items-center rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-medium text-orange-400">
          {typeLabels[test.test_type ?? 'thumbnail']}
        </span>

        <span className="text-xs text-cms-text-muted">
          {formatDate(test.started_at)} → {formatDate(test.completed_at)}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {test.status === 'active' && (
            <>
              <button
                type="button"
                onClick={() => setShowPauseDialog(true)}
                disabled={isPending}
                className="rounded-[var(--cms-radius)] border border-cms-border px-3 py-1.5 text-sm font-medium text-cms-text hover:bg-cms-surface-hover disabled:opacity-50"
              >
                Pause
              </button>
              <button
                type="button"
                onClick={() => setShowEndDialog(true)}
                disabled={isPending}
                className="rounded-[var(--cms-radius)] bg-red-900/30 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-900/50 disabled:opacity-50"
              >
                End Test
              </button>
            </>
          )}

          {test.status === 'paused' && (
            <>
              <button
                type="button"
                onClick={handleResume}
                disabled={isPending}
                className="rounded-[var(--cms-radius)] border border-cms-border px-3 py-1.5 text-sm font-medium text-cms-text hover:bg-cms-surface-hover disabled:opacity-50"
              >
                {isPending ? 'Resuming…' : 'Resume'}
              </button>
              <button
                type="button"
                onClick={() => setShowEndDialog(true)}
                disabled={isPending}
                className="rounded-[var(--cms-radius)] bg-red-900/30 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-900/50 disabled:opacity-50"
              >
                End Test
              </button>
            </>
          )}

          {test.status === 'completed' && (
            <button
              type="button"
              onClick={handleArchive}
              disabled={isPending}
              className="rounded-[var(--cms-radius)] border border-cms-border px-3 py-1.5 text-sm font-medium text-cms-text hover:bg-cms-surface-hover disabled:opacity-50"
            >
              {isPending ? 'Archiving…' : 'Archive'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-cms-text-dim">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Last sync: {new Date(results.data_freshness).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {test.playoff_test_id && (
        <div className="flex items-center gap-3 rounded-[var(--cms-radius)] border border-indigo-500/30 bg-indigo-500/10 px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-400 shrink-0" aria-hidden="true">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 6.5 6 6.5 6S7 4 9.5 4a2.5 2.5 0 0 1 0 5H8" />
            <path d="M6 9h12l-1.5 8H7.5L6 9z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-indigo-300">Playoff criado</p>
            <p className="text-xs text-indigo-400/70">As 2 melhores variantes avançaram para o Round 2</p>
          </div>
          <Link
            href={`/cms/youtube/ab-lab/${test.playoff_test_id}`}
            className="text-xs font-medium text-indigo-400 hover:text-indigo-300 shrink-0"
          >
            Ver Round 2 →
          </Link>
        </div>
      )}

      {test.parent_test_id && (
        <div className="flex items-center gap-3 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-4 py-2">
          <span className="inline-flex items-center rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-semibold text-indigo-400">
            Round 2
          </span>
          <Link
            href={`/cms/youtube/ab-lab/${test.parent_test_id}`}
            className="text-xs text-cms-text-muted hover:text-cms-text"
          >
            ← Ver Round 1
          </Link>
        </div>
      )}

      {test.status === 'completed' && winnerVariant && ctrLift !== null && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
          <div className="flex items-center gap-4">
            {winnerVariant.blob_url && (
              <div className="flex-shrink-0 overflow-hidden rounded-md border border-cms-border">
                <img
                  src={winnerVariant.blob_url}
                  alt={`Winner: ${winnerVariant.label}`}
                  width={120}
                  height={68}
                  className="object-cover"
                />
              </div>
            )}
            <div className="flex-1 space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-green-400">
                  +{ctrLift}% CTR
                </span>
                <span className="text-xs text-cms-text-muted">
                  Variante {winnerVariant.label} ganhou
                </span>
              </div>
              <div className="flex gap-4 text-xs text-cms-text-muted">
                <span>Confiança: {((test.confidence_at_completion ?? 0) * 100).toFixed(0)}%</span>
                {test.result_metadata?.estimated_monthly_extra_clicks != null && (
                  <span>+{test.result_metadata.estimated_monthly_extra_clicks.toLocaleString()} clicks/mês estimados</span>
                )}
                {test.started_at && test.completed_at && (
                  <span>{Math.ceil((new Date(test.completed_at).getTime() - new Date(test.started_at).getTime()) / 86_400_000)} dias de teste</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowEndDialog(true)}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 transition-colors"
            >
              Aplicar Winner
            </button>
          </div>
        </div>
      )}

      {test.status === 'completed' && winnerVariant && ctrLift === null && (
        <div className="rounded-lg border border-cms-border bg-cms-surface p-3 text-sm text-cms-text-muted">
          Variante {winnerVariant.label} venceu — dados de CTR insuficientes para calcular lift.
        </div>
      )}

      {test.status === 'completed' && !winnerVariant && (
        <div className="rounded-[var(--cms-radius)] px-4 py-3 text-sm font-medium bg-amber-900/30 text-amber-300">
          Test concluded without a clear winner ({Math.round((test.confidence_at_completion ?? confidence) * 100)}%
          confidence)
        </div>
      )}

      <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-cms-text-muted uppercase tracking-wide">Confidence</span>
            <span className="text-4xl font-bold text-cms-text">
              {Math.round(confidence * 100)}%
            </span>
            <span
              className={[
                'text-sm font-medium',
                is_significant ? 'text-green-400' : 'text-amber-400',
              ].join(' ')}
            >
              {is_significant ? 'Significant' : 'Not yet significant'}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <ConfidenceChart
              data={evaluations.map(e => e.confidence * 100)}
              target={(test.config.confidence_threshold ?? 0.95) * 100}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setDataMode('confirmed')}
          className={[
            'rounded-[var(--cms-radius)] px-3 py-1.5 text-sm font-medium transition-colors',
            dataMode === 'confirmed'
              ? 'bg-cms-accent text-white'
              : 'bg-cms-surface-hover text-cms-text-muted hover:text-cms-text',
          ].join(' ')}
        >
          Confirmed
        </button>
        <button
          type="button"
          onClick={() => setDataMode('estimate')}
          className={[
            'rounded-[var(--cms-radius)] px-3 py-1.5 text-sm font-medium transition-colors',
            dataMode === 'estimate'
              ? 'bg-cms-accent text-white'
              : 'bg-cms-surface-hover text-cms-text-muted hover:text-cms-text',
          ].join(' ')}
        >
          Live Estimate
        </button>

        <p className="text-[10px] text-cms-text-dim">
          YouTube Analytics data has a 48-72h delay. Last confirmed data:{' '}
          {results.data_freshness
            ? new Date(results.data_freshness).toLocaleDateString('en', { month: 'short', day: 'numeric' })
            : 'pending'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {variants.map(v => (
          <AbVariantCard
            key={v.variant_id}
            variant={v}
            isWinner={v.variant_id === test.winner_variant_id}
            isLeading={
              !test.winner_variant_id &&
              leadingVariant?.variant_id === v.variant_id &&
              test.status === 'active'
            }
            isEstimate={dataMode === 'estimate'}
          />
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm" aria-label="Comparação de variantes">
          <thead>
            <tr className="border-b border-cms-border text-left text-xs text-cms-text-muted">
              <th scope="col" className="pb-2 font-medium">Variante</th>
              <th scope="col" className="pb-2 font-medium">CTR</th>
              <th scope="col" className="pb-2 font-medium">Impressões</th>
              <th scope="col" className="pb-2 font-medium">Cliques</th>
              <th scope="col" className="pb-2 font-medium">vs Original</th>
            </tr>
          </thead>
          <tbody>
            {variants.map(v => {
              const original = variants.find(o => o.is_original)
              const isWinner = v.variant_id === test.winner_variant_id
              const delta = original && original.avg_ctr > 0
                ? (((v.avg_ctr - original.avg_ctr) / original.avg_ctr) * 100).toFixed(1)
                : null
              const hasAiContext = !!v.metadata?.rationale || !!v.metadata?.creative_direction
              const isExpanded = expandedAiContext.has(v.variant_id)
              return (
                <tr key={v.variant_id} className={isWinner ? 'bg-green-500/10' : ''}>
                  <td className="py-2 font-medium">
                    <span>{v.label}{v.is_original ? ' (Original)' : ''}</span>
                    {hasAiContext && (
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? 'Ocultar' : 'Ver'} contexto AI da variante ${v.label}`}
                        onClick={() => setExpandedAiContext(prev => {
                          const next = new Set(prev)
                          if (next.has(v.variant_id)) next.delete(v.variant_id)
                          else next.add(v.variant_id)
                          return next
                        })}
                        className="ml-2 text-[10px] text-indigo-400 hover:text-indigo-300"
                      >
                        {isExpanded ? 'ocultar AI' : 'ver AI'}
                      </button>
                    )}
                    {isExpanded && (
                      <div className="mt-1 space-y-1 text-xs text-cms-text-muted">
                        {v.metadata?.rationale && (
                          <p><span className="font-medium text-cms-text-dim">Rationale:</span> {v.metadata.rationale}</p>
                        )}
                        {v.metadata?.creative_direction && (
                          <p><span className="font-medium text-cms-text-dim">Direção criativa:</span> {v.metadata.creative_direction}</p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-2">{(v.avg_ctr * 100).toFixed(2)}%</td>
                  <td className="py-2">{v.total_impressions.toLocaleString()}</td>
                  <td className="py-2">{v.total_clicks.toLocaleString()}</td>
                  <td className={[
                    'py-2',
                    delta && parseFloat(delta) < 0 ? 'text-red-400' : '',
                    delta && parseFloat(delta) > 0 ? 'text-green-400' : '',
                  ].filter(Boolean).join(' ')}>
                    {v.is_original ? '—' : delta ? `${parseFloat(delta) > 0 ? '+' : ''}${delta}%` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-5 space-y-3">
        <h3 className="text-sm font-semibold text-cms-text">Rotation Timeline</h3>
        <ABBATimeline
          seq={timelineSeq}
          total={timelineSeq.length}
          done={timelineDone}
          colors={timelineColors}
        />
      </div>

      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-cms-text-dim">Daily CTR</h4>
        <MultiLine
          series={multiLineSeries}
          colors={{ ...VARIANT_COLORS }}
        />
      </section>

      {(test.test_type === 'description' || test.test_type === 'combo') && tracked_links && tracked_links.length > 0 && (
        <section className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-5 space-y-3">
          <h3 className="text-sm font-semibold text-cms-text-muted">Atribuição de Links</h3>
          <div className="grid gap-2">
            {tracked_links.map((link: AbTestTrackedLinkRow) => (
              <div key={link.id} className="flex items-center justify-between p-3 rounded-[var(--cms-radius)] bg-cms-surface-hover border border-cms-border">
                <div>
                  <span className="text-sm text-cms-text">{link.template_name}</span>
                  <span className="text-xs text-cms-text-muted ml-2">{link.short_code}</span>
                </div>
                <span className="text-sm font-medium text-cms-text-muted">
                  —
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {showEndDialog && (
        <AbEndTestDialog
          test={testWithVariants}
          onClose={() => setShowEndDialog(false)}
        />
      )}

      {showPauseDialog && (
        <AbPauseDialog
          test={testWithVariants}
          onClose={() => setShowPauseDialog(false)}
        />
      )}
    </div>
  )
}
