'use client'

import type { RendererProps } from '../section-content'

interface PostProdContent {
  schema_version?: string
  timeline?: {
    beats?: Array<{
      index: number
      label: string
      status?: string
      timecode_in?: string
      timecode_out?: string
      duration_sec?: number
    }>
    total_duration_sec?: number
    fps?: number
  }
  assets?: Record<string, unknown>
  crossref?: {
    summary?: string
    beats?: Array<{ beat: string; status?: string }>
    divergences?: string[]
  }
  speedramps?: {
    summary?: string
    sections?: Array<{ section: string; speed: string; rationale?: string }>
  }
}

function parseContent(content: RendererProps['content']): PostProdContent {
  if (typeof content === 'string') return {}
  if (Array.isArray(content)) return {}
  if (content === null) return {}
  return content as PostProdContent
}

export function PostProductionView({ content }: RendererProps) {
  const data = parseContent(content)
  const beats = data.timeline?.beats ?? []
  const crossrefBeats = data.crossref?.beats ?? []
  const rampSections = data.speedramps?.sections ?? []
  const isV2 = data.schema_version === '2.0'

  if (!isV2 && beats.length === 0 && crossrefBeats.length === 0 && rampSections.length === 0) {
    return (
      <div className="p-5 text-[11px] text-center" style={{ color: 'var(--gem-dim)' }}>
        Nenhum dado de pós-produção disponível. Envie pelo Cowork para gerar.
      </div>
    )
  }

  return (
    <div className="p-5 space-y-4">
      {/* Schema version badge */}
      {isV2 && (
        <div
          className="text-[9px] px-2 py-0.5 rounded inline-block font-mono"
          style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}
        >
          PostProd v2.0
        </div>
      )}

      {/* Timeline beats */}
      {beats.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--gem-dim)' }}>
            Timeline ({beats.length} beats)
          </div>
          <div className="space-y-1">
            {beats.map((beat, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-md text-[11px]"
                style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}
              >
                <span
                  className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono shrink-0"
                  style={{ background: 'var(--gem-surface)', color: 'var(--gem-muted)', border: '1px solid var(--gem-border)' }}
                >
                  {beat.index}
                </span>
                <span style={{ color: 'var(--gem-text)' }}>{beat.label}</span>
                {beat.timecode_in && (
                  <span className="font-mono text-[10px] ml-auto" style={{ color: 'var(--gem-dim)' }}>
                    {beat.timecode_in}{beat.timecode_out ? ` - ${beat.timecode_out}` : ''}
                  </span>
                )}
                {beat.status && (
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded"
                    style={{
                      background: beat.status === 'done' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.1)',
                      color: beat.status === 'done' ? '#22c55e' : '#eab308',
                    }}
                  >
                    {beat.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cross-reference summary */}
      {data.crossref?.summary && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--gem-dim)' }}>
            Cross-Reference
          </div>
          <div className="text-[11px] p-3 rounded-md" style={{ background: 'var(--gem-well)', color: 'var(--gem-muted)' }}>
            {data.crossref.summary}
          </div>
          {(data.crossref.divergences ?? []).length > 0 && (
            <div className="mt-1.5 space-y-1">
              {data.crossref.divergences!.map((d, i) => (
                <div key={i} className="text-[10px] flex items-start gap-1.5" style={{ color: '#f87171' }}>
                  <span>!</span>
                  <span>{d}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Speed ramps summary */}
      {rampSections.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--gem-dim)' }}>
            Speed Ramps ({rampSections.length})
          </div>
          <div className="space-y-1">
            {rampSections.map((ramp, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-md text-[11px]"
                style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}
              >
                <span style={{ color: 'var(--gem-text)' }}>{ramp.section}</span>
                <span className="font-mono text-[10px] ml-auto px-1.5 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>
                  {ramp.speed}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.timeline?.total_duration_sec != null && data.timeline.total_duration_sec > 0 && (
        <div className="text-[9px] pt-1" style={{ color: 'var(--gem-dim)' }}>
          Duração total: {Math.floor(data.timeline.total_duration_sec / 60)}:{String(Math.round(data.timeline.total_duration_sec % 60)).padStart(2, '0')}
          {data.timeline.fps ? ` @ ${data.timeline.fps}fps` : ''}
        </div>
      )}
    </div>
  )
}
