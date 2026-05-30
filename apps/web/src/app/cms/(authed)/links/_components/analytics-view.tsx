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

      {/* Bar chart + Insights row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14, alignItems: 'start' }}>
        {/* Bar chart */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <TrendingUp size={15} strokeWidth={1.7} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '13.5px', fontWeight: 600, flex: 1, color: 'var(--ink)' }}>Cliques por dia</span>
            <div style={{ display: 'flex', gap: 14, fontSize: 11 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--ink-dim)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--accent)' }} />
                atual
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--ink-dim)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--line-strong)' }} />
                anterior
              </span>
            </div>
          </div>
          <BarChart data={data.byDay} prev={data.byDayPrev} height={170} />
        </div>

        {/* Insights */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
              <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
              <path d="M18 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
            </svg>
            <span style={{ fontSize: '13.5px', fontWeight: 600, flex: 1, color: 'var(--ink)' }}>Insights</span>
            <span className="mono" style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 9px', borderRadius: 999,
              fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
              background: 'rgba(110, 99, 242, 0.15)', color: 'rgb(155, 147, 246)',
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
                <path d="M18 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
              </svg>
              auto
            </span>
          </div>
          {data.insights.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {data.insights.map((ins) => {
                const toneColor = ins.tone === 'up' ? 'var(--green)' : ins.tone === 'accent' ? 'var(--accent)' : ins.tone === 'amber' ? 'var(--amber)' : 'var(--red)'
                return (
                  <div key={`${ins.tone}-${ins.text.slice(0, 20)}`} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                    <span style={{
                      width: 26, height: 26, borderRadius: 7,
                      background: toneColor + '22',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: 1,
                      color: toneColor,
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        {ins.tone === 'red' ? <><path d="M12 4l9 16H3z" /><path d="M12 10v4" /><path d="M12 17h.01" /></> : <><path d="M3 17l5-6 4 4 8-9" /><path d="M21 6h-4" /><path d="M21 6v4" /></>}
                      </svg>
                    </span>
                    <span style={{ fontSize: '12.5px', color: 'var(--ink-dim)', lineHeight: 1.5 }}>{ins.text}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ padding: '16px 0', textAlign: 'center', fontSize: 12, color: 'var(--ink-faint)' }}>Nenhum insight disponível.</p>
          )}
        </div>
      </div>

      {/* Source + Device row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
        {/* Source breakdown */}
        <Panel title="Por origem" icon="so">
          <SourceBars sources={data.bySource} />
        </Panel>

        {/* Devices donut */}
        <Panel title="Dispositivo" icon="mo">
          <Donut
            segments={data.devices.length > 0 ? data.devices : [
              { k: 'Mobile', v: 0, color: '#F2683C' },
              { k: 'Desktop', v: 0, color: '#3FA9C0' },
              { k: 'Tablet', v: 0, color: '#A77CE8' },
            ]}
            size={120}
            thickness={16}
            centerLabel={data.devices.length > 0 ? `${data.devices[0]?.v ?? 0}%` : '0%'}
            centerSub="sessões"
          />
        </Panel>

        {/* Browsers */}
        <Panel title="Navegador" icon="br">
          <HBars rows={data.browsers.length > 0 ? data.browsers : [
            { k: 'Chrome', v: 0 }, { k: 'Safari', v: 0 }, { k: 'Firefox', v: 0 }, { k: 'Edge', v: 0 },
          ]} />
        </Panel>

        {/* OS */}
        <Panel title="Sistema" icon="os">
          <HBars rows={data.os.length > 0 ? data.os : [
            { k: 'iOS', v: 0 }, { k: 'Android', v: 0 }, { k: 'Windows', v: 0 }, { k: 'macOS', v: 0 },
          ]} color="#3FA9C0" />
        </Panel>

        {/* Heatmap */}
        <Panel title="Horários de pico" icon="he" style={{ gridColumn: 'span 2' }}>
          <Heatmap grid={data.heatmap} />
        </Panel>

        {/* Countries */}
        <Panel title="Países" icon="gl">
          {data.countries.length > 0 ? (
            <CountryList countries={data.countries} />
          ) : (
            <p style={{ padding: '16px 0', textAlign: 'center', fontSize: 12, color: 'var(--ink-faint)' }}>Nenhum dado geográfico ainda.</p>
          )}
        </Panel>

        {/* Referrers */}
        <Panel title="Referrer" icon="re">
          <HBars rows={data.referrers.length > 0 ? data.referrers : [
            { k: 'Direto', v: 0 }, { k: 'Google', v: 0 }, { k: 'Outro', v: 0 },
          ]} color="#A77CE8" />
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
