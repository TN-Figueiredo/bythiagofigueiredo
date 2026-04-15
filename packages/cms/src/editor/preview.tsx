'use client'

import * as React from 'react'
import type { CompiledMdx } from '../types/content'
import { getEditorStrings } from './strings'

export interface EditorPreviewProps {
  source: string
  locale: string
  onCompile: (source: string) => Promise<CompiledMdx>
  debounceMs?: number
}

type PreviewState =
  | { kind: 'idle' }
  | { kind: 'compiling' }
  | { kind: 'ok'; readingTimeMin: number; tocLength: number; sourceBytes: number }
  | { kind: 'error'; message: string }

export function EditorPreview({ source, locale, onCompile, debounceMs = 500 }: EditorPreviewProps) {
  const s = getEditorStrings(locale)
  const [state, setState] = React.useState<PreviewState>({ kind: 'idle' })
  const lastSourceRef = React.useRef(source)

  React.useEffect(() => {
    lastSourceRef.current = source
    setState({ kind: 'compiling' })
    const handle = window.setTimeout(async () => {
      try {
        const compiled = await onCompile(source)
        if (lastSourceRef.current !== source) return
        setState({
          kind: 'ok',
          readingTimeMin: compiled.readingTimeMin,
          tocLength: compiled.toc.length,
          sourceBytes: compiled.compiledSource.length,
        })
      } catch (e) {
        if (lastSourceRef.current !== source) return
        setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
      }
    }, debounceMs)
    return () => window.clearTimeout(handle)
  }, [source, onCompile, debounceMs])

  if (state.kind === 'error') {
    return <pre role="alert" data-preview-error>{state.message}</pre>
  }
  if (state.kind === 'compiling') return <p data-preview-status>{s.previewCompiling}</p>
  if (state.kind === 'idle') return <p data-preview-status>{s.previewIdle}</p>
  return (
    <div data-preview role="status">
      <p>{s.previewOk}</p>
      <p>{s.previewReadingTime(state.readingTimeMin)} · {s.previewHeadings(state.tocLength)} · {s.previewBytes(state.sourceBytes)}</p>
    </div>
  )
}
