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
        <div className="rounded-lg border border-[var(--bdr-1)] bg-[var(--bg-2)] p-6 text-center">
          <p className="text-sm text-[var(--t3)]">Erro ao carregar esta seção. Recarregue a página.</p>
        </div>
      )
    }
    return this.props.children
  }
}
