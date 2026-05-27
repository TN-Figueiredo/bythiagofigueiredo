'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div role="alert" className="rounded-lg border p-6 text-center" style={{ borderColor: 'var(--gem-border)', background: 'var(--gem-surface)' }}>
          <p className="text-sm" style={{ color: 'var(--gem-dim)' }}>Erro ao carregar esta seção. Recarregue a página.</p>
        </div>
      )
    }
    return this.props.children
  }
}
