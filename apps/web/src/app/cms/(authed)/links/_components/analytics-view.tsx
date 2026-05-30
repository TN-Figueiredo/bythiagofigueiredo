'use client'

import { Link2, Users, Percent, QrCode, TrendingUp } from 'lucide-react'
import type { AnalyticsDisplay } from '@tn-figueiredo/links-admin'
import {
  Delta, Spark, BarChart, Donut, HBars, Heatmap, CountryList, Panel,
} from '@tn-figueiredo/links-admin/client'
import { SourceBars } from './source-bars'
import { TopLinksTable } from './top-links-table'
import { InsightsPanel } from './insights-panel'
import { PotentialPanel } from './potential-panel'
import { RangeTabs } from './range-tabs'
import { useCallback, useState } from 'react'
import { exportAnalyticsCsv } from '../actions'
import { fmt } from './fmt'

interface AnalyticsViewProps {
  data: AnalyticsDisplay
}

export function AnalyticsView({ data }: AnalyticsViewProps) {
  const [range, setRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d')
  const [exporting, setExporting] = useState(false)

  const handleExportCsv = useCallback(async () => {
    setExporting(true)
    try {
      const result = await exportAnalyticsCsv()
      if (result.ok) {
        const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `links-analytics-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setExporting(false)
    }
  }, [])

  return (
    <div className="space-y-5">
      {/* Range tabs + CSV + period note */}
      <RangeTabs value={range} onChange={setRange} onExport={handleExportCsv} exporting={exporting} />

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {[
          {
            label: 'Cliques', Icon: Link2, color: 'var(--accent)', tint: 'var(--accent)',
            value: fmt(data.totalClicks), delta: <Delta cur={data.totalClicks} prev={data.prevClicks} />,
            spark: <Spark data={data.byDay.slice(-14)} color="var(--accent)" w={84} h={30} />, sub: null,
          },
          {
            label: 'Visitantes únicos', Icon: Users, color: 'rgb(63, 169, 192)', tint: 'rgba(63, 169, 192, 0.133)',
            value: fmt(data.unique), delta: <Delta cur={data.unique} prev={data.prevUnique} />,
            spark: <Spark data={data.byDay.slice(-14)} color="#3FA9C0" w={84} h={30} />, sub: null,
          },
          {
            label: 'Engajamento (CTR)', Icon: Percent, color: 'rgb(70, 177, 126)', tint: 'rgba(70, 177, 126, 0.133)',
            value: `${data.ctr}%`, delta: <Delta cur={data.ctr} prev={data.prevCtr} suffix="pp" />,
            spark: null, sub: 'cliques / pageviews',
          },
          {
            label: 'Via QR / impresso', Icon: QrCode, color: 'rgb(224, 162, 60)', tint: 'rgba(224, 162, 60, 0.133)',
            value: `${data.qrShare}%`, delta: null,
            spark: <Spark data={data.byDay.slice(-14)} color="#E0A23C" w={84} h={30} />, sub: 'do total de cliques',
          },
        ].map((s) => (
          <div
            key={s.label}
            data-stat-tile
            style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 'var(--r)', padding: 16, minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
              <span style={{
                width: 30, height: 30, borderRadius: 8,
                background: s.tint + (s.tint.startsWith('var') ? '22' : ''),
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <s.Icon size={16} strokeWidth={1.7} style={{ color: s.color }} />
              </span>
              <span className="eyebrow" style={{ flex: 1, fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
                {s.label}
              </span>
              {s.delta}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div className="mono" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, color: 'var(--ink)' }}>
                  {s.value}
                </div>
                {s.sub && <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginTop: 4 }}>{s.sub}</div>}
              </div>
              {s.spark}
            </div>
          </div>
        ))}
      </div>

      {/* Charts grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Bar chart */}
        <Panel title="Cliques por dia" icon="ba" style={{ gridColumn: 'span 2' }}>
          <BarChart data={data.byDay} prev={data.byDayPrev} height={180} />
        </Panel>

        {/* Source breakdown */}
        <Panel title="Origem do trafego" icon="so">
          <SourceBars sources={data.bySource} />
        </Panel>

        {/* Devices donut */}
        <Panel title="Dispositivos" icon="mo">
          {data.devices.length > 0 ? (
            <Donut segments={data.devices} centerLabel={`${data.devices[0]?.v ?? 0}%`} centerSub={data.devices[0]?.k ?? ''} />
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">Dados de dispositivos ainda nao disponiveis.</p>
          )}
        </Panel>

        {/* Browsers */}
        <Panel title="Navegadores" icon="br">
          {data.browsers.length > 0 ? (
            <HBars rows={data.browsers} />
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">Dados de navegadores ainda nao disponiveis.</p>
          )}
        </Panel>

        {/* OS */}
        <Panel title="Sistemas" icon="os">
          {data.os.length > 0 ? (
            <HBars rows={data.os} color="#3FA9C0" />
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">Dados de sistemas ainda nao disponiveis.</p>
          )}
        </Panel>

        {/* Heatmap */}
        <Panel title="Horarios de pico" icon="he" style={{ gridColumn: 'span 2' }}>
          <Heatmap grid={data.heatmap} />
        </Panel>

        {/* Countries */}
        <Panel title="Top paises" icon="gl">
          {data.countries.length > 0 ? (
            <CountryList countries={data.countries} />
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">Dados geograficos ainda nao disponiveis.</p>
          )}
        </Panel>

        {/* Referrers */}
        <Panel title="Referrers" icon="re">
          {data.referrers.length > 0 ? (
            <HBars rows={data.referrers} color="#A77CE8" />
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">Dados de referrers ainda nao disponiveis.</p>
          )}
        </Panel>

        {/* Top Links */}
        {data.topLinks.length > 0 && (
          <Panel title="Top links" icon="tr" style={{ gridColumn: 'span 2' }}>
            <TopLinksTable links={data.topLinks.map(l => ({
              id: l.id,
              title: l.title,
              slug: l.slug,
              clicks: l.clicks,
              source: l.source,
            }))} />
          </Panel>
        )}
      </div>

      {/* Insights */}
      {data.insights.length > 0 && (
        <Panel title="Insights" icon="li">
          <InsightsPanel insights={data.insights} />
        </Panel>
      )}

      {/* Potential features */}
      <PotentialPanel features={[
        { id: 'utm', label: 'UTM Attribution', desc: 'Veja de onde vem seu trafego por campanha' },
        { id: 'bots', label: 'Bot Filter', desc: 'Filtre trafego de bots automaticamente' },
        { id: 'newret', label: 'New vs Returning', desc: 'Compare visitantes novos e recorrentes' },
        { id: 'goals', label: 'Goals & Conversion', desc: 'Defina metas e acompanhe conversoes' },
        { id: 'geo', label: 'Geo Map', desc: 'Mapa mundial de visitantes em tempo real' },
        { id: 'qr', label: 'QR Funnel', desc: 'Funil completo de escaneamento a conversao' },
      ]} />
    </div>
  )
}
