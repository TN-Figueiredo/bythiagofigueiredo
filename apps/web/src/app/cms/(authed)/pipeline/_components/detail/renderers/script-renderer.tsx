'use client'

import { useMemo, Fragment } from 'react'
import type { RendererProps } from '../section-content'
import { StatusBadge } from './status-badge'
import { TagPill, PauseChip, EmphHighlight, getTagColor } from './tokens'
import { tokenizeText } from './parse-tokens'
import { parseScriptTags, type ScriptSegment } from './parse-script-tags'

interface ScriptMeta {
  canal?: string
  formato?: string
  angulos?: string
  duracao?: string
  framework?: string
  fonte_vvs?: string
}

interface Beat {
  number: number
  label: string
  text: string
  status?: string
  divergence_note?: string
}

interface ScriptContent {
  meta?: ScriptMeta
  beats?: Beat[]
}

function parseContent(content: RendererProps['content']): ScriptContent {
  if (typeof content === 'string') return { beats: [{ number: 1, label: 'Beat 1', text: content, status: undefined }] }
  if (Array.isArray(content) || content === null) return {}
  return content as ScriptContent
}

function SegmentRenderer({ segment }: { segment: ScriptSegment }) {
  switch (segment.type) {
    case 'tag': {
      const textColor = getTagColor(segment.tag).text
      return (
        <div className="tag-line flex items-start gap-2 py-1 px-1 rounded transition-colors hover:bg-white/[0.03]">
          <TagPill tag={segment.tag} />
          <span className="text-[11.5px] leading-relaxed" style={{ color: textColor }}>
            {tokenizeText(segment.content)}
          </span>
        </div>
      )
    }
    case 'narration': {
      const parts = segment.content.split(/\b([A-Z]{4,})\b/g)
      return (
        <div
          className="narration text-[13px] leading-[1.85] py-2.5 px-3.5 my-1.5 rounded-r"
          style={{
            color: 'var(--gem-text)',
            background: 'linear-gradient(90deg, var(--gem-well), transparent 80%)',
            borderLeft: '2px solid var(--gem-dim)',
          }}
        >
          {parts.map((part, i) =>
            i % 2 === 1 ? <EmphHighlight key={i} text={part} /> : <Fragment key={i}>{tokenizeText(part)}</Fragment>
          )}
        </div>
      )
    }
    case 'pause':
      return <PauseChip duration={segment.duration} />
    case 'section':
      return (
        <div className="my-2">
          <div
            className="text-[8px] font-bold uppercase tracking-widest pb-1 flex items-center gap-2"
            style={{ color: 'var(--gem-dim)' }}
          >
            {segment.label}
            <span className="flex-1 h-px" style={{ background: 'var(--gem-border)' }} />
          </div>
          <div className="text-[11.5px] leading-relaxed" style={{ color: 'var(--gem-muted)' }}>
            {tokenizeText(segment.content)}
          </div>
        </div>
      )
    case 'meta':
      return (
        <div
          className="inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded my-0.5 text-[10.5px]"
          style={{ background: 'var(--gem-well)' }}
        >
          <span className="text-[8.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--gem-dim)' }}>
            {segment.key}
          </span>
          <span style={{ color: 'var(--gem-muted)' }}>{segment.value}</span>
        </div>
      )
    case 'text':
      return (
        <span className="text-[11.5px] leading-relaxed" style={{ color: 'var(--gem-muted)' }}>
          {tokenizeText(segment.content)}
        </span>
      )
    case 'blockquote': {
      const bqParts = segment.content.split(/\b([A-Z]{4,})\b/g)
      return (
        <div
          className="narration text-[13px] leading-[1.85] py-2.5 px-3.5 my-1.5 rounded-r italic"
          style={{
            color: 'var(--gem-text)',
            background: 'linear-gradient(90deg, var(--gem-well), transparent 80%)',
            borderLeft: '2px solid var(--gem-dim)',
          }}
        >
          {bqParts.map((part, i) =>
            i % 2 === 1 ? <EmphHighlight key={i} text={part} /> : <Fragment key={i}>{tokenizeText(part)}</Fragment>
          )}
        </div>
      )
    }
    case 'bullet-list':
      return (
        <ul className="pl-4 my-1 space-y-0.5">
          {segment.items.map((item, i) => (
            <li key={i} className="text-[11.5px] leading-relaxed list-disc"
              style={{ color: 'var(--gem-muted)' }}>
              {tokenizeText(item)}
            </li>
          ))}
        </ul>
      )
  }
}

