'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { AbTestResults, AbTestWithVariants } from '@/lib/youtube/ab-types'
import { resumeAbTest, archiveAbTest } from '../actions'
import { AbConfidenceTrend } from './ab-confidence-trend'
import { AbRotationTimeline } from './ab-rotation-timeline'
import { AbDailyCtrChart } from './ab-daily-ctr-chart'
import { AbEndTestDialog } from './ab-end-test-dialog'
import { AbPauseDialog } from './ab-pause-dialog'
import { AbVariantCard } from './ab-variant-card'

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

  const { test, variants, confidence, is_significant, suggested_winner_id, timeline } = results

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
        sort_order: v.is_original ? 0 : i,
        created_at: test.created_at,
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

  const timelineVariants = useMemo(
    () =>
      variants.map(v => ({
        id: v.variant_id,
        label: v.label,
        is_original: v.is_original,
      })),
    [variants],
  )

  const totalDays = useMemo(() => {
    if (timeline.length === 0) return 1
    return Math.max(timeline.length, 1)
  }, [timeline])

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

      {test.status === 'completed' && (
        <div
          className={[
            'rounded-[var(--cms-radius)] px-4 py-3 text-sm font-medium',
            winnerVariant
              ? 'bg-green-900/30 text-green-300'
              : 'bg-amber-900/30 text-amber-300',
          ].join(' ')}
        >
          {winnerVariant ? (
            <>
              Winner: {winnerVariant.label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              {ctrLift !== null && ` — +${ctrLift}% CTR lift`}
              {` at ${Math.round((test.confidence_at_completion ?? confidence) * 100)}% confidence`}
            </>
          ) : (
            <>
              Test concluded without a clear winner ({Math.round((test.confidence_at_completion ?? confidence) * 100)}%
              confidence)
            </>
          )}
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
            <AbConfidenceTrend
              evaluations={evaluations}
              threshold={test.config.confidence_threshold}
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

      <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-5 space-y-3">
        <h3 className="text-sm font-semibold text-cms-text">Rotation Timeline</h3>
        <AbRotationTimeline
          cycles={timeline}
          variants={timelineVariants}
          today={new Date().toISOString()}
          totalDays={totalDays}
        />
      </div>

      <section className="space-y-3">
        <AbDailyCtrChart
          cycles={results.timeline}
          variants={results.variants.map(v => ({ id: v.variant_id, label: v.label }))}
        />
      </section>

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
