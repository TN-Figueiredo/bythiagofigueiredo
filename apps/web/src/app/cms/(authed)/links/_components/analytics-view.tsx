'use client'

import type { AnalyticsDisplay } from '@tn-figueiredo/links-admin'
import {
  StatTile, Delta, Spark, BarChart, Donut, HBars, Heatmap, CountryList, Panel,
} from '@tn-figueiredo/links-admin/client'
import { SourceBars } from './source-bars'
import { InsightsPanel } from './insights-panel'
import { RangeTabs } from './range-tabs'
import { useState } from 'react'

function fmt(n: number): string {
  return n.toLocaleString('pt-BR')
}

interface AnalyticsViewProps {
  data: AnalyticsDisplay
}

export function AnalyticsView({ data }: AnalyticsViewProps) {
  const [range, setRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d')

  return (
    <div className="space-y-5">
      {/* Range tabs */}
      <div className="flex justify-end">
        <RangeTabs value={range} onChange={setRange} />
      </div>

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
          <Donut segments={data.devices} centerLabel={`${data.devices[0]?.v ?? 0}%`} centerSub={data.devices[0]?.k ?? ''} />
        </Panel>

        {/* Browsers */}
        <Panel title="Navegadores" icon="br">
          <HBars rows={data.browsers} />
        </Panel>

        {/* OS */}
        <Panel title="Sistemas" icon="os">
          <HBars rows={data.os} color="#3FA9C0" />
        </Panel>

        {/* Heatmap */}
        <Panel title="Horarios de pico" icon="he" style={{ gridColumn: 'span 2' }}>
          <Heatmap grid={data.heatmap} />
        </Panel>

        {/* Countries */}
        <Panel title="Top paises" icon="gl">
          <CountryList countries={data.countries} />
        </Panel>

        {/* Referrers */}
        <Panel title="Referrers" icon="re">
          <HBars rows={data.referrers} color="#A77CE8" />
        </Panel>
      </div>

      {/* Insights */}
      {data.insights.length > 0 && (
        <Panel title="Insights" icon="li">
          <InsightsPanel insights={data.insights} />
        </Panel>
      )}
    </div>
  )
}
