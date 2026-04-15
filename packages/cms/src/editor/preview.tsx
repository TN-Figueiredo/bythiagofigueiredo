'use client'

import * as React from 'react'
import type { CompiledMdx } from '../types/content'

export interface EditorPreviewProps {
  source: string
  onCompile: (source: string) => Promise<CompiledMdx>
  debounceMs?: number
}

type PreviewState =
  | { kind: 'idle' }
  | { kind: 'compiling' }
  | { kind: 'ok'; readingTimeMin: number; tocLength: number; sourceBytes: number }
  | { kind: 'error'; message: string }

export function EditorPreview({ source, onCompile, debounceMs = 500 }: EditorPreviewProps) {
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
  if (state.kind === 'compiling') return <p data-preview-status>Compilando…</p>
  if (state.kind === 'idle') return <p data-preview-status>Aguardando…</p>
  return (
    <div data-preview role="status">
      <p>✓ MDX compila sem erros</p>
      <p>{state.readingTimeMin} min de leitura · {state.tocLength} headings · {state.sourceBytes} bytes compilados</p>
    </div>
  )
}
