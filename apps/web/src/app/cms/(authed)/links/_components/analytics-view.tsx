'use client'

import type { AnalyticsDisplay } from '@tn-figueiredo/links-admin'
import {
  StatTile, Delta, Spark, BarChart, Donut, HBars, Heatmap, CountryList, Panel,
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
      {/* Range tabs */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={exporting}
          aria-label="Exportar dados como CSV"
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {exporting ? 'Exportando...' : 'Exportar CSV'}
        </button>
        <RangeTabs value={range} onChange={setRange} />
      </div>

      {/* Period comparison note */}
      <p className="text-right text-[10px] text-muted-foreground -mt-3">
        Comparando com periodo anterior
      </p>

      {/* KPI row */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <StatTile
          label="Cliques totais"
          value={fmt(data.totalClicks)}
          delta={<Delta cur={data.totalClicks} prev={data.prevClicks} />}
          spark={<Spark data={data.byDay.slice(-14)} color="#F2683C" w={70} h={24} />}
        />
        <StatTile
          label="Visitantes unicos"
          value={fmt(data.unique)}
          delta={<Delta cur={data.unique} prev={data.prevUnique} />}
        />
        <StatTile
          label="CTR medio"
          value={`${data.ctr}%`}
          sub="cliques / pageviews"
          delta={<Delta cur={data.ctr} prev={data.prevCtr} suffix="pp" />}
        />
        <StatTile
          label="QR share"
          value={`${data.qrShare}%`}
          sub="do total de cliques"
        />
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
