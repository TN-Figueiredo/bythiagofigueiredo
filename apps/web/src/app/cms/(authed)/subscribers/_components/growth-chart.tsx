'use client'

import { useState } from 'react'

export interface GrowthDataPoint {
  date: string
  gain: number
  loss: number
}

interface GrowthChartProps {
  data: GrowthDataPoint[]
}

type Period = '7d' | '30d' | '90d' | '1y'

const PERIOD_LABELS: Record<Period, string> = {
  '7d': '7 dias',
  '30d': '30 dias',
  '90d': '90 dias',
  '1y': '1 ano',
}

const PERIOD_DAYS: Record<Period, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function GrowthChart({ data }: GrowthChartProps) {
  const [period, setPeriod] = useState<Period>('30d')

  const days = PERIOD_DAYS[period]
  const sliced = data.slice(-days)

  const maxValue = Math.max(
    1,
    ...sliced.map((d) => Math.max(d.gain, d.loss)),
  )

  const totalGain = sliced.reduce((s, d) => s + d.gain, 0)
  const totalLoss = sliced.reduce((s, d) => s + d.loss, 0)
  const net = totalGain - totalLoss

  return (
    <section
      className="rounded-lg border p-4 mb-6"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      aria-label="Gráfico de crescimento de assinantes"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2
            className="text-sm font-semibold"
            style={{ color: 'var(--text)' }}
          >
            Crescimento de assinantes
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
            <span className="text-green-500 font-medium">+{totalGain}</span>
            {' · '}
            <span className="text-red-500 font-medium">-{totalLoss}</span>
            {' · '}
            <span
              className={net >= 0 ? 'text-green-500' : 'text-red-500'}
              style={{ fontWeight: 500 }}
            >
              líquido {net >= 0 ? '+' : ''}{net}
            </span>
          </p>
        </div>

        <div
          className="flex gap-1 rounded-md p-0.5"
          style={{ background: 'var(--surface-hover)' }}
          role="group"
          aria-label="Período"
        >
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              aria-pressed={period === p}
              className="text-xs px-2.5 py-1 rounded transition-colors"
              style={
                period === p
                  ? {
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      fontWeight: 600,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                    }
                  : { color: 'var(--text-dim)' }
              }
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div
        className="flex items-end gap-px overflow-hidden"
        style={{ height: 80 }}
        role="img"
        aria-label={`Barras de crescimento nos últimos ${PERIOD_LABELS[period]}`}
      >
        {sliced.length === 0 ? (
          <div
            className="flex-1 flex items-center justify-center text-xs"
            style={{ color: 'var(--text-dim)' }}
          >
            Sem dados
          </div>
        ) : (
          sliced.map((point, i) => {
            const gainH = maxValue > 0 ? Math.round((point.gain / maxValue) * 76) : 0
            const lossH = maxValue > 0 ? Math.round((point.loss / maxValue) * 76) : 0
            const isLast = i === sliced.length - 1
            return (
              <div
                key={point.date}
                className="flex-1 flex flex-col items-center justify-end gap-px"
                style={{ minWidth: 2 }}
                title={`${formatDate(point.date)}: +${point.gain} / -${point.loss}`}
              >
                {point.gain > 0 && (
                  <div
                    style={{
                      height: gainH,
                      background: '#22c55e',
                      width: '100%',
                      borderRadius: '1px 1px 0 0',
                      opacity: isLast ? 1 : 0.8,
                    }}
                  />
                )}
                {point.loss > 0 && (
                  <div
                    style={{
                      height: lossH,
                      background: '#ef4444',
                      width: '100%',
                      borderRadius: '0 0 1px 1px',
                      opacity: isLast ? 1 : 0.8,
                    }}
                  />
                )}
                {point.gain === 0 && point.loss === 0 && (
                  <div
                    style={{
                      height: 2,
                      background: 'var(--border)',
                      width: '100%',
                    }}
                  />
                )}
              </div>
            )
          })
        )}
      </div>

      {sliced.length > 1 && sliced[0] && sliced[sliced.length - 1] && (
        <div className="flex justify-between mt-1">
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            {formatDate(sliced[0].date)}
          </span>
          {sliced.length > 2 && sliced[Math.floor(sliced.length / 2)] && (
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {formatDate(sliced[Math.floor(sliced.length / 2)]!.date)}
            </span>
          )}
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            {formatDate(sliced[sliced.length - 1]!.date)}
          </span>
        </div>
      )}
    </section>
  )
}