function groupClusters(segments: ScriptSegment[]): ScriptSegment[][] {
  const groups: ScriptSegment[][] = []
  let current: ScriptSegment[] = []

  for (const seg of segments) {
    if (seg.type === 'tag') {
      current.push(seg)
    } else {
      if (current.length > 0) {
        groups.push(current)
        current = []
      }
      groups.push([seg])
    }
  }
  if (current.length > 0) groups.push(current)
  return groups
}

function ParsedBeatContent({ text }: { text: string }) {
  const segments = useMemo(() => parseScriptTags(text), [text])
  const clusters = useMemo(() => groupClusters(segments), [segments])

  return (
    <div className="space-y-0.5">
      {clusters.map((cluster, ci) => {
        if (cluster.length > 1 || cluster[0]!.type === 'tag') {
          return (
            <div key={ci} className="pl-2 my-1" style={{ borderLeft: '1px solid var(--gem-border)' }}>
              {cluster.map((seg, si) => (
                <SegmentRenderer key={si} segment={seg} />
              ))}
            </div>
          )
        }
        return <SegmentRenderer key={ci} segment={cluster[0]!} />
      })}
    </div>
  )
}

export function ScriptRenderer({ content, isEditing, onContentChange }: RendererProps) {
  const data = parseContent(content)
  const meta = data.meta ?? {}
  const beats = data.beats ?? []

  const metaEntries = [
    ['Canal', meta.canal],
    ['Formato', meta.formato],
    ['Ângulos', meta.angulos],
    ['Duração', meta.duracao],
    ['Framework', meta.framework],
    ['Fonte VVS', meta.fonte_vvs],
  ].filter(([, v]) => v) as [string, string][]

  return (
    <div className="p-5 space-y-3">
      {metaEntries.length > 0 && (
        <div
          className="grid grid-cols-2 gap-x-4 gap-y-1.5 p-3 rounded-md text-[11px]"
          style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}
        >
          {metaEntries.map(([label, value]) => (
            <div key={label} className="flex gap-1.5">
              <span style={{ color: 'var(--gem-dim)' }}>{label}:</span>
              <span style={{ color: 'var(--gem-muted)' }}>{value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {beats.map((beat, idx) => (
          <div
            key={idx}
            className="rounded-md overflow-hidden"
            style={{
              border: '1px solid var(--gem-border)',
              background: beat.divergence_note ? 'rgba(249,115,22,0.05)' : 'transparent',
              borderColor: beat.divergence_note ? 'rgba(249,115,22,0.3)' : 'var(--gem-border)',
            }}
          >
            <div
              className="flex items-center gap-2 px-3 py-1.5"
              style={{ background: 'var(--gem-well)', borderBottom: '1px solid var(--gem-border)' }}
            >
              <span
                className="text-[10px] font-bold tabular-nums"
                style={{ color: 'var(--gem-accent)', minWidth: '1.5rem' }}
              >
                #{beat.number}
              </span>
              <span className="text-[11px] font-medium flex-1" style={{ color: 'var(--gem-text)' }}>
                {beat.label}
              </span>
              {beat.status && <StatusBadge status={beat.status} />}
            </div>

            {isEditing ? (
              <div
                className="px-3 py-2 font-mono text-[11px] leading-relaxed"
                style={{ color: 'var(--gem-muted)' }}
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                onBlur={(e) => {
                  const updated = beats.map((b, i) =>
                    i === idx ? { ...b, text: e.currentTarget.textContent ?? '' } : b
                  )
                  onContentChange({ ...data, beats: updated })
                }}
              >
                {beat.text}
              </div>
            ) : (
              <div className="px-3 py-2">
                <ParsedBeatContent text={beat.text} />
              </div>
            )}

            {beat.divergence_note && (
              <div
                className="px-3 py-1.5 text-[10px]"
                style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316', borderTop: '1px solid rgba(249,115,22,0.2)' }}
              >
                ⚠ {beat.divergence_note}
              </div>
            )}
          </div>
        ))}
      </div>

      {beats.length === 0 && (
        <div className="text-[11px] text-center py-4" style={{ color: 'var(--gem-dim)' }}>
          Nenhum beat encontrado no roteiro.
        </div>
      )}
    </div>
  )
}
