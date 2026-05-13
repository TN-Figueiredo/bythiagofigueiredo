'use client'

import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import type { SocialStrings } from '../../_i18n/types'

interface ChartDataPoint {
  date: string
  clicks: number
  engagement: number
  posts: number
}

interface EngagementChartProps {
  data: ChartDataPoint[]
  strings: SocialStrings
}

export function EngagementChart({ data, strings: t }: EngagementChartProps) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#888' }} />
          <YAxis tick={{ fontSize: 11, fill: '#888' }} />
          <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }} />
          <Bar dataKey="posts" fill="#3b82f6" opacity={0.4} name={t.insights.chart.postCount} />
          <Line type="monotone" dataKey="clicks" stroke="#a855f7" strokeWidth={2} name={t.insights.chart.clicks} dot={false} />
          <Line type="monotone" dataKey="engagement" stroke="#22c55e" strokeWidth={2} name={t.insights.chart.engagement} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
